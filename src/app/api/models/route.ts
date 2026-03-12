import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { listModelLibrary } from "@/lib/finance/repository";

async function handleGet(_request: NextRequest, _auth: AuthenticatedRequest) {
  return NextResponse.json(listModelLibrary());
}

export const GET = withAuth(handleGet);
