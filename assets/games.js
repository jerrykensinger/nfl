/* games.js — this week's matchups as cards (default) or the full grid.
 * Picks render only when the feed has published them for that game
 * (everyone has picked it, or its kickoff has passed). */
(() => {
  'use strict';
  const { $, el, abbr, city, plural, fmtKickoff, fmtKickoffLong, gameView, pref } = NFL;

  const openGames = new Set();     // keep expanded pick lists open across refreshes

  /* ---------- consensus ---------- */
  function consensus(g) {
    const A = abbr(g.away), H = abbr(g.home);
    const away = g.picks.filter(p => p.pick && abbr(p.pick) === A).length;
    const home = g.picks.filter(p => p.pick && abbr(p.pick) === H).length;
    const total = away + home;
    if (!total) return null;
    const hi = Math.max(away, home), lo = Math.min(away, home);
    const summary = !lo ? `Unanimous — all ${total} on ${away ? A : H}`
      : away === home ? `Dead even, ${away}–${home}`
      : `League leans ${away > home ? A : H} ${hi}–${lo}`;
    const wrap = el('div', null, 'consensus');
    const label = el('div', null, 'consensus-label');
    label.append(el('span', `${A} ${away}`, 'away'), el('span', summary, 'consensus-summary'), el('span', `${home} ${H}`, 'home'));
    const bar = el('div', null, 'consensus-bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', `League picks: ${away} on ${g.away}, ${home} on ${g.home}`);
    [['away', away], ['home', home]].forEach(([side, n]) => {
      if (!n) return;
      const seg = el('span', null, 'consensus-seg ' + side);
      seg.style.width = `${(n / total) * 100}%`;
      bar.append(seg);
    });
    wrap.append(label, bar);
    return wrap;
  }

  /* ---------- card view ---------- */
  function statusPill(g) {
    if (g.final) return el('span', g.tie ? 'Final · Tie' : 'Final', 'status-pill final');
    if (g.live) return el('span', 'Live', 'status-pill live');
    return el('span', fmtKickoff(g.kickoff_et) || 'Scheduled', 'status-pill scheduled');
  }

  function teamRow(g, side) {
    const name = g[side];
    const score = g[side + '_score'];
    const showScore = g.final || g.live;
    const won = g.final && !g.tie && g.winner === name;
    const lost = g.final && !g.tie && g.winner && g.winner !== name;
    const row = el('div', null, 'team-row' + (won ? ' is-winner' : lost ? ' is-loser' : ''));
    row.append(el('span', abbr(name), 'team-abbr'));
    const nm = el('span', null, 'team-name');
    nm.append(el('span', city(name), 'team-city'));
    if (side === 'home') nm.append(el('span', ' home', 'team-home'));
    row.append(nm);
    row.append(el('span', showScore ? String(score) : '', 'team-score'));
    return row;
  }

  function pickGroups(g) {
    const box = el('div', null, 'pick-groups');
    const sides = [g.away, g.home];
    sides.forEach(team => {
      const who = g.picks.filter(p => p.pick === team);
      const ok = g.final && !g.tie && g.winner === team;
      const bad = g.final && !g.tie && g.winner && g.winner !== team;
      const grp = el('div', null, 'pick-group' + (ok ? ' is-correct' : bad ? ' is-incorrect' : ''));
      const h = el('h3', null, 'pick-group-title');
      h.append(el('span', `${city(team)} `));
      if (ok) h.append(el('span', '✓', 'mark'), el('span', ' correct', 'sr-only'));
      else if (bad) h.append(el('span', '✕', 'mark'), el('span', ' incorrect', 'sr-only'));
      else if (g.tie) h.append(el('span', 'push', 'mark-push'));
      h.append(el('span', ` ${who.length}`, 'pick-group-count'));
      grp.append(h);
      if (who.length) {
        const ul = el('ul', null, 'pick-names');
        who.forEach(p => ul.append(el('li', p.player)));
        grp.append(ul);
      } else grp.append(el('p', 'Nobody', 'pick-nobody'));
      box.append(grp);
    });
    const none = g.picks.filter(p => !p.pick || !sides.includes(p.pick));
    if (none.length) {
      const grp = el('div', null, 'pick-group is-none');
      grp.append(el('h3', `No pick ${none.length}`, 'pick-group-title'));
      const ul = el('ul', null, 'pick-names');
      none.forEach(p => ul.append(el('li', p.player)));
      grp.append(ul);
      box.append(grp);
    }
    return box;
  }

  function gameCard(g) {
    const art = el('article', null, 'game-card' + (g.final ? ' is-final' : g.live ? ' is-live' : ''));
    art.id = `game-${g.game}`;
    const titleId = `game-${g.game}-title`;
    art.setAttribute('aria-labelledby', titleId);
    const head = el('header', null, 'game-card-head');
    head.append(el('span', `Game ${g.game}`, 'game-no'), statusPill(g));
    art.append(head);
    art.append(Object.assign(el('h2', `${g.away} at ${g.home}`, 'sr-only'), { id: titleId }));

    const teams = el('div', null, 'game-teams');
    teams.append(teamRow(g, 'away'), teamRow(g, 'home'));
    art.append(teams);

    if (g.final) {
      art.append(el('p', g.tie ? 'Tie — a push. No pick counts as correct or wrong.'
        : `Winner: ${g.winner}`, 'game-result'));
    }

    if (g.revealed) {
      const c = consensus(g);
      if (c) {
        const block = el('div', null, 'game-picks-block');
        block.append(el('p', 'League picks', 'block-label'), c);
        art.append(block);
      }
      const det = el('details', null, 'game-picks');
      if (openGames.has(String(g.game))) det.open = true;
      det.addEventListener('toggle', () => {
        if (det.open) openGames.add(String(g.game)); else openGames.delete(String(g.game));
      });
      det.append(el('summary', 'See everyone’s picks'), pickGroups(g));
      art.append(det);
    } else {
      const lock = el('div', null, 'game-locked');
      const all = g.nPicked >= g.nPlayers && g.nPlayers > 0;
      lock.append(el('span', all ? 'All picks in' : `${g.nPicked} of ${g.nPlayers} picked`,
        'status-pill ' + (all ? 'complete' : 'togo')));
      lock.append(el('p', '🔒 Picks hidden until everyone picks or kickoff occurs.', 'lock-note'));
      art.append(lock);
    }
    return art;
  }

  function renderCards(d) {
    const box = $('game-cards');
    const views = d.gameRows.map(g => gameView(g, d.players));
    if (!views.length) {
      box.replaceChildren(el('p', 'No games on the schedule yet.', 'empty-note'));
      return;
    }
    box.replaceChildren(...views.map(gameCard));
    box.setAttribute('aria-busy', 'false');
  }

  /* ---------- full grid (secondary, wide screens) ---------- */
  function playerCell(player, pick, result) {
    if (!pick && !result) return el('td', '–', 'pick-cell pick-none');
    const td = el('td', '', 'pick-cell ' + (result === 'correct' ? 'pick-correct' : result === 'incorrect' ? 'pick-incorrect' : 'pick-none'));
    td.title = pick ? `${player} picked ${pick}` : `${player}: no pick`;
    const mark = result === 'correct' ? '✓' : result === 'incorrect' ? '✗' : '';
    td.append(el('span', abbr(pick), 'pick-team'));
    if (mark) td.append(el('span', ' ' + mark, 'pick-mark'));
    return td;
  }

  function renderGrid(d) {
    const body = $('games-body'), head = $('games-head');
    const players = d.players;
    head.replaceChildren();
    ['Game', 'Away', 'Score', 'Home', 'Score', 'Winner / kickoff'].forEach(t => { const th = el('th', t); th.scope = 'col'; head.append(th); });
    players.forEach(p => { const th = el('th', p); th.scope = 'col'; head.append(th); });
    body.replaceChildren();
    d.gameRows.map(g => gameView(g, players)).forEach(g => {
      const tr = el('tr');
      tr.append(el('td', g.game));
      const awayTh = el('th', g.away); awayTh.scope = 'row'; tr.append(awayTh);
      tr.append(el('td', g.final || g.live ? g.away_score : '–'));
      tr.append(el('td', g.home));
      tr.append(el('td', g.final || g.live ? g.home_score : '–'));
      const winTd = el('td');
      if (g.final) winTd.textContent = g.tie ? 'TIE' : (g.winner || 'Final');
      else if (g.live) winTd.append(el('span', 'LIVE', 'status-pill live'));
      else if (g.kickoff_et) {
        winTd.append(el('span', fmtKickoffLong(g.kickoff_et), 'kickoff'), el('br'));
        const all = g.nPicked >= players.length;
        winTd.append(el('span', all ? 'All picks in' : `${g.nPicked} of ${players.length} picked`,
          'status-pill ' + (all ? 'complete' : 'togo')));
      } else winTd.textContent = '–';
      tr.append(winTd);
      players.forEach(p => tr.append(playerCell(p, g[`${p}_pick`], g[`${p}_result`])));
      body.append(tr);
      const c = g.revealed ? consensus(g) : null;
      if (c) {
        tr.classList.add('has-consensus');
        const td = el('td'); td.colSpan = 6 + players.length; td.append(c);
        const row = el('tr', null, 'consensus-row'); row.append(td);
        body.append(row);
      }
    });
  }

  /* ---------- view switch ---------- */
  function setView(view, save) {
    const grid = view === 'grid';
    document.body.dataset.gamesView = grid ? 'grid' : 'cards';
    document.querySelectorAll('.view-switch button').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.view === (grid ? 'grid' : 'cards'))));
    if (save) pref.set('games-view', grid ? 'grid' : 'cards');
  }
  document.querySelectorAll('.view-switch button').forEach(b =>
    b.addEventListener('click', () => setView(b.dataset.view, true)));
  setView(pref.get('games-view') || 'cards', false);

  function renderSub(d) {
    const fin = +d.meta.games_final || 0, total = +d.meta.games_total || 0;
    const revealed = d.gameRows.map(g => gameView(g, d.players)).filter(g => g.revealed).length;
    const sub = $('games-sub');
    if (sub) sub.textContent = total
      ? `Picks revealed for ${revealed} of ${plural(total, 'game')}${fin === total ? ' · week complete' : ''}.`
      : 'The schedule appears once the week is set.';
  }

  let hashHandled = false;
  NFL.start({
    needs: { feed: true },
    render(d) {
      renderSub(d);
      renderCards(d);
      renderGrid(d);
      // Deep link to one game, e.g. /games/#game-3
      if (!hashHandled && /^#game-\d+$/.test(location.hash)) {
        hashHandled = true;
        const t = document.querySelector(location.hash);
        if (t) t.scrollIntoView({ block: 'start' });
      }
    },
    renderError() {
      $('game-cards').replaceChildren(el('p', 'Live game data is unavailable. Retrying automatically.', 'empty-note'));
      NFL.messageRow($('games-body'), 'Live data unavailable. Please try again shortly.', 6);
      const sub = $('games-sub'); if (sub) sub.textContent = '';
    }
  });
})();
