/**
 * Sync existing Lead.nextCallAt ("นัดโทรครั้งถัดไป") into central calendar Tasks.
 *
 * Creates/updates a Call task 09:00–10:00 (local) per lead:
 *   title: นัดโทรครั้งถัดไป: {schoolName}
 *
 * Usage (from backend/):
 *   npm run backfill:next-call-calendar
 *   npm run backfill:next-call-calendar -- --dry-run
 *   npm run backfill:next-call-calendar -- --force
 */
process.env.ALLOW_MEMORY_DB = 'false';

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');

async function main() {
  const { connectToMongoDB, client, getDbStatus } = await import('../config/mongodb.js');
  const { runNextCallCalendarBackfill } = await import('../services/activity-sync.service.js');

  console.log('[next-call-calendar]: Connecting to database...');
  await connectToMongoDB();
  const status = getDbStatus();

  if (status.mode !== 'mongodb') {
    throw new Error(
      `Cannot connect to MongoDB (${status.reason || 'unknown'}). Fix MONGODB_URI / network / Atlas IP whitelist, then retry.`
    );
  }

  console.log(`[next-call-calendar]: Mode=${status.mode} db=${status.dbName}`);
  if (dryRun) console.log('[next-call-calendar]: DRY RUN — no writes');
  if (force) console.log('[next-call-calendar]: FORCE — rewrite existing next-call tasks');

  const stats = await runNextCallCalendarBackfill({ dryRun, force });

  console.log('[next-call-calendar]: Done');
  console.log(JSON.stringify({
    leadsScanned: stats.leadsScanned,
    withNextCall: stats.withNextCall,
    created: stats.created,
    updated: stats.updated,
    unchanged: stats.unchanged,
    invalidDates: stats.invalidDates,
    dryRun: stats.dryRun,
    force: stats.force,
  }, null, 2));

  if (stats.samples.length) {
    console.log('[next-call-calendar]: Sample (max 50)');
    for (const row of stats.samples) {
      console.log(`  ${row.action.padEnd(7)} ${row.nextCallAt}  ${row.schoolName} (${row.leadId})`);
    }
  }

  if (stats.withNextCall === 0) {
    console.log('[next-call-calendar]: No leads with nextCallAt');
  } else if (stats.created === 0 && stats.updated === 0) {
    console.log('[next-call-calendar]: All nextCallAt already on calendar (use --force to rewrite)');
  }

  if (client) await client.close();
}

main().catch(err => {
  console.error('[next-call-calendar]: Failed', err.message || err);
  process.exitCode = 1;
});
