// What a readable entry looks like (the record format in app-rules.md), and which baby it belongs to (feature 014).
// No browser APIs here, so tests can load this file.
//
// Version 2 added two fields to every entry:
//   v: 2         the format version. An entry without v is version 1 (made before feature 014).
//   babyId: '…'  the baby it belongs to. A baby's id is the id of its profile entry.
// An entry belongs to a baby only through its own babyId (owner decision, 5 October 2026). Version 1 entries have none,
// so they belong to no baby and are not shown under any baby. A parent can add them to a baby, or delete them, on the
// Babies screen ("unlinked" entries). A profile belongs to itself, so the first profile (id 'profile', version 1) still works.
//
// An entry that is not readable, or was made by a newer version of the app, is kept and synced as it is. It is only not shown.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var VERSION = R.VERSION;

  function isText(v) { return typeof v === 'string' && v !== ''; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // The baby an entry belongs to, or null when it has none. A profile is its baby.
  function babyOf(rec) {
    if (rec.type === 'profile') return rec.id;
    return isText(rec.babyId) ? rec.babyId : null;
  }

  // Why an entry cannot be shown, or null when it can.
  //   'newer'    made by a newer version of the app. Updating this app shows it.
  //   'invalid'  a field is missing or holds the wrong kind of value.
  // Fields this app does not know are allowed (and kept), so a later version can add fields.
  function problem(rec) {
    if (!isObject(rec)) return 'invalid';
    if (isNum(rec.v) && rec.v > VERSION) return 'newer';
    var v = rec.v == null ? 1 : rec.v;
    var ok = (v === 1 || v === VERSION) &&
      isText(rec.id) && R.TYPES.indexOf(rec.type) > -1 && isNum(rec.t) && isNum(rec.updatedAt) && isText(rec.deviceId) &&
      (rec.end == null || isNum(rec.end)) &&
      (rec.d == null || isObject(rec.d)) &&
      (rec.note == null || typeof rec.note === 'string') &&
      (rec.by == null || typeof rec.by === 'string') &&
      (rec.deleted == null || typeof rec.deleted === 'boolean') &&
      (rec.babyId === undefined ? v === 1 : isText(rec.babyId)) &&     // version 2 entries must name their baby
      (rec.type !== 'profile' || rec.babyId === undefined || rec.babyId === rec.id);   // a profile belongs to its own baby
    return ok ? null : 'invalid';
  }

  // The readable entries of one baby (removed ones included: screens skip those themselves).
  function forBaby(records, babyId) {
    return records.filter(function (r) { return !problem(r) && babyOf(r) === babyId; });
  }

  // Readable live entries that belong to no baby (made before feature 014), oldest first.
  function unlinked(records) {
    return records.filter(function (r) { return !r.deleted && r.type !== 'profile' && !problem(r) && babyOf(r) === null; })
      .sort(function (a, b) { return a.t - b.t; });
  }

  // How many entries cannot be shown, by reason: { newer, invalid }.
  function unreadable(records) {
    var out = { newer: 0, invalid: 0 };
    records.forEach(function (r) { var p = problem(r); if (p) out[p]++; });
    return out;
  }

  root.BABYLOG_SCHEMA = { VERSION: VERSION, babyOf: babyOf, problem: problem, forBaby: forBaby, unlinked: unlinked, unreadable: unreadable };
})(typeof self !== 'undefined' ? self : this);
