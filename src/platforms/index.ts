import {Platform} from "@/platforms/types";
import {djinni} from "@/platforms/djinni";
import {nfj} from "@/platforms/nfj";
import {platformNameForUrl} from "@/platforms/hosts";
import {PlatformName} from "@/types/Application";

export const platforms: Record<PlatformName, Platform> = {djinni, nfj}

export const platformForUrl = (url: string) => {
    const name = platformNameForUrl(url)
    return name ? platforms[name] : undefined
}
