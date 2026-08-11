import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { startFileColdStorageJobs } from './jobs/fileColdStorage.job';
import { startCaseLifecycleJobs } from './jobs/caseLifecycle.job';
import { startSlaMonitorJobs } from './jobs/slaMonitor.job';
import { migrateAuthUsers } from './models/migrateAuthUsers';
import { migrateCaseManagement } from './models/migrateCaseManagement';
import { migrateCorporateHierarchy } from './models/migrateCorporateHierarchy';

async function bootstrap() {
  await connectDatabase();
  await migrateAuthUsers();
  await migrateCaseManagement();
  await migrateCorporateHierarchy();
  const { seedSettingsData } = await import('./features/settings/settings.service');
  await seedSettingsData();
  const { seedRoleDefinitions } = await import('./features/rbac/rbac.service');
  await seedRoleDefinitions();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });

  startFileColdStorageJobs();
  startCaseLifecycleJobs();
  startSlaMonitorJobs();
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
