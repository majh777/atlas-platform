import { calculateScenario } from "@/lib/finance/calculations";
import { demoScenarios } from "@/lib/finance/demo-data";
import { exportScenarioToCsv } from "@/lib/finance/csv";
import { assumptionVersions, modelTemplates } from "@/lib/finance/templates";

export function listModelLibrary() {
  return {
    templates: modelTemplates,
    assumptions: assumptionVersions,
  };
}

export function listScenarios() {
  return demoScenarios.map((scenario) => calculateScenario(scenario));
}

export function getScenario(id: string) {
  const scenario = demoScenarios.find((item) => item.id === id);
  return scenario ? calculateScenario(scenario) : null;
}

export function getScenarioExport(id: string) {
  const scenario = getScenario(id);
  return scenario ? exportScenarioToCsv(scenario) : null;
}
