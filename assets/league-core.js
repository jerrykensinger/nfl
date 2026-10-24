/* league-core.js — shared data layer for nfl.jerrykensinger.com
 *
 * Reads ONLY sanitized public sources:
 *   - the public "NFL League Website Feed" Google Sheet (tabs: meta,
 *     submission_status, games, weekly_records, season_standings), written
 *     every ~30 min from the private master workbook + ESPN final scores
 *   - archived history JSON on jerrykensinger.com (nfl-weekly-history.json is
 *     updated automatically by that repo's "Archive NFL weekly records"
 *     workflow; nfl-legacy-YYYY.json hold verified past seasons)
 *
 * Reveal rules are enforced by the feed itself: it leaves a game's pick
 * cells blank until every active player has picked that matchup or its
 * kickoff has passed. Pages render only what the feed publishes and never
 * infer hidden picks.
 *
 * Each page loads this file plus one page module that calls
 * NFL.start({ needs, render }).
 */
(() => {
  'use strict';

  const FEED_ID = '18BN00MtCX4iSMBtkPdbS2LVBOE3BnMdppQnPQY1fUJM';
  const REFRESH_MS = 5 * 60 * 1000;
  // Archived data files live on the main site (its workflow commits there).
  const SITE = 'https://jerrykensinger.com/';
  const LEGACY_YEARS = [2023, 2024, 2025];

  const ABBR = {
    'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL',
    'Buffalo Bills': 'BUF', 'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI',
    'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE', 'Dallas Cowboys': 'DAL',
    'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB',
    'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX',
    'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC',
    'Los Angeles Rams': 'LAR', 'Miami Dolphins': 'MIA', 'Minnesota Vikings': 'MIN',
    'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG',
    'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT',
    'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB',
    'Tennessee Titans': 'TEN', 'Washington Commanders': 'WSH', 'New Orlean Saints': 'NO'
  };
  const abbr = name => ABBR[name] || name;
  // Short display name: "Chicago Bears" -> "Chicago"; keeps two-word cities.
  const city = name => {
    const n = String(name || '');
    const parts = n.split(' ');
    if (parts.length < 2) return n;
    const twoWord = ['New', 'Los', 'Las', 'San', 'Tampa', 'Green', 'Kansas'];
    if (twoWord.includes(parts[0]) && parts.length > 2) {
      // Disambiguate shared cities by nickname.
      if (parts[0] + ' ' + parts[1] === 'New York') return 'NY ' + parts.slice(2).join(' ');
      if (parts[0] + ' ' + parts[1] === 'Los Angeles') return 'LA ' + parts.slice(2).join(' ');
      return parts.slice(0, 2).join(' ');
    }
    return parts.slice(0, -1).join(' ');
  };

  const $ = id => document.getElementById(id);

  function el(tag, text, cls) {
    const e = document.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const listJoin = items => items.length < 2 ? items.join('')
    : items.length === 2 ? `${items[0]} and ${items[1]}`
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

  function timeout(ms) {
    return typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
  }

  async function gviz(sheet) {
    const url = `https://docs.google.com/spreadsheets/d/${FEED_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}`;
    const res = await fetch(url, { cache: 'no-store', signal: timeout(15000) });
    if (!res.ok) throw new Error('feed ' + res.status);
    const text = await res.text();
    const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (data.status !== 'ok') throw new Error('feed status ' + data.status);
    const labels = data.table.cols.map(c => c.label);
    const rows = (data.table.rows || []).map(r => (r.c || []).map(cell => (cell && cell.v !== null && cell.v !== undefined) ? cell.v : ''));
    return { labels, rows };
  }

  function asObjects(parsed) {
    return parsed.rows.map(r => {
      const o = {};
      parsed.labels.forEach((l, i) => { o[l] = r[i]; });
      return o;
    });
  }

  async function weeklyHistory() {
    const res = await fetch(SITE + 'nfl-weekly-history.json?ts=' + Date.now(), {
      cache: 'no-store', signal: timeout(15000)
    });
    if (!res.ok) throw new Error('weekly history ' + res.status);
    return res.json();
  }

  // 2023–25 seasons were reconstructed from their archived Google Sheets.
  let legacyPromise = null;
  function loadLegacyHistory() {
    if (!legacyPromise) {
      legacyPromise = Promise.all(LEGACY_YEARS.map(async year => {
        const response = await fetch(SITE + 'nfl-legacy-' + year + '.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Historical season ' + year + ': ' + response.status);
        return response.json();
      })).catch(err => { legacyPromise = null; throw err; });
    }
    return legacyPromise;
  }

  function fmtKickoff(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  }
  function fmtKickoffLong(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  }
  // "2026-10-24 10:43 AM ET" -> "10:43 AM ET" (date kept when not today).
  function fmtUpdated(generatedEt, generatedUtc) {
    const d = new Date(generatedUtc);
    if (!isNaN(d)) {
      const opts = { timeZone: 'America/New_York' };
      const sameDay = d.toLocaleDateString('en-US', opts) === new Date().toLocaleDateString('en-US', opts);
      return d.toLocaleString('en-US', { ...opts, ...(sameDay ? {} : { weekday: 'short' }), hour: 'numeric', minute: '2-digit' }) + ' ET';
    }
    return generatedEt || '';
  }

  // The feed writer has mistakenly included dashboard Sorted Results rows as
  // games. Only an actual NFL-vs-NFL matchup may affect live game totals.
  function normalizeFeed(meta, submission, parsedGames) {
    const all = asObjects(parsedGames);
    const isGame = g => Object.hasOwn(ABBR, String(g.away).trim()) &&
      Object.hasOwn(ABBR, String(g.home).trim()) &&
      String(g.away).trim() !== String(g.home).trim() &&
      Number.isInteger(+g.game) && +g.game >= 1 && +g.game <= 16;
    const real = all.filter(isGame);
    const extra = all.filter(g => !isGame(g));
    const total = real.length;

    // Known feed bug: each standings row leaks false picks into the first
    // dashboard player columns. n_picked says how many leaked. Apply only
    // when the exact known standings-row shape is present.
    const standingsLeak = extra.length > 0 && extra.every(g =>
      submission.some(p => p.player === String(g.away)) &&
      /^\d+$/.test(String(g.home)) && !g.kickoff_et &&
      g.state === 'scheduled' && [0, 1, 2].includes(+g.n_picked));
    const corrected = submission.map((p, idx) => {
      const extraPicks = standingsLeak ? extra.filter(g => +g.n_picked > idx).length : 0;
      const picks = Math.max(0, Math.min(total, (+p.picks_in || 0) - extraPicks));
      return { ...p, picks_in: picks, games_total: total,
        status: picks === total && total > 0 ? 'COMPLETE' :
          picks === 0 ? 'NOT STARTED' : `${total - picks} REMAINING` };
    });
    const parsed = { ...parsedGames, rows: parsedGames.rows.filter((r, i) => isGame(all[i])) };
    const players = parsed.labels.filter(l => l.endsWith('_pick')).map(l => l.slice(0, -5));
    return {
      meta: { ...meta, games_total: total,
        games_final: real.filter(g => g.state === 'final').length },
      submission: corrected,
      games: parsed,
      gameRows: asObjects(parsed),
      players
    };
  }

  // Shared view of one game, used by the cards and the grid.
  function gameView(g, players) {
    const final = g.state === 'final';
    const live = g.state === 'in_progress';
    const hasScores = g.away_score !== '' && g.home_score !== '';
    const tie = final && (String(g.winner).toUpperCase() === 'TIE' ||
      (!g.winner && hasScores && +g.away_score === +g.home_score));
    const picks = players.map(p => ({
      player: p,
      pick: String(g[`${p}_pick`] || '').trim(),
      result: String(g[`${p}_result`] || '').trim().toLowerCase()
    }));
    // A game is revealed exactly when the feed publishes its pick cells.
    const revealed = picks.some(p => p.pick);
    return { ...g, final, live, tie, picks, revealed,
      nPicked: +g.n_picked || 0, nPlayers: players.length };
  }

  /* ---------- page lifecycle ---------- */
  const state = { last: null, refreshing: false };

  function setUpdated(text) { const u = $('league-updated'); if (u) u.textContent = text; }

  function renderShared(data) {
    const meta = data.meta;
    if (!meta) return;
    const week = meta.week;
    document.querySelectorAll('[data-week]').forEach(n => { n.textContent = `Week ${week}`; });
    const eyebrow = $('league-eyebrow');
    if (eyebrow) eyebrow.textContent = `NFL Picks League · Week ${week}`;
    const badge = $('league-badge');
    const total = +meta.games_total || 0, fin = +meta.games_final || 0;
    if (badge) badge.textContent = total ? `${fin} of ${total} games final` : 'Season not started';
    setUpdated(`Live data · updated ${fmtUpdated(meta.generated_et, meta.generated_utc)} · refreshes automatically`);
  }

  async function load(needs) {
    const jobs = {};
    if (needs.feed) {
      jobs.meta = gviz('meta');
      jobs.submission = gviz('submission_status');
      jobs.games = gviz('games');
      jobs.weekly = gviz('weekly_records');
      jobs.season = gviz('season_standings');
    }
    if (needs.history) jobs.history = weeklyHistory().catch(() => null);
    if (needs.legacy) jobs.legacy = loadLegacyHistory().catch(() => []);
    const keys = Object.keys(jobs);
    const values = await Promise.all(keys.map(k => jobs[k]));
    const raw = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
    const data = { history: raw.history || null, legacy: raw.legacy || [] };
    if (needs.feed) {
      const sourceMeta = asObjects(raw.meta)[0] || {};
      if (!(+sourceMeta.week > 0) || !sourceMeta.generated_utc) throw new Error('Missing feed metadata');
      const clean = normalizeFeed(sourceMeta, asObjects(raw.submission), raw.games);
      Object.assign(data, clean, {
        weekly: asObjects(raw.weekly),
        season: asObjects(raw.season)
      });
    }
    return data;
  }

  function start({ needs = { feed: true }, render, renderError }) {
    async function refresh() {
      if (state.refreshing) return;
      state.refreshing = true;
      try {
        const data = await load(needs);
        if (needs.feed) renderShared(data);
        render(data);
        state.last = data;
        state.lastAt = Date.now();
        document.documentElement.classList.add('league-loaded');
      } catch (err) {
        const m = state.last && state.last.meta;
        if (needs.feed) setUpdated(state.last
          ? `Refresh unavailable · showing data updated ${m ? fmtUpdated(m.generated_et, m.generated_utc) : 'earlier'} · retrying automatically`
          : 'Live data unavailable · retrying automatically. Reload to try again now.');
        if (!state.last) {
          const badge = $('league-badge');
          if (badge) badge.textContent = 'Results unavailable';
          if (renderError) renderError(err);
        }
      } finally {
        state.refreshing = false;
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
    else refresh();
    setInterval(refresh, REFRESH_MS);
    // Catch up promptly when a phone brings the tab back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.last && Date.now() - (state.lastAt || 0) > 60000) refresh();
    });
  }

  // Small, failure-tolerant per-viewer preferences.
  const pref = {
    get(key) { try { return localStorage.getItem('nfl-' + key); } catch (e) { return null; } },
    set(key, v) { try { localStorage.setItem('nfl-' + key, v); } catch (e) { /* ignore */ } }
  };

  // Rank with ties: equal records share a rank (existing league behaviour).
  function rankRows(rows, keyFn) {
    let rank = 0, prev = null;
    return rows.map((r, i) => {
      const k = keyFn(r);
      if (k !== prev) rank = i + 1;
      prev = k;
      return { ...r, _rank: rank };
    });
  }

  function messageRow(body, text, span) {
    const tr = el('tr'), td = el('td', text);
    td.colSpan = span; tr.append(td); body.replaceChildren(tr);
  }

  window.NFL = {
    FEED_ID, SITE, ABBR, abbr, city, $, el, plural, listJoin, gviz, asObjects,
    normalizeFeed, gameView, weeklyHistory, loadLegacyHistory, fmtKickoff,
    fmtKickoffLong, fmtUpdated, start, pref, rankRows, messageRow
  };
})();
