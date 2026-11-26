import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';

async function bootstrap() {
  try {
    await connectDatabase();
    console.log('[RentFlow] Connected to MongoDB');

    const app = createApp();
    app.listen(env.PORT, () => {
      console.log(`[RentFlow] Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (err) {
    console.error('[RentFlow] Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
