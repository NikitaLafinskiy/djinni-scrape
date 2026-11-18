import {SendEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({})

export const sendEmail = async (email: {to: string, subject: string, html: string, text: string}) => {
    const from = process.env.SES_SENDER_EMAIL
    if (!from) {
        throw new Error("SES_SENDER_EMAIL is not set")
    }
    await ses.send(new SendEmailCommand({
        FromEmailAddress: from,
        Destination: {ToAddresses: [email.to]},
        Content: {
            Simple: {
                Subject: {Data: email.subject, Charset: "UTF-8"},
                Body: {
                    Html: {Data: email.html, Charset: "UTF-8"},
                    Text: {Data: email.text, Charset: "UTF-8"},
                },
            },
        },
    }))
}
