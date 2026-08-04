import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { startFileColdStorageJobs } from './jobs/fileColdStorage.job';

async function bootstrap() {
  await connectDatabase();

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
