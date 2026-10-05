// The Babies screen (#babies, feature 014): choose a baby, add one, or sign in to load them from Google.
// It also shows entries that belong to no baby (made before feature 014): a parent adds them to a baby, or deletes them.
// Tapping the baby at the top of Today opens it. While no baby is chosen, app.js sends every other screen here,
// so nothing can be logged without a baby. The list rules are in profile.js (babies, pick).
(function (root) {
  var R = root.BABYLOG_RECORDS;
  var Pr = root.BABYLOG_PROFILE;
  var store = root.BABYLOG_STORE;
  var BABY = root.BABYLOG_BABY;
  var SYNC_UI = root.BABYLOG_SYNC_UI;

  var ctx = null;
  var open = false;
  var searched = false;      // a sync finished since the app opened, so the list also holds what Google has
  var asGate = false;        // the screen opened because no baby was chosen yet
  var list = [];
  var unlinked = [];         // entries that belong to no baby
  var working = false, armTimer = null;

  function $(id) { return document.getElementById(id); }

  function intro(gate) {
    if (!gate) return '';
    if (!list.length) return searched ? 'No baby was found in the Google account. Add your baby to start.' : 'Welcome. Add your baby to start.';
    return 'Which baby?';
  }

  function photo(details) {
    var frame = document.createElement('span');
    frame.className = 'baby-photo bb-photo' + (details.photo ? ' has-photo' : '');
    if (details.photo) {
      var img = document.createElement('img');
      img.alt = '';
      img.src = details.photo;
      frame.appendChild(img);
    } else {
      frame.innerHTML = root.BABYLOG_ICONS.baby;
    }
    return frame;
  }

  function row(baby) {
    var d = Pr.details(baby.profile);
    var li = document.createElement('li');
    li.className = 'bb-row';
    var pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'bb-pick';
    pick.setAttribute('data-id', baby.id);
    if (baby.id === BABY.id()) pick.setAttribute('aria-current', 'true');
    var text = document.createElement('span');
    text.className = 'bb-text';
    var name = document.createElement('strong');
    name.textContent = baby.profile ? Pr.displayName(d.nickname) : 'A baby without details';
    var sub = document.createElement('span');
    sub.textContent = baby.profile ? Pr.ageText(d.dateOfBirth, Date.now()) :
      baby.entries + (baby.entries === 1 ? ' entry' : ' entries') + ' · add your baby’s details';
    text.appendChild(name); text.appendChild(sub);
    pick.appendChild(photo(d)); pick.appendChild(text);
    pick.addEventListener('click', function () { choose(baby); });
    li.appendChild(pick);
    if (baby.profile) {
      var edit = document.createElement('a');
      edit.className = 'bb-edit';
      edit.href = '#profile/' + encodeURIComponent(baby.id);
      edit.textContent = 'Edit';
      edit.setAttribute('aria-label', 'Edit ' + Pr.displayName(d.nickname));
      li.appendChild(edit);
    }
    return li;
  }

  function render() {
    var gate = !BABY.id();
    var sync = SYNC_UI.status();
    $('bb-back').style.visibility = gate ? 'hidden' : '';
    $('h-babies').textContent = gate ? 'Baby Log' : 'Babies';
    $('bb-intro').textContent = intro(gate);
    $('bb-intro').hidden = !gate;
    // On a phone without babies, the other parent may have added one already: offer to load it.
    $('bb-signin-card').hidden = !(gate && sync.state !== 'off' && sync.state !== 'synced');
    $('bb-signin').disabled = sync.state === 'syncing';
    $('bb-sync-state').hidden = sync.state === 'signin';
    $('bb-sync-state').textContent = sync.label;
    renderUnlinked(gate);
    var ul = $('bb-list');
    ul.textContent = '';
    list.forEach(function (baby) { ul.appendChild(row(baby)); });
  }

  // Entries without a baby: say how many, and offer to add them to the baby on screen, or to delete them.
  function renderUnlinked(gate) {
    var n = unlinked.length, current = list.filter(function (b) { return b.id === BABY.id(); })[0];
    $('bb-unlinked').hidden = n === 0;
    if (!n) return;
    $('bb-unlinked-text').textContent = (n === 1 ? '1 entry was' : n + ' entries were') +
      ' logged before each entry had its baby. They are not shown under any baby. ' +
      (gate ? 'Add a baby first to keep them, or delete them.' : 'Add them to a baby, or delete them.');
    $('bb-link').hidden = gate || !current;
    if (current) $('bb-link').textContent = 'Add them to ' + Pr.displayName(Pr.details(current.profile).nickname);
    $('bb-link').disabled = working;
    $('bb-unlinked-delete').disabled = working;
  }

  // Add every entry without a baby to the baby on screen, or delete them all (tombstones, so sync carries it), in one save.
  function changeUnlinked(link) {
    if (working || !unlinked.length) return;
    working = true;
    var now = Date.now(), babyId = BABY.id(), count = unlinked.length;
    store.deviceId().then(function (deviceId) {
      return store.putMany(unlinked.map(function (r) { return link ? R.linkToBaby(r, babyId, now, deviceId) : R.tombstone(r, now, deviceId); }));
    }).then(function () {
      working = false;
      ctx.toast((count === 1 ? '1 entry ' : count + ' entries ') + (link ? 'added.' : 'deleted.'));
      return refresh();
    }).catch(function (err) {
      working = false;
      console.error('[baby-log] entries without a baby', err);
      ctx.toast('Not saved. Please try again.');
      render();
    });
  }
  function disarm() {
    clearTimeout(armTimer);
    $('bb-unlinked-delete').classList.remove('armed');
    $('bb-unlinked-delete').textContent = 'Delete them';
  }
  // Delete asks for a second tap, because there is no Undo.
  function tapDelete() {
    var button = $('bb-unlinked-delete');
    if (button.classList.contains('armed')) { disarm(); changeUnlinked(false); return; }
    button.classList.add('armed');
    button.textContent = 'Tap again to delete';
    armTimer = setTimeout(disarm, 4000);
  }

  function choose(baby) {
    if (!baby.profile) { location.hash = '#profile/' + encodeURIComponent(baby.id); return; }
    BABY.choose(baby.id).then(function () { location.hash = '#today'; }).catch(function (err) {
      console.error('[baby-log] choose baby', err);
      ctx.toast('Could not switch. Please try again.');
    });
  }

  // Read the babies again. If this screen is asking because no baby was chosen, and one is now clear
  // (for example the only baby just came from Google), go straight to Today.
  function refresh() {
    return Promise.all([BABY.load(), BABY.unlinked()]).then(function (r) {
      if (!open) return;
      list = r[0];
      unlinked = r[1];
      if (asGate && BABY.id()) { location.hash = '#today'; return; }
      render();
      $('screen-babies').setAttribute('data-ready', '');
    }).catch(function (err) {
      console.error('[baby-log] babies', err);
      ctx.toast('Could not read saved entries. Close the app and open it again.');
    });
  }

  function show() {
    open = true;
    asGate = !BABY.id();
    $('screen-babies').hidden = false;
    $('screen-babies').removeAttribute('data-ready');
    refresh();
  }

  function hide() {
    open = false;
    disarm();
    $('screen-babies').hidden = true;
  }

  function init(context) {
    ctx = context;
    $('bb-add').addEventListener('click', function () { location.hash = '#profile/new'; });
    $('bb-signin').addEventListener('click', SYNC_UI.signIn);
    $('bb-link').addEventListener('click', function () { changeUnlinked(true); });
    $('bb-unlinked-delete').addEventListener('click', tapDelete);
    SYNC_UI.onState(function (state) {
      if (state === 'synced') searched = true;
      if (open) refresh();
    });
  }

  root.BABYLOG_BABIES_UI = { init: init, show: show, hide: hide };
})(typeof self !== 'undefined' ? self : this);
