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
    if (meta) meta.setAttribute('content', dark ? '#0a2030' : '#eef2f1');
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
})();
