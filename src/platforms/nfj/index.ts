import {Platform} from "@/platforms/types";
import {PLATFORM_LABELS} from "@/platforms/hosts";
import {acceptCookies, ensureLoggedIn, login} from "@/platforms/nfj/login";
import {loadPostings} from "@/platforms/nfj/loadPostings";
import {evaluateJob} from "@/platforms/nfj/apply";

const URL_PREFIX = "https://nofluffjobs.com"

export const nfj: Platform = {
    name: "nfj",
    label: PLATFORM_LABELS.nfj,
    hostname: "nofluffjobs.com",
    loginUrl: "https://nofluffjobs.com/pl/?auth=login",
    usesCaptcha: true,
    isEnabled: user => user.nfjEnabled,
    credentials: user => user.nfjEmail && user.nfjPassword ? {email: user.nfjEmail, password: user.nfjPassword} : null,
    login,
    ensureLoggedIn,
    listJobs: async (page, url) => {
        await page.goto(url)
        await acceptCookies(page)
        return {hrefs: await loadPostings(page), lastPage: 1}
    },
    jobId: href => href.match(/\/job\/([^/?#]+)/)?.[1],
    jobUrl: href => URL_PREFIX + href.split("?")[0],
    evaluateJob,
}
