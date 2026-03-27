-- ============================================================
-- CloudFuze Manage AI Agent — PostgreSQL Schema
-- Mirror tables (populated by sync-worker) + Agent-owned tables
-- ============================================================

-- Enable pgvector extension (for Phase 2 semantic memory)
-- pgvector for Phase 2 semantic memory (enable if available)
CREATE EXTENSION IF NOT EXISTS vector;
-- uuid-ossp not needed on Neon — gen_random_uuid() is built-in

-- ============================================================
-- MIRROR TABLES — populated by sync-worker, read by agent tools
-- ============================================================

CREATE TABLE IF NOT EXISTS apps_mirror (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id        TEXT NOT NULL,
  org_id          TEXT NOT NULL,
  -- Identity
  name            TEXT,             -- display name (providerName → vendor → idp fallback)
  provider_name   TEXT,             -- providerName
  idp             TEXT,             -- e.g. "ENTRA_SSO", "GOOGLE_WORKSPACE"
  -- Status
  status          TEXT,             -- 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  category        TEXT,
  risk_level      TEXT,             -- 'HIGH' | 'MEDIUM' | 'LOW'
  is_shadow_it    BOOLEAN DEFAULT false,
  is_approved     BOOLEAN DEFAULT true,
  is_via_sso      BOOLEAN DEFAULT false,  -- isViaSSO
  -- User counts
  total_users     INT DEFAULT 0,          -- usersCount
  active_users    INT DEFAULT 0,          -- activeUsers
  inactive_users  INT DEFAULT 0,          -- inActiveUSers (typo in Mongo)
  billable_users  INT DEFAULT 0,          -- billableUser
  idle_users      INT DEFAULT 0,          -- idelUserCount (typo in Mongo)
  -- Spend
  active_amount   NUMERIC(14,2) DEFAULT 0,         -- activeAmount
  inactive_amount NUMERIC(14,2) DEFAULT 0,         -- inActiveAmount
  total_spend_cents       BIGINT DEFAULT 0,        -- totalSpendCents
  total_included_spend_cents BIGINT DEFAULT 0,     -- totalIncludedSpendCents
  total_amount            BIGINT DEFAULT 0,        -- totalAmount
  -- Identifiers
  admin_cloud_id  TEXT,
  member_id       TEXT,              -- memberId
  admin_email     TEXT,              -- adminEmail
  admin_member_id TEXT,              -- adminMemberId
  domain_name     TEXT,              -- domain
  user_id         TEXT,              -- userId (owner of the vendor record)
  sso_idp_cloud_id TEXT,             -- ssoIdpCloudId
  sso_app_id      TEXT,              -- ssoAppId
  -- Flags
  deleted         BOOLEAN DEFAULT false,   -- deleted
  notify          BOOLEAN DEFAULT false,   -- notify
  annual_plan     BOOLEAN DEFAULT false,   -- annualPlan
  is_group_loaded BOOLEAN DEFAULT false,   -- isGroupLoaded
  is_users_loaded BOOLEAN DEFAULT false,   -- isUsersLoaded
  new_impl        BOOLEAN DEFAULT false,   -- newImpl
  -- Counters
  notifications_count     BIGINT DEFAULT 0,        -- notificationsCount
  total_fast_premium_requests BIGINT DEFAULT 0,     -- totalFastPremiumRequests
  -- Metadata
  credential      JSONB,             -- credential (DBRef in Mongo)
  mongo_class     TEXT,              -- _class
  -- Raw + audit
  raw             JSONB,
  synced_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, mongo_id)
);

