import type { PrintJob, PrinterState, Settings, HistoryRecord } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Не вдалося виконати запит.');
  }
  return response;
}

export const api = {
  health: async (): Promise<PrinterState> => (await request('/health')).json(),
  jobs: async (): Promise<PrintJob[]> => (await request('/jobs')).json(),
  upload: async (files: File[]): Promise<{ jobs: PrintJob[] }> => {
    const form = new FormData();
    files.forEach((file) => form.append('documents', file));
    return (await request('/jobs', { method: 'POST', body: form })).json();
  },
  cancel: async (id: string): Promise<PrintJob> => (await request(`/jobs/${id}`, { method: 'DELETE' })).json(),
  login: async (password: string): Promise<{ token: string }> => (await request('/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })).json(),
  admin: async (path: string, token: string, options: RequestInit = {}): Promise<Response> => request(`/admin${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  }),
};

export type { Settings, HistoryRecord };
