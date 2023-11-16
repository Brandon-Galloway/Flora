import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto"

type SensorCollectionEvent = {
  Timestamp: number,
  SoilTemperature: number,
  AirTemperature: number,
  Humidity: number,
  Light: number,
  VisibleLight: number,
  InfraredLight: number
}

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = process.env.SENSOR_DATA_TABLE;


async function uploadSensorData(sensorData: SensorCollectionEvent) {
  const timestamp = Math.floor(Date.now() / 1000)
  const twoYearsInSeconds = 2 * 365 * 24 * 60 * 60
  const ttl_timestamp = timestamp + twoYearsInSeconds;
  
  let sensorReading = {
    Id: randomUUID(),
    Timestamp: timestamp,
    ExpireTimestamp: ttl_timestamp,
  }
  Object.assign(sensorReading,sensorData);
  await dynamo.send(
    new PutCommand({
      TableName: tableName,
      Item: sensorReading,
    })
    );
    return {
      // TODO: Proper Callback
      id: 2
  }
  }
  
  export const handler = async(event: SensorCollectionEvent,context: any) => {
    console.log("EVENT: " + JSON.stringify(event));
    return uploadSensorData(event);
  }