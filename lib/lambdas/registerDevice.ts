import axios  from "axios";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import {
    DynamoDBDocumentClient,
    ScanCommand,
    PutCommand,
    GetCommand,
    DeleteCommand,
  } from "@aws-sdk/lib-dynamodb";
  import { randomUUID } from "crypto"

type DeviceRegistrationInput = {
    Nickname: string,
    Lat: number,
    Long: number
}

type AppSyncEvent = {
    info: {
        fieldName: string
    },
    arguments: {
        device : DeviceRegistrationInput
    },
    identity: {
        username: string,
        claims: {
            [key: string]: string[]
        }
    }
}

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client, {
    marshallOptions: { convertClassInstanceToMap: true },
  });
const tableName = process.env.DEVICE_CONFIGURATION_TABLE;

const ACCUWEATHER_BASE_URL = 'http://dataservice.accuweather.com'
const sm = new SecretsManagerClient({});
const sm_promise = sm.send(new GetSecretValueCommand({ SecretId: "ACCUWEATHER_API_KEY" }));
let ACCUWEATHER_API_KEY: string | undefined;

async function registerDevice(args: DeviceRegistrationInput) {

    const location = await discoverLocation(args.Lat, args.Long);
    let device = {
        DeviceId: randomUUID(),
        Nickname: args.Nickname,
        BatteryLife: -1,
        Location: location
    }
    console.log("Device: " + JSON.stringify(device))
    const data = await dynamo.send(
        new PutCommand({
          TableName: tableName,
          Item: device,
        })
    );
    return device;
}

async function discoverLocation(lat: number, long: number) {
    const apiURL = `${ACCUWEATHER_BASE_URL}/locations/v1/cities/geoposition/search?language=en-us&apikey=${ACCUWEATHER_API_KEY}&q=${lat},${long}&details=true&toplevel=true`
    console.log("API URL:" + apiURL);
    const apiResponseData = (await axios.get(apiURL)).data;
    console.log("Response: " + JSON.stringify(apiResponseData))
    return {
        Lat: lat,
        Long: long,
        LocationName: apiResponseData.EnglishName,
        LocationKey: apiResponseData.Key
    }
}


  
export const handler = async(event: AppSyncEvent, context: any) => {
    console.log("EVENT: " + JSON.stringify(event));
    ACCUWEATHER_API_KEY = (await sm_promise).SecretString;
    const args = event.arguments.device;
    return await registerDevice(args);
}