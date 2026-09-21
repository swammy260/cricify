const fs = require("fs");

const file = "stats/335982.json";

const match = JSON.parse(fs.readFileSync(file, "utf8"));

console.log("Teams:", match.info.teams);
console.log("First delivery:", match.innings[0].overs[0].deliveries[0]);