// The small icons used in lists (Today and the Sleep page). Fixed markup with no user data, so it is safe to put in innerHTML.
(function (root) {
  function icon(paths) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  root.BABYLOG_ICONS = {
    nappy: icon('<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"></path>'),
    feed: icon('<path d="M9 2h6"></path><path d="M10 2v3L8 8v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8l-2-3V2"></path>'),
    sleep: icon('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>')
  };
})(typeof self !== 'undefined' ? self : this);
