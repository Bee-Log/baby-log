// The baby profile screen (#profile) and the header on Today (feature 002).
// The rules and the record are in profile.js. This file draws, listens, and saves.
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var Pr = root.BABYLOG_PROFILE;
  var store = root.BABYLOG_STORE;
  var PHOTO_SIZE = 256;          // the photo is shrunk to a square of this size (about 20 KB), so it syncs like any other entry

  var ctx = null;                // { toast, setBusy } from app.js
  var existing = null;           // the saved profile record, or null
  var form = Pr.details(null);   // what is on the screen now
  var open = false;
  var saving = false;

  function $(id) { return document.getElementById(id); }

  function showPhoto(frame, img, photo) {
    img.hidden = !photo;
    if (photo) img.src = photo;
    frame.classList.toggle('has-photo', !!photo);
  }

  // ---- Today header ----
  // "Sat 3 Oct · 3 weeks old", and the nickname. Before a profile is saved: the date and "[Nickname]".
  function renderHead(records) {
    var d = Pr.details(Pr.current(records));
    var now = Date.now();
    var age = Pr.ageText(d.dateOfBirth, now);
    $('bh-sub').textContent = R.dateLabel(now) + (age ? ' · ' + age : '');
    $('bh-name').textContent = Pr.displayName(d.nickname);
    var frame = $('bh-photo');
    var img = frame.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.alt = '';
      frame.appendChild(img);
    }
    showPhoto(frame, img, d.photo);
  }

  // ---- Profile screen ----
  function render() {
    $('pf-name').textContent = Pr.displayName(form.nickname);
    $('pf-age').textContent = Pr.ageText(form.dateOfBirth, Date.now());
    showPhoto($('pf-photo-label'), $('pf-img'), form.photo);
    $('pf-empty').hidden = !!form.photo;
    $('pf-girl').setAttribute('aria-pressed', form.sex === 'girl' ? 'true' : 'false');
    $('pf-boy').setAttribute('aria-pressed', form.sex === 'boy' ? 'true' : 'false');
    $('pf-save').disabled = saving || !Pr.isComplete(form);
  }

  // A square, centred crop of the photo at PHOTO_SIZE, as a small JPEG.
  function shrinkPhoto(file) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bitmap) {
      var side = Math.min(bitmap.width, bitmap.height);
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = PHOTO_SIZE;
      canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
      if (bitmap.close) bitmap.close();
      return canvas.toDataURL('image/jpeg', 0.8);
    });
  }

  function choosePhoto(file) {
    if (!file) return;
    shrinkPhoto(file).then(function (dataUrl) {
      form.photo = dataUrl;
      render();
    }).catch(function (err) {
      console.error('[baby-log] photo', err);
      ctx.toast('That photo could not be used. Please try another.');
    });
  }

  function save() {
    if (saving || !Pr.isComplete(form)) return;
    saving = true;
    render();
    store.deviceId().then(function (deviceId) {
      return store.put(Pr.toRecord(existing, form, Date.now(), deviceId));
    }).then(function () {
      saving = false;
      ctx.toast('Profile saved');
      location.hash = '#today';
    }).catch(function (err) {
      saving = false;
      render();
      console.error('[baby-log] profile save', err);
      ctx.toast('Not saved. Please try again.');
    });
  }

  function show() {
    var screen = $('screen-profile');
    screen.hidden = false;
    screen.removeAttribute('data-ready');
    if (!open) { open = true; ctx.setBusy(true); }      // an update waits while the form is open
    store.all().then(function (records) {
      if (screen.hidden) return;
      existing = Pr.current(records);
      form = Pr.details(existing);
      $('pf-nickname').value = form.nickname;
      $('pf-dob').value = form.dateOfBirth;
      $('pf-dob').max = new Date().toISOString().slice(0, 10);
      render();
      screen.setAttribute('data-ready', '');
    }).catch(function (err) {
      console.error('[baby-log] profile open', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function hide() {
    if (open) { open = false; ctx.setBusy(false); }
    $('screen-profile').hidden = true;
    $('screen-profile').removeAttribute('data-ready');
  }

  function init(context) {
    ctx = context;
    $('pf-nickname').addEventListener('input', function (e) { form.nickname = e.target.value; render(); });
    $('pf-dob').addEventListener('change', function (e) { form.dateOfBirth = e.target.value; render(); });
    $('pf-girl').addEventListener('click', function () { form.sex = 'girl'; render(); });
    $('pf-boy').addEventListener('click', function () { form.sex = 'boy'; render(); });
    $('pf-file').addEventListener('change', function (e) { choosePhoto(e.target.files[0]); e.target.value = ''; });
    $('pf-save').addEventListener('click', save);
  }

  root.BABYLOG_PROFILE_UI = { init: init, show: show, hide: hide, renderHead: renderHead };
})(typeof self !== 'undefined' ? self : this);
