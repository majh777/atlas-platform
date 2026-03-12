import { NextResponse } from "next/server";
import { ingestTelemetry, listTelemetry } from "@/lib/assets/service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const telemetry = await listTelemetry(searchParams.get("assetId") ?? undefined);
  return NextResponse.json({ telemetry });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.connectorId || !Array.isArray(body.readings) || body.readings.length === 0) {
      return NextResponse.json({ error: "connectorId and readings[] are required" }, { status: 400 });
    }

    const result = await ingestTelemetry({
      connectorId: body.connectorId,
      timestamp: body.timestamp,
      readings: body.readings,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}
