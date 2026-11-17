export type JobStatus = 'uploaded' | 'stored' | 'awaiting_setup' | 'error';
export type PrintOutcome = 'completed' | 'error' | 'cancelled';
export interface HistoryRecord {
  id: string;
  fileName: string;
  status: JobStatus | 'queued' | 'printing' | 'completed' | 'cancelled';
  createdAt: string;
  finishedAt: string;
  size?: number;
  message?: string;
}
export interface Settings {
  autoCleanup: boolean;
  retentionDays: 7 | 30 | 90;
}
