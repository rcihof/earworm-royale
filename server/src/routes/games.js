import express from 'express';
import db from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new game
router.post('/', async (req, res) => {
  try {
    const { songTitle, artist, opponentEmail } = req.body;
    const creatorId = req.user.id;

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

// Get all games for user (as creator or guesser)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const games = db.prepare(`
      SELECT 
        g.*,
        creator.display_name as creator_name,
        guesser.display_name as guesser_name,
        (SELECT COUNT(*) FROM guesses WHERE game_id = g.id) as guess_count,
        (SELECT COUNT(*) FROM hints WHERE game_id = g.id) as hint_count,
        (SELECT COUNT(*) FROM guesses WHERE game_id = g.id AND status = 'pending') as pending_guess_count,
        (SELECT COUNT(*) FROM hints WHERE game_id = g.id AND status = 'pending') as pending_hint_count
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

// Get game details
router.get('/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.id;

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

    // Check if user is authorized (creator or guesser)
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
router.post('/:id/guess', async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.id;
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

    // Only guesser can make guesses
    if (game.guesser_id !== userId) {
      return res.status(403).json({ error: 'Only the assigned guesser can make guesses' });
    }

    // Check how many guesses have been made
    const guessCount = db.prepare('SELECT COUNT(*) as count FROM guesses WHERE game_id = ?').get(gameId).count;

    const prizeBefore = game.current_prize;
    // First guess is free, subsequent guesses halve the prize
    const prizeAfter = guessCount === 0 ? prizeBefore : prizeBefore / 2;

    // Insert guess
    db.prepare(
      'INSERT INTO guesses (game_id, user_id, guess_text, prize_before, prize_after, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(gameId, userId, guessText, prizeBefore, prizeAfter, 'pending');

    // Update game's current prize if it changed
    if (prizeAfter !== prizeBefore) {
      db.prepare('UPDATE games SET current_prize = ? WHERE id = ?').run(prizeAfter, gameId);
    }

    res.json({ message: 'Guess submitted successfully' });
  } catch (error) {
    console.error('Make guess error:', error);
    res.status(500).json({ error: 'Failed to make guess' });
  }
});

// Respond to a guess (creator only)
router.post('/:id/guess/:guessId/respond', async (req, res) => {
  try {
    const gameId = req.params.id;
    const guessId = req.params.guessId;
    const userId = req.user.id;
    const { isCorrect, feedback } = req.body;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Only creator can respond to guesses
    if (game.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the creator can respond to guesses' });
    }

    const guess = db.prepare('SELECT * FROM guesses WHERE id = ? AND game_id = ?').get(guessId, gameId);

    if (!guess) {
      return res.status(404).json({ error: 'Guess not found' });
    }

    if (guess.status !== 'pending') {
      return res.status(400).json({ error: 'Guess already responded to' });
    }

    // Prize already adjusted on submission, just use current
    const newPrize = game.current_prize;
    
    // Update guess with response
    const status = isCorrect ? 'correct' : 'incorrect';
    db.prepare(`
      UPDATE guesses 
      SET status = ?, feedback = ?, prize_after = ?, responded_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, feedback || null, newPrize, guessId);

    // Update game's current prize
    db.prepare('UPDATE games SET current_prize = ? WHERE id = ?').run(newPrize, gameId);

    // If correct, mark game as solved and award winnings
    if (isCorrect) {
      db.prepare(`
        UPDATE games 
        SET status = 'solved', solved_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(gameId);

      // Award winnings to guesser
      if (game.guesser_id) {
        db.prepare(`
          UPDATE users 
          SET total_winnings = total_winnings + ? 
          WHERE id = ?
        `).run(newPrize, game.guesser_id);
      }
    }

    res.json({ message: 'Response recorded', isCorrect });
  } catch (error) {
    console.error('Respond to guess error:', error);
    res.status(500).json({ error: 'Failed to respond to guess' });
  }
});

// Respond to a hint request (creator only)
router.post('/:id/hint/:hintId/respond', async (req, res) => {
  try {
    const gameId = req.params.id;
    const hintId = req.params.hintId;
    const userId = req.user.id;
    const { hintResponse } = req.body;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Only creator can respond to hints
    if (game.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the creator can respond to hints' });
    }

    const hint = db.prepare('SELECT * FROM hints WHERE id = ? AND game_id = ?').get(hintId, gameId);

    if (!hint) {
      return res.status(404).json({ error: 'Hint not found' });
    }

    if (hint.status !== 'pending') {
      return res.status(400).json({ error: 'Hint already responded to' });
    }

    // Update hint with response
    db.prepare(`
      UPDATE hints 
      SET hint_response = ?, status = 'answered', responded_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(hintResponse, hintId);

    res.json({ message: 'Hint response recorded' });
  } catch (error) {
    console.error('Respond to hint error:', error);
    res.status(500).json({ error: 'Failed to respond to hint' });
  }
});

// Request a hint (immediately halves prize)
router.post('/:id/hint', async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.id;
    const { hintText } = req.body;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    // Only guesser can request hints
    if (game.guesser_id !== userId) {
      return res.status(403).json({ error: 'Only the assigned guesser can request hints' });
    }

    // Calculate new prize (halve it)
    const prizeBefore = game.current_prize;
    const prizeAfter = prizeBefore / 2;

    // Insert hint
    db.prepare(
      'INSERT INTO hints (game_id, hint_request, prize_before, prize_after, status) VALUES (?, ?, ?, ?, ?)'
    ).run(gameId, hintText, prizeBefore, prizeAfter, 'pending');

    // Update game's current prize
    db.prepare('UPDATE games SET current_prize = ? WHERE id = ?').run(prizeAfter, gameId);

    res.json({ message: 'Hint requested successfully' });
  } catch (error) {
    console.error('Request hint error:', error);
    res.status(500).json({ error: 'Failed to request hint' });
  }
});

// Mark game as solved
router.post('/:id/solve', async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.id;

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
router.patch('/:id/notes', async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.id;
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
  // Delete game (creator only)
router.delete('/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    const userId = req.user.id;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Only creator can delete
    if (game.creator_id !== userId) {
      return res.status(403).json({ error: 'Only the creator can delete this game' });
    }

    // Delete associated guesses and hints first (foreign key constraints)
    db.prepare('DELETE FROM guesses WHERE game_id = ?').run(gameId);
    db.prepare('DELETE FROM hints WHERE game_id = ?').run(gameId);
    
    // Delete the game
    db.prepare('DELETE FROM games WHERE id = ?').run(gameId);

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});
});

export default router;