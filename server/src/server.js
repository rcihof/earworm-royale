import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import authRoutes from './routes/auth.js';
import gamesRoutes from './routes/games.js';
import statsRoutes from './routes/stats.js';

// Load environment variables
dotenv.config();

// Initialize database if it doesn't exist
const dbPath = './database.sqlite';
if (!existsSync(dbPath)) {
  console.log('🔧 Initializing database...');
  execSync('node src/db/init.js');
  console.log('✅ Database initialized!');
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