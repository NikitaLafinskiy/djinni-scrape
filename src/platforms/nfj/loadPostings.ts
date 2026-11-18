import {Page} from "playwright";

const MAX_LOAD_MORE_CLICKS = 100

export const loadPostings = async (page: Page) => {
    // expand all postings
    for (let i = 0; i < MAX_LOAD_MORE_CLICKS; i++) {
        try {
            await page.getByRole('button', { name: 'Pokaż kolejne oferty' }).click({timeout: 10000});
            await page.waitForLoadState("domcontentloaded")
        } catch (e) {
            console.log("No more content to load")
            break;
        }
    }

    // get and return all postings
    const hrefs = await page.locator("nfj-postings-list .list-container a[href*='/job/']")
        .evaluateAll(links => links.map(link => link.getAttribute("href")).filter((href): href is string => !!href))
    return [...new Set(hrefs)]
}
