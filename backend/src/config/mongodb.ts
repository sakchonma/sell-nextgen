import { MongoClient, Db } from 'mongodb';
import { config } from './index.js';

let client: MongoClient | null = null;
let db: Db | null = null;
let isMocked = false;

// Respect env flag for mock DB
const useMockEnv = process.env.USE_MOCK_DB === 'true';
console.log('[mongodb]: USE_MOCK_DB flag is', useMockEnv);

export async function connectToMongoDB(): Promise<Db | null> {
  if (db) return db;

  // If mock mode is forced via env, skip real connection
  if (useMockEnv) {
    isMocked = true;
    console.warn('[mongodb]: Mock DB forced by USE_MOCK_DB env; skipping MongoDB connection.');
    return null;
  }

  try {
    client = new MongoClient(config.mongodb.uri, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db(config.mongodb.dbName);
    console.log(`[mongodb]: Connected to MongoDB at [${config.mongodb.dbName}]`);
    return db;
  } catch (error: any) {
    console.warn(`[mongodb]: Failed to connect to MongoDB (${error.message}). Falling back to local in-memory simulation.`);
    isMocked = true;
    return null;
  }
}

export function getDbStatus() {
  // If env forces mock, ensure flag reflects it
  if (useMockEnv) isMocked = true;
  return { isMocked, connected: !!db };
}

export { db, client };
