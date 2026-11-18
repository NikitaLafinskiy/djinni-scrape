import {listScrapeTargets} from "@/db/users";
import {enqueueScrapes} from "@/utils/sqs";

export const handler = async () => {
    const runStartedAt = new Date().toISOString()
    const targets = await listScrapeTargets()
    const count = await enqueueScrapes(targets.map(target => ({...target, runStartedAt})))
    console.log(`enqueued ${count} scrapes`)
    return {enqueued: count}
}
