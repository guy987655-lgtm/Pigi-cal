/* PiggyBank — weight & pig-out tracker.
   Data lives in localStorage under STORE_KEY:
   { "YYYY-MM-DD": {
       weight: number|null,
       stamp:  "big"|"small"|null,   // the pig, if any
       rot:    number,               // its tilt
       gym:    boolean,              // the dumbbell, independent of the pig
       gymRot: number
   } }
   A day can carry a pig and a dumbbell at once; entries written before the
   dumbbell existed simply have no `gym` key, which reads as false. */

(function () {
  'use strict';

  var STORE_KEY = 'pigTracker.v1';
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var PIG_SRC = { big: 'assets/big-pig.png', small: 'assets/small-pig.png' };
  var LABEL = { big: 'Big pig', small: 'Small pig', gym: 'Workout' };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  var COL_W = 32, PLOT_TOP = 16, PLOT_H = 140, PLOT_BOTTOM = PLOT_TOP + PLOT_H;

  var $ = function (id) { return document.getElementById(id); };

  /* Demo mode (?demo=1): a made-up month from demo/fixture.json, a frozen "today",
     and no reads or writes of the visitor's own log. Sticky for the tab; ?demo=0 exits. */
  var DEMO = (function () {
    try {
      var flag = new URLSearchParams(location.search).get('demo');
      if (flag === '1') sessionStorage.setItem('demo', '1');
      if (flag === '0') sessionStorage.removeItem('demo');
      return sessionStorage.getItem('demo') === '1';
    } catch (e) { return false; }
  })();
  var demoNow = null;
  function today() { return demoNow ? new Date(demoNow) : new Date(); }

  var now = today();

  var state = {
    view: 'cal',
    year: now.getFullYear(),
    month: now.getMonth(),
    data: DEMO ? {} : load(),
    armed: null,
    modalKey: null,
    justStamped: null
  };

  var stampTimer = null;

  /* ---------- storage ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function persist() {
    if (DEMO) return; // demo stamps and weights live in memory only
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.data));
    } catch (e) { /* private mode / quota — keep working in memory */ }
  }

  /* ---------- helpers ---------- */

  function fmt(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function entry(key) {
    return state.data[key] || { weight: null, stamp: null, rot: 0, gym: false, gymRot: 0 };
  }

  /* Build one stamp: pigs are the colored sketch PNGs, the dumbbell is an
     <svg><use> pointing at the sprite symbol. */
  function makeStamp(kind, rot, extraClass) {
    var el;
    if (kind === 'gym') {
      el = document.createElementNS(SVG_NS, 'svg');
      el.setAttribute('class', 'stamp stamp--gym' + (extraClass ? ' ' + extraClass : ''));
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', LABEL[kind]);
      var use = document.createElementNS(SVG_NS, 'use');
      use.setAttribute('href', '#dumbbell');
      el.appendChild(use);
    } else {
      el = document.createElement('img');
      el.className = 'stamp' + (extraClass ? ' ' + extraClass : '');
      el.src = PIG_SRC[kind];
      el.alt = LABEL[kind];
    }
    el.style.setProperty('--r', 'rotate(' + rot + 'deg)');
    el.style.transform = 'rotate(' + rot + 'deg)';
    return el;
  }

  function randRot() { return Math.round(Math.random() * 20 - 10); }

  /* Pigs get a signed tilt so the two are easy to tell apart at a glance:
     the small pig always leans right, the big pig always leans left. */
  function pigRot(kind) {
    var tilt = Math.round(6 + Math.random() * 8);
    return kind === 'small' ? tilt : -tilt;
  }

  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  function todayKey() {
    var t = today();
    return fmt(t.getFullYear(), t.getMonth(), t.getDate());
  }

  function prettyDate(key) {
    var p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2])
      .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  /* ---------- actions ---------- */

  function applyStamp(key) {
    var e = Object.assign({}, entry(key));
    var added;

    if (state.armed === 'gym') {
      // the dumbbell toggles on its own, leaving any pig on the day alone
      e.gym = !e.gym;
      e.gymRot = e.gym ? randRot() : 0;
      added = e.gym;
    } else if (e.stamp === state.armed) {
      e.stamp = null;
      e.rot = 0;
      added = false;
    } else {
      e.stamp = state.armed;
      e.rot = pigRot(state.armed);
      added = true;
    }

    state.data[key] = e;
    persist();

    state.justStamped = added ? key : null;
    renderCalendar();

    clearTimeout(stampTimer);
    stampTimer = setTimeout(function () {
      state.justStamped = null;
      renderCalendar();
    }, 650);
  }

  function saveWeight() {
    var v = parseFloat($('weight-input').value);
    var e = Object.assign({}, entry(state.modalKey));
    e.weight = isNaN(v) ? null : Math.round(v * 10) / 10;
    state.data[state.modalKey] = e;
    persist();
    closeModal();
    renderCalendar();
  }

  function clearWeight() {
    var e = Object.assign({}, entry(state.modalKey));
    e.weight = null;
    state.data[state.modalKey] = e;
    persist();
    closeModal();
    renderCalendar();
  }

  function openModal(key) {
    state.modalKey = key;
    var e = entry(key);
    $('modal-date').textContent = prettyDate(key);
    $('weight-input').value = e.weight != null ? String(e.weight) : '';
    $('btn-clear').hidden = e.weight == null;
    $('overlay').hidden = false;
    $('weight-input').focus();
  }

  function closeModal() {
    state.modalKey = null;
    $('overlay').hidden = true;
  }

  function setArmed(kind) {
    state.armed = state.armed === kind ? null : kind;
    renderPicker();
  }

  function setView(view) {
    state.view = view;
    if (view === 'analytics') {
      state.armed = null;
      renderPicker();
      renderTrends();
    }
    $('view-cal').hidden = view !== 'cal';
    $('view-trends').hidden = view !== 'analytics';
  }

  function shiftMonth(delta) {
    var m = state.month + delta, y = state.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    state.month = m;
    state.year = y;
    renderCalendar();
    if (state.view === 'analytics') renderTrends();
  }

  /* ---------- render: calendar ---------- */

  function renderPicker() {
    $('pick-big').setAttribute('aria-pressed', String(state.armed === 'big'));
    $('pick-small').setAttribute('aria-pressed', String(state.armed === 'small'));
    $('pick-gym').setAttribute('aria-pressed', String(state.armed === 'gym'));
    var hint = $('hint');
    hint.textContent = state.armed
      ? 'tap a day to stamp it'
      : 'tap a day to log weight · pick a stamp below';
    hint.classList.toggle('hint--armed', !!state.armed);
  }

  function renderCalendar() {
    $('month-label').textContent = MONTHS[state.month] + ' ' + state.year;

    var grid = $('grid');
    grid.textContent = '';

    var startDay = new Date(state.year, state.month, 1).getDay();
    var tk = todayKey();
    var frag = document.createDocumentFragment();

    for (var i = 0; i < 42; i++) {
      var dt = new Date(state.year, state.month, 1 + (i - startDay));
      var inMonth = dt.getMonth() === state.month;
      var key = fmt(dt.getFullYear(), dt.getMonth(), dt.getDate());
      var e = entry(key);

      var hasPig = inMonth && !!e.stamp;
      var hasGym = inMonth && !!e.gym;

      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'day' + (inMonth ? '' : ' day--out') +
        (inMonth && key === tk ? ' day--today' : '') +
        (hasPig && hasGym ? ' day--paired' : '');
      if (!inMonth) cell.disabled = true;

      var num = document.createElement('span');
      num.className = 'day__num';
      num.textContent = dt.getDate();
      cell.appendChild(num);

      var fresh = state.justStamped === key ? ' day__stamp--stamping' : '';

      if (hasPig) {
        cell.appendChild(makeStamp(e.stamp, e.rot || 0,
          'day__stamp day__stamp--' + e.stamp + fresh));
      }
      if (hasGym) {
        cell.appendChild(makeStamp('gym', e.gymRot || 0,
          'day__stamp day__stamp--gym' + fresh));
      }

      if (inMonth && e.weight != null) {
        var w = document.createElement('span');
        w.className = 'day__weight';
        w.textContent = e.weight.toFixed(1);
        cell.appendChild(w);
      }

      if (inMonth) {
        cell.setAttribute('aria-label', prettyDate(key));
        cell.addEventListener('click', onDayClick.bind(null, key));
      }

      frag.appendChild(cell);
    }

    grid.appendChild(frag);
  }

  function onDayClick(key) {
    if (state.armed) applyStamp(key);
    else openModal(key);
  }

  /* ---------- render: trends ---------- */

  function renderTrends() {
    $('trends-month').textContent = MONTHS[state.month] + ' ' + state.year;

    var n = daysInMonth(state.year, state.month);
    var weights = [], bigCount = 0, smallCount = 0, gymCount = 0;

    for (var d = 1; d <= n; d++) {
      var e = entry(fmt(state.year, state.month, d));
      weights.push(e.weight != null ? e.weight : null);
      if (e.stamp === 'big') bigCount++;
      if (e.stamp === 'small') smallCount++;
      if (e.gym) gymCount++;
    }

    var known = [];
    weights.forEach(function (w, i) { if (w != null) known.push(i); });

    var latest = known.length ? weights[known[known.length - 1]] : null;
    var first = known.length ? weights[known[0]] : null;
    var change = (latest != null && first != null) ? Math.round((latest - first) * 10) / 10 : null;

    $('stat-latest').innerHTML = (latest != null ? latest.toFixed(1) : '—') + '<small> kg</small>';

    var changeEl = $('stat-change');
    changeEl.innerHTML = (change != null ? (change > 0 ? '+' : '') + change.toFixed(1) : '—') + '<small> kg</small>';
    changeEl.className = 'stat__value' +
      (change == null ? '' : change > 0 ? ' stat__value--up' : ' stat__value--down');

    $('stat-big').textContent = bigCount;
    $('stat-small').textContent = smallCount;
    $('stat-gym').textContent = gymCount;

    renderChart(weights, known, n);
  }

  /* Centre a stamp in a chart column, optionally nudged so a pig and a
     dumbbell on the same day sit side by side instead of on top of each other. */
  function placeChartStamp(cell, svg, size, dx, dy) {
    svg.style.width = size + 'px';
    svg.style.height = size + 'px';
    svg.style.marginLeft = (-size / 2 + dx) + 'px';
    svg.style.marginTop = (-size / 2 + dy) + 'px';
    cell.appendChild(svg);
  }

  function renderChart(weights, known, n) {
    var axis = $('y-axis');
    var inner = $('chart-inner');
    axis.textContent = '';
    inner.textContent = '';

    $('legend').hidden = !known.length;
    $('note').hidden = !known.length;

    if (!known.length) {
      inner.className = '';
      inner.removeAttribute('style');
      var empty = document.createElement('div');
      empty.className = 'chart__empty';
      empty.textContent = 'No weights logged this month yet. Tap a day on the calendar to add one.';
      inner.appendChild(empty);
      return;
    }

    // y scale, padded a kilo either side and never flatter than 2 kg
    var min = Infinity, max = -Infinity;
    known.forEach(function (i) {
      min = Math.min(min, weights[i]);
      max = Math.max(max, weights[i]);
    });
    min = Math.floor(min - 1);
    max = Math.ceil(max + 1);
    if (max - min < 2) max = min + 2;

    var innerW = n * COL_W;
    var xOf = function (i) { return i * COL_W + COL_W / 2; };
    var yOf = function (w) { return PLOT_BOTTOM - (w - min) / (max - min) * PLOT_H; };

    var ticks = [
      { label: max, y: PLOT_TOP },
      { label: Math.round((max + min) / 2), y: PLOT_TOP + PLOT_H / 2 },
      { label: min, y: PLOT_BOTTOM }
    ];
    ticks.forEach(function (t) {
      var s = document.createElement('span');
      s.textContent = t.label;
      s.style.top = t.y + 'px';
      axis.appendChild(s);
    });

    // straight-line interpolation across days with no logged weight
    var interp = weights.slice();
    for (var k = 0; k < known.length - 1; k++) {
      var a = known[k], b = known[k + 1], wa = weights[a], wb = weights[b];
      for (var i = a + 1; i < b; i++) interp[i] = wa + (wb - wa) * (i - a) / (b - a);
    }

    inner.className = 'chart__inner';
    inner.style.width = innerW + 'px';

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', innerW);
    svg.setAttribute('height', 180);

    ticks.forEach(function (t) {
      var l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', 0);
      l.setAttribute('x2', innerW);
      l.setAttribute('y1', t.y);
      l.setAttribute('y2', t.y);
      l.setAttribute('class', 'chart__gridline');
      svg.appendChild(l);
    });

    if (known.length >= 2) {
      var pts = [];
      for (var j = known[0]; j <= known[known.length - 1]; j++) {
        pts.push(xOf(j).toFixed(1) + ',' + yOf(interp[j]).toFixed(1));
      }
      var poly = document.createElementNS(NS, 'polyline');
      poly.setAttribute('points', pts.join(' '));
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', 'var(--line)');
      poly.setAttribute('stroke-width', '3');
      poly.setAttribute('stroke-linejoin', 'round');
      poly.setAttribute('stroke-linecap', 'round');
      svg.appendChild(poly);
    }

    known.forEach(function (i) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', xOf(i).toFixed(1));
      c.setAttribute('cy', yOf(weights[i]).toFixed(1));
      c.setAttribute('r', '4');
      c.setAttribute('fill', '#fff');
      c.setAttribute('stroke', 'var(--line)');
      c.setAttribute('stroke-width', '3');
      svg.appendChild(c);
    });

    inner.appendChild(svg);

    var pigRow = document.createElement('div');
    pigRow.className = 'chart__row chart__row--pigs';
    var labelRow = document.createElement('div');
    labelRow.className = 'chart__row';

    for (var d = 1; d <= n; d++) {
      var e = entry(fmt(state.year, state.month, d));

      var cell = document.createElement('div');
      cell.className = 'chart__cell';
      cell.style.width = COL_W + 'px';

      var both = !!e.stamp && !!e.gym;
      if (e.stamp) {
        var sz = e.stamp === 'small' ? (both ? 15 : 18) : (both ? 21 : 26);
        placeChartStamp(cell, makeStamp(e.stamp, e.rot || 0), sz, both ? -4 : 0, both ? -2 : 0);
      }
      if (e.gym) {
        placeChartStamp(cell, makeStamp('gym', e.gymRot || 0), both ? 13 : 17,
          both ? 6 : 0, both ? 4 : 0);
      }
      pigRow.appendChild(cell);

      var label = document.createElement('div');
      label.className = 'chart__label';
      label.style.width = COL_W + 'px';
      label.textContent = (d === 1 || d === n || d % 5 === 0) ? String(d) : '';
      labelRow.appendChild(label);
    }

    inner.appendChild(pigRow);
    inner.appendChild(labelRow);
  }

  /* ---------- wiring ---------- */

  function tickClock() {
    $('clock').textContent = today()
      .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function startDemo() {
    document.documentElement.classList.add('demo');
    var banner = document.createElement('div');
    banner.className = 'demo-banner';
    banner.setAttribute('data-demo-banner', '');
    banner.textContent = 'Demo mode — sample data';
    document.body.prepend(banner);

    fetch('demo/fixture.json', { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (fixture) {
        demoNow = fixture.demoNow;
        var t = today();
        state.year = t.getFullYear();
        state.month = t.getMonth();
        state.data = fixture.days || {};
      })
      .catch(function () { /* show an empty demo month rather than real data */ })
      .then(function () {
        tickClock();
        renderPicker();
        renderCalendar();
        if (new URLSearchParams(location.search).get('view') === 'trends') setView('analytics');
        document.documentElement.setAttribute('data-exhibit-ready', '');
      });
  }

  function init() {
    var wd = $('weekdays');
    WEEKDAYS.forEach(function (l) {
      var d = document.createElement('div');
      d.textContent = l;
      wd.appendChild(d);
    });

    $('btn-prev').addEventListener('click', function () { shiftMonth(-1); });
    $('btn-next').addEventListener('click', function () { shiftMonth(1); });
    $('btn-trends').addEventListener('click', function () { setView('analytics'); });
    $('btn-back').addEventListener('click', function () { setView('cal'); });
    $('pick-big').addEventListener('click', function () { setArmed('big'); });
    $('pick-small').addEventListener('click', function () { setArmed('small'); });
    $('pick-gym').addEventListener('click', function () { setArmed('gym'); });

    $('btn-save').addEventListener('click', saveWeight);
    $('btn-clear').addEventListener('click', clearWeight);
    $('overlay').addEventListener('click', function (ev) {
      if (ev.target === $('overlay')) closeModal();
    });
    $('weight-input').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') saveWeight();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (state.modalKey) closeModal();
      else if (state.armed) setArmed(state.armed);
    });

    tickClock();
    setInterval(tickClock, 30000);

    if (DEMO) {
      startDemo();
      return;
    }
    renderPicker();
    renderCalendar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
