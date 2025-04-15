import {scrape} from "./scrape";

const urlsList = [
    // "https://djinni.co/my/dashboard/",
    "https://djinni.co/jobs/?exclude_keywords=lead%20senior%20php%20angular%20vue&primary_keyword=Fullstack&primary_keyword=Java&primary_keyword=Golang&primary_keyword=DevOps&exp_level=1y&exp_level=2y&exp_level=3y&employment=remote"
];

(async () => {
    for (let i = 0; i < urlsList.length; i++) {
        await scrape(urlsList[i])
    }
})()