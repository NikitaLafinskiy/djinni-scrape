import {Page} from "playwright";
import {complete, getMeliousApiKey} from "@/utils/melious";

export type QuestionType = "text" | "number" | "single_choice" | "multiple_choice"

export type Question = {
    id: string;
    label: string;
    type: QuestionType;
    options?: string[];
    required: boolean;
}

type Answer = string | number | boolean | string[] | null

const SYSTEM_PROMPT = `You fill in the recruiter questions of a job application on behalf of the candidate described by the user.
Write every answer as the candidate themselves, in the first person, the way a real professional would answer a recruiter: natural, polite, concise and confident.
Never mention or hint at being an AI, a model, an assistant or an automated tool.
Use only facts from the candidate information. Never invent experience, skills, numbers, dates, salaries, links or contact details.
Text answers are 1-3 sentences unless the question clearly asks for more. Number answers are digits only.
For single_choice return exactly one of the listed options, for multiple_choice an array of listed options, copied verbatim.
If a question cannot be answered truthfully from the candidate information, or needs the candidate personally (a test task, a file, a specific date), answer null.
Reply with JSON only, no prose and no code fences: {"answers": {"<question id>": <answer or null>}}`

const parseAnswers = (content: string): Record<string, Answer> => {
    const json = content.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim()
    const parsed = JSON.parse(json.slice(json.indexOf("{"), json.lastIndexOf("}") + 1))
    return Object.fromEntries(Object.entries(parsed.answers ?? {}).map(([id, answer]) =>
        [id, typeof answer === "number" || typeof answer === "boolean" ? String(answer) : answer as Answer]))
}

const isValid = (question: Question, answer: Answer) => {
    if (answer === null || answer === undefined) {
        return false
    }
    switch (question.type) {
        case "number":
            return typeof answer === "string" && /^-?\d+([.,]\d+)?$/.test(answer.trim())
        case "single_choice":
            return typeof answer === "string" && question.options!.includes(answer)
        case "multiple_choice":
            return Array.isArray(answer) && answer.length > 0 && answer.every(option => question.options!.includes(option))
        default:
            return typeof answer === "string" && answer.trim().length > 0
    }
}

// returns null when the questions have to be answered manually
export const answerQuestions = async (
    candidateInfo: string | null,
    job: {title?: string | null, companyName?: string | null, description: string},
    questions: Question[],
) => {
    const apiKey = await getMeliousApiKey()
    if (!candidateInfo?.trim() || !apiKey || questions.length === 0) {
        console.log(`not answering recruiter questions with ai: ${!candidateInfo?.trim() ? "no candidate information" : !apiKey ? "no melious api key" : "no questions found"}`)
        return null
    }
    const content = await complete(apiKey, SYSTEM_PROMPT, JSON.stringify({
        candidate_information: candidateInfo,
        job: {title: job.title, company: job.companyName, description: job.description.slice(0, 6000)},
        questions: questions.map(({id, label, type, options, required}) => ({id, question: label, type, options, required})),
    }, null, 2))
    const answers = parseAnswers(content)
    const unanswered = questions.filter(question => question.required && !isValid(question, answers[question.id]))
    if (unanswered.length > 0) {
        console.log(`ai could not answer: ${unanswered.map(question => question.label).join(" | ")}`)
        return null
    }
    return Object.fromEntries(questions
        .filter(question => isValid(question, answers[question.id]))
        .map(question => [question.id, answers[question.id] as string | string[]]))
}

