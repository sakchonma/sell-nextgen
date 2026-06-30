import { MongoClient, Db } from 'mongodb';
import { config } from './index.js';

let client: MongoClient | null = null;
let db: Db | null = null;
let isMocked = false;
let memoryReason = '';
let lastConnectionError = '';

// Respect env flag for mock DB
const useMockEnv = process.env.USE_MOCK_DB === 'true';
const isProduction = config.env === 'production';
const allowMemoryDb = process.env.ALLOW_MEMORY_DB === undefined
  ? !isProduction
  : process.env.ALLOW_MEMORY_DB === 'true';
console.log('[mongodb]: USE_MOCK_DB flag is', useMockEnv);
console.log('[mongodb]: ALLOW_MEMORY_DB flag is', allowMemoryDb);

function enterMemoryMode(reason: string, errorMessage = '') {
  isMocked = true;
  memoryReason = reason;
  lastConnectionError = errorMessage;
}

function assertMemoryFallbackAllowed(reason: string, errorMessage = '') {
  if (!allowMemoryDb) {
    const suffix = errorMessage ? ` Original error: ${errorMessage}` : '';
    throw new Error(`${reason}. Memory DB fallback is disabled. Set ALLOW_MEMORY_DB=true only for temporary non-production recovery.${suffix}`);
  }
}

export async function connectToMongoDB(): Promise<Db | null> {
  if (db) return db;

  // If mock mode is forced via env, skip real connection
  if (useMockEnv) {
    assertMemoryFallbackAllowed('USE_MOCK_DB=true requested');
    enterMemoryMode('USE_MOCK_DB=true');
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
    assertMemoryFallbackAllowed('MongoDB connection failed', error.message);
    console.warn(`[mongodb]: Failed to connect to MongoDB (${error.message}). Falling back to local in-memory simulation because ALLOW_MEMORY_DB=true.`);
    enterMemoryMode('MongoDB connection failed', error.message);
    return null;
  }
}

export function getDbStatus() {
  // If env forces mock, ensure flag reflects it
  if (useMockEnv && allowMemoryDb) enterMemoryMode('USE_MOCK_DB=true');
  const usingMemory = !db;
  return {
    connected: !!db,
    isMocked: isMocked || (useMockEnv && allowMemoryDb),
    mode: db ? 'mongodb' : 'memory',
    dbName: config.mongodb.dbName,
    env: config.env,
    memoryAllowed: allowMemoryDb,
    memoryWriteBlocked: usingMemory && !allowMemoryDb,
    reason: db ? 'MongoDB connected' : memoryReason || 'MongoDB is not connected; using local in-memory fallback',
    lastConnectionError: lastConnectionError || undefined
  };
}

export { db, client };
