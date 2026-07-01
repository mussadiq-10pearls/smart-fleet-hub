import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SQSEvent, SQSRecord } from "aws-lambda";

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const sns = new SNSClient({ region: process.env.AWS_REGION || "us-east-1" });

const TABLE_NAME = process.env.TABLE_NAME!;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;

interface TelemetryEvent {
  id: string;
  vehicleId: string;
  timestamp: number;
  speed: number;
  harshBraking: boolean;
  location: { lat: number; lon: number };
  engineTemp: number;
  fuelLevel: number;
}

export const handler = async (event: SQSEvent) => {
  const records: SQSRecord[] = event.Records;
  console.log(`Processing ${records.length} messages...`);

  for (const record of records) {
    try {
      const body = JSON.parse(record.body) as TelemetryEvent;

      // 1. Write to DynamoDB
      const putCmd = new PutCommand({
        TableName: TABLE_NAME,
        Item: body,
      });
      await docClient.send(putCmd);

      // 2. Check for safety violations
      const violations: string[] = [];
      if (body.speed > 100) {
        violations.push(`Over-speed (${body.speed} km/h)`);
      }
      if (body.harshBraking) {
        violations.push("Harsh braking detected");
      }

      if (violations.length > 0) {
        // 3. Publish alert to SNS
        const alertMessage = {
          vehicleId: body.vehicleId,
          timestamp: body.timestamp,
          violations: violations,
          location: body.location,
        };

        const publishCmd = new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Subject: `Safety Alert: ${body.vehicleId}`,
          Message: JSON.stringify(alertMessage, null, 2),
        });

        await sns.send(publishCmd);
        console.log(`Alert sent for ${body.vehicleId}`);
      }
    } catch (err) {
      console.error("Failed to process record", record.messageId, err);
      // We'll throw to make SQS retry, but for now just log.
      // In production, you'd want to handle partial failures carefully.
    }
  }

  return { batchItemFailures: [] }; // we'll handle failures properly later
};
