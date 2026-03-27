import { MongoClient, ChangeStream, Document } from 'mongodb';
import { bulkUpsert, query, saveResumeToken, getResumeToken } from '../db/client';
import { scheduleRestart } from '../utils/retry';

// Real collection: common.SaaSVendor (181 docs in production)
// Fields confirmed from live DB: providerName, adminEmail, memberId, status,
// userId, domain, activeUsers, inActiveUSers, usersCount, totalAmount, deleted
const DB_NAME = 'common';
const COLLECTION = 'SaaSVendor';

export async function startAppsWatcher(
  mongo: MongoClient,
  orgId: string,
  attempt = 1
): Promise<void> {
  const db = mongo.db(DB_NAME);
  const col = db.collection(COLLECTION);

  const resumeToken = await getResumeToken(`${COLLECTION}:${orgId}`);
  const options: any = { fullDocument: 'updateLookup' };
  if (resumeToken) options.resumeAfter = resumeToken;

  // Filter by domain + skip deleted docs
  const stream: ChangeStream = col.watch(
    [{ $match: { 'fullDocument.domain': orgId, 'fullDocument.deleted': { $ne: true } } }],
    options
  );

  console.log(`[watcher:apps] ✅ Watching common.SaaSVendor for org "${orgId}"`);

  stream.on('change', async (event: any) => {
    try {
      if (event.operationType === 'delete') {
        await query(
          `DELETE FROM apps_mirror WHERE org_id = $1 AND mongo_id = $2`,
          [orgId, event.documentKey._id.toString()]
        );
      } else if (event.fullDocument) {
        await upsertApp(event.fullDocument, orgId);
      }
      await saveResumeToken(`${COLLECTION}:${orgId}`, event._id);
    } catch (err: any) {
      console.error('[watcher:apps] change error:', err.message);
    }
  });

  stream.on('error', (err) => {
    console.error(`[watcher:apps] error:`, err.message);
    scheduleRestart('apps', attempt, () => startAppsWatcher(mongo, orgId, attempt + 1));
  });
}

async function upsertApp(doc: Document, orgId: string): Promise<void> {
  const row = {
    mongo_id:           doc._id?.toString(),
    org_id:             orgId,
    name:               doc.providerName?.trim() || doc.vendor?.trim() || doc.idp?.trim() || 'UNKNOWN',
    provider_name:      doc.providerName?.trim() || null,
    idp:                doc.idp?.trim() || null,
    status:             (doc.status || 'ACTIVE').toString().toUpperCase(),
    category:           doc.category ?? null,
    risk_level:         doc.riskLevel ?? 'LOW',
    is_shadow_it:       false,
    is_approved:        !(doc.deleted ?? false),
    is_via_sso:         Boolean(doc.isViaSSO ?? false),
    total_users:        Number(doc.usersCount ?? doc.totalUsers ?? 0),
    active_users:       Number(doc.activeUsers ?? 0),
    inactive_users:     Number(doc.inActiveUSers ?? doc.inactiveUsers ?? 0),
    billable_users:     Number(doc.billableUser ?? 0),
    idle_users:         Number(doc.idelUserCount ?? doc.idleUserCount ?? 0),
    active_amount:      Number(doc.activeAmount ?? 0),
    inactive_amount:    Number(doc.inActiveAmount ?? 0),
    total_spend_cents:  Number(doc.totalSpendCents ?? 0),
    total_included_spend_cents: Number(doc.totalIncludedSpendCents ?? 0),
    total_amount:       Number(doc.totalAmount ?? 0),
    admin_cloud_id:     doc._id?.toString() ?? null,
    member_id:          doc.memberId ?? null,
    admin_email:        doc.adminEmail ?? null,
    admin_member_id:    doc.adminMemberId ?? null,
    domain_name:        doc.domain ?? orgId,
    user_id:            doc.userId?.toString() ?? null,
    sso_idp_cloud_id:   doc.ssoIdpCloudId ?? null,
    sso_app_id:         doc.ssoAppId ?? null,
    deleted:            Boolean(doc.deleted ?? false),
    notify:             Boolean(doc.notify ?? false),
    annual_plan:        Boolean(doc.annualPlan ?? false),
    is_group_loaded:    Boolean(doc.isGroupLoaded ?? false),
    is_users_loaded:    Boolean(doc.isUsersLoaded ?? false),
    new_impl:           Boolean(doc.newImpl ?? false),
    notifications_count: Number(doc.notificationsCount ?? 0),
    total_fast_premium_requests: Number(doc.totalFastPremiumRequests ?? 0),
    credential:         doc.credential ? JSON.stringify(doc.credential) : null,
    mongo_class:        doc._class ?? null,
    raw:                JSON.stringify(doc),
    synced_at:          new Date().toISOString(),
  };

  const updateCols = [
    'name','provider_name','idp','status','category','risk_level',
    'is_shadow_it','is_approved','is_via_sso',
    'total_users','active_users','inactive_users','billable_users','idle_users',
    'active_amount','inactive_amount','total_spend_cents',
    'total_included_spend_cents','total_amount',
    'admin_cloud_id','member_id','admin_email','admin_member_id',
    'domain_name','user_id','sso_idp_cloud_id','sso_app_id',
    'deleted','notify','annual_plan','is_group_loaded','is_users_loaded','new_impl',
    'notifications_count','total_fast_premium_requests',
    'credential','mongo_class',
    'raw','synced_at',
  ];

  await bulkUpsert('apps_mirror', [row], ['org_id', 'mongo_id'], updateCols);
}
