import { NextResponse } from "next/server";
import { listMaintenance, updateMaintenanceTask } from "@/lib/assets/service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const maintenance = await listMaintenance((searchParams.get("status") as never) ?? undefined);
  return NextResponse.json({ maintenance });
}

export async function POST(request: Request) {
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
