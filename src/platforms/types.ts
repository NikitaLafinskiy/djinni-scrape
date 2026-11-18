import {Page} from "playwright";
import {Outcome, PlatformName, ScrapeUser} from "@/types/Application";

export type Credentials = {
    email: string;
    password: string;
}

export type Platform = {
    name: PlatformName;
    label: string;
    hostname: string;
    loginUrl: string;
    usesCaptcha: boolean;
    isEnabled: (user: ScrapeUser) => boolean;
    credentials: (user: ScrapeUser) => Credentials | null;
    login: (page: Page, credentials: Credentials) => Promise<void>;
    ensureLoggedIn: (page: Page, credentials: Credentials) => Promise<void>;
    listJobs: (page: Page, url: string, pageNumber: number) => Promise<{hrefs: string[], lastPage: number}>;
    jobId: (href: string) => string | undefined;
    jobUrl: (href: string) => string;
    evaluateJob: (page: Page, user: ScrapeUser, ignoreWords: string[]) => Promise<Outcome>;
}
