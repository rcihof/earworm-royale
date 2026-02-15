import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use persistent disk if available (production), otherwise local path (development)
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/var/data/database.sqlite'
  : join(__dirname, '../../database.sqlite');

console.log('📍 Database path:', dbPath);

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export default db;