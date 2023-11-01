import axios  from "axios";
import LambdaSecretHelper from "../util/utils";

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

async function getWeather(location: string) {
    try {
        const ACCUWEATHER_API_KEY = await LambdaSecretHelper.getSecretByArn(process.env.AWS_SESSION_TOKEN!,process.env.ACCUWEATHER_API_KEY_ID!)
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

export const handler = async(event: AppSyncEvent) => {
    return getWeather(event.arguments.location);
}