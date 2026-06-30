import { MongoClient } from 'mongodb';
import { config } from './index.js';
import { seedDatabase } from './seed.js';

const client = new MongoClient(config.mongodb.uri);

try {
  await client.connect();
  const db = client.db(config.mongodb.dbName);
  await seedDatabase(db);
  console.log('[seed]: Completed');
} finally {
  await client.close();
}
