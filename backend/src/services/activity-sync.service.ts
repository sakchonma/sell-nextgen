import { Leads, Tasks, MemoryStore, MemoryCollection, Users } from '../models/db.js';
import type { Lead, Task } from '../types/index.js';
import { stageRequiresEventAt, normalizeLeadStage } from '../config/sales-funnel-stages.js';

type SourceRef = { type: string; leadId?: string; noteKey?: string };

async function findAll<T>(collection: any, query: Record<string, unknown> = {}): Promise<T[]> {
  if (collection?.find && typeof collection.find().toArray === 'function') {
    return collection.find(query).toArray();
  }
  return collection.find(query);
}

function leadNoteKey(note: { createdAt: Date | string; author: string }) {
  return `${new Date(note.createdAt).toISOString()}|${note.author}`;
}

function formatDateOnly(value: Date | string) {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function toIsoDay(dateStr: string) {
  const trimmed = String(dateStr || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDateOnly(parsed);
}

function dateOnlyRange(dateStr: string) {
  const isoDay = toIsoDay(dateStr);
  if (!isoDay) return { start: new Date(NaN), end: new Date(NaN) };
  const [year, month, day] = isoDay.split('-').map(Number);
  const start = new Date(year, (month || 1) - 1, day || 1, 9, 0, 0, 0);
  const end = new Date(year, (month || 1) - 1, day || 1, 10, 0, 0, 0);
  return { start, end };
}

function calculateReminderAt(startAt: Date, minutesBefore = 30) {
  return new Date(startAt.getTime() - minutesBefore * 60 * 1000);
}

function noteTypeToTaskType(noteType: string): Task['type'] {
  if (noteType === 'Call') return 'Call';
  if (noteType === 'Meeting') return 'Meeting';
  if (noteType === 'FollowUp') return 'FollowUp';
  return 'Other';
}

async function upsertTask(task: Record<string, unknown>) {
  const coll = Tasks();
  const existing = await coll.findOne({ _id: task._id } as any);
  if (existing) {
    await (coll as any).updateOne({ _id: task._id }, { $set: task });
    return;
  }
  try {
    await coll.insertOne(task as any);
  } catch (error: any) {
    if (error?.code === 11000) {
      await (coll as any).updateOne({ _id: task._id }, { $set: task });
      return;
    }
    throw error;
  }
}

async function findNextCallSyncTask(leadId: string) {
  const linked = await findLinkedTask(leadId, 'lead_next_call');
  if (linked) return linked;
  return await Tasks().findOne({ _id: `t_sync_${leadId}_nextcall` } as any);
}

async function deleteTaskById(taskId: string) {
  const coll = Tasks();
  if ('deleteOne' in coll) {
    await (coll as any).deleteOne({ _id: taskId });
  } else {
    const idx = (MemoryStore as any).tasks?.findIndex((t: any) => t._id === taskId);
    if (idx !== -1) (MemoryStore as any).tasks.splice(idx, 1);
  }
}

function noteTaskId(leadId: string, noteKey: string) {
  const slug = noteKey.replace(/[^a-zA-Z0-9|]/g, '_').slice(0, 64);
  return `t_sync_${leadId}_note_${slug}`;
}

async function findLinkedTask(leadId: string, sourceType: string, noteKey?: string) {
  const tasks = await findAll<any>(Tasks(), { leadId });
  return tasks.find((task: any) => {
    const ref = task.sourceRef as SourceRef | undefined;
    if (!ref || ref.leadId !== leadId || ref.type !== sourceType) return false;
    if (noteKey !== undefined) return ref.noteKey === noteKey;
    return true;
  });
}

async function updateLeadRecord(leadId: string, patch: Partial<Lead>) {
  const coll = Leads();
  const lead = await coll.findOne({ _id: leadId } as any);
  if (!lead) return;
  const updated = { ...lead, ...patch, updatedAt: new Date() };
  if ('updateOne' in coll && !(coll instanceof MemoryCollection)) {
    await (coll as any).updateOne({ _id: leadId }, { $set: updated });
  } else {
    const idx = (MemoryStore as any).leads.findIndex((item: any) => item._id === leadId);
    if (idx !== -1) (MemoryStore as any).leads[idx] = updated;
  }
}

export async function syncLeadNextCallAt(lead: Lead, creatorId: string) {
  const linked = await findNextCallSyncTask(lead._id);
  const isoDay = toIsoDay(lead.nextCallAt || '');

  if (!isoDay) {
    if (linked) await deleteTaskById(linked._id);
    return;
  }

  const { start, end } = dateOnlyRange(isoDay);
  if (Number.isNaN(start.getTime())) {
    if (linked) await deleteTaskById(linked._id);
    return;
  }
  const ownerId = lead.assignedTo || creatorId;
  const participants = Array.isArray(linked?.participants) && linked.participants.length
    ? (linked.participants.some((p: any) => p.userId === ownerId)
      ? linked.participants
      : [...linked.participants, { userId: ownerId, status: 'Accepted' }])
    : [{ userId: ownerId, status: 'Accepted' }];
  const taskPayload = {
    _id: linked?._id || `t_sync_${lead._id}_nextcall`,
    title: `นัดโทรครั้งถัดไป: ${lead.schoolName}`,
    description: `นัดโทรครั้งถัดไปจาก Lead`,
    type: 'Call' as const,
    status: 'Pending' as const,
    startAt: start,
    endAt: end,
    leadId: lead._id,
    reminderAt: calculateReminderAt(start, 30),
    reminderMinutesBefore: 30,
    sourceRef: { type: 'lead_next_call', leadId: lead._id },
    creatorId: linked?.creatorId || ownerId,
    participants,
    comments: linked?.comments || [],
    createdAt: linked?.createdAt || new Date(),
    updatedAt: new Date(),
  };
  await upsertTask(taskPayload);
}

export async function markTaskFollowUpUpdated(taskId: string) {
  if (!taskId) return;
  const coll = Tasks();
  const task = await coll.findOne({ _id: taskId } as any);
  if (!task) return;
  const now = new Date();
  const patch = { followUpUpdatedAt: now, updatedAt: now };
  if ('updateOne' in coll && !(coll instanceof MemoryCollection)) {
    await (coll as any).updateOne({ _id: taskId }, { $set: patch });
  } else {
    const idx = (MemoryStore as any).tasks?.findIndex((item: any) => item._id === taskId);
    if (idx !== -1) (MemoryStore as any).tasks[idx] = { ...task, ...patch };
  }
}

export async function markLeadFollowUpsUpdated(leadId: string) {
  if (!leadId) return;
  const tasks = await findAll<any>(Tasks(), { leadId });
  for (const task of tasks) {
    if (task.status === 'Completed') continue;
    await markTaskFollowUpUpdated(task._id);
  }
}

export async function syncLeadNotesAdded(lead: Lead, newNotes: any[], creatorId: string) {
  for (const note of newNotes) {
    const type = note.type || 'General';
    if (!['Call', 'Meeting', 'FollowUp', 'Email'].includes(type)) continue;
    const key = leadNoteKey(note);
    const existing = await findLinkedTask(lead._id, 'lead_note', key);
    const start = new Date(note.createdAt || Date.now());
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const ownerId = lead.assignedTo || creatorId;
    const taskType = noteTypeToTaskType(type);
    const titlePrefix = type === 'Email' ? 'อีเมล' : type;
    await upsertTask({
      _id: existing?._id || noteTaskId(lead._id, key),
      title: `${titlePrefix}: ${lead.schoolName}`,
      description: note.content,
      type: taskType,
      status: 'Pending',
      startAt: start,
      endAt: end,
      leadId: lead._id,
      reminderAt: calculateReminderAt(start, 30),
      reminderMinutesBefore: 30,
      sourceRef: { type: 'lead_note', leadId: lead._id, noteKey: key },
      creatorId: existing?.creatorId || ownerId,
      participants: existing?.participants || [{ userId: ownerId, status: 'Accepted' }],
      comments: existing?.comments || [],
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function syncTaskToLead(task: any) {
  if (!task.leadId) return;
  const ref = task.sourceRef as SourceRef | undefined;
  if (task.type === 'FollowUp' || ref?.type === 'lead_next_call') {
    const nextCallAt = formatDateOnly(task.startAt);
    await updateLeadRecord(task.leadId, { nextCallAt });
  }
}

export async function syncTaskCompletedToLead(task: any) {
  if (!task.leadId) return;
  const today = formatDateOnly(new Date());
  const patch: Partial<Lead> = { lastContactedAt: today };
  const ref = task.sourceRef as SourceRef | undefined;
  if (task.type === 'FollowUp' || ref?.type === 'lead_next_call') {
    patch.nextCallAt = '';
  }
  await updateLeadRecord(task.leadId, patch);
}

export async function syncLeadStageEvent(lead: Lead, creatorId: string) {
  const linked = await findLinkedTask(lead._id, 'lead_stage_event');
  const stage = normalizeLeadStage(lead.stage);
  const eventAt = lead.stageEventAt?.trim();

  if (!stageRequiresEventAt(stage) || !eventAt) {
    if (linked) await deleteTaskById(linked._id);
    return;
  }

  const start = new Date(eventAt);
  if (Number.isNaN(start.getTime())) {
    if (linked) await deleteTaskById(linked._id);
    return;
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const ownerId = lead.assignedTo || creatorId;
  let type: Task['type'] = 'Meeting';
  let titlePrefix = 'นัดหมาย';
  if (stage === 'Presented') {
    type = 'Presentation';
    titlePrefix = 'Present';
  } else if (stage === 'DemoWorkshop') {
    type = 'Demo';
    titlePrefix = 'Demo/Workshop';
  } else if (stage === 'Appointed') {
    if (lead.appointmentKind === 'DemoWorkshop') {
      type = 'Demo';
      titlePrefix = 'นัด Demo/Workshop';
    } else {
      type = 'Presentation';
      titlePrefix = 'นัด Present';
    }
  }

  await upsertTask({
    _id: linked?._id || `t_sync_${lead._id}_stage_event`,
    title: `${titlePrefix}: ${lead.schoolName}`,
    description: `นัดจากสถานะ ${stage}`,
    type,
    status: 'Pending' as const,
    startAt: start,
    endAt: end,
    leadId: lead._id,
    reminderAt: calculateReminderAt(start, 30),
    reminderMinutesBefore: 30,
    sourceRef: { type: 'lead_stage_event', leadId: lead._id },
    creatorId: linked?.creatorId || ownerId,
    participants: linked?.participants || [{ userId: ownerId, status: 'Accepted' }],
    comments: linked?.comments || [],
    createdAt: linked?.createdAt || new Date(),
    updatedAt: new Date(),
  });
}

export async function syncLeadAfterUpdate(
  previousLead: Lead,
  updatedLead: Lead,
  creatorId: string,
  appendedNotes?: any[]
) {
  if (appendedNotes?.length) {
    await syncLeadNotesAdded(updatedLead, appendedNotes, creatorId);
  }
  await syncLeadNextCallAt(updatedLead, creatorId);
  const stageChanged = previousLead.stage !== updatedLead.stage;
  const eventChanged = previousLead.stageEventAt !== updatedLead.stageEventAt;
  const kindChanged = previousLead.appointmentKind !== updatedLead.appointmentKind;
  if (stageChanged || eventChanged || kindChanged) {
    await syncLeadStageEvent(updatedLead, creatorId);
  }
}

export async function syncTaskAfterUpdate(previousTask: any, updatedTask: any) {
  const startChanged = new Date(previousTask.startAt).getTime() !== new Date(updatedTask.startAt).getTime();
  const typeChanged = previousTask.type !== updatedTask.type;
  if (startChanged || typeChanged) {
    await syncTaskToLead(updatedTask);
  }
}

export async function logActivity(params: {
  leadId: string;
  type: 'Call' | 'Email' | 'Meeting' | 'FollowUp';
  content: string;
  startAt: string;
  endAt?: string;
  reminderMinutesBefore?: number;
  creatorId: string;
  authorName: string;
}) {
  const coll = Leads();
  const lead = await coll.findOne({ _id: params.leadId } as any) as Lead | null;
  if (!lead) throw new Error('ไม่พบข้อมูลโรงเรียน');

  const start = new Date(params.startAt);
  const end = params.endAt ? new Date(params.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const reminderMinutes = params.reminderMinutesBefore ?? 30;
  const note = {
    author: params.authorName,
    content: params.content,
    type: params.type === 'Email' ? 'Email' : params.type,
    createdAt: new Date(),
  };
  const notes = [...(lead.notes || []), note];
  await updateLeadRecord(params.leadId, { notes } as Partial<Lead>);

  const ownerId = lead.assignedTo || params.creatorId;
  const taskType = params.type === 'Email' ? 'Other' : params.type;
  const taskId = `t_log_${Date.now()}`;
  await upsertTask({
    _id: taskId,
    title: `${params.type}: ${lead.schoolName}`,
    description: params.content,
    type: taskType,
    status: 'Pending',
    startAt: start,
    endAt: end,
    leadId: params.leadId,
    reminderAt: calculateReminderAt(start, reminderMinutes),
    reminderMinutesBefore: reminderMinutes,
    sourceRef: { type: 'activity_log', leadId: params.leadId, noteKey: leadNoteKey(note) },
    creatorId: params.creatorId,
    participants: [{ userId: ownerId, status: 'Accepted' }, ...(ownerId !== params.creatorId ? [{ userId: params.creatorId, status: 'Accepted' }] : [])],
    comments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  if (params.type === 'FollowUp' || params.type === 'Call') {
    await updateLeadRecord(params.leadId, { nextCallAt: formatDateOnly(start) });
  }

  return { taskId, note };
}

export type ActivitySyncBackfillStats = {
  leadsProcessed: number;
  nextCallTasksSynced: number;
  noteTasksSynced: number;
  existingTasksLinked: number;
  leadNextCallFromTasks: number;
  skippedLeads: number;
  dryRun: boolean;
};

export async function runActivitySyncBackfill(options: { dryRun?: boolean } = {}): Promise<ActivitySyncBackfillStats> {
  const dryRun = options.dryRun ?? false;
  const stats: ActivitySyncBackfillStats = {
    leadsProcessed: 0,
    nextCallTasksSynced: 0,
    noteTasksSynced: 0,
    existingTasksLinked: 0,
    leadNextCallFromTasks: 0,
    skippedLeads: 0,
    dryRun,
  };

  const [leads, users, tasks] = await Promise.all([
    findAll<Lead>(Leads()),
    findAll<any>(Users()),
    findAll<any>(Tasks()),
  ]);

  const fallbackUserId = users.find((u: any) => u.rank === 3)?._id
    || users.find((u: any) => u.rank >= 4)?._id
    || users[0]?._id
    || 'backfill_system';

  for (const lead of leads) {
    stats.leadsProcessed += 1;
    const creatorId = lead.assignedTo || fallbackUserId;
    const nextCallAt = lead.nextCallAt?.trim();

    const activityNotes = (lead.notes || []).filter((note: any) =>
      ['Call', 'Meeting', 'FollowUp', 'Email'].includes(note.type || '')
    );

    for (const note of activityNotes) {
      const key = leadNoteKey(note);
      const existing = await findLinkedTask(lead._id, 'lead_note', key);
      if (existing) continue;
      if (!dryRun) {
        await syncLeadNotesAdded(lead, [note], creatorId);
      }
      stats.noteTasksSynced += 1;
    }

    if (nextCallAt) {
      const existingNextCall = await findNextCallSyncTask(lead._id);
      const existingDay = existingNextCall ? formatDateOnly(existingNextCall.startAt) : '';
      if (!existingNextCall || existingDay !== toIsoDay(nextCallAt)) {
        if (!dryRun) await syncLeadNextCallAt(lead, creatorId);
        stats.nextCallTasksSynced += 1;
      }
    }

    if (!nextCallAt && activityNotes.length === 0) {
      stats.skippedLeads += 1;
    }
  }

  for (const task of tasks) {
    if (!task.leadId) continue;
    const ref = task.sourceRef as SourceRef | undefined;
    if (ref?.type === 'lead_next_call') continue;
    if (task.type !== 'FollowUp') continue;

    const lead = leads.find(item => item._id === task.leadId);
    if (!lead) continue;

    const taskDate = formatDateOnly(task.startAt);
    if (lead.nextCallAt === taskDate) continue;

    if (!dryRun) await syncTaskToLead(task);
    stats.leadNextCallFromTasks += 1;
  }

  return stats;
}

export type NextCallCalendarBackfillStats = {
  leadsScanned: number;
  withNextCall: number;
  invalidDates: number;
  created: number;
  updated: number;
  unchanged: number;
  dryRun: boolean;
  force: boolean;
  samples: Array<{ leadId: string; schoolName: string; nextCallAt: string; action: 'create' | 'update' | 'skip' | 'invalid' }>;
};

export async function runNextCallCalendarBackfill(options: { dryRun?: boolean; force?: boolean } = {}): Promise<NextCallCalendarBackfillStats> {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const stats: NextCallCalendarBackfillStats = {
    leadsScanned: 0,
    withNextCall: 0,
    invalidDates: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    dryRun,
    force,
    samples: [],
  };

  const [leads, users] = await Promise.all([
    findAll<Lead>(Leads()),
    findAll<any>(Users()),
  ]);

  const fallbackUserId = users.find((u: any) => u.rank === 3)?._id
    || users.find((u: any) => u.rank >= 4)?._id
    || users[0]?._id
    || 'backfill_system';

  for (const lead of leads) {
    stats.leadsScanned += 1;
    const raw = String(lead.nextCallAt || '').trim();
    if (!raw) continue;

    stats.withNextCall += 1;
    const isoDay = toIsoDay(raw);
    if (!isoDay) {
      stats.invalidDates += 1;
      if (stats.samples.length < 50) {
        stats.samples.push({
          leadId: lead._id,
          schoolName: lead.schoolName,
          nextCallAt: raw,
          action: 'invalid',
        });
      }
      continue;
    }

    const existing = await findNextCallSyncTask(lead._id);
    const existingDay = existing ? formatDateOnly(existing.startAt) : '';
    const needsWrite = force || !existing || existingDay !== isoDay;
    const action: 'create' | 'update' | 'skip' = !existing ? 'create' : needsWrite ? 'update' : 'skip';

    if (action === 'skip') {
      stats.unchanged += 1;
    } else if (action === 'create') {
      stats.created += 1;
    } else {
      stats.updated += 1;
    }

    if (needsWrite && !dryRun) {
      await syncLeadNextCallAt(lead, lead.assignedTo || fallbackUserId);
    }

    if (stats.samples.length < 50) {
      stats.samples.push({
        leadId: lead._id,
        schoolName: lead.schoolName,
        nextCallAt: isoDay,
        action,
      });
    }
  }

  return stats;
}
