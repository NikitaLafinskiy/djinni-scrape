import {getSsmProperty} from "@/utils/ssm";

const BASE_URL = process.env.MELIOUS_BASE_URL ?? "https://api.melious.ai/v1"
const MODEL = process.env.MELIOUS_MODEL ?? "glm-5.3-flash"
const TIMEOUT_MS = 120_000

type ChatCompletion = {
    choices?: {finish_reason?: string, message?: {content?: string}}[];
}

export const getMeliousApiKey = async () =>
    process.env.MELIOUS_API_KEY ?? await getSsmProperty("melious-api-key").catch(() => undefined)

export const complete = async (apiKey: string, systemPrompt: string, userPrompt: string) => {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {"authorization": `Bearer ${apiKey}`, "content-type": "application/json"},
        body: JSON.stringify({
            model: MODEL,
            messages: [{role: "system", content: systemPrompt}, {role: "user", content: userPrompt}],
            reasoning_effort: "medium",
            max_tokens: 8000,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
        throw new Error(`${MODEL} returned ${response.status}: ${(await response.text()).slice(0, 300)}`)
    }
    const choice = ((await response.json()) as ChatCompletion).choices?.[0]
    if (choice?.finish_reason !== "stop" || !choice.message?.content?.trim()) {
        throw new Error(`${MODEL} returned no usable answer: finish_reason=${choice?.finish_reason}`)
    }
    return choice.message.content
}
