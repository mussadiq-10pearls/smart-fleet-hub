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
        Limit: 50,
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
