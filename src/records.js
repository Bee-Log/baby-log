// Records: the portable entry format from app-rules.md, plus small pure helpers.
// No browser APIs here, so tests can load this file directly.
(function (root) {
  var TYPES = ['feed', 'sleep', 'pee', 'poop', 'cry', 'growth', 'profile'];
  var VERSION = 2;                         // the record format version (schema.js). 2 added babyId (feature 014)
  var DAY_START_HOUR = 6;                  // "Today" runs 6 am to 6 am (feature 008)
  var NAPPY_PAIR_MS = 2 * 60 * 1000;       // a wee and a poo this close are one nappy

  function makeRecord(o) {
    if (TYPES.indexOf(o.type) < 0) throw new Error('Unknown record type: ' + o.type);
    if (!o.id) throw new Error('Record needs an id');
    if (!o.deviceId) throw new Error('Record needs a deviceId');
    if (!o.babyId) throw new Error('Record needs a babyId');
    if (!isFinite(o.t) || !isFinite(o.now)) throw new Error('Record needs t and now in ms');
    return {
      v: VERSION,
      id: String(o.id),
      type: o.type,
      babyId: String(o.babyId),
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

  // "Left 14 min", "Left 8 · Right 12 min", "Bottle 90 ml". Missing details are left out.
  function feedLabel(rec) {
    var d = rec.d || {};
    if (d.kind === 'Bottle') return 'Bottle' + (d.ml != null ? ' ' + d.ml + ' ml' : '');
    // Both sides with time: "Left 8 · Right 12 min". Otherwise "Left 14 min" (also for entries saved before minutes per side).
    if (typeof d.leftMin === 'number' && typeof d.rightMin === 'number' && d.leftMin > 0 && d.rightMin > 0) {
      return 'Left ' + d.leftMin + ' · Right ' + d.rightMin + ' min';
    }
    return (d.side || 'Breast') + (d.min != null ? ' ' + d.min + ' min' : '');
  }

  // Everything the Today list shows, newest first: nappies (a wee and a poo close together are one row) and feeds.
  function timelineRows(records) {
    var rows = nappyRows(records).map(function (r) {
      return { kind: 'nappy', title: 'Nappy', t: r.t, label: nappyLabel(r), ids: r.ids };
    });
    records.forEach(function (r) {
      if (!r.deleted && r.type === 'feed') rows.push({ kind: 'feed', title: 'Feed', t: r.t, label: feedLabel(r), ids: [r.id] });
    });
    return rows.sort(function (a, b) { return b.t - a.t; });
  }

  // The newest live feed of any kind, or null (the "Last feed" card on Today).
  function latestFeed(records) {
    var best = null;
    records.forEach(function (r) {
      if (!r.deleted && r.type === 'feed' && (!best || r.t > best.t)) best = r;
    });
    return best;
  }

  // "Just now", "45m ago", "2h 15m ago", "1d 3h ago". Whole minutes, rounded down.
  function agoText(ms) {
    var min = Math.max(0, Math.floor(ms / 60000));
    if (min < 1) return 'Just now';
    var d = Math.floor(min / 1440), h = Math.floor(min / 60) % 24, m = min % 60;
    if (d > 0) return d + 'd ' + h + 'h ago';
    return (h > 0 ? h + 'h ' : '') + m + 'm ago';
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

  // The merge rule (ADR-001): when two versions of an entry meet, the one with the larger updatedAt wins.
  // If updatedAt is equal, the one whose deviceId sorts higher wins, so every phone reaches the same result.
  function isNewer(a, b) {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt;
    return String(a.deviceId) > String(b.deviceId);
  }

  // ---- Editing (feature 011) ----
  // An edit keeps the id and moves updatedAt forward, so the existing merge rule (newest updatedAt wins) carries it.
  // (There is no Undo for now. If it returns, it writes the earlier values back with an even newer updatedAt.)
  function revise(rec, changes, now, deviceId) {
    var out = {};
    for (var k in rec) out[k] = rec[k];
    ['t', 'end', 'd', 'note'].forEach(function (f) { if (f in changes) out[f] = changes[f]; });
    out.deviceId = deviceId || rec.deviceId;
    out.updatedAt = Math.max(now, rec.updatedAt + 1);
    return out;
  }

  // The entry's details with some fields replaced. Fields the app does not know about are kept.
  function withFields(d, fields, more) {
    var out = {};
    for (var k in (d || {})) out[k] = d[k];
    [fields, more].forEach(function (set) { for (var f in (set || {})) out[f] = set[f]; });
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

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // "Thu 1 Oct"
  function dateLabel(t) {
    var d = new Date(t);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  // "Today" or "Yesterday" by the calendar (midnight to midnight), else the date.
  function dayName(t, now) {
    var d = new Date(t), n = new Date(now);
    var days = Math.round((Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : dateLabel(t);
  }

  function formatClock(t) {
    var d = new Date(t), h = d.getHours(), m = d.getMinutes();
    return (h % 12 === 0 ? 12 : h % 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm');
  }

  root.BABYLOG_RECORDS = {
    TYPES: TYPES, VERSION: VERSION, NAPPY_PAIR_MS: NAPPY_PAIR_MS,
    makeRecord: makeRecord, isNewer: isNewer, tombstone: tombstone, dayWindow: dayWindow,
    nappyRows: nappyRows, nappyLabel: nappyLabel, feedLabel: feedLabel, timelineRows: timelineRows, lastFeed: lastFeed, latestFeed: latestFeed, agoText: agoText,
    revise: revise, withFields: withFields, sameContent: sameContent, hhmm: hhmm, timeInDay: timeInDay,
    formatClock: formatClock, dateLabel: dateLabel, dayName: dayName
  };
})(typeof self !== 'undefined' ? self : this);
