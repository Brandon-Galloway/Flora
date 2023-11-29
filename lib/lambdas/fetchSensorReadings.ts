import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

type AppSyncEvent = {
    info: {
        fieldName: string
    },
    arguments: {
        where : {
            id: number,
            DeviceId: String,
            StartTimestamp: number,
            EndTimestamp: number
        }
    },
    identity: {
        username: string,
        claims: {
            [key: string]: string[]
        }
    }
}

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = process.env.SENSOR_DATA_TABLE;


async function fetchSensorData(args: any) {
    console.log("ARGS: " + JSON.stringify(args));
    console.log("TS: " + args.StartTimestamp.toString() + " " + args.EndTimestamp.toString());
    const params = {
        TableName: tableName,
        IndexName: "DeviceIndex",
        KeyConditionExpression: 'DeviceId = :deviceId AND #ts BETWEEN :startTimestamp AND :endTimestamp',
        ExpressionAttributeNames: {
            '#ts': "Timestamp",
        },
        ExpressionAttributeValues: {
            ':deviceId': args.DeviceId,
            ':startTimestamp': args.StartTimestamp,
            ':endTimestamp': args.EndTimestamp
        }
    }
    console.log("PARAMS: " + JSON.stringify(params));
    
    const data = await dynamo.send(
        new QueryCommand(params)
    );
    console.log(JSON.stringify(data));
    return data.Items;
  }
  
  export const handler = async(event: AppSyncEvent,context: any) => {
    const args = event.arguments.where
    if (args.StartTimestamp == null ? args.EndTimestamp != null : args.EndTimestamp == null) {
        throw new Error('Timestamp selections must include both a valid StartTimestamp and EndTimestamp.')
    }

    return await fetchSensorData(args);
  }