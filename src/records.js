// Records: the portable entry format from app-rules.md, plus small pure helpers.
// No browser APIs here, so tests can load this file directly.
(function (root) {
  var TYPES = ['feed', 'sleep', 'pee', 'poop', 'cry', 'growth'];
  var DAY_START_HOUR = 6;                  // "Today" runs 6 am to 6 am (feature 008)
  var NAPPY_PAIR_MS = 2 * 60 * 1000;       // a wee and a poo this close are one nappy

  function makeRecord(o) {
    if (TYPES.indexOf(o.type) < 0) throw new Error('Unknown record type: ' + o.type);
    if (!o.id) throw new Error('Record needs an id');
    if (!o.deviceId) throw new Error('Record needs a deviceId');
    if (!isFinite(o.t) || !isFinite(o.now)) throw new Error('Record needs t and now in ms');
    return {
      id: String(o.id),
      type: o.type,
      t: o.t,
      end: o.end == null ? null : o.end,
      d: o.d || {},
      note: o.note || '',
      by: o.by || '',
      deviceId: o.deviceId,
      updatedAt: o.now
    };
  }

  // Removing never deletes: it marks the record and moves updatedAt forward, so sync can carry the delete.
  function tombstone(rec, now, deviceId) {
    var out = {};
    for (var k in rec) out[k] = rec[k];
    out.deleted = true;
    out.deviceId = deviceId || rec.deviceId;
    out.updatedAt = Math.max(now, rec.updatedAt + 1);
    return out;
  }

  // The 6 am to 6 am day that contains `now`, in local time (a DST day is 23 or 25 hours).
  function dayWindow(now) {
    var d = new Date(now);
    var start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), DAY_START_HOUR);
    if (d < start) start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, DAY_START_HOUR);
    var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, DAY_START_HOUR);
    return { from: start.getTime(), to: end.getTime() };
  }

  // Nappy rows for the timeline, newest first. Wee and poo stay two records;
  // a wee and a poo logged within NAPPY_PAIR_MS show as one "Wee + Poo" row.
  function nappyRows(records) {
    var live = records.filter(function (r) { return !r.deleted && (r.type === 'pee' || r.type === 'poop'); })
      .sort(function (a, b) { return a.t - b.t; });
    var rows = [];
    live.forEach(function (r) {
      var row = rows[rows.length - 1];
      var key = r.type === 'pee' ? 'wee' : 'poo';
      if (row && !row[key] && r.t - row.t <= NAPPY_PAIR_MS) {
        row[key] = true;
        row.ids.push(r.id);
      } else {
        rows.push({ t: r.t, wee: key === 'wee', poo: key === 'poo', ids: [r.id] });
      }
    });
    return rows.reverse();
  }

  function nappyLabel(row) {
    return row.wee && row.poo ? 'Wee + Poo' : row.wee ? 'Wee' : 'Poo';
  }

  // "Left 14 min", "Both 22 min", "Bottle 90 ml". Missing details are left out.
  function feedLabel(rec) {
    var d = rec.d || {};
    if (d.kind === 'Bottle') return 'Bottle' + (d.ml != null ? ' ' + d.ml + ' ml' : '');
    return (d.side || 'Breast') + (d.min != null ? ' ' + d.min + ' min' : '');
  }

  // Everything the Today list shows, newest first: nappies (a wee and a poo close together are one row) and feeds.
  function timelineRows(records) {
    var rows = nappyRows(records).map(function (r) {
      return { kind: 'nappy', t: r.t, label: nappyLabel(r), ids: r.ids };
    });
    records.forEach(function (r) {
      if (!r.deleted && r.type === 'feed') rows.push({ kind: 'feed', t: r.t, label: feedLabel(r), ids: [r.id] });
    });
    return rows.sort(function (a, b) { return b.t - a.t; });
  }

  // The newest live feed that matches `kind` ('Breast' or 'Bottle'), or null.
  function lastFeed(records, kind) {
    var best = null;
    records.forEach(function (r) {
      if (r.deleted || r.type !== 'feed' || (r.d || {}).kind !== kind) return;
      if (!best || r.t > best.t) best = r;
    });
    return best;
  }

  // ---- Editing (feature 011) ----
  // An edit keeps the id and moves updatedAt forward, so the existing merge rule (newest updatedAt wins) carries it.
  function revise(rec, changes, now, deviceId) {
    var out = {};
    for (var k in rec) out[k] = rec[k];
    ['t', 'd', 'note'].forEach(function (f) { if (f in changes) out[f] = changes[f]; });
    out.deviceId = deviceId || rec.deviceId;
    out.updatedAt = Math.max(now, rec.updatedAt + 1);
    return out;
  }

  // Put an earlier version back (Undo after an edit or a delete). `current` is what is stored now,
  // so the restored copy is newer than it and wins everywhere.
  function restore(original, current, now, deviceId) {
    var out = {};
    for (var k in original) out[k] = original[k];
    delete out.deleted;
    out.deviceId = deviceId || original.deviceId;
    out.updatedAt = Math.max(now, current.updatedAt + 1);
    return out;
  }

  // The entry's details with some fields replaced. Fields the app does not know about are kept.
  function withFields(d, fields) {
    var out = {};
    for (var k in (d || {})) out[k] = d[k];
    for (var f in fields) out[f] = fields[f];
    return out;
  }

  // True if two versions of an entry show the same thing (time, details, note).
  function sameContent(a, b) {
    return JSON.stringify([a.t, a.d || {}, a.note || '']) === JSON.stringify([b.t, b.d || {}, b.note || '']);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // 24-hour hh:mm, as a time field wants it.
  function hhmm(t) { var d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  // The moment inside the 6 am to 6 am day that contains `t` which shows hh:mm on the clock.
  // Editing a time never moves an entry to another day: 01:30 in a day that began at 6 am yesterday is after midnight.
  function timeInDay(t, text) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(text));
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    var start = new Date(dayWindow(t).from);
    var date = +m[1] < DAY_START_HOUR ? start.getDate() + 1 : start.getDate();
    return new Date(start.getFullYear(), start.getMonth(), date, +m[1], +m[2]).getTime();
  }

  function formatClock(t) {
    var d = new Date(t), h = d.getHours(), m = d.getMinutes();
    return (h % 12 === 0 ? 12 : h % 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm');
  }

  root.BABYLOG_RECORDS = {
    TYPES: TYPES, NAPPY_PAIR_MS: NAPPY_PAIR_MS,
    makeRecord: makeRecord, tombstone: tombstone, dayWindow: dayWindow,
    nappyRows: nappyRows, nappyLabel: nappyLabel, feedLabel: feedLabel, timelineRows: timelineRows, lastFeed: lastFeed,
    revise: revise, restore: restore, withFields: withFields, sameContent: sameContent, hhmm: hhmm, timeInDay: timeInDay,
    formatClock: formatClock
  };
})(typeof self !== 'undefined' ? self : this);
