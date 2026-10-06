// _page_dom.js - A SMALL DOCUMENT FOR THE PAGE IN NODE (G1010, GATE FRAMECOST's harness, tools/_page_node.js).
//
// The page's scripts run in a vm (tools/_page_node.js) and ask a document for what a browser's would answer:
// the body's markup (dev.html's own, parsed), getElementById, createElement, a selector, classes, styles,
// attributes, listeners, innerHTML that makes children. It draws nothing and lays nothing out: every box is
// 0 x 0 unless a canvas, no CSS applies, no event fires unless the harness dispatches it. It is deliberately
// NOT a browser: what it answers is the same every run (the gate that stands on it is a count), and what it
// cannot answer it answers with the empty thing a browser would give an element that is not laid out.
//
//   const D = makeDocument({ html, win, makeCanvasContext });   // D.document, D.Element, D.Event, ...
'use strict';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', times: '×', deg: '°', rarr: '→', larr: '←', hellip: '…', mdash: '—', ndash: '–', copy: '©' };
const decode = s => s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] !== undefined ? ENT[e] : m));
const camel = s => s.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
const kebab = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

function makeDocument(opts) {
  const win = opts.win;
  const byId = new Map();   // id -> Set of elements carrying it (the first attached one answers)

  // ---- events --------------------------------------------------------------------------------------
  class Event {
    constructor(type, init) { init = init || {}; this.type = type; this.bubbles = !!init.bubbles; this.cancelable = !!init.cancelable; this.defaultPrevented = false; this._stop = false; this.target = null; this.currentTarget = null; this.timeStamp = 0; Object.assign(this, init); }
    preventDefault() { this.defaultPrevented = true; } stopPropagation() { this._stop = true; } stopImmediatePropagation() { this._stop = true; this._stopNow = true; }
  }
  class CustomEvent extends Event { constructor(t, i) { super(t, i); this.detail = i && i.detail; } }
  class EventTarget {
    addEventListener(t, f, o) { if (!f) return; const L = this._ls || (this._ls = {}); (L[t] = L[t] || []).push({ f, once: !!(o && o.once) }); }
    removeEventListener(t, f) { const L = this._ls && this._ls[t]; if (!L) return; const i = L.findIndex(x => x.f === f); if (i >= 0) L.splice(i, 1); }
    dispatchEvent(ev) {
      if (!ev.target) ev.target = this;
      const path = []; for (let n = this; n; n = n.parentNode) path.push(n);
      if (path[path.length - 1] === doc) path.push(win);
      for (const n of (ev.bubbles ? path : [this])) {
        ev.currentTarget = n;
        const L = n._ls && n._ls[ev.type];
        if (L) for (const l of L.slice()) { if (l.once) n.removeEventListener(ev.type, l.f); typeof l.f === 'function' ? l.f.call(n, ev) : l.f.handleEvent(ev); if (ev._stopNow) break; }
        const h = n['on' + ev.type]; if (typeof h === 'function' && !(n === win)) h.call(n, ev);
        if (ev._stop) break;
      }
      return !ev.defaultPrevented;
    }
  }

  // ---- style: a declaration that remembers what was set ----------------------------------------------
  function makeStyle(owner) {
    const v = {};
    const api = {
      setProperty: (k, x) => { v[k] = String(x); }, getPropertyValue: k => v[k] || v[camel(k)] || '', removeProperty: k => { const o = v[k]; delete v[k]; delete v[camel(k)]; return o || ''; },
      get cssText() { return Object.keys(v).map(k => kebab(k) + ': ' + v[k]).join('; '); },
      set cssText(s) { for (const k of Object.keys(v)) delete v[k]; String(s || '').split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) v[camel(d.slice(0, i).trim())] = d.slice(i + 1).trim(); }); },
      get length() { return Object.keys(v).length; },
    };
    return new Proxy(v, {
      get: (t, k) => (k in api ? api[k] : typeof k === 'string' ? (t[k] !== undefined ? t[k] : '') : undefined),
      set: (t, k, x) => { if (k === 'cssText') api.cssText = x; else t[k] = x == null ? '' : String(x); return true; },
      has: (t, k) => true,
    });
  }
  function makeClassList(el) {
    const get = () => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    const put = a => el.setAttribute('class', a.join(' '));
    return {
      add: (...c) => { const a = get(); for (const x of c) if (!a.includes(x)) a.push(x); put(a); },
      remove: (...c) => put(get().filter(x => !c.includes(x))),
      contains: c => get().includes(c),
      toggle: (c, on) => { const has = get().includes(c), want = on === undefined ? !has : !!on; if (want && !has) put(get().concat([c])); if (!want && has) put(get().filter(x => x !== c)); return want; },
      replace: (a, b) => { const l = get(); const i = l.indexOf(a); if (i < 0) return false; l[i] = b; put(l); return true; },
      item: i => get()[i] || null, get length() { return get().length; }, toString: () => get().join(' '), forEach: f => get().forEach(f),
      [Symbol.iterator]: function* () { yield* get(); },
    };
  }

  // ---- nodes ---------------------------------------------------------------------------------------
  class Node extends EventTarget {
    constructor() { super(); this.parentNode = null; this.childNodes = []; }
    get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
    get firstChild() { return this.childNodes[0] || null; } get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
    get nextSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) + 1] || null; }
    get previousSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) - 1] || null; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === doc; }
    get ownerDocument() { return doc; }
    appendChild(c) { return this.insertBefore(c, null); }
    insertBefore(c, ref) {
      if (c.nodeType === 11) { for (const k of c.childNodes.slice()) this.insertBefore(k, ref); return c; }
      if (c.parentNode) c.parentNode.removeChild(c);
      const i = ref ? this.childNodes.indexOf(ref) : -1;
      if (i >= 0) this.childNodes.splice(i, 0, c); else this.childNodes.push(c);
      c.parentNode = this;
      if (c.nodeType === 1 && c.tagName === 'SCRIPT' && opts.onScript && c.isConnected) opts.onScript(c);
      return c;
    }
    removeChild(c) { const i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
    replaceChild(n, o) { this.insertBefore(n, o); this.removeChild(o); return o; }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    append(...a) { for (const x of a) this.appendChild(typeof x === 'string' ? new Text(x) : x); }
    prepend(...a) { const f = this.firstChild; for (const x of a) this.insertBefore(typeof x === 'string' ? new Text(x) : x, f); }
    replaceChildren(...a) { for (const c of this.childNodes.slice()) this.removeChild(c); this.append(...a); }
    replaceWith(...a) { const p = this.parentNode; if (!p) return; for (const x of a) p.insertBefore(typeof x === 'string' ? new Text(x) : x, this); p.removeChild(this); }
    before(...a) { const p = this.parentNode; if (p) for (const x of a) p.insertBefore(typeof x === 'string' ? new Text(x) : x, this); }
    after(...a) { const p = this.parentNode; if (!p) return; const n = this.nextSibling; for (const x of a) p.insertBefore(typeof x === 'string' ? new Text(x) : x, n); }
    contains(n) { for (; n; n = n.parentNode) if (n === this) return true; return false; }
    hasChildNodes() { return this.childNodes.length > 0; }
    get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
    set textContent(s) { for (const c of this.childNodes.slice()) this.removeChild(c); if (s !== '' && s != null) this.appendChild(new Text(String(s))); }
    getRootNode() { let n = this; while (n.parentNode) n = n.parentNode; return n; }
  }
  class Text extends Node {
    constructor(s) { super(); this.nodeType = 3; this.data = String(s); this.nodeName = '#text'; }
    get textContent() { return this.data; } set textContent(s) { this.data = String(s); }
    get nodeValue() { return this.data; } set nodeValue(s) { this.data = String(s); }
    cloneNode() { return new Text(this.data); }
  }
  class Comment extends Node { constructor(s) { super(); this.nodeType = 8; this.data = s; this.nodeName = '#comment'; } get textContent() { return ''; } cloneNode() { return new Comment(this.data); } }
  class Fragment extends Node {
    constructor() { super(); this.nodeType = 11; this.nodeName = '#document-fragment'; }
    querySelector(s) { return qsa(this, s, true)[0] || null; } querySelectorAll(s) { return qsa(this, s, false); }
    get children() { return this.childNodes.filter(c => c.nodeType === 1); }
    getElementById(id) { return walk(this).find(e => e.id === id) || null; }
    cloneNode(deep) { const f = new Fragment(); if (deep) for (const c of this.childNodes) f.appendChild(c.cloneNode(true)); return f; }
  }
  const REFLECT_BOOL = ['hidden', 'disabled', 'checked', 'selected', 'multiple', 'readOnly', 'required', 'open', 'draggable', 'autofocus', 'defer', 'async'];
  class Element extends Node {
    constructor(tag, ns) {
      super(); this.nodeType = 1; this.tagName = ns ? tag : tag.toUpperCase(); this.localName = tag.toLowerCase(); this.nodeName = this.tagName; this.namespaceURI = ns || 'http://www.w3.org/1999/xhtml';
      this.attributes = []; this._a = new Map(); this.style = makeStyle(this); this.classList = makeClassList(this);
      this.dataset = new Proxy({}, { get: (t, k) => typeof k === 'string' ? (this.getAttribute('data-' + kebab(k)) ?? undefined) : undefined,
        set: (t, k, v) => { this.setAttribute('data-' + kebab(k), v); return true; }, deleteProperty: (t, k) => { this.removeAttribute('data-' + kebab(k)); return true; },
        ownKeys: () => [...this._a.keys()].filter(k => k.startsWith('data-')).map(k => camel(k.slice(5))), getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
      this.scrollTop = 0; this.scrollLeft = 0; this.tabIndex = 0;
      this._value = undefined; this._checked = undefined;
    }
    get id() { return this.getAttribute('id') || ''; } set id(v) { this.setAttribute('id', v); }
    get className() { return this.getAttribute('class') || ''; } set className(v) { this.setAttribute('class', v); }
    get title() { return this.getAttribute('title') || ''; } set title(v) { this.setAttribute('title', v); }
    get name() { return this.getAttribute('name') || ''; } set name(v) { this.setAttribute('name', v); }
    get type() { return this.getAttribute('type') || (this.localName === 'input' ? 'text' : this.localName === 'button' ? 'submit' : ''); } set type(v) { this.setAttribute('type', v); }
    get src() { return this.getAttribute('src') || ''; } set src(v) { this.setAttribute('src', v); }
    get href() { return this.getAttribute('href') || ''; } set href(v) { this.setAttribute('href', v); }
    get htmlFor() { return this.getAttribute('for') || ''; } set htmlFor(v) { this.setAttribute('for', v); }
    get min() { return this.getAttribute('min') || ''; } set min(v) { this.setAttribute('min', v); }
    get max() { return this.getAttribute('max') || ''; } set max(v) { this.setAttribute('max', v); }
    get step() { return this.getAttribute('step') || ''; } set step(v) { this.setAttribute('step', v); }
    get placeholder() { return this.getAttribute('placeholder') || ''; } set placeholder(v) { this.setAttribute('placeholder', v); }
    get value() {
      if (this.localName === 'select') { const o = this.options[this.selectedIndex]; return o ? o.value : ''; }
      if (this.localName === 'option') return this._value !== undefined ? this._value : (this.hasAttribute('value') ? this.getAttribute('value') : this.textContent);
      if (this.localName === 'textarea') return this._value !== undefined ? this._value : this.textContent;
      return this._value !== undefined ? this._value : (this.getAttribute('value') || (this.type === 'range' ? '50' : ''));
    }
    set value(v) {
      v = v == null ? '' : String(v);
      if (this.localName === 'select') { const i = this.options.findIndex(o => o.value === v); this._sel = i; return; }
      this._value = v;
    }
    get valueAsNumber() { return +this.value; } set valueAsNumber(v) { this.value = v; }
    get checked() { return this._checked !== undefined ? this._checked : this.hasAttribute('checked'); } set checked(v) { this._checked = !!v; }
    get options() { return walk(this).filter(e => e.localName === 'option'); }
    get selectedIndex() { const o = this.options; if (this._sel !== undefined && this._sel < o.length) return this._sel; const i = o.findIndex(x => x.hasAttribute('selected')); return i >= 0 ? i : (o.length ? 0 : -1); }
    set selectedIndex(i) { this._sel = i; }
    get selectedOptions() { const o = this.options[this.selectedIndex]; return o ? [o] : []; }
    add(o) { this.appendChild(o); }
    get children() { return this.childNodes.filter(c => c.nodeType === 1); }
    get childElementCount() { return this.children.length; }
    get firstElementChild() { return this.children[0] || null; } get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
    get nextElementSibling() { const p = this.parentNode; if (!p) return null; const s = p.childNodes; for (let i = s.indexOf(this) + 1; i < s.length; i++) if (s[i].nodeType === 1) return s[i]; return null; }
    get previousElementSibling() { const p = this.parentNode; if (!p) return null; const s = p.childNodes; for (let i = s.indexOf(this) - 1; i >= 0; i--) if (s[i].nodeType === 1) return s[i]; return null; }
    getAttribute(k) { k = String(k).toLowerCase(); return this._a.has(k) ? this._a.get(k) : null; }
    hasAttribute(k) { return this._a.has(String(k).toLowerCase()); }
    setAttribute(k, v) {
      k = String(k).toLowerCase(); v = String(v);
      if (k === 'id') { const o = this._a.get('id'); if (o !== undefined) { const s = byId.get(o); if (s) s.delete(this); } let s = byId.get(v); if (!s) byId.set(v, s = new Set()); s.add(this); }
      if (!this._a.has(k)) this.attributes.push({ name: k, get value() { return null; } });
      this._a.set(k, v); const a = this.attributes.find(x => x.name === k); if (a) Object.defineProperty(a, 'value', { value: v, configurable: true, writable: true });
    }
    removeAttribute(k) { k = String(k).toLowerCase(); if (k === 'id') { const s = byId.get(this._a.get('id')); if (s) s.delete(this); } this._a.delete(k); const i = this.attributes.findIndex(x => x.name === k); if (i >= 0) this.attributes.splice(i, 1); }
    toggleAttribute(k, on) { const has = this.hasAttribute(k), want = on === undefined ? !has : !!on; if (want) this.setAttribute(k, ''); else this.removeAttribute(k); return want; }
    getAttributeNames() { return [...this._a.keys()]; }
    setAttributeNS(ns, k, v) { this.setAttribute(k, v); } getAttributeNS(ns, k) { return this.getAttribute(k); } removeAttributeNS(ns, k) { this.removeAttribute(k); }
    get innerHTML() { return this.childNodes.map(serialize).join(''); }
    set innerHTML(s) { for (const c of this.childNodes.slice()) this.removeChild(c); const f = parse(String(s == null ? '' : s)); this.appendChild(f); }
    get outerHTML() { return serialize(this); }
    set outerHTML(s) { const f = parse(String(s)); if (this.parentNode) { this.parentNode.insertBefore(f, this); this.remove(); } }
    get innerText() { return this.textContent; } set innerText(s) { this.textContent = s; }
    insertAdjacentHTML(pos, s) { const f = parse(String(s)); this._adj(pos, f); }
    insertAdjacentElement(pos, e) { this._adj(pos, e); return e; }
    insertAdjacentText(pos, s) { this._adj(pos, new Text(s)); }
    _adj(pos, n) { pos = pos.toLowerCase(); if (pos === 'beforebegin') this.parentNode && this.parentNode.insertBefore(n, this); else if (pos === 'afterbegin') this.insertBefore(n, this.firstChild); else if (pos === 'beforeend') this.appendChild(n); else if (pos === 'afterend') this.parentNode && this.parentNode.insertBefore(n, this.nextSibling); }
    querySelector(s) { return qsa(this, s, true)[0] || null; } querySelectorAll(s) { return qsa(this, s, false); }
    getElementsByTagName(t) { t = t.toLowerCase(); return walk(this).filter(e => t === '*' || e.localName === t); }
    getElementsByClassName(c) { const cs = c.split(/\s+/).filter(Boolean); return walk(this).filter(e => cs.every(x => e.classList.contains(x))); }
    matches(s) { return matchSel(this, s); } closest(s) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (matchSel(n, s)) return n; return null; }
    cloneNode(deep) {
      const e = doc.createElementNS(this.namespaceURI, this.localName); for (const [k, v] of this._a) e.setAttribute(k, v);
      if (deep) for (const c of this.childNodes) e.appendChild(c.cloneNode(true)); return e;
    }
    click() { if (this.disabled) return; this.dispatchEvent(new Event('click', { bubbles: true, cancelable: true })); }
    focus() { doc.activeElement = this; } blur() { if (doc.activeElement === this) doc.activeElement = doc.body; } select() {}
    scrollIntoView() {} scrollTo() {} scrollBy() {} setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
    requestPointerLock() {} requestFullscreen() { return Promise.resolve(); } showModal() { this.setAttribute('open', ''); } show() { this.setAttribute('open', ''); } close() { this.removeAttribute('open'); }
    animate() { return { cancel() {}, finish() {}, play() {}, pause() {}, onfinish: null, finished: Promise.resolve() }; }
    getAnimations() { return []; }
    attachShadow() { const f = new Fragment(); this.shadowRoot = f; return f; }
    getBoundingClientRect() { const w = this.offsetWidth, h = this.offsetHeight; return { left: 0, top: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0 }; }
    getClientRects() { return [this.getBoundingClientRect()]; }
    get offsetWidth() { return this.localName === 'canvas' ? this.width : 0; } get offsetHeight() { return this.localName === 'canvas' ? this.height : 0; }
    get clientWidth() { return this.localName === 'canvas' ? this.width : (this === doc.documentElement || this === doc.body ? win.innerWidth : 0); }
    get clientHeight() { return this.localName === 'canvas' ? this.height : (this === doc.documentElement || this === doc.body ? win.innerHeight : 0); }
    get scrollWidth() { return 0; } get scrollHeight() { return 0; } get offsetLeft() { return 0; } get offsetTop() { return 0; }
    // laid out = connected and not hidden up the tree (what `offsetParent !== null` asks in the page)
    get offsetParent() { for (let n = this; n && n.nodeType === 1; n = n.parentNode) { if (n.hidden || n.style.display === 'none') return null; } return this.isConnected ? doc.body : null; }
  }
  for (const k of REFLECT_BOOL) if (!Object.getOwnPropertyDescriptor(Element.prototype, k))
    Object.defineProperty(Element.prototype, k, { get() { return this.hasAttribute(k.toLowerCase()); }, set(v) { if (v) this.setAttribute(k.toLowerCase(), ''); else this.removeAttribute(k.toLowerCase()); }, configurable: true });
  // the event handler properties (onclick = f): a plain slot per element, read by dispatchEvent
  class Canvas extends Element {
    constructor() { super('canvas'); this._w = 300; this._h = 150; this._ctx = null; }
    get width() { return this._w; } set width(v) { this._w = v | 0; this._cleared(); } get height() { return this._h; } set height(v) { this._h = v | 0; this._cleared(); }
    // G2220: setting a size clears the canvas (tools/_c2d_digest.js's context forgets what it held)
    _cleared() { const c = this._ctx && this._ctx.ctx; if (c && this._ctx.kind === '2d' && typeof c.__resize === 'function') c.__resize(); }
    getContext(kind, attrs) { if (this._ctx) return this._ctx.kind === kind || (kind !== '2d' && this._ctx.kind !== '2d') ? this._ctx.ctx : null;
      const ctx = opts.makeCanvasContext(this, kind, attrs); if (ctx) this._ctx = { kind, ctx }; return ctx; }
    toDataURL() { return 'data:image/png;base64,'; } toBlob(cb) { win.setTimeout(() => cb(new win.Blob([new Uint8Array(0)], { type: 'image/png' })), 0); }
    transferControlToOffscreen() { return this; } captureStream() { return {}; }
  }
  class Img extends Element {
    constructor() { super('img'); this.width = 0; this.height = 0; this.naturalWidth = 0; this.naturalHeight = 0; this.complete = false; this.decoding = 'auto'; this.crossOrigin = null; this.loading = ''; }
    get src() { return this.getAttribute('src') || ''; }
    set src(v) { this.setAttribute('src', v); opts.loadImage(this, String(v)); }
    decode() { return this._decode ? this._decode() : Promise.resolve(); }
  }

  // ---- the parser (enough for the page's markup and its own innerHTML strings) ------------------------
  function parse(html) {
    const root = new Fragment(); let cur = root;
    const re = /<!--([\s\S]*?)-->|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/gi;
    let m, last = 0;
    const text = s => { if (s) cur.appendChild(new Text(decode(s))); };
    while ((m = re.exec(html))) {
      text(html.slice(last, m.index)); last = re.lastIndex;
      if (m[1] !== undefined) { cur.appendChild(new Comment(m[1])); continue; }
      if (m[2]) { const t = m[2].toLowerCase(); for (let n = cur; n && n !== root; n = n.parentNode) if (n.localName === t) { cur = n.parentNode; break; } continue; }
      if (m[3]) {
        const t = m[3].toLowerCase(), svg = t === 'svg' || (cur.namespaceURI && /svg/.test(cur.namespaceURI) && cur.localName !== 'foreignobject');
        const e = svg ? doc.createElementNS('http://www.w3.org/2000/svg', m[3]) : doc.createElement(t);
        const ar = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g; let a;
        while ((a = ar.exec(m[4] || ''))) e.setAttribute(a[1], decode(a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : ''));
        if (t === 'img' && e.getAttribute('src')) opts.loadImage(e, e.getAttribute('src'));
        cur.appendChild(e);
        if (RAW.has(t)) { const end = html.toLowerCase().indexOf('</' + t, re.lastIndex); const body = html.slice(re.lastIndex, end < 0 ? html.length : end);
          if (body) e.appendChild(new Text(t === 'textarea' || t === 'title' ? decode(body) : body)); const close = end < 0 ? html.length : html.indexOf('>', end) + 1; re.lastIndex = close; last = close; continue; }
        if (!VOID.has(t) && !m[5]) cur = e;
      }
    }
    text(html.slice(last));
    return root;
  }
  function serialize(n) {
    if (n.nodeType === 3) return n.data.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    if (n.nodeType === 8) return '<!--' + n.data + '-->';
    if (n.nodeType === 11) return n.childNodes.map(serialize).join('');
    const a = [...n._a].map(([k, v]) => ' ' + k + '="' + String(v).replace(/"/g, '&quot;') + '"').join('');
    return '<' + n.localName + a + '>' + (VOID.has(n.localName) ? '' : n.childNodes.map(serialize).join('') + '</' + n.localName + '>');
  }

  // ---- selectors: compound (tag#id.class[attr op val]:pseudo), descendant / child combinators, lists ----
  const walk = (n, out) => { out = out || []; for (const c of n.childNodes) if (c.nodeType === 1) { out.push(c); walk(c, out); } return out; };
  const selCache = new Map();
  function parseSel(s) {
    if (selCache.has(s)) return selCache.get(s);
    const list = splitTop(s, ',').map(part => {
      const toks = [], re = /\s*([>+~])\s*|\s+|((?:[\w-]+|\*)?(?:#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+(?:\((?:[^()]|\([^()]*\))*\))?)*)/g; let m, comb = ' ';
      const p = part.trim(); re.lastIndex = 0;
      while (re.lastIndex < p.length && (m = re.exec(p))) {
        if (m[1]) { comb = m[1]; continue; } if (m[0].trim() === '' ) { if (m[0].length) comb = ' '; else re.lastIndex++; continue; }
        toks.push({ comb, c: compound(m[2]) }); comb = ' ';
      }
      return toks;
    });
    selCache.set(s, list); return list;
  }
  function splitTop(s, ch) { const out = []; let d = 0, b = 0, cur = ''; for (const c of s) { if (c === '(') d++; if (c === ')') d--; if (c === '[') b++; if (c === ']') b--; if (c === ch && !d && !b) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; }
  function compound(s) {
    const c = { tag: null, id: null, cls: [], attr: [], pseudo: [] };
    const re = /^([\w-]+|\*)|#([\w-]+)|\.([\w-]+)|\[\s*([^\]=~|^$*\s]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*)))?\s*\]|:([\w-]+)(?:\(((?:[^()]|\([^()]*\))*)\))?/g; let m;
    while ((m = re.exec(s))) { if (m[0] === '') { re.lastIndex++; continue; }
      if (m[1]) c.tag = m[1] === '*' ? null : m[1].toLowerCase(); else if (m[2]) c.id = m[2]; else if (m[3]) c.cls.push(m[3]);
      else if (m[4]) c.attr.push([m[4].toLowerCase(), m[5], m[6] !== undefined ? m[6] : m[7] !== undefined ? m[7] : m[8]]); else if (m[9]) c.pseudo.push([m[9], m[10]]); }
    return c;
  }
  function matchC(e, c) {
    if (c.tag && e.localName !== c.tag) return false;
    if (c.id && e.id !== c.id) return false;
    for (const k of c.cls) if (!e.classList.contains(k)) return false;
    for (const [k, op, v] of c.attr) { const a = e.getAttribute(k); if (a === null) return false; if (!op) continue;
      if (op === '=' && a !== v) return false; if (op === '~=' && !a.split(/\s+/).includes(v)) return false; if (op === '^=' && !a.startsWith(v)) return false;
      if (op === '$=' && !a.endsWith(v)) return false; if (op === '*=' && !a.includes(v)) return false; if (op === '|=' && !(a === v || a.startsWith(v + '-'))) return false; }
    for (const [p, arg] of c.pseudo) {
      if (p === 'not') { if (matchSel(e, arg)) return false; }
      else if (p === 'checked') { if (!e.checked) return false; } else if (p === 'disabled') { if (!e.disabled) return false; }
      else if (p === 'first-child') { if (e.parentNode && e.parentNode.children[0] !== e) return false; }
      else if (p === 'last-child') { if (e.parentNode) { const k = e.parentNode.children; if (k[k.length - 1] !== e) return false; } }
      else if (p === 'scope') { /* the context element: handled by the caller's walk */ }
      else if (p === 'hover' || p === 'focus' || p === 'active' || p === 'focus-visible' || p === 'focus-within') return false;
    }
    return true;
  }
  function matchSel(e, s) { return parseSel(s).some(toks => matchToks(e, toks, toks.length - 1)); }
  function matchToks(e, toks, i) {
    if (!matchC(e, toks[i].c)) return false; if (i === 0) return true;
    const comb = toks[i].comb;
    if (comb === '>') return !!e.parentNode && e.parentNode.nodeType === 1 && matchToks(e.parentNode, toks, i - 1);
    if (comb === '+') { const p = e.previousElementSibling; return !!p && matchToks(p, toks, i - 1); }
    if (comb === '~') { for (let p = e.previousElementSibling; p; p = p.previousElementSibling) if (matchToks(p, toks, i - 1)) return true; return false; }
    for (let p = e.parentNode; p && p.nodeType === 1; p = p.parentNode) if (matchToks(p, toks, i - 1)) return true;
    return false;
  }
  function qsa(root, s, one) {
    s = String(s).replace(/:scope\s*>\s*/g, ':scope > ');
    const scoped = /^\s*:scope/.test(s);
    if (scoped) { const rest = s.replace(/^\s*:scope\s*>\s*/, ''); const out = root.children.filter(e => matchSel(e, rest.split(/\s+/)[0])); return rest.includes(' ') ? out.flatMap(e => qsa(e, rest.split(/\s+/).slice(1).join(' '), false)) : out; }
    // the fast road: a bare #id
    const mid = /^#([\w-]+)$/.exec(s.trim());
    if (mid) { const e = doc.getElementById(mid[1]); return e && root.contains(e) && e !== root ? [e] : (root === doc ? (e ? [e] : []) : walk(root).filter(x => x.id === mid[1]).slice(0, 1)); }
    const out = []; for (const e of walk(root)) if (matchSel(e, s)) { out.push(e); if (one) break; }
    return out;
  }

  // ---- the document --------------------------------------------------------------------------------
  class Document extends Node {
    constructor() { super(); this.nodeType = 9; this.nodeName = '#document'; this.readyState = 'loading'; this.visibilityState = 'visible'; this.hidden = false; this.cookie = ''; this.title = ''; this.fullscreenElement = null; this.pointerLockElement = null; this.fonts = { ready: Promise.resolve(), load: () => Promise.resolve([]), add() {}, check: () => true, addEventListener() {} }; }
    createElement(t) { t = String(t).toLowerCase(); return t === 'canvas' ? new Canvas() : t === 'img' ? new Img() : new Element(t); }
    createElementNS(ns, t) { return /svg/.test(ns || '') ? new Element(t, ns) : this.createElement(t); }
    createTextNode(s) { return new Text(s); } createComment(s) { return new Comment(s); } createDocumentFragment() { return new Fragment(); }
    createEvent() { return new Event(''); } createRange() { return { selectNodeContents() {}, setStart() {}, setEnd() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }), createContextualFragment: s => parse(s) }; }
    getElementById(id) { const s = byId.get(String(id)); if (!s) return null; for (const e of s) if (e.isConnected) return e; return null; }
    querySelector(s) { return qsa(this, s, true)[0] || null; } querySelectorAll(s) { return qsa(this, s, false); }
    getElementsByTagName(t) { t = t.toLowerCase(); return walk(this).filter(e => t === '*' || e.localName === t); }
    getElementsByClassName(c) { return this.documentElement.getElementsByClassName(c); }
    get children() { return this.childNodes.filter(c => c.nodeType === 1); }
    hasFocus() { return true; } exitPointerLock() {} exitFullscreen() { return Promise.resolve(); } getSelection() { return { removeAllRanges() {}, addRange() {}, toString: () => '' }; }
    elementFromPoint() { return null; } elementsFromPoint() { return []; }
    write(s) { if (opts.onWrite) opts.onWrite(s); }
    execCommand() { return false; }
  }
  const doc = new Document();
  const htmlEl = doc.createElement('html'), head = doc.createElement('head'), body = doc.createElement('body');
  doc.appendChild(htmlEl); htmlEl.appendChild(head); htmlEl.appendChild(body);
  doc.documentElement = htmlEl; doc.head = head; doc.body = body; doc.activeElement = body; doc.scrollingElement = htmlEl;
  if (opts.html) { const b0 = opts.html.search(/<body[^>]*>/i), b1 = opts.html.search(/<\/body>/i);
    const inner = b0 < 0 ? opts.html : opts.html.slice(opts.html.indexOf('>', b0) + 1, b1 < 0 ? undefined : b1);
    // the markup without its scripts: the harness runs those itself, in the page's order
    body.appendChild(parse(inner.replace(/<script[\s\S]*?<\/script>/gi, m => /type="text\/x-flydiy"/.test(m) ? m.replace(/>[\s\S]*<\/script>$/, '></script>') : ''))); }
  doc.readyState = 'complete';
  return { document: doc, Element, HTMLElement: Element, HTMLCanvasElement: Canvas, HTMLImageElement: Img, Node, Text, Event, CustomEvent, EventTarget, DocumentFragment: Fragment, parse };
}
module.exports = { makeDocument };
