import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createAsset, getAssetSnapshot, listAssets } from "@/lib/assets/service";

async function handleGet(request: NextRequest, _auth: AuthenticatedRequest) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("snapshot") === "true") {
    return NextResponse.json(await getAssetSnapshot());
  }

  const assets = await listAssets({
    site: searchParams.get("site") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });
  return NextResponse.json({ assets });
}

async function handlePost(request: NextRequest, _auth: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const required = ["name", "site", "category", "className", "owner"];
    const missing = required.filter((key) => !body[key]);
    if (missing.length) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    const asset = await createAsset({
      name: body.name,
      site: body.site,
      category: body.category,
      className: body.className,
      owner: body.owner,
      status: body.status ?? "operational",
      utilizationTarget: body.utilizationTarget ?? 85,
      fuelTargetPerUnit: body.fuelTargetPerUnit ?? 0,
      energyTargetPerUnit: body.energyTargetPerUnit ?? 0,
      throughputTarget: body.throughputTarget ?? 0,
      inspectionDueAt: body.inspectionDueAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      serviceIntervalHours: body.serviceIntervalHours ?? 500,
      runtimeHours: body.runtimeHours ?? 0,
      commercialRatePerUnit: body.commercialRatePerUnit ?? 0,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 });
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
