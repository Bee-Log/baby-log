// The only place that touches stored data (IndexedDB, on this phone).
// TEST and LIVE share one browser origin, so this module protects real data in code
// (app-rules.md, "Shared origin"): one fixed database name per build, and it never lists,
// opens or deletes any other database.
(function (root) {
  var cfg = root.BABYLOG_CONFIG;
  var VERSION = 1;

  function dbNameFor(c) {
    var name = c.storagePrefix + 'baby-log';
    var expected = c.env === 'test' ? 'test-baby-log' : 'baby-log';
    if (name !== expected) throw new Error('Refusing storage name "' + name + '" for the ' + c.env + ' build');
    return name;
  }

  var dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var req = indexedDB.open(dbNameFor(cfg), VERSION);
        req.onupgradeneeded = function () {
          var d = req.result;
          // Indexes as in docs/adr/ADR-001 (section 2), so later features can query without a migration.
          if (!d.objectStoreNames.contains('records')) {
            var records = d.createObjectStore('records', { keyPath: 'id' });
            records.createIndex('type', 'type');
            records.createIndex('t', 't');
            records.createIndex('type_t', ['type', 't']);
            records.createIndex('updatedAt', 'updatedAt');
          }
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
        req.onblocked = function () { reject(new Error('Storage is busy in another tab. Close it and try again.')); };
      });
      dbPromise.catch(function () { dbPromise = null; }); // allow a retry after a failure
    }
    return dbPromise;
  }

  function run(storeName, mode, work) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(storeName, mode);
        var result;
        work(tx.objectStore(storeName), function (v) { result = v; });
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Save was cancelled')); };
      });
    });
  }

  function put(record) {
    return run('records', 'readwrite', function (s) { s.put(record); }).then(function () { keep(); return record; });
  }

  // Save a record and clear a draft in ONE transaction: both happen or neither does.
  // (A breast feed is saved and its running timer is removed together.)
  function putClearingMeta(record, metaKey) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction(['records', 'meta'], 'readwrite');
        tx.objectStore('records').put(record);
        tx.objectStore('meta').delete(metaKey);
        tx.oncomplete = function () { keep(); resolve(record); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Save was cancelled')); };
      });
    });
  }

  function all() {
    return run('records', 'readonly', function (s, done) {
      var req = s.getAll();
      req.onsuccess = function () { done(req.result); };
    });
  }

  // One id per phone, made on first use and kept with the data.
  var deviceIdPromise = null;
  function deviceId() {
    if (!deviceIdPromise) {
      deviceIdPromise = run('meta', 'readwrite', function (s, done) {
        var req = s.get('deviceId');
        req.onsuccess = function () {
          if (req.result) { done(req.result); return; }
          var id = root.crypto.randomUUID();
          s.put(id, 'deviceId');
          done(id);
        };
      });
      deviceIdPromise.catch(function () { deviceIdPromise = null; });
    }
    return deviceIdPromise;
  }

  // Small values that are not records, such as a breast timer that is still running.
  function getMeta(key) {
    return run('meta', 'readonly', function (s, done) {
      var req = s.get(key);
      req.onsuccess = function () { done(req.result === undefined ? null : req.result); };
    });
  }
  function setMeta(key, value) {
    return run('meta', 'readwrite', function (s) { s.put(value, key); });
  }
  function removeMeta(key) {
    return run('meta', 'readwrite', function (s) { s.delete(key); });
  }

  // Ask the browser not to clear this data when the phone runs low on space. Asked once.
  var askedToKeep = false;
  function keep() {
    if (askedToKeep || !root.navigator || !navigator.storage || !navigator.storage.persist) return;
    askedToKeep = true;
    navigator.storage.persist().catch(function () { /* the browser decides; data still saves */ });
  }

  root.BABYLOG_STORE = { dbNameFor: dbNameFor, put: put, putClearingMeta: putClearingMeta, all: all, deviceId: deviceId, getMeta: getMeta, setMeta: setMeta, removeMeta: removeMeta };
})(typeof self !== 'undefined' ? self : this);
