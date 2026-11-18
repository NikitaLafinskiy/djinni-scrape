import {Page} from "playwright";

// only the job's own content is searched, so site-wide markup and other jobs' listings can't match;
// when none of the containers are found the whole page is searched instead, erring towards skipping
export const findIgnoredWord = async (page: Page, ignoreWords: string[], jobContentSelectors: string[]) => {
    const parts = await page.locator(jobContentSelectors.join(", ")).evaluateAll(elements => elements.map(element => element.outerHTML))
    if (parts.length === 0) {
        console.log(`no job content found with ${jobContentSelectors.join(", ")}, checking ignore words against the whole page: ${page.url()}`)
    }
    const html = (parts.length > 0 ? parts.join("\n") : await page.content()).toLowerCase()
    return ignoreWords.find(word => html.includes(word.toLowerCase()))
}
