import { Router } from 'express';
import multer from 'multer';
import { adminAuthMiddleware, AdminAuthRequest } from '../middleware/adminAuth';
import prisma from '../lib/prisma';
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// List datasets for current admin user (optionally filter by chatbotId)
router.get('/test-datasets', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const adminId = req.adminUser!.id;
    const { chatbotId } = req.query as { chatbotId?: string };
    const where: { ownerId: string; chatbotId?: string } = { ownerId: adminId };
    if (chatbotId) where.chatbotId = chatbotId;
    const datasets = await prisma.testDataset.findMany({ where, orderBy: { updatedAt: 'desc' } });
    res.json(datasets);
  } catch {
    res.status(500).json({ error: 'Failed to fetch datasets' });
  }
});

// Create dataset
router.post('/test-datasets', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const adminId = req.adminUser!.id;
    const { name, examples, chatbotId } = req.body;
    if (!name || !Array.isArray(examples)) return res.status(400).json({ error: 'Invalid payload' });
    const ds = await prisma.testDataset.create({ data: { name, examples, ownerId: adminId, chatbotId } });
    res.status(201).json(ds);
  } catch {
    res.status(500).json({ error: 'Failed to create dataset' });
  }
});

// Update dataset (name/examples)
router.put('/test-datasets/:id', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const adminId = req.adminUser!.id;
    const { id } = req.params;
    const { name, examples } = req.body;
    const existing = await prisma.testDataset.findFirst({ where: { id, ownerId: adminId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const ds = await prisma.testDataset.update({ where: { id }, data: { name, examples } });
    res.json(ds);
  } catch {
    res.status(500).json({ error: 'Failed to update dataset' });
  }
});

// Delete dataset
router.delete('/test-datasets/:id', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const adminId = req.adminUser!.id;
    const { id } = req.params;
    const existing = await prisma.testDataset.findFirst({ where: { id, ownerId: adminId } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.testDataset.delete({ where: { id } });
    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: 'Failed to delete dataset' });
  }
});

// CSV utilities
function toCsvValue(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function parseCsv(content: string): Array<{ question: string; answer: string; expectedSources?: string[] }> {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const first = lines[0];
  const hasHeader = /question/i.test(first) && /answer/i.test(first);
  const rows = hasHeader ? lines.slice(1) : lines;
  const result: Array<{ question: string; answer: string; expectedSources?: string[] }> = [];
  for (const row of rows) {
    // Simple CSV split supporting quotes
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (inQuotes) {
        if (ch === '"') {
          if (row[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = false; }
        } else { cur += ch; }
      } else {
        if (ch === ',') { cols.push(cur); cur = ''; }
        else if (ch === '"') { inQuotes = true; }
        else { cur += ch; }
      }
    }
    cols.push(cur);
    const [q = '', a = '', sources = ''] = cols.map(c => c.trim());
    if (!q && !a) continue;
    const expectedSources = sources ? sources.split(/\s*;\s*|\s*,\s*/).filter(Boolean) : undefined;
    result.push({ question: q, answer: a, expectedSources });
  }
  return result;
}

// Import dataset from CSV (matches frontend expectation: /test-datasets/import)
router.post('/test-datasets/import', adminAuthMiddleware, upload.single('file'), async (req: AdminAuthRequest, res) => {
  try {
    const adminId = req.adminUser!.id;
    const name = (req.body?.name as string) || 'Imported Dataset';
    const chatbotId = (req.body?.chatbotId as string) || undefined;
    if (!req.file) return res.status(400).json({ error: 'CSV file required' });
    const content = req.file.buffer.toString('utf-8');
    const examples = parseCsv(content);
    const ds = await prisma.testDataset.create({ data: { name, ownerId: adminId, chatbotId, examples } });
    res.status(201).json(ds);
  } catch (_e) {
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

// Export dataset as CSV (matches frontend expectation: /test-datasets/:id/export)
router.get('/test-datasets/:id/export', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const adminId = req.adminUser!.id;
    const { id } = req.params;
    const ds = await prisma.testDataset.findFirst({ where: { id, ownerId: adminId } });
    if (!ds) return res.status(404).json({ error: 'Not found' });
    const examples = (Array.isArray(ds.examples) ? ds.examples : []) as Array<{ question: string; answer: string; expectedSources?: string[] }>;
    const header = 'question,answer,expectedSources\n';
    const rows = examples.map(ex => [
      toCsvValue(ex.question),
      toCsvValue(ex.answer),
      toCsvValue((ex.expectedSources || []).join('; ')),
    ].join(','));
    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dataset-${id}.csv"`);
    res.status(200).send(csv);
  } catch {
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

export default router;
