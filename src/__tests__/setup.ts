import { connectDatabase, disconnectDatabase } from '../database/connection';

beforeAll(async () => {
  await connectDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
});

// Clear all collections before each test
beforeEach(async () => {
  const { default: mongoose } = await import('mongoose');
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    const collection = collections[key];
    if (collection) {
      await collection.deleteMany({});
    }
  }
});
