const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

export const api = {
  // Auth
  register: (email, password, displayName) =>
    apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),

  login: (email, password) =>
    apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  // Games
  getGames: () => apiCall('/games'),

  createGame: (songTitle, artist) =>
    apiCall('/games', {
      method: 'POST',
      body: JSON.stringify({ songTitle, artist }),
    }),

  getGame: (id) => apiCall(`/games/${id}`),

  makeGuess: (gameId, guessText) =>
    apiCall(`/games/${gameId}/guess`, {
      method: 'POST',
      body: JSON.stringify({ guessText }),
    }),

  requestHint: (gameId, hintText) =>
    apiCall(`/games/${gameId}/hint`, {
      method: 'POST',
      body: JSON.stringify({ hintText }),
    }),

  solveGame: (gameId) =>
    apiCall(`/games/${gameId}/solve`, {
      method: 'POST',
    }),

  updateNotes: (gameId, notes) =>
    apiCall(`/games/${gameId}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    }),

  // Stats
  getPintProgress: () => apiCall('/stats/pint-progress'),
};