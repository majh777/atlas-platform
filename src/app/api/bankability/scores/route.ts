import { NextRequest, NextResponse } from "next/server";
import { evaluateBankability } from "@/lib/bankability/engine";
import type { ScenarioMode } from "@/lib/bankability/types";

export function GET(request: NextRequest) {
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
