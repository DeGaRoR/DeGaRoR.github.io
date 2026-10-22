// pi to 2000 bits (Machin), then 2/pi's first 66 x 24 bits after the binary point
const S = 2200n, ONE = 1n << S;
const atanInv = k => { let sum = 0n, term = ONE / k, n = 1n, sign = 1n; const k2 = k * k; while (term !== 0n) { sum += sign * term / n; term /= k2; n += 2n; sign = -sign; } return sum; };
const PI = 16n * atanInv(5n) - 4n * atanInv(239n);           // pi * 2^S
const B = 66n * 24n, twoOverPi = (2n << (S + B)) / PI;        // floor(2/pi * 2^B)
const out = []; for (let i = 0n; i < 66n; i++) out.push(Number((twoOverPi >> (B - 24n * (i + 1n))) & 0xFFFFFFn));
console.log(out.map(x => '0x' + x.toString(16).toUpperCase().padStart(6, '0')).join(', '));
// n * pi/2's high words (n = 1..32): the double nearest n*pi/2
const hw = []; for (let n = 1n; n <= 32n; n++) { const v = n * PI / 2n; // fixed
  // to double: exact rounding via string of the BigInt ratio
  const x = Number(v >> (S - 60n)) / 2 ** 60; const f = new Float64Array([x]), u = new Uint32Array(f.buffer); hw.push('0x' + u[1].toString(16).toUpperCase()); }
console.log(hw.join(', '));
