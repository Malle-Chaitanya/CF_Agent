import { MongoClient, ChangeStream, Document } from 'mongodb';
import { bulkUpsert, query, saveResumeToken, getResumeToken } from '../db/client';
import { scheduleRestart } from '../utils/retry';

// Collection: common.ShadowAppsDetailsQueue (668 docs in production)
// Fields confirmed from live DB:
//   _id, vendorName, userId, adminCloudId, saasCloudId, adminMemberId,
//   emailId, processStatus (CONFLICT | SUCCESS | PENDING),
//   createdTime, modifiedTime, nextRunDate, groupsCount
// No 'deleted' field — filter by userId
const DB_NAME    = 'common';
const COLLECTION = 'ShadowAppsDetailsQueue';

export async function startShadowITWatcher(
  mongo: MongoClient,
  orgId: string,
  userId: string,
  attempt = 1
): Promise<void> {
  const db  = mongo.db(DB_NAME);
  const col = db.collection(COLLECTION);

  const resumeToken = await getResumeToken(`${COLLECTION}:${orgId}`);
  const options: any = { fullDocument: 'updateLookup' };
  if (resumeToken) options.resumeAfter = resumeToken;

  // No domain field in this collection — filter by userId
  const stream: ChangeStream = col.watch(
    [{ $match: { 'fullDocument.userId': userId } }],
    options
  );

  console.log(`[watcher:shadowIT] ✅ Watching common.ShadowAppsDetailsQueue for userId "${userId}"`);

  stream.on('change', async (event: any) => {
    try {
      if (event.operationType === 'delete') {
        await query(
          `DELETE FROM shadow_it_mirror WHERE org_id = $1 AND mongo_id = $2`,
          [orgId, event.documentKey._id.toString()]
        );
      } else if (event.fullDocument) {
        await upsertShadowIT(event.fullDocument, orgId);
      }
      await saveResumeToken(`${COLLECTION}:${orgId}`, event._id);
    } catch (err: any) {
      console.error('[watcher:shadowIT] change error:', err.message);
    }
  });

  stream.on('error', (err) => {
    console.error(`[watcher:shadowIT] error:`, err.message);
    scheduleRestart('shadowIT', attempt, () => startShadowITWatcher(mongo, orgId, userId, attempt + 1));
  });
}

async function upsertShadowIT(doc: Document, orgId: string): Promise<void> {
  const riskLevel = doc.processStatus === 'CONFLICT' ? 'HIGH'
    : doc.processStatus === 'PENDING'   ? 'MEDIUM'
    : 'LOW';

  const row = {
    mongo_id:           doc._id?.toString(),
    org_id:             orgId,
    app_name:           doc.vendorName ?? 'Unknown',
    category:           null,
    risk_level:         riskLevel,
    user_count:         Number(doc.groupsCount ?? 1),
    oauth_scopes:       [],
    admin_cloud_id:     doc.adminCloudId ?? null,
    admin_member_id:    doc.adminMemberId ?? null,
    saas_cloud_id:      doc.saasCloudId ?? null,
    user_id:            doc.userId?.toString() ?? null,
    email_id:           doc.emailId ?? null,
    process_status:     doc.processStatus ?? null,
    discovered_at:      doc.createdTime ? new Date(doc.createdTime).toISOString() : new Date().toISOString(),
    modified_time:      doc.modifiedTime ? new Date(doc.modifiedTime).toISOString() : null,
    next_run_date:      doc.nextRunDate ? new Date(doc.nextRunDate).toISOString() : null,
    error_description:  doc.errordescription ?? null,
    mongo_class:        doc._class ?? null,
    raw:                JSON.stringify(doc),
    synced_at:          new Date().toISOString(),
  };

  const updateCols = [
    'app_name','category','risk_level','user_count','oauth_scopes',
    'admin_cloud_id','admin_member_id','saas_cloud_id','user_id','email_id',
    'process_status','discovered_at','modified_time','next_run_date',
    'error_description','mongo_class',
    'raw','synced_at',
  ];

  await bulkUpsert('shadow_it_mirror', [row], ['org_id', 'mongo_id'], updateCols);
}
