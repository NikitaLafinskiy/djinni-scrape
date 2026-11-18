const API_URL = "https://api.2captcha.com"
const POLL_INTERVAL_MS = 5000
const MAX_POLLS = 36

type TwoCaptchaResponse = {
    errorId: number;
    errorCode?: string;
    taskId?: number;
    status?: string;
    solution?: {token: string};
}

const post = async (path: string, body: object): Promise<TwoCaptchaResponse> => {
    const response = await fetch(API_URL + path, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(body),
    })
    return response.json() as Promise<TwoCaptchaResponse>
}

export const solveTurnstile = async (apiKey: string, task: {websiteURL: string, websiteKey: string, action?: string, data?: string}) => {
    const created = await post("/createTask", {clientKey: apiKey, task: {type: "TurnstileTaskProxyless", ...task}})
    if (created.errorId || !created.taskId) {
        throw new Error(`2captcha could not create the Turnstile task: ${created.errorCode}`)
    }
    for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
        const result = await post("/getTaskResult", {clientKey: apiKey, taskId: created.taskId})
        if (result.errorId) {
            throw new Error(`2captcha could not solve the Turnstile: ${result.errorCode}`)
        }
        if (result.status === "ready" && result.solution?.token) {
            return result.solution.token
        }
    }
    throw new Error(`2captcha did not solve the Turnstile within ${MAX_POLLS * POLL_INTERVAL_MS / 1000}s`)
}
