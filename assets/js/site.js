/* Site behaviour: theme switch, phone menu, hero pause, publication search. No dependencies. */
(function () {
  'use strict';
  var root = document.documentElement;

  // Theme switch
  var themeBtn = document.getElementById('theme-toggle');
  function syncTheme() {
    var dark = root.getAttribute('data-theme') === 'dark';
    if (themeBtn) themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    var meta = document.getElementById('theme-color');
    if (meta) meta.setAttribute('content', dark ? '#061419' : '#eef3f1');
  }
  if (themeBtn) {
    syncTheme();
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncTheme();
    });
  }

  // Phone menu
  var header = document.getElementById('site-header');
  var navBtn = document.getElementById('nav-toggle');
  function setMenu(open) {
    header.classList.toggle('nav-open', open);
    navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    navBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (header && navBtn) {
    navBtn.addEventListener('click', function () { setMenu(!header.classList.contains('nav-open')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('nav-open')) { setMenu(false); navBtn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (header.classList.contains('nav-open') && !header.contains(e.target)) setMenu(false);
    });
  }

  // Hero animation: pause and play
  var handoff = document.getElementById('handoff');
  var pauseBtn = document.getElementById('handoff-pause');
  if (handoff && pauseBtn) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      pauseBtn.hidden = true;
    }
    pauseBtn.addEventListener('click', function () {
      var paused = handoff.classList.toggle('is-paused');
      pauseBtn.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    });
  }

  // Publication search
  var search = document.getElementById('pub-search');
  if (search) {
    var pubs = Array.prototype.slice.call(document.querySelectorAll('.pub'));
    var years = Array.prototype.slice.call(document.querySelectorAll('.pub-year'));
    var count = document.getElementById('pub-count');
    var empty = document.getElementById('pub-empty');
    var total = pubs.length;
    var index = pubs.map(function (el) { return el.textContent.toLowerCase().replace(/\s+/g, ' '); });
    function apply() {
      var terms = search.value.toLowerCase().split(/\s+/).filter(Boolean);
      var shown = 0;
      pubs.forEach(function (el, i) {
        var hit = terms.every(function (t) { return index[i].indexOf(t) !== -1; });
        el.hidden = !hit;
        if (hit) shown++;
      });
      years.forEach(function (y) { y.hidden = !y.querySelector('.pub:not([hidden])'); });
      if (empty) empty.hidden = shown !== 0;
      if (count) count.textContent = terms.length ? shown + ' of ' + total + ' publications' : total + ' publications';
    }
    search.addEventListener('input', apply);
    apply();
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;

  // Kinetic type: split headings into letters; letters widen as the pointer passes
  Array.prototype.slice.call(document.querySelectorAll('.kinetic')).forEach(function (el) {
    var text = el.textContent.trim();
    el.textContent = '';
    var sr = document.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = text;
    el.appendChild(sr);
    var letters = [];
    text.split(' ').forEach(function (w, wi, arr) {
      var word = document.createElement('span');
      word.className = 'word';
      word.setAttribute('aria-hidden', 'true');
      w.split('').forEach(function (c) {
        var s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        word.appendChild(s);
        letters.push(s);
      });
      el.appendChild(word);
      if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    if (reduce || !fine) return;
    var raf = 0, px = -9999, py = -9999;
    function paint() {
      raf = 0;
      letters.forEach(function (s) {
        var r = s.getBoundingClientRect();
        var d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height / 2 - py);
        var k = Math.max(0, 1 - d / 220);
        s.style.setProperty('--w', (125 - 50 * k).toFixed(1) + '%');
        s.classList.toggle('is-hot', k > 0.55);
      });
    }
    window.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
  });

  // Chapter headlines: split into words and rise in once when they scroll into view
  var reveals = document.querySelectorAll('[data-reveal]');
  if (reveals.length) {
    Array.prototype.slice.call(document.querySelectorAll('[data-reveal] .mind-headline')).forEach(function (h) {
      var full = h.textContent.trim(), words = full.split(/\s+/);
      h.textContent = '';
      var sr = document.createElement('span');
      sr.className = 'visually-hidden';
      sr.textContent = full;
      h.appendChild(sr);
      words.forEach(function (w, i) {
        var s = document.createElement('span');
        s.className = 'word'; s.style.setProperty('--i', i); s.setAttribute('aria-hidden', 'true');
        s.textContent = w;
        h.appendChild(s);
        if (i < words.length - 1) h.appendChild(document.createTextNode(' '));
      });
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { threshold: 0.2 });
      Array.prototype.slice.call(reveals).forEach(function (r) { io.observe(r); });
    } else {
      Array.prototype.slice.call(reveals).forEach(function (r) { r.classList.add('is-in'); });
    }
  }

  // Background field on inner pages: drifting points that link up and lean toward the pointer
  var field = document.getElementById('bg-field');
  if (field && field.getContext) {
    var ctx = field.getContext('2d');
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), pts = [], mx = -9999, my = -9999, running = false;
    var accent = '#5cf2c8', ink = '#e4f3ef';
    function colours() {
      var cs = getComputedStyle(root);
      accent = cs.getPropertyValue('--accent').trim() || accent;
      ink = cs.getPropertyValue('--muted').trim() || ink;
    }
    function size() {
      W = window.innerWidth; H = window.innerHeight;
      field.width = W * dpr; field.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(110, W * H / 14000));
      pts = [];
      for (var i = 0; i < n; i++) pts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18, r: Math.random() < 0.12 ? 2 : 1.1 });
    }
    function draw(move) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (move) {
          var dx = mx - p.x, dy = my - p.y, d2 = dx * dx + dy * dy;
          if (d2 < 32000) { p.vx += dx * 0.00002; p.vy += dy * 0.00002; }
          p.vx *= 0.995; p.vy *= 0.995;
          p.x += p.vx; p.y += p.vy;
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
        }
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], ex = p.x - q.x, ey = p.y - q.y, e2 = ex * ex + ey * ey;
          if (e2 < 15000) {
            var near = Math.hypot((p.x + q.x) / 2 - mx, (p.y + q.y) / 2 - my) < 180;
            ctx.strokeStyle = near ? accent : ink;
            ctx.globalAlpha = (1 - e2 / 15000) * (near ? 0.5 : 0.14);
            ctx.lineWidth = near ? 1.2 : 0.8;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        ctx.globalAlpha = p.r > 1.5 ? 0.7 : 0.4;
        ctx.fillStyle = p.r > 1.5 ? accent : ink;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    function loop() { if (!running) return; draw(true); requestAnimationFrame(loop); }
    colours(); size(); draw(false);
    window.addEventListener('resize', function () { size(); draw(false); });
    new MutationObserver(function () { colours(); draw(false); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    if (!reduce) {
      window.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
      document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) loop(); });
      running = !document.hidden; loop();
    }
  }
})();
