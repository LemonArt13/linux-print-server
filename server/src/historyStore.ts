import fs from 'node:fs';
import path from 'node:path';
import type { HistoryRecord, Settings } from './types';

const dataDir = path.join(__dirname, '..', 'data');
export const historyPath = path.join(dataDir, 'print-history.txt');
const settingsPath = path.join(dataDir, 'settings.json');
const defaultSettings: Settings = { autoCleanup: false, retentionDays: 30 };

function ensureFiles(): void {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(historyPath)) fs.writeFileSync(historyPath, '', 'utf8');
  if (!fs.existsSync(settingsPath)) fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf8');
}

export function getHistory(): HistoryRecord[] {
  ensureFiles();
  return fs.readFileSync(historyPath, 'utf8').split('\n').filter(Boolean).flatMap((line): HistoryRecord[] => {
    try { return [JSON.parse(line) as HistoryRecord]; } catch { return []; }
  }).sort((first, second) => new Date(second.finishedAt).getTime() - new Date(first.finishedAt).getTime());
}

export function addHistory(record: HistoryRecord): void {
  ensureFiles();
  fs.appendFileSync(historyPath, `${JSON.stringify(record)}\n`, 'utf8');
}

export function clearHistory(): void { ensureFiles(); fs.writeFileSync(historyPath, '', 'utf8'); }

export function getSettings(): Settings {
  ensureFiles();
  try { return { ...defaultSettings, ...(JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Partial<Settings>) }; }
  catch { return { ...defaultSettings }; }
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const retentionDays = Number(settings.retentionDays);
  const clean: Settings = { autoCleanup: Boolean(settings.autoCleanup), retentionDays: ([7, 30, 90].includes(retentionDays) ? retentionDays : 30) as Settings['retentionDays'] };
  fs.writeFileSync(settingsPath, JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

export function cleanupOldHistory(): number {
  const settings = getSettings();
  if (!settings.autoCleanup) return 0;
  const cutoff = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;
  const current = getHistory();
  const fresh = current.filter((item) => new Date(item.finishedAt).getTime() >= cutoff);
  const removed = current.length - fresh.length;
  if (removed) fs.writeFileSync(historyPath, fresh.map((item) => JSON.stringify(item)).join('\n') + (fresh.length ? '\n' : ''), 'utf8');
  return removed;
}
