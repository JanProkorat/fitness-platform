/**
 * Automations API module.
 *
 * Wraps the NSwag-generated global automation-rule endpoints.
 */
import { apiClient } from '@/api/client';
import {
  AutomationActionType,
  AutomationAudience,
  AutomationEventType,
  AutomationOffsetDirection,
  AutomationScheduleUnit,
  AutomationTriggerKind,
  Profession,
} from '@/api/generated';
import type {
  AutomationLinkedCheckInDto,
  AutomationRuleDto,
  AutomationRuleSummaryDto,
  CreateAutomationRuleRequest,
  UpdateAutomationRuleRequest,
} from '@/api/generated';

export {
  AutomationActionType,
  AutomationAudience,
  AutomationEventType,
  AutomationOffsetDirection,
  AutomationScheduleUnit,
  AutomationTriggerKind,
  Profession,
};
export type {
  AutomationLinkedCheckInDto,
  AutomationRuleDto,
  AutomationRuleSummaryDto,
  CreateAutomationRuleRequest,
  UpdateAutomationRuleRequest,
};

export interface AutomationRulesResult {
  rules: AutomationRuleDto[];
  linkedCheckIns: AutomationLinkedCheckInDto[];
}

/** Lists the caller's global rules and the linked weekly check-in rows via GET /trainer/automations/rules. */
export async function getAutomationRules(): Promise<AutomationRulesResult> {
  const response = await apiClient.getAutomationRulesEndpoint();
  return { rules: response.rules ?? [], linkedCheckIns: response.linkedCheckIns ?? [] };
}

/** Creates a global rule via POST /trainer/automations/rules. The response carries no summary. */
export async function createAutomationRule(request: CreateAutomationRuleRequest): Promise<AutomationRuleDto> {
  return apiClient.createAutomationRuleEndpoint(request);
}

/** Replaces a rule via PUT /trainer/automations/rules/{ruleId}. The response carries no summary. */
export async function updateAutomationRule(
  ruleId: string,
  request: UpdateAutomationRuleRequest,
): Promise<AutomationRuleDto> {
  return apiClient.updateAutomationRuleEndpoint(ruleId, request);
}

/** Deletes a rule via DELETE /trainer/automations/rules/{ruleId}. */
export async function deleteAutomationRule(ruleId: string): Promise<void> {
  await apiClient.deleteAutomationRuleEndpoint(ruleId);
}
