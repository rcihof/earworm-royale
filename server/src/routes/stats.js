import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get user stats
router.get('/user/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    // Get user info
    const user = db.prepare('SELECT id, display_name, total_winnings FROM users WHERE id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Total games played (as creator or guesser)
    const gamesPlayed = db.prepare(`
      SELECT COUNT(*) as count 
      FROM games 
      WHERE (creator_id = ? OR guesser_id = ?) AND status = 'solved'
    `).get(userId, userId).count;

    // Games won (as guesser)
    const gamesWon = db.prepare(`
      SELECT COUNT(*) as count 
      FROM games 
      WHERE guesser_id = ? AND status = 'solved'
    `).get(userId).count;

    // Average guesses per game
    const avgGuesses = db.prepare(`
      SELECT AVG(guess_count) as avg
      FROM (
        SELECT g.id, COUNT(gu.id) as guess_count
        FROM games g
        LEFT JOIN guesses gu ON g.id = gu.game_id
        WHERE (g.creator_id = ? OR g.guesser_id = ?) AND g.status = 'solved'
        GROUP BY g.id
      )
    `).get(userId, userId).avg || 0;

    // Hardest games (most guesses + hints)
    const hardestGames = db.prepare(`
      SELECT 
        g.id,
        g.song_title,
        g.artist,
        g.current_prize,
        (SELECT COUNT(*) FROM guesses WHERE game_id = g.id) as guess_count,
        (SELECT COUNT(*) FROM hints WHERE game_id = g.id) as hint_count
      FROM games g
      WHERE (g.creator_id = ? OR g.guesser_id = ?) AND g.status = 'solved'
      ORDER BY (
        (SELECT COUNT(*) FROM guesses WHERE game_id = g.id) + 
        (SELECT COUNT(*) FROM hints WHERE game_id = g.id)
      ) DESC
      LIMIT 5
    `).all(userId, userId);

    // Longest games
    const longestGames = db.prepare(`
      SELECT 
        g.id,
        g.song_title,
        g.artist,
        (SELECT COUNT(*) FROM guesses WHERE game_id = g.id) as guess_count,
        (SELECT COUNT(*) FROM hints WHERE game_id = g.id) as hint_count
      FROM games g
      WHERE (g.creator_id = ? OR g.guesser_id = ?) AND g.status = 'solved'
      ORDER BY (
        (SELECT COUNT(*) FROM guesses WHERE game_id = g.id) + 
        (SELECT COUNT(*) FROM hints WHERE game_id = g.id)
      ) DESC
      LIMIT 5
    `).all(userId, userId);

    res.json({
      user,
      stats: {
        gamesPlayed,
        gamesWon,
        winRate: gamesPlayed > 0 ? (gamesWon / gamesPlayed * 100).toFixed(1) : 0,
        averageGuesses: parseFloat(avgGuesses).toFixed(1),
        hardestGames,
        longestGames
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get combined stats for pint progress (all users)
router.get('/pint-progress', (req, res) => {
  try {
    const PINT_GOAL = 7.50;

    // Get total winnings across all users
    const result = db.prepare('SELECT SUM(total_winnings) as total FROM users').get();
    const totalWinnings = result.total || 0;

    // Calculate progress
    const progress = Math.min((totalWinnings / PINT_GOAL) * 100, 100);
    const remaining = Math.max(PINT_GOAL - totalWinnings, 0);

    res.json({
      totalWinnings: parseFloat(totalWinnings.toFixed(2)),
      pintGoal: PINT_GOAL,
      progress: parseFloat(progress.toFixed(1)),
      remaining: parseFloat(remaining.toFixed(2)),
      pintEarned: totalWinnings >= PINT_GOAL
    });
  } catch (error) {
    console.error('Get pint progress error:', error);
    res.status(500).json({ error: 'Failed to fetch pint progress' });
  }
});

export default router;