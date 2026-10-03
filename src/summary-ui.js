// The Summary tab (feature 009): day arrows, four totals and the 7-day feed bars.
// The numbers come from summary.js. This file draws them.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var S = root.BABYLOG_SUMMARY;
  var Sl = root.BABYLOG_SLEEP;
  var store = root.BABYLOG_STORE;
  var BAR_MAX_PX = 90;          // the tallest bar
  var WEEKDAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  var ctx = null;
  var records = [];
  var offset = 0;               // days back from today

  function $(id) { return document.getElementById(id); }
  function text(id, value) { $(id).textContent = value; }

  function render() {
    var now = Date.now();
    var win = S.dayWindow(now, offset);
    var d = S.day(records, win, now);

    text('h-summary', S.title(win, now));
    text('sum-date', R.dateLabel(win.from) + (offset === 0 ? ' · so far' : ''));
    $('sum-next').disabled = offset === 0;
    $('sum-prev').disabled = offset >= S.daysBack(records, now);

    text('sum-feeds', String(d.feeds.count));
    text('sum-feeds-sub', 'Breast ' + d.feeds.breast + ' · Bottle ' + d.feeds.bottle + (d.feeds.bottle ? ' (' + d.feeds.ml + ' ml)' : ''));
    text('sum-nappies', String(d.nappies.count));
    text('sum-nappies-sub', 'Wee ' + d.nappies.wee + ' · Poo ' + d.nappies.poo);
    text('sum-sleep', Sl.formatLength(d.sleep.ms));
    text('sum-sleep-sub', d.sleep.ms ? 'Longest stretch ' + Sl.formatLength(d.sleep.longestMs) : 'No sleep logged');
    text('sum-gap', d.averageGapMs == null ? '—' : Sl.formatLength(d.averageGapMs));
    text('sum-gap-sub', d.averageGapMs == null ? 'Needs 2 feeds' : 'Between feeds');

    renderBars(S.feedsPerDay(records, now, offset, 7));
  }

  function renderBars(days) {
    var bars = $('sum-bars'), names = $('sum-days');
    bars.textContent = '';
    names.textContent = '';
    var max = Math.max(1, days.reduce(function (m, day) { return Math.max(m, day.count); }, 0));
    days.forEach(function (day, i) {
      var selected = i === days.length - 1;
      var bar = document.createElement('div');
      bar.className = 'sum-bar' + (selected ? ' selected' : '');
      var count = document.createElement('span');
      count.textContent = String(day.count);
      var fill = document.createElement('i');
      fill.style.height = Math.max(day.count ? 6 : 2, Math.round(day.count / max * BAR_MAX_PX)) + 'px';
      bar.appendChild(count); bar.appendChild(fill);
      bars.appendChild(bar);
      var letter = document.createElement('div');
      letter.textContent = WEEKDAY_LETTER[new Date(day.from).getDay()];
      if (selected) letter.className = 'selected';
      names.appendChild(letter);
    });
  }

  // The tab was opened: read the entries again and start on today.
  function show() {
    offset = 0;
    store.all().then(function (all) {
      records = all;
      render();
    }).catch(function (err) {
      console.error('[baby-log] summary', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function init(context) {
    ctx = context;
    $('sum-prev').addEventListener('click', function () { offset++; render(); });
    $('sum-next').addEventListener('click', function () { if (offset > 0) { offset--; render(); } });
  }

  root.BABYLOG_SUMMARY_UI = { init: init, show: show };
})(typeof self !== 'undefined' ? self : this);
