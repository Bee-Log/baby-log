// The baby profile (feature 002): who the baby is, so other screens use the right name, age and WHO tables.
// It is stored as one record of type 'profile' with the fixed id 'profile', so it syncs and merges like every other entry
// (the newest updatedAt wins). No browser APIs here, so tests can load this file.
//   d: { nickname, dateOfBirth: 'YYYY-MM-DD', sex: 'girl' | 'boy', photo: 'data:image/jpeg;base64,...' or '' }
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var PROFILE_ID = 'profile';
  var MAX_NAME = 20;
  var DAY_MS = 86400000;

  // The profile record, or null when none is saved yet.
  function current(records) {
    var found = null;
    records.forEach(function (r) { if (r.type === 'profile' && !r.deleted && r.id === PROFILE_ID) found = r; });
    return found;
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

  // The record to save. A new profile gets a new record; changing it later keeps the id and moves updatedAt forward.
  function toRecord(existing, fields, now, deviceId) {
    var d = {
      nickname: fields.nickname.trim().slice(0, MAX_NAME),
      dateOfBirth: fields.dateOfBirth,
      sex: fields.sex,
      photo: fields.photo || ''
    };
    if (existing) return R.revise(existing, { d: R.withFields(existing.d, d) }, now, deviceId);
    return R.makeRecord({ id: PROFILE_ID, type: 'profile', t: now, now: now, deviceId: deviceId, d: d });
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
    PROFILE_ID: PROFILE_ID, MAX_NAME: MAX_NAME, PLACEHOLDER_NAME: PLACEHOLDER_NAME,
    current: current, details: details, isComplete: isComplete, toRecord: toRecord, ageText: ageText, displayName: displayName
  };
})(typeof self !== 'undefined' ? self : this);
