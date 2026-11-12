import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { addJob, cancelJob, getJobs } from './printService';
import { cleanupOldHistory, clearHistory, getHistory, getSettings, historyPath, saveSettings } from './historyStore';
import type { Settings } from './types';

const app = express();
const port = Number(process.env.PORT || 4000);
const tokens = new Set<string>();
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_request, file, callback) => {
    const looksLikePdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (!looksLikePdf) return callback(new Error('ONLY_PDF'));
    return callback(null, true);
  },
});

function verifyPdf(file: Express.Multer.File): boolean {
  try { return fs.readFileSync(file.path).subarray(0, 5).toString() === '%PDF-'; }
  catch { return false; }
}

function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token || !tokens.has(token)) { response.status(401).json({ message: 'Потрібна авторизація адміністратора.' }); return; }
  next();
}

app.get('/api/health', (_request, response) => response.json({ printer: 'ready', message: 'Демонстраційний принтер готовий' }));
app.get('/api/jobs', (_request, response) => response.json(getJobs()));

app.post('/api/jobs', upload.array('documents', 10), (request, response) => {
  const files = (request.files || []) as Express.Multer.File[];
  if (!files.length) return response.status(400).json({ message: 'Оберіть від одного до десяти PDF-файлів.' });
  if (files.some((file) => !verifyPdf(file))) { files.forEach((file) => fs.unlink(file.path, () => undefined)); return response.status(400).json({ message: 'Кожен вибраний файл має бути коректним PDF-документом.' }); }
  return response.status(201).json({ jobs: files.map(addJob) });
});

app.delete('/api/jobs/:id', (request, response) => {
  const job = cancelJob(request.params.id);
  if (!job) return response.status(404).json({ message: 'Завдання не знайдено або його вже завершено.' });
  return response.json(job);
});

app.post('/api/admin/login', (request, response) => {
  const expected = process.env.ADMIN_PASSWORD_HASH;
  if (!expected) return response.status(503).json({ message: 'На сервері не налаштовано пароль адміністратора.' });
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  const received = crypto.createHash('sha256').update(password).digest('hex');
  if (received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return response.status(401).json({ message: 'Невірний пароль.' });
  const token = crypto.randomUUID();
  tokens.add(token);
  return response.json({ token });
});

app.get('/api/admin/history', requireAdmin, (_request, response) => response.json(getHistory()));
app.get('/api/admin/history/download', requireAdmin, (_request, response) => { if (!fs.existsSync(historyPath)) fs.writeFileSync(historyPath, '', 'utf8'); response.download(historyPath, 'print-history.txt'); });
app.delete('/api/admin/history', requireAdmin, (_request, response) => { clearHistory(); response.status(204).end(); });
app.get('/api/admin/settings', requireAdmin, (_request, response) => response.json(getSettings()));
app.put('/api/admin/settings', requireAdmin, (request, response) => { const settings = saveSettings((request.body || {}) as Partial<Settings>); cleanupOldHistory(); response.json(settings); });

app.use((error: Error, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) return response.status(400).json({ message: 'Розмір файлу не може перевищувати 10 МБ.' });
  if (error.message === 'ONLY_PDF') return response.status(400).json({ message: 'Дозволено завантажувати лише PDF-файли.' });
  return response.status(500).json({ message: 'Внутрішня помилка сервера.' });
});

cleanupOldHistory();
setInterval(cleanupOldHistory, 24 * 60 * 60 * 1000).unref();
app.listen(port, () => console.log(`API запущено: http://localhost:${port}`));