CREATE TABLE IF NOT EXISTS users_mirror (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id      TEXT NOT NULL,
  org_id        TEXT NOT NULL,
  -- Identity
  email         TEXT,              -- email
  email_id      TEXT,              -- emailId (alternate email field)
  name          TEXT,              -- derived: firstName + lastName
  first_name    TEXT,              -- firstName
  last_name     TEXT,              -- lastName
  department    TEXT,              -- department
  role          TEXT,              -- role (e.g. "SUPER_ADMIN")
  -- Status flags
  is_active     BOOLEAN DEFAULT true,    -- isActive
  is_suspended  BOOLEAN DEFAULT false,   -- derived from deleted/suspended
  is_domain_admin BOOLEAN DEFAULT false, -- admin
  deleted       BOOLEAN DEFAULT false,   -- deleted
  guest         BOOLEAN DEFAULT false,   -- guest
  idle_user     BOOLEAN DEFAULT false,   -- idelUser (typo in Mongo)
  created       BOOLEAN DEFAULT false,   -- created
  modified_password BOOLEAN DEFAULT false, -- modifiedPassword
  -- Identifiers
  vendor_admin_cloud_id TEXT,      -- adminCloudId
  member_id     TEXT,              -- memberId
  admin_member_id TEXT,            -- adminMemberId
  user_id       TEXT,              -- userId (owner)
  vendor        TEXT,              -- vendor (e.g. "GOOGLE_WORKSPACE")
  -- Storage sizes
  total_allocated_size BIGINT DEFAULT 0,  -- totalAllocatedSize
  used_size     BIGINT DEFAULT 0,         -- usedSize
  free_size     BIGINT DEFAULT 0,         -- freeSize
  -- Counters
  count         BIGINT DEFAULT 0,         -- count
  spend_cents   BIGINT DEFAULT 0,         -- spendCents
  included_spend_cents BIGINT DEFAULT 0,  -- includedSpendCents
  fast_premium_requests BIGINT DEFAULT 0, -- fastPremiumRequests
  inviter_id    BIGINT DEFAULT 0,         -- inviterId
  permission_profile_id BIGINT DEFAULT 0, -- permissionProfileId
  -- Timestamps
  last_sign_in  TIMESTAMPTZ,       -- lastSignInDateTime
  created_time  TIMESTAMPTZ,       -- createdTime
  -- Arrays / complex
  skus          JSONB,             -- skus (array)
  secondary_group_ids JSONB,       -- secondaryGroupIds (array)
  devices       JSONB,             -- devices (array)
  -- Metadata
  mongo_class   TEXT,              -- _class
  -- Raw + audit
  raw           JSONB,
  synced_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE TABLE IF NOT EXISTS licenses_mirror (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id        TEXT NOT NULL,
  org_id          TEXT NOT NULL,
  -- Identity
  vendor          TEXT,              -- vendor
  app_name        TEXT,              -- derived: externalProviderName || planName || vendor
  plan_name       TEXT,              -- planName
  plan_id         TEXT,              -- planId
  external_provider_name TEXT,       -- externalProviderName
  -- Seat counts
  total_seats     INT DEFAULT 0,     -- totalLicenceCount
  used_seats      INT DEFAULT 0,     -- assignedLicenceCount
  active_users    INT DEFAULT 0,     -- derived (= used_seats)
  inactive_users  INT DEFAULT 0,     -- availableCount
  exact_licence_count NUMERIC(14,2) DEFAULT 0, -- exactLicenceCount
  -- Cost
  cost_per_seat   NUMERIC(12,2),     -- derived from purchasedPrise
  purchased_prise NUMERIC(12,2),     -- purchasedPrise (raw, typo in Mongo)
  cost_per_user   NUMERIC(12,2),     -- costPerUser
  total_cost      NUMERIC(12,2),     -- derived
  annual_cost     NUMERIC(12,2),     -- annualCost
  saving_cost     NUMERIC(12,2),     -- savingCost
  -- Renewal
  renewal_date    DATE,              -- expiredDate / renewalDate
  auto_renew      BOOLEAN DEFAULT false, -- autoRenew
  status          TEXT,              -- derived: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED'
  days_until_renewal INT,            -- derived
  utilization_pct NUMERIC(5,2),      -- derived
  -- Identifiers
  admin_cloud_id  TEXT,              -- adminCloudId
  user_id         TEXT,              -- userId
  admin_member_id TEXT,              -- adminMemberId
  licence_details_id TEXT,           -- licenceDetailsId
  object_id       TEXT,              -- objectId
  domain          TEXT,              -- domain
  -- Flags
  deleted         BOOLEAN DEFAULT false,       -- deleted
  update_saving_cost BOOLEAN DEFAULT false,    -- updateSavingCost
  cost_updated    BOOLEAN DEFAULT false,       -- costUpdated
  yearly_subscription BOOLEAN DEFAULT false,   -- yearlySubscription
  email_sent      BOOLEAN DEFAULT false,       -- emailSent
  manual_entry    BOOLEAN DEFAULT false,       -- manualEntry
  -- Status
  process_status  TEXT,              -- processStatus
  -- Timestamps
  created_time    TIMESTAMPTZ,       -- createdTime
  -- Metadata
  mongo_class     TEXT,              -- _class
  -- Raw + audit
  raw             JSONB,
  synced_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, mongo_id)
);

