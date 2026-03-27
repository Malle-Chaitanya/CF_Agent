import { queryWithOrg } from '../db/client';

/**
 * All tool handlers query the PostgreSQL mirror with org isolation.
 * org_id is ALWAYS passed from the authenticated JWT — never from user input.
 */

export async function dispatchTool(
  toolName: string,
  input: Record<string, any>,
  orgId: string
): Promise<any> {
  switch (toolName) {
    case 'get_org_stats':        return getOrgStats(orgId);
    case 'get_discovered_apps':  return getDiscoveredApps(orgId, input);
    case 'get_app_usage':        return getAppUsage(orgId, input);
    case 'get_licenses':         return getLicenses(orgId, input);
    case 'get_unused_licenses':  return getUnusedLicenses(orgId, input);
    case 'get_user_apps':        return getUserApps(orgId, input);
    case 'get_spend_summary':    return getSpendSummary(orgId, input);
    case 'get_spend_anomalies':  return getSpendAnomalies(orgId, input);
    case 'get_renewal_forecast': return getRenewalForecast(orgId, input);
    case 'get_shadow_it':        return getShadowIt(orgId, input);
    case 'get_compliance_summary': return getComplianceSummary(orgId);
    case 'get_duplicate_tools':  return getDuplicateTools(orgId, input);
    case 'get_contract_details': return getContractDetails(orgId, input);
    case 'search_apps':          return searchApps(orgId, input);
    case 'get_groups':           return getGroups(orgId, input);
    case 'get_workflows':        return getWorkflows(orgId, input);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ── Tool Implementations ──────────────────────────────────────────────────────

async function getOrgStats(orgId: string) {
  const [apps, users, licenses, shadow, spend, renewals] = await Promise.all([
    // Integrated apps = ACTIVE status (matches dashboard "Total Apps: 146")
    queryWithOrg(orgId, `
      SELECT
        COUNT(*) FILTER (WHERE status = 'ACTIVE')  AS integrated_apps,
        COUNT(*)                                    AS total_apps
      FROM apps_mirror WHERE org_id = $1`, [orgId]),

    // Active users = is_active = true (matches dashboard "Total Active Users: 2850")
    queryWithOrg(orgId, `
      SELECT
        COUNT(*) FILTER (WHERE is_active = true)  AS active_users,
        COUNT(*)                                   AS total_users
      FROM users_mirror WHERE org_id = $1`, [orgId]),

    queryWithOrg(orgId, `
      SELECT
        COUNT(*)             AS total_licenses,
        SUM(used_seats)      AS used_seats,
        SUM(total_seats)     AS total_seats,
        SUM(inactive_users)  AS unused_licenses
      FROM licenses_mirror
      WHERE org_id = $1
        AND app_name NOT LIKE 'CloudFuze%'
        AND LOWER(app_name) NOT IN ('test','same','others')
        AND (total_cost > 0 OR total_seats > 0)`, [orgId]),

    queryWithOrg(orgId, `
      SELECT
        COUNT(*)                                        AS total_shadow_it,
        COUNT(*) FILTER (WHERE risk_level = 'HIGH')     AS high_risk,
        COUNT(*) FILTER (WHERE risk_level = 'MEDIUM')   AS medium_risk,
        COUNT(*) FILTER (WHERE risk_level = 'LOW')      AS low_risk
      FROM shadow_it_mirror WHERE org_id = $1`, [orgId]),

    // Total spend + potential savings (matches dashboard "$14.4K" and "$963.58")
    queryWithOrg(orgId, `
      SELECT
        COALESCE(SUM(total_spend),      0) AS total_spend,
        COALESCE(SUM(potential_saving), 0) AS potential_savings
      FROM spend_mirror WHERE org_id = $1`, [orgId]),

    queryWithOrg(orgId, `SELECT COUNT(*) AS renewing_soon FROM licenses_mirror WHERE org_id = $1 AND renewal_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'`, [orgId]),
  ]);

  return {
    // Matches CloudFuze dashboard KPI cards
    total_apps:           Number(apps.rows[0]?.integrated_apps ?? 0),
    all_apps_in_db:       Number(apps.rows[0]?.total_apps ?? 0),
    active_users:         Number(users.rows[0]?.active_users ?? 0),
    total_users:          Number(users.rows[0]?.total_users ?? 0),
    total_licenses:       Number(licenses.rows[0]?.total_licenses ?? 0),
    used_seats:           Number(licenses.rows[0]?.used_seats ?? 0),
    total_seats:          Number(licenses.rows[0]?.total_seats ?? 0),
    unused_licenses:      Number(licenses.rows[0]?.unused_licenses ?? 0),
    // Shadow IT from shadow_it_mirror (ShadowAppsDetailsQueue — 658 records)
    shadow_it_count:      Number(shadow.rows[0]?.total_shadow_it ?? 0),
    high_risk_shadow_it:  Number(shadow.rows[0]?.high_risk ?? 0),
    medium_risk_shadow_it: Number(shadow.rows[0]?.medium_risk ?? 0),
    low_risk_shadow_it:   Number(shadow.rows[0]?.low_risk ?? 0),
    total_spend:          Number(spend.rows[0]?.total_spend ?? 0),
    potential_savings:    Number(spend.rows[0]?.potential_savings ?? 0),
    renewing_in_30_days:  Number(renewals.rows[0]?.renewing_soon ?? 0),
  };
}

async function getDiscoveredApps(orgId: string, input: any) {
  const limit = input.limit ?? 50;
  const conditions: string[] = ['org_id = $1'];
  const params: any[] = [orgId];

  // All apps in apps_mirror are approved/integrated SaaS tools (status = 'ACTIVE', is_approved = true).
  // active_users / inactive_users are user-engagement counts WITHIN each app.
  // with_users_only=true → only apps that have at least 1 user assigned
  if (input.with_users_only === true) {
    conditions.push('total_users > 0');
  }

  if (input.risk_level) {
    params.push(input.risk_level);
    conditions.push(`risk_level = $${params.length}`);
  }

  if (input.category) {
    params.push(`%${input.category.toLowerCase()}%`);
    conditions.push(`LOWER(category) LIKE $${params.length}`);
  }

  params.push(limit);
  const { rows } = await queryWithOrg(
    orgId,
    `SELECT name, provider_name, idp, category, risk_level, is_via_sso,
            total_users, active_users, inactive_users, billable_users, idle_users,
            active_amount, inactive_amount, total_spend_cents,
            CASE WHEN total_users > 0
              THEN ROUND((active_users::numeric / total_users) * 100, 1)
              ELSE 0 END AS utilisation_pct,
            is_approved, admin_cloud_id
     FROM apps_mirror
     WHERE ${conditions.join(' AND ')}
     ORDER BY total_users DESC NULLS LAST
     LIMIT $${params.length}`,
    params
  );

  // Return a summary header alongside the rows
  const { rows: summary } = await queryWithOrg(
    orgId,
    `SELECT COUNT(*)                    AS total_apps,
            SUM(total_users)            AS total_users,
            SUM(active_users)           AS total_active_users,
            SUM(inactive_users)         AS total_inactive_users,
            SUM(billable_users)         AS total_billable_users,
            SUM(idle_users)             AS total_idle_users,
            SUM(total_spend_cents)/100  AS total_spend
     FROM apps_mirror WHERE org_id = $1`,
    [orgId]
  );

  return { summary: summary[0], apps: rows };
}

async function getAppUsage(orgId: string, input: any) {
  const { rows } = await queryWithOrg(
    orgId,
    `SELECT name, provider_name, idp, total_users, active_users,
            inactive_users, billable_users, idle_users,
            active_amount, inactive_amount,
            CASE WHEN total_users > 0 THEN ROUND((active_users::numeric / total_users) * 100, 1) ELSE 0 END AS utilisation_pct
     FROM apps_mirror
     WHERE org_id = $1 AND (LOWER(name) LIKE $2 OR LOWER(provider_name) LIKE $2 OR LOWER(idp) LIKE $2)
     LIMIT 5`,
    [orgId, `%${input.app_name?.toLowerCase() ?? ''}%`]
  );
  return rows;
}

async function getLicenses(orgId: string, input: any) {
  const conditions: string[] = [
    'org_id = $1',
    // Exclude CloudFuze internal migration service records
    "app_name NOT LIKE 'CloudFuze%'",
    // Exclude obvious test/junk entries
    "LOWER(app_name) NOT IN ('test', 'same', 'test of update user', 'others')",
    // Must have at least some cost or seats to be meaningful
    '(total_cost > 0 OR total_seats > 0)',
  ];
  const params: any[] = [orgId];

  if (input.app_name) {
    params.push(`%${input.app_name.toLowerCase()}%`);
    conditions.push(`(LOWER(app_name) LIKE $${params.length} OR LOWER(plan_name) LIKE $${params.length})`);
  }
  if (input.status && input.status !== 'all') {
    params.push(input.status);
    conditions.push(`status = $${params.length}`);
  }

  const { rows } = await queryWithOrg(
    orgId,
    `SELECT vendor, app_name, plan_name, total_seats, used_seats, inactive_users,
            cost_per_seat, total_cost, annual_cost, renewal_date, status, days_until_renewal,
            utilization_pct, auto_renew
     FROM licenses_mirror
     WHERE ${conditions.join(' AND ')}
     ORDER BY total_cost DESC NULLS LAST
     LIMIT 50`,
    params
  );
  return rows;
}

async function getUnusedLicenses(orgId: string, input: any) {
  const inactiveDays = input.inactive_days ?? 60;
  const conditions: string[] = [
    'l.org_id = $1',
    'l.inactive_users > 0',
    "l.app_name NOT LIKE 'CloudFuze%'",
    "LOWER(l.app_name) NOT IN ('test', 'same', 'others')",
    'l.total_cost > 0',
  ];
  const params: any[] = [orgId];

  if (input.app_name) {
    params.push(`%${input.app_name.toLowerCase()}%`);
    conditions.push(`(LOWER(l.app_name) LIKE $${params.length} OR LOWER(l.vendor) LIKE $${params.length})`);
  }

  const { rows } = await queryWithOrg(
    orgId,
    `SELECT l.vendor, l.app_name, l.inactive_users AS unused_seats,
            l.cost_per_seat,
            ROUND(l.inactive_users * COALESCE(l.cost_per_seat, 0), 2) AS wasted_cost,
            l.utilization_pct, l.total_seats, l.used_seats
     FROM licenses_mirror l
     WHERE ${conditions.join(' AND ')}
     ORDER BY wasted_cost DESC NULLS LAST
     LIMIT 50`,
    params
  );
  return { inactive_threshold_days: inactiveDays, unused_licenses: rows };
}

async function getUserApps(orgId: string, input: any) {
  if (input.email) {
    const { rows } = await queryWithOrg(
      orgId,
      `SELECT u.email, u.name, u.department, u.role,
              COUNT(a.id) AS app_count
       FROM users_mirror u
       LEFT JOIN apps_mirror a ON a.org_id = u.org_id
       WHERE u.org_id = $1 AND LOWER(u.email) LIKE $2
       GROUP BY u.email, u.name, u.department, u.role
       LIMIT 10`,
      [orgId, `%${input.email.toLowerCase()}%`]
    );
    return rows;
  }

  if (input.department) {
    const { rows } = await queryWithOrg(
      orgId,
      `SELECT u.email, u.name, u.department, u.role, u.is_active
       FROM users_mirror u
       WHERE u.org_id = $1 AND LOWER(u.department) LIKE $2
       ORDER BY u.name
       LIMIT 50`,
      [orgId, `%${input.department.toLowerCase()}%`]
    );
    return rows;
  }

  // Default: top users by app count
  const { rows } = await queryWithOrg(
    orgId,
    `SELECT email, name, department, role, is_active, is_domain_admin
     FROM users_mirror
     WHERE org_id = $1
     ORDER BY name
     LIMIT 50`,
    [orgId]
  );
  return rows;
}

async function getSpendSummary(orgId: string, input: any) {
  const groupBy = input.group_by ?? 'app';
  const limit = input.limit ?? 20;

  let groupCol: string;
  switch (groupBy) {
    case 'vendor':     groupCol = 'vendor'; break;
    case 'department': groupCol = 'COALESCE(department, \'Unknown\')'; break;
    default:           groupCol = 'COALESCE(app_name, vendor, \'Unknown\')';
  }

  const { rows } = await queryWithOrg(
    orgId,
    `SELECT ${groupCol} AS label,
            SUM(total_spend) AS total_spend,
            SUM(active_users) AS active_users,
            SUM(inactive_users) AS inactive_users,
            SUM(potential_saving) AS potential_saving
     FROM spend_mirror
     WHERE org_id = $1
     GROUP BY ${groupCol}
     ORDER BY total_spend DESC NULLS LAST
     LIMIT $2`,
    [orgId, limit]
  );

  const { rows: totals } = await queryWithOrg(
    orgId,
    `SELECT SUM(total_spend) AS grand_total, SUM(potential_saving) AS total_saving FROM spend_mirror WHERE org_id = $1`,
    [orgId]
  );

  return {
    group_by: groupBy,
    grand_total: Number(totals[0]?.grand_total ?? 0),
    total_potential_saving: Number(totals[0]?.total_saving ?? 0),
    breakdown: rows,
  };
}

async function getSpendAnomalies(orgId: string, input: any) {
  const minSaving = input.min_saving ?? 100;
  const { rows } = await queryWithOrg(
    orgId,
    `SELECT vendor, app_name, total_spend, active_users, inactive_users,
            cost_per_license, potential_saving,
            CASE WHEN active_users > 0 THEN ROUND(inactive_users::numeric / (active_users + inactive_users) * 100, 1) ELSE 100 END AS waste_pct
     FROM spend_mirror
     WHERE org_id = $1 AND potential_saving >= $2
     ORDER BY potential_saving DESC
     LIMIT 20`,
    [orgId, minSaving]
  );
  return rows;
}

async function getRenewalForecast(orgId: string, input: any) {
  const daysAhead = input.days_ahead ?? 90;
  const { rows } = await queryWithOrg(
    orgId,
    `SELECT vendor, app_name, renewal_date, annual_cost, days_until_renewal,
            auto_renew, status, total_seats, utilization_pct
     FROM licenses_mirror
     WHERE org_id = $1
       AND renewal_date BETWEEN NOW() AND NOW() + INTERVAL '${daysAhead} days'
       AND app_name NOT LIKE 'CloudFuze%'
       AND LOWER(app_name) NOT IN ('test', 'same', 'others')
       AND total_cost > 0
     ORDER BY renewal_date ASC
     LIMIT 30`,
    [orgId]
  );
  return { days_ahead: daysAhead, renewals: rows };
}

async function getShadowIt(orgId: string, input: any) {
  const limit = input.limit ?? 50;
  const conditions: string[] = ['org_id = $1'];
  const params: any[] = [orgId];

  if (input.risk_level && input.risk_level !== 'all') {
    params.push(input.risk_level);
    conditions.push(`risk_level = $${params.length}`);
  }

  params.push(limit);
  const { rows } = await queryWithOrg(
    orgId,
    `SELECT app_name, category, risk_level, user_count, oauth_scopes, discovered_at
     FROM shadow_it_mirror
     WHERE ${conditions.join(' AND ')}
     ORDER BY risk_level DESC, user_count DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function getComplianceSummary(orgId: string) {
  const [inactive, highRisk, shadowTotal, noRenewal] = await Promise.all([
    // Apps that are INACTIVE (de-provisioned but still in portfolio)
    queryWithOrg(orgId, `SELECT COUNT(*) AS count FROM apps_mirror WHERE org_id = $1 AND status = 'INACTIVE'`, [orgId]),
    // High-risk shadow IT apps
    queryWithOrg(orgId, `SELECT COUNT(*) AS count FROM shadow_it_mirror WHERE org_id = $1 AND risk_level = 'HIGH'`, [orgId]),
    // Total shadow IT
    queryWithOrg(orgId, `SELECT COUNT(*) AS count FROM shadow_it_mirror WHERE org_id = $1`, [orgId]),
    // Licenses with no renewal date (unmanaged)
    queryWithOrg(orgId, `
      SELECT COUNT(*) AS count FROM licenses_mirror
      WHERE org_id = $1 AND renewal_date IS NULL
        AND app_name NOT LIKE 'CloudFuze%'
        AND LOWER(app_name) NOT IN ('test','same','others')
        AND (total_cost > 0 OR total_seats > 0)`, [orgId]),
  ]);

  return {
    inactive_apps:          Number(inactive.rows[0]?.count ?? 0),
    high_risk_shadow_it:    Number(highRisk.rows[0]?.count ?? 0),
    total_shadow_it:        Number(shadowTotal.rows[0]?.count ?? 0),
    licenses_without_renewal: Number(noRenewal.rows[0]?.count ?? 0),
  };
}

async function getDuplicateTools(orgId: string, input: any) {
  const conditions: string[] = ['org_id = $1', 'category IS NOT NULL'];
  const params: any[] = [orgId];

  if (input.category) {
    params.push(`%${input.category.toLowerCase()}%`);
    conditions.push(`LOWER(category) LIKE $${params.length}`);
  }

  const { rows } = await queryWithOrg(
    orgId,
    `SELECT category, COUNT(*) AS app_count, ARRAY_AGG(name) AS apps
     FROM apps_mirror
     WHERE ${conditions.join(' AND ')}
     GROUP BY category
     HAVING COUNT(*) > 1
     ORDER BY app_count DESC`,
    params
  );
  return rows;
}

async function getContractDetails(orgId: string, input: any) {
  // Contract data is stored in licenses_mirror (from Subscriptions collection)
  const conditions: string[] = [
    'org_id = $1',
    "app_name NOT LIKE 'CloudFuze%'",
    "LOWER(app_name) NOT IN ('test', 'same', 'others')",
    '(total_cost > 0 OR total_seats > 0)',
  ];
  const params: any[] = [orgId];

  if (input.app_name) {
    params.push(`%${input.app_name.toLowerCase()}%`);
    conditions.push(`(LOWER(app_name) LIKE $${params.length} OR LOWER(vendor) LIKE $${params.length})`);
  }

  const { rows } = await queryWithOrg(
    orgId,
    `SELECT vendor, app_name, plan_name, total_cost AS contract_value,
            annual_cost, renewal_date, auto_renew, status, days_until_renewal,
            total_seats, utilization_pct
     FROM licenses_mirror
     WHERE ${conditions.join(' AND ')}
     ORDER BY renewal_date ASC NULLS LAST
     LIMIT 20`,
    params
  );
  return rows;
}

async function searchApps(orgId: string, input: any) {
  const q = `%${input.query?.toLowerCase() ?? ''}%`;
  const { rows } = await queryWithOrg(
    orgId,
    `SELECT name, provider_name, status, category, risk_level, is_shadow_it, total_users, active_users
     FROM apps_mirror
     WHERE org_id = $1 AND (
       LOWER(name) LIKE $2 OR
       LOWER(provider_name) LIKE $2 OR
       LOWER(category) LIKE $2
     )
     ORDER BY total_users DESC NULLS LAST
     LIMIT 20`,
    [orgId, q]
  );
  return rows;
}

async function getGroups(orgId: string, input: any) {
  const limit = input.limit ?? 50;
  const minMembers = input.min_members ?? 1;
  const conditions: string[] = ['org_id = $1', `members_count >= $2`];
  const params: any[] = [orgId, minMembers];

  if (input.vendor) {
    params.push(`%${input.vendor.toUpperCase()}%`);
    conditions.push(`UPPER(vendor) LIKE $${params.length}`);
  }

  params.push(limit);
  const { rows } = await queryWithOrg(
    orgId,
    `SELECT vendor, app_name, display_name, members_count,
            permissions_group, private_group, teams_channel, created_time
     FROM groups_mirror
     WHERE ${conditions.join(' AND ')}
     ORDER BY members_count DESC
     LIMIT $${params.length}`,
    params
  );

  const { rows: summary } = await queryWithOrg(
    orgId,
    `SELECT
       COUNT(*)               AS total_groups,
       SUM(members_count)     AS total_memberships,
       COUNT(DISTINCT vendor) AS vendor_count
     FROM groups_mirror WHERE org_id = $1`,
    [orgId]
  );

  return {
    summary: summary[0],
    groups: rows,
  };
}

async function getWorkflows(orgId: string, input: any) {
  // Workflows are fetched from the Java API directly — stored in agent_runs context
  // Return a prompt to use the action route for workflow operations
  return {
    note: 'Workflow data is managed by the CloudFuze backend. Use action buttons to create or manage workflows.',
    suggestion: 'I can help you create an onboarding or offboarding workflow. What would you like to do?',
  };
}
