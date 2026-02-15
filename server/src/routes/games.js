import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create a new game
// Create new game
router.post('/', async (req, res) => {
  try {
    const { songTitle, artist, opponentEmail } = req.body;
    const creatorId = req.user.userId;

    if (!songTitle || !artist) {
      return res.status(400).json({ error: 'Song title and artist are required' });
    }

    // Find opponent by email
    let guesserId = null;
    if (opponentEmail) {
      const opponent = db.prepare('SELECT id FROM users WHERE email = ?').get(opponentEmail);
      if (!opponent) {
        return res.status(400).json({ error: 'Opponent email not found. They need to register first!' });
      }
      if (opponent.id === creatorId) {
        return res.status(400).json({ error: 'You cannot create a game with yourself!' });
      }
      guesserId = opponent.id;
    }

    const stmt = db.prepare(`
      INSERT INTO games (creator_id, guesser_id, song_title, artist, starting_prize, current_prize, status)
      VALUES (?, ?, ?, ?, 50.00, 50.00, 'active')
    `);

    const result = stmt.run(creatorId, guesserId, songTitle, artist);

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Game created successfully',
      opponentAssigned: !!guesserId
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get all games for current user (both created and guessing)
router.get('/', (req, res) => {
  try {
    const userId = req.user.userId;

    const games = db.prepare(`
      SELECT 
        g.*,
        creator.display_name as creator_name,
        guesser.display_name as guesser_name,
        (SELECT COUNT(*) FROM guesses WHERE game_id = g.id) as guess_count,
        (SELECT COUNT(*) FROM hints WHERE game_id = g.id) as hint_count
      FROM games g
      LEFT JOIN users creator ON g.creator_id = creator.id
      LEFT JOIN users guesser ON g.guesser_id = guesser.id
      WHERE g.creator_id = ? OR g.guesser_id = ?
      ORDER BY g.created_at DESC
    `).all(userId, userId);

    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get a specific game with all guesses and hints
router.get('/:id', (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.userId;

    // Get game details
    const game = db.prepare(`
      SELECT 
        g.*,
        creator.display_name as creator_name,
        guesser.display_name as guesser_name
      FROM games g
      LEFT JOIN users creator ON g.creator_id = creator.id
      LEFT JOIN users guesser ON g.guesser_id = guesser.id
      WHERE g.id = ?
    `).get(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if user is involved in this game
    if (game.creator_id !== userId && game.guesser_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this game' });
    }

    // Get guesses
    const guesses = db.prepare(`
      SELECT g.*, u.display_name as user_name
      FROM guesses g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE g.game_id = ?
      ORDER BY g.created_at ASC
    `).all(gameId);

    // Get hints
    const hints = db.prepare(`
      SELECT * FROM hints
      WHERE game_id = ?
      ORDER BY created_at ASC
    `).all(gameId);

    res.json({
      ...game,
      guesses,
      hints
    });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Make a guess
router.post('/:id/guess', (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.userId;
    const { guessText } = req.body;

    if (!guessText) {
      return res.status(400).json({ error: 'Guess text is required' });
    }

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    // Set guesser_id if this is the first guess
    if (!game.guesser_id) {
      db.prepare('UPDATE games SET guesser_id = ? WHERE id = ?').run(userId, gameId);
    }

    // Calculate new prize (halve it)
    const prizeBefore = game.current_prize;
    const prizeAfter = prizeBefore / 2;

    // Insert guess
    db.prepare(
      'INSERT INTO guesses (game_id, user_id, guess_text, prize_before, prize_after) VALUES (?, ?, ?, ?, ?)'
    ).run(gameId, userId, guessText, prizeBefore, prizeAfter);

    // Update game's current prize
    db.prepare('UPDATE games SET current_prize = ? WHERE id = ?').run(prizeAfter, gameId);

    // Get updated game
    const updatedGame = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    res.json(updatedGame);
  } catch (error) {
    console.error('Make guess error:', error);
    res.status(500).json({ error: 'Failed to make guess' });
  }
});

// Request a hint (immediately halves prize)
router.post('/:id/hint', (req, res) => {
  try {
    const gameId = req.params.id;
    const { hintText } = req.body;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    // Calculate new prize (halve it)
    const prizeBefore = game.current_prize;
    const prizeAfter = prizeBefore / 2;

    // Insert hint
    db.prepare(
      'INSERT INTO hints (game_id, hint_text, prize_before, prize_after) VALUES (?, ?, ?, ?)'
    ).run(gameId, hintText || null, prizeBefore, prizeAfter);

    // Update game's current prize
    db.prepare('UPDATE games SET current_prize = ? WHERE id = ?').run(prizeAfter, gameId);

    // Get updated game
    const updatedGame = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    res.json(updatedGame);
  } catch (error) {
    console.error('Request hint error:', error);
    res.status(500).json({ error: 'Failed to request hint' });
  }
});

// Mark game as solved
router.post('/:id/solve', (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.userId;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Only creator can mark as solved
    if (game.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the creator can mark game as solved' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    // Update game status
    db.prepare(
      'UPDATE games SET status = ?, solved_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('solved', gameId);

    // Award winnings to guesser if there is one
    if (game.guesser_id) {
      db.prepare(
        'UPDATE users SET total_winnings = total_winnings + ? WHERE id = ?'
      ).run(game.current_prize, game.guesser_id);
    }

    // Get updated game
    const updatedGame = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    res.json(updatedGame);
  } catch (error) {
    console.error('Solve game error:', error);
    res.status(500).json({ error: 'Failed to solve game' });
  }
});

// Update game notes
router.patch('/:id/notes', (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.userId;
    const { notes } = req.body;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if user is involved in this game
    if (game.creator_id !== userId && game.guesser_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this game' });
    }

    // Update notes
    db.prepare('UPDATE games SET notes = ? WHERE id = ?').run(notes || '', gameId);

    // Get updated game
    const updatedGame = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    res.json(updatedGame);
  } catch (error) {
    console.error('Update notes error:', error);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

export default router;