// Bottom navigation: which tab a URL hash points to.
// Tabs live in the hash (#today, #summary, #growth), so one cached index.html serves every tab offline
// and the phone's back button moves between tabs.
(function (root) {
  var TABS = ['today', 'summary', 'growth'];
  var DEFAULT_TAB = 'today';

  function tabFromHash(hash) {
    var key = String(hash || '').replace(/^#\/?/, '').toLowerCase();
    return TABS.indexOf(key) > -1 ? key : DEFAULT_TAB;
  }

  root.BABYLOG_NAV = { TABS: TABS, DEFAULT_TAB: DEFAULT_TAB, tabFromHash: tabFromHash };
})(typeof self !== 'undefined' ? self : this);
