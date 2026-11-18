import {Page} from "playwright";
import {Outcome, ScrapeUser} from "@/types/Application";
import {findIgnoredWord} from "@/utils/ignoreWords";
import {answerRecruiterQuestions} from "@/utils/recruiterQuestions";

const JOB_CONTENT_SELECTORS = [".job-post-page header", ".job-post__description", ".job-post-page aside"]

const readText = (page: Page, selector: string) =>
    page.locator(selector).first().innerText({timeout: 5000}).then(text => text.trim()).catch(() => null)

export const evaluateJob = async (page: Page, user: ScrapeUser, ignoreWords: string[]): Promise<Outcome> => {
    const known: Omit<Outcome, "status"> = {}
    try {
        // collect data about the job
        known.title = await readText(page, "header h1")
        known.companyName = await readText(page, "header .row.align-items-start.fs-5 a.text-secondary")

        // return if the job mentions any of the ignored words
        const matchedWord = await findIgnoredWord(page, ignoreWords, JOB_CONTENT_SELECTORS)
        if (matchedWord) {
            console.log(`ignored word "${matchedWord}": ` + page.url())
            return {...known, status: "ignored_word", matchedWord}
        }

        // check whether the user has already applied to the job
        const hasApplied = await page.getByText('You\'ve applied to this job').first().isVisible()
        if (hasApplied) {
            console.log("already applied to the job: " + page.url())
            return {...known, status: "already_applied"}
        }

        const applyButton = page.locator("button[data-analytics='job_apply_form_displayed']").first()
        known.easyApply = await applyButton.isVisible()

        // check whether the user is not the right fit for the job
        const isRestricted = await page.getByText("Your profile does not meet some of the requirements").first().isVisible()

        // check whether the job only considers candidates from Ukraine
        const countries = page.getByText("Countries where we consider candidates", {exact: true}).locator("xpath=..").first()
        const locations = await countries.locator(".location-text").allInnerTexts()
        const isUkraineOnly = user.skipUkraineOnly && locations.length === 1 && locations[0].trim() === "Ukraine"

        known.suitable = !isRestricted && !isUkraineOnly
        if (!known.easyApply) {
            console.log(`no easy apply (${known.suitable ? "suitable" : "not fit"}): ` + page.url())
            return {...known, status: known.suitable ? "no_easy_apply_suitable" : "no_easy_apply_unsuitable"}
        }
        if (!known.suitable) {
            console.log("not fit for the job: " + page.url())
            return {...known, status: "unsuitable"}
        }

        // click the appy button
        await applyButton.click()

        // check whether the form can be autofilled
        const hasAdditionalQuestions = await page.locator("#apply_form h3", {hasText: "Questions from the recruiter"}).isVisible()
        if (hasAdditionalQuestions) {
            known.aiAnswers = await answerRecruiterQuestions(
                page, user.candidateInfo, {...known, descriptionSelector: ".job-post__description"}, "#apply_form", "[name^='answer_']",
            )
            if (!known.aiAnswers) {
                console.log("scraping a non-autoapply job: " + page.url())
                return {...known, status: "needs_manual"}
            }
        }

        // fill out the form
        await page.locator("#apply_form textarea#message").fill(user.applyMessage ?? "")

        if (process.env.DRY_RUN === "1") {
            console.log("dry run, not applying: " + page.url())
            return {...known, status: "dry_run"}
        }

        // apply
        await page.locator("#job_apply").click()
        const isApplied = await page.getByText('You\'ve applied to this job').first().waitFor({timeout: 15000}).then(() => true, () => false)
        if (!isApplied) {
            const formErrors = await page.locator("#apply_form .invalid-feedback, #apply_form .text-danger, #apply_form .alert-danger, .toast-body")
                .evaluateAll(elements => elements
                    .filter(element => (element as HTMLElement).offsetParent !== null)
                    .map(element => element.textContent?.trim())
                    .filter(Boolean))
            throw new Error(`Application was not confirmed after submitting${formErrors.length ? `: ${formErrors.join("; ")}` : ""}`)
        }

        console.log("applied to the job: " + page.url())
        return {...known, status: "applied"}
    } catch (e) {
        console.error(e)
        return {...known, status: "error", error: e instanceof Error ? e.message : String(e)}
    }
}
