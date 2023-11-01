import axios  from "axios";
import LambdaSecretHelper from "../util/utils";

type AppSyncEvent = {
    info: {
        fieldName: string
    },
    arguments: {
        id: number
    },
    identity: {
        username: string,
        claims: {
            [key: string]: string[]
        }
    }
}

const PERENUAL_BASE_URL = 'https://perenual.com'

async function getPlant(id: number) {
    try {
        const PERENUAL_API_KEY = await LambdaSecretHelper.getSecretByArn(process.env.AWS_SESSION_TOKEN!,process.env.PERENUAL_API_KEY_ID!)
        const apiURL = `${PERENUAL_BASE_URL}/api/species/details/${id}?key=${PERENUAL_API_KEY.SecretString}`;
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
    return getPlant(event.arguments.id);
}