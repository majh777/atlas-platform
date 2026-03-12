import type { AssumptionVersion, ModelTemplate } from "@/lib/finance/types";

export const assumptionVersions: AssumptionVersion[] = [
  {
    version: "2026.01-base",
    effectiveDate: "2026-01-01",
    summary: "Base case assumptions for industrial infrastructure projects.",
    assumptions: {
      inflationRate: 0.03,
      discountRate: 0.11,
      taxRate: 0.28,
      interestRate: 0.085,
      leaseRate: 0.072,
      exitMultiple: 6.5,
      defaultProductionGrowth: 0.035,
      defaultPriceEscalation: 0.025,
    },
  },
  {
    version: "2026.02-tight-credit",
    effectiveDate: "2026-02-15",
    summary: "Higher-rate environment with conservative commodity assumptions.",
    assumptions: {
      inflationRate: 0.035,
      discountRate: 0.125,
      taxRate: 0.28,
      interestRate: 0.102,
      leaseRate: 0.083,
      exitMultiple: 6.1,
      defaultProductionGrowth: 0.025,
      defaultPriceEscalation: 0.018,
    },
  },
];

export const modelTemplates: ModelTemplate[] = [
  {
    id: "capex-open-pit",
    name: "Open-Pit Mine Development CapEx",
    type: "capex",
    basis: "US$M annualised construction draw",
    items: [
      { label: "Mine development", annualAmount: 120_000_000, category: "development" },
      { label: "Processing plant", annualAmount: 180_000_000, category: "plant" },
      { label: "Power & water", annualAmount: 55_000_000, category: "utilities" },
      { label: "Rail spur & logistics", annualAmount: 95_000_000, category: "logistics" },
    ],
  },
  {
    id: "opex-industrial",
    name: "Industrial Operations OpEx",
    type: "opex",
    basis: "US$ annual steady-state run rate",
    items: [
      { label: "Labour", annualAmount: 24_000_000, category: "people" },
      { label: "Energy", annualAmount: 18_500_000, category: "utilities" },
      { label: "Maintenance", annualAmount: 16_200_000, category: "maintenance" },
      { label: "Consumables", annualAmount: 11_400_000, category: "materials" },
      { label: "G&A", annualAmount: 9_800_000, category: "overhead" },
    ],
  },
  {
    id: "revenue-copper-concentrate",
    name: "Copper Concentrate Revenue Model",
    type: "revenue",
    basis: "Annual shipments and realised pricing",
    items: [
      { label: "Copper concentrate", annualVolume: 185_000, unitPrice: 3_950, escalationRate: 0.025 },
      { label: "Silver by-product", annualVolume: 1_250_000, unitPrice: 0.82, escalationRate: 0.02 },
    ],
  },
];

export function getTemplate<T extends ModelTemplate["type"]>(type: T, id: string) {
  const template = modelTemplates.find((item) => item.type === type && item.id === id);
  if (!template) {
    throw new Error(`Template not found: ${type}/${id}`);
  }
  return template as Extract<ModelTemplate, { type: T }>;
}

export function getAssumptionVersion(version: string) {
  const item = assumptionVersions.find((entry) => entry.version === version);
  if (!item) {
    throw new Error(`Assumption version not found: ${version}`);
  }
  return item;
}
