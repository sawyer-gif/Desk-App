const fetchJSON = (...args) => globalThis.fetch(...args);

const DATASET_URL = 'https://opendata.miamidade.gov/resource/ez6s-2jyt.json';
const FALLBACK_RECORD_LIMIT = 5;

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeRecord(record) {
  const permitNumber = record.permit_number || record.permit || record.id;
  const issueDate = parseDate(record.issue_date || record.submitted || record.fileddate || record.last_status_date);
  const address = [record.job_location, record.address, record.project_address]
    .filter(Boolean)
    .join(' ')
    .trim();

  const description = record.work_description || record.scope_of_work || record.description || 'Permit application';
  const contractor = record.contractor_name || record.applicant || record.company || 'Unknown contractor';

  return {
    id: `miami-dade:permit:${permitNumber || address || Math.random().toString(36).slice(2)}`,
    source: 'miami-dade-permits',
    type: 'permit',
    location: address || 'Miami-Dade County, FL',
    description,
    entity: contractor,
    detected_at: issueDate ? issueDate.toISOString() : new Date().toISOString(),
    confidence_score: 0.72,
  };
}

async function fetchRemoteRecords() {
  const params = new URLSearchParams({
    '$limit': '100',
    '$order': 'issue_date DESC',
  });

  const response = await fetchJSON(`${DATASET_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Miami-Dade permit API responded with ${response.status}`);
  }
  return response.json();
}

function buildFallbackRecords() {
  const now = new Date();
  return Array.from({ length: FALLBACK_RECORD_LIMIT }).map((_, idx) => ({
    id: `miami-dade:fallback:permit:${now.getTime()}-${idx}`,
    source: 'miami-dade-permits',
    type: 'permit',
    location: 'Miami-Dade County, FL',
    description: 'Synthetic permit placeholder generated due to data fetch failure.',
    entity: 'Unknown contractor',
    detected_at: new Date(now.getTime() - idx * 60000).toISOString(),
    confidence_score: 0.2,
  }));
}

async function ingest({ since }) {
  const sinceDate = since instanceof Date ? since : new Date(Date.now() - 6 * 60 * 60 * 1000);
  try {
    const raw = await fetchRemoteRecords();
    return raw
      .map(normalizeRecord)
      .filter((record) => new Date(record.detected_at) >= sinceDate);
  } catch (error) {
    console.error('[ScopeFirst][miamiDadePermits] Failed to fetch remote data:', error.message);
    return buildFallbackRecords();
  }
}

const adapter = {
  name: 'miamiDadePermits',
  ingest,
};

export default adapter;
