import cors from 'cors';
import express, { type Request } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';
import { LOCAL_UPLOAD_ROOT } from './services/imageStore';

export function createApp() {
  const app = express();

  // Runs behind a reverse proxy in production deployments.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Images are read by the web app, which sits on a different origin to this API.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    })
  );
  // The Paystack webhook is proved by an HMAC over the exact bytes sent, so they are kept.
  app.use(
    express.json({
      limit: '100kb',
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    })
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
  });

  // Development fallback for STORAGE_PROVIDER=local. Cloudinary serves its own files in production.
  if (env.STORAGE_PROVIDER === 'local') {
    app.use('/uploads', express.static(LOCAL_UPLOAD_ROOT, { index: false, dotfiles: 'deny', maxAge: '1h' }));
  }

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
