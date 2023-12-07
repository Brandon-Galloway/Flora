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
    if (args.StartTimestamp == null ? args.EndTimestamp != null : args.EndTimestamp == null) {
        throw new Error('Timestamp selections must include both a valid StartTimestamp and EndTimestamp.')
    }

    return await fetchSensorData(args);
  }