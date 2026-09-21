const fs = require("fs");
const path = require("path");

const STATS_FOLDER = "stats";
const OUTPUT_FOLDER = "output";

// Dismissals that count as the bowler's wicket
const BOWLER_WICKETS = ["bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket"];

// These end a batter's innings but are NOT "out" for averages
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
      seasons: {}, // NEW: one entry per season, e.g. seasons["2009"]
    };
  }
  return players[id];
}

// NEW: get (or create) a player's stats bucket for one season
function getSeason(player, season) {
  if (!player.seasons[season]) {
    player.seasons[season] = {
      season,
      matches: 0,
      batting: { innings: 0, runs: 0, balls: 0, dismissals: 0 },
      bowling: { balls: 0, runs: 0, wickets: 0 },
      fielding: { catches: 0, stumpings: 0, runOuts: 0 },
    };
  }
  return player.seasons[season];
}

function round(n) {
  return Number(n.toFixed(2));
}

function processMatch(match) {
  // Cricsheet records the season, e.g. "2007/08" or 2009
  const season = String(match.info.season || "Unknown");

  // The registry maps each player's name to a unique ID
  const registry = (match.info.registry && match.info.registry.people) || {};
  const idOf = (name) => registry[name] || name;
  const get = (name) => getPlayer(idOf(name), name);

  // Count a match played for everyone in the team lists (career and season)
  for (const team of Object.values(match.info.players || {})) {
    for (const name of team) {
      const player = get(name);
      player.matches += 1;
      getSeason(player, season).matches += 1;
    }
  }

  for (const innings of match.innings || []) {
    // Career stats normally leave super overs out
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

        // ---- Batting (added up at the end of the innings) ----
        const batter = bat(ball.batter);
        batter.runs += ball.runs.batter;
        if (!extras.wides) batter.balls += 1;

        // ---- Bowling: update the career AND the season ----
        const bowler = get(ball.bowler);
        const bowlingTargets = [bowler.bowling, getSeason(bowler, season).bowling];
        const isLegal = !extras.wides && !extras.noballs;
        const conceded = ball.runs.batter + (extras.wides || 0) + (extras.noballs || 0);
        for (const target of bowlingTargets) {
          if (isLegal) target.balls += 1;
          target.runs += conceded;
        }

        // ---- Wickets ----
        for (const wicket of ball.wickets || []) {
          // Batter dismissed
          if (!NOT_DISMISSALS.includes(wicket.kind)) {
            bat(wicket.player_out).out = true;
          }

          // Bowler credited
          if (BOWLER_WICKETS.includes(wicket.kind)) {
            for (const target of bowlingTargets) target.wickets += 1;
          }

          // Fielders credited
          let involved = wicket.fielders || [];
          if (wicket.kind === "caught and bowled" && involved.length === 0) {
            involved = [{ name: ball.bowler }];
          }
          for (const f of involved) {
            if (!f.name || f.substitute) continue; // skip unknown names and substitutes
            const fielder = get(f.name);
            for (const target of [fielder.fielding, getSeason(fielder, season).fielding]) {
              if (wicket.kind === "caught" || wicket.kind === "caught and bowled") target.catches += 1;
              else if (wicket.kind === "stumped") target.stumpings += 1;
              else if (wicket.kind === "run out") target.runOuts += 1;
            }
          }
        }
      }
    }

    // End of innings: add each batter's innings to their career and season totals
    for (const b of Object.values(inningsBatters)) {
      const player = get(b.name);
      const career = player.batting;
      const seasonBatting = getSeason(player, season).batting;

      for (const target of [career, seasonBatting]) {
        target.innings += 1;
        target.runs += b.runs;
        target.balls += b.balls;
        if (b.out) target.dismissals += 1;
      }

      // These only make sense for the whole career
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
function battingWithRates(b) {
  return {
    ...b,
    average: b.dismissals > 0 ? round(b.runs / b.dismissals) : null,
    strikeRate: b.balls > 0 ? round((b.runs / b.balls) * 100) : null,
  };
}

function bowlingWithRates(w) {
  return {
    ...w,
    overs: `${Math.floor(w.balls / 6)}.${w.balls % 6}`,
    economy: w.balls > 0 ? round(w.runs / (w.balls / 6)) : null,
    average: w.wickets > 0 ? round(w.runs / w.wickets) : null,
    strikeRate: w.wickets > 0 ? round(w.balls / w.wickets) : null,
  };
}

function fieldingWithTotal(f) {
  return { ...f, total: f.catches + f.stumpings + f.runOuts };
}

const list = Object.values(players).map((p) => ({
  id: p.id,
  name: p.name,
  matches: p.matches,
  batting: battingWithRates(p.batting),
  bowling: bowlingWithRates(p.bowling),
  fielding: fieldingWithTotal(p.fielding),
  seasons: Object.values(p.seasons)
    .sort((a, b) => a.season.localeCompare(b.season))
    .map((s) => ({
      season: s.season,
      matches: s.matches,
      batting: battingWithRates(s.batting),
      bowling: bowlingWithRates(s.bowling),
      fielding: fieldingWithTotal(s.fielding),
    })),
}));

// ---------- Save everything to a file ----------
fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_FOLDER, "players.json"), JSON.stringify(list, null, 2));
console.log(`Saved ${list.length} players to output/players.json`);