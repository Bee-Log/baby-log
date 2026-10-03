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

  function formatClock(t) {
    var d = new Date(t), h = d.getHours(), m = d.getMinutes();
    return (h % 12 === 0 ? 12 : h % 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm');
  }

  root.BABYLOG_RECORDS = {
    TYPES: TYPES, NAPPY_PAIR_MS: NAPPY_PAIR_MS,
    makeRecord: makeRecord, tombstone: tombstone, dayWindow: dayWindow,
    nappyRows: nappyRows, nappyLabel: nappyLabel, formatClock: formatClock
  };
})(typeof self !== 'undefined' ? self : this);
