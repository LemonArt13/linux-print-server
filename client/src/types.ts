export type JobStatus = 'queued' | 'printing' | 'completed' | 'error' | 'cancelled';

export interface PrintJob {
  id: string;
  fileName: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PrinterState { printer: 'ready' | 'offline'; message: string; }
export interface HistoryRecord { id: string; fileName: string; status: JobStatus; createdAt: string; finishedAt: string; }
export interface Settings { autoCleanup: boolean; retentionDays: 7 | 30 | 90; }
