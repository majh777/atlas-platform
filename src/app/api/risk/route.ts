import { NextResponse } from "next/server";
import { getRiskDashboard } from "@/lib/bankability/engine";

export function GET() {
  return NextResponse.json(getRiskDashboard());
}
