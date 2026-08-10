/**
 * Backfill Lead ↔ Task sync for calendar visibility.
 *
 * Usage (from backend/):
 *   npm run backfill:activity-sync
 *   npm run backfill:activity-sync -- --dry-run
 */
// Must set before loading config (imports are hoisted otherwise).
process.env.ALLOW_MEMORY_DB = 'false';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const { connectToMongoDB, client, getDbStatus } = await import('../config/mongodb.js');
  const { runActivitySyncBackfill } = await import('../services/activity-sync.service.js');

  console.log('[backfill]: Connecting to database...');
  await connectToMongoDB();
  const status = getDbStatus();

  if (status.mode !== 'mongodb') {
    throw new Error(
      `Cannot connect to MongoDB (${status.reason || 'unknown'}). Fix MONGODB_URI / network / Atlas IP whitelist, then retry.`
    );
  }

  console.log(`[backfill]: Mode=${status.mode} db=${status.dbName}`);

  if (dryRun) {
    console.log('[backfill]: DRY RUN — no writes will be performed');
  }

  const stats = await runActivitySyncBackfill({ dryRun });

  console.log('[backfill]: Done');
  console.log(JSON.stringify(stats, null, 2));

  if (
    stats.nextCallTasksSynced === 0 &&
    stats.noteTasksSynced === 0 &&
    stats.existingTasksLinked === 0 &&
    stats.leadNextCallFromTasks === 0
  ) {
    console.log('[backfill]: Nothing to backfill (already synced or no nextCallAt / activity notes)');
  }

  if (client) await client.close();
}

main().catch(err => {
  console.error('[backfill]: Failed', err.message || err);
  process.exitCode = 1;
});
