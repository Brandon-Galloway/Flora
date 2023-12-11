import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Lambda, InvokeCommand } from '@aws-sdk/client-lambda';

type AppSyncEvent = {
    info: {
        fieldName: string
    },
    arguments: {
        where : {
            DeviceId: string,
            StartTimestamp: number,
            EndTimestamp: number
        }
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

type DeviceConfiguration = {
    DeviceId: string,
    Nickname: string,
    BatteryLife: number,
    Location: {
        Lat: number, 
        Long: number,
        LocationName: string,
        LocationKey: string
    }
}

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = process.env.SENSOR_DATA_TABLE;
const deviceLambda = process.env.FETCH_DEVICE_CONFIG_LAMBDA;
const lambda = new Lambda();

async function isUserAuthorizedForDevice(userId: string, deviceId: string) {
    const response = await lambda.send(new InvokeCommand({
        FunctionName: deviceLambda,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
            arguments: {
                where: {
                    DeviceId: deviceId
                }
            },
            identity: {
                sub: userId
            }
        })
    }))
    let devices: DeviceConfiguration[] = [];
    if(response.Payload != null) {
        let payload = Buffer.from(response.Payload).toString('utf-8')
        devices = JSON.parse(payload)
    } else {
        throw new Error("An error occured...")
    }
    return devices.some(device => device.DeviceId === deviceId);
}

async function fetchSensorData(args: any, userId: string) {
    const params: any = {
        TableName: tableName,
        IndexName: "DeviceIndex",
        KeyConditionExpression: 'DeviceId = :deviceId',
        ExpressionAttributeNames: {},
        ExpressionAttributeValues: {
            ':deviceId': args.DeviceId,
        }
    }

    // If a time range is specified, narrow the query
    if(args.StartTimestamp) {
        params.KeyConditionExpression += ' AND #ts BETWEEN :startTimestamp AND :endTimestamp'
        params.ExpressionAttributeNames = {
            ...params.ExpressionAttributeNames,
            '#ts': 'Timestamp'
        }
        params.ExpressionAttributeValues = {
            ...params.ExpressionAttributeValues,
            ':startTimestamp': args.StartTimestamp,
            ':endTimestamp': args.EndTimestamp,
        };
    }
        
    const data = await dynamo.send(
        new QueryCommand(params)
    );
    return data.Items;
  }
  
  export const handler = async(event: AppSyncEvent,context: any) => {
    const args = event.arguments.where
    const userId = event.identity.sub;
    const authorized = await isUserAuthorizedForDevice(userId,args.DeviceId);
    if(userId == null || !authorized) {
        throw new Error('An error occured establishing authentication.')
    }

    if (args.StartTimestamp == null ? args.EndTimestamp != null : args.EndTimestamp == null) {
        throw new Error('Timestamp selections must include both a valid StartTimestamp and EndTimestamp.')
    }

    return await fetchSensorData(args,userId);
  }