import { NextResponse } from 'next/server';
import { createMilestone, listMilestones, updateMilestone } from '@/lib/execution/service';
import type { MilestoneStatus } from '@/lib/execution/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') as MilestoneStatus | null) ?? undefined;
  const milestones = listMilestones(status);
  return NextResponse.json({ milestones, total: milestones.length });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const required = ['title', 'workPackageId', 'owner', 'baselineDate', 'forecastDate', 'status', 'critical', 'dependencies', 'completion'];
  for (const field of required) {
    if (body[field] === undefined) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  const milestone = createMilestone(body);
  return NextResponse.json({ milestone }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const milestone = updateMilestone(body.id, {
    status: body.status,
    forecastDate: body.forecastDate,
    actualDate: body.actualDate,
    completion: body.completion,
  });

  if (!milestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
  }

  return NextResponse.json({ milestone });
}
