// The Google Drive backend for sync.js (ADR-001): files in the hidden app-data folder (scope drive.appdata).
// options: { getToken: () => Promise of an access token, fetch: the fetch function }
// A token that Google refuses (401) rejects with code 'auth'. A lost network rejects with code 'offline'.
(function (root) {
  var API = 'https://www.googleapis.com/drive/v3';
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  var SPACE = 'appDataFolder';

  function fail(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  function create(options) {
    function request(url, init) {
      return options.getToken().then(function (token) {
        init = init || {};
        init.headers = Object.assign({ Authorization: 'Bearer ' + token }, init.headers || {});
        return options.fetch(url, init).catch(function () { throw fail('offline', 'No network'); });
      }).then(function (res) {
        if (res.status === 401) throw fail('auth', 'Sign-in needed');
        if (!res.ok) throw fail('drive', 'Google Drive answered ' + res.status);
        return res;
      });
    }

    // All files in the app-data folder: [{ id, name, version }]. Follows the pages, if there are many.
    function files() {
      var found = [];
      function page(token) {
        var url = API + '/files?spaces=' + SPACE + '&pageSize=100&fields=' + encodeURIComponent('nextPageToken,files(id,name,version)') +
          (token ? '&pageToken=' + encodeURIComponent(token) : '');
        return request(url).then(function (res) { return res.json(); }).then(function (body) {
          found = found.concat(body.files || []);
          return body.nextPageToken ? page(body.nextPageToken) : found;
        });
      }
      return page('');
    }

    function find(name) {
      return files().then(function (all) { return all.filter(function (f) { return f.name === name; })[0] || null; });
    }

    function list() {
      return files().then(function (all) { return all.map(function (f) { return { name: f.name, version: f.version }; }); });
    }

    function read(name) {
      return find(name).then(function (file) {
        if (!file) return null;
        return request(API + '/files/' + encodeURIComponent(file.id) + '?alt=media').then(function (res) { return res.text(); });
      });
    }

    function write(name, text) {
      return find(name).then(function (file) {
        if (file) {
          return request(UPLOAD + '/files/' + encodeURIComponent(file.id) + '?uploadType=media&fields=id,version', {
            method: 'PATCH', headers: { 'Content-Type': 'text/plain' }, body: text
          });
        }
        var boundary = 'babylog' + Math.random().toString(16).slice(2);
        var body = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify({ name: name, parents: [SPACE] }) + '\r\n--' + boundary + '\r\nContent-Type: text/plain\r\n\r\n' + text + '\r\n--' + boundary + '--';
        return request(UPLOAD + '/files?uploadType=multipart&fields=id,version', {
          method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: body
        });
      }).then(function (res) { return res.json(); }).then(function (file) { return file.version; });
    }

    return { list: list, read: read, write: write };
  }

  root.BABYLOG_DRIVE = { create: create };
})(typeof self !== 'undefined' ? self : this);
