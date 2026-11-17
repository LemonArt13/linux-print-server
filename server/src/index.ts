import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { registerDocuments, recordRejection, verifyPdf } from './printService';
import {
  cleanupOldHistory,
  cleanupFinishedDocuments,
  clearHistory,
  getHistory,
  getSettings,
  saveSettings,
  uploadDir,
} from './historyStore';
import { login, logout, requireAdmin } from './auth';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024, files: 10, fields: 0, parts: 11 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf'))
      return callback(new Error('ONLY_PDF'));
    callback(null, true);
  },
});
app.get('/api/health', (_req, res) =>
  res.json({
    status: 'ready',
    printingEnabled: false,
    message: 'Сервер приймає документи. Фізичний друк не налаштовано.',
  }),
);
// Only documents whose random IDs are known to this browser are shown publicly.
app.get('/api/jobs', (req, res) => {
  const ids = new Set(
    String(req.query.ids || '')
      .split(',')
      .slice(0, 100),
  );
  res.json(getHistory().filter((record) => ids.has(record.id)));
});
app.post('/api/jobs', upload.array('documents', 10), (req, res, next) => {
  const files = (req.files || []) as Express.Multer.File[];
  try {
    if (!files.length)
      return res.status(400).json({ message: 'Оберіть від одного до десяти PDF-файлів.' });
    if (!files.every(verifyPdf)) {
      const message = 'Невірна сигнатура PDF. Пакет файлів не збережено.';
      recordRejection(files, message);
      return res.status(400).json({ message });
    }
    return res.status(201).json({ jobs: registerDocuments(files) });
  } catch (error) {
    next(error);
  } finally {
    files.forEach((file) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
  }
});
app.post('/api/admin/login', login);
app.use('/api/admin', requireAdmin);
app.post('/api/admin/logout', logout);
app.get('/api/admin/history', (_req, res) => res.json(getHistory()));
app.get('/api/admin/history/download', (_req, res) => {
  res
    .type('text/plain; charset=utf-8')
    .attachment('document-history.txt')
    .send(
      getHistory()
        .map((record) => JSON.stringify(record))
        .join('\n') + '\n',
    );
});
app.delete('/api/admin/history', (_req, res) => {
  clearHistory();
  res.status(204).end();
});
app.get('/api/admin/settings', (_req, res) => res.json(getSettings()));
app.put('/api/admin/settings', (req, res) => {
  const value = saveSettings(req.body || {});
  cleanupOldHistory();
  res.json(value);
});
app.use('/api', (_req, res) => res.status(404).json({ message: 'API-маршрут не знайдено.' }));

const clientDir = path.resolve(
  process.env.CLIENT_DIST_DIR || path.join(__dirname, '../../client/dist'),
);
if (fs.existsSync(path.join(clientDir, 'index.html'))) {
  app.use(express.static(clientDir));
  app.get(['/', '/admin'], (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Розмір файлу не може перевищувати 10 МБ.'
        : 'Дозволено від 1 до 10 PDF у полі documents без додаткових полів.';
    return res.status(400).json({ message });
  }
  if (error.message === 'ONLY_PDF')
    return res.status(400).json({ message: 'Дозволено лише PDF-файли.' });
  if (error.message === 'INVALID_SETTINGS' || error instanceof SyntaxError)
    return res.status(400).json({ message: 'Некоректні дані запиту або налаштувань.' });
  console.error(
    'Request failed:',
    error.name,
    error.message === 'INVALID_HISTORY' ? error.message : 'storage or server failure',
  );
  return res
    .status(500)
    .json({ message: 'Не вдалося зберегти або прочитати дані. Зверніться до адміністратора.' });
});
try {
  cleanupOldHistory();
} catch {
  console.error('Initial history or document cleanup failed; cleanup will be retried.');
}
setInterval(() => {
  try {
    cleanupFinishedDocuments();
  } catch {
    console.error('Finished document cleanup failed; cleanup will be retried.');
  }
}, 60000).unref();
setInterval(() => {
  try {
    cleanupOldHistory();
  } catch {
    console.error('History cleanup failed');
  }
}, 86400000).unref();
const server = app.listen(Number(process.env.PORT || 4000), process.env.HOST || '127.0.0.1', () =>
  console.log('PrintFlow HTTP server started'),
);
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
