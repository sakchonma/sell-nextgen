/**
 * Import Corporate + University leads (data/segment-leads.json) into MongoDB.
 *
 * Usage (from backend/):
 *   npm run import:segments -- --dry-run              # ตรวจไฟล์ ไม่เขียน DB
 *   npm run import:segments                            # นำเข้า/อัปเดต (รันซ้ำได้)
 *   npm run import:segments -- --owner=manager@nextgen.co.th
 *   npm run import:segments -- --rollback --yes        # ลบข้อมูลที่นำเข้า (เฉพาะที่ยังไม่มีใบเสนอราคา)
 *
 * What it writes:
 *   leads          → 1 doc per record, upsert by externalRef (segment = corporate | university)
 *   opportunities  → auto-created for leads whose stage is past "TargetSchool" (same rule as the app)
 *   tasks          → "นัดโทรครั้งถัดไป" calendar task for every lead that has nextCallAt
 *   audit_logs     → one entry per run
 */
process.env.ALLOW_MEMORY_DB = 'false';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildSegmentLeadDoc,
  summarizeRecords,
  validateRecord,
  type SegmentImportFile,
} from '../lib/segment-import.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rollback = args.includes('--rollback');
const confirmed = args.includes('--yes');
const ownerArg = args.find(arg => arg.startsWith('--owner='))?.split('=')[1];
const fileArg = args.find(arg => !arg.startsWith('--'));
const defaultFile = fileURLToPath(new URL('../../data/segment-leads.json', import.meta.url));

function log(message: string, extra?: unknown) {
  console.log(`[import-segments]: ${message}`, extra === undefined ? '' : extra);
}

function loadFile(): SegmentImportFile {
  const filePath = path.resolve(fileArg || defaultFile);
  if (!fs.existsSync(filePath)) throw new Error(`ไม่พบไฟล์: ${filePath}`);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SegmentImportFile;
  if (!Array.isArray(parsed.records)) throw new Error('ไฟล์ไม่มี records[]');
  log(`file=${filePath}`);
  return parsed;
}

async function connect() {
  const mongo = await import('../config/mongodb.js');
  await mongo.connectToMongoDB();
  const status = mongo.getDbStatus();
  if (status.mode !== 'mongodb') {
    throw new Error(`ต่อ MongoDB ไม่ได้ (${status.reason || 'unknown'}). ตรวจ MONGODB_URI / IP whitelist แล้วรันใหม่`);
  }
  const { db } = await import('../config/mongodb.js');
  if (!db) throw new Error('MongoDB connected แต่ไม่มี db handle');
  log(`db=${status.dbName}`);
  return db;
}

async function runRollback() {
  if (!confirmed) throw new Error('rollback ต้องใส่ --yes เพื่อยืนยัน');
  const db = await connect();
  const leads = await db.collection('leads')
    .find({ segment: { $in: ['corporate', 'university'] }, externalRef: { $regex: '^(corporate|university):' } } as any)
    .project({ _id: 1, schoolName: 1 })
    .toArray();
  const ids = leads.map(lead => lead._id as unknown as string);
  const quoted = new Set((await db.collection('quotations').find({ leadId: { $in: ids } } as any).project({ leadId: 1 }).toArray())
    .map(quote => quote.leadId));
  const removable = ids.filter(id => !quoted.has(id));
  const tasks = await db.collection('tasks').deleteMany({ leadId: { $in: removable }, 'sourceRef.type': { $in: ['lead_next_call', 'lead_stage_event'] } } as any);
  const opps = await db.collection('opportunities').deleteMany({ leadId: { $in: removable }, value: 0 } as any);
  const removed = await db.collection('leads').deleteMany({ _id: { $in: removable } } as any);
  log(`rollback leads=${removed.deletedCount} opportunities=${opps.deletedCount} tasks=${tasks.deletedCount} keptWithQuotes=${quoted.size}`);
}

async function runImport() {
  const file = loadFile();
  const problems = file.records.flatMap(validateRecord);
  log('summary', summarizeRecords(file.records));
  if (problems.length) {
    problems.forEach(problem => console.error(`  ✗ ${problem}`));
    throw new Error(`พบข้อมูลผิดรูปแบบ ${problems.length} รายการ`);
  }
  if (dryRun) {
    const preview = buildSegmentLeadDoc(file.records[0], { ownerId: 'preview', actorId: 'preview', now: new Date() });
    log('preview first lead', { _id: preview._id, schoolName: preview.schoolName, segment: preview.segment, stage: preview.stage });
    log('DRY RUN — ไม่เขียนลงฐานข้อมูล');
    return;
  }

  const db = await connect();
  const users = await db.collection('users').find({}).project({ _id: 1, name: 1, email: 1, roleId: 1 }).toArray();
  const owner = ownerArg
    ? users.find(user => user.email === ownerArg)
    : users.find(user => user.roleId === 'r_manager') || users.find(user => user.roleId === 'r_exec') || users[0];
  if (!owner) throw new Error(ownerArg ? `ไม่พบผู้ใช้ ${ownerArg}` : 'ไม่พบ user ในระบบ — seed ก่อนแล้วค่อย import');
  const ownerId = owner._id as unknown as string;
  log(`owner=${owner.email} (${owner.name})`);

  // The sync services resolve collections via getCollection(), which now points at the connected db.
  const { syncLeadStageToOpportunity } = await import('../services/sales-funnel-sync.service.js');
  const { syncLeadNextCallAt } = await import('../services/activity-sync.service.js');

  const leadsCol = db.collection('leads');
  const now = new Date();
  let inserted = 0;
  let updated = 0;
  let opportunities = 0;
  let calendarTasks = 0;

  for (const record of file.records) {
    const existing = await leadsCol.findOne({ externalRef: record.externalRef } as any) as any;
    const doc = buildSegmentLeadDoc(record, { ownerId, actorId: ownerId, now, existing });
    if (existing) {
      const { _id, ...fields } = doc as any;
      await leadsCol.updateOne({ _id } as any, { $set: fields });
      updated += 1;
    } else {
      await leadsCol.insertOne(doc as any);
      inserted += 1;
    }

    const previousStage = existing ? existing.stage : 'TargetSchool';
    const opp = await syncLeadStageToOpportunity(doc as any, previousStage, ownerId, 'Excel import (segment)');
    if (opp) opportunities += 1;
    if (doc.nextCallAt) {
      await syncLeadNextCallAt(doc as any, ownerId);
      calendarTasks += 1;
    }
  }

  await db.collection('audit_logs').insertOne({
    _id: `audit_${Date.now()}_segments`,
    actorId: ownerId,
    actorEmail: 'script:import-segment-leads',
    action: 'lead.import_segments',
    targetType: 'lead',
    details: { inserted, updated, opportunities, calendarTasks, source: file.generatedFrom },
    createdAt: now,
  } as any);

  log(`done inserted=${inserted} updated=${updated} opportunitiesSynced=${opportunities} calendarTasks=${calendarTasks}`);
}

(rollback ? runRollback() : runImport())
  .catch(err => {
    console.error('[import-segments]: Failed', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dryRun) return;
    const { client } = await import('../config/mongodb.js');
    if (client) await client.close();
  });
