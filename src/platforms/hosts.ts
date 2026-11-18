import {PlatformName} from "@/types/Application";

const HOSTNAMES: Record<string, PlatformName> = {
    "djinni.co": "djinni",
    "nofluffjobs.com": "nfj",
}

export const PLATFORM_LABELS: Record<PlatformName, string> = {
    djinni: "djinni",
    nfj: "No Fluff Jobs",
}

export const platformNameForUrl = (url: string): PlatformName | undefined => {
    try {
        return HOSTNAMES[new URL(url).hostname.replace(/^www\./, "")]
    } catch {
        return undefined
    }
}
