import {Page} from "playwright";

export const loadPostings = async (page: Page) => {
    const postingsLocator = page.locator("main .list-jobs .job-item")
    await postingsLocator.first().waitFor()
    const postings = await postingsLocator.all()
    const hrefs = []
    for (let i = 0; i < postings.length; i++) {
        const posting = postings[i]
        const href = await posting.locator("a.job_item__header-link").getAttribute("href")
        hrefs.push(href)
    }
    return hrefs
}