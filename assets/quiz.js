/* =====================================================================
   Quiz IPM1 — moteur d'auto-évaluation
   Les questions sont dans assets/questions.json :
     { "t": thème, "q": énoncé, "o": [4 options], "a": [indices corrects], "e": explication }
   Les formules s'écrivent en LaTeX entre \( et \) (doubler les \ dans le JSON).
   ===================================================================== */
(function () {
  'use strict';

  const QUESTIONS_URL = 'assets/questions.json';
  const STORE_SESSION = 'eco-ipm1-session-v1';
  const STORE_STATS = 'eco-ipm1-stats-v1';
  const PTS_OK = 1, PTS_KO = -0.5;

  const THEMES = {
    1:  { name: 'Principes généraux', page: 'cours/ch1-principes.html' },
    2:  { name: 'Propension marginale à consommer', page: 'cours/ch5-consommation-epargne.html' },
    3:  { name: 'Propension moyenne à consommer', page: 'cours/ch5-consommation-epargne.html' },
    4:  { name: 'Flux réels et flux monétaires', page: 'cours/ch2-circuit.html' },
    5:  { name: 'Tableau des ressources et emplois', page: 'cours/ch2-circuit.html' },
    6:  { name: 'PIB nominal, réel et déflateur', page: 'cours/ch3-pib.html' },
    7:  { name: 'Indice des prix (IPC)', page: 'cours/ch4-prix-inflation.html' },
    8:  { name: "Taux d'inflation", page: 'cours/ch4-prix-inflation.html' },
    9:  { name: 'Propension marginale à épargner', page: 'cours/ch5-consommation-epargne.html' },
    10: { name: 'Propension moyenne à épargner', page: 'cours/ch5-consommation-epargne.html' },
    11: { name: 'Fonction de consommation', page: 'cours/ch5-consommation-epargne.html' },
    12: { name: "Fonction d'investissement", page: 'cours/ch6-investissement.html' },
    13: { name: 'Équilibre sans État (2 agents)', page: 'cours/ch7-equilibre-2-agents.html' },
    14: { name: "Multiplicateur d'investissement K_I", page: 'cours/ch7-equilibre-2-agents.html' },
    15: { name: "Rôle de l'État", page: 'cours/ch8-etat.html' },
    16: { name: 'Impôts et taxes', page: 'cours/ch8-etat.html' },
    17: { name: 'Dépenses publiques G', page: 'cours/ch8-etat.html' },
    18: { name: 'Équilibre à 3 agents', page: 'cours/ch9-equilibre-3-agents.html' },
    19: { name: 'Multiplicateur des dépenses publiques K_G', page: 'cours/ch9-equilibre-3-agents.html' },
    20: { name: 'Multiplicateur fiscal K_T', page: 'cours/ch9-equilibre-3-agents.html' }
  };

  let BANK = [];
  let session = null; // { scope, items: [{ qi, order, sel, done, pts }], idx }

  const $ = (id) => document.getElementById(id);
  const sub = (s) => s.replace(/K_([A-Z])/g, 'K<sub>$1</sub>');
  const letter = (k) => String.fromCharCode(65 + k);
  const num = (x, d = 1) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- Stockage local (protégé : peut être indisponible) ---------- */
  function load(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* navigation privée : on continue sans sauvegarde */ }
  }

  /* ---------- Mathématiques : \( ... \) → KaTeX ---------- */
  function tex(s) {
    if (!window.katex) return s;
    return s.replace(/\\\((.+?)\\\)/g, (m, expr) => {
      try { return window.katex.renderToString(expr, { throwOnError: false }); } catch (e) { return m; }
    });
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Construction d'une session ---------- */
  function themeIds() {
    return [...new Set(BANK.map(q => q.t))].sort((a, b) => a - b);
  }

  function weakThemes() {
    const stats = load(STORE_STATS) || {};
    return themeIds().filter(t => {
      const s = stats[t];
      return !s || s.n === 0 || s.ok / s.n < 0.7;
    });
  }

  function buildItems(scope) {
    let idxs = BANK.map((_, i) => i);
    const byTheme = {};
    idxs.forEach(i => (byTheme[BANK[i].t] = byTheme[BANK[i].t] || []).push(i));

    if (scope.startsWith('exam')) {
      const perTheme = scope === 'exam40' ? 2 : 1;
      idxs = [];
      Object.values(byTheme).forEach(arr => idxs.push(...shuffle(arr.slice()).slice(0, perTheme)));
      shuffle(idxs);
    } else if (scope === 'weak') {
      const weak = new Set(weakThemes());
      idxs = shuffle(idxs.filter(i => weak.has(BANK[i].t)));
    } else if (scope.startsWith('t')) {
      const t = parseInt(scope.slice(1), 10);
      idxs = shuffle(idxs.filter(i => BANK[i].t === t));
    } else {
      shuffle(idxs);
    }
    return idxs.map(qi => ({
      qi,
      order: shuffle(BANK[qi].o.map((_, k) => k)),
      sel: [], done: false, pts: 0
    }));
  }

  function startSession(scope) {
    const items = buildItems(scope);
    if (!items.length) {
      session = { scope, items: [], idx: 0 };
      showEmpty();
      return;
    }
    session = { scope, items, idx: 0 };
    persist();
    $('quiz-results').classList.add('d-none');
    $('quiz-card').classList.remove('d-none');
    render();
  }

  function persist() { save(STORE_SESSION, { v: 1, nbank: BANK.length, ...session }); }

  /* ---------- Sélecteur ---------- */
  function buildScopeSelect() {
    const counts = {};
    BANK.forEach(q => (counts[q.t] = (counts[q.t] || 0) + 1));
    const nThemes = themeIds().length;
    let h = `<option value="all">Banque complète (${BANK.length} questions)</option>
      <option value="exam20">Examen blanc court (${nThemes} questions, 1 par thème)</option>
      <option value="exam40">Examen blanc long (${2 * nThemes} questions, 2 par thème)</option>
      <option value="weak">Mes thèmes faibles (réussite &lt; 70 %)</option>
      <optgroup label="Par thème">`;
    themeIds().forEach(t => {
      h += `<option value="t${t}">Thème ${t} : ${THEMES[t] ? THEMES[t].name : ''} (${counts[t]})</option>`;
    });
    $('quiz-scope').innerHTML = h + '</optgroup>';
  }

  /* ---------- Affichage d'une question ---------- */
  function render() {
    const item = session.items[session.idx];
    if (!item) return;
    const q = BANK[item.qi];
    const multi = q.a.length > 1;
    const done = session.items.filter(i => i.done).length;
    const score = session.items.reduce((s, i) => s + i.pts, 0);

    $('q-idx').textContent = session.idx + 1;
    $('q-total').textContent = session.items.length;
    $('q-done').textContent = done;
    $('q-score').textContent = num(score);
    $('q-bar').style.width = (done / session.items.length * 100) + '%';

    const th = THEMES[q.t] || { name: '', page: '#' };
    $('q-theme').innerHTML = `Thème ${q.t} : ${sub(th.name)}`;
    $('q-theme').href = th.page;
    $('q-multi').classList.toggle('d-none', !multi);
    $('q-prompt').innerHTML = tex(q.q);

    const type = multi ? 'checkbox' : 'radio';
    $('q-options').innerHTML = item.order.map((oi, k) => {
      const checked = item.sel.includes(oi);
      const isRight = q.a.includes(oi);
      let cls = '', mark = '';
      if (item.done) {
        if (isRight) { cls = 'correct'; mark = '✓'; }
        else if (checked) { cls = 'wrong'; mark = '✗'; }
        else cls = 'dim';
      } else if (checked) cls = 'selected';
      return `<label class="quiz-opt ${cls}">
          <input type="${type}" name="qopt" value="${oi}" ${checked ? 'checked' : ''} ${item.done ? 'disabled' : ''}>
          <span class="letter">${letter(k)}.</span>
          <span>${tex(q.o[oi])}</span><span class="qmark">${mark}</span>
        </label>`;
    }).join('');

    const fb = $('q-feedback');
    if (item.done) {
      const ok = item.pts > 0;
      const good = item.order.filter(oi => q.a.includes(oi))
        .map(oi => `${letter(item.order.indexOf(oi))}. ${tex(q.o[oi])}`);
      fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'ko');
      fb.innerHTML = `<div class="verdict">${ok ? '✅ Bonne réponse (+1 pt)' : '❌ Réponse incorrecte (−0,5 pt)'}</div>
        <div><strong>Réponse${good.length > 1 ? 's' : ''} attendue${good.length > 1 ? 's' : ''} :</strong> ${good.join(' ; ')}</div>
        ${q.e ? `<div class="explain"><strong>💡 Explication :</strong> ${tex(q.e)}</div>` : ''}
        <div class="explain"><a href="${th.page}">📚 Revoir la fiche du thème ${q.t}</a></div>`;
    } else {
      fb.className = 'quiz-feedback d-none';
      fb.innerHTML = '';
    }

    const last = session.idx === session.items.length - 1;
    $('btn-prev').disabled = session.idx === 0;
    $('btn-validate').classList.toggle('d-none', item.done);
    $('btn-next').classList.toggle('d-none', !item.done || last);
    $('btn-finish').classList.toggle('d-none', !(last && item.done) && done !== session.items.length);
  }

  function onSelect() {
    const item = session.items[session.idx];
    if (item.done) return;
    item.sel = [...document.querySelectorAll('#q-options input:checked')].map(i => parseInt(i.value, 10));
    persist();
    render();
  }

  function validate() {
    const item = session.items[session.idx];
    if (!item.sel.length) {
      const fb = $('q-feedback');
      fb.className = 'quiz-feedback warn';
      fb.textContent = 'Sélectionnez au moins une réponse avant de valider.';
      return;
    }
    const q = BANK[item.qi];
    const exact = q.a.length === item.sel.length && q.a.every(i => item.sel.includes(i));
    item.done = true;
    item.pts = exact ? PTS_OK : PTS_KO;

    const stats = load(STORE_STATS) || {};
    stats[q.t] = stats[q.t] || { n: 0, ok: 0 };
    stats[q.t].n++;
    if (exact) stats[q.t].ok++;
    save(STORE_STATS, stats);

    persist();
    render();
  }

  function move(d) {
    session.idx = Math.max(0, Math.min(session.items.length - 1, session.idx + d));
    persist();
    render();
    $('quiz-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Bilan ---------- */
  function showResults() {
    const items = session.items;
    const done = items.filter(i => i.done);
    const good = done.filter(i => i.pts > 0).length;
    const score = items.reduce((s, i) => s + i.pts, 0);
    const on20 = Math.max(0, score) / items.length * 20;

    const byTheme = {};
    done.forEach(i => {
      const t = BANK[i.qi].t;
      byTheme[t] = byTheme[t] || { ok: 0, n: 0 };
      byTheme[t].n++;
      if (i.pts > 0) byTheme[t].ok++;
    });
    const rows = Object.keys(byTheme).map(Number).sort((a, b) => a - b).map(t => {
      const r = byTheme[t].ok / byTheme[t].n;
      const col = r >= 0.7 ? '#10b981' : r >= 0.4 ? '#f59e0b' : '#f43f5e';
      return `<tr><td><a href="${THEMES[t].page}">Thème ${t}</a> · ${sub(THEMES[t].name)}</td>
        <td>${byTheme[t].ok}/${byTheme[t].n}</td>
        <td><div class="bar"><span style="width:${r * 100}%;background:${col}"></span></div></td>
        <td>${r < 1 ? `<button class="btn btn-sm btn-outline-primary" data-train="${t}">S'entraîner</button>` : '🎉'}</td></tr>`;
    }).join('');

    $('quiz-results').innerHTML = `
      <h3 class="mt-0">📋 Bilan de la session</h3>
      <div class="result-grid">
        <div class="result-tile"><div class="v" style="color:#1e40af">${num(score)}</div><div class="l">Score / ${items.length}</div></div>
        <div class="result-tile"><div class="v">${num(on20, 2)}</div><div class="l">Note / 20</div></div>
        <div class="result-tile"><div class="v" style="color:#047857">${good}</div><div class="l">Bonnes réponses</div></div>
        <div class="result-tile"><div class="v" style="color:#be123c">${done.length - good}</div><div class="l">Erreurs</div></div>
        <div class="result-tile"><div class="v" style="color:#64748b">${items.length - done.length}</div><div class="l">Sans réponse</div></div>
      </div>
      ${rows ? `<table class="theme-table"><thead><tr><th>Thème</th><th>Réussite</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table>` : ''}
      <div class="d-flex flex-wrap gap-2 mt-3">
        <button class="btn btn-primary" data-action="restart">🔁 Recommencer</button>
        <button class="btn btn-dark" data-action="exam">📝 Nouvel examen blanc</button>
        <button class="btn btn-outline-secondary" data-action="review">← Revoir les questions</button>
      </div>`;
    $('quiz-results').classList.remove('d-none');
    $('quiz-card').classList.add('d-none');
    $('quiz-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showEmpty() {
    $('quiz-card').classList.add('d-none');
    $('quiz-results').classList.remove('d-none');
    $('quiz-results').innerHTML = `<p class="mb-0">🎉 Aucun thème faible : vous dépassez 70 % de réussite partout. Choisissez un autre entraînement.</p>`;
  }

  function setScope(scope) {
    $('quiz-scope').value = scope;
    startSession(scope);
  }

  /* ---------- Initialisation ---------- */
  function bind() {
    $('quiz-scope').addEventListener('change', e => startSession(e.target.value));
    $('quiz-reset').addEventListener('click', () => startSession(session ? session.scope : 'all'));
    $('q-options').addEventListener('change', onSelect);
    $('btn-validate').addEventListener('click', validate);
    $('btn-prev').addEventListener('click', () => move(-1));
    $('btn-next').addEventListener('click', () => move(1));
    $('btn-finish').addEventListener('click', showResults);
    $('quiz-results').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.train) setScope('t' + b.dataset.train);
      else if (b.dataset.action === 'restart') startSession(session.scope);
      else if (b.dataset.action === 'exam') setScope('exam20');
      else if (b.dataset.action === 'review') {
        $('quiz-results').classList.add('d-none');
        $('quiz-card').classList.remove('d-none');
      }
    });
  }

  function init() {
    fetch(QUESTIONS_URL)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => {
        BANK = data;
        buildScopeSelect();
        bind();

        const params = new URLSearchParams(location.search);
        const wanted = params.get('theme') ? 't' + parseInt(params.get('theme'), 10)
          : params.get('mode') || null;
        const saved = load(STORE_SESSION);
        const savedOk = saved && saved.v === 1 && saved.nbank === BANK.length && saved.items && saved.items.length;

        if (savedOk && (!wanted || wanted === saved.scope)) {
          session = { scope: saved.scope, items: saved.items, idx: saved.idx || 0 };
          $('quiz-scope').value = session.scope;
          render();
        } else {
          setScope(wanted && $('quiz-scope').querySelector(`option[value="${wanted}"]`) ? wanted : 'all');
        }
      })
      .catch(err => {
        $('q-prompt').textContent = 'Impossible de charger les questions (' + err.message + '). ' +
          'Si vous ouvrez le fichier directement depuis votre disque, utilisez plutôt « quarto preview ».';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
