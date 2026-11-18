import {scrape} from "./scrape";
import {getUrl} from "@/db/users";
import {closePool} from "@/db/client";

(async () => {
    const userId = process.env.USER_ID
    const urlId = process.env.URL_ID
    if (!userId || !urlId) {
        throw new Error("Set USER_ID and URL_ID to the user and url to scrape")
    }
    const userUrl = await getUrl(userId, urlId)
    if (!userUrl) {
        throw new Error(`url ${urlId} does not belong to user ${userId}`)
    }
    try {
        await scrape({userId, urlId, url: userUrl.url}, {headless: process.env.HEADLESS === "1", shouldStop: () => false})
    } finally {
        await closePool()
    }
})()
