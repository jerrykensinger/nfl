/* standings.js — Season | This week standings + completed weekly records */
(() => {
  'use strict';
  const { $, el, plural, rankRows, messageRow } = NFL;

  /* ---------- tabs ---------- */
  const tabs = [...document.querySelectorAll('.seg [role="tab"]')];
  function select(name, focus) {
    tabs.forEach(t => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    const hash = name === 'week' ? '#week' : '';
    if (location.hash !== hash) history.replaceState(null, '', location.pathname + hash);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.tab));
    t.addEventListener('keydown', e => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        select(tabs[e.key === 'Home' ? 0 : tabs.length - 1].dataset.tab, true);
      } else if (dir) {
        e.preventDefault();
        select(tabs[(i + dir + tabs.length) % tabs.length].dataset.tab, true);
      }
    });
  });
  select(location.hash === '#week' ? 'week' : 'season');
  window.addEventListener('hashchange', () => select(location.hash === '#week' ? 'week' : 'season'));

  /* ---------- season ---------- */
  function renderSeason(rows) {
    const body = $('season-body');
    const sorted = [...rows].sort((a, b) => (+a.rank || 99) - (+b.rank || 99));
    body.replaceChildren();
    if (!sorted.length) return messageRow(body, 'Season standings appear after the first completed week.', 6);
    sorted.forEach(p => {
      const tr = el('tr', null, +p.rank === 1 ? 'is-leader' : '');
      tr.append(el('td', p.rank, 'num rank'));
      const th = el('th', p.player); th.scope = 'row'; tr.append(th);
      tr.append(el('td', p.correct, 'num'));
      tr.append(el('td', p.wrong, 'num'));
      tr.append(el('td', `${p.win_pct}%`, 'num'));
      tr.append(el('td', p.weekly_wins, 'num'));
      body.append(tr);
    });
    $('season-sub').textContent = "Completed games · live from the league tracker's season standings.";
  }

  /* ---------- this week ---------- */
  function renderWeek(rows, meta) {
    const body = $('weekly-body');
    const sub = $('weekly-sub');
    const banner = $('weekly-winner');
    const total = +meta.games_total || 0, fin = +meta.games_final || 0;
    const scored = +meta.games_scored || 0;
    body.replaceChildren();
    banner.replaceChildren();
    if (!scored) {
      messageRow(body, 'No fully-picked final games yet — standings appear as each matchup fills up and completes.', 6);
      sub.textContent = `Week ${meta.week} — ` + (fin ? 'waiting for scored results.' : 'waiting for game results.');
      return;
    }
    const sorted = rankRows([...rows].sort((a, b) =>
      (+b.correct || 0) - (+a.correct || 0) || (+a.wrong || 0) - (+b.wrong || 0)),
      p => `${p.correct}-${p.wrong}`);
    sorted.forEach(p => {
      const tr = el('tr', null, p._rank === 1 ? 'is-leader' : '');
      tr.append(el('td', p._rank, 'num rank'));
      const th = el('th', p.player); th.scope = 'row'; tr.append(th);
      tr.append(el('td', p.correct, 'num'));
      tr.append(el('td', p.wrong, 'num'));
      tr.append(el('td', p.no_pick, 'num'));
      tr.append(el('td', (+p.scored || 0) ? `${p.win_pct}%` : '—', 'num'));
      body.append(tr);
    });
    sub.textContent = total && fin === total
      ? `Week ${meta.week} — final · all ${total} games final. NFL ties are pushes. Equal records are tied.`
      : `Week ${meta.week} — counting ${scored} of ${plural(total, 'game')} (fully picked & final). Equal records are tied.`;
    if (total && fin === total && sorted.length) {
      const top = +sorted[0].correct || 0;
      const winners = sorted.filter(p => (+p.correct || 0) === top).map(p => p.player);
      banner.append(el('strong', `🏆 Weekly winner${winners.length > 1 ? 's' : ''}: `));
      banner.append(document.createTextNode(`${winners.join(' & ')} (${top}-${sorted[0].wrong})`));
    }
  }

  /* ---------- completed weekly records (automatic, from the archive) ---------- */
  function renderCompleted(history, seasonRows) {
    const details = $('completed-weekly');
    const summary = $('completed-weekly-summary');
    const head = $('completed-weekly-head');
    const body = $('completed-weekly-body');
    const note = $('completed-weekly-note');
    const weeks = history && Array.isArray(history.weeks)
      ? history.weeks.slice().sort((a, b) => (+a.week || 0) - (+b.week || 0)) : [];
    if (!weeks.length) {
      summary.firstElementChild.textContent = 'Completed weekly records';
      messageRow(body, history ? 'No completed weeks archived yet.' : 'Weekly records are temporarily unavailable.', 2);
      return;
    }
    const lastWeek = +weeks[weeks.length - 1].week || 0;
    summary.firstElementChild.textContent = 'Completed weekly records';
    summary.querySelector('small').textContent = `Weeks 1–${lastWeek}`;

    head.replaceChildren();
    ['Rank', 'Player'].forEach(text => { const th = el('th', text); th.scope = 'col'; head.append(th); });
    weeks.forEach(w => { const th = el('th', `Wk ${w.week}`); th.scope = 'col'; th.title = `Week ${w.week}`; head.append(th); });

    const currentRank = new Map((seasonRows || []).map(r => [String(r.player || ''), +r.rank || 99]));
    const players = new Set();
    weeks.forEach(w => Object.keys(w.records || {}).forEach(p => players.add(p)));
    const ordered = [...players].sort((a, b) =>
      (currentRank.get(a) || 99) - (currentRank.get(b) || 99) || a.localeCompare(b));

    // Highlight each week's best record (shared wins count for all tied).
    const best = weeks.map(w => Math.max(0, ...Object.values(w.records || {}).map(r => +r.correct || 0)));

    body.replaceChildren();
    ordered.forEach(player => {
      const tr = el('tr');
      tr.append(el('td', currentRank.get(player) || '', 'num rank'));
      const th = el('th', player); th.scope = 'row'; tr.append(th);
      weeks.forEach((w, i) => {
        const rec = (w.records || {})[player];
        if (!rec) { tr.append(el('td', '—', 'num')); return; }
        let value = `${+rec.correct || 0}-${+rec.wrong || 0}`;
        if (+rec.push) value += ` (${rec.push}P)`;
        const td = el('td', value, 'num' + ((+rec.correct || 0) === best[i] ? ' is-week-best' : ''));
        if (+rec.push) td.title = `${plural(+rec.push, 'push', 'pushes')}`;
        tr.append(td);
      });
      body.append(tr);
    });
    note.textContent = `Automatically archived through Week ${lastWeek}. Records show correct–wrong; ` +
      'highlighted cells are that week’s best record. (P) = NFL tie pushes, which count as neither correct nor wrong.';
    if (details && !details.dataset.bound) {
      details.dataset.bound = '1';
      if (NFL.pref.get('records-open') === '1') details.open = true;
      details.addEventListener('toggle', () => NFL.pref.set('records-open', details.open ? '1' : '0'));
    }
  }

  NFL.start({
    needs: { feed: true, history: true },
    render(d) {
      renderSeason(d.season);
      renderWeek(d.weekly, d.meta);
      renderCompleted(d.history, d.season);
    },
    renderError() {
      ['season-body', 'weekly-body'].forEach(id => messageRow($(id), 'Live data unavailable. Please try again shortly.', 6));
      messageRow($('completed-weekly-body'), 'Weekly records are temporarily unavailable.', 2);
    }
  });
})();