// tags every question control with data-ai-question / data-ai-option so the answers can be filled back in
export const extractQuestions = (page: Page, rootSelector: string, controlSelector: string) =>
    page.evaluate(({rootSelector, controlSelector}) => {
        const root = document.querySelector(rootSelector)
        if (!root) {
            return []
        }
        const clean = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").replace(/\*\s*$/, "").trim()
        const labelFor = (control: Element, optionLabels: string[] = []) => {
            const id = control.getAttribute("id")
            const explicit = id ? root.querySelector(`label[for="${CSS.escape(id)}"]`) : null
            if (explicit && control.getAttribute("type") !== "radio" && control.getAttribute("type") !== "checkbox") {
                return clean(explicit.textContent)
            }
            let container: Element | null = control.parentElement
            for (let depth = 0; container && depth < 6; depth++, container = container.parentElement) {
                const heading = [...container.querySelectorAll("legend, h4, h5, h6, p, .form-label, label")]
                    .find(candidate => !candidate.querySelector("input") && clean(candidate.textContent) && !optionLabels.includes(clean(candidate.textContent)))
                if (heading) {
                    return clean(heading.textContent)
                }
            }
            return clean(control.getAttribute("aria-label") ?? control.getAttribute("placeholder"))
        }
        const optionLabel = (input: Element) => {
            const id = input.getAttribute("id")
            const label = id ? root.querySelector(`label[for="${CSS.escape(id)}"]`) : input.closest("label")
            return clean(label?.textContent ?? input.getAttribute("value"))
        }

        const questions: {id: string, label: string, type: string, options?: string[], required: boolean}[] = []
        const groups = new Map<string, HTMLInputElement[]>()
        const containerKeys = new Map<Element, string>()
        const groupKey = (input: HTMLInputElement) => {
            if (input.name) {
                return input.name
            }
            const container = input.closest("cmn-apply-question, fieldset, .mb-3") ?? input.parentElement!
            if (!containerKeys.has(container)) {
                containerKeys.set(container, `group-${containerKeys.size}`)
            }
            return containerKeys.get(container)!
        }
        root.querySelectorAll<HTMLElement>(controlSelector).forEach(control => {
            const input = control as HTMLInputElement
            if (input.type === "hidden" || input.type === "file" || input.disabled) {
                return
            }
            if (input.type === "radio" || input.type === "checkbox") {
                const key = groupKey(input)
                groups.set(key, [...(groups.get(key) ?? []), input])
                return
            }
            const id = `q${questions.length + 1}`
            control.setAttribute("data-ai-question", id)
            if (control.tagName === "SELECT") {
                const select = control as unknown as HTMLSelectElement
                questions.push({id, label: labelFor(control), type: "single_choice", required: select.required,
                    options: [...select.options].map(option => clean(option.textContent)).filter(Boolean)})
            } else {
                questions.push({id, label: labelFor(control), type: input.type === "number" ? "number" : "text", required: true})
            }
        })
        groups.forEach(inputs => {
            const id = `q${questions.length + 1}`
            const options = inputs.map(optionLabel)
            inputs.forEach((input, i) => input.setAttribute("data-ai-option", `${id}-${i}`))
            questions.push({
                id,
                label: labelFor(inputs[0], options),
                type: inputs[0].type === "radio" ? "single_choice" : "multiple_choice",
                options,
                required: true,
            })
        })
        return questions
    }, {rootSelector, controlSelector}) as Promise<Question[]>

export const fillAnswers = async (page: Page, questions: Question[], answers: Record<string, string | string[]>) => {
    for (const question of questions) {
        const answer = answers[question.id]
        if (answer === undefined) {
            continue
        }
        if (question.type === "text" || question.type === "number") {
            await page.locator(`[data-ai-question="${question.id}"]`).fill(String(answer))
        } else if (question.options) {
            const chosen = Array.isArray(answer) ? answer : [answer]
            const select = page.locator(`select[data-ai-question="${question.id}"]`)
            if (await select.count() > 0) {
                await select.selectOption({label: chosen[0]})
                continue
            }
            for (const option of chosen) {
                const input = page.locator(`[data-ai-option="${question.id}-${question.options.indexOf(option)}"]`)
                if (!(await input.isChecked())) {
                    await input.dispatchEvent("click")
                }
            }
        }
    }
}

// answers the questions found in rootSelector, fills them in and returns a readable record of the answers,
// or null when they have to be answered manually
export const answerRecruiterQuestions = async (
    page: Page,
    candidateInfo: string | null,
    job: {title?: string | null, companyName?: string | null, descriptionSelector: string},
    rootSelector: string,
    controlSelector: string,
) => {
    const questions = await extractQuestions(page, rootSelector, controlSelector)
    console.log(`recruiter questions: ${JSON.stringify(questions.map(({label, type, options}) => ({label, type, options})))}`)
    const description = await page.locator(job.descriptionSelector).first().innerText().catch(() => "")
    const answers = await answerQuestions(candidateInfo, {...job, description}, questions)
    if (!answers) {
        return null
    }
    await fillAnswers(page, questions, answers)
    return JSON.stringify(questions
        .filter(question => answers[question.id] !== undefined)
        .map(question => ({question: question.label, answer: answers[question.id]})))
}
