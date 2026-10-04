// The Babies screen (#babies, feature 014): choose a baby, add one, or sign in to load them from Google.
// Tapping the baby at the top of Today opens it. While no baby is chosen, app.js sends every other screen here,
// so nothing can be logged without a baby. The list rules are in profile.js (babies, pick).
(function (root) {
  var Pr = root.BABYLOG_PROFILE;
  var BABY = root.BABYLOG_BABY;
  var SYNC_UI = root.BABYLOG_SYNC_UI;

  var ctx = null;
  var open = false;
  var searched = false;      // a sync finished since the app opened, so the list also holds what Google has
  var asGate = false;        // the screen opened because no baby was chosen yet
  var list = [];

  function $(id) { return document.getElementById(id); }

  function intro(gate) {
    if (!gate) return '';
    if (!list.length) return searched ? 'No baby was found in the Google account. Add your baby to start.' : 'Welcome. Add your baby to start.';
    if (list.length === 1 && !list[0].profile) return 'Your entries from before are here. Add your baby’s details to keep using them.';
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
    name.textContent = baby.profile ? Pr.displayName(d.nickname) : 'Entries from before';
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
    // Entries from before feature 014 get their baby's details first, so they are not left behind by a second, new baby.
    $('bb-add').hidden = gate && list.length === 1 && !list[0].profile;
    var ul = $('bb-list');
    ul.textContent = '';
    list.forEach(function (baby) { ul.appendChild(row(baby)); });
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
    return BABY.load().then(function (babies) {
      if (!open) return;
      list = babies;
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
    $('screen-babies').hidden = true;
  }

  function init(context) {
    ctx = context;
    $('bb-add').addEventListener('click', function () { location.hash = '#profile/new'; });
    $('bb-signin').addEventListener('click', SYNC_UI.signIn);
    SYNC_UI.onState(function (state) {
      if (state === 'synced') searched = true;
      if (open) refresh();
    });
  }

  root.BABYLOG_BABIES_UI = { init: init, show: show, hide: hide };
})(typeof self !== 'undefined' ? self : this);
