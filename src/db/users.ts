import {execute, query} from "@/db/client";
import {PlatformName, ScrapeMessage, ScrapeUser} from "@/types/Application";

export const DEFAULT_NFJ_LOCATIONS = "Remote, Warszawa"
export const DEFAULT_NFJ_LANGUAGES = "English, Russian, Ukrainian"

const USER_COLUMNS = `
    u.id, u.name, u.djinni_email, u.apply_message, u.skip_ukraine_only, u.active,
    u.djinni_password IS NOT NULL AS has_password,
    coalesce(u.djinni_enabled, true) AS djinni_enabled,
    coalesce(u.nfj_enabled, true) AS nfj_enabled,
    u.nfj_email, u.nfj_phone, u.nfj_apply_message,
    coalesce(u.nfj_locations, '${DEFAULT_NFJ_LOCATIONS}') AS nfj_locations,
    coalesce(u.nfj_languages, '${DEFAULT_NFJ_LANGUAGES}') AS nfj_languages,
    coalesce(u.nfj_require_english, true) AS nfj_require_english,
    u.nfj_password IS NOT NULL AS has_nfj_password,
    u.candidate_info,
    u.created_at, u.updated_at`

export const EDITABLE_USER_FIELDS = [
    "name", "djinni_email", "apply_message", "skip_ukraine_only", "active", "djinni_enabled", "nfj_enabled",
    "nfj_email", "nfj_phone", "nfj_apply_message", "nfj_locations", "nfj_languages", "nfj_require_english",
    "candidate_info",
] as const
export const BOOLEAN_USER_FIELDS: readonly string[] = ["skip_ukraine_only", "active", "djinni_enabled", "nfj_enabled", "nfj_require_english"]
export type EditableUserFields = Partial<Record<typeof EDITABLE_USER_FIELDS[number], string | boolean | null>>

export const listUsers = () => query(`
    SELECT ${USER_COLUMNS},
        (SELECT count(*) FROM user_urls uu WHERE uu.user_id = u.id)::int AS url_count,
        (SELECT max(a.updated_at) FROM applications a WHERE a.user_id = u.id) AS last_application_at
    FROM users u
    ORDER BY u.created_at`)

export const getUser = async (id: string) =>
    (await query(`SELECT ${USER_COLUMNS} FROM users u WHERE u.id = $1`, [id]))[0]

export const createUser = async (fields: EditableUserFields) => {
    const columns = Object.keys(fields)
    const rows = await query<{id: string}>(
        `INSERT INTO users (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
        Object.values(fields),
    )
    return getUser(rows[0].id)
}

export const updateUser = async (id: string, fields: EditableUserFields) => {
    const columns = Object.keys(fields)
    if (columns.length > 0) {
        await execute(
            `UPDATE users SET ${columns.map((column, i) => `${column} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1`,
            [id, ...Object.values(fields)],
        )
    }
    return getUser(id)
}

// DSQL caps a transaction at 3000 modified rows, so applications are deleted in chunks
export const deleteUser = async (id: string) => {
    while (await execute(
        "DELETE FROM applications WHERE id IN (SELECT id FROM applications WHERE user_id = $1 LIMIT 1000)", [id],
    ) > 0) {}
    await execute("DELETE FROM user_urls WHERE user_id = $1", [id])
    await execute("DELETE FROM user_ignore_words WHERE user_id = $1", [id])
    return await execute("DELETE FROM users WHERE id = $1", [id]) > 0
}

const splitList = (value: string) => value.split(",").map(item => item.trim()).filter(Boolean)

export const getUserWithCredentials = async (id: string): Promise<ScrapeUser | undefined> => {
    const row = (await query<Omit<ScrapeUser, "nfjLocations" | "nfjLanguages"> & {nfjLocations: string, nfjLanguages: string}>(`
        SELECT id, djinni_email AS "djinniEmail", djinni_password AS "djinniPassword",
            apply_message AS "applyMessage", skip_ukraine_only AS "skipUkraineOnly",
            coalesce(djinni_enabled, true) AS "djinniEnabled", coalesce(nfj_enabled, true) AS "nfjEnabled",
            nfj_email AS "nfjEmail", nfj_password AS "nfjPassword", nfj_phone AS "nfjPhone",
            nfj_apply_message AS "nfjApplyMessage",
            coalesce(nfj_locations, '${DEFAULT_NFJ_LOCATIONS}') AS "nfjLocations",
            coalesce(nfj_languages, '${DEFAULT_NFJ_LANGUAGES}') AS "nfjLanguages",
            coalesce(nfj_require_english, true) AS "nfjRequireEnglish",
            candidate_info AS "candidateInfo"
        FROM users WHERE id = $1`, [id]))[0]
    return row && {...row, nfjLocations: splitList(row.nfjLocations), nfjLanguages: splitList(row.nfjLanguages)}
}

export const listUrls = (userId: string) =>
    query("SELECT id, url, platform, active, created_at FROM user_urls WHERE user_id = $1 ORDER BY created_at", [userId])

export const getUrl = async (userId: string, urlId: string) =>
    (await query<{id: string, url: string, active: boolean}>(
        "SELECT id, url, active FROM user_urls WHERE user_id = $1 AND id = $2", [userId, urlId],
    ))[0]

export const addUrl = async (userId: string, url: string, platform: PlatformName) =>
    (await query(
        "INSERT INTO user_urls (user_id, url, platform) VALUES ($1, $2, $3) RETURNING id, url, platform, active, created_at",
        [userId, url, platform],
    ))[0]

export const updateUrl = async (userId: string, urlId: string, fields: {url?: string, platform?: PlatformName, active?: boolean}) => {
    const columns = Object.keys(fields)
    return (await query(
        `UPDATE user_urls SET ${columns.map((column, i) => `${column} = $${i + 3}`).join(", ")}
         WHERE user_id = $1 AND id = $2 RETURNING id, url, platform, active, created_at`,
        [userId, urlId, ...Object.values(fields)],
    ))[0]
}

export const deleteUrl = async (userId: string, urlId: string) =>
    await execute("DELETE FROM user_urls WHERE user_id = $1 AND id = $2", [userId, urlId]) > 0

export const listIgnoreWords = (userId: string) =>
    query<{id: string, word: string}>(
        "SELECT id, word, created_at FROM user_ignore_words WHERE user_id = $1 ORDER BY created_at", [userId],
    )

export const addIgnoreWord = async (userId: string, word: string) =>
    (await query(
        "INSERT INTO user_ignore_words (user_id, word) VALUES ($1, $2) RETURNING id, word, created_at", [userId, word],
    ))[0]

export const deleteIgnoreWord = async (userId: string, wordId: string) =>
    await execute("DELETE FROM user_ignore_words WHERE user_id = $1 AND id = $2", [userId, wordId]) > 0

export const listScrapeTargets = (userId?: string) =>
    query<ScrapeMessage>(`
        SELECT u.id AS "userId", uu.id AS "urlId", uu.url
        FROM users u
        JOIN user_urls uu ON uu.user_id = u.id
        WHERE u.active AND uu.active
            AND (
                (uu.platform = 'djinni' AND coalesce(u.djinni_enabled, true)
                    AND u.djinni_email IS NOT NULL AND u.djinni_password IS NOT NULL
                    AND coalesce(trim(u.apply_message), '') <> '')
                OR (uu.platform = 'nfj' AND coalesce(u.nfj_enabled, true)
                    AND u.nfj_email IS NOT NULL AND u.nfj_password IS NOT NULL)
            )
            AND ($1::uuid IS NULL OR u.id = $1::uuid)`, [userId ?? null])
