import {SendMessageBatchCommand, SQSClient} from "@aws-sdk/client-sqs";
import {ScrapeMessage} from "@/types/Application";

const sqs = new SQSClient({})

export const enqueueScrapes = async (messages: ScrapeMessage[]) => {
    const queueUrl = process.env.SCRAPE_QUEUE_URL
    if (!queueUrl) {
        throw new Error("SCRAPE_QUEUE_URL is not set")
    }
    for (let i = 0; i < messages.length; i += 10) {
        const batch = messages.slice(i, i + 10)
        const result = await sqs.send(new SendMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: batch.map((message, j) => ({Id: String(j), MessageBody: JSON.stringify(message)})),
        }))
        if (result.Failed?.length) {
            throw new Error(`Failed to enqueue ${result.Failed.length} scrape messages: ${JSON.stringify(result.Failed)}`)
        }
    }
    return messages.length
}
