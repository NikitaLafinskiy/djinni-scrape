import {Page} from "playwright";
import {Credentials} from "@/platforms/types";
import {installTurnstileHook} from "@/platforms/nfj/form";

const LOGIN_URL = "https://nofluffjobs.com/pl/?auth=login"
const LOGGED_OUT_MARKER = "nfj-navbar-profile-dropdown[data-cy='logIn']"

export const acceptCookies = async (page: Page) => {
    const button = page.getByRole('button', { name: 'Akceptuj wszystkie' })
    await button.waitFor({timeout: 5000}).then(() => button.click()).catch(() => {})
}

export const dismissCookies = async (page: Page) => {
    const button = page.getByRole('button', { name: 'Akceptuj wszystkie' })
    if (await button.isVisible()) {
        await button.click()
    }
}

export const login = async (page: Page, {email, password}: Credentials) => {
    await installTurnstileHook(page)
    await page.goto(LOGIN_URL)
    await acceptCookies(page)
    // type in the details
    await page.getByLabel('Adres e-mail *').fill(email)
    await page.getByLabel('Hasło *').fill(password)
    // submit
    await page.getByLabel('Hasło *').press('Enter')
    await page.locator(LOGGED_OUT_MARKER).waitFor({state: "detached", timeout: 30000})
}

export const isLoggedIn = async (page: Page) => {
    return await page.locator(LOGGED_OUT_MARKER).waitFor({timeout: 1000}).then(() => false).catch(() => true)
}

export const ensureLoggedIn = async (page: Page, credentials: Credentials) => {
    if (!(await isLoggedIn(page))) {
        const url = page.url()
        await login(page, credentials)
        await page.goto(url)
    }
}
