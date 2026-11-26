import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env.js';
import { sanitizeBody } from './middleware/validate.middleware.js';
import activityLogRoutes from './routes/activityLog.routes.js';
import authRoutes from './routes/auth.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import categoryRoutes from './routes/category.routes.js';
import companyRoutes from './routes/company.routes.js';
import customerRoutes from './routes/customer.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import deliveryRoutes from './routes/delivery.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import productRoutes from './routes/product.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import returnRoutes from './routes/return.routes.js';
import reviewRoutes from './routes/review.routes.js';
import staffRoutes from './routes/staff.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import superadminRoutes from './routes/superadmin.routes.js';
import supportRoutes from './routes/support.routes.js';
import { errorMiddleware } from './utils/errors.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  const allowedOrigins = env.CLIENT_URL.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    })
  );

  if (env.NODE_ENV !== 'test') {
    app.use(
      '/api/auth',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
    app.use(
      '/api',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 1000,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );
  }

  // Raw body support for payment webhooks + standard JSON parser
  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(sanitizeBody);

  // Serve local uploads safely
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      service: 'RentFlow API',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/returns', returnRoutes);
  app.use('/api/deliveries', deliveryRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/activity-logs', activityLogRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/superadmin', superadminRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'API endpoint not found.',
      code: 'NOT_FOUND',
    });
  });

  app.use(errorMiddleware);

  return app;
}
