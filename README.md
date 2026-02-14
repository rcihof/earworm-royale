# 🎵 Earworm Royale 👑

A two-player music guessing game where friends challenge each other with earworms!

## 🎮 Game Mechanics

- Players create games with a song title + artist
- Starting prize: €50
- Each wrong guess halves the prize
- Each hint request halves the prize
- Winner gets the remaining prize when they guess correctly
- Combined pot tracks progress toward buying a pint (€7.50)

## 🛠️ Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite
- **Auth:** JWT tokens

## 📦 Setup Instructions

### Prerequisites

Make sure you have Node.js installed (version 16 or higher):
```bash
node --version
```

If you don't have it, download from: https://nodejs.org/

### Installation

1. **Install server dependencies:**
```bash
cd server
npm install
```

2. **Install client dependencies:**
```bash
cd ../client
npm install
```

3. **Initialize the database:**
```bash
cd ../server
npm run init-db
```

### Running the App

You'll need TWO terminal windows:

**Terminal 1 - Start the backend:**
```bash
cd server
npm run dev
```
Server runs on: http://localhost:3001

**Terminal 2 - Start the frontend:**
```bash
cd client
npm run dev
```
Frontend runs on: http://localhost:5173

Open your browser to http://localhost:5173 and start playing!

## 📁 Project Structure
```
earworm-royale/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API calls
│   │   └── App.jsx      # Main app
│   └── package.json
├── server/              # Express backend
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── db/          # Database setup
│   │   └── middleware/  # Auth middleware
│   └── package.json
└── README.md
```

## 🎯 Current Features

- ✅ User registration and login
- ✅ Create new song guessing games
- ✅ Make guesses (auto-halves prize)
- ✅ Request hints (auto-halves prize)
- ✅ Track individual winnings
- ✅ Shared pint progress tracker
- ✅ Game history
- ✅ Mobile-responsive design

---

Made with ☕ and 🎵 by Jason