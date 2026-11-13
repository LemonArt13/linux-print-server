import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { HistoryRecord, Settings } from './types';

export const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
export const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
export const historyPath = path.join(dataDir, 'print-history.txt');
const settingsPath = path.join(dataDir, 'settings.json');
const defaults: Settings = { autoCleanup: false, retentionDays: 30 };
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });

// One Node process owns this store. Synchronous read/replace operations cannot interleave.
// Rename replaces a complete file; failed writes leave the previous version intact.
function atomicWrite(target: string, contents: string): void {
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, contents, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, target);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function getHistory(): HistoryRecord[] {
  if (!fs.existsSync(historyPath)) return [];
  return fs.readFileSync(historyPath, 'utf8').split('\n').filter(Boolean).map((line) => {
    const value = JSON.parse(line) as HistoryRecord;
    if (!value.id || !value.fileName || !value.createdAt || !value.finishedAt || !value.status) throw new Error('INVALID_HISTORY');
    return value;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function addHistory(records: HistoryRecord[]): void {
  const current = getHistory();
  atomicWrite(historyPath, [...current, ...records].map((record) => JSON.stringify(record)).join('\n') + '\n');
}
export function clearHistory(): void { atomicWrite(historyPath, ''); }
export function getSettings(): Settings {
  if (!fs.existsSync(settingsPath)) return { ...defaults };
  return { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
}
export function saveSettings(value: Partial<Settings>): Settings {
  if (typeof value.autoCleanup !== 'boolean' || ![7, 30, 90].includes(Number(value.retentionDays))) throw new Error('INVALID_SETTINGS');
  const settings: Settings = { autoCleanup: value.autoCleanup, retentionDays: Number(value.retentionDays) as Settings['retentionDays'] };
  atomicWrite(settingsPath, JSON.stringify(settings, null, 2));
  return settings;
}
export function cleanupOldHistory(): number {
  const settings = getSettings();
  if (!settings.autoCleanup) return 0;
  const current = getHistory();
  const cutoff = Date.now() - settings.retentionDays * 86400000;
  const fresh = current.filter((record) => new Date(record.finishedAt).getTime() >= cutoff);
  if (fresh.length !== current.length) atomicWrite(historyPath, fresh.map((record) => JSON.stringify(record)).join('\n') + (fresh.length ? '\n' : ''));
  return current.length - fresh.length;
}
