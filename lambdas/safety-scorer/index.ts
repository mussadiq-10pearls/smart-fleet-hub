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
const GROQ_API_KEY = process.env.GROQ_API_KEY || ""; // empty = use rule‑based fallback

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

// Rule‑based scoring (used as fallback)
function calculateRuleBasedScore(events: TelemetryItem[]): {
  score: number;
  summary: string;
} {
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

  const summary = `Vehicle ${events[0].vehicleId}: ${events.length} readings, avg speed ${avgSpeed} km/h, max ${maxSpeed} km/h, ${harshBrakingCount} harsh brakes, ${highTempCount} high temp events. Score: ${score}/100.`;
  return { score, summary };
}

// Groq AI scoring (returns null if failed)
async function getAIScore(
  events: TelemetryItem[],
): Promise<{ score: number; summary: string } | null> {
  if (!GROQ_API_KEY) return null;

  const vid = events[0].vehicleId;
  const avgSpeed = Math.round(
    events.reduce((sum, e) => sum + e.speed, 0) / events.length,
  );
  const maxSpeed = Math.max(...events.map((e) => e.speed));
  const harshBrakingCount = events.filter((e) => e.harshBraking).length;

  const prompt = `You are a fleet safety analyst. Based on the following driving data, provide a safety score from 0 (dangerous) to 100 (perfect) and a short explanation. Return the result as valid JSON with keys "score" (number) and "summary" (string). Do not include any other text.

Data: Vehicle ${vid} had ${events.length} readings in the last 2 hours. Average speed: ${avgSpeed} km/h, max speed: ${maxSpeed} km/h, harsh braking events: ${harshBrakingCount}.`;

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 150,
        }),
      },
    );

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || "";
    if (!aiText) return null;

    // Safely extract JSON from the response
    const jsonStart = aiText.indexOf("{");
    const jsonEnd = aiText.lastIndexOf("}") + 1;
    if (jsonStart < 0 || jsonEnd <= jsonStart) return null;

    const jsonString = aiText.substring(jsonStart, jsonEnd);
    const parsed = JSON.parse(jsonString);
    if (typeof parsed.score !== "number" || typeof parsed.summary !== "string")
      return null;

    return { score: parsed.score, summary: parsed.summary };
  } catch (err) {
    console.error(
      "Groq AI call failed, falling back to rule‑based scoring",
      err,
    );
    return null;
  }
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

      // Try AI first, fallback to rule‑based
      let scoreResult = await getAIScore(events);
      if (!scoreResult) {
        scoreResult = calculateRuleBasedScore(events);
      }

      const putCmd = new PutCommand({
        TableName: SUMMARIES_TABLE,
        Item: {
          vehicleId: vid,
          summaryDate: summaryDate,
          score: scoreResult.score,
          summary: scoreResult.summary,
          eventCount: events.length,
          generatedAt: Date.now(),
        },
      });
      await docClient.send(putCmd);
      console.log(
        `Summary stored for ${vid} with score ${scoreResult.score} (source: ${GROQ_API_KEY ? "AI" : "rule‑based"})`,
      );
    } catch (error) {
      console.error(`Error processing ${vid}:`, error);
    }
  }
};
