import {Page} from "playwright";

export const loadPostings = async (page: Page) => {
    const postings = await page.locator("main .list-jobs > li").all()
    const hrefs = []
    for (let i = 0; i < postings.length; i++) {
        const posting = postings[i]
        const href = await posting.locator(".job-item__title-link").getAttribute("href")
        hrefs.push(href)
    }
    return hrefs
}