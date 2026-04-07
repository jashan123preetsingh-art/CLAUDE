// Veltrix AI — Full-fledged AI agency backend
const express = require('express');
const path = require('path');
const { Collection, readJSON, writeJSON, ensureDir } = require('./lib/storage');
const { validate } = require('./lib/validators');
const { rateLimit } = require('./lib/rateLimit');
const { logger, requestLogger, asyncHandler, errorHandler } = require('./lib/logger');
const seed = require('./data/seed');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'veltrix2026';
const NODE_ENV = process.env.NODE_ENV || 'development';

const DATA_DIR = path.join(__dirname, 'data');
ensureDir(DATA_DIR);

// Paths
const F = {
  waitlist: path.join(DATA_DIR, 'waitlist.json'),
  contacts: path.join(DATA_DIR, 'contacts.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  newsletter: path.join(DATA_DIR, 'newsletter.json'),
  analytics: path.join(DATA_DIR, 'analytics.json'),
  services: path.join(DATA_DIR, 'services.json'),
  packages: path.join(DATA_DIR, 'packages.json'),
  testimonials: path.join(DATA_DIR, 'testimonials.json'),
  caseStudies: path.join(DATA_DIR, 'case-studies.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
};

// Seed static catalog (overwritten on each boot to stay canonical)
writeJSON(F.services, seed.services);
writeJSON(F.packages, seed.packages);
writeJSON(F.testimonials, seed.testimonials);
writeJSON(F.caseStudies, seed.caseStudies);
if (!require('fs').existsSync(F.settings)) writeJSON(F.settings, seed.settings);

// Dynamic collections
const waitlist = new Collection(F.waitlist);
const contacts = new Collection(F.contacts);
const orders = new Collection(F.orders);
const newsletter = new Collection(F.newsletter);
const analytics = new Collection(F.analytics);

// Middleware
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use(requestLogger);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// CORS (permissive for public API; admin still requires password)
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Admin-Password');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: NODE_ENV === 'production' ? '1h' : 0 }));

// Auth
function requireAdmin(req, res, next) {
  const pw = req.headers['x-admin-password'] || req.query.password || req.body?.password;
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ====================================================================
// PUBLIC APIS
// ====================================================================

// ---- Health ----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Veltrix AI',
    version: '2.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ---- Public settings ----
app.get('/api/settings/public', (req, res) => {
  const s = readJSON(F.settings, seed.settings);
  res.json({
    companyName: s.companyName,
    tagline: s.tagline,
    startingPrice: s.startingPrice,
    phone: s.phone,
    email: s.email,
    whatsappNumber: s.whatsappNumber,
    location: s.location,
    primaryColor: s.primaryColor,
    accentColor: s.accentColor,
  });
});

// ---- Public stats (live social proof) ----
app.get('/api/stats/public', (req, res) => {
  res.json({
    totalProjects: 127 + orders.count(),
    activeClients: 42,
    countriesServed: 14,
    servicesOffered: readJSON(F.services, []).length,
    avgDeliveryHours: 48,
    clientRetention: 98,
  });
});

// ---- Catalogs ----
app.get('/api/services', (req, res) => {
  const { category } = req.query;
  let list = readJSON(F.services, []);
  if (category) list = list.filter(s => s.category === category);
  res.json({ count: list.length, items: list });
});

app.get('/api/services/:slug', (req, res) => {
  const item = readJSON(F.services, []).find(s => s.slug === req.params.slug);
  if (!item) return res.status(404).json({ error: 'Service not found' });
  res.json(item);
});

app.get('/api/packages', (req, res) => {
  res.json({ items: readJSON(F.packages, []) });
});

app.get('/api/testimonials', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 50);
  res.json({ items: readJSON(F.testimonials, []).slice(0, limit) });
});

app.get('/api/case-studies', (req, res) => {
  res.json({ items: readJSON(F.caseStudies, []) });
});

app.get('/api/case-studies/:slug', (req, res) => {
  const item = readJSON(F.caseStudies, []).find(c => c.slug === req.params.slug);
  if (!item) return res.status(404).json({ error: 'Case study not found' });
  res.json(item);
});

// ---- Waitlist ----
app.post('/api/waitlist',
  rateLimit({ windowMs: 60000, max: 5, keyPrefix: 'wl' }),
  asyncHandler((req, res) => {
    const { valid, errors, data } = validate({
      name: { required: true, min: 2, max: 80 },
      email: { required: true, type: 'email', max: 254 },
      phone: { type: 'phone', max: 30 },
      service: { max: 80, default: 'general' },
      source: { max: 40, default: 'website' },
    }, req.body);
    if (!valid) return res.status(400).json({ error: 'Validation failed', details: errors });

    if (waitlist.find(e => e.email.toLowerCase() === data.email.toLowerCase())) {
      return res.status(409).json({ error: 'You are already on the waitlist' });
    }
    const rec = waitlist.insert({ ...data, status: 'new', joinedAt: new Date().toISOString() });
    logger.info('New waitlist signup', { email: data.email });
    res.json({ success: true, message: 'You are on the waitlist!', position: waitlist.count(), id: rec.id });
  })
);

app.get('/api/waitlist/count', (req, res) => {
  res.json({ count: waitlist.count() });
});

// ---- Contact form ----
app.post('/api/contact',
  rateLimit({ windowMs: 60000, max: 5, keyPrefix: 'ct' }),
  asyncHandler((req, res) => {
    const { valid, errors, data } = validate({
      name: { required: true, min: 2, max: 80 },
      email: { required: true, type: 'email' },
      phone: { type: 'phone', max: 30 },
      service: { max: 80 },
      budget: { max: 40 },
      message: { max: 2000 },
      source: { max: 40, default: 'contact-form' },
    }, req.body);
    if (!valid) return res.status(400).json({ error: 'Validation failed', details: errors });
    const rec = contacts.insert({ ...data, status: 'new', submittedAt: new Date().toISOString() });
    logger.info('New contact submission', { email: data.email, service: data.service });
    res.json({ success: true, message: 'Message received. We reply within 24 hours.', id: rec.id });
  })
);

// ---- Order / Project request ----
app.post('/api/order',
  rateLimit({ windowMs: 60000, max: 3, keyPrefix: 'or' }),
  asyncHandler((req, res) => {
    const { valid, errors, data } = validate({
      name: { required: true, min: 2, max: 80 },
      email: { required: true, type: 'email' },
      phone: { type: 'phone', max: 30 },
      company: { max: 120 },
      serviceSlug: { required: true, max: 60 },
      packageTier: { max: 40, default: 'custom' },
      budget: { max: 40 },
      timeline: { max: 40 },
      brief: { required: true, min: 10, max: 3000 },
      referenceUrl: { type: 'url', max: 300 },
    }, req.body);
    if (!valid) return res.status(400).json({ error: 'Validation failed', details: errors });

    const service = readJSON(F.services, []).find(s => s.slug === data.serviceSlug);
    if (!service) return res.status(400).json({ error: 'Invalid serviceSlug' });

    const rec = orders.insert({
      ...data,
      serviceName: service.name,
      status: 'new',
      priority: 'normal',
      orderNumber: 'VX-' + Date.now().toString(36).toUpperCase(),
    });
    logger.info('New order', { orderNumber: rec.orderNumber, service: service.name });
    res.json({
      success: true,
      message: 'Your project request is in. We will reach out within 12 hours.',
      orderNumber: rec.orderNumber,
      id: rec.id,
    });
  })
);

// ---- Newsletter ----
app.post('/api/newsletter',
  rateLimit({ windowMs: 60000, max: 5, keyPrefix: 'nl' }),
  asyncHandler((req, res) => {
    const { valid, errors, data } = validate({
      email: { required: true, type: 'email' },
      source: { max: 40, default: 'footer' },
    }, req.body);
    if (!valid) return res.status(400).json({ error: 'Validation failed', details: errors });
    if (newsletter.find(e => e.email.toLowerCase() === data.email.toLowerCase())) {
      return res.status(409).json({ error: 'Already subscribed' });
    }
    newsletter.insert({ ...data, status: 'active', subscribedAt: new Date().toISOString() });
    res.json({ success: true, message: 'Subscribed. Weekly AI growth tips incoming.' });
  })
);

app.post('/api/newsletter/unsubscribe', asyncHandler((req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const sub = newsletter.find(e => e.email.toLowerCase() === email);
  if (!sub) return res.status(404).json({ error: 'Not subscribed' });
  newsletter.updateById(sub.id, { status: 'unsubscribed', unsubscribedAt: new Date().toISOString() });
  res.json({ success: true, message: 'Unsubscribed' });
}));

// ---- Analytics tracking (lightweight) ----
app.post('/api/analytics/track',
  rateLimit({ windowMs: 60000, max: 60, keyPrefix: 'an' }),
  (req, res) => {
    const { event, page, meta } = req.body || {};
    if (!event || typeof event !== 'string') return res.status(400).json({ error: 'event required' });
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
    const ipHash = require('crypto').createHash('sha256').update(ip + 'veltrix').digest('hex').slice(0, 16);
    analytics.insert({
      event: String(event).slice(0, 60),
      page: String(page || '').slice(0, 200),
      meta: typeof meta === 'object' ? JSON.stringify(meta).slice(0, 500) : '',
      ref: (req.headers.referer || '').slice(0, 200),
      ua: (req.headers['user-agent'] || '').slice(0, 200),
      ipHash,
    });
    res.json({ ok: true });
  }
);

// ====================================================================
// ADMIN APIS
// ====================================================================

app.post('/api/admin/login', rateLimit({ windowMs: 300000, max: 10, keyPrefix: 'lg' }), (req, res) => {
  if (req.body?.password === ADMIN_PASSWORD) return res.json({ success: true });
  res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const events = analytics.all();
  const recentEvents = events.slice(-500);
  const eventCounts = {};
  recentEvents.forEach(e => { eventCounts[e.event] = (eventCounts[e.event] || 0) + 1; });
  res.json({
    totalWaitlist: waitlist.count(),
    totalContacts: contacts.count(),
    totalOrders: orders.count(),
    totalNewsletter: newsletter.filter(n => n.status === 'active').length,
    totalAnalytics: events.length,
    newWaitlistToday: waitlist.filter(e => (e.joinedAt || '').startsWith(today)).length,
    newContactsToday: contacts.filter(e => (e.submittedAt || '').startsWith(today)).length,
    newOrdersToday: orders.filter(e => (e.createdAt || '').startsWith(today)).length,
    ordersByStatus: orders.all().reduce((a, o) => ({ ...a, [o.status]: (a[o.status] || 0) + 1 }), {}),
    topEvents: Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).slice(0, 10),
    recentWaitlist: waitlist.all().slice(-10).reverse(),
    recentContacts: contacts.all().slice(-10).reverse(),
    recentOrders: orders.all().slice(-10).reverse(),
  });
});

