import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Dashboard({ user, onLogout }) {
  const [games, setGames] = useState([]);
  const [pintProgress, setPintProgress] = useState(null);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [opponentEmail, setOpponentEmail] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [gamesData, progressData] = await Promise.all([
        api.getGames(),
        api.getPintProgress(),
      ]);
      setGames(gamesData);
      setPintProgress(progressData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    try {
      await api.createGame(songTitle, artist, opponentEmail);
      setSongTitle('');
      setArtist('');
      setOpponentEmail('');
      setShowCreateGame(false);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMakeGuess = async (gameId, guessText) => {
    try {
      await api.makeGuess(gameId, guessText);
      loadData();
      if (selectedGame?.id === gameId) {
        const gameData = await api.getGame(gameId);
        setSelectedGame(gameData);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRequestHint = async (gameId, hintText) => {
    try {
      await api.requestHint(gameId, hintText);
      loadData();
      if (selectedGame?.id === gameId) {
        const gameData = await api.getGame(gameId);
        setSelectedGame(gameData);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSolveGame = async (gameId) => {
    if (!confirm('Mark this game as solved?')) return;
    try {
      await api.solveGame(gameId);
      loadData();
      setSelectedGame(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const openGame = async (game) => {
    try {
      const gameData = await api.getGame(game.id);
      setSelectedGame(gameData);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">🎵 Earworm Royale</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Hey, {user.displayName}! 💰 €{user.totalWinnings?.toFixed(2) || '0.00'}
            </span>
            <button
              onClick={onLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Pint Progress */}
        {pintProgress && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3">🍺 Pint Progress</h2>
            <div className="w-full bg-gray-200 rounded-full h-6 mb-2">
              <div
                className="bg-green-500 h-6 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ width: `${Math.min(pintProgress.progress, 100)}%` }}
              >
                {pintProgress.progress.toFixed(1)}%
              </div>
            </div>
            <p className="text-sm text-gray-600">
              €{pintProgress.totalWinnings.toFixed(2)} / €{pintProgress.pintGoal.toFixed(2)}
              {pintProgress.pintEarned ? ' 🎉 Pint earned!' : ` (€${pintProgress.remaining.toFixed(2)} to go!)`}
            </p>
          </div>
        )}

        {/* Create Game Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateGame(!showCreateGame)}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700"
          >
            {showCreateGame ? 'Cancel' : '+ Create New Game'}
          </button>
        </div>

        {/* Create Game Form */}
        {showCreateGame && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Create New Game</h2>
            <form onSubmit={handleCreateGame} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Song Title
                </label>
                <input
                  type="text"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Artist
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opponent Email
                </label>
                <input
                  type="email"
                  value={opponentEmail}
                  onChange={(e) => setOpponentEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your opponent must have an account already
                </p>
              </div>
              <button
                type="submit"
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700"
              >
                Create Game
              </button>
            </form>
          </div>
        )}

        {/* Games List - Split into two sections */}
        <div className="space-y-6">
          {/* Your Songs (games you created) */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">🎯 Your Songs</h2>
              {games.filter(g => g.creator_id === user.id).length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No songs created yet. Create one above!
                </p>
              ) : (
                <div className="space-y-3">
                  {games.filter(g => g.creator_id === user.id).map((game) => (
                    <div
                      key={game.id}
                      onClick={() => openGame(game)}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">
                            "{game.song_title}" by {game.artist}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {game.guesser_name ? `vs ${game.guesser_name}` : 'No opponent assigned'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {game.guess_count} guesses • {game.hint_count} hints
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            €{game.current_prize.toFixed(2)}
                          </div>
                          <div className={`text-xs ${game.status === 'solved' ? 'text-green-600' : 'text-gray-500'}`}>
                            {game.status === 'solved' ? '✓ Solved' : 'Active'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Games to Guess (where you're the guesser) */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-4">🎵 Games to Guess</h2>
              {games.filter(g => g.guesser_id === user.id).length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No one has challenged you yet!
                </p>
              ) : (
                <div className="space-y-3">
                  {games.filter(g => g.guesser_id === user.id).map((game) => (
                    <div
                      key={game.id}
                      onClick={() => openGame(game)}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">Mystery Song</h3>
                          <p className="text-sm text-gray-600">
                            by {game.creator_name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {game.guess_count} guesses • {game.hint_count} hints
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            €{game.current_prize.toFixed(2)}
                          </div>
                          <div className={`text-xs ${game.status === 'solved' ? 'text-green-600' : 'text-gray-500'}`}>
                            {game.status === 'solved' ? '✓ Solved' : 'Active'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Game Detail Modal */}
      {selectedGame && (
        <GameModal
          game={selectedGame}
          user={user}
          onClose={() => setSelectedGame(null)}
          onGuess={handleMakeGuess}
          onHint={handleRequestHint}
          onSolve={handleSolveGame}
        />
      )}
    </div>
  );
}

// Game Detail Modal Component
function GameModal({ game, user, onClose, onGuess, onHint, onSolve }) {
  const [guessText, setGuessText] = useState('');
  const [hintText, setHintText] = useState('');

  const isCreator = game.creator_id === user.id;

  const handleGuessSubmit = (e) => {
    e.preventDefault();
    if (!guessText.trim()) return;
    onGuess(game.id, guessText);
    setGuessText('');
  };

  const handleHintSubmit = (e) => {
    e.preventDefault();
    onHint(game.id, hintText);
    setHintText('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold">
                {isCreator ? `"${game.song_title}"` : 'Mystery Song'}
              </h2>
              <p className="text-gray-600">
                {isCreator ? `by ${game.artist}` : `by ${game.creator_name}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-6">
            <div className="text-3xl font-bold text-green-600 mb-2">
              €{game.current_prize.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">
              Started at €{game.starting_prize.toFixed(2)}
            </div>
          </div>

          {/* Guesses */}
          {game.guesses && game.guesses.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Guesses</h3>
              <div className="space-y-2">
                {game.guesses.map((guess) => (
                  <div key={guess.id} className="bg-gray-50 p-3 rounded">
                    <div className="font-medium">{guess.guess_text}</div>
                    <div className="text-xs text-gray-500">
                      €{guess.prize_before.toFixed(2)} → €{guess.prize_after.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hints */}
          {game.hints && game.hints.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Hints</h3>
              <div className="space-y-2">
                {game.hints.map((hint) => (
                  <div key={hint.id} className="bg-yellow-50 p-3 rounded">
                    <div>{hint.hint_text || 'Hint requested'}</div>
                    <div className="text-xs text-gray-500">
                      €{hint.prize_before.toFixed(2)} → €{hint.prize_after.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {game.status === 'active' && (
            <div className="space-y-4">
              {!isCreator && (
                <>
                  <form onSubmit={handleGuessSubmit}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Make a Guess
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={guessText}
                        onChange={(e) => setGuessText(e.target.value)}
                        placeholder="Enter song title..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        type="submit"
                        className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700"
                      >
                        Guess
                      </button>
                    </div>
                  </form>

                  <form onSubmit={handleHintSubmit}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Request a Hint
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={hintText}
                        onChange={(e) => setHintText(e.target.value)}
                        placeholder="Ask for a hint..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      />
                      <button
                        type="submit"
                        className="bg-yellow-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-yellow-600"
                      >
                        Hint
                      </button>
                    </div>
                  </form>
                </>
              )}

              {isCreator && (
                <button
                  onClick={() => onSolve(game.id)}
                  className="w-full bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700"
                >
                  Mark as Solved
                </button>
              )}
            </div>
          )}

          {game.status === 'solved' && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-center">
              ✓ Game Solved!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}