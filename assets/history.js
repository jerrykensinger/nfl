/* history.js — league record book. Calculations are carried over unchanged
 * from the original nfl-league.js history section; sources are the archived
 * current-season file (nfl-weekly-history.json, updated automatically) and the
 * verified past seasons (nfl-legacy-YYYY.json). */
(() => {
  'use strict';
  const { $, el, messageRow } = NFL;
  const CURRENT_YEAR = 2026;

  function archiveSeasons(history, legacy) {
    const older = (legacy || []).filter(y => y && Array.isArray(y.verified_weeks))
      .map(y => ({ year: +y.season, weeks: y.verified_weeks,
        scores: y.season_scores || [], excluded: y.excluded || [] }));
    const currentWeeks = history && Array.isArray(history.weeks) ? history.weeks : [];
    if (currentWeeks.length) {
      const overall = new Map();
      const normalizedWeeks = currentWeeks.map(w => {
        const scores = w.records || {};
        const records = Object.entries(scores).map(([player, s]) => ({
          player, correct: +s.correct || 0, wrong: +s.wrong || 0, push: +s.push || 0
        }));
        const best = Math.max(0, ...records.map(r => r.correct));
        records.forEach(r => {
          if (!overall.has(r.player)) overall.set(r.player,
            { player: r.player, correct: 0, wrong: 0, push: 0, weeks: 0 });
          const total = overall.get(r.player);
          total.correct += r.correct;
          total.wrong += r.wrong;
          total.push += r.push;
          total.weeks++;
        });
        return { week: +w.week, games: Array.isArray(w.games) ? w.games : [],
          winners: records.filter(r => r.correct === best), scores };
      });
      older.push({ year: CURRENT_YEAR, weeks: normalizedWeeks,
        scores: [...overall.values()].sort((a, b) => b.correct - a.correct),
        excluded: [] });
    }
    return older.sort((a, b) => b.year - a.year);
  }

  // Season options follow the data, so a new archived season appears by itself.
  function syncYearOptions(filter, seasons) {
    const want = ['all', ...seasons.map(s => String(s.year))];
    const have = [...filter.options].map(o => o.value);
    if (want.join() === have.join()) return;
    const keep = filter.value;
    filter.replaceChildren(...want.map(v => {
      const o = el('option', v === 'all' ? 'All seasons' : +v === CURRENT_YEAR ? `${v} (current)` : v);
      o.value = v; return o;
    }));
    filter.value = want.includes(keep) ? keep : 'all';
  }

  let view = { history: null, legacy: [] };
  function render(history, legacy) {
    view = { history, legacy };
    const filter = $('history-year-filter');
    if (!filter.dataset.bound) {
      filter.dataset.bound = '1';
      const saved = NFL.pref.get('history-year');
      if (saved) filter.dataset.wanted = saved;
      filter.addEventListener('change', () => {
        NFL.pref.set('history-year', filter.value);
        render(view.history, view.legacy);
      });
    }
    const seasons = archiveSeasons(history, legacy);
    syncYearOptions(filter, seasons);
    if (filter.dataset.wanted) {
      if ([...filter.options].some(o => o.value === filter.dataset.wanted)) filter.value = filter.dataset.wanted;
      delete filter.dataset.wanted;
    }
    const selected = filter.value === 'all' ? seasons : seasons.filter(s => String(s.year) === filter.value);
    const weeks = selected.flatMap(s => s.weeks.map(w => ({ ...w, year: s.year })))
      .sort((a, b) => b.year - a.year || b.week - a.week);
    const games = weeks.flatMap(w => (w.games || []).map(g => ({ ...g, year: w.year, week: w.week })));
    const surprise = games.filter(g => !g.push && g.picked > 0 && g.correct === 0);
    const solo = games.filter(g => !g.push && g.picked > 0 && g.correct === 1);
    const unanimous = games.filter(g => !g.push && g.picked > 0 && g.correct === g.picked);

    const counts = new Map();
    for (const w of weeks) for (const winner of w.winners || [])
      counts.set(winner.player, (counts.get(winner.player) || 0) + 1);
    const most = Math.max(0, ...counts.values());
    const leaders = [...counts].filter(([, count]) => count === most).map(([player]) => player).sort();

    const allWinners = weeks.flatMap(w => (w.winners || []).map(p => ({ ...p, year: w.year, week: w.week })));
    const bestWin = allWinners.slice().sort((a, b) =>
      (+b.correct || 0) - (+a.correct || 0) || (+a.wrong || 0) - (+b.wrong || 0))[0];

    const stat = (index, value, detail) => {
      const box = $('history-kpis').children[index];
      box.querySelector('strong').textContent = value;
      let note = box.querySelector('small');
      if (!note) { note = el('small'); box.append(note); }
      note.textContent = detail;
    };
    stat(0, most ? leaders.join(' & ') : '—', most ? most + ' weekly wins' : 'No completed weeks');
    stat(1, bestWin ? bestWin.correct + '–' + bestWin.wrong : '—',
      bestWin ? bestWin.player + ' · ' + bestWin.year + ', Week ' + bestWin.week : 'No record yet');
    stat(2, String(surprise.length), 'Games nobody picked correctly');
    stat(3, String(solo.length), 'Games only one player called');

    // Season champions
    const championBody = $('history-champions');
    championBody.replaceChildren();
    for (const s of selected) {
      const ranks = [...s.scores].sort((a, b) => (+b.correct || 0) - (+a.correct || 0));
      if (!ranks.length) continue;
      const best = +ranks[0].correct || 0;
      const topPlayers = ranks.filter(p => (+p.correct || 0) === best);
      const played = (+ranks[0].correct || 0) + (+ranks[0].wrong || 0);
      const complete = s.year < CURRENT_YEAR && s.weeks.length === 18 && !s.excluded.length;
      const tr = el('tr', null, complete ? 'is-champion' : '');
      const yearTh = el('th', String(s.year)); yearTh.scope = 'row'; tr.append(yearTh);
      const who = el('td'); who.append(el('strong', topPlayers.map(p => p.player).join(' & ')));
      who.append(el('small', complete ? '🏆 Champion' : s.year === CURRENT_YEAR
        ? `Leader · ${s.weeks.length} weeks complete` : `Leader · partial (${s.weeks.length}/18)`, 'champ-tag'));
      tr.append(who);
      const c = el('td', null, 'num');
      c.append(el('strong', String(best)), el('small', played ? (100 * best / played).toFixed(1) + '%' : '—', 'champ-tag'));
      tr.append(c);
      championBody.append(tr);
    }
    if (!championBody.children.length) messageRow(championBody, 'No seasons available.', 3);

    // Weekly wins leaderboard (shared wins count for each tied winner)
    const lb = $('history-win-leaders');
    lb.replaceChildren();
    const ranked = NFL.rankRows([...counts].map(([player, n]) => ({ player, n }))
      .sort((a, b) => b.n - a.n || a.player.localeCompare(b.player)), r => r.n);
    ranked.forEach(r => {
      const tr = el('tr');
      tr.append(el('td', r._rank, 'num rank'));
      const th = el('th', r.player); th.scope = 'row'; tr.append(th);
      tr.append(el('td', r.n, 'num'));
      lb.append(tr);
    });
    if (!ranked.length) messageRow(lb, 'No completed weeks.', 3);

    // Previous weekly winners
    const winnerBody = $('history-winners');
    winnerBody.replaceChildren();
    for (const w of weeks) {
      if (!w.winners?.length) continue;
      const first = w.winners[0];
      const tr = el('tr');
      const th = el('th', w.year + ' · Wk ' + w.week); th.scope = 'row'; tr.append(th);
      tr.append(el('td', w.winners.map(p => p.player).join(' & '), 'wrap'));
      tr.append(el('td', (+first.correct || 0) + '–' + (+first.wrong || 0) +
        (+first.push ? ' (' + first.push + 'P)' : ''), 'num'));
      winnerBody.append(tr);
    }
    if (!winnerBody.children.length) messageRow(winnerBody, 'No completed weeks for this season.', 3);

    // Storylines (best weekly record, streaks, against the crowd, unanimous)
    const storyList = $('history-storylines');
    storyList.replaceChildren();
    const stories = [];
    const perfect = allWinners.filter(w => w.wrong === 0 && w.correct >= 12);
    if (perfect.length) {
      const best = perfect.sort((a, b) => b.correct - a.correct)[0];
      stories.push(['Perfect week', best.player + ' went ' + best.correct + '–0 in ' + best.year + ' Week ' + best.week + '.']);
    }
    let streak = { count: 0, player: '', year: 0, end: 0 };
    const persons = [...new Set(allWinners.map(w => w.player))];
    for (const s of selected) for (const p of persons) {
      const winningWeeks = new Set(s.weeks.filter(w => w.winners?.some(v => v.player === p)).map(w => +w.week));
      for (const week of winningWeeks) {
        let len = 1;
        while (winningWeeks.has(week - len)) len++;
        if (len > streak.count) streak = { count: len, player: p, year: s.year, end: week };
      }
    }
    if (streak.count >= 2) stories.push(['Winning streak', streak.player + ' shared or won ' +
      streak.count + ' consecutive weeks in ' + streak.year + ' (through Week ' + streak.end + ').']);
    const loneCounts = new Map();
    for (const g of solo) if (g.lone_correct) loneCounts.set(g.lone_correct, (loneCounts.get(g.lone_correct) || 0) + 1);
    if (loneCounts.size) {
      const [player, count] = [...loneCounts].sort((a, b) => b[1] - a[1])[0];
      stories.push(['Against the crowd', player + ' was the only correct picker ' + count + (count === 1 ? ' time.' : ' times.')]);
    }
    stories.push(['Unanimous', unanimous.length + ' games were unanimous correct picks across the chosen completed weeks.']);
    stories.push(['Weekly-win leaders', (most ? leaders.join(' & ') + ' (' + most + ' each)' : 'not available') + '.']);
    stories.forEach(([k, v]) => { const li = el('li'); li.append(el('strong', k + ': '), document.createTextNode(v)); storyList.append(li); });

    const gameList = (id, values, kind) => {
      const list = $(id);
      list.replaceChildren();
      for (const g of values.slice().sort((a, b) => b.year - a.year || b.week - a.week || b.game - a.game).slice(0, 12)) {
        const li = el('li');
        li.append(el('strong', g.winner));
        li.append(document.createTextNode(' beat the league · ' + g.year + ' Week ' + g.week));
        li.append(el('span', g.away + ' vs ' + g.home + ' · ' +
          (kind === 'solo' ? g.lone_correct + ' was the lone correct picker'
            : '0 of ' + g.picked + ' correctly picked the winner'), 'history-game-note'));
        list.append(li);
      }
      if (!list.children.length) list.append(el('li', 'No matching completed games.'));
    };
    gameList('history-stunners', surprise, 'surprise');
    gameList('history-lone-picks', solo, 'solo');

    const missing = selected.filter(s => s.year < CURRENT_YEAR && s.weeks.length < 18)
      .map(s => s.year + ' (' + s.weeks.length + '/18 weeks)');
    $('history-footnote').textContent = weeks.length + ' completed weeks, ' + games.length +
      ' archived matchups included. NFL ties count as pushes. Shared wins count for each player.' +
      (missing.length ? ' Partial historical seasons: ' + missing.join(', ') +
        '; their season leaders are not confirmed champions.' : '') +
      ' Current ' + CURRENT_YEAR + ' results count completed weeks only.';
    $('history-sub').textContent = 'Archived NFL league picks from 2023 onward · ' +
      weeks.length + ' completed weeks' + (filter.value === 'all' ? ' across all seasons.' : ' in ' + filter.value + '.');
  }

  NFL.start({
    needs: { history: true, legacy: true },
    render(d) {
      if (!d.history && !d.legacy.length) throw new Error('No history available');
      render(d.history, d.legacy);
      const upd = $('league-updated');
      if (upd && d.history && d.history.updated_at) {
        const t = new Date(d.history.updated_at);
        upd.textContent = 'Current season archived automatically · last archive ' +
          t.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
      }
    },
    renderError() {
      $('history-sub').textContent = 'League history is temporarily unavailable. Retrying automatically.';
    }
  });
})();
