// Sync between phones (ADR-001). No browser APIs here, so tests can load this file.
//
// Each phone writes ONE file of its own, `<root>/devices/<deviceId>.jsonl` (JSON Lines: one full record per line),
// and only ever that file. Every phone reads all the files and merges them into its own store with the merge rule
// (records.js isNewer). Nothing here knows about Google: it talks to a "backend" with three functions:
//
//   backend.list()            -> Promise of [{ name, version }]   (version changes whenever the file changes)
//   backend.read(name)        -> Promise of the file's text, or null when there is no such file
//   backend.write(name, text) -> Promise of the new version
//
// A backend rejects with an error whose `code` is 'auth' when sign-in is needed, or 'offline' when there is no network.
// The store it uses needs: all(), mergeIn(records), getMeta(key), setMeta(key, value).
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var FILE_VERSIONS = 'syncFileVersions';   // { fileName: version } of the files already merged

  // ---- Files ----
  function ownFileName(rootName, deviceId) { return rootName + '/devices/' + deviceId + '.jsonl'; }
  function isDeviceFile(rootName, name) { return name.indexOf(rootName + '/devices/') === 0 && /\.jsonl$/.test(name); }

  function toJsonl(records) {
    return records.map(function (r) { return JSON.stringify(r); }).join('\n') + (records.length ? '\n' : '');
  }

  // Lines that are blank, not JSON, or without an id are skipped, so one bad line never blocks the rest.
  function parseJsonl(text) {
    var out = [];
    String(text || '').split('\n').forEach(function (line) {
      if (!line.trim()) return;
      try {
        var rec = JSON.parse(line);
        if (rec && typeof rec.id === 'string' && typeof rec.updatedAt === 'number') out.push(rec);
      } catch (err) { /* skip this line */ }
    });
    return out;
  }

  // One entry per id: the newest. This is also how a file is compacted (a tombstone stays; it is the newest line).
  function newestById(records) {
    var byId = {}, order = [];
    records.forEach(function (rec) {
      var have = byId[rec.id];
      if (!have) order.push(rec.id);
      if (!have || R.isNewer(rec, have)) byId[rec.id] = rec;
    });
    return order.map(function (id) { return byId[id]; });
  }

  // ---- The engine ----
  // options: { backend, store, root: 'baby-log' | 'baby-log-test', deviceId }
  function create(options) {
    var backend = options.backend, store = options.store;
    var ownName = ownFileName(options.root, options.deviceId);

    // Send our own new and changed entries: the ones that are not in our file yet, or are newer than the copy there.
    // Our file is rewritten with one line per entry (compacted). Only this phone writes this file, so nothing can be lost.
    function push() {
      return Promise.all([store.all(), backend.read(ownName)]).then(function (r) {
        var remote = newestById(parseJsonl(r[1]));
        var inFile = {};
        remote.forEach(function (rec) { inFile[rec.id] = rec; });
        var mine = r[0].filter(function (rec) {
          return rec.deviceId === options.deviceId && (!inFile[rec.id] || R.isNewer(rec, inFile[rec.id]));
        });
        if (!mine.length) return { pushed: 0 };
        return backend.write(ownName, toJsonl(newestById(remote.concat(mine)))).then(function (version) {
          return store.getMeta(FILE_VERSIONS).then(function (versions) {
            versions = versions || {};
            versions[ownName] = version;       // we wrote it, so there is nothing new to read in it
            return store.setMeta(FILE_VERSIONS, versions);
          });
        }).then(function () { return { pushed: mine.length }; });
      });
    }

    // Read every phone's file that changed since we last read it, and merge it in.
    // A new or reset phone has read nothing yet, so it reads all of them. That is the restore.
    function pull() {
      return Promise.all([backend.list(), store.getMeta(FILE_VERSIONS)]).then(function (r) {
        var versions = r[1] || {};
        var todo = r[0].filter(function (f) { return isDeviceFile(options.root, f.name) && versions[f.name] !== f.version; });
        var merged = 0;
        return todo.reduce(function (chain, file) {
          return chain.then(function () {
            return backend.read(file.name).then(function (text) {
              return store.mergeIn(parseJsonl(text));
            }).then(function (n) {
              merged += n;
              versions[file.name] = file.version;
              return store.setMeta(FILE_VERSIONS, versions);   // after each file, so a failure later keeps this progress
            });
          });
        }, Promise.resolve()).then(function () { return { files: todo.length, merged: merged }; });
      });
    }

    function sync() {
      return push().then(function (p) {
        return pull().then(function (q) { return { pushed: p.pushed, files: q.files, merged: q.merged }; });
      });
    }

    return { push: push, pull: pull, sync: sync, ownFileName: ownName };
  }

  root.BABYLOG_SYNC = {
    ownFileName: ownFileName, isDeviceFile: isDeviceFile, toJsonl: toJsonl, parseJsonl: parseJsonl, newestById: newestById, create: create
  };
})(typeof self !== 'undefined' ? self : this);
