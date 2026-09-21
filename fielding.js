const fs = require("fs");

const file = "stats/335982.json";
const match = JSON.parse(fs.readFileSync(file, "utf8"));

const fielders = {};

function getFielder(name) {
  if (!fielders[name]) {
    fielders[name] = { catches: 0, stumpings: 0, runOuts: 0 };
  }
  return fielders[name];
}

for (const innings of match.innings) {
  for (const over of innings.overs) {
    for (const ball of over.deliveries) {
      if (!ball.wickets) continue;

      for (const wicket of ball.wickets) {
        // Some dismissals (bowled, lbw) have no fielder at all
        let involved = wicket.fielders || [];

        // For "caught and bowled", the bowler is the fielder.
        // Use the bowler if the file doesn't list anyone.
        if (wicket.kind === "caught and bowled" && involved.length === 0) {
          involved = [{ name: ball.bowler }];
        }

        for (const f of involved) {
          if (!f.name) continue; // skip if the fielder is unknown

          const player = getFielder(f.name);

          if (wicket.kind === "caught" || wicket.kind === "caught and bowled") {
            player.catches += 1;
          } else if (wicket.kind === "stumped") {
            player.stumpings += 1;
          } else if (wicket.kind === "run out") {
            player.runOuts += 1;
          }
        }
      }
    }
  }
}

const results = Object.entries(fielders)
  .map(([name, s]) => ({
    name,
    catches: s.catches,
    stumpings: s.stumpings,
    runOuts: s.runOuts,
    total: s.catches + s.stumpings + s.runOuts,
  }))
  .sort((a, b) => b.total - a.total);

console.table(results);