# nfl.jerrykensinger.com

NFL Picks League site, served by GitHub Pages from this repo (`CNAME` → nfl.jerrykensinger.com).

## Pages
| URL | File | Script |
| --- | --- | --- |
| `/` Home — leaders, week status, pick-submission summary | `index.html` | `assets/home.js` |
| `/games/` — matchup cards (default) or full grid on wide screens | `games/index.html` | `assets/games.js` |
| `/standings/` — Season · This week tabs + completed weekly records | `standings/index.html` | `assets/standings.js` |
| `/history/` — record book with season selector | `history/index.html` | `assets/history.js` |
| any other path | `404.html` | — |

Every page loads `assets/league-core.js` (feed loading, feed safeguard, refresh loop, helpers) and `assets/league.css`. Shared theme tokens and the theme toggle still come from `https://jerrykensinger.com/style.css` and `script.js`. The header/nav markup is the same block on every page; when changing it, change all five HTML files. Bump the `?v=` query on the asset links when changing CSS/JS.

## Data (read-only, public sources)
- Google Sheet **NFL League Website Feed** (`18BN00MtCX4iSMBtkPdbS2LVBOE3BnMdppQnPQY1fUJM`), tabs `meta`, `submission_status`, `games`, `weekly_records`, `season_standings`. An updater writes it every ~30 min from the private master workbook; this site never writes anywhere.
- `https://jerrykensinger.com/nfl-weekly-history.json` — completed weeks, appended automatically by the **Archive NFL weekly records** workflow in `jerrykensinger/jerrykensinger.github.io`.
- `https://jerrykensinger.com/nfl-legacy-2023.json` … `-2025.json` — verified past seasons.

## Rules the pages rely on
- Pick reveal is enforced by the feed: a game's pick cells stay blank until every active player has picked that game or it has kicked off. Pages show only what the feed publishes and never infer hidden picks.
- NFL ties are pushes (neither correct nor wrong) but count as final games.
- Pages refresh every 5 minutes, and when a phone brings the tab back to the foreground.
