import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { ingestTelemetry, listTelemetry } from "@/lib/assets/service";

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const telemetry = await listTelemetry(searchParams.get("assetId") ?? undefined);
  return NextResponse.json({ telemetry });
}

async function handlePost(request: NextRequest, _auth: AuthenticatedRequest) {
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

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
