import fs from 'node:fs';
import crypto from 'node:crypto';
import { addHistory } from './historyStore';
import type { PrintJob, PublicJob } from './types';

const jobs: PrintJob[] = [];
let processing = false;
let activeTimer: NodeJS.Timeout | null = null;

function normalizeFileName(name: string): string {
  if (!/[ÐÑ]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

function publicJob(job: PrintJob): PublicJob {
  const { filePath: _filePath, ...safeJob } = job;
  return safeJob;
}

function removeTempFile(job: PrintJob): void { fs.unlink(job.filePath, () => undefined); }

function recordJob(job: PrintJob): void {
  addHistory({ id: job.id, fileName: job.fileName, status: job.status, createdAt: job.createdAt, finishedAt: new Date().toISOString() });
}

function advanceQueue(): void {
  if (processing) return;
  const next = jobs.find((job) => job.status === 'queued');
  if (!next) return;
  processing = true;
  next.status = 'printing';
  next.updatedAt = new Date().toISOString();
  activeTimer = setTimeout(() => {
    next.status = 'completed';
    next.updatedAt = new Date().toISOString();
    recordJob(next);
    removeTempFile(next);
    processing = false;
    activeTimer = null;
    setTimeout(advanceQueue, 350);
  }, 3500);
}

export function addJob(file: Express.Multer.File): PublicJob {
  const job: PrintJob = { id: crypto.randomUUID(), fileName: normalizeFileName(file.originalname), filePath: file.path, status: 'queued', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  jobs.push(job);
  setTimeout(advanceQueue, 250);
  return publicJob(job);
}

export function getJobs(): PublicJob[] { return jobs.map(publicJob); }

export function cancelJob(id: string): PublicJob | null {
  const job = jobs.find((item) => item.id === id);
  if (!job || ['completed', 'error', 'cancelled'].includes(job.status)) return null;
  if (job.status === 'printing') { if (activeTimer) clearTimeout(activeTimer); activeTimer = null; processing = false; }
  job.status = 'cancelled';
  job.updatedAt = new Date().toISOString();
  recordJob(job);
  removeTempFile(job);
  setTimeout(advanceQueue, 250);
  return publicJob(job);
}
