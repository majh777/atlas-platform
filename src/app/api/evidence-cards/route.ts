import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { listEvidence } from "@/lib/document-intelligence/service";

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") ?? undefined;
  const risk = searchParams.get("risk") ?? undefined;

  let evidenceCards = await listEvidence(query);
  if (risk) {
    evidenceCards = evidenceCards.filter((card) => card.riskLevel === risk);
  }

  return NextResponse.json({ evidenceCards });
}

async function handlePost(request: NextRequest, _auth: AuthenticatedRequest) {
  const body = await request.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query : undefined;
  const evidenceCards = await listEvidence(query);
  return NextResponse.json({ evidenceCards });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
