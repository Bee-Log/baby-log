// Sleep logic (feature 003): start a sleep, wake up, and the numbers shown. No browser APIs here, so tests can load this file.
// A sleep is one record: type 'sleep', t = fell asleep, end = woke up, or null while the baby is still asleep.
// Only sleeps are stored. Awake time is the gap between sleeps.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function live(records) {
    return records.filter(function (r) { return !r.deleted && r.type === 'sleep'; });
  }

  // The sleep that is still running (end: null), or null. Because it is a stored record, it survives closing the app.
  // If more than one is open (for example from two phones), the newest one is the current sleep.
  function currentSleep(records) {
    var open = live(records).filter(function (r) { return r.end == null; });
    return open.sort(function (a, b) { return b.t - a.t; })[0] || null;
  }

  // The most recent wake-up time, or null when no sleep has finished yet.
  function lastWake(records) {
    var ends = live(records).filter(function (r) { return r.end != null; }).map(function (r) { return r.end; });
    return ends.length ? Math.max.apply(null, ends) : null;
  }

  function startSleep(o) {
    return R.makeRecord({ id: o.id, type: 'sleep', t: o.now, end: null, now: o.now, deviceId: o.deviceId, d: { source: 'live' } });
  }

  // Wake up: the same record gets its end time and a newer updatedAt (the merge rule: newest updatedAt wins).
  function wake(rec, now, deviceId) {
    var out = {};
    for (var k in rec) out[k] = rec[k];
    out.end = Math.max(now, rec.t);                       // never before it began, even if the clock moved back
    out.deviceId = deviceId || rec.deviceId;
    out.updatedAt = Math.max(now, rec.updatedAt + 1);
    return out;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // "3h 37m", "1h 05m", "45m". Whole minutes, rounded down.
  function formatLength(ms) {
    var total = Math.max(0, Math.floor(ms / 60000));
    var h = Math.floor(total / 60), m = total % 60;
    return h === 0 ? m + 'm' : h + 'h ' + pad2(m) + 'm';
  }

  // "00:12:05"
  function formatElapsed(ms) {
    var secs = Math.max(0, Math.floor(ms / 1000));
    return pad2(Math.floor(secs / 3600)) + ':' + pad2(Math.floor(secs / 60) % 60) + ':' + pad2(secs % 60);
  }

  // Finished sleeps, newest first.
  function sleepRows(records) {
    return live(records).filter(function (r) { return r.end != null; })
      .sort(function (a, b) { return b.t - a.t; })
      .map(function (r) { return { id: r.id, t: r.t, end: r.end, ms: Math.max(0, r.end - r.t) }; });
  }

  // "1:40 pm – 3:30 pm". A sleep that began before today's 6 am to 6 am day starts with the date: "Thu 1 Oct, 11:50 pm – 2:10 am".
  function rangeLabel(row, now) {
    var w = R.dayWindow(now);
    var times = R.formatClock(row.t) + ' – ' + R.formatClock(row.end);
    if (row.t >= w.from && row.t < w.to) return times;
    var d = new Date(row.t);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + times;
  }

  // Today's rows for sleeps, in the same shape as the feed and nappy rows (records.js).
  // A finished sleep shows when the baby woke up. A sleep still running shows when it began.
  // `win` is the 6 am to 6 am day: R.dayWindow(now).
  function timelineRows(records, win) {
    var rows = [];
    live(records).forEach(function (r) {
      var finished = r.end != null;
      var t = finished ? r.end : r.t;
      if (t < win.from || t >= win.to) return;
      rows.push({
        kind: 'sleep', title: finished ? 'Woke up' : 'Fell asleep', t: t,
        label: finished ? 'slept ' + formatLength(r.end - r.t) : 'asleep now', ids: [r.id]
      });
    });
    return rows;
  }

  root.BABYLOG_SLEEP = {
    currentSleep: currentSleep, lastWake: lastWake, startSleep: startSleep, wake: wake,
    formatLength: formatLength, formatElapsed: formatElapsed, sleepRows: sleepRows, rangeLabel: rangeLabel, timelineRows: timelineRows
  };
})(typeof self !== 'undefined' ? self : this);
