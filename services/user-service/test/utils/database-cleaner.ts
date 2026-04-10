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

    for (const { table_name } of tableNames) {
      await dataSource.query(`TRUNCATE TABLE "${table_name}" CASCADE;`);
    }
  } catch (error) {
    console.error('Error cleaning test database:', error.message);
  }
};
