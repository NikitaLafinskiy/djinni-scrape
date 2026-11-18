import {timingSafeEqual} from "node:crypto";
import {APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2} from "aws-lambda";
import {
    addIgnoreWord, addUrl, BOOLEAN_USER_FIELDS, createUser, deleteIgnoreWord, deleteUrl, deleteUser, EDITABLE_USER_FIELDS,
    EditableUserFields, getUser, listIgnoreWords, listScrapeTargets, listUrls, listUsers, updateUrl, updateUser,
} from "@/db/users";
import {platformNameForUrl} from "@/platforms/hosts";
import {listApplications} from "@/db/applications";
import {enqueueScrapes} from "@/utils/sqs";
import {getSsmProperty} from "@/utils/ssm";
import {APPLICATION_STATUSES, ApplicationStatus, PLATFORMS, PlatformName} from "@/types/Application";

type Request = {
    params: string[];
    body: Record<string, unknown>;
    query: Record<string, string | undefined>;
}
type Route = {
    method: string;
    path: RegExp;
    handle: (request: Request) => Promise<APIGatewayProxyStructuredResultV2>;
}

class HttpError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message)
    }
}

const UUID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
const PAGE_SIZE = 100

const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({
    statusCode,
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
})

const found = (value: unknown) => {
    if (!value) {
        throw new HttpError(404, "Not found")
    }
    return json(200, value)
}

const requireString = (body: Record<string, unknown>, field: string) => {
    const value = body[field]
    if (typeof value !== "string" || !value.trim()) {
        throw new HttpError(400, `${field} must be a non-empty string`)
    }
    return value.trim()
}

const requireJobBoardUrl = (body: Record<string, unknown>) => {
    const url = requireString(body, "url")
    const platform = platformNameForUrl(url)
    if (!platform) {
        throw new HttpError(400, "url must be a djinni.co or nofluffjobs.com URL")
    }
    return {url, platform}
}

const userFields = (body: Record<string, unknown>) => {
    for (const passwordField of ["djinni_password", "nfj_password"]) {
        if (passwordField in body) {
            throw new HttpError(400, `${passwordField} can only be set directly in the database`)
        }
    }
    const fields: EditableUserFields = {}
    for (const [key, value] of Object.entries(body)) {
        if (!(EDITABLE_USER_FIELDS as readonly string[]).includes(key)) {
            throw new HttpError(400, `Unknown field ${key}`)
        }
        const isBoolean = BOOLEAN_USER_FIELDS.includes(key)
        if (isBoolean ? typeof value !== "boolean" : typeof value !== "string") {
            throw new HttpError(400, `${key} must be a ${isBoolean ? "boolean" : "string"}`)
        }
        fields[key as keyof EditableUserFields] = typeof value === "string" ? value.trim() || null : value as boolean
    }
    if (fields.name === null) {
        throw new HttpError(400, "name must be a non-empty string")
    }
    return fields
}

const applicationFilter = (query: Request["query"]) => {
    const statuses = query.status?.split(",").filter(Boolean)
    const invalid = statuses?.find(status => !(APPLICATION_STATUSES as readonly string[]).includes(status))
    if (invalid) {
        throw new HttpError(400, `Unknown status ${invalid}`)
    }
    if (query.before && isNaN(Date.parse(query.before))) {
        throw new HttpError(400, "before must be a timestamp")
    }
    if (query.platform && !(PLATFORMS as readonly string[]).includes(query.platform)) {
        throw new HttpError(400, `Unknown platform ${query.platform}`)
    }
    return {
        statuses: statuses?.length ? statuses as ApplicationStatus[] : undefined,
        platform: query.platform as PlatformName | undefined,
        before: query.before,
        limit: PAGE_SIZE,
    }
}

