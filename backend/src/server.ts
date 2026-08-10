import app from './app.js';
import { config } from './config/index.js';
import { connectToMongoDB } from './config/mongodb.js';
import { seedDatabase } from './config/seed.js';
import { sendDueTaskReminders } from './services/reminder-scheduler.service.js';

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;

async function startServer() {
  console.log('[server]: Connecting to database...');
  const db = await connectToMongoDB();

  if (db) {
    try {
      await seedDatabase(db);
    } catch (err) {
      console.error('[seed]: Database seed failed:', err);
    }
  }

  app.listen(config.port, () => {
    console.log(`[server]: NEXTGEN Sale & Support backend is running on port ${config.port}`);
    setInterval(() => {
      sendDueTaskReminders()
        .then(count => {
          if (count > 0) console.log(`[reminders]: sent ${count} due task reminder(s)`);
        })
        .catch(err => console.error('[reminders]: scheduler error', err));
    }, REMINDER_INTERVAL_MS);
  });
}

startServer().catch((error) => {
  console.error('[server]: Fatal startup error:', error);
  process.exit(1);
});
