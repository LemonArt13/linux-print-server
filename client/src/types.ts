export type JobStatus =
  | 'uploaded'
  | 'stored'
  | 'awaiting_setup'
  | 'error'
  | 'queued'
  | 'printing'
  | 'completed'
  | 'cancelled';
export interface HistoryRecord {
  id: string;
  fileName: string;
  status: JobStatus;
  createdAt: string;
  finishedAt: string;
  size?: number;
  message?: string;
}
export type PrintJob = HistoryRecord;
export interface PrinterState {
  status: 'ready' | 'offline';
  printingEnabled: boolean;
  message: string;
}
export interface Settings {
  autoCleanup: boolean;
  retentionDays: 7 | 30 | 90;
}
export const statusLabels: Record<JobStatus, string> = {
  uploaded: 'Завантажено',
  stored: 'Збережено',
  awaiting_setup: 'Очікує налаштування друку',
  error: 'Помилка',
  queued: 'Архів імітації: у черзі',
  printing: 'Архів імітації: обробка',
  completed: 'Архів імітації: завершено',
  cancelled: 'Архів імітації: скасовано',
};
