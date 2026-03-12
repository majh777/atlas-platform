import { randomUUID } from 'node:crypto';
import { computeBudgetSnapshot, computeVarianceAnalysis } from './cost-control';
import type {
  ChangeOrder,
  ChangeOrderStatus,
  ExecutionTwin,
  IssueCategory,
  IssueRecord,
  IssueStatus,
  Milestone,
  MilestoneStatus,
  ProcurementItem,
  WorkPackage,
  ContractorScorecard,
} from './types';

function isoDaysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

const workPackages: WorkPackage[] = [
  {
    id: 'wp-civ-01',
    code: 'CIV-01',
    name: 'Primary crusher civil works',
    area: 'Process plant',
    contractor: 'PanCorr Civil',
    discipline: 'civil',
    progress: 64,
    plannedPercent: 72,
    scheduleVarianceDays: 11,
    physicalPercent: 64,
    earnedValueUsd: 58_000_000,
    budgetUsd: 92_000_000,
    forecastUsd: 97_500_000,
    commitmentsUsd: 83_000_000,
    contingencyUsd: 6_500_000,
    riskRating: 'medium',
    longLeadExposure: false,
    nextMilestoneId: 'ms-foundations',
  },
  {
    id: 'wp-rail-01',
    code: 'RAIL-01',
    name: 'Rail siding and loop package',
    area: 'Logistics corridor',
    contractor: 'TransAxis Rail',
    discipline: 'rail',
    progress: 43,
    plannedPercent: 49,
    scheduleVarianceDays: 8,
    physicalPercent: 43,
    earnedValueUsd: 71_000_000,
    budgetUsd: 126_000_000,
    forecastUsd: 131_000_000,
    commitmentsUsd: 102_500_000,
    contingencyUsd: 9_250_000,
    riskRating: 'high',
    longLeadExposure: true,
    nextMilestoneId: 'ms-turnouts',
  },
  {
    id: 'wp-port-01',
    code: 'PORT-01',
    name: 'Shiploader and berth interface',
    area: 'Port',
    contractor: 'Harbor Dynamic Systems',
    discipline: 'port',
    progress: 57,
    plannedPercent: 55,
    scheduleVarianceDays: -3,
    physicalPercent: 57,
    earnedValueUsd: 84_000_000,
    budgetUsd: 118_000_000,
    forecastUsd: 116_000_000,
    commitmentsUsd: 109_000_000,
    contingencyUsd: 8_000_000,
    riskRating: 'medium',
    longLeadExposure: true,
    nextMilestoneId: 'ms-shiploader',
  },
];

const milestones: Milestone[] = [
  {
    id: 'ms-foundations',
    title: 'Crusher raft foundations complete',
    workPackageId: 'wp-civ-01',
    owner: 'Site controls team',
    baselineDate: isoDaysFromNow(14),
    forecastDate: isoDaysFromNow(25),
    status: 'at_risk',
    critical: true,
    dependencies: ['rebar-release'],
    completion: 78,
  },
  {
    id: 'ms-turnouts',
    title: 'Turnout fabrication released',
    workPackageId: 'wp-rail-01',
    owner: 'Rail EPC package manager',
    baselineDate: isoDaysFromNow(18),
    forecastDate: isoDaysFromNow(26),
    status: 'delayed',
    critical: true,
    dependencies: ['design-freeze', 'supplier-drawings'],
    completion: 52,
  },
  {
    id: 'ms-shiploader',
    title: 'Shiploader FAT complete',
    workPackageId: 'wp-port-01',
    owner: 'Marine systems lead',
    baselineDate: isoDaysFromNow(21),
    forecastDate: isoDaysFromNow(20),
    status: 'in_progress',
    critical: false,
    dependencies: ['vendor-qc'],
    completion: 61,
  },
];

const contractorScorecards: ContractorScorecard[] = [
  {
    contractor: 'PanCorr Civil',
    safety: 92,
    quality: 88,
    productivity: 81,
    commercial: 84,
    claimsExposureUsd: 1_400_000,
    activeChangeOrders: 1,
    notes: 'Manpower uplift recovered concrete pour productivity; watch rework on embed alignment.',
  },
  {
    contractor: 'TransAxis Rail',
    safety: 90,
    quality: 86,
    productivity: 72,
    commercial: 76,
    claimsExposureUsd: 4_200_000,
    activeChangeOrders: 2,
    notes: 'Fabrication slippage on switchgear and turnouts pushing corridor sequence.',
  },
  {
    contractor: 'Harbor Dynamic Systems',
    safety: 95,
    quality: 91,
    productivity: 87,
    commercial: 89,
    claimsExposureUsd: 800_000,
    activeChangeOrders: 1,
    notes: 'Strong FAT prep and interface management with berth civil works.',
  },
];

