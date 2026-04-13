import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { INestApplication } from '@nestjs/common';

export const cleanDatabase = async (app: INestApplication) => {
  if (!app) return;
  const connection: Connection = app.get(getConnectionToken());
  if (!connection) return;
  const collections = connection.collections;

  console.log('Cleaning Database Collections');
  for (const key in collections) {
    const collection = collections[key];
    console.log(`Clearing collection: ${key}`);
    await collection.deleteMany({});
  }
  console.log('Database Cleaned');
};
