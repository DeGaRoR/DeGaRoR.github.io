// _src_strip.js — THE CODE, NOT THE COMMENTS, for source-scan gates (G2786).
//
// Every source-scan gate strips comments first so an assertion cannot pass on
// the prose that explains it. The old one-liner every gate copied,
//   s.replace(/\/\*[\s\S]*?\*\//g, '')
// is not a lexer: it opens a "comment" at ANY slash-star, string or not. In
// _cage_ui.js the photo picker's `f.accept = 'image/*'` (line ~4622) opened one,
// and while no star-slash followed it nothing happened; G2227 then wrote
// `republish /* G2227 */` on the file's last line and the fake comment closed
// there — 774 lines of real code vanished from SKINMAT's and WEATHER's view, and
// three rows went red on master with the code intact (the reframes, the four
// weather macro rows). Worse is the silent half: every NEGATIVE assertion over
// that span (`!/out\.wear = /`) passed on nothing.
//
// This walks the text with the four states JS needs — code, a quoted string,
// a template literal (with ${ } nesting), a regex literal (with its [ ] class)
// — and drops only real comments. Newlines inside a block comment are kept, so
// line-anchored patterns and line numbers survive; a one-line block comment
// becomes one space. CRLF is normalised first (JS's `.` does not match \r).
'use strict';

// a `/` starts a REGEX (not a division) after one of these, or after a keyword
const RX_PREV = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const RX_KW = /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

function stripComments(src) {
  const s = String(src).replace(/\r\n/g, '\n');
  const n = s.length, out = [];
  let i = 0, last = '';            // last significant (non-space) code character
  const tmpl = [];                 // brace depth per open template ${ }
  const lastWord = () => { const t = out.join('').slice(-16); return t; };
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') {                       // line comment
      while (i < n && s[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {                       // block comment
      const e = s.indexOf('*/', i + 2), end = e < 0 ? n : e + 2;
      const nl = s.slice(i, end).replace(/[^\n]/g, '');
      out.push(nl || ' ');
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {                       // quoted string
      let j = i + 1;
      while (j < n && s[j] !== c && s[j] !== '\n') j += s[j] === '\\' ? 2 : 1;
      out.push(s.slice(i, j + 1)); i = j + 1; last = c;
      continue;
    }
    if (c === '`' || (c === '}' && tmpl.length && tmpl[tmpl.length - 1] === 0)) {
      // template text: from a backtick, or from the } closing a ${ }
      if (c === '}') tmpl.pop();
      let j = i + 1;
      for (; j < n; j++) {
        if (s[j] === '\\') { j++; continue; }
        if (s[j] === '`') break;
        if (s[j] === '$' && s[j + 1] === '{') { tmpl.push(0); j++; break; }
      }
      out.push(s.slice(i, j + 1)); i = j + 1; last = s[j] === '`' ? '`' : '{';
      continue;
    }
    if (c === '/' && (RX_PREV.has(last) || RX_KW.test(lastWord()))) {   // regex literal
      let j = i + 1, cls = false;
      for (; j < n && s[j] !== '\n'; j++) {
        if (s[j] === '\\') { j++; continue; }
        if (cls) { if (s[j] === ']') cls = false; continue; }
        if (s[j] === '[') cls = true;
        else if (s[j] === '/') break;
      }
      if (j < n && s[j] === '/') {
        j++;
        while (j < n && /[a-z]/i.test(s[j])) j++;
        out.push(s.slice(i, j)); i = j; last = 'x';
        continue;
      }
      // not a regex after all (a division at a line's end): fall through
    }
    if (tmpl.length) { if (c === '{') tmpl[tmpl.length - 1]++; else if (c === '}') tmpl[tmpl.length - 1]--; }
    out.push(c);
    if (!/\s/.test(c)) last = /[\w$]/.test(c) ? 'x' : c;
    i++;
  }
  return out.join('');
}

// a gate's guard that its own view is whole: each landmark must survive the
// strip — the 'image/*' class of bug shows up here first, loudly, instead of
// as a row about something else
function stripLost(raw, stripped, landmarks) {
  return landmarks.filter(m => raw.indexOf(m) >= 0 && stripped.indexOf(m) < 0);
}

module.exports = { stripComments, stripLost };

// the self-test: every way the old one-liner went wrong, and the plain cases
if (require.main === module) {
  const cases = [
    ["a = 'image/*'; b = 1; /* c */ d = 2;", "a = 'image/*'; b = 1;   d = 2;"],
    ['x = "http://a"; // y', 'x = "http://a"; '],
    ['r = /a\\/\\*b/g; z = 1; /* q */', 'r = /a\\/\\*b/g; z = 1;  '],
    ['r = /[/*]/; k = 3; // t */', 'r = /[/*]/; k = 3; '],
    ['t = `a ${ {b: 1}.b } /* not */ c`; // gone', 't = `a ${ {b: 1}.b } /* not */ c`; '],
    ['q = a / b / c; /* x\n y */ w', 'q = a / b / c; \n w'],
    ['return /x/.test(s) // r', 'return /x/.test(s) '],
  ];
  let bad = 0;
  for (const [a, b] of cases) {
    const got = stripComments(a);
    if (got !== b) { bad++; console.log('FAIL', JSON.stringify(a), '->', JSON.stringify(got), 'want', JSON.stringify(b)); }
  }
  console.log(bad ? bad + ' FAIL' : 'src_strip: ' + cases.length + ' cases OK');
  process.exitCode = bad ? 1 : 0;
}
