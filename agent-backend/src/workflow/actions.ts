import { getCFClient } from './cfClient';
import { normalizeVendor, normalizeVendors, normalizeUsers } from './vendorUtils';
import { queryRaw } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

export type ActionName =
  | 'create_onboard_workflow'
  | 'run_onboard_workflow'
  | 'create_offboard_workflow'
  | 'run_offboard_workflow'
  | 'approve_offboard_workflow'
  | 'delete_workflow'
  | 'create_conditional_workflow'
  | 'pre_register_user';

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Execute a confirmed write action.
 * Called ONLY after the user explicitly clicks a confirmation button.
 * Every call is logged to agent_actions (append-only) before execution.
 */
export async function executeAction(
  actionName: ActionName,
  payload: Record<string, any>,
  orgId: string,
  userId: string,
  runId: string
): Promise<ActionResult> {
  const cf = getCFClient();
  const actionId = uuidv4();

  // Log BEFORE executing — immutable audit trail
  await logActionBefore(actionId, orgId, runId, actionName, payload, userId);

  let result: any;
  try {
    switch (actionName) {
      case 'create_onboard_workflow': {
        const vendor = normalizeVendor(payload.vendor);
        const connectedVendors = await cf.getConnectedVendors();
        const found = connectedVendors.find(
          (v: any) => v.providerName === vendor || v.vendor === vendor
        );
        if (!found) throw new Error(`Vendor "${payload.vendor}" is not connected. Connect it in CloudFuze first.`);

        result = await cf.createOnboardWorkflow({
          workflowName: payload.workflow_name ?? `Onboard - ${vendor}`,
          vendor,
          adminCloudId: found.adminCloudId,
          adminMemberId: found.memberId ?? found.memebId,
          users: normalizeUsers(payload.users),
        });
        break;
      }

      case 'run_onboard_workflow': {
        const vendor = normalizeVendor(payload.vendor);
        result = await cf.runOnboardWorkflow({
          email: payload.email,
          displayName: payload.display_name ?? payload.email,
          vendor,
          adminMemberId: payload.admin_member_id,
          adminCloudId: payload.admin_cloud_id,
          existingAdminCloudId: payload.existing_admin_cloud_id,
        });
        break;
      }

      case 'create_offboard_workflow': {
        const apps = normalizeVendors(payload.apps).map((v) => ({ vendor: v }));
        const users = normalizeUsers(payload.users).map((e) => ({ email: e }));
        if (!apps.length) throw new Error('At least one app is required for offboarding.');
        if (!users.length) throw new Error('At least one user is required for offboarding.');

        result = await cf.createOffboardWorkflow({
          workflowName: payload.workflow_name ?? `Offboard - ${users.map((u) => u.email).join(', ')}`,
          apps,
          users,
        });
        break;
      }

      case 'run_offboard_workflow': {
        const vendor = normalizeVendor(payload.vendor);
        result = await cf.runOffboardWorkflow({
          adminCloudId: payload.admin_cloud_id,
          email: payload.email,
          vendor,
          permDelete: payload.perm_delete ?? false,
        });
        break;
      }

      case 'approve_offboard_workflow': {
        const status = payload.approved ? 'APPROVED' : 'REJECTED';
        result = await cf.approveOffboardWorkflow(payload.workflow_id, status);
        break;
      }

      case 'delete_workflow': {
        result = await cf.deleteWorkflow(payload.workflow_id, payload.is_offboard ?? false);
        break;
      }

      case 'create_conditional_workflow': {
        const vendor = normalizeVendor(payload.vendor);
        result = await cf.createConditionalWorkflow({
          workflowName: payload.workflow_name ?? `Conditional - ${vendor}`,
          vendor,
          condition: payload.condition,
        });
        break;
      }

      case 'pre_register_user': {
        const vendor = normalizeVendor(payload.vendor);
        result = await cf.preRegisterUser({
          email: payload.email,
          vendor,
          adminMemberId: payload.admin_member_id,
          firstName: payload.first_name,
          lastName: payload.last_name,
        });
        break;
      }

      default:
        throw new Error(`Unknown action: ${actionName}`);
    }

    await markActionExecuted(actionId, result);
    return { success: true, data: result };
  } catch (err: any) {
    await markActionFailed(actionId, err.message);
    return { success: false, error: err.message };
  }
}

async function logActionBefore(
  actionId: string,
  orgId: string,
  runId: string,
  action: string,
  payload: any,
  userId: string
): Promise<void> {
  await queryRaw(
    `INSERT INTO agent_actions (id, org_id, run_id, action, tool_input, requires_approval, approved_by, approved_at)
     VALUES ($1, $2, $3, $4, $5, true, $6, NOW())`,
    [actionId, orgId, runId, action, JSON.stringify(payload), userId]
  );
}

async function markActionExecuted(actionId: string, result: any): Promise<void> {
  await queryRaw(
    `UPDATE agent_actions SET result = $2, executed_at = NOW() WHERE id = $1`,
    [actionId, JSON.stringify(result)]
  );
}

async function markActionFailed(actionId: string, errorMsg: string): Promise<void> {
  await queryRaw(
    `UPDATE agent_actions SET result = $2 WHERE id = $1`,
    [actionId, JSON.stringify({ error: errorMsg })]
  );
}
