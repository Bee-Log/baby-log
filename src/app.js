(function () {
  var cfg = self.BABYLOG_CONFIG;
  var isTest = cfg.env === 'test';

  if (isTest) {
    document.getElementById('test-banner').hidden = false;
    document.body.classList.add('is-test');
  }
  document.getElementById('version').textContent =
    (isTest ? 'TEST · ' : '') + 'version ' + cfg.version;

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
