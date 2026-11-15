---
name: workbench-phone
description: Check flyDiy on the phone profile - phone-sized page stills, touch checks, the phone garage, the S20 FE real-device runs. Use for any phone/mobile UI or performance question.
---

# Phone checks

- Phones and tablets load the phone build of the game (`?profile=phone`). It's one version, never a second app.
- **Page stills and touch, portrait and landscape**: `node flyDiy/tools/phone_still.js --out <dir>/phone`. SwiftShader, light, no slot.
- **Plane pictures in the phone garage look**: `plane_shot.js` (see workbench-quick-render).
- **Gates**: UISMOKE-PHONE and UISMOKE-PHONEFLY, through `node flyDiy/tools/run_gates.js --only=UISMOKE-PHONE,UISMOKE-PHONEFLY`.
- **The real phone** (S20 FE over USB, `flyDiy/tools/perf/mobile_phone_cdp.js`): ONLY A0 or the user. The user's phone is private: touch nothing but the flyDiy tab, and send nothing anywhere.
- **Slider timing on desktop**, as a stand-in: `perf/phone_edit.js`. It runs on the GPU box, so it needs a slot.

## Traps (add yours)
- SwiftShader timings are not the phone's. Never report them as phone performance.
