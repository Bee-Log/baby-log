// The baby profile (feature 002) and the list of babies (feature 014): who each baby is, so other screens use the right
// name, age and WHO tables. Each baby is one record of type 'profile'. Its id is the baby's id, and every entry of that
// baby carries it as babyId (schema.js). It syncs and merges like every other entry (the newest updatedAt wins).
// The first profile (feature 002) has the id 'profile'. A baby added later gets a random id.
// No browser APIs here, so tests can load this file.
//   d: { nickname, dateOfBirth: 'YYYY-MM-DD', sex: 'girl' | 'boy', photo: 'data:image/jpeg;base64,...' or '' }
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var Sc = root.BABYLOG_SCHEMA;
  var MAX_NAME = 20;
  var DAY_MS = 86400000;

  // The profile record of this baby, or null when none is saved yet.
  function current(records, babyId) {
    var found = null;
    records.forEach(function (r) { if (r.type === 'profile' && !r.deleted && r.id === babyId && !Sc.problem(r)) found = r; });
    return found;
  }

  // The babies on this phone: [{ id, profile, entries }], oldest profile first (by name when added at the same time).
  // A baby is known from its profile, or from entries that name a baby whose profile is not here yet (profile: null),
  // for example before the other phone's profile has synced. Such a baby is listed last, so its details can be added.
  // Entries that name no baby make no baby (schema.js unlinked).
  function babies(records) {
    var byId = {}, list = [];
    records.forEach(function (r) {
      if (r.deleted || Sc.problem(r)) return;
      var id = Sc.babyOf(r);
      if (id === null) return;
      var b = byId[id];
      if (!b) { b = byId[id] = { id: id, profile: null, entries: 0 }; list.push(b); }
      if (r.type === 'profile') b.profile = r;
      else b.entries++;
    });
    return list.sort(function (a, b) {
      if (!a.profile !== !b.profile) return a.profile ? -1 : 1;
      if (!a.profile) return 0;
      return a.profile.t - b.profile.t || details(a.profile).nickname.localeCompare(details(b.profile).nickname);
    });
  }

  // The baby to open without asking: the one chosen last time on this phone, or else the only baby. null means ask.
  // A baby without a profile is never opened like this: its details are added first.
  function pick(list, savedId) {
    var named = list.filter(function (b) { return b.profile; });
    if (named.some(function (b) { return b.id === savedId; })) return savedId;
    return list.length === 1 && named.length === 1 ? named[0].id : null;
  }

  // The fields of a profile record, with safe defaults (a record from another phone may lack some).
  function details(rec) {
    var d = (rec && rec.d) || {};
    return {
      nickname: typeof d.nickname === 'string' ? d.nickname : '',
      dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(d.dateOfBirth) ? d.dateOfBirth : '',
      sex: d.sex === 'girl' || d.sex === 'boy' ? d.sex : '',
      photo: typeof d.photo === 'string' ? d.photo : ''
    };
  }

  // True when the three required fields are set: nickname, date of birth, sex.
  function isComplete(fields) {
    return fields.nickname.trim() !== '' && fields.dateOfBirth !== '' && fields.sex !== '';
  }

  // The record to save. A new profile gets a new record with the baby's id; changing it later keeps the id and moves updatedAt forward.
  function toRecord(existing, fields, now, deviceId, babyId) {
    var d = {
      nickname: fields.nickname.trim().slice(0, MAX_NAME),
      dateOfBirth: fields.dateOfBirth,
      sex: fields.sex,
      photo: fields.photo || ''
    };
    if (existing) return R.revise(existing, { d: R.withFields(existing.d, d) }, now, deviceId);
    return R.makeRecord({ id: babyId, babyId: babyId, type: 'profile', t: now, now: now, deviceId: deviceId, d: d });
  }

  function localDate(dob) {
    var p = dob.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  // "Born today", "5 days old", "3 weeks old", "4 months old", "1 year old". Counted by calendar days.
  function ageText(dob, now) {
    if (!dob) return '';
    var born = localDate(dob), today = new Date(now);
    var days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(born.getFullYear(), born.getMonth(), born.getDate())) / DAY_MS);
    if (days < 0) return 'Not born yet';
    if (days === 0) return 'Born today';
    if (days === 1) return '1 day old';
    if (days < 14) return days + ' days old';
    if (days < 56) return Math.floor(days / 7) + ' weeks old';
    var months = (today.getFullYear() - born.getFullYear()) * 12 + today.getMonth() - born.getMonth() - (today.getDate() < born.getDate() ? 1 : 0);
    if (months < 24) return months + (months === 1 ? ' month old' : ' months old');
    var years = Math.floor(months / 12);
    return years + (years === 1 ? ' year old' : ' years old');
  }

  // What the Today header and the profile screen show for the name when none is saved.
  var PLACEHOLDER_NAME = '[Nickname]';
  function displayName(nickname) { return nickname.trim() === '' ? PLACEHOLDER_NAME : nickname.trim(); }

  root.BABYLOG_PROFILE = {
    MAX_NAME: MAX_NAME, PLACEHOLDER_NAME: PLACEHOLDER_NAME,
    current: current, babies: babies, pick: pick, details: details, isComplete: isComplete, toRecord: toRecord, ageText: ageText, displayName: displayName
  };
})(typeof self !== 'undefined' ? self : this);
