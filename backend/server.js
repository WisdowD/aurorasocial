require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Servir o Frontend (SPA) ───────────────────────────────────────────────────
// Serve os arquivos estáticos da pasta ../frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Qualquer rota que não seja /api/* retorna o index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('Servidor rodando!');
  console.log('Abra no navegador: http://localhost:' + PORT);
  console.log('');
});