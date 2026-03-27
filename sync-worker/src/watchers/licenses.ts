import { MongoClient, ChangeStream, Document } from 'mongodb';
import { bulkUpsert, query, saveResumeToken, getResumeToken } from '../db/client';
import { scheduleRestart } from '../utils/retry';

// Real collection: common.Subscriptions (1,867 docs in production)
// Fields confirmed: _id, planId, userId, adminMemberId, vendor, deleted,
// purchasedPrise (typo in DB), adminCloudId, totalLicenceCount,
// assignedLicenceCount, availableCount, processStatus, domain
const DB_NAME = 'common';
const COLLECTION = 'Subscriptions';

export async function startLicensesWatcher(
  mongo: MongoClient,
  orgId: string,
  attempt = 1
): Promise<void> {
  const db = mongo.db(DB_NAME);
  const col = db.collection(COLLECTION);

  const resumeToken = await getResumeToken(`${COLLECTION}:${orgId}`);
  const options: any = { fullDocument: 'updateLookup' };
  if (resumeToken) options.resumeAfter = resumeToken;

  // Subscriptions uses 'domain' field for org isolation
  const stream: ChangeStream = col.watch(
    [{ $match: { 'fullDocument.domain': orgId } }],
    options
  );

  console.log(`[watcher:licenses] ✅ Watching common.Subscriptions for org "${orgId}"`);

  stream.on('change', async (event: any) => {
    try {
      if (event.operationType === 'delete') {
        await query(
          `DELETE FROM licenses_mirror WHERE org_id = $1 AND mongo_id = $2`,
          [orgId, event.documentKey._id.toString()]
        );
      } else if (event.fullDocument) {
        await upsertLicense(event.fullDocument, orgId);
      }
      await saveResumeToken(`${COLLECTION}:${orgId}`, event._id);
    } catch (err: any) {
      console.error('[watcher:licenses] change error:', err.message);
    }
  });

  stream.on('error', (err) => {
    console.error(`[watcher:licenses] error:`, err.message);
    scheduleRestart('licenses', attempt, () => startLicensesWatcher(mongo, orgId, attempt + 1));
  });
}

async function upsertLicense(doc: Document, orgId: string): Promise<void> {
  const totalSeats  = Number(doc.totalLicenceCount ?? doc.noofUsers ?? 0);
  const usedSeats   = Number(doc.assignedLicenceCount ?? 0);
  const freeSeat    = Number(doc.availableCount ?? Math.max(0, totalSeats - usedSeats));
  const costPerSeat = Number(doc.purchasedPrise ?? doc.costPerUser ?? doc.amount ?? 0);
  const totalCost   = costPerSeat * totalSeats;
  const renewalDate = doc.expiredDate ?? doc.renewalDate ?? doc.expirationDate ?? null;

  let daysUntilRenewal: number | null = null;
  if (renewalDate) {
    daysUntilRenewal = Math.ceil((new Date(renewalDate).getTime() - Date.now()) / 86_400_000);
  }
  const status = daysUntilRenewal !== null && daysUntilRenewal <= 0
    ? 'EXPIRED'
    : daysUntilRenewal !== null && daysUntilRenewal <= 30
    ? 'EXPIRING_SOON'
    : 'ACTIVE';

  const appName = doc.externalProviderName?.trim() || doc.planName?.trim() || doc.vendor || null;

  const row = {
    mongo_id:           doc._id?.toString(),
    org_id:             orgId,
    vendor:             doc.vendor ?? null,
    app_name:           appName,
    plan_name:          doc.planName ?? null,
    plan_id:            doc.planId ?? null,
    external_provider_name: doc.externalProviderName?.trim() || null,
    total_seats:        totalSeats,
    used_seats:         usedSeats,
    active_users:       usedSeats,
    inactive_users:     freeSeat,
    exact_licence_count: Number(doc.exactLicenceCount ?? 0),
    cost_per_seat:      costPerSeat,
    purchased_prise:    Number(doc.purchasedPrise ?? 0),
    cost_per_user:      Number(doc.costPerUser ?? 0),
    total_cost:         totalCost,
    annual_cost:        doc.annualCost ?? totalCost * 12,
    saving_cost:        Number(doc.savingCost ?? 0),
    renewal_date:       renewalDate,
    auto_renew:         Boolean(doc.autoRenew ?? false),
    status,
    days_until_renewal: daysUntilRenewal,
    utilization_pct:    totalSeats > 0 ? Number(((usedSeats / totalSeats) * 100).toFixed(2)) : 0,
    admin_cloud_id:     doc.adminCloudId?.toString() ?? null,
    user_id:            doc.userId?.toString() ?? null,
    admin_member_id:    doc.adminMemberId ?? null,
    licence_details_id: doc.licenceDetailsId ?? null,
    object_id:          doc.objectId?.toString() ?? null,
    domain:             doc.domain ?? null,
    deleted:            Boolean(doc.deleted ?? false),
    update_saving_cost: Boolean(doc.updateSavingCost ?? false),
    cost_updated:       Boolean(doc.costUpdated ?? false),
    yearly_subscription: Boolean(doc.yearlySubscription ?? false),
    email_sent:         Boolean(doc.emailSent ?? false),
    manual_entry:       Boolean(doc.manualEntry ?? false),
    process_status:     doc.processStatus ?? null,
    created_time:       doc.createdTime ? new Date(doc.createdTime).toISOString() : null,
    mongo_class:        doc._class ?? null,
    raw:                JSON.stringify(doc),
    synced_at:          new Date().toISOString(),
  };

  const updateCols = [
    'vendor','app_name','plan_name','plan_id','external_provider_name',
    'total_seats','used_seats','active_users','inactive_users','exact_licence_count',
    'cost_per_seat','purchased_prise','cost_per_user','total_cost','annual_cost','saving_cost',
    'renewal_date','auto_renew','status','days_until_renewal','utilization_pct',
    'admin_cloud_id','user_id','admin_member_id','licence_details_id','object_id','domain',
    'deleted','update_saving_cost','cost_updated','yearly_subscription','email_sent','manual_entry',
    'process_status','created_time','mongo_class',
    'raw','synced_at',
  ];

  await bulkUpsert('licenses_mirror', [row], ['org_id', 'mongo_id'], updateCols);
}
