/* home.js — glanceable league dashboard (nfl.jerrykensinger.com/) */
(() => {
  'use strict';
  const { $, el, plural, listJoin } = NFL;

  // Links from the old single-page layout (/#season etc.) go to their new home.
  const moved = { '#games': '/games/', '#season': '/standings/', '#weekly': '/standings/#week',
    '#submissions': '/', '#history': '/history/' };
  if (moved[location.hash] && moved[location.hash] !== '/') location.replace(moved[location.hash]);

  function card(id, label, title, detail) {
    const c = $(id);
    if (!c) return;
    if (label !== null) c.querySelector('span').textContent = label;
    c.querySelector('h2').textContent = title;
    c.querySelector('p').textContent = detail;
  }

  function renderCards(d) {
    const meta = d.meta;
    const total = +meta.games_total || 0, fin = +meta.games_final || 0;
    const remaining = Math.max(0, total - fin);

    const season = [...d.season].sort((a, b) => (+a.rank || 99) - (+b.rank || 99));
    if (season.length) {
      const topRank = +season[0].rank || 1;
      const tops = season.filter(p => (+p.rank || 99) === topRank);
      card('card-season-leader', 'Season leader', tops.map(p => p.player).join(' & '),
        `${season[0].correct} correct · ${season[0].wrong} wrong · ${season[0].win_pct}%`);
    } else {
      card('card-season-leader', 'Season leader', 'No standings yet', 'Season standings appear after Week 1.');
    }

    const scored = +meta.games_scored || 0;
    if (!scored || !d.weekly.length) {
      card('card-week-leaders', `Week ${meta.week} leader`, 'Waiting for results',
        'Standings appear as games finish and picks are scored.');
    } else {
      const best = Math.max(...d.weekly.map(q => +q.correct || 0));
      const leaders = d.weekly.filter(p => (+p.correct || 0) === best);
      const many = leaders.length > 3;
      card('card-week-leaders', `Week ${meta.week} ${leaders.length > 1 ? 'leaders' : 'leader'}`,
        many ? `${leaders.length}-way tie` : leaders.map(p => p.player).join(' & '),
        `${plural(best, 'correct')}${leaders.length > 1 ? ' each' : ''} · ${scored} of ${total} games scored`);
      const c = $('card-week-leaders');
      c.title = many ? leaders.map(p => p.player).join(', ') : '';
    }

    if (!total) card('card-pending', 'Week status', 'Season not started', 'Games appear once the schedule is set.');
    else if (remaining) card('card-pending', 'Week status', `${plural(remaining, 'game')} remaining`,
      `${fin} of ${total} final${d.gameRows.some(g => g.state === 'in_progress') ? ' · games in progress' : ''}`);
    else card('card-pending', 'Week status', 'All games final', 'Final weekly standings are in.');
  }

  function renderPicks(d) {
    const rows = d.submission;
    const count = $('picks-count'), bar = $('picks-bar'), detail = $('picks-detail');
    if (!rows.length) {
      count.textContent = 'No players yet';
      detail.textContent = '';
      return;
    }
    const done = rows.filter(r => r.status === 'COMPLETE');
    const missing = rows.filter(r => r.status !== 'COMPLETE').map(r => r.player);
    const all = missing.length === 0;
    count.textContent = all ? `✅ All ${rows.length} picks are in` : `${done.length} of ${rows.length} complete`;
    bar.setAttribute('aria-valuemax', String(rows.length));
    bar.setAttribute('aria-valuenow', String(done.length));
    bar.setAttribute('aria-valuetext', `${done.length} of ${rows.length} players have all picks in`);
    bar.firstElementChild.style.width = `${(done.length / rows.length) * 100}%`;
    bar.classList.toggle('is-complete', all);
    detail.replaceChildren();
    if (!all) {
      detail.append(el('strong', listJoin(missing)));
      detail.append(document.createTextNode(missing.length === 1 ? ' still has picks to make' : ' still have picks to make'));
    } else {
      detail.textContent = 'Every player is set for the week.';
    }
  }

  function renderLinks(d) {
    const g = $('link-games-title');
    if (g) g.textContent = `View Week ${d.meta.week} games`;
    const gs = $('link-games-sub');
    if (gs) {
      const live = d.gameRows.filter(x => x.state === 'in_progress').length;
      gs.textContent = live ? `${plural(live, 'game')} live now · scores & revealed picks`
        : 'Scores, revealed picks & league consensus';
    }
  }

  NFL.start({
    needs: { feed: true },
    render(d) { renderCards(d); renderPicks(d); renderLinks(d); },
    renderError() {
      ['card-season-leader', 'card-week-leaders', 'card-pending'].forEach(id =>
        card(id, null, 'Unavailable', 'Retrying automatically.'));
      const c = $('picks-count'); if (c) c.textContent = 'Temporarily unavailable';
    }
  });
})();
