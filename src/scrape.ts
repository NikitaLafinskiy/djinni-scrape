import {init} from "@/utils/init";
import {login} from "@/actions/login";
import {loadPostings} from "@/actions/loadPostings";
import {apply} from "@/actions/apply";

const URL_PREFIX = "https://djinni.co"
let currentPage = 1
let lastPage = 0

export const scrape = async (url: string) => {
    // init the page and perform some set up
    const page = await init("https://djinni.co/login?from=landing_international&lang=en")
    await login(page)
    await page.goto(url)

    // check which page is the last one
    const pagination = page.locator("ul.pagination")
    if (await pagination.isVisible()) {
        const pages = await pagination.locator("li").all()
        lastPage = parseInt(await pages[pages.length - 2].innerText())
    }

    // function to recursively paginate and apply to all jobs
    const applyIter = async () => {

        const postings = await loadPostings(page)
        console.log(JSON.stringify(postings, null, 2))

        // apply to all the jobs on the current page
        for (let i = 0; i < postings.length; i++) {
            try {
                const href = postings[i]
                if (href) {
                    await page.goto(URL_PREFIX + href)
                } else {
                    console.log("The job posting does not have a valid href")
                }
                await apply(page)
                await page.goBack()
                console.log(`Applied to job ${i + 1} of ${postings.length}`)
            } catch (e) {
                console.error(e)
            }
        }

        // keep applying if the current page is not the last one
        currentPage++
        if (currentPage <= lastPage) {
            await page.goto(url + "&page=" + currentPage)
            await applyIter()
        }
    }
    await applyIter()
}