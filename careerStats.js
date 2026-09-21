const fs = require("fs");
const path = require("path");

const STATS_FOLDER = "stats";
const OUTPUT_FOLDER = "output";

// Dismissals that count as the bowler's wicket
const BOWLER_WICKETS = ["bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket"];

// These end a batter's innings but they are NOT "out" for averages
const NOT_DISMISSALS = ["retired hurt", "retired not out"];

// All players, keyed by their unique Cricsheet ID
const players = {};

function getPlayer(id, name) {
  if (!players[id]) {
    players[id] = {
      id,
      name,
      matches: 0,
      batting: { innings: 0, runs: 0, balls: 0, dismissals: 0, highScore: 0, fifties: 0, hundreds: 0 },
      bowling: { balls: 0, runs: 0, wickets: 0 },
      fielding: { catches: 0, stumpings: 0, runOuts: 0 },
    };
  }
  return players[id];
}

function round(n) {
  return Number(n.toFixed(2));
}

function processMatch(match) {
  // The registry maps each player's name to a unique ID
  const registry = (match.info.registry && match.info.registry.people) || {};
  const idOf = (name) => registry[name] || name;
  const get = (name) => getPlayer(idOf(name), name);

  // Count a match played for everyone in the team lists
  for (const team of Object.values(match.info.players || {})) {
    for (const name of team) {
      get(name).matches += 1;
    }
  }

  for (const innings of match.innings || []) {
    // Cricsheet stats normally leave super overs out of career figures
    if (innings.super_over) continue;

    // Track each batter's score for THIS innings only
    const inningsBatters = {};
    const bat = (name) => {
      const id = idOf(name);
      if (!inningsBatters[id]) {
        inningsBatters[id] = { name, runs: 0, balls: 0, out: false };
      }
      return inningsBatters[id];
    };

    for (const over of innings.overs || []) {
      for (const ball of over.deliveries) {
        const extras = ball.extras || {};

        // ---- Batting ----
        const batter = bat(ball.batter);
        batter.runs += ball.runs.batter;
        if (!extras.wides) batter.balls += 1;

        // ---- Bowling ----
        const bowling = get(ball.bowler).bowling;
        if (!extras.wides && !extras.noballs) bowling.balls += 1;
        bowling.runs += ball.runs.batter + (extras.wides || 0) + (extras.noballs || 0);

        // ---- Wickets ----
        for (const wicket of ball.wickets || []) {
          // Batter dismissed
          if (!NOT_DISMISSALS.includes(wicket.kind)) {
            bat(wicket.player_out).out = true;
          }

          // Bowler credited
          if (BOWLER_WICKETS.includes(wicket.kind)) {
            bowling.wickets += 1;
          }

          // Fielders credited
          let involved = wicket.fielders || [];
          if (wicket.kind === "caught and bowled" && involved.length === 0) {
            involved = [{ name: ball.bowler }];
          }
          for (const f of involved) {
            if (!f.name || f.substitute) continue; // skip unknown names and substitutes
            const fielding = get(f.name).fielding;
            if (wicket.kind === "caught" || wicket.kind === "caught and bowled") fielding.catches += 1;
            else if (wicket.kind === "stumped") fielding.stumpings += 1;
            else if (wicket.kind === "run out") fielding.runOuts += 1;
          }
        }
      }
    }

    // End of innings: add each batter's innings to their career totals
    for (const b of Object.values(inningsBatters)) {
      const career = get(b.name).batting;
      career.innings += 1;
      career.runs += b.runs;
      career.balls += b.balls;
      if (b.out) career.dismissals += 1;
      if (b.runs > career.highScore) career.highScore = b.runs;
      if (b.runs >= 100) career.hundreds += 1;
      else if (b.runs >= 50) career.fifties += 1;
    }
  }
}

// ---------- Main: read every match file ----------
console.time("Processed");

const files = fs.readdirSync(STATS_FOLDER).filter((f) => f.endsWith(".json"));
let processed = 0;
let skipped = 0;

for (const fileName of files) {
  try {
    const text = fs.readFileSync(path.join(STATS_FOLDER, fileName), "utf8");
    processMatch(JSON.parse(text));
    processed++;
  } catch (err) {
    console.log(`Skipping ${fileName}: ${err.message}`);
    skipped++;
  }
}

console.log(`Matches processed: ${processed}, skipped: ${skipped}`);
console.timeEnd("Processed");

// ---------- Work out averages, strike rates, economy ----------
const list = Object.values(players).map((p) => {
  const b = p.batting;
  const w = p.bowling;
  const f = p.fielding;
  return {
    id: p.id,
    name: p.name,
    matches: p.matches,
    batting: {
      ...b,
      average: b.dismissals > 0 ? round(b.runs / b.dismissals) : null,
      strikeRate: b.balls > 0 ? round((b.runs / b.balls) * 100) : null,
    },
    bowling: {
      ...w,
      overs: `${Math.floor(w.balls / 6)}.${w.balls % 6}`,
      economy: w.balls > 0 ? round(w.runs / (w.balls / 6)) : null,
      average: w.wickets > 0 ? round(w.runs / w.wickets) : null,
      strikeRate: w.wickets > 0 ? round(w.balls / w.wickets) : null,
    },
    fielding: { ...f, total: f.catches + f.stumpings + f.runOuts },
  };
});

// ---------- Save everything to a file ----------
fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_FOLDER, "players.json"), JSON.stringify(list, null, 2));
console.log(`Saved ${list.length} players to output/players.json`);

// ---------- Show the leaderboards ----------
console.log("\nTop 10 run scorers");
console.table(
  [...list]
    .sort((a, b) => b.batting.runs - a.batting.runs)
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      matches: p.matches,
      runs: p.batting.runs,
      average: p.batting.average,
      strikeRate: p.batting.strikeRate,
      highScore: p.batting.highScore,
    }))
);

console.log("Top 10 wicket takers");
console.table(
  [...list]
    .sort((a, b) => b.bowling.wickets - a.bowling.wickets)
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      matches: p.matches,
      overs: p.bowling.overs,
      wickets: p.bowling.wickets,
      economy: p.bowling.economy,
      average: p.bowling.average,
    }))
);

console.log("Top 10 fielders");
console.table(
  [...list]
    .sort((a, b) => b.fielding.total - a.fielding.total)
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      catches: p.fielding.catches,
      stumpings: p.fielding.stumpings,
      runOuts: p.fielding.runOuts,
      total: p.fielding.total,
    }))
);