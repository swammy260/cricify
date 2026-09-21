const fs = require("fs");

const file = "stats/335982.json";
const match = JSON.parse(fs.readFileSync(file, "utf8"));

// This will hold one entry per batter, e.g. batters["V Kohli"] = { runs: 12, balls: 8, out: false }
const batters = {};

// Helper: make sure a batter has an entry before we add to it
function getBatter(name) {
  if (!batters[name]) {
    batters[name] = { runs: 0, balls: 0, out: false };
  }
  return batters[name];
}

// Loop through every innings, over, and ball
for (const innings of match.innings) {
  for (const over of innings.overs) {
    for (const ball of over.deliveries) {
      const batter = getBatter(ball.batter);

      // Runs scored off the bat (not extras)
      batter.runs += ball.runs.batter;

      // A wide doesn't count as a ball faced. No-balls do.
      const isWide = ball.extras && ball.extras.wides;
      if (!isWide) {
        batter.balls += 1;
      }

      // If a wicket fell, mark whoever got out (not always the batter on strike)
      if (ball.wickets) {
        for (const wicket of ball.wickets) {
          getBatter(wicket.player_out).out = true;
        }
      }
    }
  }
}

// Turn the object into a list, add strike rate, and sort by runs
const results = Object.entries(batters)
  .map(([name, s]) => ({
    name,
    runs: s.runs,
    balls: s.balls,
    strikeRate: s.balls > 0 ? Number(((s.runs / s.balls) * 100).toFixed(2)) : 0,
    out: s.out ? "out" : "not out",
  }))
  .sort((a, b) => b.runs - a.runs);

console.table(results);