CREATE TABLE IF NOT EXISTS spend_mirror (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id        TEXT NOT NULL,
  org_id          TEXT NOT NULL,
  -- Identity
  vendor          TEXT,              -- vendorName
  app_name        TEXT,              -- derived (= vendorName)
  -- User counts
  total_users     INT DEFAULT 0,     -- totalUserCount
  active_users    INT DEFAULT 0,     -- activeUserCount
  inactive_users  INT DEFAULT 0,     -- inactiveUserCount
  idle_user_count INT DEFAULT 0,     -- idleUserCount
  billable_user_count INT DEFAULT 0, -- billableUserCount
  -- Cost / licenses
  total_license   INT DEFAULT 0,     -- totalLicense
  cost_per_license NUMERIC(12,2),    -- costPerLicense
  total_spend     NUMERIC(12,2),     -- totalCost
  potential_saving NUMERIC(12,2),    -- potentialCostSaving
  period_key      TEXT,              -- derived from lastUpdated: 'YYYY-MM'
  department      TEXT,
  -- Identifiers
  admin_cloud_id  TEXT,              -- adminCloudId
  user_id         TEXT,              -- userId
  member_id       TEXT,              -- memberId
  -- Flags
  vendor_status_update BOOLEAN DEFAULT false, -- vendorStatusUpdate
  -- Counters
  retry_count     INT DEFAULT 0,     -- retryCount
  -- Timestamps
  last_updated    TIMESTAMPTZ,       -- lastUpdated
  next_run_date   TIMESTAMPTZ,       -- nextRunDate
  -- Complex objects
  expiry_date_map JSONB,             -- expiryDateMap
  -- Status
  process_status  TEXT,              -- processStatus
  domain          TEXT,              -- domain
  -- Metadata
  mongo_class     TEXT,              -- _class
  -- Raw + audit
  raw             JSONB,
  synced_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, mongo_id)
);

CREATE TABLE IF NOT EXISTS shadow_it_mirror (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id      TEXT NOT NULL,
  org_id        TEXT NOT NULL,
  -- Identity
  app_name      TEXT,              -- vendorName
  category      TEXT,
  risk_level    TEXT,              -- derived from processStatus: 'HIGH' | 'MEDIUM' | 'LOW'
  user_count    INT DEFAULT 0,     -- groupsCount
  oauth_scopes  TEXT[],
  -- Identifiers
  admin_cloud_id  TEXT,            -- adminCloudId
  admin_member_id TEXT,            -- adminMemberId
  saas_cloud_id   TEXT,            -- saasCloudId
  user_id         TEXT,            -- userId
  email_id        TEXT,            -- emailId
  -- Status
  process_status  TEXT,            -- processStatus (CONFLICT | SUCCESS | PENDING)
  -- Timestamps
  discovered_at   TIMESTAMPTZ,     -- createdTime
  modified_time   TIMESTAMPTZ,     -- modifiedTime
  next_run_date   TIMESTAMPTZ,     -- nextRunDate
  -- Error info
  error_description TEXT,          -- errordescription
  -- Metadata
  mongo_class     TEXT,            -- _class
  -- Raw + audit
  raw           JSONB,
  synced_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, mongo_id)
);

CREATE TABLE IF NOT EXISTS contracts_mirror (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id        TEXT NOT NULL,
  org_id        TEXT NOT NULL,
  vendor          TEXT,
  app_name        TEXT,
  contract_value  NUMERIC(12,2),
  renewal_date    DATE,
  auto_renew      BOOLEAN DEFAULT false,
  status          TEXT,
  days_until_renewal INT,
  admin_cloud_id  TEXT,
  raw             JSONB,
  synced_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, mongo_id)
);

CREATE TABLE IF NOT EXISTS groups_mirror (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id         TEXT NOT NULL,
  org_id           TEXT NOT NULL,
  -- Identity
  vendor           TEXT,              -- vendor
  app_name         TEXT,              -- derived (appName || vendor)
  display_name     TEXT,              -- displayName
  description      TEXT,              -- description
  -- Counts
  members_count    INT DEFAULT 0,     -- membersCount
  count            BIGINT DEFAULT 0,  -- count
  -- Identifiers
  app_id           TEXT,              -- appId
  admin_member_id  TEXT,              -- adminMemberId
  user_id          TEXT,              -- userId
  -- Flags
  permissions_group BOOLEAN DEFAULT false,  -- permissionsGroup
  private_group    BOOLEAN DEFAULT false,   -- privateGroup
  teams_channel    BOOLEAN DEFAULT false,   -- teamsChannel
  security_enabled BOOLEAN DEFAULT false,   -- securityEnabled
  is_group         BOOLEAN DEFAULT false,   -- isGroup
  is_active        BOOLEAN DEFAULT false,   -- isActive
  disabled         BOOLEAN DEFAULT false,   -- disabled
  mail_enabled     BOOLEAN DEFAULT false,   -- mailEnabled
  -- Timestamps
  created_time     TIMESTAMPTZ,       -- createdTime
  -- Metadata
  mongo_class      TEXT,              -- _class
  -- Raw + audit
  raw              JSONB,
  synced_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, mongo_id)
);

