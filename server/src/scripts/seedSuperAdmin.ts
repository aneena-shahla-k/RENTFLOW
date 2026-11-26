import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

async function seedSuperAdmin() {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to run development Super Admin seed in production.');
    process.exit(1);
  }

  const email = env.DEV_SUPERADMIN_EMAIL;
  const password = env.DEV_SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Set DEV_SUPERADMIN_EMAIL and DEV_SUPERADMIN_PASSWORD in server/.env');
    process.exit(1);
  }

  await connectDatabase();

  const existing = await User.findOne({ email: email.toLowerCase() });
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    existing.role = 'super_admin';
    existing.passwordHash = passwordHash;
    existing.isEmailVerified = true;
    existing.active = true;
    await existing.save();
    console.log(`[Seed] Updated dev Super Admin: ${email}`);
  } else {
    await User.create({
      name: 'RentFlow Platform Admin',
      email: email.toLowerCase(),
      phone: '+91 90000 00001',
      passwordHash,
      role: 'super_admin',
      isEmailVerified: true,
      active: true,
    });
    console.log(`[Seed] Created dev Super Admin: ${email}`);
  }

  await disconnectDatabase();
}

seedSuperAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
