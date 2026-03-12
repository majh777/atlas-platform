import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { evaluateBankability } from "@/lib/bankability/engine";
import type { ScenarioMode } from "@/lib/bankability/types";

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const mode = (request.nextUrl.searchParams.get("mode") as ScenarioMode | null) ?? "base";
  const format = request.nextUrl.searchParams.get("format");
  const evaluation = evaluateBankability(mode);

  if (format === "pack") {
    return NextResponse.json({
      project: evaluation.project.name,
      modelVersion: evaluation.scoringModel.version,
      exportPack: evaluation.exportPack,
    });
  }

  return NextResponse.json(evaluation);
}

export const GET = withAuth(handleGet);
