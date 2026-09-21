const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// Load all the career stats once, when the server starts
const players = JSON.parse(
  fs.readFileSync(path.join(__dirname, "output", "players.json"), "utf8")
);
console.log(`Loaded ${players.length} players`);

// Serve the website files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// GET /api/players?q=kohli  -> a short list of matching players
app.get("/api/players", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const results = players
    .filter((p) => p.name.toLowerCase().includes(q))
    .sort((a, b) => b.batting.runs - a.batting.runs)
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      name: p.name,
      matches: p.matches,
      runs: p.batting.runs,
      wickets: p.bowling.wickets,
      catches: p.fielding.catches,
    }));

  res.json(results);
});

// GET /api/players/:id  -> full stats for one player
app.get("/api/players/:id", (req, res) => {
  const player = players.find((p) => p.id === req.params.id);
  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }
  res.json(player);
});

// How each leaderboard works. "order" says whether the biggest or smallest value ranks first.
// "rate" stats (averages, economy...) need a minimum sample so tiny careers don't top the table.
const LEADERBOARDS = {
  batting: {
    minField: (p) => p.batting.innings,
    stats: {
      runs:       { get: (p) => p.batting.runs,       order: "desc" },
      average:    { get: (p) => p.batting.average,    order: "desc", rate: true },
      strikeRate: { get: (p) => p.batting.strikeRate, order: "desc", rate: true },
      highScore:  { get: (p) => p.batting.highScore,  order: "desc" },
      hundreds:   { get: (p) => p.batting.hundreds,   order: "desc" },
      fifties:    { get: (p) => p.batting.fifties,    order: "desc" },
    },
  },
  bowling: {
    minField: (p) => p.bowling.balls / 6, // overs bowled
    stats: {
      wickets:    { get: (p) => p.bowling.wickets,    order: "desc" },
      economy:    { get: (p) => p.bowling.economy,    order: "asc", rate: true },
      average:    { get: (p) => p.bowling.average,    order: "asc", rate: true },
      strikeRate: { get: (p) => p.bowling.strikeRate, order: "asc", rate: true },
    },
  },
  fielding: {
    minField: () => 0,
    stats: {
      total:     { get: (p) => p.fielding.total,     order: "desc" },
      catches:   { get: (p) => p.fielding.catches,   order: "desc" },
      stumpings: { get: (p) => p.fielding.stumpings, order: "desc" },
      runOuts:   { get: (p) => p.fielding.runOuts,   order: "desc" },
    },
  },
};

// GET /api/leaderboard?category=batting&stat=average&min=10
app.get("/api/leaderboard", (req, res) => {
  const category = LEADERBOARDS[req.query.category];
  const stat = category && category.stats[req.query.stat];
  if (!stat) {
    return res.status(400).json({ error: "Unknown category or stat" });
  }

  const min = Number(req.query.min) || 0;
  const limit = Math.min(Number(req.query.limit) || 25, 100);

  const rows = players
    .filter((p) => {
      const value = stat.get(p);
      if (value === null || value === undefined) return false; // e.g. never dismissed, no average
      if (stat.rate && category.minField(p) < min) return false; // not enough innings/overs
      return true;
    })
    .sort((a, b) => {
      const diff = stat.order === "asc" ? stat.get(a) - stat.get(b) : stat.get(b) - stat.get(a);
      return diff || a.name.localeCompare(b.name); // ties: alphabetical
    })
    .slice(0, limit)
    .map((p, i) => ({
      rank: i + 1,
      id: p.id,
      name: p.name,
      matches: p.matches,
      value: stat.get(p),
    }));

  res.json(rows);
});
app.listen(PORT, () => {
  console.log(`Cricify running at http://localhost:${PORT}`);
});