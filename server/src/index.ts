import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { startFileColdStorageJobs } from './jobs/fileColdStorage.job';
import { migrateAuthUsers } from './models/migrateAuthUsers';

async function bootstrap() {
  await connectDatabase();
  await migrateAuthUsers();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });

  startFileColdStorageJobs();
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
