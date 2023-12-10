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
        sub: string,
        claims: {
            [key: string]: string[]
        },
        sourceIp: string[]
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

async function registerDevice(args: DeviceRegistrationInput, userId: string) {

    const location = await discoverLocation(args.Lat, args.Long);
    let device = {
        DeviceId: randomUUID(),
        Nickname: args.Nickname,
        BatteryLife: -1,
        Location: location,
        UserId: userId,
    }
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
    const apiResponseData = (await axios.get(apiURL)).data;
    return {
        Lat: lat,
        Long: long,
        LocationName: apiResponseData.EnglishName,
        LocationKey: apiResponseData.Key
    }
}


  
export const handler = async(event: AppSyncEvent, context: any) => {
    ACCUWEATHER_API_KEY = (await sm_promise).SecretString;
    const userId = event.identity.sub;
    const args = event.arguments.device;

    if(userId == null) {
        throw new Error('An error occured establishing authentication.')
    }

    return await registerDevice(args,userId);
}