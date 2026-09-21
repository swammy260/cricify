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

app.listen(PORT, () => {
  console.log(`Cricify running at http://localhost:${PORT}`);
});