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

// Simple in-memory cache for scores (not production, but avoids repeated scans in quick succession)
let cachedScores: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const path = event.rawPath;
  const queryParams = event.queryStringParameters || {};

  try {
    if (path === "/telemetry") {
      // GET /telemetry?vehicleId=xxx (optional)
      const vehicleId = queryParams.vehicleId;

      // If vehicleId provided, use Query; else Scan (with limit for demo)
      let items: any[];
      if (vehicleId) {
        const result = await docClient.send(
          new QueryCommand({
            TableName: TELEMETRY_TABLE,
            KeyConditionExpression: "vehicleId = :vid",
            ExpressionAttributeValues: { ":vid": vehicleId },
            Limit: 50,
            ScanIndexForward: false, // most recent first
          }),
        );
        items = result.Items || [];
      } else {
        // No vehicleId, return last 50 events across all vehicles (Scan, limited)
        const result = await docClient.send(
          new ScanCommand({
            TableName: TELEMETRY_TABLE,
            Limit: 50,
          }),
        );
        items = result.Items || [];
      }
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(items),
      };
    } else if (path === "/scores") {
      // GET /scores — return cached or fresh driver summaries
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

      // Scan DriverSummaries table for latest scores
      const result = await docClient.send(
        new ScanCommand({
          TableName: SUMMARIES_TABLE,
        }),
      );
      cachedScores = result.Items || [];
      cacheTimestamp = now;
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify(cachedScores),
      };
    } else {
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
