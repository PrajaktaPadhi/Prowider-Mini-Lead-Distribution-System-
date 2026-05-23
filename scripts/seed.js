import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

// Import models
import Service from '../src/lib/models/Service.js';
import Provider from '../src/lib/models/Provider.js';
import RoundRobinState from '../src/lib/models/RoundRobinState.js';
import { DEFAULT_MONTHLY_QUOTA } from '../src/lib/config.js';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env.local');
  process.exit(1);
}

async function seed() {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Seed Services
  const services = [
    { name: 'Service 1', slug: 'service-1' },
    { name: 'Service 2', slug: 'service-2' },
    { name: 'Service 3', slug: 'service-3' },
  ];

  for (const svc of services) {
    await Service.findOneAndUpdate(
      { slug: svc.slug },
      svc,
      { upsert: true, new: true }
    );
  }
  console.log('✅ Services seeded');

  // Seed Providers
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (let i = 1; i <= 8; i++) {
    await Provider.findOneAndUpdate(
      { name: `Provider ${i}` },
      {
        name: `Provider ${i}`,
        monthlyQuota: DEFAULT_MONTHLY_QUOTA,
        leadsReceived: 0,
        quotaResetMonth: currentMonth,
      },
      { upsert: true, new: true }
    );
  }
  console.log('✅ Providers seeded (8 total, quota: 10 each)');

  // Seed Round Robin State
  const servicesSlugs = ['service-1', 'service-2', 'service-3'];
  for (const slug of servicesSlugs) {
    await RoundRobinState.findOneAndUpdate(
      { serviceSlug: slug },
      { serviceSlug: slug, nextIndex: 0 },
      { upsert: true, new: true }
    );
  }
  console.log('✅ Round-robin state initialized');

  console.log('\n🎉 Seed complete!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
