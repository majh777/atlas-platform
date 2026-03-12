import { promptRegistry } from '@/lib/ai/prompts';
import type { AiCapability, NarrativeTemplateType, PromptTemplate } from '@/lib/ai/types';

export function getPromptTemplate(capability: AiCapability, templateType?: NarrativeTemplateType): PromptTemplate {
  const id =
    capability === 'narrative'
      ? templateType === 'board_pack'
        ? 'ai-narrative-board-pack'
        : templateType === 'update_note'
          ? 'ai-narrative-update-note'
          : 'ai-narrative-ic-memo'
      : capability === 'search'
        ? 'ai-search-evidence-answer'
        : capability === 'diligence'
          ? 'ai-diligence-copilot'
          : 'ai-workflow-assistant';

  const template = promptRegistry.find((entry) => entry.id === id);
  if (!template) throw new Error(`Prompt template not found for ${capability}`);
  return template;
}

export function listPromptTemplates(capability?: AiCapability) {
  return capability ? promptRegistry.filter((entry) => entry.capability === capability) : promptRegistry;
}
