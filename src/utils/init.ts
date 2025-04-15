import {chromium} from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";

export const init = async (url: string) => {
    const stealth = stealthPlugin()
    chromium.use(stealth)
    const browser = await chromium.launch({
            headless: false,
            slowMo: 2000
        }
    );
    const context =  await browser.newContext();
    const page = await context.newPage()
    await page.goto(url)
    return page
}