// Paginated list helper
function paginate(list, req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const q = (req.query.q || '').toLowerCase();
  let filtered = list;
  if (q) filtered = list.filter(x => JSON.stringify(x).toLowerCase().includes(q));
  const total = filtered.length;
  const items = filtered.slice().reverse().slice((page - 1) * limit, page * limit);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

app.get('/api/admin/waitlist', requireAdmin, (req, res) => res.json(paginate(waitlist.all(), req)));
app.delete('/api/admin/waitlist/:id', requireAdmin, (req, res) => {
  waitlist.removeById(parseInt(req.params.id));
  res.json({ success: true });
});

app.get('/api/admin/contacts', requireAdmin, (req, res) => res.json(paginate(contacts.all(), req)));
app.patch('/api/admin/contacts/:id', requireAdmin, (req, res) => {
  const patch = {};
  if (req.body.status) patch.status = String(req.body.status).slice(0, 40);
  if (req.body.notes !== undefined) patch.notes = String(req.body.notes).slice(0, 2000);
  const updated = contacts.updateById(parseInt(req.params.id), patch);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, item: updated });
});
app.delete('/api/admin/contacts/:id', requireAdmin, (req, res) => {
  contacts.removeById(parseInt(req.params.id));
  res.json({ success: true });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => res.json(paginate(orders.all(), req)));
app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const patch = {};
  ['status', 'priority', 'assignee', 'quotedPrice', 'notes'].forEach(k => {
    if (req.body[k] !== undefined) patch[k] = String(req.body[k]).slice(0, 500);
  });
  const updated = orders.updateById(parseInt(req.params.id), patch);
  if (!updated) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true, item: updated });
});
app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  orders.removeById(parseInt(req.params.id));
  res.json({ success: true });
});

