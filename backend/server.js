const express = require('express');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const DB_PATH = path.join(__dirname, 'martsense.db.json');

// ── In-memory JSON database (no build tools needed) ──
let data = { users: [], contacts: [], news: [], nextId: { users: 1, contacts: 1, news: 1 } };
if (fs.existsSync(DB_PATH)) {
  try { data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch(e) {}
}
function save() { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

// Create default admin
if (!data.users.find(u => u.username === 'admin')) {
  data.users.push({ id: data.nextId.users++, username: 'admin', password: bcrypt.hashSync('martsense2024', 10), created_at: new Date().toISOString() });
  save();
  console.log('Default admin created: username=admin  password=martsense2024');
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'martsense-secret-2024', resave: false, saveUninitialized: false }));

// Serve frontend and admin
const frontendPath = fs.existsSync(path.join(__dirname, '../index.html'))
  ? path.join(__dirname, '../')
  : path.join(__dirname, './');
app.use(express.static(frontendPath));
app.use('/admin', express.static(path.join(__dirname, 'public')));

// Fallback: serve index.html for root
app.get('/', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.send('MARTSENSE server is running.');
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

// ── AUTH ──
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = data.users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Invalid username or password' });
  req.session.userId = user.id;
  res.json({ success: true });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

// ── CONTACT FORM ──
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Name, email and message are required' });
  data.contacts.push({ id: data.nextId.contacts++, name, email, subject: subject || '', message, submitted_at: new Date().toISOString(), read: false });
  save();
  res.json({ success: true, message: 'Thank you! Your message has been received.' });
});

// ── ADMIN: CONTACTS ──
app.get('/api/admin/contacts', requireAuth, (req, res) => {
  res.json([...data.contacts].reverse());
});

app.patch('/api/admin/contacts/:id/read', requireAuth, (req, res) => {
  const c = data.contacts.find(x => x.id === +req.params.id);
  if (c) { c.read = true; save(); }
  res.json({ success: true });
});

app.delete('/api/admin/contacts/:id', requireAuth, (req, res) => {
  data.contacts = data.contacts.filter(x => x.id !== +req.params.id);
  save(); res.json({ success: true });
});

// ── ADMIN: NEWS ──
app.get('/api/news', (req, res) => res.json([...data.news].reverse()));

app.post('/api/admin/news', requireAuth, (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  const item = { id: data.nextId.news++, title, content, published_at: new Date().toISOString() };
  data.news.push(item);
  save(); res.json({ success: true, id: item.id });
});

app.delete('/api/admin/news/:id', requireAuth, (req, res) => {
  data.news = data.news.filter(x => x.id !== +req.params.id);
  save(); res.json({ success: true });
});

// ── ADMIN: CHANGE PASSWORD ──
app.post('/api/admin/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = data.users.find(u => u.id === req.session.userId);
  if (!bcrypt.compareSync(currentPassword, user.password))
    return res.status(400).json({ error: 'Current password is incorrect' });
  user.password = bcrypt.hashSync(newPassword, 10);
  save(); res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('  ==========================================');
  console.log('   MARTSENSE SERVER IS RUNNING');
  console.log('  ==========================================');
  console.log(`   Website:  http://localhost:${PORT}`);
  console.log(`   Admin:    http://localhost:${PORT}/admin`);
  console.log('  ==========================================');
  console.log('');
});
