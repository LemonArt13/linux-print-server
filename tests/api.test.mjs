import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, readdir, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scryptSync, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import net from 'node:net';

test('production API: isolated documents, authentication, restart and SPA', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'printflow-test-'));
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  let child;
  const start = async () => {
    child = spawn(process.execPath, ['server/dist/index.js'], {
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        DATA_DIR: path.join(root, 'data'),
        UPLOAD_DIR: path.join(root, 'uploads'),
        ADMIN_PASSWORD_HASH: `scrypt:${'ab'.repeat(16)}:${scryptSync('isolated-test-password', 'ab'.repeat(16), 64).toString('hex')}`,
        SESSION_TTL_SECONDS: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let logs = '';
    child.stderr.on('data', (data) => {
      logs += data;
    });
    for (let i = 0; i < 80; i++) {
      if (child.exitCode !== null) throw new Error(logs);
      try {
        if ((await fetch(`${base}/api/health`)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Startup timeout');
  };
  const stop = async () => {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  };
  const login = async () =>
    (
      await (
        await fetch(`${base}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'isolated-test-password' }),
        })
      ).json()
    ).token;
  const upload = async (content, name = 'test.pdf') => {
    const form = new FormData();
    form.append('documents', new Blob([content], { type: 'application/pdf' }), name);
    return fetch(`${base}/api/jobs`, { method: 'POST', body: form });
  };
  try {
    await start();
    assert.equal((await (await fetch(`${base}/api/health`)).json()).printingEnabled, false);
    for (const route of ['/', '/admin']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /html/);
    }
    const missing = await fetch(`${base}/api/missing`);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /json/);
    for (const [route, method] of [
      ['/history', 'GET'], ['/history', 'DELETE'], ['/history/download', 'GET'],
      ['/settings', 'GET'], ['/settings', 'PUT'], ['/logout', 'POST'],
    ]) {
      assert.equal((await fetch(`${base}/api/admin${route}`, { method })).status, 401);
    }
    assert.equal(
      (
        await fetch(`${base}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"password":"wrong"}',
        })
      ).status,
      401,
    );
    const response = await upload('%PDF-1.4\n%%EOF\n', 'перевірка.pdf');
    assert.equal(response.status, 201);
    const { jobs } = await response.json();
    assert.equal(jobs[0].status, 'awaiting_setup');
    assert.equal((await (await fetch(`${base}/api/jobs`)).json()).length, 0);
    assert.equal((await (await fetch(`${base}/api/jobs?ids=${jobs[0].id}`)).json()).length, 1);
    assert.equal(
      await readFile(path.join(root, 'uploads', jobs[0].id + '.pdf'), 'utf8'),
      '%PDF-1.4\n%%EOF\n',
    );
    assert.equal((await upload('invalid')).status, 400);
    assert.equal((await readdir(path.join(root, 'uploads'))).length, 1);
    const token = await login();
    const headers = { Authorization: `Bearer ${token}` };
    const history = await (await fetch(`${base}/api/admin/history`, { headers })).json();
    assert.equal(history.length, 2);
    assert.match(
      await (await fetch(`${base}/api/admin/history/download`, { headers })).text(),
      /awaiting_setup/,
    );
    const saveSettings = (settings) => fetch(`${base}/api/admin/settings`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    assert.equal((await saveSettings({ autoCleanup: true, retentionDays: 1 })).status, 400);
    assert.deepEqual(await (await saveSettings({ autoCleanup: true, retentionDays: 7 })).json(), {
      autoCleanup: true, retentionDays: 7,
    });
    assert.equal(
      (await fetch(`${base}/api/admin/logout`, { method: 'POST', headers })).status,
      204,
    );
    assert.equal((await fetch(`${base}/api/admin/history`, { headers })).status, 401);
    const expiring = await login();
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(
      (
        await fetch(`${base}/api/admin/history`, {
          headers: { Authorization: `Bearer ${expiring}` },
        })
      ).status,
      401,
    );
    await stop();
    // Simulate a stop after a final result was saved but before its PDF was deleted.
    const finishedId = randomUUID();
    await appendFile(
      path.join(root, 'data', 'print-history.txt'),
      JSON.stringify({ ...jobs[0], id: finishedId, status: 'completed' }) + '\n',
    );
    await writeFile(path.join(root, 'uploads', `${finishedId}.pdf`), '%PDF-1.4\n%%EOF\n');
    await start();
    assert.equal(
      (await (await fetch(`${base}/api/jobs?ids=${jobs[0].id}`)).json())[0].status,
      'awaiting_setup',
    );
    assert.deepEqual(await readdir(path.join(root, 'uploads')), [`${jobs[0].id}.pdf`]);
    assert.equal(
      (await (await fetch(`${base}/api/jobs?ids=${finishedId}`)).json())[0].status,
      'completed',
    );
    const restartedHeaders = { Authorization: `Bearer ${await login()}` };
    assert.deepEqual(await (await fetch(`${base}/api/admin/settings`, { headers: restartedHeaders })).json(), {
      autoCleanup: true, retentionDays: 7,
    });
    assert.equal((await fetch(`${base}/api/admin/history`, { method: 'DELETE', headers: restartedHeaders })).status, 204);
    assert.deepEqual(await (await fetch(`${base}/api/admin/history`, { headers: restartedHeaders })).json(), []);
    assert.deepEqual(await readdir(path.join(root, 'uploads')), [`${jobs[0].id}.pdf`]);
  } finally {
    await stop();
    await rm(root, { recursive: true, force: true });
  }
});
