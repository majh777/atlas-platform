import { NextResponse } from "next/server";
import {
  ingestDocuments,
  listDocuments,
  updateHumanReview,
  updateStorageLifecycle,
} from "@/lib/document-intelligence/service";
import type { IngestRequestDocument, ReviewStatus, StorageClass } from "@/types/document-intelligence";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documents = await listDocuments({
    query: searchParams.get("q") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "review") {
      const document = await updateHumanReview({
        documentId: body.documentId,
        status: body.status as ReviewStatus,
        reviewer: body.reviewer ?? "Human reviewer",
        notes: body.notes,
        summary: body.summary,
      });
      return NextResponse.json({ document });
    }

    if (body.action === "retention") {
      const document = await updateStorageLifecycle({
        documentId: body.documentId,
        storageClass: body.storageClass as StorageClass,
        retentionUntil: body.retentionUntil,
      });
      return NextResponse.json({ document });
    }

    const documents = (body.documents ?? []) as IngestRequestDocument[];
    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json({ error: "documents array is required" }, { status: 400 });
    }

    const result = await ingestDocuments(documents);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
