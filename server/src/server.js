import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import authRoutes from './routes/auth.js';
import gamesRoutes from './routes/games.js';
import statsRoutes from './routes/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize database if tables don't exist
const dbPath = process.env.NODE_ENV === 'production'
  ? '/var/data/database.sqlite'
  : join(__dirname, '../database.sqlite');

console.log('📍 Database path:', dbPath);

let needsInit = false;

if (!existsSync(dbPath)) {
  console.log('🔧 Database file does not exist. Will create and initialize...');
  needsInit = true;
} else {
  // Check if tables exist
  const db = new Database(dbPath);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();
  db.close();
  
  if (tables.length === 0) {
    console.log('🔧 Database exists but has no tables. Reinitializing...');
    needsInit = true;
  } else {
    console.log('✅ Database already initialized');
  }
}

if (needsInit) {
  try {
    execSync('node src/db/init.js', { cwd: join(__dirname, '..'), stdio: 'inherit' });
    console.log('✅ Database initialized successfully!');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Earworm Royale API is running!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 Earworm Royale server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   - POST /api/auth/register`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - GET  /api/games`);
  console.log(`   - POST /api/games`);
  console.log(`   - GET  /api/stats/pint-progress`);
});