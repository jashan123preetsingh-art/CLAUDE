const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const WAITLIST_FILE = path.join(__dirname, 'data', 'waitlist.json');
const CONTACTS_FILE = path.join(__dirname, 'data', 'contacts.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}
if (!fs.existsSync(WAITLIST_FILE)) {
  fs.writeFileSync(WAITLIST_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(CONTACTS_FILE)) {
  fs.writeFileSync(CONTACTS_FILE, JSON.stringify([], null, 2));
}

// Waitlist signup endpoint
app.post('/api/waitlist', (req, res) => {
  const { name, email, company, service } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const waitlist = JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf8'));
  const exists = waitlist.some(entry => entry.email === email);
  if (exists) {
    return res.status(409).json({ error: 'Email already on waitlist' });
  }

  waitlist.push({
    id: Date.now(),
    name,
    email,
    company: company || '',
    service: service || 'general',
    joinedAt: new Date().toISOString()
  });

  fs.writeFileSync(WAITLIST_FILE, JSON.stringify(waitlist, null, 2));
  res.json({ success: true, message: 'Successfully joined the waitlist!' });
});

// Contact form endpoint
app.post('/api/contact', (req, res) => {
  const { name, email, phone, message, budget } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }

  const contacts = JSON.parse(fs.readFileSync(CONTACTS_FILE, 'utf8'));
  contacts.push({
    id: Date.now(),
    name,
    email,
    phone: phone || '',
    message,
    budget: budget || '',
    submittedAt: new Date().toISOString()
  });

  fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
  res.json({ success: true, message: 'Message received! We will get back to you within 24 hours.' });
});

// Get waitlist count (public)
app.get('/api/waitlist/count', (req, res) => {
  const waitlist = JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf8'));
  res.json({ count: waitlist.length });
});

app.listen(PORT, () => {
  console.log(`NexusAI server running on http://localhost:${PORT}`);
});
