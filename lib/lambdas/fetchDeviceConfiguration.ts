import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

type DeviceSearchArguments = {
    DeviceId: String
}

type AppSyncEvent = {
    info: {
        fieldName: string
    },
    arguments: {
        where : DeviceSearchArguments
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
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = process.env.DEVICE_CONFIGURATION_TABLE;

async function fetchSensorData(args: DeviceSearchArguments, userId: string) {
    
    const params: any = {
        TableName: tableName,
        FilterExpression: 'contains(AuthorizedUsers, :userId)',
        ExpressionAttributeValues: {
            ':userId': userId,
        }
    }
    
    if(args.DeviceId) {
        params.KeyConditionExpression = 'DeviceId = :deviceId';
        params.ExpressionAttributeValues = {
            ...params.ExpressionAttributeValues,
            ':deviceId': args.DeviceId,
        };
    }
    
    const data = await dynamo.send(
        new QueryCommand(params)
    );
    return data.Items;
  }
  
  export const handler = async(event: AppSyncEvent, context: any) => {
    const args = event.arguments.where;
    const userId = event.identity.sub;
    
    if(userId == null) {
        throw new Error('An error occured establishing authentication.')
    }
    
    return await fetchSensorData(args,userId);
  }