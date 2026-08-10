import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { startFileColdStorageJobs } from './jobs/fileColdStorage.job';
import { startCaseLifecycleJobs } from './jobs/caseLifecycle.job';
import { migrateAuthUsers } from './models/migrateAuthUsers';
import { migrateCaseManagement } from './models/migrateCaseManagement';
import { migrateCorporateHierarchy } from './models/migrateCorporateHierarchy';

async function bootstrap() {
  await connectDatabase();
  await migrateAuthUsers();
  await migrateCaseManagement();
  await migrateCorporateHierarchy();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });

  startFileColdStorageJobs();
  startCaseLifecycleJobs();
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
