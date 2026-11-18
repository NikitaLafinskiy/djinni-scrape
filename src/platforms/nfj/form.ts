import {Locator, Page} from "playwright";
import {getCaptchaApiKey} from "@/utils/captchaKey";
import {solveTurnstile} from "@/utils/twoCaptcha";

export const FORM = "nfj-apply-internal-step-application form"

// nfj loads Turnstile only when the application is sent and renders the widget right away, so the wrapper is
// appended to Turnstile's own script: it keeps the original rendering but remembers the site key and the callback
// the solved token has to be passed to
const TURNSTILE_SCRIPT = /^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/.*api\.js/
const TURNSTILE_WRAPPER = `
;(() => {
    const turnstile = window.turnstile
    if (!turnstile || turnstile.__wrapped) return
    const render = turnstile.render
    turnstile.render = function (container, params) {
        window.__turnstile = {
            sitekey: params && params.sitekey,
            action: params && params.action,
            cData: params && params.cData,
            callback: params && params.callback,
        }
        return render.apply(this, arguments)
    }
    turnstile.__wrapped = true
})();`

const hookedContexts = new WeakSet<object>()

export const installTurnstileHook = async (page: Page) => {
    if (hookedContexts.has(page.context())) {
        return
    }
    await page.context().route(TURNSTILE_SCRIPT, async route => {
        const response = await route.fetch()
        await route.fulfill({response, body: (await response.text()) + TURNSTILE_WRAPPER})
    })
    hookedContexts.add(page.context())
}

const MAX_CAPTCHA_ATTEMPTS = 3

const matchesAny = (text: string, options: string[]) =>
    options.some(option => text.toLowerCase().includes(option.toLowerCase()))

export const location = async (page: Page, locations: string[]) => {
    const field = page.locator(`${FORM} nfj-form-field`, {has: page.locator("label", {hasText: "Wybierz lokalizację"})})
    if (!(await field.isVisible())) {
        return true
    }
    await field.locator(".dropdown-btn").first().click()
    const dropdownItems = await field.locator(".multiselect-item-checkbox div").all()
    let selected = 0
    for (let i = 0; i < dropdownItems.length; i++) {
        const text = await dropdownItems[i].innerText()
        if (matchesAny(text, locations)) {
            await dropdownItems[i].click({force: true})
            selected++
        }
    }
    await field.locator(".dropdown-btn").first().click()
    return selected > 0
}

// the native input is hidden behind nfj's custom checkbox and the sticky submit bar can cover the label,
// so the click is dispatched to the input directly
const check = async (checkbox: Locator) => {
    const input = checkbox.locator("input")
    if (!(await input.isChecked())) {
        await input.dispatchEvent("click")
    }
}

export const consents = async (page: Page) => {
    // check all consents
    const consents = await page.locator(`${FORM} cmn-apply-consent nfj-checkbox, ${FORM} nfj-apply-consent nfj-checkbox`).all()
    for (let i = 0; i < consents.length; i++) {
        await check(consents[i])
    }
}

export const languages = async (page: Page, languages: string[]) => {
    const checkboxes = await page.locator(`${FORM} cmn-apply-known-languages nfj-checkbox, ${FORM} nfj-apply-known-languages nfj-checkbox`).all()
    for (let i = 0; i < checkboxes.length; i++) {
        const text = await checkboxes[i].locator("label").innerText()
        if (matchesAny(text, languages)) {
            await check(checkboxes[i])
        }
    }
}

export const phone = async (page: Page, phoneNumber: string | null) => {
    const input = page.locator(`${FORM} input[formcontrolname=phoneNumber]`)
    if (!(await input.isVisible()) || (await input.inputValue()).trim()) {
        return
    }
    if (!phoneNumber?.trim()) {
        throw new Error("The application form requires a phone number, set the NFJ phone in the admin panel")
    }
    await input.fill(phoneNumber)
}

export const message = async (page: Page, text: string | null) => {
    const textarea = page.locator(`${FORM} textarea[formcontrolname=message]`)
    if (text?.trim() && await textarea.isVisible() && !(await textarea.inputValue()).trim()) {
        await textarea.fill(text)
    }
}

const turnstile = async (page: Page) => {
    const response = page.locator("input[name='cf-turnstile-response']")
    const hasTurnstile = await response.first().waitFor({state: "attached", timeout: 8000}).then(() => true, () => false)
    console.log("has turnstile: " + hasTurnstile)
    if (!hasTurnstile) {
        return
    }
    const params = await page.evaluate(() => {
        const captured = (window as unknown as {__turnstile?: {sitekey?: string, action?: string, cData?: string}}).__turnstile
        return captured ? {sitekey: captured.sitekey, action: captured.action, cData: captured.cData} : null
    })
    const findFrameKey = () => page.frames().map(frame => frame.url().match(/\/(0x[0-9A-Za-z_-]+)\//)?.[1]).find(Boolean)
    for (let i = 0; i < 20 && !params?.sitekey && !findFrameKey(); i++) {
        await page.waitForTimeout(500)
    }
    const frameKey = findFrameKey()
    const websiteKey = params?.sitekey ?? frameKey
    const apiKey = await getCaptchaApiKey()
    if (!websiteKey || !apiKey) {
        throw new Error(`Cannot solve the Turnstile: ${websiteKey ? "no 2captcha API key" : "site key not found"}`)
    }
    console.log(`solving the turnstile ${websiteKey} with 2captcha`)
    const token = await solveTurnstile(apiKey, {
        websiteURL: page.url(),
        websiteKey,
        ...(params?.action ? {action: params.action} : {}),
        ...(params?.cData ? {data: params.cData} : {}),
    })
    await page.evaluate(token => {
        document.querySelectorAll<HTMLInputElement>("input[name='cf-turnstile-response']").forEach(input => input.value = token)
        const callback = (window as unknown as {__turnstile?: {callback?: (token: string) => void}}).__turnstile?.callback
        if (typeof callback === "function") {
            callback(token)
        }
    }, token)
    console.log("solved the turnstile")
}

export const captcha = async (page: Page, attempt = 1): Promise<void> => {
    if (attempt === 1) {
        await turnstile(page)
    }
    const hasCaptcha = await page.locator("h3", {hasText: "Proszę, potwierdź, że nie jesteś robotem"}).waitFor({
        state: "visible",
        timeout: 5000
    })
        .then(() => true)
        .catch(() => false)
    console.log("has captcha: " + hasCaptcha)
    if (hasCaptcha) {
        const {solved, error} = await (page as unknown as {solveRecaptchas: () => Promise<{solved: unknown[], error?: unknown}>}).solveRecaptchas()
        if (solved?.length) {
            console.log("solved the captcha")
        } else if (attempt < MAX_CAPTCHA_ATTEMPTS) {
            console.log(error)
            console.log("retrying the captcha...")
            await captcha(page, attempt + 1)
        } else {
            throw new Error(`Could not solve the captcha after ${MAX_CAPTCHA_ATTEMPTS} attempts: ${error}`)
        }
    }
}
