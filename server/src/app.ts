import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import auditRoutes from './features/audit/audit.routes';
import authRoutes from './features/auth/auth.routes';
import casesRoutes from './features/cases/cases.routes';
import clarificationsRoutes from './features/clarifications/clarifications.routes';
import notificationsRoutes from './features/notifications/notifications.routes';
import usersRoutes from './features/users/users.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.isDev ? 'dev' : 'combined'));

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        service: 'ayetis-portal-api',
      },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/activity', auditRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/cases', casesRoutes);
  app.use('/api/clarifications', clarificationsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
