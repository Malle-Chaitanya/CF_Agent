import { MongoClient, ChangeStream, Document } from 'mongodb';
import { bulkUpsert, query, saveResumeToken, getResumeToken } from '../db/client';
import { scheduleRestart } from '../utils/retry';

// Real collection: common.UserFinancialMetrics (144 docs in production)
// Fields confirmed: _id, activeUserCount, inactiveUserCount, idleUserCount,
// billableUserCount, totalUserCount, totalLicense, totalCost, costPerLicense,
// potentialCostSaving, userId, vendorName, adminCloudId, memberId,
// lastUpdated, domain
const DB_NAME = 'common';
const COLLECTION = 'UserFinancialMetrics';

export async function startSpendWatcher(
  mongo: MongoClient,
  orgId: string,
  attempt = 1
): Promise<void> {
  const db = mongo.db(DB_NAME);
  const col = db.collection(COLLECTION);

  const resumeToken = await getResumeToken(`${COLLECTION}:${orgId}`);
  const options: any = { fullDocument: 'updateLookup' };
  if (resumeToken) options.resumeAfter = resumeToken;

  // UserFinancialMetrics uses 'domain' field for org isolation
  const stream: ChangeStream = col.watch(
    [{ $match: { 'fullDocument.domain': orgId } }],
    options
  );

  console.log(`[watcher:spend] ✅ Watching common.UserFinancialMetrics for org "${orgId}"`);

  stream.on('change', async (event: any) => {
    try {
      if (event.operationType === 'delete') {
        await query(
          `DELETE FROM spend_mirror WHERE org_id = $1 AND mongo_id = $2`,
          [orgId, event.documentKey._id.toString()]
        );
      } else if (event.fullDocument) {
        await upsertSpend(event.fullDocument, orgId);
      }
      await saveResumeToken(`${COLLECTION}:${orgId}`, event._id);
    } catch (err: any) {
      console.error('[watcher:spend] change error:', err.message);
    }
  });

  stream.on('error', (err) => {
    console.error(`[watcher:spend] error:`, err.message);
    scheduleRestart('spend', attempt, () => startSpendWatcher(mongo, orgId, attempt + 1));
  });
}

async function upsertSpend(doc: Document, orgId: string): Promise<void> {
  const row = {
    mongo_id:           doc._id?.toString(),
    org_id:             orgId,
    vendor:             doc.vendorName ?? '',
    app_name:           doc.vendorName ?? '',
    total_users:        Number(doc.totalUserCount ?? 0),
    active_users:       Number(doc.activeUserCount ?? 0),
    inactive_users:     Number(doc.inactiveUserCount ?? 0),
    idle_user_count:    Number(doc.idleUserCount ?? 0),
    billable_user_count: Number(doc.billableUserCount ?? 0),
    total_license:      Number(doc.totalLicense ?? 0),
    cost_per_license:   Number(doc.costPerLicense ?? 0),
    total_spend:        Number(doc.totalCost ?? 0),
    potential_saving:   Number(doc.potentialCostSaving ?? 0),
    period_key:         doc.lastUpdated
      ? new Date(doc.lastUpdated).toISOString().slice(0, 7)
      : new Date().toISOString().slice(0, 7),
    department:         null,
    admin_cloud_id:     doc.adminCloudId ?? null,
    user_id:            doc.userId?.toString() ?? null,
    member_id:          doc.memberId ?? null,
    vendor_status_update: Boolean(doc.vendorStatusUpdate ?? false),
    retry_count:        Number(doc.retryCount ?? 0),
    last_updated:       doc.lastUpdated ? new Date(doc.lastUpdated).toISOString() : null,
    next_run_date:      doc.nextRunDate ? new Date(doc.nextRunDate).toISOString() : null,
    expiry_date_map:    doc.expiryDateMap ? JSON.stringify(doc.expiryDateMap) : null,
    process_status:     doc.processStatus ?? null,
    domain:             doc.domain ?? null,
    mongo_class:        doc._class ?? null,
    raw:                JSON.stringify(doc),
    synced_at:          new Date().toISOString(),
  };

  const updateCols = [
    'vendor','app_name','total_users','active_users','inactive_users',
    'idle_user_count','billable_user_count','total_license',
    'cost_per_license','total_spend','potential_saving','period_key',
    'admin_cloud_id','user_id','member_id',
    'vendor_status_update','retry_count',
    'last_updated','next_run_date','expiry_date_map',
    'process_status','domain','mongo_class',
    'raw','synced_at',
  ];

  await bulkUpsert('spend_mirror', [row], ['org_id', 'mongo_id'], updateCols);
}
