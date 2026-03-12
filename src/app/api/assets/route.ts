import { NextResponse } from "next/server";
import { createAsset, getAssetSnapshot, listAssets } from "@/lib/assets/service";

export async function GET(request: Request) {
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

export async function POST(request: Request) {
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
