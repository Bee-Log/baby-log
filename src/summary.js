// The numbers for the daily summary (feature 009). No browser APIs here, so tests can load this file.
// A "day" is 6 am to 6 am, like Today (records.js dayWindow). `offset` counts days back: 0 is today, 1 is yesterday.
(function (root) {
  var R = root.BABYLOG_RECORDS;

  // The 6 am to 6 am day `offset` days before the one that holds `now`.
  function dayWindow(now, offset) {
    var w = R.dayWindow(now), d = new Date(w.from);
    return {
      from: new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset, 6).getTime(),
      to: new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset + 1, 6).getTime()
    };
  }

  function live(records, type) {
    return records.filter(function (r) { return !r.deleted && r.type === type; });
  }

  // Sleep is counted by the minutes inside the day. A sleep over the 6 am line is split between the two days,
  // so the days add up. A sleep that is still running counts until `now`.
  function sleepIn(records, win, now) {
    var total = 0, longest = 0;
    live(records, 'sleep').forEach(function (r) {
      var start = Math.max(r.t, win.from), end = Math.min(r.end == null ? now : r.end, win.to);
      if (end <= start) return;
      total += end - start;
      longest = Math.max(longest, end - start);
    });
    return { ms: total, longestMs: longest };
  }

  // The average time from the start of one feed to the start of the next, within the day. Needs two feeds.
  function averageGap(feedTimes) {
    if (feedTimes.length < 2) return null;
    var sorted = feedTimes.slice().sort(function (a, b) { return a - b; });
    return (sorted[sorted.length - 1] - sorted[0]) / (sorted.length - 1);
  }

  // Everything one day shows.
  function day(records, win, now) {
    var inDay = records.filter(function (r) { return r.t >= win.from && r.t < win.to; });
    var feeds = live(inDay, 'feed');
    var bottles = feeds.filter(function (r) { return (r.d || {}).kind === 'Bottle'; });
    var nappies = R.nappyRows(inDay);        // a wee and a poo close together are one nappy
    return {
      feeds: {
        count: feeds.length,
        bottle: bottles.length,
        breast: feeds.length - bottles.length,
        ml: bottles.reduce(function (sum, r) { return sum + (typeof (r.d || {}).ml === 'number' ? r.d.ml : 0); }, 0)
      },
      nappies: {
        count: nappies.length,
        wee: nappies.filter(function (n) { return n.wee; }).length,
        poo: nappies.filter(function (n) { return n.poo; }).length
      },
      sleep: sleepIn(records, win, now),
      averageGapMs: averageGap(feeds.map(function (r) { return r.t; }))
    };
  }

  // Feeds per day for the `count` days ending at `offset` days back, oldest first (for the bar chart).
  function feedsPerDay(records, now, offset, count) {
    var out = [];
    for (var k = offset + count - 1; k >= offset; k--) {
      var win = dayWindow(now, k);
      out.push({
        offset: k, from: win.from,
        count: live(records, 'feed').filter(function (r) { return r.t >= win.from && r.t < win.to; }).length
      });
    }
    return out;
  }

  // The oldest entry decides how far back the arrow can go. Returns the number of days back (0 when there is no entry).
  function daysBack(records, now) {
    var oldest = records.reduce(function (m, r) { return r.type === 'profile' ? m : Math.min(m, r.t); }, now);
    var k = 0;
    while (dayWindow(now, k).from > oldest) k++;
    return k;
  }

  // "Today", "Yesterday", or "Wed 30 Sep".
  function title(win, now) {
    var w0 = dayWindow(now, 0), w1 = dayWindow(now, 1);
    if (win.from === w0.from) return 'Today';
    if (win.from === w1.from) return 'Yesterday';
    return R.dateLabel(win.from);
  }

  root.BABYLOG_SUMMARY = { dayWindow: dayWindow, day: day, feedsPerDay: feedsPerDay, daysBack: daysBack, title: title };
})(typeof self !== 'undefined' ? self : this);
