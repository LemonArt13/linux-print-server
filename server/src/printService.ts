import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { addHistory, uploadDir } from './historyStore';
import type { HistoryRecord } from './types';

function normalizeFileName(name: string): string {
  const decoded = /[ÐÑ]/.test(name) ? Buffer.from(name, 'latin1').toString('utf8') : name;
  return (
    path
      .basename(decoded.includes('�') ? name : decoded)
      .replace(/[\r\n\x00-\x1f]/g, '')
      .slice(0, 255) || 'document.pdf'
  );
}
export function verifyPdf(file: Express.Multer.File): boolean {
  const fd = fs.openSync(file.path, 'r');
  try {
    const header = Buffer.alloc(5);
    return fs.readSync(fd, header, 0, 5, 0) === 5 && header.toString('ascii') === '%PDF-';
  } finally {
    fs.closeSync(fd);
  }
}
export function registerDocuments(files: Express.Multer.File[]): HistoryRecord[] {
  const now = new Date().toISOString();
  const records = files.map(
    (file): HistoryRecord => ({
      id: crypto.randomUUID(),
      fileName: normalizeFileName(file.originalname),
      size: file.size,
      status: 'awaiting_setup',
      createdAt: now,
      finishedAt: now,
      message: 'PDF збережено. Очікує налаштування друку; фізичний друк не виконується.',
    }),
  );
  const moved: string[] = [];
  try {
    files.forEach((file, index) => {
      const target = path.join(uploadDir, `${records[index].id}.pdf`);
      fs.renameSync(file.path, target);
      fs.chmodSync(target, 0o600);
      moved.push(target);
    });
    addHistory(records);
    return records;
  } catch (error) {
    // Only files created by this unsuccessful request are removed.
    moved.forEach((target) => {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    });
    throw error;
  }
}
export function recordRejection(files: Express.Multer.File[], message: string): void {
  const now = new Date().toISOString();
  addHistory(
    files.map((file) => ({
      id: crypto.randomUUID(),
      fileName: normalizeFileName(file.originalname),
      size: file.size,
      status: 'error',
      createdAt: now,
      finishedAt: now,
      message,
    })),
  );
}
