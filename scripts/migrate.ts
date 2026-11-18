import {readdirSync, readFileSync} from "node:fs";
import * as path from "node:path";
import {parseArgs} from "node:util";
import {createPool} from "@/db/client";

const MIGRATIONS_DIR = path.join(__dirname, "../db/migrations")

const {values} = parseArgs({
    options: {
        endpoint: {type: "string"},
        "role-arns": {type: "string"},
    },
})

if (!values.endpoint || !values["role-arns"]) {
    console.error("Usage: npm run migrate -- --endpoint <dsql endpoint> --role-arns <arn>,<arn>,...")
    process.exit(1)
}

const roleArns = values["role-arns"].split(",").map(arn => arn.trim()).filter(Boolean)
const iamGrants = roleArns.map(arn => `AWS IAM GRANT djinni_app TO '${arn.replace(/'/g, "''")}';`).join("\n")

// DSQL allows one DDL statement per transaction, so every statement runs on its own
const statements = (sql: string) => sql
    .replace("{{IAM_GRANTS}}", iamGrants)
    .split(/;\s*(?:\n|$)/)
    .map(statement => statement.trim())
    .filter(Boolean)

;(async () => {
    const pool = createPool(values.endpoint!, "admin", 1)
    try {
        await pool.query(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
        )
        const applied = new Set((await pool.query<{version: string}>("SELECT version FROM schema_migrations")).rows.map(row => row.version))
        const files = readdirSync(MIGRATIONS_DIR)
            .filter(file => /^V\d+__.+\.sql$/.test(file))
            .sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))

        for (const file of files) {
            const version = file.split("__")[0]
            if (applied.has(version)) {
                continue
            }
            console.log(`applying ${file}`)
            for (const statement of statements(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))) {
                await pool.query(statement)
            }
            await pool.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version])
        }
        console.log("migrations are up to date")
    } finally {
        await pool.end()
    }
})()
