export type JobStatus = 'queued' | 'printing' | 'completed' | 'error' | 'cancelled';

export interface PrintJob {
  id: string;
  fileName: string;
  filePath: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}

export type PublicJob = Omit<PrintJob, 'filePath'>;

export interface HistoryRecord {
  id: string;
  fileName: string;
  status: JobStatus;
  createdAt: string;
  finishedAt: string;
}

export interface Settings {
  autoCleanup: boolean;
  retentionDays: 7 | 30 | 90;
}
