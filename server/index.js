import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import itemRoutes from './routes/items.js';
import searchRoutes from './routes/search.js';
import notesRoutes from './routes/notes.js';
import plexRoutes from './routes/plex.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Enable CORS in development
if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}

// Public routes (no auth)
app.use('/api/auth', authRoutes);

// Protected API routes
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/categories', requireAuth, itemRoutes);
app.use('/api/items', requireAuth, itemRoutes);
app.use('/api/items', requireAuth, notesRoutes);
app.use('/api/search', requireAuth, searchRoutes);
app.use('/api/plex', requireAuth, plexRoutes);

// Serve uploaded files (auth required)
const dataDir = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(process.cwd(), 'data');
app.use('/api/uploads', requireAuth, express.static(path.join(dataDir, 'uploads')));

// Serve static React build in production
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// SPA catch-all: serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MyLists server running on http://localhost:${PORT}`);
});
