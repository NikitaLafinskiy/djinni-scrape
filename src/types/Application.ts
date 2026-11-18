export const APPLICATION_STATUSES = [
    "applied",
    "needs_manual",
    "no_easy_apply_suitable",
    "no_easy_apply_unsuitable",
    "unsuitable",
    "ignored_word",
    "already_applied",
    "error",
    "dry_run",
] as const

export type ApplicationStatus = typeof APPLICATION_STATUSES[number]

export type Outcome = {
    status: ApplicationStatus;
    title?: string | null;
    companyName?: string | null;
    easyApply?: boolean | null;
    suitable?: boolean | null;
    matchedWord?: string | null;
    error?: string | null;
    aiAnswers?: string | null;
}

export const PLATFORMS = ["djinni", "nfj"] as const

export type PlatformName = typeof PLATFORMS[number]

export type ScrapeUser = {
    id: string;
    djinniEmail: string | null;
    djinniPassword: string | null;
    applyMessage: string | null;
    skipUkraineOnly: boolean;
    djinniEnabled: boolean;
    nfjEnabled: boolean;
    nfjEmail: string | null;
    nfjPassword: string | null;
    nfjPhone: string | null;
    nfjApplyMessage: string | null;
    nfjLocations: string[];
    nfjLanguages: string[];
    nfjRequireEnglish: boolean;
    candidateInfo: string | null;
}

export type ScrapeMessage = {
    userId: string;
    urlId: string;
    url: string;
    page?: number;
    runStartedAt?: string;
}
