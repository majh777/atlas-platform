import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { compareScenarios } from "@/lib/finance/calculations";
import type { FinancialScenarioInput } from "@/lib/finance/types";

async function handlePost(request: NextRequest, _auth: AuthenticatedRequest) {
  const payload = (await request.json()) as {
    base: FinancialScenarioInput;
    candidate: FinancialScenarioInput;
  };

  return NextResponse.json(compareScenarios(payload.base, payload.candidate));
}

export const POST = withAuth(handlePost);
