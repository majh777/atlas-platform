import { NextResponse } from "next/server";
import { listModelLibrary } from "@/lib/finance/repository";

export async function GET() {
  return NextResponse.json(listModelLibrary());
}