const changeOrders: ChangeOrder[] = [
  {
    id: 'co-001',
    title: 'Additional piling for crusher transfer tower',
    contractor: 'PanCorr Civil',
    workPackageId: 'wp-civ-01',
    status: 'under_review',
    requestedCostUsd: 2_300_000,
    approvedCostUsd: 0,
    scheduleImpactDays: 5,
    reason: 'Geotechnical conditions differed from tender assumptions.',
    approvers: ['Project director', 'Commercial manager'],
    history: [
      { at: isoDaysFromNow(-7), status: 'draft', comment: 'Raised by contractor after borehole review.' },
      { at: isoDaysFromNow(-5), status: 'submitted', comment: 'Submitted with pricing backup.' },
      { at: isoDaysFromNow(-2), status: 'under_review', comment: 'Under review by controls and geotech.' },
    ],
  },
  {
    id: 'co-002',
    title: 'Turnout vendor acceleration premium',
    contractor: 'TransAxis Rail',
    workPackageId: 'wp-rail-01',
    status: 'approved',
    requestedCostUsd: 3_800_000,
    approvedCostUsd: 2_900_000,
    scheduleImpactDays: -9,
    reason: 'Expedite long-lead turnout fabrication to protect corridor critical path.',
    approvers: ['Project director', 'Supply chain lead'],
    history: [
      { at: isoDaysFromNow(-10), status: 'draft', comment: 'Acceleration concept drafted.' },
      { at: isoDaysFromNow(-9), status: 'submitted', comment: 'Submitted with vendor quotation.' },
      { at: isoDaysFromNow(-7), status: 'under_review', comment: 'Reviewed against critical path recovery logic.' },
      { at: isoDaysFromNow(-6), status: 'approved', comment: 'Approved with partial commercial carve-out.' },
    ],
  },
];

const issues: IssueRecord[] = [
  {
    id: 'is-001',
    title: 'Embedded plates out of tolerance on transfer tower',
    category: 'field',
    workPackageId: 'wp-civ-01',
    location: 'Plant Area A / Gridline 14',
    priority: 'high',
    status: 'investigating',
    assignee: 'Civil QA lead',
    reportedBy: 'Field engineer',
    createdAt: isoDaysFromNow(-2),
    dueDate: isoDaysFromNow(2),
    description: 'Survey indicates 18 mm offset on two embed plates impacting conveyor stringer alignment.',
    mobileCaptured: true,
  },
  {
    id: 'is-002',
    title: 'RFI on turnout control cabinet interface',
    category: 'rfi',
    workPackageId: 'wp-rail-01',
    location: 'Rail package / Vendor drawing review',
    priority: 'critical',
    status: 'open',
    assignee: 'Systems integration manager',
    reportedBy: 'Rail package engineer',
    createdAt: isoDaysFromNow(-1),
    dueDate: isoDaysFromNow(1),
    description: 'Pending clarification on SCADA and interlocking cabling segregation before IFC release.',
    mobileCaptured: false,
  },
  {
    id: 'is-003',
    title: 'Punch-list closeout for shiploader cable tray supports',
    category: 'punch_list',
    workPackageId: 'wp-port-01',
    location: 'Berth 2 / Shiploader tower',
    priority: 'medium',
    status: 'resolved',
    assignee: 'Marine electrical supervisor',
    reportedBy: 'Commissioning walkdown team',
    createdAt: isoDaysFromNow(-4),
    dueDate: isoDaysFromNow(-1),
    description: 'Three tray support clamps required replacement and repainting before mechanical completion.',
    mobileCaptured: true,
  },
];

