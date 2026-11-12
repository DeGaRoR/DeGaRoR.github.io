// dt_steps.js - THE DRAFTING TABLE'S STEPS: what each step shows. The rows are the GARAGE'S rows (their labels,
// ranges and steps come from the garage's own definitions at run time, dt_build.rowDefs); this file only CHOOSES the
// short list a step needs (the user: "the minimum set, not the hacky ones") and which key measurements its numbers
// strip shows. Design: tools/DRAFTING_TABLE.md, "The steps".
(function (root) {
  'use strict';
  const STEPS = [
    { id: 'refs', n: 1, title: 'References', what: 'the exact variant, the published figures with their conditions, the blueprint sheet',
      km: ['span', 'length', 'wing.chord', 'stab.span', 'prop.dia', 'track'] },
    { id: 'sheet', n: 2, title: 'Scale', what: 'each view: its box on the sheet, its origin (the spinner tip; the hub head-on), its turn, its scale on a published figure',
      km: ['span', 'length'] },
    { id: 'arch', n: 3, title: 'Architecture', what: 'the start card and the choices that change the cage or the mass',
      sel: ['gearLayout', 'wgPos', 'wgBrace', 'engModel', 'prop', 'seatLayout', 'paxCount', 'section', 'canopy', 'suspension', 'finArch', 'class'],
      km: ['span', 'length', 'wing.le', 'tailpost', 'fin.top'] },
    { id: 'body', n: 4, title: 'Sections', what: 'the fuselage first: the sections\' lengths, the reference section, the frames, the windows',
      groups: [
        ['lengths', ['noseLen', 'pilotLen', 'paxLen', 'paxCount', 'boomLen', 'tailLen']],
        ['reference section', ['roofY', 'keelY', 'waistY', 'halfW', 'roofHalfW', 'floorY', 'bandH']],
        ['nose', ['aeroWsLen', 'aeroLen', 'aeroTipW', 'aeroTipH', 'aeroDroop', 'aeroRound']],
        ['cabin frame', ['frCabTopY', 'frCabBotY', 'frCabTopW', 'frCabBotW']],
        ['passenger frame', ['frPaxTopY', 'frPaxBotY', 'frPaxTopW', 'frPaxBotW']],
        ['boom and tail', ['aftRoofY', 'aftKeelY', 'frBoomTopW', 'frBoomBotW', 'boomMidPinch', 'boomMidPinchW', 'tailRoofY', 'tailKeelY', 'tailHalfW']],
        ['door windows (row 1)', ['paxWinN', 'paxWinShape', 'paxWinZ', 'paxWinPitch', 'paxWinY', 'paxWinW', 'paxWinH', 'paxWinR', 'paxWinR1', 'paxWinR2']],
        ['windows, row 2', ['win2N', 'win2Shape', 'win2Z', 'win2Y', 'win2W', 'win2H', 'win2R']],
        ['sills', ['winSillPilot', 'winSillPax']],
      ],
      km: ['body.front', 'cowl.back', 'tailpost', 'body.halfw', 'profile', 'window'] },
    { id: 'wing', n: 5, title: 'Wings and tail', what: 'span, chords, the LE station and height, the crank, the tips; fin and stab by preset and scale',
      groups: [
        ['wing', ['wgSpan', 'wgChord', 'wgChordTip', 'wgDx', 'wgDy', 'wgTipX', 'wgDihedral', 'wgIncidence', 'wgTip']],
        ['crank', ['wgCrankAt', 'wgCrankChord', 'wgCrankX', 'wgDihedralOut']],
        ['struts', ['wgStruts', 'wgStrutZ', 'wgStrutX']],
        ['fin', ['finHeight', 'finChord', 'finChordTip', 'finSweep', 'finHinge', 'finTipZ', 'finAftZ', 'finLEZ', 'finBaseZ']],
        ['stab', ['stSpan', 'stChord', 'stChordTip', 'stSweep', 'stY', 'stZ']],
      ],
      km: ['span', 'wing.chord', 'wing.le', 'wing.te', 'wing.top', 'wing.dihedral', 'strut.at', 'fin.top', 'fin.le.at', 'fin.te.at', 'fin.te', 'stab.span', 'stab.le', 'stab.te'] },
    { id: 'drive', n: 6, title: 'Drivetrain, cowl, gear', what: 'the engine and the prop on the thrust line, the cowl\'s front face and taper, the wheels where they are',
      groups: [
        ['engine', ['eng_mountGap', 'engY', 'cw_noseOff', 'cw_propD']],
        ['cowl', ['cw_cowlLen', 'cw_aftW', 'cw_aftH', 'cw_taperW', 'cw_taperH', 'cw_lidLen', 'cw_lidRise', 'cw_faceRise']],
        ['main wheels', ['s1Z', 's1X', 's1Drop', 's1AxZ', 's1R']],
        ['tail wheel', ['s2Z', 's2Drop', 's2_twLegDrop']],
      ],
      km: ['prop.dia', 'body.front', 'cowl.back', 'wheel.a', 'wheel.bottom', 'wheel.dia', 'track', 'tailwheel.a', 'tailwheel.bottom'] },
    { id: 'check', n: 7, title: 'Check and save', what: 'the whole table, the light checks, the quick 3D; save the plane file for the garage',
      km: null },
  ];
  // a KM row belongs to a step's strip when its id is listed, or starts with a listed prefix (profile..., window...)
  function kmIn(step, id) {
    if (!step.km) return true;
    return step.km.some(k => id === k || id.indexOf(k + '.') === 0 || id.indexOf(k) === 0 && /^(profile|window)/.test(k));
  }
  const api = { STEPS, kmIn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DT_STEPS = api;
})(typeof self !== 'undefined' ? self : this);
