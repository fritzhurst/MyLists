import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import categoryRoutes from './routes/categories.js';
import itemRoutes from './routes/items.js';
import searchRoutes from './routes/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Enable CORS in development
if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}

// API routes
app.use('/api/categories', categoryRoutes);
// Items routes are nested under categories for GET/POST/reorder,
// but DELETE is at /api/items/:id
app.use('/api/categories', itemRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/search', searchRoutes);

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
