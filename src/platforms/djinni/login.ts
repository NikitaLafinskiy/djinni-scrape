import {Page} from "playwright";

export const login = async (page: Page, credentials: {email: string, password: string}) => {
    const isLoginPage = await page.getByPlaceholder('Email').isVisible()
    if (!isLoginPage) {
        await page.getByRole('navigation').getByRole('link', { name: 'Log In' }).click();
    }
    await page.getByPlaceholder('Email').click();
    await page.getByPlaceholder('Email').fill(credentials.email);
    await page.getByPlaceholder('Password').click();
    await page.getByPlaceholder('Password').fill(credentials.password);
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL(url => !url.pathname.startsWith("/login"))
}
