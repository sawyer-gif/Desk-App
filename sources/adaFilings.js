function buildAdaRecords(count = 4) {
  const now = Date.now();
  return Array.from({ length: count }).map((_, idx) => ({
    id: `ada-filing:${now}-${idx}`,
    source: 'ada-filings',
    type: 'ada-upgrade',
    location: 'Florida ADA Bulletin',
    description: 'Accessibility compliance filing detected via public notice.',
    entity: 'Facilities Manager',
    detected_at: new Date(now - idx * 180000).toISOString(),
    confidence_score: 0.55,
  }));
}

async function ingest({ since }) {
  const sinceDate = since instanceof Date ? since : new Date(Date.now() - 24 * 60 * 60 * 1000);
  return buildAdaRecords().filter((record) => new Date(record.detected_at) >= sinceDate);
}

const adapter = {
  name: 'adaFilings',
  ingest,
};

export default adapter;
