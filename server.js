const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin password — change this!
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'veltrix2026';

app.use(express.json());
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
const WAITLIST_FILE = path.join(DATA_DIR, 'waitlist.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(WAITLIST_FILE)) fs.writeFileSync(WAITLIST_FILE, '[]');
if (!fs.existsSync(CONTACTS_FILE)) fs.writeFileSync(CONTACTS_FILE, '[]');
if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
    companyName: 'Veltrix AI',
    tagline: 'AI-Powered Growth Agency',
    phone: '+91 82890 94569',
    email: 'veltrixaiservices@gmail.com',
    whatsappNumber: '918289094569',
    location: 'Punjab, India',
    startingPrice: '$25',
    heroTitle: 'Your Business. Our AI Army. 10x Results.',
    heroSubtitle: 'We help zero-stage startups and small businesses grow with AI. Brand building, lead generation, content, marketing, automation — starting from just $25.',
    primaryColor: '#0052FF',
    accentColor: '#00c978'
  }, null, 2));
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Auth middleware
function authCheck(req, res, next) {
  const pw = req.headers['x-admin-password'] || req.query.password;
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ===== PUBLIC APIs =====

// Waitlist signup
app.post('/api/waitlist', (req, res) => {
  const { name, email, phone, service } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  const list = readJSON(WAITLIST_FILE);
  if (list.some(e => e.email === email)) return res.status(409).json({ error: 'Already on waitlist' });

  list.push({ id: Date.now(), name, email, phone: phone || '', service: service || 'general', joinedAt: new Date().toISOString(), status: 'new' });
  writeJSON(WAITLIST_FILE, list);
  res.json({ success: true, message: 'You are on the waitlist! We will reach out soon.', position: list.length });
});

// Waitlist count
app.get('/api/waitlist/count', (req, res) => {
  res.json({ count: readJSON(WAITLIST_FILE).length });
});

// Contact form
app.post('/api/contact', (req, res) => {
  const { name, email, phone, service, budget, message } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  const list = readJSON(CONTACTS_FILE);
  list.push({ id: Date.now(), name, email, phone: phone || '', service: service || '', budget: budget || '', message: message || '', submittedAt: new Date().toISOString(), status: 'new' });
  writeJSON(CONTACTS_FILE, list);
  res.json({ success: true, message: 'Message received! We will reply within 24 hours.' });
});

// Public settings (limited)
app.get('/api/settings/public', (req, res) => {
  const s = readJSON(SETTINGS_FILE);
  res.json({ companyName: s.companyName, tagline: s.tagline, startingPrice: s.startingPrice, primaryColor: s.primaryColor, accentColor: s.accentColor });
});

// ===== ADMIN APIs =====

// Admin login check
app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) return res.json({ success: true });
  res.status(401).json({ error: 'Wrong password' });
});

// Dashboard stats
app.get('/api/admin/stats', authCheck, (req, res) => {
  const waitlist = readJSON(WAITLIST_FILE);
  const contacts = readJSON(CONTACTS_FILE);
  const today = new Date().toISOString().split('T')[0];
  res.json({
    totalWaitlist: waitlist.length,
    totalContacts: contacts.length,
    newWaitlistToday: waitlist.filter(e => e.joinedAt.startsWith(today)).length,
    newContactsToday: contacts.filter(e => e.submittedAt.startsWith(today)).length,
    recentWaitlist: waitlist.slice(-10).reverse(),
    recentContacts: contacts.slice(-10).reverse()
  });
});

// Get all waitlist
app.get('/api/admin/waitlist', authCheck, (req, res) => {
  res.json(readJSON(WAITLIST_FILE).reverse());
});

// Delete waitlist entry
app.delete('/api/admin/waitlist/:id', authCheck, (req, res) => {
  const list = readJSON(WAITLIST_FILE).filter(e => e.id !== parseInt(req.params.id));
  writeJSON(WAITLIST_FILE, list);
  res.json({ success: true });
});

// Get all contacts
app.get('/api/admin/contacts', authCheck, (req, res) => {
  res.json(readJSON(CONTACTS_FILE).reverse());
});

// Update contact status
app.patch('/api/admin/contacts/:id', authCheck, (req, res) => {
  const list = readJSON(CONTACTS_FILE);
  const item = list.find(e => e.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (req.body.status) item.status = req.body.status;
  if (req.body.notes) item.notes = req.body.notes;
  writeJSON(CONTACTS_FILE, list);
  res.json({ success: true });
});

// Delete contact
app.delete('/api/admin/contacts/:id', authCheck, (req, res) => {
  const list = readJSON(CONTACTS_FILE).filter(e => e.id !== parseInt(req.params.id));
  writeJSON(CONTACTS_FILE, list);
  res.json({ success: true });
});

// Get settings
app.get('/api/admin/settings', authCheck, (req, res) => {
  res.json(readJSON(SETTINGS_FILE));
});

// Update settings
app.put('/api/admin/settings', authCheck, (req, res) => {
  const current = readJSON(SETTINGS_FILE);
  const updated = { ...current, ...req.body };
  writeJSON(SETTINGS_FILE, updated);
  res.json({ success: true, settings: updated });
});

// Export data as CSV
app.get('/api/admin/export/:type', authCheck, (req, res) => {
  const data = readJSON(req.params.type === 'waitlist' ? WAITLIST_FILE : CONTACTS_FILE);
  if (!data.length) return res.status(404).json({ error: 'No data' });
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map(r => headers.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${req.params.type}-${Date.now()}.csv`);
  res.send(csv);
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Veltrix AI running on http://localhost:${PORT}`);
});
