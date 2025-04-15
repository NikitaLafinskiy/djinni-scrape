import {Page} from "playwright";
import {JobPosting} from "@/types/JobPosting";
import { readJobPostings } from "@/utils/readJobPostings";
import * as path from "node:path";
import {updateJobPostings} from "@/utils/updateJobPostings";

const JOB_POSTINGS_PATH = path.join(__dirname, "../../userdata/jobpostings.json")

export const apply = async (page: Page) => {
    // check whether the user has already applied to the job
    const hasApplied = await page.getByText('You\'ve applied to this job').first().isVisible()
    if (hasApplied) {
        console.log("already applied to the job: " + page.url())
        return
    }

    // check whether the user is not the right fit for the job
    const isRestricted = await page.locator(".bi-x-circle").first().isVisible()
    if (isRestricted) {
        console.log("not fit for the job: " + page.url())
        return
    }

    // return if the company has already been scraped
    const jobPostings = await readJobPostings(JOB_POSTINGS_PATH)
    if (jobPostings[page.url()] !== undefined) {
        console.log("already scraped: " + page.url())
        return;
    }

    // click the appy button
    await page.locator("button[data-analytics='job_apply_form_displayed']").first().click()

    // collect data about the job and save it to a file
    const companyName = await page.locator("header .row.align-items-center.fs-5 a.text-reset").innerText()
    const title = await page.locator("header h1").innerText()

    const job: JobPosting = {
        link: page.url(),
        title,
        companyName,
        autoApply: true
    }

    // check whether the form can be autofilled
    const hasAdditionalQuestions = await page.locator("#apply_form h4", {hasText: "Please answer following questions"}).isVisible()
    if (hasAdditionalQuestions || companyName === "PIN-UP Global") {
        job.autoApply = false
        await updateJobPostings(JOB_POSTINGS_PATH, job)
        console.log("scraping a non-autoapply job: " + page.url())
        return
    }

    // fill out the form
    await page.locator(".js-template-put", {hasText: "Greetings, I am a Software Engineer"}).click()

    // apply
    await page.locator("#job_apply").click()

    await updateJobPostings(JOB_POSTINGS_PATH, job)
    console.log("scraped a job: " + page.url())
}
