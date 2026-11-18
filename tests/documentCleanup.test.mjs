import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('finished PDFs are deleted, history and pending documents survive, failures are retried', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'printflow-cleanup-'));
  process.env.DATA_DIR = path.join(root, 'data');
  process.env.UPLOAD_DIR = path.join(root, 'uploads');
  const require = createRequire(import.meta.url);
  const store = require('../server/dist/historyStore.js');
  const addDocument = (status = 'awaiting_setup') => {
    const record = {
      id: randomUUID(),
      fileName: 'документ.pdf',
      status,
      createdAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
    store.addHistory([record]);
    const filePath = path.join(store.uploadDir, `${record.id}.pdf`);
    writeFileSync(filePath, '%PDF-1.4\n%%EOF\n');
    return { record, filePath };
  };
  try {
    const waiting = ['awaiting_setup', 'uploaded', 'stored', 'queued', 'printing'].map(addDocument);
    for (const outcome of ['completed', 'error', 'cancelled']) {
      const { record, filePath } = addDocument();
      store.finishPrintJob(record.id, outcome, 'Printer reported final state');
      assert.equal(existsSync(filePath), false);
      const saved = store.getHistory().find((value) => value.id === record.id);
      assert.equal(saved.status, outcome);
      assert.equal(saved.fileName, record.fileName);
      assert.equal(saved.message, 'Printer reported final state');
      assert.doesNotThrow(() => store.finishPrintJob(record.id, outcome));
      const otherOutcome = outcome === 'completed' ? 'error' : 'completed';
      assert.throws(() => store.finishPrintJob(record.id, otherOutcome));
    }

    // A crash between persisting a result and deleting the PDF leaves this state.
    const interrupted = addDocument('completed');
    const failed = addDocument();
    rmSync(failed.filePath);
    mkdirSync(failed.filePath);
    assert.throws(() => store.finishPrintJob(failed.record.id, 'error'));
    assert.equal(store.getHistory().find((value) => value.id === failed.record.id).status, 'error');
    assert.throws(() => store.clearHistory(), /DOCUMENT_CLEANUP_FAILED/);
    assert.ok(store.getHistory().length > 0);
    assert.equal(existsSync(interrupted.filePath), false);
    rmSync(failed.filePath, { recursive: true });
    writeFileSync(failed.filePath, '%PDF-1.4\n%%EOF\n');
    store.cleanupFinishedDocuments();
    assert.equal(existsSync(failed.filePath), false);
    assert.doesNotThrow(() => store.cleanupFinishedDocuments());
    for (const { filePath } of waiting) assert.equal(existsSync(filePath), true);

    assert.throws(() => store.finishPrintJob(randomUUID(), 'completed'), /DOCUMENT_NOT_FOUND/);
    assert.throws(
      () => store.finishPrintJob(waiting[0].record.id, 'printing'),
      /INVALID_PRINT_OUTCOME/,
    );

    const outside = path.join(root, 'outside.pdf');
    writeFileSync(outside, 'keep');
    store.addHistory([{ ...waiting[0].record, id: '../outside', status: 'completed' }]);
    store.cleanupFinishedDocuments();
    assert.equal(existsSync(outside), true);

    // Retention must not orphan a pending PDF by removing its only history entry.
    const oldDate = new Date(Date.now() - 31 * 86400000).toISOString();
    const oldPending = { ...waiting[0].record, id: randomUUID(), createdAt: oldDate, finishedAt: oldDate };
    const oldFinished = { ...oldPending, id: randomUUID(), status: 'completed' };
    store.addHistory([oldPending, oldFinished]);
    const pendingPath = path.join(store.uploadDir, `${oldPending.id}.pdf`);
    writeFileSync(pendingPath, '%PDF-1.4\n%%EOF\n');
    store.saveSettings({ autoCleanup: true, retentionDays: 30 });
    assert.equal(store.cleanupOldHistory(), 1);
    assert.ok(store.getHistory().some((record) => record.id === oldPending.id));
    assert.equal(existsSync(pendingPath), true);
    assert.ok(!store.getHistory().some((record) => record.id === oldFinished.id));
    store.clearHistory();
    assert.equal(store.getHistory().length, 0);
    for (const { filePath } of waiting) assert.equal(existsSync(filePath), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
