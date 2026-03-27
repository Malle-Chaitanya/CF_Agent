/**
 * One-time seed script — loads all 6 collections from MongoDB into Neon PostgreSQL.
 * Run ONCE on fresh deployment before starting the sync-worker.
 *
 * Usage:  npm run seed
 */
import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import { bulkUpsert, getPool } from './db/client';

const MONGO_URI = process.env.MONGODB_URI!;
const ORG_ID    = process.env.BOOTSTRAP_ORG_ID ?? 'sacontain';
const USER_ID   = process.env.DEV_USER_ID       ?? '66f3b3391a96742043e475af';
const BATCH     = 500;

function str(id: any) { return id instanceof ObjectId ? id.toHexString() : String(id ?? ''); }

async function main() {
  console.log('\n🌱 CloudFuze Seed — MongoDB → Neon PostgreSQL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const client = new MongoClient(MONGO_URI, { directConnection: true, serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  console.log('✅ MongoDB connected');

  const db = client.db('common');
  const pg = getPool();
  await pg.query('SELECT 1');
  console.log('✅ Neon PostgreSQL connected\n');

  // Clear all mirror tables first
  console.log('🗑  Clearing existing mirror data...');
  for (const t of ['apps_mirror','users_mirror','licenses_mirror','shadow_it_mirror','groups_mirror','spend_mirror']) {
    await pg.query(`DELETE FROM ${t} WHERE org_id = $1`, [ORG_ID]);
  }
  console.log('✅ Cleared\n');

  // ── 1. SaaSVendor → apps_mirror (ALL fields) ────────────────────────────
  process.stdout.write('📦 [1/6] SaaSVendor → apps_mirror... ');
  const vendors = await db.collection('SaaSVendor').find({ domain: ORG_ID, deleted: false }).toArray();
  if (vendors.length) {
    for (let i = 0; i < vendors.length; i += BATCH) {
      await bulkUpsert('apps_mirror', vendors.slice(i, i + BATCH).map(v => ({
        mongo_id:           str(v._id),
        org_id:             ORG_ID,
        name:               v.providerName?.trim() || v.vendor?.trim() || v.idp?.trim() || 'UNKNOWN',
        provider_name:      v.providerName?.trim() || null,
        idp:                v.idp?.trim() || null,
        status:             (v.status || 'ACTIVE').toUpperCase(),
        category:           v.category || null,
        risk_level:         v.riskLevel || 'LOW',
        is_shadow_it:       false,
        is_approved:        true,
        is_via_sso:         Boolean(v.isViaSSO ?? false),
        total_users:        Number(v.usersCount ?? 0),
        active_users:       Number(v.activeUsers ?? 0),
        inactive_users:     Number(v.inActiveUSers ?? v.inactiveUsers ?? 0),
        billable_users:     Number(v.billableUser ?? 0),
        idle_users:         Number(v.idelUserCount ?? v.idleUserCount ?? 0),
        active_amount:      Number(v.activeAmount ?? 0),
        inactive_amount:    Number(v.inActiveAmount ?? 0),
        total_spend_cents:  Number(v.totalSpendCents ?? 0),
        total_included_spend_cents: Number(v.totalIncludedSpendCents ?? 0),
        total_amount:       Number(v.totalAmount ?? 0),
        admin_cloud_id:     str(v._id),
        member_id:          v.memberId || null,
        admin_email:        v.adminEmail || null,
        admin_member_id:    v.adminMemberId || null,
        domain_name:        v.domain || ORG_ID,
        user_id:            v.userId ? str(v.userId) : null,
        sso_idp_cloud_id:   v.ssoIdpCloudId || null,
        sso_app_id:         v.ssoAppId || null,
        deleted:            Boolean(v.deleted ?? false),
        notify:             Boolean(v.notify ?? false),
        annual_plan:        Boolean(v.annualPlan ?? false),
        is_group_loaded:    Boolean(v.isGroupLoaded ?? false),
        is_users_loaded:    Boolean(v.isUsersLoaded ?? false),
        new_impl:           Boolean(v.newImpl ?? false),
        notifications_count: Number(v.notificationsCount ?? 0),
        total_fast_premium_requests: Number(v.totalFastPremiumRequests ?? 0),
        credential:         v.credential ? JSON.stringify(v.credential) : null,
        mongo_class:        v._class || null,
        raw:                JSON.stringify(v),
        synced_at:          new Date().toISOString(),
      })), ['org_id','mongo_id'],
      ['name','provider_name','idp','status','category','risk_level',
       'is_approved','is_via_sso',
       'total_users','active_users','inactive_users','billable_users','idle_users',
       'active_amount','inactive_amount','total_spend_cents',
       'total_included_spend_cents','total_amount',
       'admin_cloud_id','member_id','admin_email','admin_member_id',
       'domain_name','user_id','sso_idp_cloud_id','sso_app_id',
       'deleted','notify','annual_plan','is_group_loaded','is_users_loaded','new_impl',
       'notifications_count','total_fast_premium_requests',
       'credential','mongo_class',
       'raw','synced_at']);
    }
  }
  console.log(`${vendors.length} rows ✅`);

  // ── 2. SaaSUser → users_mirror (ALL fields) ─────────────────────────────
  process.stdout.write('👥 [2/6] SaaSUser → users_mirror (dedup by email)... ');
  const uniqueUsers = await db.collection('SaaSUser').aggregate([
    { $match: { domain: ORG_ID, deleted: false, email: { $exists: true, $not: { $in: [null,''] } } } },
    { $sort: { isActive: -1, createdTime: -1 } },
    { $group: { _id: { $toLower: '$email' }, doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
  ], { allowDiskUse: true }).toArray();
  for (let i = 0; i < uniqueUsers.length; i += BATCH) {
    await bulkUpsert('users_mirror', uniqueUsers.slice(i, i + BATCH).map((u: any) => {
      const email = (u.email || '').toLowerCase().trim();
      return {
        mongo_id: str(u._id), org_id: ORG_ID, email,
        email_id:           u.emailId || null,
        name:               `${u.firstName||''} ${u.lastName||''}`.trim() || email.split('@')[0],
        first_name:         u.firstName || null,
        last_name:          u.lastName || null,
        department:         u.department || null,
        role:               u.role || (u.admin ? 'ADMIN' : 'USER'),
        is_active:          Boolean(u.isActive ?? true),
        is_suspended:       Boolean(u.suspended ?? false),
        is_domain_admin:    Boolean(u.isDomainAdmin ?? u.admin ?? false),
        deleted:            Boolean(u.deleted ?? false),
        guest:              Boolean(u.guest ?? false),
        idle_user:          Boolean(u.idelUser ?? false),
        created:            Boolean(u.created ?? false),
        modified_password:  Boolean(u.modifiedPassword ?? false),
        vendor_admin_cloud_id: u.adminCloudId || null,
        member_id:          u.memberId || null,
        admin_member_id:    u.adminMemberId || null,
        user_id:            u.userId ? str(u.userId) : null,
        vendor:             u.vendor || null,
        total_allocated_size: Number(u.totalAllocatedSize ?? 0),
        used_size:          Number(u.usedSize ?? 0),
        free_size:          Number(u.freeSize ?? 0),
        count:              Number(u.count ?? 0),
        spend_cents:        Number(u.spendCents ?? 0),
        included_spend_cents: Number(u.includedSpendCents ?? 0),
        fast_premium_requests: Number(u.fastPremiumRequests ?? 0),
        inviter_id:         Number(u.inviterId ?? 0),
        permission_profile_id: Number(u.permissionProfileId ?? 0),
        last_sign_in:       u.lastSignInDateTime ? new Date(u.lastSignInDateTime).toISOString() : null,
        created_time:       u.createdTime ? new Date(u.createdTime).toISOString() : null,
        skus:               u.skus ? JSON.stringify(u.skus) : null,
        secondary_group_ids: u.secondaryGroupIds ? JSON.stringify(u.secondaryGroupIds) : null,
        devices:            u.devices ? JSON.stringify(u.devices) : null,
        mongo_class:        u._class || null,
        raw:                JSON.stringify(u),
        synced_at:          new Date().toISOString(),
      };
    }).filter((r: any) => r.email), ['org_id','email'],
    ['mongo_id','email_id','name','first_name','last_name','department','role',
     'is_active','is_suspended','is_domain_admin','deleted','guest','idle_user','created','modified_password',
     'vendor_admin_cloud_id','member_id','admin_member_id','user_id','vendor',
     'total_allocated_size','used_size','free_size',
     'count','spend_cents','included_spend_cents','fast_premium_requests','inviter_id','permission_profile_id',
     'last_sign_in','created_time',
     'skus','secondary_group_ids','devices','mongo_class',
     'raw','synced_at']);
    process.stdout.write(`\r👥 [2/6] SaaSUser → users_mirror... ${Math.min(i+BATCH, uniqueUsers.length)}/${uniqueUsers.length}`);
  }
  console.log(` ${uniqueUsers.length} rows ✅`);

  // ── 3. Subscriptions → licenses_mirror (ALL fields) ─────────────────────
  process.stdout.write('📋 [3/6] Subscriptions → licenses_mirror... ');
  const subs = await db.collection('Subscriptions').find({ domain: ORG_ID, deleted: false }).toArray();
  if (subs.length) {
    for (let i = 0; i < subs.length; i += BATCH) {
      await bulkUpsert('licenses_mirror', subs.slice(i, i + BATCH).map(s => {
        const totalSeats = Number(s.totalLicenceCount ?? 0);
        const usedSeats  = Number(s.assignedLicenceCount ?? 0);
        const cost       = Number(s.purchasedPrise ?? s.costPerUser ?? 0);
        const renewal    = s.expiredDate ?? s.renewalDate ?? null;
        const days       = renewal ? Math.ceil((new Date(renewal).getTime() - Date.now()) / 86400000) : null;
        return {
          mongo_id:           str(s._id),
          org_id:             ORG_ID,
          vendor:             s.vendor || null,
          app_name:           s.externalProviderName?.trim() || s.planName?.trim() || s.vendor || null,
          plan_name:          s.planName ?? null,
          plan_id:            s.planId ?? null,
          external_provider_name: s.externalProviderName?.trim() || null,
          total_seats:        totalSeats,
          used_seats:         usedSeats,
          active_users:       usedSeats,
          inactive_users:     Number(s.availableCount ?? Math.max(0, totalSeats - usedSeats)),
          exact_licence_count: Number(s.exactLicenceCount ?? 0),
          cost_per_seat:      cost,
          purchased_prise:    Number(s.purchasedPrise ?? 0),
          cost_per_user:      Number(s.costPerUser ?? 0),
          total_cost:         cost * totalSeats,
          annual_cost:        s.annualCost ?? cost * totalSeats * 12,
          saving_cost:        Number(s.savingCost ?? 0),
          renewal_date:       renewal,
          auto_renew:         Boolean(s.autoRenew ?? false),
          status:             days !== null && days <= 0 ? 'EXPIRED' : days !== null && days <= 30 ? 'EXPIRING_SOON' : 'ACTIVE',
          days_until_renewal: days,
          utilization_pct:    totalSeats > 0 ? Number(((usedSeats / totalSeats) * 100).toFixed(2)) : 0,
          admin_cloud_id:     str(s.adminCloudId) || null,
          user_id:            s.userId ? str(s.userId) : null,
          admin_member_id:    s.adminMemberId || null,
          licence_details_id: s.licenceDetailsId || null,
          object_id:          s.objectId ? str(s.objectId) : null,
          domain:             s.domain || null,
          deleted:            Boolean(s.deleted ?? false),
          update_saving_cost: Boolean(s.updateSavingCost ?? false),
          cost_updated:       Boolean(s.costUpdated ?? false),
          yearly_subscription: Boolean(s.yearlySubscription ?? false),
          email_sent:         Boolean(s.emailSent ?? false),
          manual_entry:       Boolean(s.manualEntry ?? false),
          process_status:     s.processStatus || null,
          created_time:       s.createdTime ? new Date(s.createdTime).toISOString() : null,
          mongo_class:        s._class || null,
          raw:                JSON.stringify(s),
          synced_at:          new Date().toISOString(),
        };
      }), ['org_id','mongo_id'],
      ['vendor','app_name','plan_name','plan_id','external_provider_name',
       'total_seats','used_seats','active_users','inactive_users','exact_licence_count',
       'cost_per_seat','purchased_prise','cost_per_user','total_cost','annual_cost','saving_cost',
       'renewal_date','auto_renew','status','days_until_renewal','utilization_pct',
       'admin_cloud_id','user_id','admin_member_id','licence_details_id','object_id','domain',
       'deleted','update_saving_cost','cost_updated','yearly_subscription','email_sent','manual_entry',
       'process_status','created_time','mongo_class',
       'raw','synced_at']);
    }
  }
  console.log(`${subs.length} rows ✅`);

  // ── 4. ShadowAppsDetailsQueue → shadow_it_mirror (ALL fields) ───────────
  process.stdout.write('👁  [4/6] ShadowAppsDetailsQueue → shadow_it_mirror... ');
  const shadow = await db.collection('ShadowAppsDetailsQueue').find({ userId: USER_ID }).toArray();
  if (shadow.length) {
    await pg.query(`DELETE FROM shadow_it_mirror WHERE org_id = $1`, [ORG_ID]);
    for (let i = 0; i < shadow.length; i += BATCH) {
      await bulkUpsert('shadow_it_mirror', shadow.slice(i, i + BATCH).map(s => ({
        mongo_id:           str(s._id),
        org_id:             ORG_ID,
        app_name:           s.vendorName || 'Unknown',
        category:           null,
        risk_level:         s.processStatus === 'CONFLICT' ? 'HIGH' : s.processStatus === 'PENDING' ? 'MEDIUM' : 'LOW',
        user_count:         Number(s.groupsCount ?? 1),
        oauth_scopes:       [],
        admin_cloud_id:     s.adminCloudId || null,
        admin_member_id:    s.adminMemberId || null,
        saas_cloud_id:      s.saasCloudId || null,
        user_id:            s.userId ? str(s.userId) : null,
        email_id:           s.emailId || null,
        process_status:     s.processStatus || null,
        discovered_at:      s.createdTime ? new Date(s.createdTime).toISOString() : new Date().toISOString(),
        modified_time:      s.modifiedTime ? new Date(s.modifiedTime).toISOString() : null,
        next_run_date:      s.nextRunDate ? new Date(s.nextRunDate).toISOString() : null,
        error_description:  s.errordescription || null,
        mongo_class:        s._class || null,
        raw:                JSON.stringify(s),
        synced_at:          new Date().toISOString(),
      })), ['org_id','mongo_id'],
      ['app_name','category','risk_level','user_count','oauth_scopes',
       'admin_cloud_id','admin_member_id','saas_cloud_id','user_id','email_id',
       'process_status','discovered_at','modified_time','next_run_date',
       'error_description','mongo_class',
       'raw','synced_at']);
    }
  }
  console.log(`${shadow.length} rows ✅`);

  // ── 5. CFGroup → groups_mirror (ALL fields) ──────────────────────────────
  process.stdout.write('🏢 [5/6] CFGroup → groups_mirror (membersCount > 0)... ');
  const groups = await db.collection('CFGroup').find({ userId: USER_ID, membersCount: { $gt: 0 } }).toArray();
  if (groups.length) {
    for (let i = 0; i < groups.length; i += BATCH) {
      await bulkUpsert('groups_mirror', groups.slice(i, i + BATCH).map(g => ({
        mongo_id:           str(g._id),
        org_id:             ORG_ID,
        vendor:             g.vendor || null,
        app_name:           g.appName || g.vendor || null,
        display_name:       g.displayName || g.appName || null,
        description:        g.description || null,
        members_count:      Number(g.membersCount ?? 0),
        count:              Number(g.count ?? 0),
        app_id:             g.appId || null,
        admin_member_id:    g.adminMemberId || null,
        user_id:            g.userId ? str(g.userId) : null,
        permissions_group:  Boolean(g.permissionsGroup ?? false),
        private_group:      Boolean(g.privateGroup ?? false),
        teams_channel:      Boolean(g.teamsChannel ?? false),
        security_enabled:   Boolean(g.securityEnabled ?? false),
        is_group:           Boolean(g.isGroup ?? false),
        is_active:          Boolean(g.isActive ?? false),
        disabled:           Boolean(g.disabled ?? false),
        mail_enabled:       Boolean(g.mailEnabled ?? false),
        created_time:       g.createdTime ? new Date(g.createdTime).toISOString() : null,
        mongo_class:        g._class || null,
        raw:                JSON.stringify(g),
        synced_at:          new Date().toISOString(),
      })), ['org_id','mongo_id'],
      ['vendor','app_name','display_name','description','members_count','count',
       'app_id','admin_member_id','user_id',
       'permissions_group','private_group','teams_channel','security_enabled','is_group','is_active','disabled','mail_enabled',
       'created_time','mongo_class',
       'raw','synced_at']);
      process.stdout.write(`\r🏢 [5/6] CFGroup → groups_mirror... ${Math.min(i+BATCH, groups.length)}/${groups.length}`);
    }
  }
  console.log(` ${groups.length} rows ✅`);

  // ── 6. UserFinancialMetrics → spend_mirror (ALL fields) ──────────────────
  process.stdout.write('💰 [6/6] UserFinancialMetrics → spend_mirror... ');
  const spend = await db.collection('UserFinancialMetrics').find({ domain: ORG_ID }).toArray();
  if (spend.length) {
    for (let i = 0; i < spend.length; i += BATCH) {
      await bulkUpsert('spend_mirror', spend.slice(i, i + BATCH).map(m => ({
        mongo_id:           str(m._id),
        org_id:             ORG_ID,
        vendor:             m.vendorName || null,
        app_name:           m.vendorName || null,
        total_users:        Number(m.totalUserCount ?? 0),
        active_users:       Number(m.activeUserCount ?? 0),
        inactive_users:     Number(m.inactiveUserCount ?? 0),
        idle_user_count:    Number(m.idleUserCount ?? 0),
        billable_user_count: Number(m.billableUserCount ?? 0),
        total_license:      Number(m.totalLicense ?? 0),
        cost_per_license:   Number(m.costPerLicense ?? 0),
        total_spend:        Number(m.totalCost ?? 0),
        potential_saving:   Number(m.potentialCostSaving ?? 0),
        period_key:         m.lastUpdated
          ? new Date(m.lastUpdated).toISOString().slice(0, 7)
          : new Date().toISOString().slice(0, 7),
        department:         null,
        admin_cloud_id:     str(m.adminCloudId) || null,
        user_id:            m.userId ? str(m.userId) : null,
        member_id:          m.memberId || null,
        vendor_status_update: Boolean(m.vendorStatusUpdate ?? false),
        retry_count:        Number(m.retryCount ?? 0),
        last_updated:       m.lastUpdated ? new Date(m.lastUpdated).toISOString() : null,
        next_run_date:      m.nextRunDate ? new Date(m.nextRunDate).toISOString() : null,
        expiry_date_map:    m.expiryDateMap ? JSON.stringify(m.expiryDateMap) : null,
        process_status:     m.processStatus || null,
        domain:             m.domain || null,
        mongo_class:        m._class || null,
        raw:                JSON.stringify(m),
        synced_at:          new Date().toISOString(),
      })), ['org_id','mongo_id'],
      ['vendor','app_name','total_users','active_users','inactive_users',
       'idle_user_count','billable_user_count','total_license',
       'cost_per_license','total_spend','potential_saving','period_key',
       'admin_cloud_id','user_id','member_id',
       'vendor_status_update','retry_count',
       'last_updated','next_run_date','expiry_date_map',
       'process_status','domain','mongo_class',
       'raw','synced_at']);
    }
  }
  console.log(`${spend.length} rows ✅`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Seed complete! Neon PostgreSQL populated.\n');
  console.log('Next: npm run dev  (starts Change Stream watchers)\n');

  await client.close();
  await pg.end();
}

main().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
