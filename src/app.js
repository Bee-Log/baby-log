(function () {
  var cfg = self.BABYLOG_CONFIG;
  var nav = self.BABYLOG_NAV;
  var isTest = cfg.env === 'test';

  if (isTest) {
    document.getElementById('test-banner').hidden = false;
    document.body.classList.add('is-test');
  }
  document.getElementById('version').textContent =
    '· ' + (isTest ? 'TEST · ' : '') + 'version ' + cfg.version;

  // ---- Tabs ----
  function showTab() {
    var tab = nav.tabFromHash(location.hash);
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].hidden = views[i].getAttribute('data-tab') !== tab;
    var links = document.querySelectorAll('.tabbar a');
    for (var j = 0; j < links.length; j++) {
      if (links[j].getAttribute('data-tab') === tab) links[j].setAttribute('aria-current', 'page');
      else links[j].removeAttribute('aria-current');
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', showTab);
  showTab();

  // ---- Offline support ----
  var status = document.getElementById('status');
  if (!('serviceWorker' in navigator)) {
    status.textContent = 'This browser cannot work offline.';
    return;
  }
  // Scope './' keeps the test and live service workers apart (/baby-log/test/ vs /baby-log/).
  navigator.serviceWorker.register('sw.js', { scope: './' }).then(function () {
    return navigator.serviceWorker.ready;
  }).then(function () {
    status.textContent = 'Ready to work offline.';
  }).catch(function (err) {
    status.textContent = 'Offline support failed to start.';
    console.error('[baby-log] service worker', err);
  });
})();
