import {execute, query} from "@/db/client";
import {ApplicationStatus, Outcome, PlatformName} from "@/types/Application";

export const getApplicationStatus = async (userId: string, platform: PlatformName, jobId: string) =>
    (await query<{status: ApplicationStatus}>(
        "SELECT status FROM applications WHERE user_id = $1 AND platform = $2 AND job_id = $3", [userId, platform, jobId],
    ))[0]?.status

export const upsertApplication = (application: {
    userId: string,
    userUrlId: string,
    platform: PlatformName,
    sourceUrl: string,
    jobUrl: string,
    jobId: string,
    outcome: Outcome,
}) => execute(`
    INSERT INTO applications (
        user_id, user_url_id, source_url, job_url, job_id, title, company_name,
        status, easy_apply, suitable, matched_word, error, platform, ai_answers
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (user_id, platform, job_id) DO UPDATE SET
        user_url_id = excluded.user_url_id,
        source_url = excluded.source_url,
        job_url = excluded.job_url,
        title = excluded.title,
        company_name = excluded.company_name,
        status = excluded.status,
        easy_apply = excluded.easy_apply,
        suitable = excluded.suitable,
        matched_word = excluded.matched_word,
        error = excluded.error,
        ai_answers = excluded.ai_answers,
        updated_at = now()`, [
    application.userId,
    application.userUrlId,
    application.sourceUrl,
    application.jobUrl,
    application.jobId,
    application.outcome.title ?? null,
    application.outcome.companyName ?? null,
    application.outcome.status,
    application.outcome.easyApply ?? null,
    application.outcome.suitable ?? null,
    application.outcome.matchedWord ?? null,
    application.outcome.error ?? null,
    application.platform,
    application.outcome.aiAnswers ?? null,
])

export const listApplications = async (filter: {
    userId?: string,
    platform?: PlatformName,
    statuses?: ApplicationStatus[],
    before?: string,
    limit: number,
}) => {
    const rows = await query<{created_at: Date}>(`
        SELECT a.id, a.user_id, u.name AS user_name, a.user_url_id, a.platform, a.source_url, a.job_url, a.job_id,
            a.title, a.company_name, a.status, a.easy_apply, a.suitable, a.matched_word, a.error, a.ai_answers,
            a.created_at, a.updated_at
        FROM applications a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE ($1::uuid IS NULL OR a.user_id = $1::uuid)
            AND ($2::text[] IS NULL OR a.status = ANY($2::text[]))
            AND ($3::timestamptz IS NULL OR a.created_at < $3::timestamptz)
            AND ($5::text IS NULL OR a.platform = $5::text)
        ORDER BY a.created_at DESC
        LIMIT $4`, [filter.userId ?? null, filter.statuses ?? null, filter.before ?? null, filter.limit, filter.platform ?? null])
    return {
        items: rows,
        next: rows.length === filter.limit ? rows[rows.length - 1].created_at.toISOString() : null,
    }
}

export const listRunApplications = (userId: string, userUrlId: string, since: string) =>
    query<{status: ApplicationStatus, title: string | null, company_name: string | null, job_url: string}>(`
        SELECT status, title, company_name, job_url
        FROM applications
        WHERE user_id = $1 AND user_url_id = $2 AND updated_at >= $3::timestamptz
            AND status IN ('applied', 'needs_manual', 'no_easy_apply_suitable')
        ORDER BY updated_at`, [userId, userUrlId, since])
