import { DataSource } from 'typeorm';

export const cleanDatabase = async (dataSource: DataSource) => {
  if (!dataSource || !dataSource.isInitialized) {
    console.warn('Skipping database cleaning: DataSource not initialized or undefined.');
    return;
  }

  try {
    const tableNames: { table_name: string }[] = await dataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name != 'migrations';
    `);

    if (tableNames.length === 0) return;

    const tables = tableNames
      .map(({ table_name }) => `"${table_name}"`)
      .join(', ');
    await dataSource.query(`TRUNCATE TABLE ${tables} CASCADE;`);
  } catch (error) {
    console.error('Error cleaning test database:', error.message);
  }
};
