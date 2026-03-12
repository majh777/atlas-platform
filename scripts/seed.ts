import { seed } from '../src/lib/db/seed';

seed()
  .then(() => {
    console.log('Seed data inserted successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
