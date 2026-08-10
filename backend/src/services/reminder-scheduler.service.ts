import { Tasks, Notifications, Users } from '../models/db.js';

async function findAll<T>(collection: any, query: Record<string, unknown> = {}): Promise<T[]> {
  if (collection?.find && typeof collection.find().toArray === 'function') {
    return collection.find(query).toArray();
  }
  return collection.find(query);
}

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as string);
}

async function createReminderNotification(
  userId: string,
  title: string,
  message: string,
  targetUrl: string
) {
  const user = await Users().findOne({ _id: userId } as any);
  const preferences = user?.notificationPreferences;
  if (preferences?.digestOnly || preferences?.categories?.Calendar === false) return;

  const existing = await findAll<any>(Notifications(), { userId });
  const recentDuplicate = existing.find(item =>
    !item.archivedAt &&
    item.type === 'CalendarInvite' &&
    item.title === title &&
    item.targetUrl === targetUrl &&
    Date.now() - asDate(item.createdAt).getTime() < 5 * 60 * 1000
  );
  if (recentDuplicate) return;

  await Notifications().insertOne({
    _id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    title,
    message,
    type: 'CalendarInvite',
    targetUrl,
    category: 'Calendar',
    isRead: false,
    createdAt: new Date()
  } as any);
}

export async function sendDueTaskReminders(): Promise<number> {
  const tasksColl = Tasks();
  const tasks = await findAll<any>(tasksColl);
  const now = new Date();
  const dueTasks = tasks.filter(task =>
    task.reminderAt &&
    !task.reminderSentAt &&
    asDate(task.reminderAt) <= now &&
    task.status !== 'Completed'
  );

  await Promise.all(dueTasks.map(async (task) => {
    const recipients = Array.from(new Set([
      task.creatorId,
      ...(task.participants || []).map((participant: any) => participant.userId)
    ]));
    await Promise.all(recipients.map((userId: string) =>
      createReminderNotification(
        userId,
        'Reminder นัดหมายใกล้ถึงเวลา',
        `${task.title} เริ่ม ${asDate(task.startAt).toLocaleString('th-TH')}`,
        '/activities'
      )
    ));
    await (tasksColl as any).updateOne({ _id: task._id }, { $set: { reminderSentAt: now, updatedAt: now } });
  }));

  return dueTasks.length;
}
