// ============================================================
// MY MUSIC (G1712, SND-BOOMBOX; the user 2026-10-05: "and if possible and easy, the ability to point to a local music
// folder"): window.AUDIO_MYMUSIC - the player's own folder, handed to music.js as its virtual station 'mine'
// (AUDIO_MUSIC.setUserTracks). This file only FINDS the files; music.js plays them through its own two decks.
//
//   THE PICK  window.showDirectoryPicker where the browser has it (Chromium): a DirectoryHandle, walked for the audio
//             files (MINE_RE: mp3 / ogg / m4a / wav / flac / opus / aac), at most MAX_DEPTH folders down and MAX_FILES
//             files. Elsewhere an <input type=file webkitdirectory multiple> (made on the click, never kept): the browser
//             hands the folder's File objects once - that pick lasts the page, so the next visit asks again (the
//             boombox's panel says so).
//   NOTHING LEAVES THE MACHINE  the Files stay Files: music.js makes a blob: object URL when a deck loads one and
//             revokes it when the deck lets it go. Nothing is uploaded, fetched or decoded here, and nothing at all
//             happens before a gesture (every entry point is a click on the panel).
//   KEPT     only the DirectoryHandle, in IndexedDB (DB / STORE / KEY), every access in try/catch. On the next visit the
//             panel asks restore() when it opens (a click): a handle whose permission is still 'granted' is walked at
//             once; one that says 'prompt' waits for the panel's 'reconnect' button (requestPermission must be called
//             from a gesture). forget() drops the handle and the station.
//   TITLES   from the file names (AUDIO_MUSIC.titleOf): no ID3 reader, nothing read from inside the files.
// ============================================================
var AUDIO_MYMUSIC = (function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const DB = 'flydiy-mymusic', STORE = 'h', KEY = 'dir';
  const MAX_DEPTH = 4, MAX_FILES = 4000;
  const music = () => G.AUDIO_MUSIC || null;
  const re = () => (music() && music().MINE_RE) || /\.(mp3|ogg|oga|opus|m4a|aac|wav|flac)$/i;
  // the state the panel reads: how it was picked ('dir' | 'input' | ''), the folder's name, a handle waiting for its
  // permission, the last word to say
  const st = { via: '', name: '', pending: null, line: '', busy: false };
  const canDir = () => typeof G.showDirectoryPicker === 'function';

  // ---- IndexedDB: one handle, every call wrapped (a private window, a blocked store: the pick simply is not kept) ------
  function idb(mode, fn) {
    return new Promise(res => {
      let req;
      try { req = G.indexedDB && G.indexedDB.open(DB, 1); } catch (e) { req = null; }
      if (!req) { res(null); return; }
      req.onupgradeneeded = () => { try { req.result.createObjectStore(STORE); } catch (e) {} };
      req.onerror = () => res(null);
      req.onsuccess = () => {
        try {
          const db = req.result, tx = db.transaction(STORE, mode), os = tx.objectStore(STORE), r = fn(os);
          tx.oncomplete = () => { try { db.close(); } catch (e) {} res(r && 'result' in r ? r.result : true); };
          tx.onerror = tx.onabort = () => { try { db.close(); } catch (e) {} res(null); };
        } catch (e) { res(null); }
      };
    });
  }
  const keep = h => idb('readwrite', os => os.put(h, KEY));
  const recall = () => idb('readonly', os => os.get(KEY));
  const drop = () => idb('readwrite', os => os.delete(KEY));

  // ---- the walk: a DirectoryHandle's audio files, depth- and count-bounded --------------------------------------------
  async function walk(dir, out, depth) {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return out;
    const R = re();
    try {
      for await (const e of dir.values()) {
        if (out.length >= MAX_FILES) break;
        if (e.kind === 'file' && R.test(e.name)) { try { out.push(await e.getFile()); } catch (x) {} }
        else if (e.kind === 'directory') await walk(e, out, depth + 1);
      }
    } catch (x) {}
    return out;
  }
  // the files in, a word for the panel
  function hand(files, name, via) {
    const M = music();
    const sorted = Array.prototype.slice.call(files || []).filter(f => f && re().test(f.name || ''))
      .sort((a, b) => String(a.webkitRelativePath || a.name).localeCompare(String(b.webkitRelativePath || b.name)));
    const n = M ? M.setUserTracks(sorted, name) : 0;
    st.via = n ? via : ''; st.name = n ? name : ''; st.pending = null;
    st.line = n ? n + ' track' + (n === 1 ? '' : 's') + ' from ' + name : 'No music files in ' + (name || 'that folder') + ' (mp3, ogg, m4a, wav, flac).';
    return n;
  }
  async function fromHandle(h) {
    st.busy = true;
    try { return hand(await walk(h, [], 0), h.name || 'your folder', 'dir'); }
    finally { st.busy = false; }
  }

  // ---- the entry points (the panel's buttons: each a click) ---------------------------------------------------------
  // pick a folder: the directory picker, else the input; resolves to the count kept (0: cancelled or empty)
  async function pick() {
    if (canDir()) {
      let h;
      try { h = await G.showDirectoryPicker({ id: 'flydiy-music', mode: 'read' }); }
      catch (e) { st.line = e && e.name === 'AbortError' ? st.line : 'The browser refused the folder.'; return 0; }
      const n = await fromHandle(h);
      if (n) await keep(h);
      return n;
    }
    return pickInput();
  }
  // the fallback: a one-off <input webkitdirectory>, clicked from the same gesture
  function pickInput() {
    const D = G.document;
    if (!D || !D.createElement) return Promise.resolve(0);
    return new Promise(res => {
      const i = D.createElement('input');
      i.type = 'file'; i.multiple = true;
      i.setAttribute('webkitdirectory', ''); i.setAttribute('directory', '');
      i.accept = 'audio/*';
      i.style.display = 'none';
      i.onchange = () => {
        const fs = Array.prototype.slice.call(i.files || []);
        const p = fs[0] && fs[0].webkitRelativePath ? String(fs[0].webkitRelativePath).split('/')[0] : 'your folder';
        try { i.remove(); } catch (e) {}
        res(fs.length ? hand(fs, p, 'input') : 0);
      };
      if (D.body) D.body.appendChild(i);
      try { i.click(); } catch (e) { res(0); }
    });
  }
  // the panel opened (a click): a kept handle comes back - walked now if its permission still holds, else it waits for
  // reconnect(). Resolves to the state.
  async function restore() {
    if (st.via || st.busy || !canDir()) return st;
    const h = await recall();
    if (!h || typeof h.queryPermission !== 'function') return st;
    let p = 'prompt';
    try { p = await h.queryPermission({ mode: 'read' }); } catch (e) {}
    if (p === 'granted') await fromHandle(h);
    else { st.pending = h; st.name = h.name || ''; st.line = ''; }
    return st;
  }
  // the 'reconnect' button: requestPermission needs this click's gesture
  async function reconnect() {
    const h = st.pending;
    if (!h) return 0;
    let p = 'denied';
    try { p = await h.requestPermission({ mode: 'read' }); } catch (e) {}
    if (p !== 'granted') { st.line = 'The browser did not give the folder back - choose it again.'; return 0; }
    return fromHandle(h);
  }
  async function forget() {
    st.pending = null; st.via = ''; st.name = ''; st.line = '';
    const M = music();
    if (M) M.setUserTracks([], '');
    await drop();
    return true;
  }

  return { pick, pickInput, restore, reconnect, forget, canDir, state: st, MAX_DEPTH, MAX_FILES, DB, _walk: walk, _hand: hand };
})();
if (typeof window !== 'undefined') window.AUDIO_MYMUSIC = AUDIO_MYMUSIC;
if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO_MYMUSIC;
