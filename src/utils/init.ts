import {chromium} from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import RecaptchaPlugin from "puppeteer-extra-plugin-recaptcha";

const LAMBDA_ARGS = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--single-process",
]

// plugins register globally, so a warm Lambda must not add them again on every invocation
let isStealthRegistered = false
let isCaptchaRegistered = false

export const init = async (url: string, headless: boolean, captchaApiKey?: string) => {
    if (!isStealthRegistered) {
        chromium.use(stealthPlugin())
        isStealthRegistered = true
    }
    if (captchaApiKey && !isCaptchaRegistered) {
        chromium.use(RecaptchaPlugin({
            provider: {
                id: '2captcha',
                token: captchaApiKey
            }
        }))
        isCaptchaRegistered = true
    }
    const browser = await chromium.launch(headless
        ? {headless: true, channel: "chromium", args: LAMBDA_ARGS}
        : {headless: false, slowMo: 2000}
    );
    const context =  await browser.newContext();
    const page = await context.newPage()
    await page.goto(url)
    return page
}
