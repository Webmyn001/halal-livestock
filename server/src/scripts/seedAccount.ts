import { randomInt } from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { hashPassword, User, type UserRole } from '../models/User';
import { loadSettings } from '../models/PlatformSettings';
import { toE164 } from '../utils/phone';

/**
 * Self registration only ever creates a buyer or a farmer, so staff accounts have to be made here.
 *   npm run seed:account -- --role admin --email you@example.com --name "Your Name" --phone 08031234567
 * Omit --password and a one time password is printed once, which you should change after signing in.
 */
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const ALLOWED: UserRole[] = ['admin', 'driver', 'buyer', 'farmer'];

function oneTimePassword(): string {
  return `Halal${randomInt(100_000, 999_999)}`;
}

async function main(): Promise<void> {
  const role = arg('role') as UserRole | undefined;
  const email = arg('email')?.toLowerCase();
  const fullName = arg('name');
  const phoneNumber = arg('phone');
  const password = arg('password') ?? oneTimePassword();
  const activate = process.argv.includes('--activate');

  if (!role || !email || !fullName || !phoneNumber) {
    console.error('Usage: npm run seed:account -- --role admin|driver --email x@y.com --name "Full Name" --phone 08031234567 [--password ...] [--activate]');
    process.exit(1);
  }
  if (!ALLOWED.includes(role)) {
    console.error(`Role must be one of ${ALLOWED.join(', ')}`);
    process.exit(1);
  }

  await connectDatabase();
  await loadSettings();

  const existing = await User.findOne({ email });
  if (existing && !activate) {
    console.error(`An account already uses ${email} (role ${existing.role}).`);
    await disconnectDatabase();
    process.exit(1);
  }

  if (existing) {
    existing.role = role;
    existing.isActive = true;
    existing.tokenVersion += 1;
    await existing.save();
    console.log(`Promoted ${email} to ${role}. Any existing session was ended.`);
  } else {
    await User.create({
      email,
      fullName,
      phoneNumber: toE164(phoneNumber),
      passwordHash: await hashPassword(password),
      role,
      // Staff skip the email and phone loop because there is no one else to approve them.
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    console.log(`Created ${role} account ${email}`);
    if (!arg('password')) console.log(`One time password: ${password}`);
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
