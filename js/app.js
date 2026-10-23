/* Po poryadku: подготовка к ЕГЭ. Весь прогресс хранится в браузере, без регистрации. */
(function () {
  'use strict';

  /* ================= утилиты ================= */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var M = function (h) { return window.MJ ? window.MJ.render(h) : h; };
  var ic = function (n, c) { return '<svg class="ic ' + (c || '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; };
  var plural = function (n, f) {
    var m = n % 100, d = n % 10;
    return n + ' ' + ((m > 10 && m < 20) ? f[2] : d === 1 ? f[0] : (d > 1 && d < 5) ? f[1] : f[2]);
  };
  var fmtNum = function (n) { return String(n).replace('.', ','); };
  var pct = function (a, b) { return b ? Math.round(a / b * 100) : 0; };

  /* ================= даты ================= */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return (typeof window.__TODAY__ === 'string' && window.__TODAY__) || ymd(new Date()); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function dow(s) { return (parseYmd(s).getDay() + 6) % 7; }           // пн = 0
  function weekStart(s) { return addDays(s, -dow(s)); }
  function diffDays(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
  function human(s) {
    var m = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    var d = parseYmd(s); return d.getDate() + ' ' + m[d.getMonth()];
  }

  /* ================= состояние и хранение ================= */
  var KEY = 'marshrut.v1';
  var storageOk = true;
  function fresh() {
    return { v: 1, start: today(), mode: 'base', days: [1, 5], heavy: {}, tasks: {}, lessons: {}, tests: {}, mocks: [], act: {}, trainer: {}, cum: { used: {}, sel: {}, round: {} }, theme: 'auto', ege: { n: 1, cnt: 10, src: 'new' }, hw: {} };
  }
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) { var o = JSON.parse(raw); if (o && o.v === 1) { var f0 = Object.assign(fresh(), o); if (!f0.ege || typeof f0.ege !== 'object') f0.ege = fresh().ege; return f0; } }
    } catch (e) { storageOk = false; }
    return fresh();
  }
  var S = load();
  function applyTheme() {
    var t = S.theme === 'light' || S.theme === 'dark' ? S.theme : 'auto';
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  }
  applyTheme();
  var THEME_NAMES = { auto: 'как в системе', light: 'светлая', dark: 'тёмная' };
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { storageOk = false; }
  }
  function bump(kind) {
    var d = today(); var a = S.act[d] || (S.act[d] = { t: 0, l: 0 });
    a[kind] += 1;
  }

  /* ================= содержание ================= */
  var C = { idx: null, blocks: [], lessons: {}, tests: {}, tasks: {}, order: [], reference: [], mocks: {}, extra: [] };
  var BUNDLE = window.__BUNDLE__ || null;
  function fetchJSON(path) {
    if (BUNDLE && BUNDLE[path]) return Promise.resolve(BUNDLE[path]);
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error(path + ': ' + r.status);
      return r.json();
    });
  }
  function regTasks(list, meta, skipOrder) {
    list.forEach(function (t) {
      C.tasks[t.id] = Object.assign({}, t, meta);
      if (!skipOrder) C.order.push(t.id);
    });
  }
  function loadContent() {
    return fetchJSON('content/index.json').then(function (idx) {
      C.idx = idx; C.blocks = idx.blocks;
      var base = 'content/' + idx.subject + '/';
      var jobs = [];
      C.extra = idx.plusBlocks || [];
      C.extra.forEach(function (b) {
        jobs.push(Promise.all(b.lessonList.map(function (l) { return fetchJSON(base + b.id + '/' + l.id + '.json'); })).then(function (docs) {
          b.lessonList.forEach(function (l, n) {
            var d = docs[n]; d.block = b.id; d.key = b.id + '/' + l.id; d.n = n + 1; C.lessons[d.key] = d;
            regTasks(d.tasks, { kind: 'lesson', block: b.id, key: d.key, plus: true, lid: l.id, where: 'Урок ' + (n + 1) });
            if (d.hard) regTasks(d.hard, { kind: 'hard', hard: true, plus: true, lid: l.id, block: b.id, key: d.key, where: 'Урок ' + (n + 1) + ', усложнённое' }, true);
          });
        }));
      });
      C.blocks.forEach(function (b) {
        if (b.status !== 'ready') return;
        jobs.push(Promise.all(
          (b.check ? [fetchJSON(base + b.id + '/' + b.check)] : []).concat(
            b.lessonList.map(function (l) { return fetchJSON(base + b.id + '/' + l.id + '.json'); }),
            b.test ? [fetchJSON(base + b.id + '/' + b.test)] : []
          )
        ).then(function (docs) {
          var i = 0;
          if (b.check) {
            var ck = docs[i++]; ck.block = b.id; ck.key = b.id + '/check'; ck.kind = 'check';
            C.tests[ck.key] = ck; regTasks(ck.tasks, { kind: 'check', block: b.id, key: ck.key, where: ck.title });
          }
          b.lessonList.forEach(function (l, n) {
            var d = docs[i++]; d.block = b.id; d.key = b.id + '/' + l.id; d.n = n + 1;
            C.lessons[d.key] = d; d.n = n + 1; regTasks(d.tasks, { kind: 'lesson', block: b.id, key: d.key, plus: !!l.plus, lid: l.id, where: 'Урок ' + (n + 1) });
            if (d.hard) regTasks(d.hard, { kind: 'hard', hard: true, plus: !!l.plus, lid: l.id, block: b.id, key: d.key, where: 'Урок ' + (n + 1) + ', усложнённое' }, true);
          });
          if (b.test) {
            var ts = docs[i++]; ts.block = b.id; ts.key = b.id + '/test'; ts.kind = 'test';
            C.tests[ts.key] = ts; regTasks(ts.tasks, { kind: 'test', block: b.id, key: ts.key, where: ts.title });
          }
        }));
      });
      (idx.mocks || []).forEach(function (m) {
        jobs.push(fetchJSON(base + 'mocks/' + m.file).then(function (d) {
          d.key = 'mock/' + d.id; d.kind = 'mock'; C.mocks[d.id] = d;
          regTasks(d.tasks, { kind: 'mock', key: d.key, where: d.title });
        }));
      });
      jobs.push(fetchJSON(base + 'reference.json').then(function (r) { C.reference = r; }));
      return Promise.all(jobs);
    });
  }
  function taskHref(t) {
    return t.kind === 'lesson' || t.kind === 'hard' ? '#lesson/' + t.key : t.kind === 'mock' ? '#' + t.key : '#test/' + t.key;
  }
  function bl(b) { return b.lessonList.filter(function (l) { return !l.plus; }); }
  function pl(b) { return b.lessonList.filter(function (l) { return l.plus; }); }
  function blockById(id) { return C.blocks.concat(C.extra).filter(function (b) { return b.id === id; })[0]; }
  function lessonTotal() {
    return C.blocks.reduce(function (s, b) { return s + b.lessons[S.mode]; }, 0) + (S.mode === 'plus' ? C.extra.reduce(function (s, b) { return s + b.lessonList.length; }, 0) : 0);
  }
  function lessonsDone() {
    var n = 0;
    C.blocks.forEach(function (b) {
      if (b.status !== 'ready') return;
      var t = S.tests[b.id + '/test'];
      var vis = S.mode === 'plus' ? b.lessonList : bl(b);
      var dn = vis.filter(function (l) { return S.lessons[b.id + '/' + l.id]; }).length;
      var dp = vis.filter(function (l) { return l.plus && S.lessons[b.id + '/' + l.id]; }).length;
      if (t && t.pass) n += bl(b).length + dp;
      else n += dn;
    });
    if (S.mode === 'plus') C.extra.forEach(function (b) { n += b.lessonList.filter(function (l) { return S.lessons[b.id + '/' + l.id]; }).length; });
    return n;
  }

  /* ================= статус задач, повторение ================= */
  var INT = [1, 3, 7, 21];
  var PILL = { new: ['todo', 'Не решено'], ok: ['checked', 'Верно'], ok2: ['sent', 'Решено со второй попытки'], wrong: ['late', 'Ошибка'], seen: ['sent', 'Смотрел решение'] };
  function taskStatus(id) {
    var r = S.tasks[id];
    if (!r) return 'new';
    if (r.ok) return r.first ? 'ok' : 'ok2';
    if (r.seen) return 'seen';
    if (r.n) return 'wrong';
    return 'new';
  }
  function rec(id) { return S.tasks[id] || (S.tasks[id] = { n: 0, ok: false, first: null, seen: false }); }
  function scheduleReview(r) { if (!r.rv) r.rv = { st: 0, due: addDays(today(), 1) }; }
  function dueIds() {
    var t = today();
    return Object.keys(S.tasks).filter(function (id) { return C.tasks[id] && S.tasks[id].rv && S.tasks[id].rv.due <= t; })
      .sort(function (a, b) { return S.tasks[a].rv.due < S.tasks[b].rv.due ? -1 : 1; });
  }
  function errIds() {
    return Object.keys(S.tasks).filter(function (id) { return C.tasks[id] && S.tasks[id].rv; });
  }
  function advance(r) {
    var st = (r.rv ? r.rv.st : 0) + 1;
    if (st >= INT.length) { r.rv = null; r.mastered = today(); }
    else r.rv = { st: st, due: addDays(today(), INT[st]) };
  }

  /* разбор ответа */
  function parseAnswer(raw) {
    var s = String(raw == null ? '' : raw).trim().replace(/\s+/g, '').replace(/[−–—]/g, '-');
    if (!s) return { err: 'Введите ответ.' };
    if (s.indexOf('/') >= 0) return { err: 'Запишите ответ десятичной дробью, как на экзамене.' };
    s = s.replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return { err: 'Ответ — число, например 12 или 0,25.' };
    return { n: parseFloat(s) };
  }
  function isRight(t, n) { return Math.abs(n - t.a) <= 1e-9 * Math.max(1, Math.abs(t.a)); }

  /* Ответ-промежутки (часть 2): разбор и сравнение по значению, а не по тексту. */
  var SET_HELP = 'Запиши промежутками, например (-∞; 2] ∪ [5; +∞). Одна точка: {3}, пустое множество: ∅.';
  function numVal(s) {
    var m = /^([+-]?)(?:(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?)?(?:√(\d+(?:\.\d+)?))?$/.exec(s);
    if (!m || (m[2] === undefined && m[4] === undefined)) return NaN;
    if (m[4] !== undefined && m[3] !== undefined) return NaN;
    var v = m[2] !== undefined ? parseFloat(m[2]) : 1;
    if (m[3] !== undefined) { var dd = parseFloat(m[3]); if (!dd) return NaN; v = v / dd; }
    if (m[4] !== undefined) v = v * Math.sqrt(parseFloat(m[4]));
    return m[1] === '-' ? -v : v;
  }
  function parseSet(raw) {
    var s = String(raw == null ? '' : raw).trim().toLowerCase().replace(/\s+/g, '').replace(/[−–—]/g, '-');
    if (!s) return { err: 'Введите ответ.' };
    s = s.replace(/^(ответ:?)/, '').replace(/^x?[∈єэ∊]/, '');
    if (s === '∅' || s === '{}' || s === 'нетрешений' || s === 'решенийнет' || s === 'пусто') return { set: [] };
    s = s.replace(/бесконечность|infinity|inf|oo/g, '∞').replace(/sqrt\(?(\d+(?:[.,]\d+)?)\)?/g, '√$1').replace(/или|[u∪]/g, '∪');
    s = s.replace(/(\d),(\d)/g, '$1.$2');
    var parts = s.split('∪'), out = [], i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i], m;
      if ((m = /^\{(.+)\}$/.exec(p))) {
        var pts = m[1].split(';');
        for (var k = 0; k < pts.length; k++) {
          var x = numVal(pts[k]);
          if (isNaN(x)) return { err: SET_HELP };
          out.push({ lo: x, hi: x, lc: true, hc: true });
        }
        continue;
      }
      m = /^([(\[\]])([^;]+);([^;]+)([)\[\]])$/.exec(p);
      if (!m) return { err: SET_HELP };
      var lo, hi, a = m[2], b = m[3], lc = m[1] === '[', hc = m[4] === ']';
      lo = (a === '-∞') ? -Infinity : numVal(a);
      hi = (b === '∞' || b === '+∞') ? Infinity : numVal(b);
      if (a === '∞' || a === '+∞' || b === '-∞' || isNaN(lo) || isNaN(hi)) return { err: SET_HELP };
      if ((lo === -Infinity && lc) || (hi === Infinity && hc)) return { err: 'Бесконечность всегда пишут с круглой скобкой.' };
      if (lo > hi) return { err: 'Левый конец промежутка больше правого.' };
      if (lo === hi && !(lc && hc)) return { err: 'Промежуток из одной точки пишут так: {3}.' };
      out.push({ lo: lo, hi: hi, lc: lc, hc: hc });
    }
    return { set: normSet(out) };
  }
  function eqN(a, b) { if (a === b) return true; if (!isFinite(a) || !isFinite(b)) return false; return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)); }
  function normSet(L) {
    L = L.slice().sort(function (x, y) { return x.lo - y.lo || (y.lc ? 1 : 0) - (x.lc ? 1 : 0); });
    var r = [];
    L.forEach(function (c) {
      var last = r[r.length - 1];
      if (last && (c.lo < last.hi || (eqN(c.lo, last.hi) && (c.lc || last.hc)))) {
        if (c.hi > last.hi || (eqN(c.hi, last.hi) && c.hc)) { last.hi = c.hi; last.hc = c.hc; }
      } else r.push({ lo: c.lo, hi: c.hi, lc: c.lc, hc: c.hc });
    });
    return r;
  }
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (!eqN(a[i].lo, b[i].lo) || !eqN(a[i].hi, b[i].hi) || a[i].lc !== b[i].lc || a[i].hc !== b[i].hc) return false;
    return true;
  }
  var SETC = {};
  function judge(t, raw) {
    if (t.ans === 'set') {
      var p = parseSet(raw);
      if (p.err) return p;
      var w = SETC[t.a] || (SETC[t.a] = parseSet(t.a).set);
      return { ok: sameSet(p.set, w) };
    }
    var pv = parseAnswer(raw);
    return pv.err ? pv : { ok: isRight(t, pv.n) };
  }
  var SET_KEYS = ['(', ')', '[', ']', ';', '∞', '∪', '∅', '-', '/', '√', '{', '}', '⌫'];
  function setPanel(t) {
    if (t.ans !== 'set') return '';
    return '<div class="kbd" data-for="in-' + t.id + '" role="group" aria-label="Знаки для ответа">' +
      SET_KEYS.map(function (k) { return '<button type="button" data-ins="' + k + '" aria-label="' + (k === '⌫' ? 'Стереть' : k === '∪' ? 'Объединение' : k === '∞' ? 'Бесконечность' : k === '∅' ? 'Пустое множество' : k) + '">' + k + '</button>'; }).join('') + '</div>';
  }

  /* обратная связь и переключатели внутри экрана (не сохраняются) */
  var FB = {}, UI = { hint: {}, sol: {} }, REV = null, TR = null, RUN = null, DR = null;
  var DRAFT = {};      // что ученик уже напечатал в полях ответа: не теряется при обновлении экрана

  /* попытка в практике */
  function attemptPractice(t, ok) {
    var r = rec(t.id);
    r.n += 1; r.last = today();
    if (r.n === 1 && !r.seen) r.first = ok; else if (r.first === null) r.first = false;
    if (ok && !r.ok) { r.ok = true; bump('t'); }
    if (!t.hard && (r.first === false || r.seen)) scheduleReview(r);
    save();
    return r;
  }

  /* ================= показатели ================= */
  function weekTarget() { return S.heavy[weekStart(today())] ? 1 : (S.mode === 'plus' ? 3 : 2); }
  function weekStats() {
    var ws = weekStart(today()), l = 0, t = 0;
    for (var i = 0; i < 7; i++) { var a = S.act[addDays(ws, i)]; if (a) { l += a.l; t += a.t; } }
    return { l: l, t: t };
  }
  function weekNo() { var d = diffDays(S.start, today()); return d < 0 ? 0 : Math.floor(d / 7) + 1; }
  function totalWeeks() { return C.idx.weeks[S.mode]; }
  function streak() {
    var n = 0, d = today();
    for (var i = 0; i < 400; i++) {
      var x = addDays(d, -i);
      if (dow(x) === 6) continue;                       // воскресенье не считается и не прерывает
      var a = S.act[x];
      if (a && (a.t || a.l)) n++; else if (i === 0) continue; else break;
    }
    return n;
  }
  function accuracy(filter) {
    var att = 0, first = 0;
    Object.keys(S.tasks).forEach(function (id) {
      var r = S.tasks[id], t = C.tasks[id];
      if (!t || t.hard || !r.n || (filter && !filter(t))) return;
      att++; if (r.first) first++;
    });
    return { att: att, first: first, p: att ? pct(first, att) : null };
  }
  function blockState(b) {
    if (b.status !== 'ready') return 'later';
    var t = S.tests[b.id + '/test'];
    if (t && t.pass) return 'done';
    var any = bl(b).some(function (l) { return S.lessons[b.id + '/' + l.id]; }) || S.tests[b.id + '/check'] || t;
    return any ? 'now' : 'next';
  }
  function nextStep() {
    var rb = C.blocks.filter(function (b) { return b.status === 'ready'; });
    for (var i = 0; i < rb.length; i++) {
      var b = rb[i], test = S.tests[b.id + '/test'];
      if (test && test.pass) continue;
      var any = bl(b).some(function (l) { return S.lessons[b.id + '/' + l.id]; });
      var chk = S.tests[b.id + '/check'];
      if (!chk && !any && !test) return { kind: 'check', b: b };
      if (chk && chk.s >= C.tests[b.id + '/check'].skipScore && !any && !test) return { kind: 'test', b: b, skipped: true };
      var nl = bl(b).filter(function (l) { return !S.lessons[b.id + '/' + l.id]; })[0];
      if (nl) return { kind: 'lesson', b: b, l: nl, idx: bl(b).indexOf(nl) };
      return { kind: 'test', b: b };
    }
    return { kind: 'wait' };
  }

  /* таймер прохождения: сколько прошло и сколько осталось по рекомендуемому времени */
  var RTI = null;
  function fmtClock(sec) { sec = Math.max(0, Math.floor(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60, z = function (n) { return (n < 10 ? '0' : '') + n; }; return (h ? h + ':' : '') + z(m) + ':' + z(x); }
  function runTimerHtml(minutes) {
    return '<div class="runtimer" id="runtimer" data-rec="' + (minutes * 60) + '" role="timer" aria-label="Время прохождения"><span class="rt-a"><small>Прошло</small><b id="rt-el" class="num">00:00</b></span><span class="rt-b"><small id="rt-lbl">Рекомендуемое время</small><b id="rt-left" class="num">' + fmtClock(minutes * 60) + '</b></span></div>';
  }
  function armRunTimer() {
    clearInterval(RTI); RTI = null;
    var box = document.getElementById('runtimer'); if (!box || !RUN || !RUN.t0) return;
    var rec = +box.dataset.rec;
    var hd = document.querySelector('.top'); if (hd) document.documentElement.style.setProperty('--top-h', hd.offsetHeight + 'px');
    var tick = function () {
      var el = document.getElementById('rt-el'), lf = document.getElementById('rt-left');
      if (!el || !lf || !RUN) { clearInterval(RTI); RTI = null; return; }
      var used = (Date.now() - RUN.t0) / 1000, left = rec - used;
      el.textContent = fmtClock(used);
      lf.textContent = (left < 0 ? '+' : '') + fmtClock(Math.abs(left));
      box.classList.toggle('over', left < 0);
      document.getElementById('rt-lbl').textContent = left < 0 ? 'Сверх рекомендуемого' : 'Рекомендуемое время';
    };
    tick(); RTI = setInterval(tick, 1000);
  }
  function lastMock(id) {
    var l = S.mocks.filter(function (m) { return m.key === id; });
    return l.length ? l[l.length - 1] : null;
  }
  /* баллы пробника: задания 1–13 по 1 баллу, №14–20 по таблице egePoints; всего 13 + 20 = 33 */
  function taskPts(t) { return ((C.idx && C.idx.egePoints) || {})[t.ege] || 1; }
  function mockCalc(T, ans) {
    var r = { pts: 0, max: 0, n: 0, nmax: T.tasks.length, p1: 0, p1max: 0, p2: 0, p2max: 0 };
    T.tasks.forEach(function (t) {
      var w = taskPts(t), v = ans && ans[t.id] !== undefined ? ans[t.id] : '', ok = judge(t, v).ok === true, two = t.ege > 13;
      r.max += w; if (two) r.p2max += w; else r.p1max += w;
      if (ok) { r.pts += w; r.n++; if (two) r.p2 += w; else r.p1 += w; }
    });
    return r;
  }
  function mockRes(m) {
    var T = C.mocks[m.key] || ensureMock(m.key);
    if (T && m.ans) return mockCalc(T, m.ans);
    return { pts: m.s, max: m.max, n: m.s, nmax: m.max, p1: m.s, p1max: m.max, p2: 0, p2max: 0 };
  }
  /* ориентировочный перевод во вторичные (тестовые) баллы: шкала прошлого года, 32 первичных, пересчёт пропорционально 33 */
  function testScore(r) {
    var sc = C.idx && C.idx.egeScale; if (!sc || !r.max) return null;
    var tot = 13, k; for (k in ((C.idx && C.idx.egePoints) || {})) tot += C.idx.egePoints[k];
    return sc[Math.min(sc.length - 1, Math.round(r.pts * (sc.length - 1) / tot))];
  }
  function ptsLabel(r) { var t = testScore(r); return r.pts + ' из ' + plural(r.max, ['балла', 'баллов', 'баллов']) + (t === null ? '' : ' (≈ ' + t + ' из 100)'); }



  /* ================= доверие: проверка, сообщения об ошибках ================= */
  function reviewChip(b) {
    if (b.reviewed) return '<span class="chip good" title="' + esc(b.reviewed.by || '') + '">Проверено преподавателем' + (b.reviewed.date ? ', ' + esc(b.reviewed.date) : '') + '</span>';
    return '<span class="chip warn" title="Тексты и задачи ещё не просмотрены преподавателем">Ожидает проверки преподавателем</span>';
  }
  function copyText(text, msg) {
    var ok = function () { toast(msg || 'Скопировано'); };
    var fallback = function () {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('Не удалось скопировать'); }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  }
  function reportError(tid) {
    var t = C.tasks[tid]; if (!t) return;
    var mine = DRAFT[tid] !== undefined ? DRAFT[tid] : (FB[tid] && FB[tid].v ? FB[tid].v : '');
    var text = 'Ошибка в задаче ' + tid + ' (блок ' + blockById(t.block).n + ', ' + t.where + ')\n' + 'Условие: ' + t.q + '\n' + 'Ответ на сайте: ' + fmtNum(t.a) + '\n' + 'Мой ответ: ' + (mine || '—') + '\n' + 'Что не так: ';
    var fbk = (C.idx && C.idx.feedback) || {};
    if (fbk.mail) { location.href = 'mailto:' + fbk.mail + '?subject=' + encodeURIComponent('Ошибка в задаче ' + tid) + '&body=' + encodeURIComponent(text); return; }
    if (fbk.url) { copyText(text); window.open(fbk.url, '_blank', 'noopener'); return; }
    copyText(text, 'Текст сообщения скопирован. Куда его отправить, написано на странице «О проекте».');
  }

  /* ================= накопительная работа ================= */
  /* После каждого блока (со второго): новые задачи блока и задачи из всех прошлых блоков.
     Слабые задачи (ошибки, подсказки, пропущенные уроки) берутся первыми, уже встречавшиеся в накопительных, позже. */
  function cumState() {
    if (!S.cum || typeof S.cum !== 'object') S.cum = {};
    ['used', 'sel', 'round'].forEach(function (k) { if (!S.cum[k] || typeof S.cum[k] !== 'object') S.cum[k] = {}; });
    return S.cum;
  }
  function hashStr(x) { var h = 7; for (var i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) | 0; return Math.abs(h); }
  function cumPool(bid) {
    return C.order.filter(function (id) { var t = C.tasks[id]; return t.block === bid && !t.hard && !t.plus && t.kind !== 'mock'; });
  }
  function cumWeight(id, round) {
    var r = S.tasks[id], w = 0, used = cumState().used[id] || 0;
    if (r && (r.rv || r.seen || r.first === false)) w -= 100;
    else if (!r || !r.n) w -= 40;
    w += 60 * used;
    return w * 1000 + hashStr(id + ':' + round) % 1000;
  }
  function cumPick(b) {
    var cs = cumState(), round = cs.round[b.id] || 0;
    var ready = C.blocks.filter(function (x) { return x.status === 'ready' && x.n <= b.n; });
    var prev = ready.filter(function (x) { return x.n < b.n; });
    var need = {}; need[b.id] = 4;
    prev.forEach(function (x) { need[x.id] = 1; });
    var weak = prev.slice().sort(function (x, y) {
      var ax = accuracy(function (t) { return t.block === x.id; }).p, ay = accuracy(function (t) { return t.block === y.id; }).p;
      return (ax === null ? 100 : ax) - (ay === null ? 100 : ay) || x.n - y.n;
    });
    for (var i = 0; i < 2 && weak.length; i++) need[weak[i % weak.length].id] += 1;
    var ids = [];
    ready.forEach(function (x) {
      var pool = cumPool(x.id).sort(function (u, v) { return cumWeight(u, round) - cumWeight(v, round); });
      ids = ids.concat(pool.slice(0, need[x.id]));
    });
    return ids.sort(function (u, v) { return hashStr(u + 's' + round) - hashStr(v + 's' + round); });
  }
  /* Проверка с ключом bNN/cum собирается на лету; выбор запоминается на время попытки и в результате. */
  function getTest(key) {
    if (C.tests[key]) return C.tests[key];
    var m = /^(b\d+)\/cum$/.exec(key), b = m && blockById(m[1]);
    if (!b || b.status !== 'ready' || b.n < 2) return null;
    var cs = cumState(), res = S.tests[key];
    var ids = (RUN && RUN.key === key && cs.sel[b.id]) || (res && res.ids) || cumPick(b);
    ids = ids.filter(function (id) { return C.tasks[id]; });
    return { id: 'cum', key: key, kind: 'cum', block: b.id, title: 'Накопительная работа после блока ' + b.n, minutes: Math.round(ids.length * 3 / 5) * 5 || 5,
      intro: 'Задачи нового блока и по задаче из каждого прошлого блока. Слабые места подбираются первыми, поэтому работа у каждого своя. Подсказок и решений до конца нет, ошибки сами попадут в повторение.',
      tasks: ids.map(function (id) { return C.tasks[id]; }) };
  }
  function pendingCum() {
    var res = null;
    C.blocks.forEach(function (b) {
      var t = S.tests[b.id + '/test'];
      if (b.status === 'ready' && b.n >= 2 && t && t.pass && !S.tests[b.id + '/cum']) res = b;
    });
    return res;
  }

  /* ================= компоненты ================= */
  function taskCard(t, o) {
    o = o || {};
    var ctx = o.ctx || 'practice', st = taskStatus(t.id), fb = FB[t.id];
    var h = '<article class="task" id="task-' + t.id + '" data-tid="' + t.id + '" data-ctx="' + ctx + '" data-n="' + (o.n || '') + '">';
    h += '<div class="task-h"><span class="task-n">' + (o.n || 'Задача') + '</span>';
    if (t.top) h += '<span class="chip">★ усложнённая</span>';
    if (ctx === 'practice') h += '<span class="pill ' + PILL[st][0] + '">' + PILL[st][1] + '</span>';
    h += '</div><div class="task-q">' + M(t.q) + '</div>' + (t.fig || '');
    var revDone = ctx === 'review' && REV && REV.res[t.id] !== undefined;
    if (ctx === 'test') {
      h += '<div class="ans"><label class="sr" for="in-' + t.id + '">Ответ</label>' +
        '<input id="in-' + t.id + '" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (t.ans === 'set' ? '(-∞; 2] ∪ [5; +∞)' : 'Ответ') + '" value="' + esc(DRAFT[t.id] !== undefined ? DRAFT[t.id] : (o.value || '')) + '"></div>' + setPanel(t);
    } else if (!revDone) {
      h += '<form class="ans" autocomplete="off"><label class="sr" for="in-' + t.id + '">Ответ</label>' +
        '<input id="in-' + t.id + '" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + (t.ans === 'set' ? '(-∞; 2] ∪ [5; +∞)' : 'Ответ') + '" value="' + esc(DRAFT[t.id] !== undefined ? DRAFT[t.id] : (fb && fb.v ? fb.v : '')) + '">' +
        '<button class="btn primary" type="submit">Проверить</button></form>' + setPanel(t);
    }
    if (fb && fb.m) h += '<p class="fb ' + fb.k + '" role="status">' + esc(fb.m) + '</p>';
    if (ctx !== 'test') {
      var acts = '';
      if (t.hint && !revDone && !UI.hint[t.id]) acts += '<button type="button" class="btn ghost sm" data-hint>Подсказка</button>';
      if (!revDone && !UI.sol[t.id]) acts += '<button type="button" class="btn ghost sm" data-sol>' + (ctx === 'review' ? 'Не помню, показать решение' : 'Решение') + '</button>';
      if (acts) h += '<div class="task-act">' + acts + '</div>';
      if (UI.hint[t.id] && t.hint) h += '<div class="hint"><b>Подсказка.</b> ' + M(t.hint) + '</div>';
      if (UI.sol[t.id] || revDone) h += solutionHtml(t);
      h += '<div class="task-foot"><button type="button" class="linkbtn" data-report="' + t.id + '">Сообщить об ошибке</button></div>';
    }
    return h + '</article>';
  }
  function solutionHtml(t) {
    return '<div class="sol"><ol class="steps">' + t.sol.map(function (x) { return '<li>' + M(x) + '</li>'; }).join('') +
      '</ol>' + (t.solfig || '') + '<p class="final">Ответ: ' + fmtNum(t.a) + '</p></div>';
  }
  /* Длинную формулу, которая не помещается в карточку, можно прокручивать по горизонтали, страница не уезжает. */
  function fitMath(root) {
    $$('math', root || document).forEach(function (m) {
      if (m.closest('.mscroll')) return;
      var box = m.closest('.task, .card, .ex, .sol, .hint, details.hard');
      if (!box) return;
      var lim = box.getBoundingClientRect().right - 14;
      var right = m.getBoundingClientRect().right;
      try { var rg = document.createRange(); rg.selectNodeContents(m); right = Math.max(right, rg.getBoundingClientRect().right); } catch (e) { /* без диапазона остаётся правый край самой формулы */ }
      if (right <= lim) return;
      var w = document.createElement('span');
      w.className = 'mscroll';
      m.parentNode.insertBefore(w, m);
      w.appendChild(m);
    });
  }
  function refreshCard(tid) {
    var el = document.getElementById('task-' + tid);
    if (!el) return;
    var t = C.tasks[tid], n = el.dataset.n || '';
    var tmp = document.createElement('div');
    tmp.innerHTML = taskCard(t, { ctx: el.dataset.ctx, n: n });
    var nc = tmp.firstChild;
    el.replaceWith(nc);
    fitMath(nc);
  }
  function crumbs(parts) {
    return '<nav class="crumb" aria-label="Путь">' + parts.map(function (p, i) {
      var last = i === parts.length - 1;
      return (p.href && !last ? '<a href="' + p.href + '">' + p.t + '</a>' : '<span>' + p.t + '</span>') + (last ? '' : '<span aria-hidden="true">›</span>');
    }).join('') + '</nav>';
  }
  function pill(k, t) { return '<span class="pill ' + k + '">' + t + '</span>'; }
  var toastT;
  function toast(msg) {
    var el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function note() {
    return storageOk ? '' : '<p class="notice">Браузер не разрешает сохранять данные на этом сайте. Прогресс не сохранится после закрытия страницы: перед уходом скопируй код на экране «Прогресс».</p>';
  }

  /* ================= экраны ================= */
  var VIEWS = {};

  /* ---- Сегодня ---- */
  VIEWS.today = function () {
    var wn = weekNo(), tw = totalWeeks(), st = nextStep(), wk = weekStats(), tgt = weekTarget();
    var greet;
    if (wn === 0) greet = 'Старт по плану ' + human(S.start) + ' (через ' + plural(diffDays(today(), S.start), ['день', 'дня', 'дней']) + ').';
    else if (wn > tw) greet = 'Плановое время изучения прошло. Повторяй слабые блоки и решай пробники.';
    else greet = 'Неделя ' + wn + ' из ' + tw + '. По плану до экзамена около ' + plural(tw - wn, ['недели', 'недель', 'недель']).replace(/^(\d+) \S+$/, function (m, n) { return n + ' нед.'; }) + '';
    var due = dueIds().length;

    var hero = '<article class="hero"><svg class="hero-route" viewBox="0 0 300 150" aria-hidden="true">' +
      '<path d="M6 140C70 140 70 90 130 90S200 40 292 20" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round" opacity=".7"/>' +
      '<circle cx="130" cy="90" r="7" fill="#F0A92E" stroke="none"/><circle cx="292" cy="20" r="5" fill="none" stroke-width="2.5" opacity=".7"/>' +
      '<circle cx="6" cy="140" r="4" fill="currentColor" stroke="none" opacity=".7"/></svg><p class="kicker">Следующий шаг</p>';
    var planItems = [];
    var due_t = due ? plural(due, ['карточка', 'карточки', 'карточек']) : '';
    planItems.push({ t: due ? 'Повторение: ' + due_t + ' из прошлых ошибок' : 'Повторение: на сегодня карточек нет', done: due === 0, href: due ? '#review/due' : null, m: due ? Math.max(3, Math.round(due * 1.5)) + ' мин' : '' });
    hwPending().slice(0, 2).forEach(function (k) { var sx = hwStat(k), Lx = C.lessons[k]; planItems.push({ t: 'Домашнее задание: урок ' + Lx.n + ' (решено ' + sx.ok + ' из ' + sx.total + ')', done: false, href: '#lesson/' + k + '/hw', m: '20 мин' }); });
    var pc = pendingCum();
    if (pc) planItems.push({ t: 'Накопительная работа после блока ' + pc.n, done: false, href: '#test/' + pc.id + '/cum', m: getTest(pc.id + '/cum').minutes + ' мин' });
    if (st.kind === 'check') {
      hero += '<h2>Стартовая проверка блока ' + st.b.n + '<br>' + esc(st.b.title) + '</h2><p>Шесть задач, около 15 минут</p>' +
        '<div class="hero-steps"><span>Покажет, какие уроки можно пропустить</span></div>' +
        '<div class="hero-act"><a class="btn amber" href="#test/' + st.b.id + '/check">Начать проверку</a><a class="btn ghost" href="#lesson/' + st.b.id + '/' + bl(st.b)[0].id + '">Сразу к уроку 1</a></div>';
      planItems.push({ t: 'Стартовая проверка блока ' + st.b.n, done: false, href: '#test/' + st.b.id + '/check', m: '15 мин' });
    } else if (st.kind === 'lesson') {
      var key = st.b.id + '/' + st.l.id, L = C.lessons[key];
      var solved = L.tasks.filter(function (t) { return S.tasks[t.id] && S.tasks[t.id].ok; }).length;
      hero += '<h2>Блок ' + st.b.n + '. ' + esc(st.b.title) + '<br>Урок ' + (st.idx + 1) + '. ' + esc(st.l.title) + '</h2>' +
        '<p>Урок ' + (st.idx + 1) + ' из ' + bl(st.b).length + ', около ' + st.l.minutes + ' минут</p>' +
        '<div class="hero-steps"><span>Повторение 15 мин</span><span>Теория 30 мин</span><span>Практика 35 мин</span><span>Проверка 10 мин</span></div>' +
        '<div class="hero-act"><a class="btn amber" href="#lesson/' + key + '">' + (solved ? 'Продолжить урок' : 'Начать урок') + '</a>' +
        '<a class="btn ghost" href="#route/' + st.b.id + '">Весь блок</a></div>';
      planItems.push({ t: 'Урок ' + (st.idx + 1) + ': теория и разбор примеров', done: !!S.lessons[key], href: '#lesson/' + key, m: '60 мин' });
      planItems.push({ t: 'Практика: ' + L.tasks.length + ' задач (решено ' + solved + ')', done: solved === L.tasks.length, href: '#lesson/' + key, m: '35 мин' });
    } else if (st.kind === 'test') {
      var T = C.tests[st.b.id + '/test'];
      hero += '<h2>Контрольная блока ' + st.b.n + '<br>' + esc(st.b.title) + '</h2><p>' + plural(T.tasks.length, ['задача', 'задачи', 'задач']) + ', порог ' + T.passPct + '%</p>' +
        '<div class="hero-steps"><span>' + (st.skipped ? 'Проверка показала, что уроки можно пропустить' : 'Уроки блока пройдены') + '</span></div>' +
        '<div class="hero-act"><a class="btn amber" href="#test/' + st.b.id + '/test">Начать контрольную</a></div>';
      planItems.push({ t: 'Контрольная блока ' + st.b.n, done: false, href: '#test/' + st.b.id + '/test', m: '40 мин' });
    } else {
      var soon = C.blocks.filter(function (b) { return b.status !== 'ready'; })[0];
      hero += '<h2>Готовый блок пройден</h2><p>Следующий по плану: блок ' + soon.n + ', «' + esc(soon.title) + '». Его содержание ещё готовится.</p>' +
        '<div class="hero-steps"><span>Пока повторяй ошибки и тренируй счёт</span></div>' +
        '<div class="hero-act"><a class="btn amber" href="#train">Тренажёры</a><a class="btn ghost" href="#route">Маршрут</a></div>';
    }
    hero += '</article>';

    var plan = '<section class="card"><h3>План на сегодня</h3><ul class="checks">' + planItems.map(function (p) {
      var inner = '<span class="dot-s" aria-hidden="true">' + (p.done ? ic('check', 's') : '') + '</span><span class="t' + (p.done ? ' doneT' : '') + '">' + esc(p.t) + '</span><span class="m">' + (p.done ? 'готово' : p.m) + '</span>';
      return '<li>' + (p.href ? '<a class="plan-row" href="' + p.href + '">' + inner + '</a>' : '<div class="plan-row">' + inner + '</div>') + '</li>';
    }).join('') + '</ul><p class="foot">Сделано ' + planItems.filter(function (p) { return p.done; }).length + ' из ' + planItems.length + '.</p></section>';

    var bar = function (v, max) { return '<div class="bar"><i style="width:' + Math.min(100, pct(v, max)) + '%"></i></div>'; };
    var week = '<section class="card"><h3>Эта неделя</h3><div class="meter">' +
      '<div class="r"><div class="l"><span>Уроки</span><b class="num">' + wk.l + ' из ' + tgt + '</b></div>' + bar(wk.l, tgt) + '</div>' +
      '<div class="r"><div class="l"><span>Задач решено</span><b class="num">' + wk.t + '</b></div>' + bar(wk.t, tgt * 6) + '</div></div>' +
      '<label class="switch"><input type="checkbox" data-heavy' + (S.heavy[weekStart(today())] ? ' checked' : '') + '><span>Тяжёлая неделя: контрольные по другим предметам</span></label>' +
      (S.heavy[weekStart(today())] ? '<p class="msg warn">На этой неделе достаточно одного урока и пяти старых задач. Пропущенное не накапливается, а сдвигает маршрут на неделю.</p>' : '') + '</section>';

    var sk = streak(), sol = accuracy();
    var dots = '', ws = weekStart(today());
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(function (n, i) {
      var d = addDays(ws, i), a = S.act[d], on = a && (a.t || a.l), cls = on ? '' : (d === today() ? 'today' : (i === 6 ? 'rest' : 'rest'));
      dots += '<div><i class="' + cls + '">' + (on ? ic('check') : '') + '</i>' + n + '</div>';
    });
    var streakCard = '<section class="card"><h3>Серия занятий</h3><div class="streak"><div><div class="big num">' + sk + '</div><span class="note">' + (sk === 1 ? 'день подряд' : 'дней подряд') + '</span></div>' +
      '<div><div class="big num">' + Object.keys(S.tasks).filter(function (id) { return S.tasks[id].ok && C.tasks[id]; }).length + '</div><span class="note">задач решено</span></div></div>' +
      '<div class="dots" aria-label="Занятия на этой неделе">' + dots + '</div><p class="foot">Воскресенье отдых и серию не прерывает.</p></section>';

    var tgtDays = weekTarget();
    var days = '<section class="card"><h3>Дни для математики</h3><div class="days" role="group" aria-label="Дни недели">' +
      ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(function (n, i) { return '<button type="button" data-day="' + i + '" aria-pressed="' + (S.days.indexOf(i) >= 0) + '">' + n + '</button>'; }).join('') +
      '</div><p class="msg' + (S.days.length > tgtDays ? ' warn' : '') + '">' + (S.days.length < tgtDays ? 'Выбрано ' + S.days.length + ' из ' + tgtDays + '. Отметь ещё ' + (tgtDays - S.days.length) + '.' : S.days.length === tgtDays ? 'Расписание готово: ' + plural(tgtDays, ['урок', 'урока', 'уроков']) + ' в неделю.' : 'Это больше нормы для режима. Помни про другие предметы.') + '</p>' +
      '<p class="foot">Дата старта: <label class="sr" for="start-in">Дата старта</label><input id="start-in" type="date" value="' + S.start + '" data-start style="min-height:36px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--ink);padding:2px 8px"></p></section>';

    var rev = '<section class="card help-card"><p><b>Повторение ошибок</b><br><span class="note">' + (due ? (due === 1 ? 'Ждёт ' : 'Ждут ') + plural(due, ['карточка', 'карточки', 'карточек']) + '. Это 5–10 минут.' : 'Сегодня всё повторено. Новые карточки появляются после ошибок в задачах.') + '</span></p>' +
      '<a class="btn primary" href="' + (due ? '#review/due' : '#train') + '">' + (due ? 'Повторить' : 'К тренажёрам') + '</a></section>';

    var mockCard = lastMock('m00') ? '' : '<section class="card help-card"><p><b>Входной пробник</b><br><span class="note">13 задач части 1, около двух часов. Платформа сама проверит и покажет, с каких блоков начать.</span></p><a class="btn primary" href="#mock/m00">Пройти</a></section>';
    return note() + '<p class="greet">' + esc(greet) + '</p><div class="grid-2"><div class="col">' + hero + mockCard + plan + rev + '</div><div class="col">' + week + streakCard + days + '</div></div>';
  };

  /* ---- Маршрут ---- */
  VIEWS.route = function (a) {
    var openId = a && a[0];
    var done = lessonsDone(), tl = lessonTotal(), bd = C.blocks.filter(function (b) { return blockState(b) === 'done'; }).length;
    var head = '<div class="card"><div class="sumbar"><div class="kpi num">' + done + ' <small>из ' + tl + ' уроков плана</small></div>' +
      '<div class="note">Блоков пройдено: ' + bd + ' из ' + C.blocks.length + '</div></div><div class="bar"><i style="width:' + pct(done, tl) + '%"></i></div>' +
      '<p class="note" style="margin-top:12px">Каждый блок опирается только на предыдущие, поэтому порядок менять не нужно. ' + esc(C.idx.format) + ' Готово блоков: ' + C.blocks.filter(function (x) { return x.status === 'ready'; }).length + ', остальные добавляются по очереди.</p></div>';
    var first = true, h = '';
    var chk = '';
    var m0 = lastMock('m00');
    h += '<li class="stop" data-s="' + (m0 ? 'done' : 'now') + '"><div class="node">' + (m0 ? ic('check') : ic('flag')) + '</div><div class="sbody"><a class="shead" href="#mock/m00" style="text-decoration:none;color:inherit"><span><span class="stitle">Входной пробник</span><span class="ssub"><span class="stag">' +
      (m0 ? 'Результат ' + ptsLabel(mockRes(m0)) : 'Сначала пробник') + '</span><span>13 задач части 1, около 2 часов. Результат запишется сам и покажет, с каких блоков начать</span></span></span><span class="chev">' + ic('chev') + '</span></a></div></li>';
    C.blocks.forEach(function (b) {
      var s = blockState(b);
      if (s === 'later' && first && b.status !== 'ready' && C.blocks.filter(function (x) { return x.status === 'ready' && blockState(x) !== 'done'; }).length === 0) { s = 'next'; }
      if (s === 'later' || s === 'next') first = false;
      var lab = { done: 'Пройден', now: 'Идёт', next: b.status === 'ready' ? 'Дальше' : 'Дальше, готовится', later: b.status === 'ready' ? 'Позже' : 'Скоро' }[s];
      var open = openId === b.id;
      var chips = b.ege.map(function (n) { return '<span class="chip" title="Задание ЕГЭ № ' + n + '">ЕГЭ № ' + n + '</span>'; }).join(' ');
      var needH = b.need.length ? '<div class="need">Нужно знать: ' + b.need.map(function (n) { return '<span class="chip">Блок ' + n + '. ' + esc(C.blocks[n - 1].title) + '</span>'; }).join(' ') + '</div>' : '<div class="need">Можно начинать без подготовки.</div>';
      var cnt = b.lessons[S.mode];
      var det = needH;
      if (b.status === 'ready') {
        det += '<div class="need">' + reviewChip(b) + '</div>';
        var ck = C.tests[b.id + '/check'], ts = C.tests[b.id + '/test'];
        var rk = S.tests[b.id + '/check'], rt = S.tests[b.id + '/test'];
        det += '<ol class="lessons">';
        det += '<li><a href="#test/' + b.id + '/check"><span class="dot"></span><span class="lt">Стартовая проверка</span><span class="tail">' + (rk ? rk.s + ' из ' + rk.t : plural(ck.tasks.length, ['задача', 'задачи', 'задач'])) + '</span></a></li>';
        bl(b).forEach(function (l, i) {
          var dn = S.lessons[b.id + '/' + l.id];
          det += '<li class="' + (dn ? 'done' : '') + '"><a href="#lesson/' + b.id + '/' + l.id + '"><span class="dot">' + (dn ? ic('check') : '') + '</span><span class="lt">Урок ' + (i + 1) + '. ' + esc(l.title) + '</span><span class="tail">' + (dn ? 'пройден' : l.minutes + ' мин') + '</span></a></li>';
        });
        det += '<li class="' + (rt && rt.pass ? 'done' : '') + '"><a href="#test/' + b.id + '/test"><span class="dot">' + (rt && rt.pass ? ic('check') : '') + '</span><span class="lt">Контрольная блока ' + b.n + '</span><span class="tail">' + (rt ? rt.s + ' из ' + rt.t : plural(ts.tasks.length, ['задача', 'задачи', 'задач'])) + '</span></a></li>';
        if (b.n >= 2) {
          var rc = S.tests[b.id + '/cum'];
          det += '<li class="' + (rc ? 'done' : '') + '"><a href="#test/' + b.id + '/cum"><span class="dot">' + (rc ? ic('check') : '') + '</span><span class="lt">Накопительная работа: блоки 1–' + b.n + '</span><span class="tail">' + (rc ? rc.s + ' из ' + rc.t : plural(getTest(b.id + '/cum').tasks.length, ['задача', 'задачи', 'задач'])) + '</span></a></li>';
        }
        if (S.mode === 'plus' && pl(b).length) {
          det += '<li class="plus-h"><span class="lt"><b>★ Режим 70+: часть 2</b></span></li>';
          pl(b).forEach(function (l) {
            var dn = S.lessons[b.id + '/' + l.id], num = b.lessonList.indexOf(l) + 1;
            det += '<li class="' + (dn ? 'done' : '') + '"><a href="#lesson/' + b.id + '/' + l.id + '"><span class="dot">' + (dn ? ic('check') : '') + '</span><span class="lt">Урок ' + num + '. ' + esc(l.title) + '</span><span class="tail">' + (dn ? 'пройден' : l.minutes + ' мин') + '</span></a></li>';
          });
        }
        det += '</ol>';
      } else {
        det += b.plan ? '<ol class="lessons">' + b.plan.map(function (x, i) { return '<li class="extra"><span class="dot"></span><span>Урок ' + (i + 1) + '. ' + esc(x) + '</span></li>'; }).join('') + '</ol>' : '';
        det += '<p class="note">Уроков по плану: ' + cnt + '. Содержание блока появится позже.</p>';
      }
      if (S.mode === 'plus' && b.extra && !pl(b).length) det += '<p class="note"><b>Режим 70+:</b> ещё ' + plural(b.lessons.plus - b.lessons.base, ['урок', 'урока', 'уроков']) + ' по части 2. ' + esc(b.extra) + '. Они откроются вместе с содержанием блока.</p>';
      h += '<li class="stop" data-s="' + s + '"><div class="node">' + (s === 'done' ? ic('check') : b.n) + '</div><div class="sbody">' +
        '<button class="shead" data-blk="' + b.id + '" aria-expanded="' + open + '" aria-controls="d-' + b.id + '"><span><span class="stitle">' + esc(b.title) + '</span><span class="ssub"><span class="stag">' + lab + '</span><span>' + plural(cnt, ['урок', 'урока', 'уроков']) + '</span>' + chips + '</span></span><span class="chev">' + ic('chev') + '</span></button>' +
        '<div class="detail" id="d-' + b.id + '"' + (open ? '' : ' hidden') + '>' + det + '</div></div></li>';
    });
    if (S.mode === 'plus' && C.extra.length) {
      h += '<li class="plus-h stop-h"><b>★ Режим 70+: задания 19 и 20</b><span class="note"> Отдельные блоки по самым сложным заданиям части 2. Начинай после блоков, которые указаны в «Нужно знать».</span></li>';
      C.extra.forEach(function (b) {
        var nd = b.lessonList.filter(function (l) { return S.lessons[b.id + '/' + l.id]; }).length, st = nd === b.lessonList.length ? 'done' : nd ? 'now' : 'next', open2 = openId === b.id;
        var chips2 = b.ege.map(function (n) { return '<span class="chip">ЕГЭ № ' + n + '</span>'; }).join(' ');
        var needH2 = '<div class="need">Нужно знать: ' + b.need.map(function (n) { return '<span class="chip">Блок ' + n + '. ' + esc(C.blocks[n - 1].title) + '</span>'; }).join(' ') + '</div>';
        var det2 = needH2 + '<ol class="lessons">' + b.lessonList.map(function (l, i) {
          var dn = S.lessons[b.id + '/' + l.id];
          return '<li class="' + (dn ? 'done' : '') + '"><a href="#lesson/' + b.id + '/' + l.id + '"><span class="dot">' + (dn ? ic('check') : '') + '</span><span class="lt">Урок ' + (i + 1) + '. ' + esc(l.title) + '</span><span class="tail">' + (dn ? 'пройден' : l.minutes + ' мин') + '</span></a></li>';
        }).join('') + '</ol>';
        h += '<li class="stop" data-s="' + st + '"><div class="node">' + (st === 'done' ? ic('check') : b.n) + '</div><div class="sbody">' +
          '<button class="shead" data-blk="' + b.id + '" aria-expanded="' + open2 + '" aria-controls="d-' + b.id + '"><span><span class="stitle">' + esc(b.title) + '</span><span class="ssub"><span class="stag">' + { done: 'Пройден', now: 'Идёт', next: '70+' }[st] + '</span><span>' + plural(b.lessonList.length, ['урок', 'урока', 'уроков']) + '</span>' + chips2 + '</span></span><span class="chev">' + ic('chev') + '</span></button>' +
          '<div class="detail" id="d-' + b.id + '"' + (open2 ? '' : ' hidden') + '>' + det2 + '</div></div></li>';
      });
    }
    h += '<li class="stop" data-s="later"><div class="node">' + ic('loop') + '</div><div class="sbody"><span class="shead" style="cursor:default"><span><span class="stitle">Повторение и пробники</span><span class="ssub"><span class="stag">Финал</span><span>Около 6 недель перед экзаменом, полный пробник каждые 1–2 недели</span></span></span></span></div></li>';
    return head + '<ol class="route">' + h + '</ol>';
  };

  /* ---- Домашнее задание к уроку: задачи из банка по номеру ЕГЭ урока, без новых текстов ---- */
  var HW_N = 6;
  function lessonNo(lid) { var m = /(\d+)/.exec(lid || ''); return m ? +m[1] : 0; }
  function hwFor(key) {
    var rec0 = S.hw[key];
    if (rec0 && rec0.ids.every(function (id) { return C.tasks[id]; })) return rec0;
    var L = C.lessons[key], b = blockById(L.block), lid = key.split('/')[1], lp = !!(b.lessonList[L.n - 1] && b.lessonList[L.n - 1].plus);
    var n = egeOf({ kind: 'lesson', block: b.id, lid: lid, plus: lp });
    var cur = lessonNo(lid), pool = [];
    if (n) {
      pool = bankAll(n).filter(function (id) {
        var t = C.tasks[id], tb = blockById(t.block);
        if (!t || t.key === key || (t.hard && !lp) || (t.plus && !lp) || (t.kind === 'hard' && !lp)) return false;
        if (!tb) return false;
        if (tb.n > b.n) return false;
        if (tb.n === b.n && t.kind !== 'mock' && lessonNo(t.lid || t.lesson) > cur) return false;
        return true;
      });
    }
    pool = pool.sort(function (x, y) {
      var ox = S.tasks[x] && S.tasks[x].ok ? 1 : 0, oy = S.tasks[y] && S.tasks[y].ok ? 1 : 0;
      return ox - oy || hs(x + key) - hs(y + key);
    }).slice(0, HW_N);
    if (pool.length < HW_N && L.hard) L.hard.slice().sort(function (x, y) { return (x.top ? 1 : 0) - (y.top ? 1 : 0); }).slice(0, HW_N - pool.length).forEach(function (t) { pool.push(t.id); });
    S.hw[key] = { ids: pool, n: n, done: null }; save();
    return S.hw[key];
  }
  function hwStat(key) {
    var h = hwFor(key), ok = h.ids.filter(function (id) { return S.tasks[id] && S.tasks[id].ok; }).length;
    return { h: h, ok: ok, total: h.ids.length, done: !!h.done || (h.ids.length > 0 && ok === h.ids.length) };
  }
  function hwSection(key) {
    var st = hwStat(key); if (!st.total) return '';
    var h = '<section class="card hw" id="hw" style="margin-top:16px"><div class="prog-line" style="margin:0 0 6px"><h3>Домашнее задание</h3><span class="note num">Решено ' + st.ok + ' из ' + st.total + '</span></div>' +
      '<p class="note" style="margin:0 0 12px">' + (st.h.n ? 'Задания ЕГЭ № ' + st.h.n + ' из общего банка, которых не было в уроке. ' : '') + 'Решай после урока, лучше на следующий день. Ошибки попадут в повторение.</p>' +
      '<div class="stack">' + st.h.ids.map(function (id, i) { return taskCard(C.tasks[id], { n: 'Д' + (i + 1) }); }).join('') + '</div>';
    h += '<div class="cta-row">' + (st.done ? '<span class="chip good">Домашнее задание выполнено</span>' : '<button class="btn ghost" data-hw-done="' + key + '">Отметить выполненным</button>') + '</div></section>';
    return h;
  }
  function hwPending() {
    return Object.keys(S.lessons).filter(function (k) { return C.lessons[k] && S.hw[k] && S.hw[k].ids && S.hw[k].ids.length; })
      .filter(function (k) { var b = blockById(k.split('/')[0]); var l = b && b.lessonList.filter(function (x) { return x.id === k.split('/')[1]; })[0]; return l && (!l.plus || S.mode === 'plus'); })
      .filter(function (k) { return !hwStat(k).done; })
      .sort(function (a, b2) { return String(S.lessons[b2]).localeCompare(String(S.lessons[a])); });
  }

  function hardSection(L) {
    var used = (S.hw[L.key] && S.hw[L.key].ids) || [], hl = (L.hard || []).filter(function (t) { return used.indexOf(t.id) < 0; });
    if (!hl.length) return '';
    if (S.mode !== 'plus') return '<p class="note hard-hint">Хочешь сложнее? В режиме 70+ под практикой есть ещё ' + hl.length + ' заданий по желанию.</p>';
    var solved = hl.filter(function (t) { return S.tasks[t.id] && S.tasks[t.id].ok; }).length;
    return '<details class="hard" data-hard' + (UI.hard ? ' open' : '') + '><summary><span>' + (L.plus ? '★ Дополнительные задачи: последние две сложнее' : '★ Для 70+: усложнённое домашнее задание') + '</span><span class="note num">решено ' + solved + ' из ' + hl.length + '</span></summary>' +
      '<p class="note">' + (L.plus ? 'Эти пять задач идут по нарастанию трудности, последние две самые сложные. Они необязательны: не влияют на отметку урока и не попадают в повторение.' : 'Задачи сложнее основных и идут по нарастанию. Они необязательны: не влияют на отметку урока и не попадают в повторение. Начинай, когда основные задачи решаются с первого раза, и для начала выбери 3–4.') + '</p>' +
      '<div class="stack">' + hl.map(function (t, i) { return taskCard(C.tasks[t.id], { n: i + 1 }); }).join('') + '</div></details>';
  }

  /* ---- Урок ---- */
  VIEWS.lesson = function (a) {
    var key = a[0] + '/' + a[1], L = C.lessons[key], b = blockById(a[0]);
    if (!L) return notFound();
    var done = S.lessons[key];
    var solved = L.tasks.filter(function (t) { return S.tasks[t.id] && (S.tasks[t.id].ok || S.tasks[t.id].seen); }).length;
    var can = solved === L.tasks.length;
    var due = dueIds().length;
    var lp = b.lessonList[L.n - 1] && b.lessonList[L.n - 1].plus, nx = b.lessonList[L.n];
    var next = lp ? (nx && nx.plus ? { href: '#lesson/' + b.id + '/' + nx.id, t: 'Следующий урок 70+' } : { href: '#route/' + b.id, t: 'К маршруту блока' }) : (nx && !nx.plus ? { href: '#lesson/' + b.id + '/' + nx.id, t: 'Следующий урок' } : { href: '#test/' + b.id + '/test', t: 'К контрольной блока ' + b.n });
    var h = '<div class="reading">' + crumbs([{ t: 'Маршрут', href: '#route' }, { t: 'Блок ' + b.n + '. ' + esc(b.title), href: '#route/' + b.id }, { t: 'Урок ' + L.n }]);
    h += '<div class="page-h"><h2>Урок ' + L.n + '. ' + esc(L.title) + '</h2><div class="meta-row"><span class="chip">около ' + L.minutes + ' минут</span><span>' + plural(L.tasks.length, ['задача', 'задачи', 'задач']) + '</span>' + (done ? pill('checked', 'Урок пройден') : '') + (L.plus ? '<span class="chip">★ 70+, часть 2</span>' : '') + reviewChip(b) + '</div>' +
      '<p class="lead" style="margin-top:10px">' + M(esc(L.intro)) + '</p></div>';
    if (due) h += '<p class="notice" style="margin:0 0 16px">Сначала разомнись: ждут ' + plural(due, ['карточка', 'карточки', 'карточек']) + ' повторения. <a href="#review/due" style="color:inherit;font-weight:700">Повторить</a></p>';
    h += '<div class="stack theory">' + L.theory.map(function (s) {
      return '<section class="card"><h3>' + M(esc(s.h)) + '</h3><div class="prose">' + M(s.html) + '</div></section>';
    }).join('');
    h += '<section class="card"><h3>Разобранные примеры</h3>' + L.examples.map(function (e, i) {
      return '<div class="ex"><div class="q">Пример ' + (i + 1) + '. ' + M(e.q) + '</div>' + (e.fig || '') + '<details class="sd"><summary>Показать разбор</summary><ol class="steps">' +
        e.steps.map(function (x) { return '<li>' + M(x) + '</li>'; }).join('') + '</ol>' + (e.solfig || '') + '<p class="final">Ответ: ' + fmtNum(e.a) + '</p></details></div>';
    }).join('') + '</section></div>';
    h += '<div class="prog-line"><h3>Практика</h3><span class="note num">Решено ' + solved + ' из ' + L.tasks.length + '</span></div>';
    h += '<p class="note" style="margin:0 0 12px">Ответ — целое число или десятичная дробь. Если запнулся, открой подсказку: решение лучше смотреть в последнюю очередь, такая задача вернётся в повторении.</p>';
    h += '<div class="stack">' + L.tasks.map(function (t, i) { return taskCard(C.tasks[t.id], { n: i + 1 }); }).join('') + '</div>';
    if (L.rubric) h += '<section class="card" style="margin-top:16px"><h3>' + esc(L.rubric.h || 'Оцени своё решение') + '</h3><p class="note">' + M(esc(L.rubric.lead || '')) + '</p><ul class="rubric">' + L.rubric.items.map(function (x) { return '<li><label><input type="checkbox"> <span>' + M(x) + '</span></label></li>'; }).join('') + '</ul></section>';
    h += hwSection(key);
    h += '<section class="card" style="margin-top:16px">' + (done
      ? '<p><b>Урок пройден</b> ' + human(typeof done === 'string' ? done : today()) + '.</p><div class="cta-row"><a class="btn primary" href="' + next.href + '">' + next.t + '</a><button class="btn ghost" data-undo-lesson="' + key + '">Снять отметку</button></div>'
      : '<p>' + (can ? 'Все задачи разобраны. Можно отмечать урок пройденным.' : 'Отметка станет доступна, когда каждая задача будет решена или разобрана.') + '</p><div class="cta-row"><button class="btn primary" data-done-lesson="' + key + '"' + (can ? '' : ' disabled') + '>Урок пройден</button></div>') + '</section>' + hardSection(L) + '</div>';
    return h;
  };

  /* ---- Проверки (стартовая, контрольная) ---- */
  VIEWS.test = function (a) {
    var key = a[0] + '/' + a[1], T = getTest(key), b = blockById(a[0]);
    if (!T) return notFound();
    var res = S.tests[key];
    var cr = crumbs([{ t: 'Маршрут', href: '#route' }, { t: 'Блок ' + b.n + '. ' + esc(b.title), href: '#route/' + b.id }, { t: T.kind === 'check' ? 'Стартовая проверка' : T.kind === 'cum' ? 'Накопительная работа' : 'Контрольная' }]);
    if (RUN && RUN.key === key) {
      return '<div class="reading">' + cr + '<div class="page-h"><h2>' + esc(T.title) + '</h2><div class="meta-row"><span class="chip">около ' + T.minutes + ' минут</span><span>без подсказок</span></div></div>' + runTimerHtml(T.minutes) +
        '<p class="note" style="margin:0 0 12px">Ответ — целое число или десятичная дробь. Пустые ответы засчитываются как ошибки. Уходить с экрана до конца нельзя: ответы пропадут.</p>' +
        '<div class="stack">' + T.tasks.map(function (t, i) { return taskCard(C.tasks[t.id], { ctx: 'test', n: i + 1, value: (RUN.vals || {})[t.id] }); }).join('') + '</div>' +
        '<div class="cta-row"><button class="btn primary" data-finish="' + key + '">Завершить</button></div></div>';
    }
    if (!res) {
      return '<div class="reading">' + cr + '<div class="page-h"><h2>' + esc(T.title) + '</h2><div class="meta-row"><span class="chip">около ' + T.minutes + ' минут</span><span>' + plural(T.tasks.length, ['задача', 'задачи', 'задач']) + '</span></div></div>' +
        '<section class="card"><p class="prose">' + M(esc(T.intro)) + '</p><div class="cta-row"><button class="btn primary" data-start-test="' + key + '">Начать</button></div></section></div>';
    }
    /* результат */
    var okc = res.s, tot = res.t, p = pct(okc, tot);
    var wrongLessons = {};
    T.tasks.forEach(function (t) { if (!isRight(t, res.n && res.n[t.id] !== undefined ? res.n[t.id] : NaN)) { if (t.lesson) wrongLessons[t.lesson] = 1; } });
    var advice = '';
    if (T.kind === 'check') {
      if (okc >= T.skipScore) advice = '<p><b>Материал блока тебе знаком.</b> Можно сразу писать контрольную: если наберёшь ' + 80 + '% и больше, уроки блока засчитываются.</p><div class="cta-row"><a class="btn primary" href="#test/' + b.id + '/test">К контрольной</a><a class="btn ghost" href="#lesson/' + b.id + '/' + bl(b)[0].id + '">Всё равно пройти уроки</a></div>';
      else {
        var ls = bl(b).filter(function (l) { return wrongLessons[l.id]; });
        if (!ls.length) ls = bl(b);
        advice = '<p><b>Начни с уроков:</b></p><div class="link-list">' + ls.map(function (l) { return '<a href="#lesson/' + b.id + '/' + l.id + '">Урок ' + (b.lessonList.indexOf(l) + 1) + '. ' + esc(l.title) + '</a>'; }).join('') + '</div>';
      }
    } else if (T.kind === 'cum') {
      var per = res.per || {}, weakB = [];
      advice = '<p><b>Результат по блокам</b></p><ul class="mast">' + C.blocks.filter(function (x) { return per[x.id]; }).map(function (x) {
        var q = per[x.id], pp = pct(q[0], q[1]);
        if (pp < 60) weakB.push(x);
        return '<li><span>' + x.n + '. ' + esc(x.title) + '</span><span class="v num">' + q[0] + ' из ' + q[1] + '</span><div class="bar"><i style="width:' + pp + '%' + (pp < 60 ? ';background:var(--amber)' : '') + '"></i></div></li>';
      }).join('') + '</ul>' +
        (weakB.length ? '<p style="margin-top:12px"><b>Стоит вернуться:</b> ' + weakB.map(function (x) { return '<a href="#route/' + x.id + '">блок ' + x.n + '</a>'; }).join(', ') + '. Ошибочные задачи уже добавлены в повторение.</p>' : '<p style="margin-top:12px"><b>Все блоки держатся.</b> Продолжай по плану, а ошибки (если были) уже ждут в повторении.</p>');
      var nb2 = C.blocks[b.n];
      advice += '<div class="cta-row">' + (nb2 && nb2.status === 'ready' ? '<a class="btn primary" href="#test/' + nb2.id + '/check">К блоку ' + nb2.n + '</a>' : '<a class="btn primary" href="#route">К маршруту</a>') + '<a class="btn ghost" href="#train">Повторение</a></div>';
    } else if (res.pass) {
      var nb = C.blocks[b.n];
      advice = '<p><b>Блок пройден.</b> ' + (b.n >= 2 && !S.tests[b.id + '/cum'] ? 'Закрепи его вместе с прошлыми блоками: накопительная работа проверит, что старое не забылось. ' : '') + (nb ? 'Дальше по плану блок ' + nb.n + ': «' + esc(nb.title) + '».' + (nb.status === 'ready' ? '' : ' Его содержание ещё готовится.') : '') + '</p><div class="cta-row">' + (nb && nb.status === 'ready' ? (b.n >= 2 && !S.tests[b.id + '/cum'] ? '<a class="btn amber" href="#test/' + b.id + '/cum">Накопительная работа</a>' : '') + '<a class="btn primary" href="#test/' + nb.id + '/check">К блоку ' + nb.n + '</a><a class="btn ghost" href="#route">К маршруту</a>' : (b.n >= 2 && !S.tests[b.id + '/cum'] ? '<a class="btn amber" href="#test/' + b.id + '/cum">Накопительная работа</a>' : '') + '<a class="btn primary" href="#route">К маршруту</a><a class="btn ghost" href="#train">Тренировки</a>') + '</div>';
    } else {
      var ls2 = bl(b).filter(function (l) { return wrongLessons[l.id]; });
      advice = '<p><b>До порога не хватило.</b> Повтори уроки, где были ошибки, и пересдай. По плану на это есть один урок из резерва.</p><div class="link-list">' + ls2.map(function (l) { return '<a href="#lesson/' + b.id + '/' + l.id + '">Урок ' + (b.lessonList.indexOf(l) + 1) + '. ' + esc(l.title) + '</a>'; }).join('') + '</div>';
    }
    var h = '<div class="reading">' + cr + '<div class="page-h"><h2>' + esc(T.title) + '</h2><div class="meta-row"><span>Последняя попытка: ' + human(res.at) + '</span></div></div>';
    h += '<section class="card"><div class="verdict"><div><div class="score num">' + okc + '<small> из ' + tot + '</small></div><p class="note">' + p + '%' + (T.kind === 'test' ? ', порог ' + T.passPct + '%' : '') + '</p></div>' +
      (T.kind === 'test' ? pill(res.pass ? 'checked' : 'late', res.pass ? 'Контрольная сдана' : 'Не сдана') : '') + '</div>' + advice +
      '<div class="cta-row"><button class="btn ghost" data-start-test="' + key + '">Пройти ещё раз</button></div></section>';
    h += '<div class="prog-line"><h3>Разбор</h3></div><section class="card"><ul class="res">' + T.tasks.map(function (t, i) {
      var v = res.ans && res.ans[t.id] !== undefined ? res.ans[t.id] : '', ok = judge(t, v).ok === true;
      return '<li><div class="row"><div class="prose">' + (i + 1) + '. ' + M(t.q) + '</div>' + pill(ok ? 'checked' : 'late', ok ? 'Верно' : 'Ошибка') + '</div>' +
        '<div class="yours">Твой ответ: ' + (v === '' ? 'нет ответа' : esc(v)) + (ok ? '' : ' · верный: ' + fmtNum(C.tasks[t.id].a)) + '</div>' +
        (ok ? '' : '<details open><summary>Решение</summary><div class="prose">' + solutionHtml(C.tasks[t.id]) + '</div></details>') + '<div class="task-foot"><button type="button" class="linkbtn" data-report="' + t.id + '">Сообщить об ошибке</button></div></li>';
    }).join('') + '</ul></section></div>';
    return h;
  };
  function finishTest(key) {
    var T = getTest(key), score = 0, ans = {}, per = {};
    T.tasks.forEach(function (t) {
      var inp = document.getElementById('in-' + t.id), v = inp ? inp.value : '';
      ans[t.id] = v;
      var ok = judge(t, v).ok === true;
      if (ok) score++;
      var rr = attemptPractice(C.tasks[t.id], ok);
      if (T.kind === 'cum') {
        var q = per[t.block] || (per[t.block] = [0, 0]); q[1]++; if (ok) q[0]++;
        if (!ok) scheduleReview(rr); else if (rr.rv && rr.rv.due <= today()) advance(rr);
      }
    });
    var pass = T.kind === 'test' ? pct(score, T.tasks.length) >= T.passPct : null;
    S.tests[key] = { s: score, t: T.tasks.length, at: today(), pass: pass, ans: ans };
    if (T.kind === 'cum') {
      var cs = cumState();
      S.tests[key].ids = T.tasks.map(function (t) { return t.id; }); S.tests[key].per = per;
      T.tasks.forEach(function (t) { cs.used[t.id] = (cs.used[t.id] || 0) + 1; });
      cs.round[T.block] = (cs.round[T.block] || 0) + 1; delete cs.sel[T.block];
    }
    save(); RUN = null; DRAFT = {}; render(); window.scrollTo(0, 0);
  }

  /* ---- Журнал заданий ---- */
  var JF = { st: 'all', ty: 'all' };
  VIEWS.tasks = function () {
    var all = C.order.map(function (id) { return C.tasks[id]; });
    var cnt = { all: all.length, new: 0, ok: 0, err: 0 };
    all.forEach(function (t) { var s = taskStatus(t.id); if (s === 'new') cnt.new++; else if (s === 'ok' || s === 'ok2') cnt.ok++; if (S.tasks[t.id] && S.tasks[t.id].rv) cnt.err++; });
    var fb = function (grp, key, label) { return '<button type="button" class="fbtn" data-jf="' + grp + ':' + key + '" aria-pressed="' + (JF[grp] === key) + '">' + label + '</button>'; };
    var list = all.filter(function (t) {
      var s = taskStatus(t.id), r = S.tasks[t.id];
      var okS = JF.st === 'all' || (JF.st === 'new' && s === 'new') || (JF.st === 'ok' && (s === 'ok' || s === 'ok2')) || (JF.st === 'err' && r && r.rv);
      var okT = JF.ty === 'all' || (JF.ty === 'lesson' && t.kind === 'lesson') || (JF.ty === 'test' && t.kind !== 'lesson');
      return okS && okT;
    });
    var h = '<div class="filters"><div class="fgroup" role="group" aria-label="Статус"><span>Статус</span>' + fb('st', 'all', 'Все ' + cnt.all) + fb('st', 'new', 'Не решены ' + cnt.new) + fb('st', 'ok', 'Решены ' + cnt.ok) + fb('st', 'err', 'В повторении ' + cnt.err) + '</div>' +
      '<div class="fgroup" role="group" aria-label="Откуда"><span>Откуда</span>' + fb('ty', 'all', 'Любые') + fb('ty', 'lesson', 'Уроки') + fb('ty', 'test', 'Проверки') + '</div></div>';
    h += '<div class="rows">' + (list.length ? list.map(function (t) {
      var s = taskStatus(t.id), href = taskHref(t), r = S.tasks[t.id];
      return '<a class="hrow" href="' + href + '" style="color:inherit;text-decoration:none"><div><div class="t prose" style="font-weight:500">' + M(t.q) + '</div><div class="s">Блок ' + blockById(t.block).n + ' · ' + esc(t.where) + '</div></div>' +
        '<div class="meta"><span>' + pill(PILL[s][0], PILL[s][1]) + '</span><span class="due">' + (r && r.rv ? 'повтор ' + human(r.rv.due) : '') + '</span></div></a>';
    }).join('') : '<div class="empty">Нет заданий с такими фильтрами.</div>') + '</div>';
    return h;
  };

  /* ---- Прогресс ---- */
  function mockChart() {
    var ms = S.mocks.slice().sort(function (a, b) { return a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id; }).slice(-8).map(function (m) { var r = mockRes(m); return { name: m.name, s: r.pts, max: r.max }; });
    if (!ms.length) return '<p class="empty-note">Пока нет результатов. Реши входной пробник по части 1 и запиши результат ниже.</p>';
    var W = 420, H = 210, L = 40, R = 20, T = 26, B = 46, iw = W - L - R, ih = H - T - B;
    var y = function (p) { return T + ih - ih * p / 100; };
    var x = function (i) { return ms.length === 1 ? L + iw / 2 : L + iw * i / (ms.length - 1); };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Результаты пробников в процентах">';
    [0, 50, 100].forEach(function (g) { svg += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '"/><text class="axis" x="' + (L - 8) + '" y="' + (y(g) + 4) + '" text-anchor="end">' + g + '%</text>'; });
    svg += '<polyline class="ln" points="' + ms.map(function (m, i) { return x(i).toFixed(1) + ',' + y(pct(m.s, m.max)).toFixed(1); }).join(' ') + '"/>';
    ms.forEach(function (m, i) {
      var p = pct(m.s, m.max), nm = m.name.length > 11 ? m.name.slice(0, 10) + '…' : m.name;
      svg += '<circle class="pt" cx="' + x(i).toFixed(1) + '" cy="' + y(p).toFixed(1) + '" r="5.5" tabindex="0"><title>' + esc(m.name) + ': ' + m.s + ' из ' + m.max + '</title></circle>' +
        '<text class="val" x="' + x(i).toFixed(1) + '" y="' + (y(p) - 11).toFixed(1) + '" text-anchor="middle">' + m.s + '/' + m.max + '</text>' +
        '<text class="axis" x="' + x(i).toFixed(1) + '" y="' + (H - 20) + '" text-anchor="middle">' + esc(nm) + '</text>';
    });
    return svg + '</svg>';
  }
  VIEWS.progress = function () {
    var done = lessonsDone(), tl = lessonTotal(), p = pct(done, tl), Cc = 2 * Math.PI * 42, acc = accuracy();
    var h = note() + '<div class="stats">';
    h += '<section class="card"><h3>Прохождение плана</h3><div class="ring"><svg viewBox="0 0 100 100" role="img" aria-label="Пройдено ' + p + ' процентов плана"><circle class="tr" cx="50" cy="50" r="42"/><circle class="fg" cx="50" cy="50" r="42" transform="rotate(-90 50 50)" stroke-dasharray="' + (p / 100 * Cc).toFixed(1) + ' ' + Cc.toFixed(1) + '"/><text x="50" y="57" text-anchor="middle">' + p + '%</text></svg><p class="note">' + done + ' из ' + tl + ' уроков</p></div></section>';
    h += '<section class="card"><h3>Верно с первой попытки</h3><div class="kpi num">' + (acc.p === null ? '—' : acc.p + '<small>%</small>') + '</div><p class="note" style="margin-top:8px">' + (acc.att ? 'По ' + plural(acc.att, ['задаче', 'задачам', 'задачам']) + '.' : 'Появится после первых задач.') + '</p></section>';
    h += '<section class="card"><h3>Повторение</h3><div class="kpi num">' + errIds().length + '</div><p class="note" style="margin-top:8px">карточек в очереди; сегодня ждут ' + dueIds().length + '. Освоено: ' + Object.keys(S.tasks).filter(function (id) { return S.tasks[id].mastered; }).length + '.</p></section></div>';
    h += '<section class="card" style="margin-bottom:16px"><h3>Освоение заданий ЕГЭ</h3><div class="egegrid mini">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(function (k) { return egeCell(k, false, true); }).join('') + '</div><p class="note" style="margin-top:10px">Решено задач из банка по каждому номеру. Нажми на номер, чтобы потренироваться.</p></section>';
    h += '<div class="two"><section class="card"><h3>Пробники</h3>' + mockChart() +
      (S.mocks.length ? '<ul class="mocks" style="margin-top:8px">' + S.mocks.slice().sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id; }).map(function (m) {
        return '<li><span>' + esc(m.name) + ' · ' + human(m.at) + '</span><span><b class="num">' + ptsLabel(mockRes(m)) + '</b> <button class="del" data-del-mock="' + m.id + '">удалить</button></span></li>';
      }).join('') + '</ul>' : '') +
      '<h4 style="margin:18px 0 8px;font-size:15px">Пройти пробник</h4><ul class="mocks">' + (C.idx.mocks || []).map(function (m) {
        var l = lastMock(m.id);
        return '<li><span>' + esc(m.name) + (l ? ' · последний результат ' + ptsLabel(mockRes(l)) : ' · ещё не проходил') + '</span><a class="btn primary sm" href="#mock/' + m.id + '">' + (l ? 'Результат' : 'Начать') + '</a></li>';
      }).join('') + '</ul>' +
      '<p class="note" style="margin-top:10px">Результат записывается автоматически сразу после завершения. По плану пробник раз в четыре недели, новые варианты появятся в этом списке.</p></section>';
    h += '<section class="card"><h3>Освоение блоков</h3><ul class="mast">' + C.blocks.map(function (b) {
      var a = accuracy(function (t) { return t.block === b.id; }), st = blockState(b), right = b.status !== 'ready' ? '—' : (st === 'done' ? 'пройден' : (a.p === null ? '—' : a.p + '%'));
      return '<li><span>' + b.n + '. ' + esc(b.title) + '</span><span class="v num">' + right + '</span><div class="bar"><i style="width:' + (st === 'done' ? 100 : (a.p || 0)) + '%' + (st === 'now' ? ';background:var(--amber)' : '') + '"></i></div></li>';
    }).join('') + '</ul><p class="note" style="margin-top:8px">Процент считается по первым попыткам в задачах блока.</p></section></div>';
    var cumRows = C.blocks.filter(function (b) { return b.status === 'ready' && b.n >= 2; }).map(function (b) {
      var r = S.tests[b.id + '/cum'], open = S.tests[b.id + '/test'] && S.tests[b.id + '/test'].pass;
      return '<li><span>После блока ' + b.n + (r ? ' · ' + human(r.at) : '') + '</span><span>' + (r ? '<b class="num">' + r.s + ' из ' + r.t + '</b> ' : '') +
        (r || open ? '<a class="btn ' + (r ? 'ghost' : 'primary') + ' sm" href="#test/' + b.id + '/cum">' + (r ? 'Разбор' : 'Начать') + '</a>' : '<span class="note">откроется после контрольной</span>') + '</span></li>';
    }).join('');
    if (cumRows) h += '<section class="card" style="margin-top:16px"><h3>Накопительные работы</h3><ul class="mocks">' + cumRows + '</ul><p class="note" style="margin-top:10px">В каждой работе есть задачи нового блока и всех прошлых. Слабые места подбираются первыми, ошибки попадают в повторение.</p></section>';
    var code = esc(JSON.stringify(S));
    h += '<section class="card" style="margin-top:16px"><h3>Сохранить или перенести прогресс</h3><p class="note">Прогресс хранится только в этом браузере. Если меняешь телефон или чистишь данные сайта, сначала скопируй код.</p>' +
      '<div class="cta-row"><button class="btn ghost" data-copy>Скопировать код</button><button class="btn ghost" data-download>Скачать файлом</button></div>' +
      '<label class="sr" for="bk-out">Код прогресса</label><textarea id="bk-out" class="code" readonly style="margin-top:10px">' + code + '</textarea>' +
      '<p class="note" style="margin:14px 0 6px">Восстановление: вставь код сюда.</p><label class="sr" for="bk-in">Вставь код</label><textarea id="bk-in" class="code" placeholder="Вставь сохранённый код"></textarea>' +
      '<div class="cta-row"><button class="btn primary" data-import>Восстановить</button><button class="btn danger" data-reset>Сбросить прогресс</button></div></section>';
    return h;
  };


  /* ---- О проекте ---- */
  VIEWS.about = function () {
    var fbk = C.idx.feedback || {}, rd = C.blocks.filter(function (b) { return b.status === 'ready'; });
    var theme = S.theme === 'light' || S.theme === 'dark' ? S.theme : 'auto';
    var contact = fbk.mail ? 'Напиши на <a href="mailto:' + esc(fbk.mail) + '">' + esc(fbk.mail) + '</a>.' : fbk.url ? '<a href="' + esc(fbk.url) + '" target="_blank" rel="noopener">Форма для сообщений об ошибках</a>.' :
      'Контакт для сообщений пока не указан. Кнопка «Сообщить об ошибке» под каждой задачей копирует готовый текст: сохрани его, и отправишь, когда контакт появится.';
    var h = '<div class="reading about">';
    h += '<section class="card"><img class="logo-full lg-l" src="img/logo-l.png" alt="Po poryadku, онлайн школа"><img class="logo-full lg-d" src="img/logo-d.png" alt="Po poryadku, онлайн школа"><h3>Что это</h3><p>Бесплатная подготовка к ЕГЭ по профильной математике для тех, кому недоступны платные школы. Темы идут в таком порядке, чтобы каждый следующий блок опирался только на пройденные. Регистрации нет, рекламы нет.</p></section>';
    h += '<section class="card"><h3>Как устроено</h3><ul>' +
      '<li><b>Маршрут</b> — блоки тем по порядку. В каждом: стартовая проверка (покажет, какие уроки можно пропустить), уроки, контрольная с порогом 80%.</li>' +
      '<li><b>Урок</b> — теория, разобранные примеры, практика с подсказками и решениями.</li>' +
      '<li><b>Накопительная работа</b> после каждого блока, начиная со второго: задачи нового блока и всех прошлых, слабые места первыми.</li>' +
      '<li><b>Повторение</b> — ошибочные задачи возвращаются через 1, 3, 7 и 21 день.</li>' +
      '<li><b>Режим 70+</b> добавляет уроки и по 10 сложных задач к каждому уроку по желанию.</li></ul></section>';
    h += '<section class="card"><h3>Что нужно знать честно</h3><ul>' +
      '<li>Тексты, задачи и решения подготовлены с помощью нейросети. Ответ к каждой задаче считается программой и сверяется независимым перебором, но ошибки в формулировках возможны. Поэтому содержание проверяет преподаватель, а статус каждого блока показан ниже.</li>' +
      '<li>Сайт проверяет только числовые ответы: целое число или десятичная дробь. Развёрнутые решения второй части он проверить не может.</li>' +
      '<li>Структура заданий взята из проекта демоверсии ФИПИ на 2027 год. Утверждённая версия ожидается в ноябре 2026, номера заданий сверим по ней.</li>' +
      '<li>Сайт не заменяет преподавателя, он помогает навести порядок в темах и не потерять пройденное.</li></ul>' +
      '<ul class="rv-list">' + rd.map(function (b) { return '<li><span>' + b.n + '. ' + esc(b.title) + '</span>' + reviewChip(b) + '</li>'; }).join('') + '</ul></section>';
    h += '<section class="card"><h3>Приватность</h3><p>Прогресс хранится только в этом браузере и никуда не отправляется. Аккаунтов и персональных данных нет. Шрифты пока загружаются с серверов Google, потом переедут на сайт.</p></section>';
    h += '<section class="card"><h3>Оформление</h3><div class="themes" role="group" aria-label="Тема оформления">' +
      ['auto', 'light', 'dark'].map(function (k) { return '<button type="button" data-theme-set="' + k + '" aria-pressed="' + (theme === k) + '">' + THEME_NAMES[k][0].toUpperCase() + THEME_NAMES[k].slice(1) + '</button>'; }).join('') + '</div></section>';
    h += '<section class="card"><h3>Нашёл ошибку или есть идея</h3><p>' + contact + '</p><p class="note">Версия сайта: ' + esc(C.idx.version || '—') + '.</p></section></div>';
    return h;
  };

  /* ---- Тренажёры ---- */
  var EGE_SHORT = { 1: 'Планиметрия', 2: 'Векторы', 3: 'Стереометрия', 4: 'Вероятность', 5: 'Вероятность', 6: 'Случайные величины', 7: 'Уравнения', 8: 'Преобразования', 9: 'Производная', 10: 'Прикладная задача', 11: 'Текстовая задача', 12: 'Функции и графики', 13: 'Финансовая задача', 14: 'Уравнение, отбор корней', 15: 'Стереометрия, доказательство', 16: 'Неравенство', 17: 'Моделирование', 18: 'Планиметрия, доказательство', 19: 'Параметр', 20: 'Теория чисел' };
  var BANK = null;
  function egeOf(t) {
    if (t.kind === 'mock') return t.ege || null;
    if (t.hard && !t.plus) return null;
    var m = C.idx.egeMap && C.idx.egeMap[t.block];
    if (!m) return null;
    var lid = t.lid || t.lesson;
    return t.plus ? (m['+'] || null) : (m[lid] || m['*'] || null);
  }
  function bank() {
    if (!BANK) {
      BANK = {};
      Object.keys(C.tasks).forEach(function (id) { var n = egeOf(C.tasks[id]); if (n) (BANK[n] = BANK[n] || []).push(id); });
    }
    return BANK;
  }
  function bankFor(n) { return (bank()[n] || []).filter(function (id) { return !C.tasks[id].plus || S.mode === 'plus'; }); }
  function bankAll(n) { return bank()[n] || []; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function isErr(id) { var r = S.tasks[id]; return !!(r && !r.ok && (r.n > 0 || r.seen)); }
  function isNew(id) { var r = S.tasks[id]; return !r || (!r.n && !r.seen); }
  function egeStat(n) {
    var ids = bankFor(n), ok = ids.filter(function (id) { return S.tasks[id] && S.tasks[id].ok; }).length;
    return { total: ids.length, ok: ok, err: ids.filter(isErr).length, fresh: ids.filter(isNew).length };
  }
  function pickFor(n, cnt, src) {
    var ids = bankFor(n), pool;
    if (src === 'err') pool = shuffle(ids.filter(isErr));
    else if (src === 'rand') pool = shuffle(ids);
    else pool = shuffle(ids.filter(isNew)).concat(shuffle(ids.filter(isErr)), shuffle(ids.filter(function (id) { return !isNew(id) && !isErr(id); })));
    return cnt === 'all' ? pool : pool.slice(0, cnt);
  }
  function startDrill(n) {
    var ids;
    if (n === 'mix') { ids = []; for (var k = 1; k <= 13; k++) { var p = pickFor(k, 1, 'new'); if (p.length) ids.push(p[0]); } }
    else ids = pickFor(n, S.ege.cnt, S.ege.src);
    if (!ids.length) return;
    DR = { n: n, ids: ids, i: 0, res: {}, t0: Date.now() };
    DRAFT = {}; FB = {}; UI = { hint: {}, sol: {} };
    if (CUR.name === 'drill') { render(); window.scrollTo(0, 0); } else location.hash = '#drill';
  }
  function markWrong(tid) {
    var r = rec(tid);
    if (!r.ok && !r.seen) { r.seen = true; if (r.first === null) r.first = false; }
    scheduleReview(r); save();
  }
  function egeCell(n, sel, link) {
    var all = bankAll(n).length, st = all ? egeStat(n) : null;
    var locked = all === 0, plusOnly = !locked && st.total === 0 && all > 0;
    var cls = 'egecell' + (sel ? ' on' : '') + (locked ? ' lock' : '') + (plusOnly ? ' plusonly' : '') + (n >= 14 ? ' p2' : '');
    var sub = locked ? 'скоро' : plusOnly ? '70+' : st.ok + ' из ' + st.total;
    var pr = locked || plusOnly ? 0 : pct(st.ok, st.total);
    var tag = link ? 'a' : 'button', at = link ? ' href="#train/ege"' : ' type="button"';
    return '<' + tag + at + ' class="' + cls + '"' + (locked ? '' : '') + ' data-ege-n="' + n + '" aria-pressed="' + (!!sel) + '"><b class="num">' + n + '</b><span class="nm">' + esc(EGE_SHORT[n]) + '</span><span class="sb">' + sub + '</span><i class="mb"><u style="width:' + pr + '%"></u></i></' + tag + '>';
  }
  function subtabs(cur) {
    var tabs = [['ege', 'Тренажёр ЕГЭ'], ['mock', 'Пробники'], ['rep', 'Повторение'], ['mental', 'Устный счёт'], ['ref', 'Справочник']];
    return '<nav class="subtabs" aria-label="Разделы">' + tabs.map(function (x) { return '<a href="#train/' + x[0] + '"' + (x[0] === cur ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav>';
  }
  function trainEge() {
    var n = S.ege.n, st = bankAll(n).length ? egeStat(n) : null, E = C.idx;
    var h = '<p class="lead">Как в настоящем ЕГЭ: выбери номер задания и количество, и решай. Часть 1 — №1–13, часть 2 — №14–20.</p>';
    h += '<h2 class="sec-h">Часть 1 · краткий ответ</h2><div class="egegrid">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(function (k) { return egeCell(k, k === n); }).join('') + '</div>';
    h += '<h2 class="sec-h" style="margin-top:18px">Часть 2 · развёрнутый ответ</h2><div class="egegrid">' + [14, 15, 16, 17, 18, 19, 20].map(function (k) { return egeCell(k, k === n); }).join('') + '</div>';
    h += '<section class="card ege-set"><h3>№ ' + n + '. ' + esc((E.egeTopics && E.egeTopics[n]) || EGE_SHORT[n]) + '</h3>';
    if (!st) {
      h += '<p class="note">Задач по этому номеру пока нет. Мы их готовим.</p></section>';
    } else if (!st.total) {
      h += '<p class="note">Задачи этого номера входят в режим 70+.</p><div class="cta-row"><button class="btn primary" data-mode="plus">Включить режим 70+</button></div></section>';
    } else {
      var cnts = [5, 10, 15, 20, 'all'].filter(function (c) { return c === 'all' || c <= st.total; });
      if (cnts.indexOf(S.ege.cnt) < 0) S.ege.cnt = cnts[Math.min(1, cnts.length - 1)];
      var cap = S.ege.src === 'err' ? st.err : st.total, want = S.ege.cnt === 'all' ? cap : Math.min(S.ege.cnt, cap);
      var pts = E.egePoints && E.egePoints[n];
      h += '<p class="note">В банке ' + plural(st.total, ['задача', 'задачи', 'задач']) + ', решено ' + st.ok + ', с ошибками ' + st.err + (pts ? '. На экзамене за это задание до ' + pts + ' ' + "баллов" + '.' : '.') + (n >= 14 ? ' Сайт проверяет только итоговый ответ, решение сверяй с разбором сам.' : '') + '</p>';
      var sg = function (attr, key, val, label) { return '<button type="button" class="fbtn" data-ege-' + attr + '="' + val + '" aria-pressed="' + (String(S.ege[key]) === String(val)) + '">' + label + '</button>'; };
      h += '<div class="fgroup" role="group" aria-label="Количество"><span>Сколько</span>' + cnts.map(function (c) { return sg('cnt', 'cnt', c, c === 'all' ? 'Все ' + st.total : c); }).join('') + '</div>';
      h += '<div class="fgroup" role="group" aria-label="Какие задачи"><span>Какие</span>' + sg('src', 'src', 'new', 'Сначала новые') + sg('src', 'src', 'err', 'Мои ошибки ' + st.err) + sg('src', 'src', 'rand', 'Случайные') + '</div>';
      h += '<div class="cta-row"><button class="btn primary" data-ege-start' + (want ? '' : ' disabled') + '>' + (want ? 'Решать: ' + plural(want, ['задание', 'задания', 'заданий']) : 'Нет ошибок по этому номеру') + '</button>' +
        '<button class="btn ghost" data-ege-mix title="По одному заданию с №1 по №13">Микс 1–13</button></div></section>';
    }
    return h;
  }
  function mockVariants() {
    var m1 = 99, mf = 99, k;
    for (k = 1; k <= 13; k++) m1 = Math.min(m1, bankAll(k).filter(function (id) { return !C.tasks[id].plus; }).length || 0);
    for (k = 1; k <= 20; k++) mf = Math.min(mf, bankAll(k).length);
    return { p1: Math.max(1, Math.min(10, m1)), f: Math.min(10, mf) };
  }
  function hs(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function ensureMock(id) {
    if (C.mocks[id]) return C.mocks[id];
    var m = /^(p1|f)-(\d+)$/.exec(id); if (!m) return null;
    var K = +m[2], full = m[1] === 'f', last = full ? 20 : 13, tasks = [];
    for (var n = 1; n <= last; n++) {
      var pool = bankAll(n).filter(function (x) { return full || !C.tasks[x].plus; }).sort(function (a, b) { return hs(a + n) - hs(b + n); });
      if (!pool.length) return null;
      var tk = C.tasks[pool[(K - 1) % pool.length]];
      tasks.push(Object.assign({}, tk, { ege: n }));
    }
    var T = { id: id, key: 'mock/' + id, kind: 'mock', title: (full ? 'Полный вариант ' : 'Часть 1, вариант ') + K, minutes: full ? 235 : 120, max: tasks.reduce(function (a, t) { return a + taskPts(t); }, 0), part2: full,
      intro: full ? 'Задания №1–20 по формату ЕГЭ. Задания №14–20 нужно решать письменно на бумаге, сайт проверит только итоговый ответ. Баллы за ход решения поставил бы эксперт, поэтому наш результат показывает число верных ответов, а не первичные баллы.' : 'Задания №1–13, краткий ответ, как в первой части ЕГЭ. Время на экзамене на всю работу 3 часа 55 минут, на часть 1 стоит заложить около двух часов.' };
    T.tasks = tasks; C.mocks[id] = T;
    return T;
  }
  function trainMock() {
    var v = mockVariants(), plus = S.mode === 'plus';
    var row = function (id, name, sub) {
      var l = lastMock(id);
      return '<li class="mrow"><div><b>' + esc(name) + '</b><span class="note">' + sub + (l ? ' · последний результат ' + ptsLabel(mockRes(l)) : '') + '</span></div><a class="btn ' + (l ? 'ghost' : 'primary') + ' sm" href="#mock/' + id + '">' + (l ? 'Результат' : 'Начать') + '</a></li>';
    };
    var h = '<p class="lead">Целый вариант без подсказок и с таймером в голове: решаешь всё подряд, потом получаешь разбор. Каждый вариант собран из разных задач банка.</p>';
    h += '<section class="card"><h3>Часть 1 · задания 1–13</h3><ul class="mlist">' + (C.mocks.m00 ? row('m00', 'Входной пробник', '13 заданий, около 2 часов') : '');
    for (var k = 1; k <= v.p1; k++) h += row('p1-' + k, 'Часть 1, вариант ' + k, '13 заданий, около 2 часов');
    h += '</ul></section><section class="card"><h3>Полный вариант · задания 1–20</h3>';
    if (plus) {
      h += '<ul class="mlist">';
      for (k = 1; k <= v.f; k++) h += row('f-' + k, 'Полный вариант ' + k, '20 заданий, 3 ч 55 мин');
      h += '</ul><p class="note" style="margin-top:8px">Часть 2 проверяется только по итоговому ответу.</p>';
    } else h += '<p class="note">Часть 2 входит в режим 70+. Включи его, и здесь появятся полные варианты с заданиями №14–20.</p><div class="cta-row"><button class="btn ghost" data-mode="plus">Включить режим 70+</button></div>';
    return h + '</section>';
  }
  function trainRep() {
    var due = dueIds().length, errs = errIds().length;
    var h = '<section class="card"><div class="rep"><div><h3 style="margin-bottom:6px">Повторение на сегодня</h3><div class="rep-n num">' + due + ' <small style="font:500 14px var(--font-body);color:var(--muted)">' + (due === 1 ? 'карточка' : 'карточек') + '</small></div></div>' +
      '<div class="rep-b"><span>Всего в очереди ' + errs + '</span><span>Освоено ' + Object.keys(S.tasks).filter(function (id) { return S.tasks[id].mastered; }).length + '</span></div>' +
      (due ? '<a class="btn primary" href="#review/due">Начать</a>' : (errs ? '<a class="btn ghost" href="#review/all">Повторить досрочно</a>' : '')) + '</div>' +
      '<p class="note" style="margin-top:12px">' + (errs ? 'Ошибочные задачи возвращаются через 1, 3, 7 и 21 день. Так они остаются в памяти до экзамена.' : 'Карточки появляются после ошибок в задачах и показываются через 1, 3, 7 и 21 день.') + '</p></section>';
    h += '<h2 class="sec-h" style="margin-top:22px">Журнал ошибок</h2><section class="card">';
    var ids = errIds();
    h += ids.length ? '<div>' + ids.map(function (id) {
      var t = C.tasks[id], r = S.tasks[id], en = egeOf(t);
      return '<div class="err-row"><div class="prose">' + M(t.q) + '</div><div class="meta-row"><span>' + (en ? '№ ' + en + ' · ' : '') + 'Блок ' + blockById(t.block).n + ' · ' + esc(t.where) + '</span><span>повтор ' + (r.rv.due <= today() ? 'сегодня' : human(r.rv.due)) + '</span><a href="' + taskHref(t) + '" style="color:var(--brand);font-weight:600">Открыть</a></div></div>';
    }).join('') + '</div>' : '<p class="empty-note">Пока пусто. Ошибки из задач и проверок появятся здесь.</p>';
    return h + '</section>';
  }
  function trainMental() {
    return '<p class="lead">Короткие серии по 10 задач на скорость, без калькулятора. На каждую задачу даётся ограниченное время, его хватает, если тема знакома. Не успел — задача считается ошибкой.</p><div class="cards">' + TRAINERS.map(function (T) {
      var b = S.trainer[T.id];
      return '<div class="card tr-card"><div><h3>' + esc(T.title) + '</h3><p class="note">' + esc(T.sub) + '</p><p class="note">' + TR_N + ' задач · ' + T.sec + ' с на задачу · задания ЕГЭ № ' + T.ege + '</p></div><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="note">' + (b ? 'Лучший: <b class="num">' + b.best + ' из ' + TR_N + '</b>' : 'Ещё не проходил') + '</span><a class="btn primary sm" href="#trainer/' + T.id + '">Начать</a></div></div>';
    }).join('') + '</div>';
  }
  function trainRef() {
    return C.reference.map(function (r) { return '<details class="ref-card"><summary>' + esc(r.h) + '</summary><div class="prose">' + M(r.html) + '</div></details>'; }).join('');
  }
  VIEWS.train = function (a) {
    var sub = a && a[0] || 'ege';
    var body = { ege: trainEge, mock: trainMock, rep: trainRep, mental: trainMental, ref: trainRef }[sub];
    if (!body) { sub = 'ege'; body = trainEge; }
    return '<div class="train-wrap">' + subtabs(sub) + body() + '</div>';
  };

  /* ---- Тренажёр ЕГЭ: решение ---- */
  VIEWS.drill = function () {
    var cr = crumbs([{ t: 'Тренажёры', href: '#train/ege' }, { t: DR ? (DR.n === 'mix' ? 'Микс 1–13' : '№ ' + DR.n) : 'Тренажёр ЕГЭ' }]);
    if (!DR) return '<div class="reading">' + cr + '<section class="card"><h3>Набор не выбран</h3><div class="cta-row"><a class="btn primary" href="#train/ege">Выбрать номер</a></div></section></div>';
    var N = DR.ids.length;
    if (DR.i >= N) {
      var okc = 0, bad = [], sk = 0;
      DR.ids.forEach(function (id) { var r = DR.res[id]; if (r === 'ok') okc++; else if (r === 'bad') bad.push(id); else sk++; });
      var sec = Math.round((Date.now() - DR.t0) / 1000);
      return '<div class="reading">' + cr + '<section class="card"><h3>Готово</h3><div class="score num">' + okc + '<small> из ' + N + '</small></div><p class="note" style="margin-top:8px">' + pct(okc, N) + '% с первой попытки · ' + Math.floor(sec / 60) + ' мин ' + (sec % 60) + ' с' + (sk ? ' · пропущено ' + sk : '') + '. Ошибочные задачи попали в повторение.</p>' +
        (bad.length ? '<p><b>Разобрать:</b></p><div class="link-list">' + bad.map(function (id) { var t = C.tasks[id]; return '<a href="' + taskHref(t) + '">№ ' + egeOf(t) + ' · ' + esc(t.where) + '</a>'; }).join('') + '</div>' : '') +
        '<div class="cta-row"><button class="btn primary" data-drill-again>Ещё раз</button><a class="btn ghost" href="#train/ege">Другой номер</a><a class="btn ghost" href="#train/rep">Повторение</a></div></section></div>';
    }
    var id = DR.ids[DR.i], t = C.tasks[id], answered = DR.res[id] !== undefined, last = DR.i === N - 1, en = egeOf(t);
    return '<div class="reading">' + cr + '<div class="prog-line"><h3>Задание ' + (DR.i + 1) + ' из ' + N + '</h3><span class="note">ЕГЭ № ' + en + ' · ' + esc(EGE_SHORT[en]) + '</span></div>' +
      '<div class="bar" style="margin-bottom:14px"><i style="width:' + pct(DR.i, N) + '%"></i></div>' + taskCard(t, { ctx: 'drill', n: DR.i + 1 }) +
      '<div class="cta-row">' + (answered ? '<button class="btn primary" data-drill-next>' + (last ? 'Завершить' : 'Дальше') + '</button>' : '<button class="btn ghost" data-drill-skip>Пропустить</button>') + '</div></div>';
  };

  /* ---- Повторение ---- */
  VIEWS.review = function (a) {
    var mode = a && a[0] === 'all' ? 'all' : 'due';
    if (!REV || REV.mode !== mode) REV = { mode: mode, ids: mode === 'all' ? errIds() : dueIds(), i: 0, res: {} };
    var cr = crumbs([{ t: 'Тренажёры', href: '#train' }, { t: 'Повторение' }]);
    if (!REV.ids.length) return '<div class="reading">' + cr + '<section class="card"><h3>Повторять нечего</h3><p class="note">Карточки появляются после ошибок в задачах.</p><div class="cta-row"><a class="btn primary" href="#route">К маршруту</a></div></section></div>';
    if (REV.i >= REV.ids.length) {
      var okc = REV.ids.filter(function (id) { return REV.res[id] === 'ok'; }).length;
      return '<div class="reading">' + cr + '<section class="card"><h3>Повторение завершено</h3><div class="score num">' + okc + '<small> из ' + REV.ids.length + '</small></div><p class="note" style="margin-top:8px">Верные задачи вернутся позже, ошибочные завтра.</p><div class="cta-row"><a class="btn primary" href="#train">К тренажёрам</a><a class="btn ghost" href="#today">На главную</a></div></section></div>';
    }
    var id = REV.ids[REV.i], t = C.tasks[id], answered = REV.res[id] !== undefined, last = REV.i === REV.ids.length - 1;
    return '<div class="reading">' + cr + '<div class="prog-line"><h3>Карточка ' + (REV.i + 1) + ' из ' + REV.ids.length + '</h3><span class="note">Блок ' + blockById(t.block).n + ' · ' + esc(t.where) + '</span></div>' +
      '<div class="bar" style="margin-bottom:14px"><i style="width:' + pct(REV.i, REV.ids.length) + '%"></i></div>' + taskCard(t, { ctx: 'review', n: REV.i + 1 }) +
      (answered ? '<div class="cta-row"><button class="btn primary" data-next-card>' + (last ? 'Завершить' : 'Дальше') + '</button></div>' : '') + '</div>';
  };

  /* ---- Тренажёры с таймером: устный счёт по темам ---- */
  function rnd(n) { return Math.floor(Math.random() * n); }
  function ri(a, b) { return a + rnd(b - a + 1); }
  function pk(arr) { return arr[rnd(arr.length)]; }
  function dc(x) { return String(x).replace('.', '{,}').replace('-', '-'); }
  function r6(x) { return parseFloat(x.toFixed(6)); }
  function signed(c, v) { return (c < 0 ? '-' : '+') + (Math.abs(c) === 1 && v ? '' : Math.abs(c)) + (v || ''); }
  function lead(c, v) { return (c < 0 ? '-' : '') + (Math.abs(c) === 1 && v ? '' : Math.abs(c)) + (v || ''); }

  function genMental() {
    var P = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75], D = [2, 4, 5, 8, 10];
    if (rnd(2) === 0) { var p = pk(P), N = 20 * ri(2, 20); return { q: '$' + p + '\\%$ от числа $' + N + '$', a: p * N / 100 }; }
    var b = pk(D), d = pk(D), a1 = ri(1, Math.max(1, b - 1)), c1 = ri(1, Math.max(1, d - 1));
    if (b === 2) a1 = 1; if (d === 2) c1 = 1;
    var n1 = a1 * d, n2 = c1 * b, plus = rnd(2) === 0;
    if (!plus && n1 < n2) { var tmp = a1; a1 = c1; c1 = tmp; tmp = b; b = d; d = tmp; n1 = a1 * d; n2 = c1 * b; }
    return { q: '$\\dfrac{' + a1 + '}{' + b + '}' + (plus ? '+' : '-') + '\\dfrac{' + c1 + '}{' + d + '}$, ответ десятичной дробью', a: r6((plus ? n1 + n2 : n1 - n2) / (b * d)) };
  }
  function genSquares() {
    if (rnd(3)) { var n = ri(11, 25); return { q: '$' + n + '^2$', a: n * n }; }
    var m = ri(2, 10); return { q: '$' + m + '^3$', a: m * m * m };
  }
  function genMul() {
    var k = rnd(3);
    if (k === 0) { var a = ri(12, 99), b = ri(3, 9); return { q: '$' + a + '\\cdot' + b + '$', a: a * b }; }
    if (k === 1) { var x = pk([25, 15, 35, 45, 12, 16, 24]), y = pk([4, 6, 8, 12, 16]); return { q: '$' + x + '\\cdot' + y + '$', a: x * y }; }
    var dv = ri(3, 9), qu = ri(12, 60); return { q: '$' + dv * qu + ':' + dv + '$', a: qu };
  }
  function genFsu() {
    if (rnd(2)) { var m = pk([2, 3, 4, 5, 6, 7, 8, 9]) * 10 + pk([-2, -1, 1, 2]); return { q: '$' + m + '^2$', a: m * m }; }
    var c = pk([20, 30, 40, 50, 60, 70, 80, 25, 35, 45]), e = ri(1, 4); return { q: '$' + (c - e) + '\\cdot' + (c + e) + '$', a: c * c - e * e };
  }
  function genPow() {
    var k = rnd(7);
    if (k === 0) { var e = ri(5, 10); return { q: '$2^{' + e + '}$', a: Math.pow(2, e) }; }
    if (k === 1) { var e3 = ri(3, 5); return { q: '$3^{' + e3 + '}$', a: Math.pow(3, e3) }; }
    if (k === 2) { var s = ri(11, 30); return { q: '$\\sqrt{' + s * s + '}$', a: s }; }
    if (k === 3) { var c = ri(2, 9); return { q: '$\\sqrt[3]{' + c * c * c + '}$', a: c }; }
    if (k === 4) { var f = pk([3, 5, 7]), neg = pk([-2, -3]); return { q: '$(' + neg + ')^{' + f + '}$', a: Math.pow(neg, f) }; }
    if (k === 5) { var t = ri(1, 4); return { q: '$2^{-' + t + '}$', a: r6(Math.pow(2, -t)) }; }
    var u = ri(1, 3); return { q: '$5^{-' + u + '}$', a: r6(Math.pow(5, -u)) };
  }
  function genLin() {
    if (rnd(2)) { var a = ri(2, 9), x = ri(-9, 9) || 7, b = ri(-20, 20); return { q: 'Решите уравнение $' + lead(a, 'x') + (b ? signed(b) : '') + '=' + (a * x + b) + '$', a: x }; }
    var d = ri(2, 6), m = ri(-6, 9), e = ri(-9, 9);
    return { q: 'Решите уравнение $\\dfrac{x' + (e ? signed(e) : '') + '}{' + d + '}=' + m + '$', a: d * m - e };
  }
  function genQuad() {
    var r1 = ri(-9, 8), r2 = ri(r1 + 1, 9), p = -(r1 + r2), q = r1 * r2;
    return { q: 'Найдите больший корень: $x^2' + (p ? signed(p, 'x') : '') + (q ? signed(q) : '') + '=0$', a: r2 };
  }
  function genDec() {
    var k = rnd(4);
    if (k === 0) { var a = ri(2, 9), b = ri(2, 9); return { q: '$' + dc(a / 10) + '\\cdot' + dc(b / 10) + '$', a: r6(a * b / 100) }; }
    if (k === 1) { var x = ri(12, 99), y = ri(12, 99); return { q: '$' + dc(x / 10) + '+' + dc(y / 10) + '$', a: r6((x + y) / 10) }; }
    if (k === 2) { var d = pk([2, 4, 5, 8]), z = ri(2, 9); return { q: '$' + dc(r6(d * z / 10)) + ':' + dc(d / 10) + '$', a: z }; }
    var w = ri(12, 99) / 100, mp = pk([10, 100]); return { q: '$' + dc(w) + '\\cdot' + mp + '$', a: r6(w * mp) };
  }
  function genProb() {
    var k = rnd(3);
    if (k === 0) {
      var tot = pk([4, 5, 8, 10, 20, 25, 40, 50]), r = ri(1, tot - 1), c = pk([['красных', 'красный'], ['синих', 'синий'], ['зелёных', 'зелёный']]);
      return { q: 'В коробке ' + tot + ' шаров, из них ' + r + ' ' + c[0] + '. Наугад берут один шар. Найдите вероятность, что он ' + c[1] + ' (десятичной дробью).', a: r6(r / tot) };
    }
    if (k === 1) { var p = ri(1, 9) / 10; return { q: 'Вероятность события равна $' + dc(p) + '$. Найдите вероятность противоположного события.', a: r6(1 - p) }; }
    var u = ri(1, 9) / 10, v = pk([0.5, 0.2, 0.4, 0.1, 0.8]); return { q: 'Независимые события происходят с вероятностями $' + dc(u) + '$ и $' + dc(v) + '$. Найдите вероятность, что произойдут оба.', a: r6(u * v) };
  }
  function genDer() {
    var k = rnd(2), x0 = ri(-3, 3);
    if (k === 0) { var a = ri(1, 5), b = ri(-9, 9), c = ri(-9, 9); return { q: '$f(x)=' + lead(a, 'x^2') + (b ? signed(b, 'x') : '') + (c ? signed(c) : '') + '$. Найдите $f\'(' + x0 + ')$', a: 2 * a * x0 + b }; }
    var a3 = ri(1, 3), b3 = ri(-4, 4), c3 = ri(-9, 9); return { q: '$f(x)=' + lead(a3, 'x^3') + (b3 ? signed(b3, 'x^2') : '') + (c3 ? signed(c3, 'x') : '') + '$. Найдите $f\'(' + x0 + ')$', a: 3 * a3 * x0 * x0 + 2 * b3 * x0 + c3 };
  }
  function genLog() {
    var k = rnd(4), B = pk([2, 3, 5, 10]);
    if (k === 0) { var e = ri(1, B === 10 ? 4 : B === 2 ? 7 : 4); return { q: '$\\log_{' + B + '}' + Math.pow(B, e) + '$', a: e }; }
    if (k === 1) { var e2 = ri(1, 3); return { q: '$\\log_{' + B + '}\\dfrac{1}{' + Math.pow(B, e2) + '}$', a: -e2 }; }
    if (k === 2) { var e3 = ri(2, 5), j = ri(1, e3 - 1); return { q: '$\\log_{' + B + '}' + Math.pow(B, j) + '+\\log_{' + B + '}' + Math.pow(B, e3 - j) + '$', a: e3 }; }
    var t = pk([[6, 4, 9], [12, 8, 18], [10, 4, 25], [15, 3, 75]]);
    return { q: '$\\log_{' + t[0] + '}' + t[1] + '+\\log_{' + t[0] + '}' + t[2] + '$', a: 2 };
  }
  function genTrig() {
    var T = [['\\sin 30^\\circ', 0.5], ['\\cos 60^\\circ', 0.5], ['\\sin 90^\\circ', 1], ['\\cos 0^\\circ', 1], ['\\cos 90^\\circ', 0], ['\\sin 0^\\circ', 0], ['\\cos 180^\\circ', -1], ['\\mathrm{tg}\\,45^\\circ', 1]];
    var x = pk(T), y = pk(T), c1 = ri(2, 8), c2 = ri(2, 8), minus = rnd(2) === 0;
    return { q: '$' + c1 + '\\cdot' + x[0] + (minus ? '-' : '+') + c2 + '\\cdot' + y[0] + '$', a: r6(c1 * x[1] + (minus ? -1 : 1) * c2 * y[1]) };
  }
  function genWord() {
    var k = rnd(4);
    if (k === 0) { var v = pk([60, 80, 90, 120, 48, 72, 45]), ms = pk([20, 30, 40, 45, 15, 12, 24, 36, 18]), s = v * ms / 60; if (s !== Math.round(s)) return genWord(); return { q: 'Автомобиль едет со скоростью ' + v + ' км/ч. Сколько километров он проедет за ' + ms + ' мин?', a: s }; }
    if (k === 1) { var pr = ri(4, 40) * 50, d = pk([10, 15, 20, 25, 30, 40]); return { q: 'Цена ' + pr + ' руб., скидка ' + d + '%. Сколько рублей стоит товар со скидкой?', a: r6(pr * (100 - d) / 100) }; }
    if (k === 2) { var a = ri(3, 30), b = pk([3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 30]); if (a === b) return genWord(); var w = a * b / (a + b); if (Math.abs(w - Math.round(w * 10) / 10) > 1e-9) return genWord(); return { q: 'Один рабочий выполнит работу за ' + a + ' ч, другой за ' + b + ' ч. За сколько часов они сделают её вместе?', a: r6(w) }; }
    var big = pk([20, 25, 40, 50, 80, 200]), part = big * pk([10, 20, 25, 30, 40, 50, 60, 75]) / 100; if (part !== Math.round(part)) return genWord();
    return { q: 'Сколько процентов составляет число ' + part + ' от числа ' + big + '?', a: r6(part / big * 100) };
  }
  function genProg() {
    var k = rnd(2);
    if (k === 0) { var a1 = ri(-10, 20), d = ri(-5, 8) || 3, n = ri(5, 15); return { q: 'Арифметическая прогрессия: $a_1=' + a1 + '$, $d=' + d + '$. Найдите $a_{' + n + '}$', a: a1 + (n - 1) * d }; }
    var b1 = ri(1, 5), q = pk([2, 3, -2]), m = ri(3, 5); return { q: 'Геометрическая прогрессия: $b_1=' + b1 + '$, $q=' + q + '$. Найдите $b_{' + m + '}$', a: b1 * Math.pow(q, m - 1) };
  }
  function genIneq() {
    var a = ri(2, 8), b = ri(-15, 15), c = ri(-20, 25), x = (c - b) / a;
    if (rnd(2)) return { q: 'Наименьшее целое решение неравенства $' + lead(a, 'x') + (b ? signed(b) : '') + '>' + c + '$', a: Math.floor(x + 1e-9) + 1 };
    return { q: 'Наибольшее целое решение неравенства $' + lead(a, 'x') + (b ? signed(b) : '') + '<' + c + '$', a: Math.ceil(x - 1e-9) - 1 };
  }
  var TRAINERS = [
    { id: 'mental', title: 'Проценты и дроби', sub: 'Проценты от числа, сложение дробей', ege: '1, 11, 13', sec: 25, gen: genMental },
    { id: 'squares', title: 'Квадраты и кубы', sub: 'От 11² до 25² и кубы до 10³', ege: '7, 8', sec: 10, gen: genSquares },
    { id: 'mul', title: 'Умножение и деление', sub: 'Двузначные числа в уме', ege: '1, 11', sec: 15, gen: genMul },
    { id: 'fsu', title: 'Формулы сокращённого умножения', sub: '41², 28·32 и похожие', ege: '8', sec: 20, gen: genFsu },
    { id: 'pow', title: 'Степени и корни', sub: 'Степени двойки, корни, отрицательные степени', ege: '8', sec: 15, gen: genPow },
    { id: 'dec', title: 'Десятичные дроби', sub: 'Сложение, умножение, деление', ege: '1, 8', sec: 20, gen: genDec },
    { id: 'lin', title: 'Линейные уравнения', sub: 'Найди x без черновика', ege: '7', sec: 25, gen: genLin },
    { id: 'quad', title: 'Квадратные уравнения', sub: 'Больший корень по теореме Виета', ege: '7', sec: 30, gen: genQuad },
    { id: 'ineq', title: 'Линейные неравенства', sub: 'Наименьшее и наибольшее целое решение', ege: '16', sec: 30, gen: genIneq },
    { id: 'prob', title: 'Вероятность', sub: 'Классическая, противоположное, независимые', ege: '4, 5', sec: 25, gen: genProb },
    { id: 'der', title: 'Производная в точке', sub: 'Значение f′(x₀) для многочленов', ege: '9', sec: 35, gen: genDer },
    { id: 'log', title: 'Логарифмы', sub: 'Значение и сумма логарифмов', ege: '7, 8', sec: 25, gen: genLog },
    { id: 'trig', title: 'Значения тригонометрии', sub: 'sin, cos, tg для 0°, 30°, 45°, 60°, 90°, 180°', ege: '8, 14', sec: 25, gen: genTrig },
    { id: 'word', title: 'Простые текстовые задачи', sub: 'Скорость, скидка, работа, проценты', ege: '10, 11', sec: 30, gen: genWord },
    { id: 'prog', title: 'Прогрессии', sub: 'n-й член арифметической и геометрической', ege: '17', sec: 30, gen: genProg }
  ];
  function trainerById(id) { return TRAINERS.filter(function (t) { return t.id === id; })[0]; }
  var TR_N = 10, trTimer = null;
  function stopTimer() { if (trTimer) { clearInterval(trTimer); trTimer = null; } }
  function genSet(T) {
    var qs = [], seen = {}, guard = 0;
    while (qs.length < TR_N && guard++ < 200) {
      var q = T.gen();
      if (seen[q.q] || !isFinite(q.a) || Math.abs(q.a * 1e6 - Math.round(q.a * 1e6)) > 1e-3) continue;
      seen[q.q] = 1; qs.push(q);
    }
    return qs;
  }
  function trAnswer(raw) {          // raw === null: время вышло
    var q = TR.qs[TR.i], T = trainerById(TR.id), ok = false;
    if (raw !== null) {
      var pv = parseAnswer(raw);
      if (pv.err) { TR.last = { k: 'info', m: pv.err }; rerender(); return; }
      ok = isRight({ a: q.a }, pv.n);
    }
    if (ok) TR.ok += 1; else TR.miss.push({ q: q.q, a: q.a, late: raw === null });
    TR.last = ok ? { k: 'ok', m: 'Верно' } : { k: 'bad', m: (raw === null ? 'Время вышло, ответ: ' : 'Было неверно, ответ: ') + fmtNum(q.a) };
    TR.i += 1; stopTimer(); render(); var inp = $('#m-in'); if (inp) inp.focus();
  }
  function armTimer() {
    stopTimer();
    if (CUR.name !== 'trainer' || !TR || TR.i >= TR.qs.length) return;
    var T = trainerById(TR.id);
    if (TR.dlFor !== TR.i) { TR.dlFor = TR.i; TR.deadline = Date.now() + T.sec * 1000; }
    var tick = function () {
      var left = Math.max(0, TR.deadline - Date.now()), bar = $('#tq-bar'), tx = $('#tq-sec');
      if (bar) { bar.style.width = (left / (T.sec * 1000) * 100).toFixed(1) + '%'; bar.classList.toggle('low', left < T.sec * 1000 * 0.25); }
      if (tx) tx.textContent = Math.ceil(left / 1000) + ' с';
      if (left <= 0) { trAnswer(null); }
    };
    tick(); trTimer = setInterval(tick, 200);
  }
  VIEWS.trainer = function (a) {
    var id = a && a[0] || 'mental', T = trainerById(id);
    if (!T) return notFound();
    if (!TR || TR.id !== id) TR = { id: id, qs: genSet(T), i: 0, ok: 0, t0: Date.now(), last: null, miss: [] };
    var cr = crumbs([{ t: 'Тренажёры', href: '#train/mental' }, { t: T.title }]);
    var N = TR.qs.length;
    if (TR.i >= N) {
      var sec = Math.round((Date.now() - TR.t0) / 1000), prev = S.trainer[id];
      var isBest = !prev || TR.ok > prev.best;
      if (!TR.saved) { S.trainer[id] = { best: Math.max(TR.ok, prev ? prev.best : 0), last: TR.ok, sec: sec }; save(); TR.saved = true; }
      return '<div class="reading">' + cr + '<section class="card"><h3>Готово: ' + esc(T.title) + '</h3><div class="score num">' + TR.ok + '<small> из ' + N + '</small></div><p class="note" style="margin-top:8px">Время: ' + Math.floor(sec / 60) + ' мин ' + (sec % 60) + ' с' + (isBest && TR.ok ? '. Это лучший результат.' : '') + '</p>' +
        (TR.miss.length ? '<p><b>Что не получилось:</b></p><ul class="res">' + TR.miss.map(function (m) { return '<li><div class="row"><div class="prose">' + M(m.q) + '</div></div><div class="yours">' + (m.late ? 'не успел' : 'ошибка') + ' · ответ: ' + fmtNum(m.a) + '</div></li>'; }).join('') + '</ul>' : '<p><b>Без ошибок.</b> Можно переходить к следующей теме.</p>') +
        '<div class="cta-row"><button class="btn primary" data-trainer-again>Ещё раз</button><a class="btn ghost" href="#train/mental">Другие тренажёры</a></div></section></div>';
    }
    var q = TR.qs[TR.i];
    return '<div class="reading">' + cr + '<div class="prog-line"><h3>' + esc(T.title) + ': ' + (TR.i + 1) + ' из ' + N + '</h3><span class="note num">Верно: ' + TR.ok + '</span></div><div class="bar" style="margin-bottom:6px"><i style="width:' + pct(TR.i, N) + '%"></i></div>' +
      '<div class="tq" aria-hidden="true"><div class="tq-track"><i id="tq-bar"></i></div><span id="tq-sec" class="num"></span></div>' +
      '<section class="card"><div class="big-q">' + M(q.q) + '</div><form class="ans" id="mental-form" autocomplete="off"><label class="sr" for="m-in">Ответ</label><input id="m-in" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ответ" autofocus><button class="btn primary" type="submit">Дальше</button></form>' +
      (TR.last ? '<p class="fb ' + TR.last.k + '" role="status">' + esc(TR.last.m) + '</p>' : '') + '</section></div>';
  };

  /* ---- Пробник ---- */
  VIEWS.mock = function (a) {
    var id = a[0], T = ensureMock(id);
    if (!T) return notFound();
    var cr = crumbs([{ t: 'Прогресс', href: '#progress' }, { t: T.title }]);
    if (RUN && RUN.key === T.key) {
      return '<div class="reading">' + cr + '<div class="page-h"><h2>' + esc(T.title) + '</h2><div class="meta-row"><span class="chip">около ' + T.minutes + ' минут</span><span>без подсказок</span></div></div>' + runTimerHtml(T.minutes) +
        '<p class="note" style="margin:0 0 12px">Ответ — целое число или десятичная дробь. Пустые ответы засчитываются как ошибки. Не закрывай страницу до конца: ответы сохранятся только после кнопки «Завершить».</p>' +
        '<div class="stack">' + T.tasks.map(function (t, i) { return taskCard(C.tasks[t.id], { ctx: 'test', n: i + 1, value: (RUN.vals || {})[t.id] }); }).join('') + '</div>' +
        '<div class="cta-row"><button class="btn primary" data-finish-mock="' + id + '">Завершить</button></div></div>';
    }
    var res = lastMock(id), rr = res ? mockRes(res) : null;
    if (!res) {
      return '<div class="reading">' + cr + '<div class="page-h"><h2>' + esc(T.title) + '</h2><div class="meta-row"><span class="chip">около ' + T.minutes + ' минут</span><span>' + plural(T.tasks.length, ['задача', 'задачи', 'задач']) + ', максимум ' + plural(T.max, ['балл', 'балла', 'баллов']) + '</span></div></div>' +
        '<section class="card"><p class="prose">' + M(esc(T.intro)) + '</p><div class="cta-row"><button class="btn primary" data-start-mock="' + id + '">Начать пробник</button></div></section></div>';
    }
    var weak = {}, good = {};
    T.tasks.forEach(function (t) {
      var v = res.ans && res.ans[t.id] !== undefined ? res.ans[t.id] : '', ok = judge(t, v).ok === true;
      (ok ? good : weak)[t.block] = 1;
    });
    Object.keys(weak).forEach(function (k) { delete good[k]; });
    var blk = function (id2) { var b = blockById(id2); return '<a href="#route/' + b.id + '">Блок ' + b.n + '. ' + esc(b.title) + '</a>'; };
    var h = '<div class="reading">' + cr + '<div class="page-h"><h2>' + esc(T.title) + '</h2><div class="meta-row"><span>' + human(res.at) + (res.sec ? ' · ' + Math.max(1, Math.round(res.sec / 60)) + ' мин из ' + T.minutes + ' рекомендуемых' : '') + '</span></div></div>';
    h += '<section class="card"><div class="verdict"><div><div class="score num">' + rr.pts + '<small> из ' + plural(rr.max, ['балла', 'баллов', 'баллов']) + '</small></div><div class="note" style="margin-top:6px"><b>≈ ' + testScore(rr) + ' из 100</b> вторичных баллов, ориентировочно</div><p class="note">Верно решено заданий: ' + rr.n + ' из ' + rr.nmax + ' · ' + pct(rr.pts, rr.max) + '% баллов.' + (rr.p2max ? ' Часть 1: ' + rr.p1 + ' из ' + rr.p1max + ', часть 2: ' + rr.p2 + ' из ' + rr.p2max + '.' : '') + ' Результат записан в «Прогресс».</p>' + (rr.p2max ? '<p class="note">Часть 2 проверена только по итоговому ответу, поэтому баллы за неё показаны по максимуму за верный ответ. За ход решения на экзамене можно получить меньше, оцени себя по критериям в уроках. ' + ((C.idx && C.idx.egeScaleNote) || '') + '</p>' : '<p class="note">' + ((C.idx && C.idx.egeScaleNote) || '') + ' Здесь только часть 1, поэтому итог за весь экзамен будет выше.</p>') + '</div></div>';
    h += Object.keys(weak).length ? '<p><b>С чего начать.</b> Ошибки в этих блоках:</p><div class="link-list">' + Object.keys(weak).map(blk).join('') + '</div>' : '<p><b>Все задачи верны.</b> Можно идти сразу к контрольным блоков.</p>';
    if (Object.keys(good).length) h += '<p class="note" style="margin-top:12px">Решено верно: ' + Object.keys(good).map(function (k) { return 'блок ' + blockById(k).n; }).join(', ') + '. Эти блоки можно начать со стартовой проверки.</p>';
    h += '<div class="cta-row"><button class="btn ghost" data-start-mock="' + id + '">Пройти ещё раз</button><a class="btn ghost" href="#progress">К прогрессу</a></div></section>';
    h += '<div class="prog-line"><h3>Разбор</h3></div><section class="card"><ul class="res">' + T.tasks.map(function (t) {
      var v = res.ans && res.ans[t.id] !== undefined ? res.ans[t.id] : '', ok = judge(t, v).ok === true;
      return '<li><div class="row"><div class="prose">' + t.ege + '. ' + M(t.q) + '</div>' + pill(ok ? 'checked' : 'late', ok ? 'Верно' : 'Ошибка') + '</div>' +
        '<div class="yours">Задание ЕГЭ № ' + t.ege + ' · ' + plural(taskPts(t), ['балл', 'балла', 'баллов']) + ' · блок ' + blockById(t.block).n + ' · твой ответ: ' + (v === '' ? 'нет ответа' : esc(v)) + (ok ? '' : ' · верный: ' + fmtNum(t.a)) + '</div>' +
        (ok ? '' : '<details><summary>Решение</summary><div class="prose">' + solutionHtml(C.tasks[t.id]) + '</div></details>') + '</li>';
    }).join('') + '</ul></section></div>';
    return h;
  };
  function finishMock(id) {
    var T = C.mocks[id], ans = {};
    T.tasks.forEach(function (t) {
      var inp = document.getElementById('in-' + t.id), v = inp ? inp.value : '';
      ans[t.id] = v;
      attemptPractice(C.tasks[t.id], judge(t, v).ok === true);
    });
    var mc = mockCalc(T, ans);
    S.mocks.push({ id: Date.now(), key: id, name: T.title, s: mc.pts, max: mc.max, at: today(), sec: RUN && RUN.t0 ? Math.round((Date.now() - RUN.t0) / 1000) : 0, ans: ans });
    save(); RUN = null; DRAFT = {}; render(); window.scrollTo(0, 0);
  }

  function notFound() {
    return '<section class="card"><h3>Такой страницы нет</h3><p class="note">Вернись к маршруту.</p><div class="cta-row"><a class="btn primary" href="#route">К маршруту</a></div></section>';
  }

  /* ================= роутер и отрисовка ================= */
  var TITLES = { mock: 'Пробник', today: 'Сегодня', route: 'Маршрут', tasks: 'Задания', progress: 'Прогресс', train: 'Тренажёры', drill: 'Тренажёр', lesson: 'Урок', test: 'Проверка', review: 'Повторение', trainer: 'Тренажёр', about: 'О проекте' };
  var NAVKEY = { mock: 'progress', lesson: 'route', test: 'route', review: 'train', trainer: 'train', drill: 'train' };
  var CUR = { name: 'today', args: [] };
  function parseHash() { var h = (location.hash || '').replace(/^#/, ''), p = h.split('/'); return { name: VIEWS[p[0]] ? p[0] : 'today', args: p.slice(1) }; }
  function render() {
    var el = $('#view');
    el.innerHTML = VIEWS[CUR.name](CUR.args) + '<p class="foot-links"><a href="#about">О проекте</a> · <button type="button" class="linkbtn" data-theme-toggle>Оформление: ' + THEME_NAMES[S.theme === 'light' || S.theme === 'dark' ? S.theme : 'auto'] + '</button></p>';
    fitMath(el); armTimer(); armRunTimer();
    var stb = $('.subtabs'), sac = stb && $('[aria-current="page"]', stb);
    if (stb && sac) stb.scrollLeft = Math.max(0, sac.offsetLeft - (stb.clientWidth - sac.offsetWidth) / 2);
    var nk = NAVKEY[CUR.name] || CUR.name;
    $$('[data-go]').forEach(function (b) { b.setAttribute('aria-current', b.dataset.go === nk ? 'page' : 'false'); });
    $('#screen-title').textContent = TITLES[CUR.name];
    $$('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === S.mode)); });
    var wn = weekNo(); $('#side-week').textContent = wn ? 'неделя ' + wn + ' из ' + totalWeeks() : 'старт ' + human(S.start);
  }
  function route() {
    var r = parseHash();
    if (r.name !== 'review') REV = null;
    if (r.name !== 'trainer') { TR = null; stopTimer(); }
    if (r.name !== 'drill') DR = null;
    if (r.name !== 'test' && r.name !== 'mock') RUN = null;
    FB = {}; UI = { hint: {}, sol: {} }; DRAFT = {};
    CUR = r; render(); window.scrollTo(0, 0);
    if (r.name === 'lesson' && r.args[2] === 'hw') { var hws = document.getElementById('hw'); if (hws) hws.scrollIntoView(); }
    var v = $('#view'); if (v) v.focus({ preventScroll: true });
  }
  function keepFocus(fn) {
    var a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
    fn();
    if (id) { var n = document.getElementById(id); if (n && n.matches('input,textarea')) { n.focus({ preventScroll: true }); try { n.setSelectionRange(pos, pos); } catch (er) { /* ignore */ } } }
  }
  function rerender() { var y = window.scrollY; keepFocus(render); window.scrollTo(0, y); }

  /* ================= события ================= */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var g = t.closest('[data-go]');
    if (g) { var want = '#' + g.dataset.go; if (location.hash === want) route(); else location.hash = want; return; }
    var m = t.closest('[data-mode]');
    if (m) { S.mode = m.dataset.mode; S.days = S.mode === 'plus' ? [1, 3, 5] : [1, 5]; save(); rerender(); return; }
    var blk = t.closest('[data-blk]');
    if (blk) { var d = document.getElementById('d-' + blk.dataset.blk), open = d.hidden; d.hidden = !open; blk.setAttribute('aria-expanded', String(open)); return; }
    var day = t.closest('[data-day]');
    if (day) { var n = +day.dataset.day, i = S.days.indexOf(n); if (i >= 0) S.days.splice(i, 1); else S.days.push(n); S.days.sort(); save(); rerender(); return; }
    var jf = t.closest('[data-jf]');
    if (jf) { var p = jf.dataset.jf.split(':'); JF[p[0]] = p[1]; rerender(); return; }

    var rp = t.closest('[data-report]');
    if (rp) { reportError(rp.dataset.report); return; }
    var tt = t.closest('[data-theme-toggle]');
    if (tt) { S.theme = S.theme === 'light' ? 'dark' : S.theme === 'dark' ? 'auto' : 'light'; applyTheme(); save(); rerender(); return; }
    var ts = t.closest('[data-theme-set]');
    if (ts) { S.theme = ts.dataset.themeSet; applyTheme(); save(); rerender(); return; }
    var card = t.closest('.task');
    if (card && t.closest('[data-hint]')) { UI.hint[card.dataset.tid] = true; refreshCard(card.dataset.tid); return; }
    if (card && t.closest('[data-sol]')) {
      var tid = card.dataset.tid, ctx = card.dataset.ctx;
      UI.sol[tid] = true;
      if (ctx === 'practice') { var r = rec(tid); if (!r.ok && !r.seen) { r.seen = true; if (r.first === null) r.first = false; if (!C.tasks[tid].hard) scheduleReview(r); save(); } }
      if (ctx === 'drill' && DR && DR.res[tid] === undefined) { DR.res[tid] = 'bad'; markWrong(tid); rerender(); return; }
      if (ctx === 'review') {
        if (REV.res[tid] === undefined) { REV.res[tid] = 'bad'; var rr = rec(tid); rr.rv = { st: 0, due: addDays(today(), 1) }; save(); }
        rerender(); return;
      }
      if (CUR.name === 'lesson') { rerender(); return; }
      refreshCard(tid); return;
    }
    var en = t.closest('[data-ege-n]');
    if (en) { S.ege.n = +en.dataset.egeN; save(); if (CUR.name === 'train') { rerender(); return; } }
    var ec = t.closest('[data-ege-cnt]'); if (ec) { S.ege.cnt = ec.dataset.egeCnt === 'all' ? 'all' : +ec.dataset.egeCnt; save(); rerender(); return; }
    var es = t.closest('[data-ege-src]'); if (es) { S.ege.src = es.dataset.egeSrc; save(); rerender(); return; }
    if (t.closest('[data-ege-start]')) { startDrill(S.ege.n); return; }
    if (t.closest('[data-ege-mix]')) { startDrill('mix'); return; }
    if (t.closest('[data-drill-next]')) { DR.i += 1; DRAFT = {}; FB = {}; UI = { hint: {}, sol: {} }; render(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-drill-skip]')) { var cur = DR.ids[DR.i]; if (DR.res[cur] === undefined) DR.res[cur] = 'skip'; DR.i += 1; DRAFT = {}; FB = {}; UI = { hint: {}, sol: {} }; render(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-drill-again]')) { startDrill(DR.n); return; }
    if (t.closest('[data-next-card]')) { REV.i += 1; render(); window.scrollTo(0, 0); return; }
    var hd = t.closest('[data-hw-done]');
    if (hd) { var hk = S.hw[hd.dataset.hwDone]; if (hk) { hk.done = today(); save(); rerender(); } return; }
    var dl = t.closest('[data-done-lesson]');
    if (dl) { var key = dl.dataset.doneLesson; if (!S.lessons[key]) { S.lessons[key] = today(); bump('l'); save(); } rerender(); return; }
    var ul = t.closest('[data-undo-lesson]');
    if (ul) { delete S.lessons[ul.dataset.undoLesson]; save(); rerender(); return; }
    var st = t.closest('[data-start-test]');
    if (st) {
      var sk = st.dataset.startTest, mm = /^(b\d+)\/cum$/.exec(sk);
      if (mm) { var bb = blockById(mm[1]); if (bb) { cumState().sel[bb.id] = cumPick(bb); save(); } }
      DRAFT = {}; RUN = { key: sk, vals: {}, t0: Date.now() }; render(); window.scrollTo(0, 0); return;
    }
    var sm = t.closest('[data-start-mock]');
    if (sm) { DRAFT = {}; RUN = { key: 'mock/' + sm.dataset.startMock, vals: {}, t0: Date.now() }; render(); window.scrollTo(0, 0); return; }
    var fm = t.closest('[data-finish-mock]');
    if (fm) { finishMock(fm.dataset.finishMock); return; }
    var fin = t.closest('[data-finish]');
    if (fin) { finishTest(fin.dataset.finish); return; }
    if (t.closest('[data-trainer-again]')) { TR = null; stopTimer(); render(); return; }
    var dm = t.closest('[data-del-mock]');
    if (dm) { S.mocks = S.mocks.filter(function (x) { return String(x.id) !== dm.dataset.delMock; }); save(); rerender(); return; }
    if (t.closest('[data-copy]')) {
      var ta = $('#bk-out'); ta.select();
      var done = function () { toast('Код скопирован'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, function () { try { document.execCommand('copy'); done(); } catch (er) { toast('Выдели код вручную и скопируй'); } });
      else { try { document.execCommand('copy'); done(); } catch (er2) { toast('Выдели код вручную и скопируй'); } }
      return;
    }
    if (t.closest('[data-download]')) {
      try {
        var blob = new Blob([JSON.stringify(S)], { type: 'application/json' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'marshrut-progress-' + today() + '.json'; document.body.appendChild(a); a.click(); a.remove();
      } catch (er3) { toast('Скачивание недоступно, скопируй код'); }
      return;
    }
    if (t.closest('[data-import]')) {
      try {
        var o = JSON.parse($('#bk-in').value);
        if (!o || o.v !== 1 || typeof o.tasks !== 'object') throw new Error('bad');
        S = Object.assign(fresh(), o); save(); rerender(); toast('Прогресс восстановлен');
      } catch (er4) { toast('Не похоже на код прогресса'); }
      return;
    }
    var rs = t.closest('[data-reset]');
    if (rs) {
      if (rs.dataset.armed) { S = fresh(); save(); REV = null; rerender(); toast('Прогресс сброшен'); }
      else { rs.dataset.armed = '1'; rs.textContent = 'Точно сбросить? Нажми ещё раз'; setTimeout(function () { if (rs.isConnected) { delete rs.dataset.armed; rs.textContent = 'Сбросить прогресс'; } }, 4000); }
      return;
    }
  });

  document.addEventListener('toggle', function (e) {
    if (e.target.matches && e.target.matches('details.hard')) UI.hard = e.target.open;
    if (e.target.open) fitMath(e.target);
  }, true);

  document.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.kbd')) e.preventDefault(); });
  document.addEventListener('click', function (e) {
    var bt = e.target.closest && e.target.closest('[data-ins]');
    if (!bt) return;
    var inp = document.getElementById(bt.parentNode.getAttribute('data-for'));
    if (!inp) return;
    var v = inp.value, a0 = inp.selectionStart == null ? v.length : inp.selectionStart, b0 = inp.selectionEnd == null ? v.length : inp.selectionEnd, ins = bt.getAttribute('data-ins');
    if (ins === '⌫') { if (a0 === b0 && a0 > 0) a0 -= 1; ins = ''; }
    inp.value = v.slice(0, a0) + ins + v.slice(b0);
    inp.focus();
    try { inp.setSelectionRange(a0 + ins.length, a0 + ins.length); } catch (err) { /* ignore */ }
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  window.__parseSet = parseSet; window.__judge = judge;

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches && t.matches('.task input[id^="in-"]')) {
      var tid = t.id.replace(/^in-/, '');
      DRAFT[tid] = t.value;
      if (RUN) RUN.vals[tid] = t.value;
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('[data-heavy]')) { var k = weekStart(today()); if (t.checked) S.heavy[k] = true; else delete S.heavy[k]; save(); rerender(); }
    if (t.matches('[data-start]') && t.value) { S.start = t.value; save(); rerender(); }
    if (t.matches('.task[data-ctx="test"] input') && RUN) { RUN.vals[t.id.replace(/^in-/, '')] = t.value; }
  });

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.id === 'mental-form') { e.preventDefault(); trAnswer($('#m-in').value); return; }
    if (f.classList.contains('ans')) {
      e.preventDefault();
      var card = f.closest('.task'), tid = card.dataset.tid, ctx = card.dataset.ctx, tk = C.tasks[tid], val = f.querySelector('input').value, pa = judge(tk, val);
      if (pa.err) { FB[tid] = { k: 'info', m: pa.err, v: val }; refreshCard(tid); focusIn(tid); return; }
      var right = pa.ok;
      if (ctx === 'review') {
        if (REV.res[tid] === undefined) {
          REV.res[tid] = right ? 'ok' : 'bad';
          var rr = rec(tid);
          if (right) advance(rr); else rr.rv = { st: 0, due: addDays(today(), 1) };
          save();
        }
        FB[tid] = right ? { k: 'ok', m: 'Верно! Эта задача вернётся позже.' } : { k: 'bad', m: 'Неверно. Разбери решение: карточка вернётся завтра.' };
        if (!right) UI.sol[tid] = true;
        rerender(); return;
      }
      if (ctx === 'drill') {
        if (DR && DR.res[tid] === undefined) DR.res[tid] = right ? 'ok' : 'bad';
        var rd = attemptPractice(tk, right);
        if (!right && tk.hard) scheduleReview(rd);
        FB[tid] = right ? { k: 'ok', m: 'Верно!' } : { k: 'bad', m: tk.ans === 'set' ? 'Пока неверно. Проверь границы и тип скобок.' : 'Пока неверно. Можно ещё раз или открыть решение.', v: val };
        rerender(); if (!right) focusIn(tid); return;
      }
      var r = attemptPractice(tk, right);
      FB[tid] = right ? { k: 'ok', m: (r.first || tk.hard) ? 'Верно!' : 'Верно. Эта задача вернётся в повторении.' } : { k: 'bad', m: tk.ans === 'set' ? 'Пока неверно. Проверь границы и тип скобок: круглая не входит, квадратная входит.' : 'Пока неверно. Проверь вычисления или открой подсказку.', v: val };
      refreshCard(tid);
      if (!right) focusIn(tid);
      updateLessonFooter();
    }
  });
  function focusIn(tid) { var i = document.getElementById('in-' + tid); if (i) i.focus(); }
  function updateLessonFooter() {
    if (CUR.name !== 'lesson') return;
    rerender();
  }
  window.addEventListener('hashchange', route);

  /* ================= запуск ================= */
  loadContent().then(function () {
    if (!location.hash) { try { history.replaceState(null, '', '#today'); } catch (e) { /* ignore */ } }
    route();
  }).catch(function (err) {
    $('#view').innerHTML = '<section class="card"><h3>Не удалось загрузить содержание</h3><p class="note">Обнови страницу. ' + esc(err && err.message || '') + '</p></section>';
  });
})();
