function buildStubRecords(label, count = 3) {
  const now = Date.now();
  return Array.from({ length: count }).map((_, idx) => ({
    id: `fl-public:${label}:${now}-${idx}`,
    source: 'florida-public-records',
    type: label,
    location: 'Florida, USA',
    description: `${label.replace(/-/g, ' ')} public record placeholder`,
    entity: 'Municipal Clerk',
    detected_at: new Date(now - idx * 120000).toISOString(),
    confidence_score: 0.35,
  }));
}

async function ingest({ since }) {
  const sinceDate = since instanceof Date ? since : new Date(Date.now() - 12 * 60 * 60 * 1000);
  const templates = ['construction-notice', 'zoning-filing', 'development-application'];
  const records = templates.flatMap((label) => buildStubRecords(label));
  return records.filter((record) => new Date(record.detected_at) >= sinceDate);
}

const adapter = {
  name: 'floridaPublicRecords',
  ingest,
};

export default adapter;
