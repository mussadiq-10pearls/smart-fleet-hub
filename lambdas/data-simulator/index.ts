import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });
const QUEUE_URL = process.env.QUEUE_URL!; // will be set via environment

// Vehicles we simulate
const VEHICLE_IDS = ["V-101", "V-202", "V-303", "V-404", "V-505"];

function generateTelemetry(vehicleId: string) {
  const speed = Math.floor(Math.random() * 120); // 0-120 km/h
  const harshBraking = Math.random() > 0.85; // 15% chance
  const latitude = (Math.random() * 180 - 90).toFixed(6);
  const longitude = (Math.random() * 360 - 180).toFixed(6);
  const timestamp = Date.now();

  return {
    id: `${vehicleId}#${timestamp}`, // unique identifier
    vehicleId,
    timestamp,
    speed,
    harshBraking,
    location: { lat: parseFloat(latitude), lon: parseFloat(longitude) },
    engineTemp: Math.floor(Math.random() * 30 + 70), // 70-100 °C
    fuelLevel: Math.floor(Math.random() * 100),
  };
}

export const handler = async (event: any) => {
  // Generate one event per vehicle
  const entries = VEHICLE_IDS.map((vid) => ({
    Id: vid,
    MessageBody: JSON.stringify(generateTelemetry(vid)),
  }));

  const command = new SendMessageBatchCommand({
    QueueUrl: QUEUE_URL,
    Entries: entries,
  });

  try {
    const response = await sqs.send(command);
    console.log(`Sent ${response.Successful?.length} messages`);
    if (response.Failed && response.Failed.length > 0) {
      console.error("Failures:", JSON.stringify(response.Failed));
    }
  } catch (err) {
    console.error("Error sending to SQS:", err);
  }
};
