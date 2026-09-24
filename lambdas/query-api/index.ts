import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TELEMETRY_TABLE = process.env.TELEMETRY_TABLE!;
const SUMMARIES_TABLE = process.env.SUMMARIES_TABLE!;
const ALERTS_TABLE = process.env.ALERTS_TABLE!;
const VEHICLES_TABLE = process.env.VEHICLES_TABLE!;
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// In‑memory cache for scores (optional, 1 minute TTL)
let cachedScores: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const path = event.rawPath;
  const queryParams = event.queryStringParameters || {};

  try {
    // ---------- TELEMETRY (with pagination) ----------
    if (path === "/telemetry") {
      const vehicleId = queryParams.vehicleId;
      const startKeyParam = queryParams.startKey;
      const limit = parseInt(queryParams.limit || "50", 10);

      // Decode the start key if provided
      let ExclusiveStartKey: any;
      if (startKeyParam) {
        try {
          ExclusiveStartKey = JSON.parse(
            Buffer.from(startKeyParam, "base64").toString("utf-8"),
          );
        } catch (e) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid startKey" }),
          };
        }
      }

      const baseParams: any = {
        TableName: TELEMETRY_TABLE,
        Limit: parseInt(queryParams.limit || "50", 10),
        ExclusiveStartKey,
      };

      if (vehicleId) {
        // Query for a specific vehicle (uses partition key)
        const result = await docClient.send(
          new QueryCommand({
            ...baseParams,
            KeyConditionExpression: "vehicleId = :vid",
            ExpressionAttributeValues: { ":vid": vehicleId },
            ScanIndexForward: false, // most recent first
          }),
        );
        const items = result.Items || [];
        const nextKey = result.LastEvaluatedKey
          ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString(
              "base64",
            )
          : null;

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ items, nextKey }),
        };
      } else {
        // Scan for all vehicles
        const result = await docClient.send(new ScanCommand(baseParams));
        const items = result.Items || [];
        const nextKey = result.LastEvaluatedKey
          ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString(
              "base64",
            )
          : null;

        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({ items, nextKey }),
        };
      }
    }

    // ---------- SCORES (simple scan, no pagination) ----------
    else if (path === "/scores") {
      const now = Date.now();
      if (cachedScores && now - cacheTimestamp < CACHE_TTL) {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify(cachedScores),
        };
      }

      const result = await docClient.send(
        new ScanCommand({ TableName: SUMMARIES_TABLE }),
      );
      cachedScores = result.Items || [];
      cacheTimestamp = now;

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(cachedScores), // still an array, frontend expects it
      };
    }

    // ---------- ALERTS -----------------------
    else if (path === "/alerts") {
      const limit = 20; // last 20 alerts
      const result = await docClient.send(
        new ScanCommand({
          TableName: process.env.ALERTS_TABLE!,
          Limit: limit,
        }),
      );
      const items = result.Items || [];
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(items),
      };
    }

    // ---------- VEHICLES -----------------------
    else if (path === "/vehicles") {
      const result = await docClient.send(
        new ScanCommand({
          TableName: process.env.VEHICLES_TABLE!,
          ProjectionExpression: "vehicleId",
        }),
      );
      const vehicles = (result.Items || []).map((item: any) => item.vehicleId);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ vehicles, count: vehicles.length }),
      };
    }

    // ------- NEW /ask ROUTE -------
    else if (path === "/ask") {
      // Safely extract question from body (handles string or object)
      let body: any;
      if (typeof event.body === "string") {
        try {
          body = JSON.parse(event.body);
        } catch (e) {
          body = {};
        }
      } else {
        body = event.body || {};
      }

      const question = body.question;
      if (!question) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Missing 'question' in request body" }),
        };
      }

      // 1. Gather context from DynamoDB
      const [telemetryResp, scoresResp, alertsResp, vehiclesResp] =
        await Promise.all([
          docClient.send(
            new ScanCommand({ TableName: TELEMETRY_TABLE, Limit: 10 }),
          ), // recent 10 events
          docClient.send(new ScanCommand({ TableName: SUMMARIES_TABLE })),
          docClient.send(
            new ScanCommand({ TableName: ALERTS_TABLE, Limit: 5 }),
          ),
          docClient.send(
            new ScanCommand({
              TableName: VEHICLES_TABLE,
              ProjectionExpression: "vehicleId",
            }),
          ),
        ]);

      const recentTelemetry = telemetryResp.Items || [];
      const scores = scoresResp.Items || [];
      const recentAlerts = alertsResp.Items || [];
      const activeVehicles = (vehiclesResp.Items || []).map(
        (v: any) => v.vehicleId,
      );

      // 2. Build a prompt with the data + user question
      const context = `
Current fleet status:
- Active vehicles: ${activeVehicles.join(", ")}
- Recent telemetry (last 10 events): ${JSON.stringify(recentTelemetry.map((item) => ({ vehicleId: item.vehicleId, speed: item.speed, harshBraking: item.harshBraking, timestamp: item.timestamp })))}
- Latest safety scores: ${JSON.stringify(scores.map((s) => ({ vehicleId: s.vehicleId, score: s.score, summary: s.summary })))}
- Recent alerts: ${JSON.stringify(recentAlerts.map((a) => ({ vehicleId: a.vehicleId, violations: a.violations, timestamp: a.timestamp })))}
`.trim();

      const systemPrompt = `You are a Fleet Safety Assistant. Answer user questions concisely and professionally using ONLY the provided fleet data below.
- If the question is about the fleet, give a clear, brief answer with relevant numbers.
- If the question is not about the fleet or cannot be answered from the data, respond exactly with: "I'm a fleet safety assistant. Please ask a question about the fleet, like driver scores, alerts, or telemetry."
- Do not add greetings, explanations, or code.
- Keep answers to 1–3 sentences.`;

      const prompt = `${systemPrompt}

Fleet Data:
${context}

User: ${question}
Assistant:`;

      // 3. Call Groq
      let answer = "Sorry, I couldn't process your request right now.";
      if (GROQ_API_KEY) {
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
                model: "qwen/qwen3.8-27b",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 300,
              }),
            },
          );
          const data = await response.json();
          answer = data.choices?.[0]?.message?.content || answer;
        } catch (err) {
          console.error("Groq call failed for /ask", err);
          answer =
            "I'm having trouble accessing the AI model. Please try again later.";
        }
      } else {
        answer = "AI assistant is not configured (missing API key).";
      }

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ question, answer }),
      };
    }

    // ---------- FALLBACK ----------
    else {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Not found" }),
      };
    }
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
