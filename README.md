# 🏏 Cricify

A cricket stats web app for exploring batting, bowling and fielding records. Built as a learning project with Node.js, Express and Chart.js, using ball-by-ball data from [Cricsheet](https://cricsheet.org).

## Features

- **Player search:** find any player and see their career stats
- **Batting, bowling and fielding tabs:** runs, average, strike rate, wickets, economy, catches and more
- **Season charts:** see how a player's performance changed year by year
- **Leaderboards:** top players in each stat, with minimum-qualification filters so averages are meaningful

## Tech stack

- **Node.js** for processing the data and running the server
- **Express** for the API
- **HTML, CSS and vanilla JavaScript** for the front end
- **Chart.js** for the charts

## How it works

1. `careerStats.js` reads every Cricsheet match file and adds up career and per-season stats for each player, using Cricsheet's unique player IDs. It saves the result to `output/players.json`.
2. `server.js` loads that file and serves it through a small API (`/api/players`, `/api/players/:id`, `/api/leaderboard`).
3. The pages in `public/` fetch from the API and display the data.

## Running it locally

1. Install [Node.js](https://nodejs.org) (LTS version).
2. Clone this repo and install the dependencies:
```bash
   git clone https://github.com/swammy260/cricify.git
   cd cricify
   npm install
```
3. Download the JSON match files from [Cricsheet](https://cricsheet.org/downloads) and unzip them into a folder called `stats/`.
4. Generate the player stats:
```bash
   node careerStats.js
```
5. Start the server:
```bash
   node server.js
```
6. Open http://localhost:3000

## Cricket rules handled

- Wides don't count as balls faced, and wides and no-balls don't count towards a bowler's overs
- Byes and leg byes aren't charged to the bowler
- Run-outs aren't credited to the bowler
- Retired hurt isn't counted as a dismissal for batting averages
- Super overs are excluded from career stats
- Substitute fielders aren't credited with catches

## Roadmap

- [ ] Compare two players
- [ ] Team, opposition and venue filters
- [ ] Move data storage to SQLite
- [ ] Match scorecard pages
- [ ] Deploy online

## Data

Match data comes from [Cricsheet](https://cricsheet.org). Check their site for the current licence and attribution terms before sharing or deploying the project.