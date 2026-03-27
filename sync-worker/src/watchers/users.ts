import { MongoClient, ChangeStream, Document } from 'mongodb';
import { bulkUpsert, query, saveResumeToken, getResumeToken } from '../db/client';
import { scheduleRestart } from '../utils/retry';

// Real collection: common.SaaSUser (29,402 docs in production)
// Fields confirmed: _id, firstName, email, emailId, memberId, adminMemberId,
// isActive, userId, vendor, adminCloudId, domain, admin, deleted
const DB_NAME = 'common';
const COLLECTION = 'SaaSUser';

export async function startUsersWatcher(
  mongo: MongoClient,
  orgId: string,
  attempt = 1
): Promise<void> {
  const db = mongo.db(DB_NAME);
  const col = db.collection(COLLECTION);

  const resumeToken = await getResumeToken(`${COLLECTION}:${orgId}`);
  const options: any = { fullDocument: 'updateLookup' };
  if (resumeToken) options.resumeAfter = resumeToken;

  // Filter by domain + skip deleted users
  const stream: ChangeStream = col.watch(
    [{ $match: { 'fullDocument.domain': orgId, 'fullDocument.deleted': { $ne: true } } }],
    options
  );

  console.log(`[watcher:users] ✅ Watching common.SaaSUser for org "${orgId}"`);

  stream.on('change', async (event: any) => {
    try {
      if (event.operationType === 'delete') {
        await query(
          `DELETE FROM users_mirror WHERE org_id = $1 AND mongo_id = $2`,
          [orgId, event.documentKey._id.toString()]
        );
      } else if (event.fullDocument) {
        await upsertUser(event.fullDocument, orgId);
      }
      await saveResumeToken(`${COLLECTION}:${orgId}`, event._id);
    } catch (err: any) {
      console.error('[watcher:users] change error:', err.message);
    }
  });

  stream.on('error', (err) => {
    console.error(`[watcher:users] error:`, err.message);
    scheduleRestart('users', attempt, () => startUsersWatcher(mongo, orgId, attempt + 1));
  });
}

async function upsertUser(doc: Document, orgId: string): Promise<void> {
  const email = doc.email ?? doc.emailId;
  if (!email) return;

  const row = {
    mongo_id:           doc._id?.toString(),
    org_id:             orgId,
    email,
    email_id:           doc.emailId ?? null,
    name:               doc.firstName ?? doc.name ?? email,
    first_name:         doc.firstName ?? null,
    last_name:          doc.lastName ?? null,
    department:         doc.department ?? null,
    role:               doc.role ?? (doc.admin ? 'ADMIN' : 'USER'),
    is_active:          Boolean(doc.isActive ?? true),
    is_suspended:       Boolean(doc.suspended ?? false),
    is_domain_admin:    Boolean(doc.isDomainAdmin ?? doc.admin ?? false),
    deleted:            Boolean(doc.deleted ?? false),
    guest:              Boolean(doc.guest ?? false),
    idle_user:          Boolean(doc.idelUser ?? false),
    created:            Boolean(doc.created ?? false),
    modified_password:  Boolean(doc.modifiedPassword ?? false),
    vendor_admin_cloud_id: doc.adminCloudId ?? null,
    member_id:          doc.memberId ?? null,
    admin_member_id:    doc.adminMemberId ?? null,
    user_id:            doc.userId?.toString() ?? null,
    vendor:             doc.vendor ?? null,
    total_allocated_size: Number(doc.totalAllocatedSize ?? 0),
    used_size:          Number(doc.usedSize ?? 0),
    free_size:          Number(doc.freeSize ?? 0),
    count:              Number(doc.count ?? 0),
    spend_cents:        Number(doc.spendCents ?? 0),
    included_spend_cents: Number(doc.includedSpendCents ?? 0),
    fast_premium_requests: Number(doc.fastPremiumRequests ?? 0),
    inviter_id:         Number(doc.inviterId ?? 0),
    permission_profile_id: Number(doc.permissionProfileId ?? 0),
    last_sign_in:       doc.lastSignInDateTime ? new Date(doc.lastSignInDateTime).toISOString() : null,
    created_time:       doc.createdTime ? new Date(doc.createdTime).toISOString() : null,
    skus:               doc.skus ? JSON.stringify(doc.skus) : null,
    secondary_group_ids: doc.secondaryGroupIds ? JSON.stringify(doc.secondaryGroupIds) : null,
    devices:            doc.devices ? JSON.stringify(doc.devices) : null,
    mongo_class:        doc._class ?? null,
    raw:                JSON.stringify(doc),
    synced_at:          new Date().toISOString(),
  };

  const updateCols = [
    'email_id','name','first_name','last_name','department','role',
    'is_active','is_suspended','is_domain_admin','deleted','guest','idle_user','created','modified_password',
    'vendor_admin_cloud_id','member_id','admin_member_id','user_id','vendor',
    'total_allocated_size','used_size','free_size',
    'count','spend_cents','included_spend_cents','fast_premium_requests','inviter_id','permission_profile_id',
    'last_sign_in','created_time',
    'skus','secondary_group_ids','devices','mongo_class',
    'raw','synced_at',
  ];

  await bulkUpsert('users_mirror', [row], ['org_id', 'email'], updateCols);
}
