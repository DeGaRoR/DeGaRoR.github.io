#!/usr/bin/env python3
"""Build the artifact: inline flight_core.js into m3_template.html.
Usage: python3 build.py  ->  writes garage-flight.html
Run ALL gates green before building. Never ship red."""
import re
core = open('flight_core.js').read()
core = re.sub(r"if \(typeof module !== 'undefined'\)\s*\n?\s*module\.exports = \{[^}]*\};", '', core)
t = open('m3_template.html').read()
open('garage-flight.html', 'w').write(t.replace('/*__CORE__*/', core))
print("built garage-flight.html — syntax-check every <script> block with node --check before delivering")
