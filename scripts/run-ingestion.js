#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sources from '../sources/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOME = process.env.HOME || '.';
const LOG_DIR = path.resolve(HOME, 'scopefirst/logs');
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const STATE_DIR = path.join(DATA_DIR, 'state');
const SIGNALS_PATH = path.join(DATA_DIR, 'signals.jsonl');
const SEEN_PATH = path.join(STATE_DIR, 'seen-records.json');
const LOCK_PATH = path.resolve(HOME, 'scopefirst/ingestion.lock');

function ensureDirectories() {
  [LOG_DIR, DATA_DIR, STATE_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  if (!fs.existsSync(SIGNALS_PATH)) {
    fs.writeFileSync(SIGNALS_PATH, '');
  }
}

function loadJSON(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.warn(`[ScopeFirst] Failed to read ${filePath}:`, err.message);
  }
  return typeof fallback === 'function' ? fallback() : fallback;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[ScopeFirst] Failed to write ${filePath}:`, err.message);
  }
}

function createLock() {
  if (fs.existsSync(LOCK_PATH)) {
    try {
      const existingPid = parseInt(fs.readFileSync(LOCK_PATH, 'utf8'), 10);
      if (!Number.isNaN(existingPid)) {
        try {
          process.kill(existingPid, 0);
          console.log(`[ScopeFirst] Another ingestion run (${existingPid}) is active. Skipping.`);
          process.exit(0);
        } catch (_) {
          console.warn(`[ScopeFirst] Removing stale lock for pid ${existingPid}.`);
        }
      }
    } catch (err) {
      console.warn('[ScopeFirst] Unable to inspect lock file:', err.message);
    }
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch (err) {
      console.error('[ScopeFirst] Failed to remove existing lock:', err.message);
      process.exit(1);
    }
  }
  fs.writeFileSync(LOCK_PATH, String(process.pid));
}

function removeLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  } catch (err) {
    console.warn('[ScopeFirst] Unable to remove lock file on exit:', err.message);
  }
}

function loadSeenRecords() {
  const list = loadJSON(SEEN_PATH, []);
  return new Set(Array.isArray(list) ? list : []);
}

function persistSeenRecords(seen) {
  saveJSON(SEEN_PATH, Array.from(seen));
}

function loadAdapterState(name) {
  const statePath = path.join(STATE_DIR, `${name}.json`);
  return loadJSON(statePath, {});
}

function saveAdapterState(name, payload) {
  const statePath = path.join(STATE_DIR, `${name}.json`);
  saveJSON(statePath, payload);
}

function appendSignals(records) {
  if (!records.length) return;
  const lines = records.map((record) => JSON.stringify(record));
  fs.appendFileSync(SIGNALS_PATH, `${lines.join('\n')}\n`);
}

async function runAdapter(adapter, seen) {
  const state = loadAdapterState(adapter.name);
  const since = state.lastRun ? new Date(state.lastRun) : new Date(Date.now() - 24 * 60 * 60 * 1000);

  console.log(`[ScopeFirst] Ingesting ${adapter.name} (since ${since.toISOString()})`);
  const records = await adapter.ingest({ since });
  const deduped = records.filter((record) => record && record.id && !seen.has(record.id));

  if (deduped.length) {
    appendSignals(deduped);
    deduped.forEach((record) => seen.add(record.id));
    console.log(`[ScopeFirst] ${adapter.name}: stored ${deduped.length} new signals.`);
  } else {
    console.log(`[ScopeFirst] ${adapter.name}: no new signals.`);
  }

  saveAdapterState(adapter.name, { lastRun: new Date().toISOString() });
}

async function main() {
  ensureDirectories();
  createLock();
  const seen = loadSeenRecords();

  try {
    for (const adapter of sources) {
      try {
        await runAdapter(adapter, seen);
      } catch (err) {
        console.error(`[ScopeFirst] Adapter ${adapter.name} failed:`, err);
      }
    }
    persistSeenRecords(seen);
    console.log('[ScopeFirst] Ingestion cycle complete.');
  } catch (err) {
    console.error('[ScopeFirst] Ingestion run failed:', err);
    process.exitCode = 1;
  } finally {
    removeLock();
  }
}

process.on('SIGINT', () => {
  removeLock();
  process.exit(0);
});

process.on('SIGTERM', () => {
  removeLock();
  process.exit(0);
});

main();
