import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";

const ssm = new SSMClient({})
const cache = new Map<string, Promise<string>>()

const parameterPath = (property: string) => {
    const entry = (process.env.SSM_BACKED_PROPERTIES ?? "")
        .split("\n")
        .map(line => line.split("="))
        .find(([name]) => name === property)
    if (!entry) {
        throw new Error(`SSM property ${property} is not configured`)
    }
    return entry.slice(1).join("=")
}

export const getSsmProperty = (property: string) => {
    let value = cache.get(property)
    if (!value) {
        value = Promise.resolve()
            .then(() => ssm.send(new GetParameterCommand({Name: parameterPath(property), WithDecryption: true})))
            .then(result => result.Parameter?.Value ?? "")
        value.catch(() => cache.delete(property))
        cache.set(property, value)
    }
    return value
}
