import {getSsmProperty} from "@/utils/ssm";

export const getCaptchaApiKey = async () =>
    process.env.CAPTCHA_API_KEY ?? await getSsmProperty("captcha-api-key").catch(() => undefined)
