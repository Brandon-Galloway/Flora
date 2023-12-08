import axios  from "axios";
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
const tableName = process.env.DEVICE_CONFIGURATION_TABLE;

async function fetchSensorData(args: any) {
    const params: any = {
        TableName: tableName,
        KeyConditionExpression: 'DeviceId = :deviceId',
        ExpressionAttributeValues: {
            ':deviceId': args.DeviceId,
        }
    }
        
    const data = await dynamo.send(
        new QueryCommand(params)
    );
    return data.Items;
  }
  
  export const handler = async(event: AppSyncEvent, context: any) => {
    const args = event.arguments.where
    return await fetchSensorData(args);
  }