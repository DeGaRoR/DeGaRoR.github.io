// depth.js <file> <marker>... - the brace depth at each marker (strings, template literals, comments skipped; regexes not)
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const marks = process.argv.slice(3);
let d = 0, line = 1, i = 0;
const n = src.length, stack = [];
while (i < n) {
  const c = src[i];
  if (c === '\n') { line++; i++; continue; }
  if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
  if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
  if (c === "'" || c === '"' || c === '`') { const q = c; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; if (src[i] === '\n') line++; i++; } i++; continue; }
  for (const k of marks) if (src.startsWith(k, i)) console.log(k.padEnd(28), 'line', line, 'depth', d, 'opened at line', stack[stack.length - 1]);
  if (c === '{') { d++; stack.push(line); } else if (c === '}') { d--; stack.pop(); }
  i++;
}
console.log('end depth', d);
