import {Context, SQSBatchResponse, SQSEvent} from "aws-lambda";
import {scrape} from "@/scrape";
import {enqueueScrapes} from "@/utils/sqs";
import {ScrapeMessage} from "@/types/Application";
import {sendRunSummary} from "@/utils/runSummary";

const STOP_BEFORE_TIMEOUT_MS = 90_000

export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse["batchItemFailures"] = []
    for (const record of event.Records) {
        try {
            const message: ScrapeMessage = JSON.parse(record.body)
            const runStartedAt = message.runStartedAt ?? new Date().toISOString()
            const nextPage = await scrape(message, {
                headless: true,
                shouldStop: () => context.getRemainingTimeInMillis() < STOP_BEFORE_TIMEOUT_MS,
            })
            if (nextPage !== null) {
                console.log(`running out of time, continuing ${message.url} from page ${nextPage} in a new message`)
                await enqueueScrapes([{...message, page: nextPage, runStartedAt}])
            } else {
                await sendRunSummary(message, runStartedAt).catch(e => console.error("failed to send the run summary", e))
            }
        } catch (e) {
            console.error(e)
            batchItemFailures.push({itemIdentifier: record.messageId})
        }
    }
    return {batchItemFailures}
}
