import {writeFile} from "fs/promises"
import {JobPosting} from "@/types/JobPosting";
import {readJobPostings} from "./readJobPostings";

export const updateJobPostings = async (filePath: string, jobPosting: JobPosting) => {
    const jobPostings = (await readJobPostings(filePath))!
    jobPostings[jobPosting["link"]] = jobPosting
    await writeFile(filePath, JSON.stringify(jobPostings, null, 2))
}