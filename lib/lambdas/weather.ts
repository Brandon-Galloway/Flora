import axios  from "axios";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";


type AppSyncEvent = {
    info: {
        fieldName: string
    },
    arguments: {
        location: string
    },
    identity: {
        username: string,
        claims: {
            [key: string]: string[]
        }
    }
}

const ACCUWEATHER_BASE_URL = 'http://dataservice.accuweather.com'
const sm = new SecretsManagerClient({});

async function getWeather(location: string) {
    try {
        const ACCUWEATHER_API_KEY = await decodeSMSecret("ACCUWEATHER_API_KEY");
        const apiURL = `${ACCUWEATHER_BASE_URL}/forecasts/v1/hourly/12hour/${location}?language=en-us&apikey=${ACCUWEATHER_API_KEY.SecretString}&details=true&metric=false`
        const apiResponseData = await axios.get(apiURL);
        return apiResponseData.data
    } catch(error) {
        console.log('Exception Calling Perenual Service');
        return {
            statusCode: 500,
            body: 'Error calling the Perenual Service'
        }
    }
}

async function decodeSMSecret(smkey: String) {
    const params = {
        SecretId: smkey
    };
    const result = await sm.send(new GetSecretValueCommand(params));
    return result.SecretString;
}

export const handler = async(event: AppSyncEvent) => {
    return getWeather(event.arguments.location);
}