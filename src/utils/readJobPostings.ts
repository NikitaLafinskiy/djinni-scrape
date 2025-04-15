import {access, readFile, writeFile} from "fs/promises";
import {JobPosting} from "@/types/JobPosting";

export const readJobPostings = async (filePath: string) => {
    try {
        await access(filePath)
    } catch(e) {
        await writeFile(filePath, "{}");
    }
    return JSON.parse((await readFile(filePath, "utf8"))) as {[companyLink: string]: JobPosting}
}