const procurement: ProcurementItem[] = [
  {
    id: 'pr-001',
    item: 'Rail turnout assemblies',
    supplier: 'SwitchCore GmbH',
    workPackageId: 'wp-rail-01',
    requiredOnSiteDate: isoDaysFromNow(34),
    forecastArrivalDate: isoDaysFromNow(45),
    status: 'delayed',
    longLead: true,
    varianceDays: 11,
  },
  {
    id: 'pr-002',
    item: 'Shiploader festoon cable reels',
    supplier: 'Marinex Controls',
    workPackageId: 'wp-port-01',
    requiredOnSiteDate: isoDaysFromNow(20),
    forecastArrivalDate: isoDaysFromNow(18),
    status: 'shipping',
    longLead: true,
    varianceDays: -2,
  },
  {
    id: 'pr-003',
    item: 'Crusher foundation grout package',
    supplier: 'BuildChem Africa',
    workPackageId: 'wp-civ-01',
    requiredOnSiteDate: isoDaysFromNow(7),
    forecastArrivalDate: isoDaysFromNow(7),
    status: 'ordered',
    longLead: false,
    varianceDays: 0,
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export class ExecutionStore {
  private workPackages = clone(workPackages);
  private milestones = clone(milestones);
  private contractorScorecards = clone(contractorScorecards);
  private changeOrders = clone(changeOrders);
  private issues = clone(issues);
  private procurement = clone(procurement);

  getTwin(): ExecutionTwin {
    const budget = computeBudgetSnapshot(this.workPackages);
    const variance = computeVarianceAnalysis(this.workPackages, budget, this.procurement, this.issues);

    return {
      project: {
        id: 'atlas-execution-01',
        name: 'Atlas Iron Corridor',
        location: 'Cameroon logistics corridor',
        phase: 'Execution',
      },
      generatedAt: new Date().toISOString(),
      workPackages: clone(this.workPackages),
      milestones: clone(this.milestones),
      budget,
      contractorScorecards: clone(this.contractorScorecards),
      changeOrders: clone(this.changeOrders),
      issues: clone(this.issues),
      procurement: clone(this.procurement),
      variance,
      highlights: this.buildHighlights(variance),
    };
  }

  listMilestones(status?: MilestoneStatus) {
    return this.milestones.filter((item) => !status || item.status === status).map(clone);
  }

  createMilestone(input: Omit<Milestone, 'id'>) {
    const milestone: Milestone = { ...input, id: randomUUID() };
    this.milestones.unshift(milestone);
    return clone(milestone);
  }

  updateMilestone(id: string, patch: Partial<Pick<Milestone, 'status' | 'forecastDate' | 'actualDate' | 'completion'>>) {
    const item = this.milestones.find((entry) => entry.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    return clone(item);
  }

  listIssues(status?: IssueStatus, category?: IssueCategory) {
    return this.issues
      .filter((item) => (!status || item.status === status) && (!category || item.category === category))
      .map(clone);
  }

  createIssue(input: Omit<IssueRecord, 'id' | 'createdAt'>) {
    const issue: IssueRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.issues.unshift(issue);
    return clone(issue);
  }

  updateIssue(id: string, patch: Partial<Pick<IssueRecord, 'status' | 'assignee' | 'priority' | 'dueDate'>>) {
    const item = this.issues.find((entry) => entry.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    return clone(item);
  }

  createChangeOrder(input: Omit<ChangeOrder, 'id' | 'history'> & { initialComment?: string }) {
    const changeOrder: ChangeOrder = {
      ...input,
      id: randomUUID(),
      history: [
        {
          at: new Date().toISOString(),
          status: input.status,
          comment: input.initialComment ?? 'Change order created.',
        },
      ],
    };
    this.changeOrders.unshift(changeOrder);
    return clone(changeOrder);
  }

  advanceChangeOrder(id: string, status: ChangeOrderStatus, comment: string) {
    const item = this.changeOrders.find((entry) => entry.id === id);
    if (!item) return null;
    item.status = status;
    if (status === 'approved' && item.approvedCostUsd === 0) {
      item.approvedCostUsd = item.requestedCostUsd;
    }
    item.history.push({ at: new Date().toISOString(), status, comment });
    return clone(item);
  }

  private buildHighlights(variance: ExecutionTwin['variance']) {
    return [
      `Forecast is $${(variance.costVarianceUsd / 1_000_000).toFixed(1)}m versus approved budget, with $${(variance.contingencyRemainingUsd / 1_000_000).toFixed(1)}m contingency headroom remaining.`,
      `${variance.longLeadDelayedCount} long-lead item(s) are late against required-on-site need dates, led by turnout assemblies on the rail package.`,
      `${variance.criticalIssuesOpen} critical issue(s) remain open across field/RFI/punch-list workflows.`
    ];
  }
}

let store = new ExecutionStore();

export function executionStore() {
  return store;
}

export function resetExecutionStore() {
  store = new ExecutionStore();
  return store;
}
