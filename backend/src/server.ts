import app from './app.js';
import { config } from './config/index.js';
import { connectToMongoDB } from './config/mongodb.js';
import { seedDatabase } from './config/seed.js';

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
  });
}

startServer().catch((error) => {
  console.error('[server]: Fatal startup error:', error);
  process.exit(1);
});
