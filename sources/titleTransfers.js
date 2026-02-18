const fs = require('fs');
const path = require('path');

const SAMPLE_DATA_PATH = path.resolve(__dirname, '..', 'data', 'samples', 'title-transfers.json');

function loadSampleTransfers() {
  try {
    if (fs.existsSync(SAMPLE_DATA_PATH)) {
      const raw = fs.readFileSync(SAMPLE_DATA_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[ScopeFirst][titleTransfers] Unable to load sample transfers:', err.message);
  }
  const now = Date.now();
  return Array.from({ length: 3 }).map((_, idx) => ({
    folio: `stub-folio-${now}-${idx}`,
    address: 'Unknown commercial parcel',
    buyer: 'Confidential',
    seller: 'Confidential',
    recorded: new Date(now - idx * 3600000).toISOString(),
  }));
}

function normalize(record) {
  const detected = record.recorded || new Date().toISOString();
  return {
    id: `title-transfer:${record.folio || record.address || Math.random().toString(36).slice(2)}`,
    source: 'title-transfers',
    type: 'title-transfer',
    location: record.address || 'Florida (commercial parcel)',
    description: `Ownership change recorded for folio ${record.folio || 'n/a'}.`,
    entity: `${record.buyer || 'Buyer'} ← ${record.seller || 'Seller'}`,
    detected_at: detected,
    confidence_score: 0.62,
  };
}

async function ingest({ since }) {
  const sinceDate = since instanceof Date ? since : new Date(Date.now() - 48 * 60 * 60 * 1000);
  const sample = loadSampleTransfers();
  return sample
    .map(normalize)
    .filter((record) => new Date(record.detected_at) >= sinceDate);
}

module.exports = {
  name: 'titleTransfers',
  ingest,
};
