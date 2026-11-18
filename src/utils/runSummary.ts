import {getUser} from "@/db/users";
import {listRunApplications} from "@/db/applications";
import {sendEmail} from "@/utils/email";
import {ScrapeMessage} from "@/types/Application";
import {PLATFORM_LABELS, platformNameForUrl} from "@/platforms/hosts";

type Job = {title: string | null, company_name: string | null, job_url: string}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]!))

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

const jobLabel = (job: Job) => [job.title ?? job.job_url, job.company_name].filter(Boolean).join(" — ")

const htmlSection = (heading: string, jobs: Job[]) => jobs.length === 0 ? "" : `
    <h3 style="margin:20px 0 8px">${escapeHtml(heading)} (${jobs.length})</h3>
    <ul style="margin:0;padding-left:20px">${jobs.map(job =>
        `<li style="margin:4px 0"><a href="${escapeHtml(job.job_url)}">${escapeHtml(jobLabel(job))}</a></li>`).join("")}</ul>`

const textSection = (heading: string, jobs: Job[]) => jobs.length === 0 ? "" :
    `\n${heading} (${jobs.length}):\n${jobs.map(job => `- ${jobLabel(job)}\n  ${job.job_url}`).join("\n")}\n`

export const sendRunSummary = async (message: ScrapeMessage, since: string) => {
    const user = await getUser(message.userId)
    const recipient = user?.djinni_email ?? user?.nfj_email
    const platformName = platformNameForUrl(message.url)
    if (!user || !recipient || !platformName) {
        return
    }
    const platformLabel = PLATFORM_LABELS[platformName]
    const applications = await listRunApplications(message.userId, message.urlId, since)
    const applied = applications.filter(application => application.status === "applied")
    const questions = applications.filter(application => application.status === "needs_manual")
    const noEasyApply = applications.filter(application => application.status === "no_easy_apply_suitable")
    const manualCount = questions.length + noEasyApply.length
    if (applied.length === 0 && manualCount === 0) {
        console.log(`nothing new for ${message.url}, not sending a summary`)
        return
    }

    const subject = `${platformLabel}: applied to ${plural(applied.length, "job")}, ${plural(manualCount, "job")} need${manualCount === 1 ? "s" : ""} manual action`
    const questionsHeading = "Recruiter questions to answer"
    const noEasyApplyHeading = "Suitable, but no easy apply"
    await sendEmail({
        to: recipient,
        subject,
        html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#1d2330">
    <p>Hi ${escapeHtml(user.name)},</p>
    <p>Applied to <strong>${plural(applied.length, "job")}</strong> on ${escapeHtml(platformLabel)} for <a href="${escapeHtml(message.url)}">your search</a>.</p>
    ${manualCount > 0 ? `<p>These need you to apply yourself:</p>` : ""}
    ${htmlSection(questionsHeading, questions)}
    ${htmlSection(noEasyApplyHeading, noEasyApply)}
</div>`,
        text: `Hi ${user.name},\n\nApplied to ${plural(applied.length, "job")} on ${platformLabel} for your search:\n${message.url}\n`
            + (manualCount > 0 ? `\nThese need you to apply yourself:\n` : "")
            + textSection(questionsHeading, questions)
            + textSection(noEasyApplyHeading, noEasyApply),
    })
    console.log(`sent a summary to ${recipient}: ${applied.length} applied, ${manualCount} manual`)
}
