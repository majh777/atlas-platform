import { NextRequest, NextResponse } from "next/server";
import { compareScenarios } from "@/lib/finance/calculations";
import type { FinancialScenarioInput } from "@/lib/finance/types";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    base: FinancialScenarioInput;
    candidate: FinancialScenarioInput;
  };

  return NextResponse.json(compareScenarios(payload.base, payload.candidate));
}
