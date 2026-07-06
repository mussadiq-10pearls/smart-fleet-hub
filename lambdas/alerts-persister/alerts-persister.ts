import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSEvent } from "aws-lambda";

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = process.env.ALERTS_TABLE!;

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    try {
      const alert = JSON.parse(record.body);
      // The SNS message is wrapped; the actual alert is inside `Message` (a JSON string)
      const payload = JSON.parse(alert.Message);
      const alertId = `${payload.vehicleId}#${payload.timestamp}`;

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            alertId,
            timestamp: payload.timestamp,
            vehicleId: payload.vehicleId,
            violations: payload.violations,
            location: payload.location,
          },
        }),
      );
      console.log(`Alert stored: ${alertId}`);
    } catch (err) {
      console.error("Failed to process alert", err);
    }
  }
};
