// load Jolene headless, export W
const fs = require('fs'), path = require('path');
const T = '/workspace/DeGaRoR.github.io/flyDiy/tools';
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
module.exports = (fx) => IN.islandWorld('jolene', { premises: fs.readFileSync(fx || path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
module.exports.C = C;
