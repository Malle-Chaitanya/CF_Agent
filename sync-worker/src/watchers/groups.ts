import { MongoClient, ChangeStream, Document } from 'mongodb';
import { bulkUpsert, query, saveResumeToken, getResumeToken } from '../db/client';
import { scheduleRestart } from '../utils/retry';

// CFGroup: groups per SaaS vendor (filtered to membersCount > 0)
// No deleted field — filter by userId
const DB_NAME   = 'common';
const COLLECTION = 'CFGroup';

export async function startGroupsWatcher(
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

  // Filter by userId — CFGroup has no domain field
  const stream: ChangeStream = col.watch(
    [{ $match: { 'fullDocument.userId': userId } }],
    options
  );

  console.log(`[watcher:groups] ✅ Watching common.CFGroup for userId "${userId}"`);

  stream.on('change', async (event: any) => {
    try {
      if (event.operationType === 'delete') {
        await query(
          `DELETE FROM groups_mirror WHERE org_id = $1 AND mongo_id = $2`,
          [orgId, event.documentKey._id.toString()]
        );
      } else if (event.fullDocument) {
        const doc = event.fullDocument;
        // Only keep groups with members
        if (Number(doc.membersCount ?? 0) === 0) {
          await query(
            `DELETE FROM groups_mirror WHERE org_id = $1 AND mongo_id = $2`,
            [orgId, doc._id?.toString()]
          );
        } else {
          await upsertGroup(doc, orgId);
        }
      }
      await saveResumeToken(`${COLLECTION}:${orgId}`, event._id);
    } catch (err: any) {
      console.error('[watcher:groups] change error:', err.message);
    }
  });

  stream.on('error', (err) => {
    console.error(`[watcher:groups] error:`, err.message);
    scheduleRestart('groups', attempt, () => startGroupsWatcher(mongo, orgId, userId, attempt + 1));
  });
}

async function upsertGroup(doc: Document, orgId: string): Promise<void> {
  const row = {
    mongo_id:           doc._id?.toString(),
    org_id:             orgId,
    vendor:             doc.vendor ?? null,
    app_name:           doc.appName ?? doc.vendor ?? null,
    display_name:       doc.displayName ?? doc.appName ?? null,
    description:        doc.description ?? null,
    members_count:      Number(doc.membersCount ?? 0),
    count:              Number(doc.count ?? 0),
    app_id:             doc.appId ?? null,
    admin_member_id:    doc.adminMemberId ?? null,
    user_id:            doc.userId?.toString() ?? null,
    permissions_group:  Boolean(doc.permissionsGroup ?? false),
    private_group:      Boolean(doc.privateGroup ?? false),
    teams_channel:      Boolean(doc.teamsChannel ?? false),
    security_enabled:   Boolean(doc.securityEnabled ?? false),
    is_group:           Boolean(doc.isGroup ?? false),
    is_active:          Boolean(doc.isActive ?? false),
    disabled:           Boolean(doc.disabled ?? false),
    mail_enabled:       Boolean(doc.mailEnabled ?? false),
    created_time:       doc.createdTime ? new Date(doc.createdTime).toISOString() : null,
    mongo_class:        doc._class ?? null,
    raw:                JSON.stringify(doc),
    synced_at:          new Date().toISOString(),
  };

  const updateCols = [
    'vendor','app_name','display_name','description','members_count','count',
    'app_id','admin_member_id','user_id',
    'permissions_group','private_group','teams_channel','security_enabled','is_group','is_active','disabled','mail_enabled',
    'created_time','mongo_class',
    'raw','synced_at',
  ];

  await bulkUpsert('groups_mirror', [row], ['org_id', 'mongo_id'], updateCols);
}
