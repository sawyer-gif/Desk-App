#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(process.env.HOME || '.', 'scopefirst/logs');
const LOCK_PATH = path.resolve(process.env.HOME || '.', 'scopefirst/ingestion.lock');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function createLock() {
  if (fs.existsSync(LOCK_PATH)) {
    try {
      const existingPid = parseInt(fs.readFileSync(LOCK_PATH, 'utf8'), 10);
      if (!Number.isNaN(existingPid)) {
        try {
          process.kill(existingPid, 0);
          console.log(`[ScopeFirst] Another ingestion run is active (pid ${existingPid}). Skipping.`);
          process.exit(0);
        } catch (_) {
          console.warn(`[ScopeFirst] Stale lock detected for pid ${existingPid}. Removing.`);
        }
      }
    } catch (err) {
      console.warn('[ScopeFirst] Unable to read lock file:', err.message);
    }
    try {
      fs.unlinkSync(LOCK_PATH);
    } catch (err) {
      console.error('[ScopeFirst] Failed to remove lock file:', err.message);
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
    console.warn('[ScopeFirst] Failed to remove lock file during cleanup:', err.message);
  }
}

async function loadAdapters() {
  const adaptersDir = path.resolve(__dirname, '..', 'ingestion', 'adapters');
  if (!fs.existsSync(adaptersDir)) {
    console.warn('[ScopeFirst] No adapters directory found. Nothing to ingest.');
    return [];
  }

  const files = fs.readdirSync(adaptersDir).filter((file) => file.endsWith('.js'));
  return files.map((file) => {
    const adapter = require(path.join(adaptersDir, file));
    if (typeof adapter.run !== 'function') {
      throw new Error(`Adapter ${file} must export a run() function.`);
    }
    return { name: file, run: adapter.run };
  });
}

async function runAdapters(adapters) {
  for (const adapter of adapters) {
    const start = Date.now();
    console.log(`[ScopeFirst] Running adapter ${adapter.name}...`);
    await adapter.run();
    console.log(`[ScopeFirst] Completed adapter ${adapter.name} in ${Date.now() - start}ms.`);
  }
}

async function main() {
  ensureLogDir();
  createLock();

  try {
    const adapters = await loadAdapters();
    if (adapters.length === 0) {
      console.log('[ScopeFirst] No adapters registered. Exiting.');
      return;
    }
    await runAdapters(adapters);
    console.log('[ScopeFirst] Ingestion run complete.');
  } catch (err) {
    console.error('[ScopeFirst] Ingestion failed:', err);
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
