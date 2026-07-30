// gate/run.js — CLI wrapper. `npm run gate`.
// 20 §6: one runner, invoked from the developer screen and from the build script.
//
// The runner itself is gate/orchestrator.js and the scope is gate/manifest.js.
// This file is deliberately thin: when the CLI owned the loop, the build and the
// developer panel each grew one of their own, and all three reported "green" for
// three different amounts of work (H4).

import { runGate, printSummary } from './orchestrator.js';

const report = await runGate({ log: console.log });
printSummary(report);
process.exit(report.failed === 0 ? 0 : 1);
