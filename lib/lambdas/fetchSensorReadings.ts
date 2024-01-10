import { DynamoDBClient, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { Lambda, InvokeCommand } from '@aws-sdk/client-lambda';

enum SensorSearchRange {
    RECENT = 1,
    HOURLY = 4,
    DAILY = 96,
}

type SensorDataArgs = {
    DeviceId: any,
    range: keyof typeof SensorSearchRange,
    page: string,
}

type AppSyncEvent = {
    info: {
        fieldName: string
    },
    arguments: {
        where : SensorDataArgs
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

async function fetchSensorData(args: SensorDataArgs, _userId: string) {
    const endTimestamp: any = Math.floor(new Date().getTime() / 1000);
    const startTimestamp: any = endTimestamp - 31_557_600;
    const params: QueryCommandInput = {
        TableName: tableName,
        IndexName: "DeviceIndex",
        KeyConditionExpression: 'DeviceId = :deviceId AND #ts BETWEEN :startTimestamp AND :endTimestamp',
        ExpressionAttributeNames: {
            '#ts': 'Timestamp'
        },
        ExpressionAttributeValues: {
            ':deviceId': args.DeviceId,
            ':startTimestamp': startTimestamp,
            ':endTimestamp': endTimestamp,
        },
        ScanIndexForward: false,
        ExclusiveStartKey: args.page ? JSON.parse(Buffer.from(args.page, 'base64').toString('utf-8')) : undefined,
        Limit: SensorSearchRange[args.range]
    }
        
    const data = await dynamo.send(
        new QueryCommand(params)
    );
    return {
        page: data.Items,
        nextToken: data.LastEvaluatedKey ? Buffer.from(JSON.stringify(data.LastEvaluatedKey)).toString('base64') : null
    };
  }
  
  export const handler = async(event: AppSyncEvent,_context: any) => {
    const args = event.arguments.where
    const userId = event.identity.sub;
    const authorized = await isUserAuthorizedForDevice(userId,args.DeviceId);
    
    if(userId == null || !authorized) {
        throw new Error('An error occured establishing authentication.')
    }

    return await fetchSensorData(args,userId);
  }