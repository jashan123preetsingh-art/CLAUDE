// JSON-file storage layer with atomic writes + in-memory cache
const fs = require('fs');
const path = require('path');

const cache = new Map();
const writeLocks = new Map();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback) {
  if (cache.has(file)) return cache.get(file);
  try {
    if (!fs.existsSync(file)) {
      if (fallback !== undefined) writeJSON(file, fallback);
      return fallback;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    cache.set(file, data);
    return data;
  } catch (e) {
    console.error(`[storage] read error ${file}:`, e.message);
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  // atomic write: write tmp, rename
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
  cache.set(file, data);
}

function update(file, fn, fallback) {
  const current = readJSON(file, fallback);
  const next = fn(current);
  writeJSON(file, next);
  return next;
}

function invalidate(file) {
  cache.delete(file);
}

// Simple collection helpers
class Collection {
  constructor(file) {
    this.file = file;
    if (!fs.existsSync(file)) writeJSON(file, []);
  }
  all() { return readJSON(this.file, []); }
  find(fn) { return this.all().find(fn); }
  filter(fn) { return this.all().filter(fn); }
  insert(item) {
    const id = item.id || Date.now() + Math.floor(Math.random() * 1000);
    const record = { id, createdAt: new Date().toISOString(), ...item };
    update(this.file, list => [...list, record], []);
    return record;
  }
  updateById(id, patch) {
    let updated = null;
    update(this.file, list => list.map(x => {
      if (x.id === id) { updated = { ...x, ...patch, updatedAt: new Date().toISOString() }; return updated; }
      return x;
    }), []);
    return updated;
  }
  removeById(id) {
    update(this.file, list => list.filter(x => x.id !== id), []);
    return true;
  }
  count() { return this.all().length; }
}

module.exports = { ensureDir, readJSON, writeJSON, update, invalidate, Collection };
