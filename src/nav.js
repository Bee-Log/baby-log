// Navigation: which tab or full screen a URL hash points to.
// Tabs (#today, #summary, #growth) and full screens (#feed, #edit/<ids>, #sleep, #profile) live in the hash, so one cached index.html
// serves everything offline and the phone's back button moves between them.
(function (root) {
  var TABS = ['today', 'summary', 'growth'];
  var SCREENS = ['feed', 'edit', 'sleep', 'profile', 'sync', 'babies']; // full screens: no tab bar. #edit/<ids> edits an entry (011), #sleep is the Sleep page (003), #profile/<id> is a baby profile (002), #sync is Sync and data, #babies chooses the baby (014)
  var DEFAULT_TAB = 'today';

  function tabFromHash(hash) {
    var key = parts(hash).name;
    return TABS.indexOf(key) > -1 ? key : DEFAULT_TAB;
  }

  function parts(hash) {
    var text = String(hash || '').replace(/^#\/?/, '');
    var slash = text.indexOf('/');
    return { name: (slash < 0 ? text : text.slice(0, slash)).toLowerCase(), arg: slash < 0 ? '' : text.slice(slash + 1) };
  }

  // 'feed', 'edit' or null. #edit needs something to edit: #edit/<ids>.
  function screenFromHash(hash) {
    var p = parts(hash);
    if (SCREENS.indexOf(p.name) < 0) return null;
    return p.name === 'edit' && !p.arg ? null : p.name;
  }

  // The part after the slash: the ids to edit, joined with +.
  function argFromHash(hash) { return parts(hash).arg; }

  root.BABYLOG_NAV = { TABS: TABS, SCREENS: SCREENS, DEFAULT_TAB: DEFAULT_TAB, tabFromHash: tabFromHash, screenFromHash: screenFromHash, argFromHash: argFromHash };
})(typeof self !== 'undefined' ? self : this);
