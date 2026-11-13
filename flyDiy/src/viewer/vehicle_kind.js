// ============================================================
// THE VEHICLE KIND (TOW-LAUNCH, 13 Nov 2026) - one rule, one owner: what a build IS - 'plane' or 'car' (later 'trailer').
// Agreed with A0 (spec.kind written by the garage's save, absent = 'plane', so no plane file gains a key) and with
// Game's FLEET screen (its contract: the garage's Car part row spec.cage.isCar, the legacy spec.meta.car):
//   1. spec.kind when the save wrote one ('plane' | 'car' | 'trailer')
//   2. 'car' when the garage's Car part says so (spec.cage.isCar) or a legacy card carries spec.meta.car
//   3. 'plane' otherwise - every aeroplane ever saved
// A row of builds/lists/vehicles.json carries its own `kind` (a row without one is a car: the list is the vehicles').
// Eager (a few lines): the Fleet's tabs, the garage's rack and the roll-out ask it before any vehicle code is fetched.
// window.VEHICLE_KIND(spec_or_envelope) -> 'plane' | 'car' | 'trailer'; VEHICLE_KIND.row(vehiclesRow) -> its kind.
// ============================================================
(function (root) {
  'use strict';
  const KINDS = ['plane', 'car', 'trailer'];
  function vehicleKind(b) {
    const s = b && b.spec && typeof b.spec === 'object' ? b.spec : b;   // a saved envelope { what, name, spec } or a bare spec
    if (!s || typeof s !== 'object') return 'plane';
    // (CAR, 13 Nov: the garage's car switch, when the card HAS the row, is the live truth - a saved car whose switch was
    // since turned off is an aeroplane again before its next save rewrites spec.kind)
    if (s.cage && s.cage.isCar != null && s.cage.isCar !== '') {
      if (+s.cage.isCar > 0) return 'car';
      if (s.kind === 'car') return 'plane';
    }
    if (KINDS.includes(s.kind)) return s.kind;
    if (s.meta && s.meta.car) return 'car';
    return 'plane';
  }
  // what a save writes (garage.js saveAs / exportFile): spec.kind for a car or a trailer, NO key for an aeroplane
  vehicleKind.stamp = spec => { if (!spec || typeof spec !== 'object') return spec; const k = vehicleKind(spec);
    if (k === 'plane') delete spec.kind; else spec.kind = k; return spec; };
  vehicleKind.row = r => (r && KINDS.includes(r.kind) ? r.kind : 'car');
  vehicleKind.KINDS = KINDS;
  root.VEHICLE_KIND = vehicleKind;
  if (typeof module !== 'undefined') module.exports = { vehicleKind };
})(typeof window !== 'undefined' ? window : globalThis);
