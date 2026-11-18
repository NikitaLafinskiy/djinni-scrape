import {Pool, QueryResultRow} from "pg";
import {DsqlSigner} from "@aws-sdk/dsql-signer";

export const regionFromEndpoint = (hostname: string) => {
    const match = hostname.match(/\.dsql\.([a-z0-9-]+)\.on\.aws$/)
    if (!match) {
        throw new Error(`Cannot determine region from DSQL endpoint: ${hostname}`)
    }
    return match[1]
}

export const createPool = (hostname: string, user: string, max: number) => {
    const signer = new DsqlSigner({hostname, region: regionFromEndpoint(hostname)})
    return new Pool({
        host: hostname,
        port: 5432,
        database: "postgres",
        user,
        password: () => user === "admin" ? signer.getDbConnectAdminAuthToken() : signer.getDbConnectAuthToken(),
        ssl: true,
        max,
    })
}

let pool: Pool | undefined

const getPool = () => {
    if (!pool) {
        const hostname = process.env.DSQL_CLUSTER_ENDPOINT
        if (!hostname) {
            throw new Error("DSQL_CLUSTER_ENDPOINT is not set")
        }
        pool = createPool(hostname, process.env.DSQL_USER ?? "djinni_app", 2)
    }
    return pool
}

export const query = async <T extends QueryResultRow>(text: string, params: unknown[] = []) =>
    (await getPool().query<T>(text, params)).rows

export const execute = async (text: string, params: unknown[] = []) =>
    (await getPool().query(text, params)).rowCount ?? 0

export const closePool = async () => {
    await pool?.end()
    pool = undefined
}
