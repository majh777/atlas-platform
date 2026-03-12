import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { listMaintenance, updateMaintenanceTask } from "@/lib/assets/service";

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const maintenance = await listMaintenance((searchParams.get("status") as never) ?? undefined);
  return NextResponse.json({ maintenance });
}

async function handlePost(request: NextRequest, _auth: AuthenticatedRequest) {
  try {
    const body = await request.json();
    if (!body.taskId || !body.status) {
      return NextResponse.json({ error: "taskId and status are required" }, { status: 400 });
    }

    const task = await updateMaintenanceTask({ taskId: body.taskId, status: body.status });
    return NextResponse.json({ task });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
