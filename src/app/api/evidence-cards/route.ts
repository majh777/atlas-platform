import { NextResponse } from "next/server";
import { listEvidence } from "@/lib/document-intelligence/service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? undefined;
  const risk = searchParams.get("risk") ?? undefined;

  let evidenceCards = await listEvidence(query);
  if (risk) {
    evidenceCards = evidenceCards.filter((card) => card.riskLevel === risk);
  }

  return NextResponse.json({ evidenceCards });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query : undefined;
  const evidenceCards = await listEvidence(query);
  return NextResponse.json({ evidenceCards });
}
