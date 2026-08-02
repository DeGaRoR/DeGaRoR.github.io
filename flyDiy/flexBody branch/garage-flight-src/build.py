#!/usr/bin/env python3
"""Build the artifact: inline flight_core.js and the 3d model layer into m3_template.html.
Usage: python3 build.py  ->  writes garage-flight.html
Run ALL gates green before building. Never ship red.
Regenerate pa18_model.js with tools/model_prep.py only if the source OBJ changes."""
import re

def strip_exports(src):
    return re.sub(r"if \(typeof module !== 'undefined'\)\s*\n?\s*module\.exports = \{[^}]*\};", '', src)

core = strip_exports(open('flight_core.js').read())
models = strip_exports(open('model_codec.js').read()) + '\n' + strip_exports(open('pa18_model.js').read())
t = open('m3_template.html').read()
t = t.replace('/*__CORE__*/', core).replace('/*__MODELS__*/', models)
open('garage-flight.html', 'w').write(t)
print("built garage-flight.html — syntax-check every <script> block with node --check before delivering")
