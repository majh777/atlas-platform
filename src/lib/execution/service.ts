import { executionStore } from './store';
import type { ChangeOrderStatus, IssueCategory, IssueStatus, MilestoneStatus } from './types';

export function getExecutionTwin() {
  return executionStore().getTwin();
}

export function listMilestones(status?: MilestoneStatus) {
  return executionStore().listMilestones(status);
}

export function createMilestone(input: Parameters<ReturnType<typeof executionStore>['createMilestone']>[0]) {
  return executionStore().createMilestone(input);
}

export function updateMilestone(id: string, patch: Parameters<ReturnType<typeof executionStore>['updateMilestone']>[1]) {
  return executionStore().updateMilestone(id, patch);
}

export function listIssues(status?: IssueStatus, category?: IssueCategory) {
  return executionStore().listIssues(status, category);
}

export function createIssue(input: Parameters<ReturnType<typeof executionStore>['createIssue']>[0]) {
  return executionStore().createIssue(input);
}

export function updateIssue(id: string, patch: Parameters<ReturnType<typeof executionStore>['updateIssue']>[1]) {
  return executionStore().updateIssue(id, patch);
}

export function createChangeOrder(input: Parameters<ReturnType<typeof executionStore>['createChangeOrder']>[0]) {
  return executionStore().createChangeOrder(input);
}

export function advanceChangeOrder(id: string, status: ChangeOrderStatus, comment: string) {
  return executionStore().advanceChangeOrder(id, status, comment);
}
