import {Page} from "playwright";
import {Outcome, ScrapeUser} from "@/types/Application";
import {findIgnoredWord} from "@/utils/ignoreWords";
import * as form from "@/platforms/nfj/form";
import {dismissCookies} from "@/platforms/nfj/login";
import {answerRecruiterQuestions} from "@/utils/recruiterQuestions";

const QUESTION_CONTROLS = "cmn-apply-question input, cmn-apply-question textarea, cmn-apply-question select"

const JOB_CONTENT_SELECTORS = ["common-posting-content-wrapper"]

const readText = (page: Page, selector: string) =>
    page.locator(selector).first().innerText({timeout: 5000}).then(text => text.trim()).catch(() => null)

export const evaluateJob = async (page: Page, user: ScrapeUser, ignoreWords: string[]): Promise<Outcome> => {
    const known: Omit<Outcome, "status"> = {}
    try {
        // collect data about the job
        known.title = await readText(page, ".posting-details-description h1")
        known.companyName = await readText(page, "#postingCompanyUrl")

        // return if the job mentions any of the ignored words
        const matchedWord = await findIgnoredWord(page, ignoreWords, JOB_CONTENT_SELECTORS)
        if (matchedWord) {
            console.log(`ignored word "${matchedWord}": ` + page.url())
            return {...known, status: "ignored_word", matchedWord}
        }

        // check whether english recruitment is an option, jobs that do not list the recruitment language pass
        const languageDetails = page.locator("section", {hasText: 'Szczegóły oferty'}).locator("li", {hasText: "Język rekrutacji:"})
        const recruitmentLanguages = await languageDetails.first().innerText({timeout: 3000}).catch(() => null)
        const hasEnglishRecruitment = recruitmentLanguages === null || recruitmentLanguages.includes('angielski')

        // find the application button and see whether i can autoapply
        const button = page.locator("#applyButton").first()
        known.easyApply = await button.count() > 0 && await button.locator("svg").count() < 1
        known.suitable = !user.nfjRequireEnglish || hasEnglishRecruitment
        if (!known.easyApply) {
            console.log(`no easy apply (${known.suitable ? "suitable" : "no english recruitment"}): ` + page.url())
            return {...known, status: known.suitable ? "no_easy_apply_suitable" : "no_easy_apply_unsuitable"}
        }
        if (!known.suitable) {
            console.log("does not have english recruitment: " + page.url())
            return {...known, status: "unsuitable"}
        }

        await dismissCookies(page)
        await button.click()
        await page.locator(form.FORM).waitFor()

        // choose the location of work if required
        if (!(await form.location(page, user.nfjLocations))) {
            console.log("none of the locations fit: " + page.url())
            return {...known, suitable: false, status: "unsuitable"}
        }

        // fill out the rest of the form
        await form.phone(page, user.nfjPhone)
        await form.message(page, user.nfjApplyMessage)
        await form.consents(page)
        await form.languages(page, user.nfjLanguages)

        // fields that are still invalid are recruiter questions, answered with ai when possible
        if (await page.locator(`${form.FORM}.ng-invalid`).count() > 0) {
            known.aiAnswers = await answerRecruiterQuestions(
                page, user.candidateInfo, {...known, descriptionSelector: "common-posting-content-wrapper"}, form.FORM, QUESTION_CONTROLS,
            )
            if (!known.aiAnswers || await page.locator(`${form.FORM}.ng-invalid`).count() > 0) {
                console.log("scraping a non-autoapply job: " + page.url())
                return {...known, status: "needs_manual"}
            }
        }

        if (process.env.DRY_RUN === "1") {
            console.log("dry run, not applying: " + page.url())
            return {...known, status: "dry_run"}
        }

        // apply
        await page.locator("common-action-btn#sendApplicationButton").click()
        await form.captcha(page)
        const isApplied = await page.getByText('Aplikacja została wysłana').first().waitFor({timeout: 20000}).then(() => true, () => false)
        if (!isApplied) {
            // the send button was already clicked, so this is not retried: a retry could apply a second time
            const dialogText = await page.locator("mat-dialog-container").first().innerText().catch(() => "")
            console.log("application not confirmed after submitting: " + page.url())
            return {
                ...known,
                status: "needs_manual",
                error: `Sent, but NFJ showed no confirmation - check whether the application went through. Dialog: ${dialogText.replace(/\s+/g, " ").trim().slice(0, 400) || "closed"}`,
            }
        }

        console.log("applied to the job: " + page.url())
        return {...known, status: "applied"}
    } catch (e) {
        console.error(e)
        return {...known, status: "error", error: e instanceof Error ? e.message : String(e)}
    }
}
