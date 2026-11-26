import mongoose from 'mongoose';
import { env } from './env.js';

let cachedSupportsTransactions: boolean | null = null;

export async function connectDatabase(uri?: string): Promise<typeof mongoose> {
  const targetUri =
    uri || (env.NODE_ENV === 'test' ? env.MONGODB_TEST_URI : env.MONGODB_URI);

  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(targetUri);

  // Detect whether MongoDB deployment supports multi-document transactions (replica set / mongos)
  try {
    const admin = conn.connection.db?.admin();
    if (admin) {
      const hello = await admin.command({ hello: 1 });
      cachedSupportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
    }
  } catch {
    cachedSupportsTransactions = false;
  }

  return conn;
}

export function supportsTransactions(): boolean {
  return Boolean(cachedSupportsTransactions);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  cachedSupportsTransactions = null;
}
