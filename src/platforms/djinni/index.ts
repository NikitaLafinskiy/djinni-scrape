import {Page} from "playwright";
import {Platform} from "@/platforms/types";
import {PLATFORM_LABELS} from "@/platforms/hosts";
import {login} from "@/platforms/djinni/login";
import {loadPostings} from "@/platforms/djinni/loadPostings";
import {evaluateJob} from "@/platforms/djinni/apply";

const URL_PREFIX = "https://djinni.co"

const pageUrl = (url: string, page: number) => {
    const result = new URL(url)
    if (page > 1) {
        result.searchParams.set("page", String(page))
    }
    return result.toString()
}

const getLastPage = async (page: Page, currentPage: number) => {
    const pagination = page.locator("ul.pagination")
    if (await pagination.isVisible()) {
        const pages = await pagination.locator("li").all()
        return parseInt(await pages[pages.length - 2].innerText())
    }
    return currentPage
}

export const djinni: Platform = {
    name: "djinni",
    label: PLATFORM_LABELS.djinni,
    hostname: "djinni.co",
    loginUrl: "https://djinni.co/login?from=landing_international&lang=en",
    usesCaptcha: false,
    isEnabled: user => user.djinniEnabled,
    credentials: user => user.djinniEmail && user.djinniPassword && user.applyMessage?.trim()
        ? {email: user.djinniEmail, password: user.djinniPassword}
        : null,
    login,
    ensureLoggedIn: async () => {},
    listJobs: async (page, url, pageNumber) => {
        await page.goto(pageUrl(url, pageNumber))
        const lastPage = await getLastPage(page, pageNumber)
        const hrefs: (string | null)[] = await loadPostings(page).catch(() => [])
        return {hrefs: hrefs.filter((href): href is string => !!href), lastPage}
    },
    jobId: href => href.match(/\/jobs\/(\d+)/)?.[1],
    jobUrl: href => URL_PREFIX + href.split("?")[0],
    evaluateJob,
}
