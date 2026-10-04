// What a readable entry looks like (the record format in app-rules.md), and which baby it belongs to (feature 014).
// No browser APIs here, so tests can load this file.
//
// Version 2 added two fields to every entry:
//   v: 2         the format version. An entry without v is version 1 (made before feature 014).
//   babyId: '…'  the baby it belongs to. A baby's id is the id of its profile entry.
// Version 1 entries have no babyId. They belong to the baby with the id 'profile' (the one profile of feature 002).
// Old entries are never rewritten for this: they are read with that rule.
//
// An entry that is not readable, or was made by a newer version of the app, is kept and synced as it is. It is only not shown.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var VERSION = R.VERSION;
  var LEGACY_BABY = 'profile';

  function isText(v) { return typeof v === 'string' && v !== ''; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // The baby an entry belongs to.
  function babyOf(rec) {
    return isText(rec.babyId) ? rec.babyId : LEGACY_BABY;
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
      (rec.type !== 'profile' || babyOf(rec) === rec.id);              // a profile belongs to its own baby
    return ok ? null : 'invalid';
  }

  // The readable entries of one baby (removed ones included: screens skip those themselves).
  function forBaby(records, babyId) {
    return records.filter(function (r) { return !problem(r) && babyOf(r) === babyId; });
  }

  // How many entries cannot be shown, by reason: { newer, invalid }.
  function unreadable(records) {
    var out = { newer: 0, invalid: 0 };
    records.forEach(function (r) { var p = problem(r); if (p) out[p]++; });
    return out;
  }

  root.BABYLOG_SCHEMA = { VERSION: VERSION, LEGACY_BABY: LEGACY_BABY, babyOf: babyOf, problem: problem, forBaby: forBaby, unreadable: unreadable };
})(typeof self !== 'undefined' ? self : this);
