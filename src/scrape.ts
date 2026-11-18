import {init} from "@/utils/init";
import {getCaptchaApiKey} from "@/utils/captchaKey";
import {platformForUrl} from "@/platforms";
import {getUserWithCredentials, listIgnoreWords} from "@/db/users";
import {getApplicationStatus, upsertApplication} from "@/db/applications";
import {ScrapeMessage} from "@/types/Application";

// returns the page to continue from when stopped early, null once every page is done
export const scrape = async (
    message: ScrapeMessage,
    options: {headless: boolean, shouldStop: () => boolean},
): Promise<number | null> => {
    const platform = platformForUrl(message.url)
    if (!platform) {
        console.log(`${message.url} is not a supported job board, skipping`)
        return null
    }
    const user = await getUserWithCredentials(message.userId)
    const credentials = user && platform.isEnabled(user) ? platform.credentials(user) : null
    if (!user || !credentials) {
        console.log(`user ${message.userId} is missing, has ${platform.label} disabled or is not set up for it, skipping`)
        return null
    }
    const ignoreWords = (await listIgnoreWords(user.id)).map(row => row.word)

    // init the page and perform some set up
    const page = await init(platform.loginUrl, options.headless, platform.usesCaptcha ? await getCaptchaApiKey() : undefined)
    try {
        await platform.login(page, credentials)

        let currentPage = message.page ?? 1
        while (true) {
            const {hrefs, lastPage} = await platform.listJobs(page, message.url, currentPage)

            // apply to all the jobs on the current page
            for (let i = 0; i < hrefs.length; i++) {
                if (options.shouldStop()) {
                    return currentPage
                }
                const jobId = platform.jobId(hrefs[i])
                if (!jobId) {
                    console.log("The job posting does not have a valid href")
                    continue
                }
                const jobUrl = platform.jobUrl(hrefs[i])
                // checked per job rather than once per run, so a job handled by a concurrent run is skipped too
                const existingStatus = await getApplicationStatus(user.id, platform.name, jobId)
                if (existingStatus && existingStatus !== "error" && existingStatus !== "dry_run") {
                    console.log(`already handled as ${existingStatus}: ${jobUrl}`)
                    continue
                }
                await page.goto(jobUrl)
                await platform.ensureLoggedIn(page, credentials)
                const outcome = await platform.evaluateJob(page, user, ignoreWords)
                await upsertApplication({
                    userId: user.id,
                    userUrlId: message.urlId,
                    platform: platform.name,
                    sourceUrl: message.url,
                    jobUrl,
                    jobId,
                    outcome,
                })
                console.log(`Processed job ${i + 1} of ${hrefs.length} on page ${currentPage}`)
            }

            // keep applying if the current page is not the last one
            currentPage++
            if (currentPage > lastPage) {
                return null
            }
        }
    } finally {
        await page.context().browser()?.close()
    }
}
