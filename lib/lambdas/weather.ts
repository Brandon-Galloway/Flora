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
const sm_promise = sm.send(new GetSecretValueCommand({ SecretId: "ACCUWEATHER_API_KEY" }));
let ACCUWEATHER_API_KEY: string | undefined;

async function getWeather(location: string) {
    try {
        const apiURL = `${ACCUWEATHER_BASE_URL}/forecasts/v1/hourly/12hour/${location}?language=en-us&apikey=${ACCUWEATHER_API_KEY}&details=true&metric=false`
        console.log("API URL:" + apiURL);
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

export const handler = async(event: AppSyncEvent) => {
    ACCUWEATHER_API_KEY = (await sm_promise).SecretString;
    return getWeather(event.arguments.location);
}