import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { getRiskDashboard } from "@/lib/bankability/engine";

async function handleGet(_request: NextRequest, _auth: AuthenticatedRequest) {
  return NextResponse.json(getRiskDashboard());
}

export const GET = withAuth(handleGet);
