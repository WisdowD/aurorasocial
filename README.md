# Nexus Social — PWA + Node.js + SQLite

Rede social completa baseada no design do Figma.

---

## 📁 Estrutura

```
/
├── backend/
│   ├── server.js           # Entry point Express
│   ├── db.js               # SQLite + criação das tabelas
│   ├── package.json
│   ├── .env.example
│   ├── middleware/
│   │   └── auth.js         # JWT middleware
│   └── routes/
│       ├── auth.js         # POST /register, POST /login
│       ├── users.js        # GET/PUT /me, follow, busca
│       ├── posts.js        # CRUD posts, like, share, save
│       └── notifications.js
└── frontend/
    ├── index.html          # SPA com todas as telas
    ├── styles.css          # Design system dark purple
    ├── app.js              # Lógica completa da SPA
    ├── sw.js               # Service Worker (PWA)
    └── manifest.json       # PWA manifest
```

---

## 🚀 Instalação

### Backend

```bash
cd backend
npm install
node server.js
# Servidor em http://localhost:3001
```

## 🗄️ Banco de Dados (SQLite)

O arquivo `social.db` é criado automaticamente na primeira execução do backend.

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários (username, handle, email, password hash, bio, avatar) |
| `follows` | Relação seguidor/seguido |
| `posts` | Posts e replies (parent_id para threads) |
| `likes` | Curtidas |
| `shares` | Compartilhamentos |
| `saved_posts` | Posts salvos |
| `notifications` | Notificações (like, comment, share, follow) |

---

## 🔌 API Endpoints

### Auth
```
POST /api/auth/register   { username, handle, email, password }
POST /api/auth/login      { email, password }
```

### Users (requer JWT)
```
GET  /api/users/me
PUT  /api/users/me        { username, bio, avatar_url, banner_url }
GET  /api/users/:handle
GET  /api/users?q=query
POST /api/users/:id/follow
```

### Posts (requer JWT)
```
GET  /api/posts/feed
GET  /api/posts/popular
GET  /api/posts/user/:userId?tab=posts|comments|saved
GET  /api/posts/:id
POST /api/posts            { content, image_url?, parent_id? }
DELETE /api/posts/:id
POST /api/posts/:id/like
POST /api/posts/:id/share
POST /api/posts/:id/save
```

### Notifications (requer JWT)
```
GET  /api/notifications
PUT  /api/notifications/read
GET  /api/notifications/unread-count
```

---

## 📱 Telas implementadas

- **Login / Cadastro** — autenticação JWT
- **Home** — feed (seguindo / home / popular) + stories bar
- **Busca** — pesquisa de usuários + highlights
- **Notificações** — hoje / ontem / anteriores com badge
- **Perfil** — posts / respostas / salvos + editar perfil
- **Configurações** — notificações, modo escuro, sair

---

## 🛠️ Para produção

1. Troque `JWT_SECRET` no `.env` por uma chave forte
2. Configure `FRONTEND_URL` no `.env` com o domínio real
3. Use um servidor HTTPS (obrigatório para PWA instalável)