app.get('/api/admin/newsletter', requireAdmin, (req, res) => res.json(paginate(newsletter.all(), req)));
app.delete('/api/admin/newsletter/:id', requireAdmin, (req, res) => {
  newsletter.removeById(parseInt(req.params.id));
  res.json({ success: true });
});

app.get('/api/admin/analytics', requireAdmin, (req, res) => res.json(paginate(analytics.all(), req)));

// Settings management
app.get('/api/admin/settings', requireAdmin, (req, res) => res.json(readJSON(F.settings, seed.settings)));
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const current = readJSON(F.settings, seed.settings);
  const allowed = ['companyName', 'tagline', 'phone', 'email', 'whatsappNumber', 'location',
    'startingPrice', 'heroTitle', 'heroSubtitle', 'primaryColor', 'accentColor'];
  const patch = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) patch[k] = String(req.body[k]).slice(0, 300); });
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  writeJSON(F.settings, next);
  res.json({ success: true, settings: next });
});

// CSV export
app.get('/api/admin/export/:type', requireAdmin, (req, res) => {
  const typeMap = { waitlist: waitlist, contacts: contacts, orders: orders, newsletter: newsletter };
  const col = typeMap[req.params.type];
  if (!col) return res.status(400).json({ error: 'Invalid export type' });
  const data = col.all();
  if (!data.length) return res.status(404).json({ error: 'No data' });
  const headers = [...new Set(data.flatMap(r => Object.keys(r)))];
  const esc = v => `"${(v === undefined || v === null ? '' : String(v)).replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...data.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.type}-${Date.now()}.csv`);
  res.send(csv);
});

// ====================================================================
// STATIC ROUTES
// ====================================================================

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// API 404
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`Veltrix AI backend running on http://localhost:${PORT} (${NODE_ENV})`);
});

process.on('SIGTERM', () => { logger.info('SIGTERM received, shutting down'); server.close(() => process.exit(0)); });
process.on('unhandledRejection', (r) => logger.error('Unhandled rejection', { r: String(r) }));
