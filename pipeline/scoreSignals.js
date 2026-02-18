#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const SIGNALS_PATH = path.join(DATA_DIR, 'signals.jsonl');
const OUTPUT_PATH = path.join(DATA_DIR, 'opportunities.jsonl');

const INTERIOR_KEYWORDS = [
  'interior renovation',
  'buildout',
  'tenant improvement',
  'feature wall',
  'lobby upgrade',
  'atrium',
  'core renovation',
  'finish upgrade'
];

const OCCUPANCY_KEYWORDS = [
  'hospitality',
  'hotel',
  'resort',
  'multifamily',
  'apartment',
  'healthcare',
  'clinic',
  'institutional',
  'university',
  'campus'
];

const SQUARE_FOOTAGE_REGEX = /(\d{4,})\s?(sf|square\s?feet|sq\.?\s?ft)/i;
const PROFESSIONAL_KEYWORDS = ['architect', 'architecture', 'designer', 'design', 'general contractor', 'gc'];
const SOUTH_FL_COUNTIES = ['miami-dade', 'broward', 'palm beach'];
const NEG_SINGLE_FAMILY = ['single-family', 'single family', 'residential home'];
const NEG_MECH = ['mechanical only', 'hvac', 'chiller', 'plumbing only'];

function readSignals() {
  if (!fs.existsSync(SIGNALS_PATH)) {
    console.warn('[ScopeFirst][scoreSignals] No signals file found.');
    return [];
  }
  const lines = fs.readFileSync(SIGNALS_PATH, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      console.warn('[ScopeFirst][scoreSignals] Failed to parse line:', line);
      return null;
    }
  }).filter(Boolean);
}

function containsKeyword(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function hasSouthFloridaLocation(record) {
  const location = (record.location || '').toLowerCase();
  return SOUTH_FL_COUNTIES.some((county) => location.includes(county));
}

function isSmallValuation(record) {
  if (typeof record.valuation === 'number') {
    return record.valuation < 150000;
  }
  const desc = `${record.description || ''}`.toLowerCase();
  return desc.includes('<$150k') || desc.includes('minor work');
}

function computeScore(record) {
  const text = `${record.description || ''} ${record.type || ''}`.toLowerCase();
  let score = 0;

  if (containsKeyword(text, INTERIOR_KEYWORDS)) score += 30;
  if (containsKeyword(text, OCCUPANCY_KEYWORDS)) score += 25;
  if (SQUARE_FOOTAGE_REGEX.test(record.description || '')) score += 20;

  const entity = (record.entity || '').toLowerCase();
  if (PROFESSIONAL_KEYWORDS.some((kw) => entity.includes(kw))) score += 15;

  if (hasSouthFloridaLocation(record)) score += 10;

  if (containsKeyword(text, NEG_SINGLE_FAMILY)) score -= 20;
  if (containsKeyword(text, NEG_MECH)) score -= 15;
  if (isSmallValuation(record)) score -= 10;

  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return score;
}

function categorize(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'monitor';
  return 'ignore';
}

function writeOpportunities(records) {
  if (!records.length) {
    fs.writeFileSync(OUTPUT_PATH, '');
    return;
  }
  const lines = records.map((record) => JSON.stringify(record));
  fs.writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`);
}

function main() {
  const signals = readSignals();
  const opportunities = signals.map((record) => {
    const opportunity_score = computeScore(record);
    const category = categorize(opportunity_score);
    if (opportunity_score < 50 || category === 'ignore') return null;
    return {
      ...record,
      opportunity_score,
      category,
    };
  }).filter(Boolean);

  writeOpportunities(opportunities);
  console.log(`[ScopeFirst][scoreSignals] Generated ${opportunities.length} high-value opportunities.`);
}

main();