-- ============================================================
-- AGENT-OWNED TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        TEXT NOT NULL,
  user_id               TEXT NOT NULL,
  question              TEXT NOT NULL,
  session_id            UUID,
  messages              JSONB,
  widgets               JSONB,
  follow_up             JSONB,
  status                TEXT DEFAULT 'completed',
  tokens_used           INT,
  duration_ms           INT,
  guardrail_triggered   BOOLEAN DEFAULT false,
  out_of_scope_reason   TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        TEXT NOT NULL,
  run_id          UUID REFERENCES agent_runs(id),
  action          TEXT NOT NULL,
  tool_input      JSONB,
  result          JSONB,
  requires_approval BOOLEAN DEFAULT true,
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  executed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_memories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        TEXT NOT NULL,
  key         TEXT NOT NULL,
  content     TEXT,
  memory_type TEXT,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, key)
);

-- Sync worker resume tokens (for Change Streams restart)
CREATE TABLE IF NOT EXISTS sync_resume_tokens (
  collection   TEXT PRIMARY KEY,
  org_id        TEXT,
  resume_token JSONB,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Sync state tracking
CREATE TABLE IF NOT EXISTS sync_state (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        TEXT NOT NULL,
  collection   TEXT NOT NULL,
  last_synced  TIMESTAMPTZ,
  record_count INT DEFAULT 0,
  status       TEXT DEFAULT 'ok',
  error_msg    TEXT,
  UNIQUE (org_id, collection)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_apps_mirror_org ON apps_mirror(org_id);
CREATE INDEX IF NOT EXISTS idx_apps_mirror_status ON apps_mirror(org_id, status);
CREATE INDEX IF NOT EXISTS idx_apps_mirror_shadow ON apps_mirror(org_id, is_shadow_it);

CREATE INDEX IF NOT EXISTS idx_users_mirror_org ON users_mirror(org_id);
CREATE INDEX IF NOT EXISTS idx_users_mirror_email ON users_mirror(org_id, email);
CREATE INDEX IF NOT EXISTS idx_users_mirror_dept ON users_mirror(org_id, department);

CREATE INDEX IF NOT EXISTS idx_licenses_mirror_org ON licenses_mirror(org_id);
CREATE INDEX IF NOT EXISTS idx_licenses_mirror_renewal ON licenses_mirror(org_id, renewal_date);
CREATE INDEX IF NOT EXISTS idx_licenses_mirror_vendor ON licenses_mirror(org_id, vendor);

CREATE INDEX IF NOT EXISTS idx_spend_mirror_org ON spend_mirror(org_id);
CREATE INDEX IF NOT EXISTS idx_spend_mirror_vendor ON spend_mirror(org_id, vendor);

CREATE INDEX IF NOT EXISTS idx_shadow_it_mirror_org ON shadow_it_mirror(org_id);
CREATE INDEX IF NOT EXISTS idx_shadow_it_mirror_risk ON shadow_it_mirror(org_id, risk_level);

CREATE INDEX IF NOT EXISTS idx_groups_mirror_org ON groups_mirror(org_id);
CREATE INDEX IF NOT EXISTS idx_groups_mirror_vendor ON groups_mirror(org_id, vendor);

CREATE INDEX IF NOT EXISTS idx_contracts_mirror_org ON contracts_mirror(org_id);
CREATE INDEX IF NOT EXISTS idx_contracts_mirror_renewal ON contracts_mirror(org_id, renewal_date);

CREATE INDEX IF NOT EXISTS idx_agent_runs_org ON agent_runs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_run ON agent_actions(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_org ON agent_actions(org_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY — org isolation enforced at DB level
-- ============================================================

ALTER TABLE apps_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE spend_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_it_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- RLS policies — org_id must match session variable set by application
CREATE POLICY apps_mirror_org_isolation ON apps_mirror
  USING (org_id = current_setting('app.org_id', true));

CREATE POLICY users_mirror_org_isolation ON users_mirror
  USING (org_id = current_setting('app.org_id', true));

CREATE POLICY licenses_mirror_org_isolation ON licenses_mirror
  USING (org_id = current_setting('app.org_id', true));

CREATE POLICY spend_mirror_org_isolation ON spend_mirror
  USING (org_id = current_setting('app.org_id', true));

CREATE POLICY shadow_it_mirror_org_isolation ON shadow_it_mirror
  USING (org_id = current_setting('app.org_id', true));

CREATE POLICY groups_mirror_org_isolation ON groups_mirror
  USING (org_id = current_setting('app.org_id', true));

CREATE POLICY contracts_mirror_org_isolation ON contracts_mirror
  USING (org_id = current_setting('app.org_id', true));

CREATE POLICY agent_runs_org_isolation ON agent_runs
  USING (org_id = current_setting('app.org_id', true));

CREATE POLICY agent_actions_org_isolation ON agent_actions
  USING (org_id = current_setting('app.org_id', true));

CREATE POLICY agent_memories_org_isolation ON agent_memories
  USING (org_id = current_setting('app.org_id', true));
