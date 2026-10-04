// The CSV export. One row per entry, with readable columns. The first 22 column names are the ones from the first prototype.
// New columns are added at the end. No browser APIs here, so tests can load this file.
(function (root) {
  var Sc = root.BABYLOG_SCHEMA;
  var COLUMNS = ['date', 'time', 'start_iso', 'type', 'duration_min', 'pee_amount', 'poop_colour', 'poop_texture', 'poop_size',
    'feed_kind', 'feed_side', 'feed_milk', 'feed_ml', 'feed_minutes', 'sleep_place', 'cry_level', 'cry_helped',
    'weight_g', 'height_cm', 'head_cm', 'note', 'logged_by',
    'feed_left_min', 'feed_right_min', 'sleep_source', 'baby_id', 'baby'];

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function cell(v) {
    v = v == null ? '' : String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function row(rec, names) {
    var d = rec.d || {}, when = new Date(rec.t), minutes = '';
    if (rec.type === 'sleep' && rec.end != null) minutes = Math.round((rec.end - rec.t) / 60000);
    else if ((rec.type === 'feed' || rec.type === 'cry') && d.min != null) minutes = d.min;
    var helped = Array.isArray(d.helped) ? d.helped.join('; ') : '';
    return [
      when.getFullYear() + '-' + pad2(when.getMonth() + 1) + '-' + pad2(when.getDate()), pad2(when.getHours()) + ':' + pad2(when.getMinutes()),
      when.toISOString(), rec.type, minutes, d.amount, d.colour, d.texture, d.size,
      d.kind, d.side, d.milk, d.ml, rec.type === 'feed' ? d.min : '', d.place, d.level, helped,
      d.weight, d.height, d.head, rec.note, rec.by,
      d.leftMin, d.rightMin, d.source, Sc.babyOf(rec), names[Sc.babyOf(rec)]
    ];
  }

  // Every baby's entries, oldest first, with the baby's id and nickname. Entries that were removed, the profiles themselves,
  // and entries this version cannot read (schema.js) are left out.
  function toCsv(records) {
    var readable = records.filter(function (r) { return !r.deleted && !Sc.problem(r); });
    var names = {};
    readable.forEach(function (r) { if (r.type === 'profile') names[r.id] = (r.d || {}).nickname; });
    var rows = readable.filter(function (r) { return r.type !== 'profile'; })
      .sort(function (a, b) { return a.t - b.t; })
      .map(function (r) { return row(r, names).map(cell).join(','); });
    return [COLUMNS.join(',')].concat(rows).join('\n') + '\n';
  }

  root.BABYLOG_CSV = { COLUMNS: COLUMNS, toCsv: toCsv };
})(typeof self !== 'undefined' ? self : this);
