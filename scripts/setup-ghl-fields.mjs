/**
 * Setup script: Create custom fields in GHL for Bulldogg Jetski booking form.
 * Run once: npm run setup:ghl
 *
 * Requires GHL_API_KEY and GHL_LOCATION_ID in .env.local
 */

import { writeFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!GHL_API_KEY || !LOCATION_ID) {
  console.error('Missing GHL_API_KEY or GHL_LOCATION_ID in .env.local');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  'Content-Type': 'application/json',
  Version: '2021-07-28',
};

// Custom fields that GHL doesn't have built-in
const FIELDS = [
  {
    key: 'pakke',
    name: 'Pakke',
    dataType: 'SINGLE_OPTIONS',
    options: ['Timepris', 'Halvdag', 'Heldag', 'Helgutleie'],
  },
  {
    key: 'antall_vannscootere',
    name: 'Antall vannscootere',
    dataType: 'SINGLE_OPTIONS',
    options: ['1', '2', '3', '4', '5+'],
  },
  {
    key: 'oensket_dato',
    name: 'Ønsket dato',
    dataType: 'DATE',
  },
  {
    key: 'melding',
    name: 'Melding',
    dataType: 'LARGE_TEXT',
  },
];

async function createField(field) {
  const body = {
    name: field.name,
    dataType: field.dataType,
    model: 'contact',
    ...(field.options && { options: field.options }),
  };

  const res = await fetch(`${API_BASE}/locations/${LOCATION_ID}/customFields`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to create field "${field.name}": ${res.status} ${err}`);
    return null;
  }

  const data = await res.json();
  console.log(`Created: ${field.name} → id: ${data.customField.id}, key: ${data.customField.fieldKey}`);
  return {
    id: data.customField.id,
    fieldKey: data.customField.fieldKey,
    dataType: field.dataType,
  };
}

async function main() {
  console.log('Creating custom fields in GHL...\n');

  const mapping = {};
  for (const field of FIELDS) {
    const result = await createField(field);
    if (result) {
      mapping[field.key] = result;
    }
    // Rate limit pause
    await new Promise((r) => setTimeout(r, 350));
  }

  const outputPath = 'src/data/ghl-fields.json';
  writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
  console.log(`\nField mapping saved to ${outputPath}`);
  console.log('Import this file in your Netlify Function to reference field IDs.');
}

main().catch(console.error);
