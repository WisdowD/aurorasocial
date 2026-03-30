require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir uploads estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Rotas API ─────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/posts',         require('./routes/posts'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));
// ROTA TEMPORÁRIA — REMOVER APÓS USO
app.get('/api/make-admin-aurora', async (req, res) => {
  const db = require('./db');
  await db.run("UPDATE users SET is_admin = 1 WHERE handle = 'adminAurora'");
  res.json({ ok: true, msg: 'Pronto! adminAurora agora é admin.' });
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Servir o Frontend (SPA) ───────────────────────────────────────────────────
const possiblePaths = [
  path.join(__dirname, '..', 'frontend'),   
  path.join(__dirname, 'frontend'),          
  path.join(process.cwd(), 'frontend'),      
];

const frontendPath = possiblePaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (frontendPath) {
  console.log('Frontend encontrado em:', frontendPath);
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.warn('AVISO: pasta frontend não encontrada. Apenas API disponível.');
  app.get('*', (req, res) => res.status(404).json({ error: 'Frontend não encontrado' }));
}

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('Servidor rodando!');
  console.log('Abra no navegador: http://localhost:' + PORT);
  console.log('');
});