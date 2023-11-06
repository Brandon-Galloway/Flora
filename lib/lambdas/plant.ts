import axios  from "axios";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

type AppSyncEvent = {
    info: {
        fieldName: string
    },
    arguments: {
        where : {
            id: number,
            name: String
        }
    },
    identity: {
        username: string,
        claims: {
            [key: string]: string[]
        }
    }
}

const PERENUAL_BASE_URL = 'https://perenual.com'
const PERENUAL_API_KEY_ID = process.env.PERENUAL_API_KEY_ID;
const sm = new SecretsManagerClient({});

async function getPlantByID(id: number) {
    try {
        const PERENUAL_API_KEY = await decodeSMSecret(PERENUAL_API_KEY_ID!);
        const apiURL = `${PERENUAL_BASE_URL}/api/species/details/${id}?key=${PERENUAL_API_KEY}`;
        const apiResponseData = await axios.get(apiURL);
        return new Array(apiResponseData.data);
    } catch(error) {
        console.log('Exception Calling Perenual Service');
        return {
            statusCode: 500,
            body: 'Error calling the Perenual Service'
        }
    }
}

async function getPlantsByName(name: String) {
    try {
        const PERENUAL_API_KEY = await decodeSMSecret(PERENUAL_API_KEY_ID!);
        const apiURL = `${PERENUAL_BASE_URL}/api/species-list?q=${name}&key=${PERENUAL_API_KEY}`;
        const apiResponseData = await axios.get(apiURL);
        return apiResponseData.data.data
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
    const args = event.arguments.where
    if (!args.id && !args.name) {
        throw new Error('ID or Name required.')
    }
    let response: any = "";
    if (args.id) {
        console.log("Performing ID-Based Lookup");
        response = await getPlantByID(args.id);
    } else if (args.name) {
        console.log("Performing Name-Based Lookup");
        response = await getPlantsByName(args.name);
    }

    return response;
}