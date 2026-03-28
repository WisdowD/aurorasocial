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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── Servir o Frontend (SPA) ───────────────────────────────────────────────────
// Tenta encontrar o frontend em diferentes locais (local vs Railway)
const possiblePaths = [
  path.join(__dirname, '..', 'frontend'),   // estrutura local: Aurora/backend + Aurora/frontend
  path.join(__dirname, 'frontend'),          // caso esteja na raiz junto
  path.join(process.cwd(), 'frontend'),      // relativo ao diretório de execução
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