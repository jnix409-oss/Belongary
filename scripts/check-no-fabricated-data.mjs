/**
 * Build-time guard: fails if any company has reviewCount > 0
 * while its reviews array is empty. This prevents fabricated
 * aggregate scores from ever shipping.
 *
 * Run via: node scripts/check-no-fabricated-data.mjs
 * Called automatically as part of `npm run build`.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, '../src/data/companies.json');
const companies = JSON.parse(readFileSync(dataPath, 'utf-8'));

let failed = false;

for (const company of companies) {
  const count = company.reviewCount ?? 0;
  const reviews = company.reviews ?? [];

  if (count > 0 && reviews.length === 0) {
    console.error(
      `❌ FABRICATED DATA: "${company.name}" has reviewCount=${count} but reviews array is empty.`
    );
    failed = true;
  }

  if (count !== reviews.length) {
    console.error(
      `❌ COUNT MISMATCH: "${company.name}" has reviewCount=${count} but ${reviews.length} actual reviews.`
    );
    failed = true;
  }
}

if (failed) {
  console.error(
    '\n🚫 Build aborted. Company records must not contain fabricated aggregates.'
  );
  console.error(
    'See CONTRIBUTING.md for details on why this guard exists.\n'
  );
  process.exit(1);
} else {
  console.log(`✅ Data integrity check passed (${companies.length} companies, all reviewCount=0).`);
}
