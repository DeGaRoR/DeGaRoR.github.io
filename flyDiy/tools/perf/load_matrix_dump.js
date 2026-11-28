// load_matrix_dump.js - what a row of tools/perf/load_matrix.sh saves from the page at the end of its load (boot_perf
// --dump-file): the flight recorder's log, whole, as PERF-TRACE's tools read it (tools/load_brief.js, program_report.js,
// load_timeline.js). Taken AFTER the reveal: the programs' table with its owners is built at this call. A build
// without the recorder's logParts gives an empty string (no file is kept, no brief is run).
(typeof FLIGHT_REC !== 'undefined' && FLIGHT_REC && FLIGHT_REC.rec && typeof FLIGHT_REC.rec.logParts === 'function' ? FLIGHT_REC.rec.logParts().join('') : '')
