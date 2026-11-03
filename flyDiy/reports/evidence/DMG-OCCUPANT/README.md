# DMG-OCCUPANT (G2373-G2377) - evidence

EVIDENCE ONLY. The game shows, per occupant, the seat's name and one of five words (Unharmed / Light injuries / Heavy
injuries / Life threatening / Fatal injuries) on a crash's card, nothing else. The numbers and the pictures below are the
gate's and HANDOVER's; none of them reaches the game.

- `gate_dmgoccupant.txt` - GATE DMGOCCUPANT's full output on claude/dmg-occupant (06c28ed9): the bands by case on the
  validated builds, the criteria behind each, the damage-off / read-only / intact-flight rows, the wire, the page's crash
  card under the physics worker and its scan. `dmgoccupant.json` - the same as data (the page's whole text dropped, its
  length kept).
- `gate_dmgoccupant_selftest.txt` - the negative verification (each fault must turn its row red).
- `pulse_<build>_<case>.svg` - each occupant's pulse (the seat's specific force in its own frame, CFC 60: x forward,
  y lateral, z spinal) through the standard crashes on the three land builds, the band and its criteria in the caption;
  a case the game's 4 g trigger never records is drawn from a record at 1.5 g (a test setting, said in its title).
  `pulses.json` - the bands and criteria per seat (tools/dmg_occupant_evidence.js).
- `gates_battery.txt` - the DMG gate set + TREECRASH UISMOKE BUILD JOIN SIMWORKER on the branch (run_gates --only).
