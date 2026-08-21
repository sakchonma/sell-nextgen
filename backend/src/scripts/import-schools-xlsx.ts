/**
 * Import school Excel into Mongo leads + opportunities.
 *
 * Usage (from backend/):
 *   npm run import:schools -- --dry-run
 *   npm run import:schools -- "/path/to/file.xlsx"
 */
process.env.ALLOW_MEMORY_DB = 'false';

import fs from 'fs';
import path from 'path';
import {
  buildLeadFromImportRow,
  collapseImportDrafts,
  leadIdentityKey,
  parseXlsxRows,
  type ImportUser,
  type LeadImportDraft,
} from '../lib/lead-import.js';
import { defaultProbabilityForStage, normalizeLeadStage } from '../config/sales-funnel-stages.js';

const dryRun = process.argv.includes('--dry-run');
const fileArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
const defaultFile = '/Users/admin/Downloads/สรุปรายชื่อโรงเรียนกำลังดำเนินการ-สถานะใหม่.xlsx';

function countBy(items: LeadImportDraft[], key: (item: LeadImportDraft) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
  const filePath = path.resolve(fileArg || defaultFile);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ไม่พบไฟล์: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const rows = parseXlsxRows(buffer);
  const now = new Date();
  const previewDrafts = collapseImportDrafts(
    rows.map((row, index) => buildLeadFromImportRow(row, {
      index,
      currentUserId: 'preview',
      now,
    })).filter(draft => draft.schoolName)
  );

  console.log(`[import-schools]: file=${filePath}`);
  console.log(`[import-schools]: rows=${rows.length} unique=${previewDrafts.length} dryRun=${dryRun}`);
  console.log('[import-schools]: stage', Object.fromEntries(countBy(previewDrafts, item => item.stage)));
  console.log('[import-schools]: status', Object.fromEntries(countBy(previewDrafts, item => item.status)));
  console.log('[import-schools]: sale', Object.fromEntries(countBy(previewDrafts, item => item.legacySaleName || '(ว่าง)')));

  if (dryRun) {
    console.log('[import-schools]: DRY RUN — ไม่เขียนลงฐานข้อมูล');
    return;
  }

  const { connectToMongoDB, getDbStatus } = await import('../config/mongodb.js');
  await connectToMongoDB();
  const status = getDbStatus();
  if (status.mode !== 'mongodb') {
    throw new Error(`ต่อ MongoDB ไม่ได้ (${status.reason || 'unknown'}). ตรวจ MONGODB_URI / IP whitelist แล้วรันใหม่`);
  }

  const { db } = await import('../config/mongodb.js');
  if (!db) throw new Error('MongoDB connected แต่ไม่มี db handle');

  const users = await db.collection('users').find({}).project({ _id: 1, name: 1, roleId: 1, email: 1 }).toArray() as ImportUser[];
  const fallbackUser = users.find(user => user.roleId === 'r_exec')
    || users.find(user => user.roleId === 'r_manager')
    || users[0];
  if (!fallbackUser) {
    throw new Error('ไม่พบ user ในระบบ — seed ก่อนแล้วค่อย import');
  }

  const drafts = collapseImportDrafts(
    rows.map((row, index) => buildLeadFromImportRow(row, {
      index,
      currentUserId: fallbackUser._id,
      users,
      now,
    })).filter(draft => draft.schoolName)
  );
  console.log(`[import-schools]: db=${status.dbName}`);

  const leadsCol = db.collection('leads');
  const oppsCol = db.collection('opportunities');
  const tasksCol = db.collection('tasks');
  const calendarWipe = await tasksCol.deleteMany({ leadId: { $exists: true, $nin: [null, ''] } });
  console.log(`[import-schools]: cleared calendar tasks=${calendarWipe.deletedCount}`);
  const existingLeads = await leadsCol.find({}).toArray();
  const existingByKey = new Map(existingLeads.map(lead => [leadIdentityKey(lead as unknown as LeadImportDraft), lead]));

  let inserted = 0;
  let updated = 0;

  for (const draft of drafts) {
    const existing = existingByKey.get(leadIdentityKey(draft)) as (LeadImportDraft & { _id: string }) | undefined;
    const leadDoc = existing
      ? {
          ...existing,
          ...draft,
          _id: existing._id,
          createdAt: existing.createdAt || draft.createdAt,
          notes: [
            ...((existing.notes || []).filter((note: any) =>
              !String(note.content || '').includes('วันที่เกิดสถานะ') &&
              !String(note.content || '').includes('คอลัมน์ P')
            )),
            ...((draft.notes || []).filter(note =>
              !(existing.notes || []).some((item: any) => item.content === note.content)
            )),
          ],
          assignmentHistory: existing.assignmentHistory || draft.assignmentHistory,
          assignedTo: draft.assignedTo,
          documentStatus: '',
          statusOccurredAt: '',
          updatedAt: now,
        }
      : draft;

    if (existing) {
      const { _id, ...leadFields } = leadDoc;
      await leadsCol.updateOne({ _id } as any, { $set: leadFields });
      updated += 1;
    } else {
      await leadsCol.insertOne(leadDoc as any);
      inserted += 1;
      existingByKey.set(leadIdentityKey(draft), leadDoc as any);
    }

    const stage = normalizeLeadStage(leadDoc.stage);
    const existingOpp = await oppsCol.findOne({ leadId: leadDoc._id } as any);
    if (!existingOpp) {
      await oppsCol.insertOne({
        _id: `o_${leadDoc._id}_${now.getTime()}`,
        leadId: leadDoc._id,
        title: `ดีล ${leadDoc.schoolName}`,
        stage,
        value: 0,
        closeDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        assignedTo: leadDoc.assignedTo || fallbackUser._id,
        probability: defaultProbabilityForStage(stage),
        quoteIds: [],
        stageHistory: [{
          toStage: stage,
          changedBy: fallbackUser._id,
          reason: 'Excel import',
          changedAt: now,
        }],
        createdAt: now,
        updatedAt: now,
      } as any);
    } else {
      const patch: Record<string, unknown> = {
        $set: {
          assignedTo: leadDoc.assignedTo || existingOpp.assignedTo,
          updatedAt: now,
        },
      };
      if (existingOpp.stage !== stage) {
        patch.$set = {
          ...(patch.$set as Record<string, unknown>),
          stage,
          probability: defaultProbabilityForStage(stage),
        };
        patch.$push = {
          stageHistory: {
            fromStage: existingOpp.stage,
            toStage: stage,
            changedBy: fallbackUser._id,
            reason: 'Excel import',
            changedAt: now,
          },
        };
      }
      await oppsCol.updateOne({ _id: existingOpp._id } as any, patch as any);
    }
  }

  console.log(`[import-schools]: inserted=${inserted} updated=${updated}`);
  const wipeP = await leadsCol.updateMany({}, { $unset: { documentStatus: '', statusOccurredAt: '' } });
  console.log(`[import-schools]: wiped column P fields=${wipeP.modifiedCount}`);
}

main()
  .catch(err => {
    console.error('[import-schools]: Failed', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (dryRun) return;
    const { client } = await import('../config/mongodb.js');
    if (client) await client.close();
  });
