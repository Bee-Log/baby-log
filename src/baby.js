// The baby on screen (feature 014). Every entry belongs to one baby, and the screens show only the current baby's entries.
// The choice is kept on this phone (meta 'currentBaby'), so the app opens on the same baby next time. It is not synced:
// each parent can look at a different baby. While no baby is chosen, app.js sends every screen to #babies.
(function (root) {
  var Pr = root.BABYLOG_PROFILE;
  var Sc = root.BABYLOG_SCHEMA;
  var store = root.BABYLOG_STORE;
  var KEY = 'currentBaby';

  var current = null;

  function id() { return current; }

  // Where the breast timer of the current baby is kept, so two babies can each have one running.
  function timerKey() { return 'breastTimer:' + current; }

  // Read the babies on this phone, and pick one without asking if that is clear. Resolves with the list of babies.
  function load() {
    return Promise.all([store.getMeta(KEY), store.all()]).then(function (r) {
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

  // Entries that belong to no baby (made before feature 014). They are not shown until a parent adds them to a baby.
  function unlinked() {
    return store.all().then(Sc.unlinked);
  }

  root.BABYLOG_BABY = { id: id, timerKey: timerKey, load: load, choose: choose, records: records, unlinked: unlinked };
})(typeof self !== 'undefined' ? self : this);
