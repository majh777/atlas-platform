import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { calculateScenario } from "@/lib/finance/calculations";
import { importScenarioCsv } from "@/lib/finance/csv";
import { listScenarios } from "@/lib/finance/repository";
import type { FinancialScenarioInput } from "@/lib/finance/types";
import { validateScenarioInput } from "@/lib/finance/validation";

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const format = request.nextUrl.searchParams.get("format");
  const scenarios = listScenarios();

  if (format === "summary") {
    return NextResponse.json(
      scenarios.map((scenario) => ({
        id: scenario.input.id,
        name: scenario.input.name,
        fundingStructure: scenario.input.fundingStructure,
        dscr: scenario.metrics.dscr,
        projectIrr: scenario.metrics.projectIrr,
      })),
    );
  }

  return NextResponse.json(scenarios);
}

async function handlePost(request: NextRequest, _auth: AuthenticatedRequest) {
  const payload = await request.json();

  if (payload.csv) {
    return NextResponse.json({ imported: importScenarioCsv(payload.csv) });
  }

  const input = payload as FinancialScenarioInput;
  const issues = validateScenarioInput(input);
  if (issues.some((issue) => issue.level === "error")) {
    return NextResponse.json({ issues }, { status: 400 });
  }

  return NextResponse.json({ result: calculateScenario(input), issues });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
