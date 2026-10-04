// The baby on screen (feature 014). Every entry belongs to one baby, and the screens show only the current baby's entries.
// The choice is kept on this phone (meta 'currentBaby'), so the app opens on the same baby next time. It is not synced:
// each parent can look at a different baby. While no baby is chosen, app.js sends every screen to #babies.
(function (root) {
  var Pr = root.BABYLOG_PROFILE;
  var Sc = root.BABYLOG_SCHEMA;
  var store = root.BABYLOG_STORE;
  var KEY = 'currentBaby';
  var OLD_TIMER_KEY = 'breastTimer';     // a breast timer from before feature 014 (one for the whole phone)

  var current = null;

  function id() { return current; }

  // Where the breast timer of the current baby is kept, so two babies can each have one running.
  function timerKey() { return OLD_TIMER_KEY + ':' + current; }

  // Read the babies on this phone, and pick one without asking if that is clear. Resolves with the list of babies.
  function load() {
    return Promise.all([store.getMeta(KEY), store.all(), moveOldTimer()]).then(function (r) {
      var list = Pr.babies(r[1]);
      current = Pr.pick(list, r[0]);
      // Keep a baby picked because it was the only one, so a second baby arriving later does not make the app ask again.
      if (current && current !== r[0]) return store.setMeta(KEY, current).then(function () { return list; });
      return list;
    });
  }

  function choose(babyId) {
    current = babyId;
    return store.setMeta(KEY, babyId);
  }

  // The current baby's readable entries. Screens read entries through this.
  function records() {
    return store.all().then(function (all) { return Sc.forBaby(all, current); });
  }

  // A timer that was running before feature 014 belongs to the first baby, like the entries from that time.
  function moveOldTimer() {
    return store.getMeta(OLD_TIMER_KEY).then(function (timer) {
      if (!timer) return null;
      return store.setMeta(OLD_TIMER_KEY + ':' + Sc.LEGACY_BABY, timer).then(function () { return store.removeMeta(OLD_TIMER_KEY); });
    });
  }

  root.BABYLOG_BABY = { id: id, timerKey: timerKey, load: load, choose: choose, records: records };
})(typeof self !== 'undefined' ? self : this);
