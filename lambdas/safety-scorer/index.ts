import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TELEMETRY_TABLE = process.env.TELEMETRY_TABLE!;
const SUMMARIES_TABLE = process.env.SUMMARIES_TABLE!;

interface TelemetryItem {
  vehicleId: string;
  timestamp: number;
  speed: number;
  harshBraking: boolean;
  engineTemp: number;
  fuelLevel: number;
}

async function getTelemetryForVehicle(
  vehicleId: string,
  since: number,
): Promise<TelemetryItem[]> {
  const items: TelemetryItem[] = [];
  let ExclusiveStartKey: any;
  do {
    const params: any = {
      TableName: TELEMETRY_TABLE,
      FilterExpression: "vehicleId = :vid AND #ts > :since",
      ExpressionAttributeNames: { "#ts": "timestamp" },
      ExpressionAttributeValues: {
        ":vid": vehicleId,
        ":since": since,
      },
      ExclusiveStartKey,
    };
    const result = await docClient.send(new ScanCommand(params));
    items.push(...(result.Items as TelemetryItem[]));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export const handler = async () => {
  const since = Date.now() - 2 * 60 * 60 * 1000; // last 2 hours
  const vehicleIds = ["V-101", "V-202", "V-303", "V-404", "V-505"];
  const summaryDate = new Date().toISOString().split("T")[0];

  for (const vid of vehicleIds) {
    try {
      const events = await getTelemetryForVehicle(vid, since);
      if (events.length === 0) {
        console.log(`No recent events for ${vid}`);
        continue;
      }

      // Calculate safety score
      let score = 100;
      const speedViolations = events.filter((e) => e.speed > 100).length;
      const harshBrakingCount = events.filter((e) => e.harshBraking).length;
      const highTempCount = events.filter((e) => e.engineTemp > 95).length;

      score -= speedViolations * 5;
      score -= harshBrakingCount * 10;
      score -= highTempCount * 3;
      if (score < 0) score = 0;

      const avgSpeed = Math.round(
        events.reduce((sum, e) => sum + e.speed, 0) / events.length,
      );
      const maxSpeed = Math.max(...events.map((e) => e.speed));

      const summary = `Vehicle ${vid}: ${events.length} readings, avg speed ${avgSpeed} km/h, max ${maxSpeed} km/h, ${harshBrakingCount} harsh brakes, ${highTempCount} high temp events. Score: ${score}/100.`;

      const putCmd = new PutCommand({
        TableName: SUMMARIES_TABLE,
        Item: {
          vehicleId: vid,
          summaryDate: summaryDate,
          score: score,
          summary: summary,
          eventCount: events.length,
          generatedAt: Date.now(),
        },
      });
      await docClient.send(putCmd);
      console.log(`Summary stored for ${vid} with score ${score}`);
    } catch (error) {
      console.error(`Error processing ${vid}:`, error);
    }
  }
};