const routes: Route[] = [
    {method: "GET", path: /^\/users$/, handle: async () => json(200, await listUsers())},
    {
        method: "POST", path: /^\/users$/, handle: async ({body}) => {
            const fields = userFields(body)
            requireString(body, "name")
            if (!fields.djinni_email && !fields.nfj_email) {
                throw new HttpError(400, "djinni_email or nfj_email is required")
            }
            return json(201, await createUser(fields))
        },
    },
    {
        method: "GET", path: new RegExp(`^/users/${UUID}$`), handle: async ({params: [id]}) => {
            const user = await getUser(id)
            if (!user) {
                throw new HttpError(404, "Not found")
            }
            return json(200, {...user, urls: await listUrls(id), ignore_words: await listIgnoreWords(id)})
        },
    },
    {
        method: "PATCH", path: new RegExp(`^/users/${UUID}$`),
        handle: async ({params: [id], body}) => found(await updateUser(id, userFields(body))),
    },
    {
        method: "DELETE", path: new RegExp(`^/users/${UUID}$`),
        handle: async ({params: [id]}) => found(await deleteUser(id) && {deleted: true}),
    },
    {
        method: "POST", path: new RegExp(`^/users/${UUID}/urls$`), handle: async ({params: [id], body}) => {
            if (!await getUser(id)) {
                throw new HttpError(404, "Not found")
            }
            const {url, platform} = requireJobBoardUrl(body)
            return json(201, await addUrl(id, url, platform))
        },
    },
    {
        method: "PATCH", path: new RegExp(`^/users/${UUID}/urls/${UUID}$`), handle: async ({params: [id, urlId], body}) => {
            const fields: {url?: string, platform?: PlatformName, active?: boolean} = {}
            if ("url" in body) {
                Object.assign(fields, requireJobBoardUrl(body))
            }
            if ("active" in body) {
                if (typeof body.active !== "boolean") {
                    throw new HttpError(400, "active must be a boolean")
                }
                fields.active = body.active
            }
            if (Object.keys(fields).length === 0) {
                throw new HttpError(400, "Nothing to update")
            }
            return found(await updateUrl(id, urlId, fields))
        },
    },
    {
        method: "DELETE", path: new RegExp(`^/users/${UUID}/urls/${UUID}$`),
        handle: async ({params: [id, urlId]}) => found(await deleteUrl(id, urlId) && {deleted: true}),
    },
    {
        method: "POST", path: new RegExp(`^/users/${UUID}/ignore-words$`), handle: async ({params: [id], body}) => {
            if (!await getUser(id)) {
                throw new HttpError(404, "Not found")
            }
            return json(201, await addIgnoreWord(id, requireString(body, "word")))
        },
    },
    {
        method: "DELETE", path: new RegExp(`^/users/${UUID}/ignore-words/${UUID}$`),
        handle: async ({params: [id, wordId]}) => found(await deleteIgnoreWord(id, wordId) && {deleted: true}),
    },
    {
        method: "POST", path: new RegExp(`^/users/${UUID}/run$`), handle: async ({params: [id]}) => {
            if (!await getUser(id)) {
                throw new HttpError(404, "Not found")
            }
            const runStartedAt = new Date().toISOString()
            const targets = await listScrapeTargets(id)
            return json(202, {enqueued: await enqueueScrapes(targets.map(target => ({...target, runStartedAt})))})
        },
    },
    {
        method: "GET", path: new RegExp(`^/users/${UUID}/applications$`),
        handle: async ({params: [id], query}) => json(200, await listApplications({userId: id, ...applicationFilter(query)})),
    },
    {
        method: "GET", path: /^\/applications$/,
        handle: async ({query}) => json(200, await listApplications(applicationFilter(query))),
    },
]

const isAuthorized = async (header: string | undefined) => {
    const credentials = await getSsmProperty("admin-basic-auth")
    const separator = credentials.indexOf(":")
    if (separator < 1 || separator === credentials.length - 1) {
        throw new Error("admin-basic-auth must be \"user:password\" with both parts non-empty")
    }
    const expected = Buffer.from("Basic " + Buffer.from(credentials).toString("base64"))
    const actual = Buffer.from(header ?? "")
    return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const parseBody = (event: APIGatewayProxyEventV2) => {
    if (!event.body) {
        return {}
    }
    try {
        const body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body)
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
            throw new Error()
        }
        return body as Record<string, unknown>
    } catch {
        throw new HttpError(400, "Body must be a JSON object")
    }
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    try {
        if (!await isAuthorized(event.headers.authorization)) {
            return json(401, {error: "Unauthorized"})
        }
        const method = event.requestContext.http.method
        const path = event.rawPath.replace(/\/+$/, "") || "/"
        for (const route of routes) {
            const match = path.match(route.path)
            if (match && route.method === method) {
                return await route.handle({
                    params: match.slice(1),
                    body: parseBody(event),
                    query: event.queryStringParameters ?? {},
                })
            }
        }
        return json(404, {error: "Not found"})
    } catch (e) {
        if (e instanceof HttpError) {
            return json(e.statusCode, {error: e.message})
        }
        console.error(e)
        return json(500, {error: "Internal server error"})
    }
}
