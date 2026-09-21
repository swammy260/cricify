const fs = require("fs");

const file = "stats/335982.json";
const match = JSON.parse(fs.readFileSync(file, "utf8"));

// Only these dismissals count as the bowler's wickets.
// Run outs, retired hurt, etc. are NOT credited to the bowler.
const BOWLER_WICKETS = [
  "bowled",
  "caught",
  "caught and bowled",
  "lbw",
  "stumped",
  "hit wicket",
];

const bowlers = {};

function getBowler(name) {
  if (!bowlers[name]) {
    bowlers[name] = { balls: 0, runs: 0, wickets: 0 };
  }
  return bowlers[name];
}

for (const innings of match.innings) {
  for (const over of innings.overs) {
    for (const ball of over.deliveries) {
      const bowler = getBowler(ball.bowler);
      const extras = ball.extras || {};

      // Wides and no-balls are not legal deliveries, so they don't count toward overs
      const isLegal = !extras.wides && !extras.noballs;
      if (isLegal) {
        bowler.balls += 1;
      }

      // Runs conceded = runs off the bat + wides + no-balls.
      // Byes and leg byes are NOT charged to the bowler.
      bowler.runs += ball.runs.batter + (extras.wides || 0) + (extras.noballs || 0);

      // Wickets credited to the bowler
      if (ball.wickets) {
        for (const wicket of ball.wickets) {
          if (BOWLER_WICKETS.includes(wicket.kind)) {
            bowler.wickets += 1;
          }
        }
      }
    }
  }
}

const results = Object.entries(bowlers)
  .map(([name, s]) => ({
    name,
    overs: `${Math.floor(s.balls / 6)}.${s.balls % 6}`,
    runs: s.runs,
    wickets: s.wickets,
    economy: s.balls > 0 ? Number((s.runs / (s.balls / 6)).toFixed(2)) : 0,
  }))
  .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy);

console.table(results);