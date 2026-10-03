// Navigation: which tab or full screen a URL hash points to.
// Tabs (#today, #summary, #growth) and full screens (#feed) live in the hash, so one cached index.html
// serves everything offline and the phone's back button moves between them.
(function (root) {
  var TABS = ['today', 'summary', 'growth'];
  var SCREENS = ['feed'];       // full screens: no tab bar
  var DEFAULT_TAB = 'today';

  function tabFromHash(hash) {
    var key = String(hash || '').replace(/^#\/?/, '').toLowerCase();
    return TABS.indexOf(key) > -1 ? key : DEFAULT_TAB;
  }

  function screenFromHash(hash) {
    var key = String(hash || '').replace(/^#\/?/, '').toLowerCase();
    return SCREENS.indexOf(key) > -1 ? key : null;
  }

  root.BABYLOG_NAV = { TABS: TABS, SCREENS: SCREENS, DEFAULT_TAB: DEFAULT_TAB, tabFromHash: tabFromHash, screenFromHash: screenFromHash };
})(typeof self !== 'undefined' ? self : this);
