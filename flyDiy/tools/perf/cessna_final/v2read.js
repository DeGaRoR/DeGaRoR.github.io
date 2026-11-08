const j = require(require('path').resolve(process.argv[2]));
const d = j.shape && j.shape.dims, sp = j.shape && j.shape.specs, m = j.cases.find(c => c.id === 'mtow'), mi = j.cases.find(c => c.id === 'min');
const f = (x, n = 2) => x == null ? '-' : (+x).toFixed(n);
console.log(process.argv[2].split(/[\/]/).pop().padEnd(10), 'empty', f(sp && sp.empty, 1), 'fuel', sp && sp.fuelL, 'hSpan', f(d && d.hSpan), 'Sh', f(d && d.Sh), 'Sv', f(d && d.Sv), 'len', f(d && d.length), '| MIN cg', f(mi.cgMAC, 1), 'sm', f(mi.sm, 1), 'de', f(mi.deAppr, 3), '| MTOW cg', f(m.cgMAC, 1), 'sm', f(m.sm, 1), 'Vs', f(m.Vs, 1), 'V75', f(m.V75, 0), 'roc', f(m.roc), 'TO', m.TOgrass, 'de', f(m.deAppr, 3));
