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
  AutomationRuleSource,
  AutomationRunStatus,
  AutomationScheduleUnit,
  AutomationSkipReason,
  AutomationTriggerKind,
  Profession,
} from '@/api/generated';
import type {
  AutomationLinkedCheckInDto,
  AutomationRuleDto,
  AutomationRuleSummaryDto,
  ClientAutomationItem,
  ClientAutomationLastResult,
  ClientAutomationSummary,
  CreateAutomationRuleRequest,
  CreateClientAutomationRuleRequest,
  GetClientAutomationsResponse,
  OverrideClientAutomationRequest,
  PauseClientAutomationRequest,
  UpdateAutomationRuleRequest,
} from '@/api/generated';

export {
  AutomationActionType,
  AutomationAudience,
  AutomationEventType,
  AutomationOffsetDirection,
  AutomationRuleSource,
  AutomationRunStatus,
  AutomationScheduleUnit,
  AutomationSkipReason,
  AutomationTriggerKind,
  Profession,
};
export type {
  AutomationLinkedCheckInDto,
  AutomationRuleDto,
  AutomationRuleSummaryDto,
  ClientAutomationItem,
  ClientAutomationLastResult,
  ClientAutomationSummary,
  CreateAutomationRuleRequest,
  CreateClientAutomationRuleRequest,
  GetClientAutomationsResponse,
  OverrideClientAutomationRequest,
  PauseClientAutomationRequest,
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

/** A client's effective rules with the 30-day summary via GET /trainer/clients/{clientId}/automations. */
export async function getClientAutomations(clientId: string): Promise<GetClientAutomationsResponse> {
  return apiClient.getClientAutomationsEndpoint(clientId);
}

/** Adds a rule that applies to one client only. */
export async function createClientAutomationRule(
  clientId: string,
  request: CreateClientAutomationRuleRequest,
): Promise<AutomationRuleDto> {
  return apiClient.createClientAutomationRuleEndpoint(clientId, request);
}

/** Customises a global rule for one client. */
export async function overrideClientAutomation(
  clientId: string,
  ruleId: string,
  request: OverrideClientAutomationRequest,
): Promise<void> {
  await apiClient.overrideClientAutomationEndpoint(clientId, ruleId, request);
}

/** Pauses or resumes a global rule for one client. */
export async function pauseClientAutomation(
  clientId: string,
  ruleId: string,
  request: PauseClientAutomationRequest,
): Promise<void> {
  await apiClient.pauseClientAutomationEndpoint(clientId, ruleId, request);
}

/** Removes the client's customisation so the global rule applies again. */
export async function resetClientAutomation(clientId: string, ruleId: string): Promise<void> {
  await apiClient.resetClientAutomationEndpoint(clientId, ruleId);
}
