import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5001,
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'sell_nextgen_db',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  env: process.env.NODE_ENV || 'development',
};
