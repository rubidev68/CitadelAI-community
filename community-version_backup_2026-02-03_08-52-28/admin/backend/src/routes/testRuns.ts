import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { adminAuthMiddleware, AdminAuthRequest } from '../middleware/adminAuth';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { config } from '../config';

const testRunsLogger = logger.child({ service: 'admin-backend', component: 'testRuns' });

const router = Router();
const JWT_SECRET = config.JWT_SECRET;

const runsDir = path.resolve(process.cwd(), 'backups', 'test-runs');
if (!fs.existsSync(runsDir)) {
  fs.mkdirSync(runsDir, { recursive: true });
}

router.post('/test-runs', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  const id = uuidv4();
  // Build payload, optionally load dataset examples and test user token
  let examples = req.body.examples || [];
  const datasetId = req.body.datasetId || null;

  try {
    // Prefer dataset if provided
    if (datasetId) {
      const ds = await prisma.testDataset.findUnique({ where: { id: datasetId } });
      if (ds && Array.isArray(ds.examples)) {
        examples = ds.examples as Array<{ input: string; expectedOutput?: string }>;
      }
      testRunsLogger.debug('Dataset loaded', { datasetId, loadedExamples: Array.isArray(examples) ? examples.length : 0 });
    } else {
      testRunsLogger.debug('No datasetId provided, using inline examples');
    }
  } catch (_e) {
    testRunsLogger.warn('Failed to load dataset examples', { error: _e instanceof Error ? _e : new Error(String(_e)) });
  }

  // Generate test user token
  let userToken: string | null = null;
  try {
    const adminId = req.adminUser!.id;
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
    if (admin?.testUserId) {
      const testUser = await prisma.user.findUnique({ where: { id: admin.testUserId } });
      if (testUser) {
        userToken = jwt.sign({ userId: testUser.id, email: testUser.email }, JWT_SECRET, { expiresIn: '1h' });
      }
    }
  } catch (_e) {
    testRunsLogger.warn('Failed to create test user token', { error: _e instanceof Error ? _e : new Error(String(_e)) });
  }

  const payload = {
    id,
    chatbotId: req.body.chatbotId,
    blockId: req.body.blockId,
    suites: req.body.suites || { qa: true, rag: true },
    examples: examples || [],
    datasetId,
    userApiBaseUrl: `${config.USER_BACKEND_URL}/api`,
    userToken,
    createdAt: new Date().toISOString()
  };

  const inputPath = path.join(runsDir, `${id}-input.json`);
  fs.writeFileSync(inputPath, JSON.stringify(payload, null, 2), 'utf-8');

  const resultPath = path.join(runsDir, `${id}-result.json`);
  const progressPath = path.join(runsDir, `${id}-progress.json`);
  try {
    fs.writeFileSync(progressPath, JSON.stringify({ processed: 0, total: (examples || []).length }), 'utf-8');
  } catch {}

  // Log start
  try {
    testRunsLogger.info('Test run started', { id, chatbotId: payload.chatbotId, examplesCount: examples?.length || 0 });
  } catch {}
  // Spawn Python worker (best-effort). If Python/DeepEval missing, the script will fallback.
  const pyPath = path.resolve(process.cwd(), 'evaluator', 'run_deepeval.py');
  const logPath = path.join(runsDir, `${id}-worker.log`);
  const logFile = fs.openSync(logPath, 'w');
  try {
    fs.writeFileSync(logPath, `[test-runs] worker start id=${id} pyPath=${pyPath} input=${inputPath} output=${resultPath}\n`, { flag: 'a' });
  } catch {}
  const python = spawn('python3', [pyPath, '--input', inputPath, '--output', resultPath], {
    stdio: ['ignore', logFile, logFile],
    detached: false
  });
  python.on('error', (err) => {
    testRunsLogger.error('Worker spawn error', { id, error: err instanceof Error ? err : new Error(String(err)) });
    try { fs.writeFileSync(logPath, `Spawn error: ${err.message}\n`, { flag: 'a' }); } catch {}
  });
  python.on('exit', (code) => {
    testRunsLogger.info('Worker exit', { id, exitCode: code });
    try { fs.writeFileSync(logPath, `[test-runs] worker exit code=${code}\n`, { flag: 'a' }); } catch {}
    try { fs.closeSync(logFile); } catch {}
  });
  python.unref();

  res.json({ id, status: 'queued', total: (examples || []).length });
});

router.get('/test-runs/:id', adminAuthMiddleware, (req, res) => {
  const { id } = req.params;
  const resultPath = path.join(runsDir, `${id}-result.json`);
  const progressPath = path.join(runsDir, `${id}-progress.json`);
  if (fs.existsSync(resultPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
      return res.json({ id, status: 'completed', ...data });
    } catch {
      return res.status(500).json({ error: 'Failed to read results' });
    }
  }
  if (fs.existsSync(progressPath)) {
    try {
      const prog = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      return res.json({ id, status: 'running', processed: prog.processed, total: prog.total });
    } catch {}
  }
  return res.json({ id, status: 'running' });
});

// Expose worker log for debugging
router.get('/test-runs/:id/log', adminAuthMiddleware, (req, res) => {
  const { id } = req.params;
  const logPath = path.join(runsDir, `${id}-worker.log`);
  if (!fs.existsSync(logPath)) {
    return res.status(404).json({ error: 'Log not found' });
  }
  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    res.type('text/plain').send(content);
  } catch (_e) {
    res.status(500).json({ error: 'Failed to read log' });
  }
});

// Export test run results as CSV (matches frontend expectation: /test-runs/:id/export)
router.get('/test-runs/:id/export', adminAuthMiddleware, (req, res) => {
  const { id } = req.params;
  const resultPath = path.join(runsDir, `${id}-result.json`);
  if (!fs.existsSync(resultPath)) {
    return res.status(404).json({ error: 'Results not found' });
  }
  try {
    const data = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
    const cases = Array.isArray(data.cases) ? data.cases : [];
    const header = 'question,expected,actual,answerRelevancy,ragRetrieval,expectedSources,foundCitations,passed\n';
    const rows = cases.map((c: Record<string, unknown>) => {
      const toCsv = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const metrics = c?.metrics as {
        expectedSources?: unknown[];
        foundCitations?: unknown[];
        ragRetrieval?: number;
        answerRelevancy?: unknown;
      } | undefined;
      const expectedSources = (metrics?.expectedSources || []).join('; ');
      const foundCitations = (metrics?.foundCitations || []).join('; ');
      const rag = typeof metrics?.ragRetrieval === 'number' ? metrics.ragRetrieval : '';
      return [
        toCsv(c?.question),
        toCsv(c?.expected),
        toCsv(c?.actual),
        toCsv(metrics?.answerRelevancy),
        toCsv(rag),
        toCsv(expectedSources),
        toCsv(foundCitations),
        toCsv(c?.passed),
      ].join(',');
    });
    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="test-run-${id}.csv"`);
    return res.status(200).send(csv);
  } catch (_e) {
    return res.status(500).json({ error: 'Failed to export CSV' });
  }
});

export default router;
