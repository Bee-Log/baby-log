// Growth (feature 010): weight and length compared with the WHO Child Growth Standards. No browser APIs here, so tests can load it.
// A measurement is one record of type 'growth': d.weight in grams and/or d.height (length) in cm, t = when it was measured.
// The WHO numbers are L, M and S for each day of age (who-data.js). A value at z-score z is M * (1 + L*S*z)^(1/L),
// and the z-score of a value y is ((y/M)^L - 1) / (L*S). See docs/research/who-growth-standards.md.
(function (root) {
  var WHO = root.BABYLOG_WHO_DATA;
  var DAY_MS = 86400000;
  var MONTH_DAYS = 30.4375;                       // a WHO month
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // The lines on the chart: the 3rd, 15th, 50th, 85th and 97th percentiles, as z-scores.
  var LINES = { p3: -1.880794, p15: -1.036433, p50: 0, p85: 1.036433, p97: 1.880794 };
  var FIELD = { weight: 'weight', length: 'height' };   // record field for each chart (the signoff names length d.height)

  function localDay(date) { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS; }

  // Age in whole days on the day of `t`, counted by the calendar from the date of birth ('YYYY-MM-DD').
  function ageDays(dob, t) {
    var p = String(dob).split('-');
    return localDay(new Date(t)) - localDay(new Date(+p[0], +p[1] - 1, +p[2]));
  }

  // WHO's L, M and S for this chart ('weight' or 'length'), sex ('girl' or 'boy') and age in days, or null outside birth to 2 years.
  function lms(chart, sex, day) {
    var t = WHO[chart] && WHO[chart][sex];
    if (!t || day < WHO.firstDay || day > WHO.lastDay || day % 1) return null;
    return { L: typeof t.L === 'number' ? t.L : t.L[day], M: t.M[day], S: t.S[day] };
  }

  function valueAt(p, z) {
    return p.L === 0 ? p.M * Math.exp(p.S * z) : p.M * Math.pow(1 + p.L * p.S * z, 1 / p.L);
  }
  function zScore(p, y) {
    return p.L === 0 ? Math.log(y / p.M) / p.S : (Math.pow(y / p.M, p.L) - 1) / (p.L * p.S);
  }

  // The share of babies below z, in percent (the normal distribution; Abramowitz and Stegun 7.1.26, good to 0.00002 %).
  function percentile(z) {
    var x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    var erf = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
    return 50 * (1 + (z < 0 ? -erf : erf));
  }

  // "About 75th percentile", rounded to 5, as in the design. Outside the 3rd to 97th: "Below 3rd percentile" or "Above 97th percentile".
  function percentileLabel(p) {
    if (p < 3) return 'Below 3rd percentile';
    if (p > 97) return 'Above 97th percentile';
    return 'About ' + Math.max(5, Math.min(95, Math.round(p / 5) * 5)) + 'th percentile';
  }

  // The live measurements that have this chart's value, oldest first: [{ id, t, value }]. value is kg or cm.
  function series(records, chart) {
    var field = FIELD[chart];
    return records.filter(function (r) { return !r.deleted && r.type === 'growth' && typeof (r.d || {})[field] === 'number'; })
      .sort(function (a, b) { return a.t - b.t; })
      .map(function (r) { return { id: r.id, t: r.t, value: chart === 'weight' ? r.d.weight / 1000 : r.d.height }; });
  }

  // All live measurements, newest first (the History list).
  function history(records) {
    return records.filter(function (r) { return !r.deleted && r.type === 'growth'; }).sort(function (a, b) { return b.t - a.t; });
  }

  function trim(n) { return String(Math.round(n * 10) / 10); }
  function formatWeight(grams) { return (grams / 1000).toFixed(2) + ' kg'; }
  function formatLength(cm) { return trim(cm) + ' cm'; }

  // What a card shows for one chart: the newest value, the change since the measurement before it, and the percentile.
  //   { value: '4.20 kg', change: '+250 g in 7 days', label: 'About 75th percentile' }
  function card(records, chart, profile) {
    var s = series(records, chart);
    if (!s.length) return { value: '—', change: 'Not measured yet', label: '' };
    var last = s[s.length - 1], before = s[s.length - 2];
    var value = chart === 'weight' ? formatWeight(last.value * 1000) : formatLength(last.value);
    var change = 'First measurement';
    if (before) {
      var days = ageDays(dateText(before.t), last.t);
      var diff = last.value - before.value;
      var amount = chart === 'weight' ? Math.round(diff * 1000) + ' g' : trim(diff) + ' cm';
      change = (diff >= 0 ? '+' : '') + amount + (days === 0 ? ' the same day' : ' in ' + days + (days === 1 ? ' day' : ' days'));
    }
    var p = lms(chart, profile.sex, ageDays(profile.dateOfBirth, last.t));
    return { value: value, change: change, label: p ? percentileLabel(percentile(zScore(p, last.value))) : '' };
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // 'YYYY-MM-DD' of t in local time (also the value of a date field).
  function dateText(t) { var d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  // "1 Oct", with the year when it is not this year.
  function shortDate(t, now) {
    var d = new Date(t);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== new Date(now).getFullYear() ? ' ' + d.getFullYear() : '');
  }

  // The x axis: from birth to a little past the baby's age today (at least 4 weeks, at most 2 years), with up to 5 labels.
  // Weeks up to 13 weeks, then months.
  function axis(endDay) {
    var end = Math.max(28, Math.min(WHO.lastDay, endDay)), ticks = [], k, step, last;
    if (end <= 91) {
      step = Math.ceil(Math.ceil(end / 7) / 4);
      last = Math.ceil(Math.ceil(end / 7) / step) * step;
      for (k = 0; k <= last; k += step) ticks.push({ day: 7 * k, label: k ? 'Wk ' + k : 'Birth' });
    } else {
      step = Math.ceil(Math.ceil(end / MONTH_DAYS) / 4);
      last = Math.ceil(Math.ceil(end / MONTH_DAYS) / step) * step;
      for (k = 0; k <= last; k += step) ticks.push({ day: Math.min(WHO.lastDay, Math.round(k * MONTH_DAYS)), label: k ? k + ' mo' : 'Birth' });
    }
    return { from: 0, to: ticks[ticks.length - 1].day, ticks: ticks };
  }

  // Everything the chart draws, in days and kg or cm: the percentile lines, the baby's points, and the ranges of both axes.
  function chartData(records, chart, profile, now) {
    var points = series(records, chart).map(function (m) { return { id: m.id, day: ageDays(profile.dateOfBirth, m.t), value: m.value }; })
      .filter(function (m) { return m.day >= 0 && m.day <= WHO.lastDay; });
    var lastDay = points.reduce(function (d, m) { return Math.max(d, m.day); }, ageDays(profile.dateOfBirth, now));
    var x = axis(lastDay);
    var step = Math.max(1, Math.round((x.to - x.from) / 60)), lines = {}, days = [];
    for (var d = x.from; d < x.to; d += step) days.push(d);
    days.push(x.to);
    Object.keys(LINES).forEach(function (key) {
      lines[key] = days.map(function (day) { return { day: day, value: valueAt(lms(chart, profile.sex, day), LINES[key]) }; });
    });
    points = points.filter(function (m) { return m.day <= x.to; });
    var values = lines.p3.concat(lines.p97, points).map(function (m) { return m.value; });
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values), pad = (hi - lo) * 0.04;
    return { x: x, y: { from: lo - pad, to: hi + pad }, lines: lines, points: points };
  }

  root.BABYLOG_GROWTH = {
    LINES: LINES, FIELD: FIELD, ageDays: ageDays, lms: lms, valueAt: valueAt, zScore: zScore, percentile: percentile, percentileLabel: percentileLabel,
    series: series, history: history, card: card, formatWeight: formatWeight, formatLength: formatLength, dateText: dateText, shortDate: shortDate,
    axis: axis, chartData: chartData
  };
})(typeof self !== 'undefined' ? self : this);
