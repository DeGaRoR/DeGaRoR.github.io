/*
 * flyDiy — THE PISTON ENGINE VOICE (SND-ENGINE, G1610-G1619; SOUND-2026-10-04 §3.1).
 *
 * A PORT, NOT AN INVENTION (ruling s2). The waveguide engine below is
 * Antonio-R1's AudioWorklet (engine-sound-generator,
 * src/engine_sound_generator/engine_sound_generator_worklet.js + waveguide.js),
 * itself a JavaScript port of DasEtwas/enginesound (Rust), after
 *   S. Baldan, S. Delle Monache et al., "Physically informed car engine sound
 *   synthesis for virtual and augmented environments", SIVE @ IEEE VR 2015.
 * Each cylinder is a short waveguide chamber with intake, exhaust and extractor
 * pipes whose end reflections are modulated by valve functions of the crank
 * phase; the extractors feed a straight pipe, a muffler of parallel waveguides
 * and an outlet. Both upstream works are MIT; their notices follow, verbatim.
 *
 * ---------------------------------------------------------------------------
 * Copyright (c) 2021-2022 Antonio-R1
 * License: https://github.com/Antonio-R1/engine-sound-generator/blob/main/LICENSE | MIT
 *
 * Copyright (c) 2020 DasEtwas
 * License: https://github.com/DasEtwas/enginesound/blob/master/LICENSE | MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * ---------------------------------------------------------------------------
 *
 * WHAT CHANGED IN THE PORT, and why (everything else is the upstream code):
 *  1. SAMPLE-RATE INDEPENDENT. Upstream hard-codes 44 100 Hz and gives pipe
 *     lengths in samples. Here every length is metres (acoustic length at the
 *     port's 343 m/s, enginesound's `distance_to_samples`) and every filter a
 *     frequency, converted at construction with the worklet's `sampleRate`.
 *  2. PARAMETERISED PER INSTANCE from `engineSoundConfig` (engine_config.js):
 *     per-cylinder crank offsets (the firing order) and per-cylinder pipe
 *     lengths (enginesound's per-cylinder waveguides), cylinder count, stroke.
 *     Upstream spaces cylinders i/N and gives every one the same pipes.
 *  3. THE CRANK NOISE IS ZERO-MEAN. Upstream adds `i * LP(0.25 * random())`,
 *     whose mean is 0.125 cycle per cylinder index — a STATIC shift of the
 *     firing order, not a fluctuation. Kept the i-scaling (a crankshaft that
 *     winds up along its length), centred the noise as enginesound does.
 *  4. IGNITION AT THE REFERENCE'S PHASE. Antonio-R1 fires at x = 0, before the
 *     exhaust valve's 0.75; enginesound (gen.rs `fuel_ignition`) fires at 0.5,
 *     so the exhaust follows the power stroke. The reference wins.
 *  5. TWO-STROKE: one revolution per cycle, the piston once per cycle, ports
 *     around bottom dead centre in place of the 4-stroke's valve windows.
 *  6. ALLOCATION-FREE `process()`, DENORMAL-SAFE (a ±1e-18 bias in the
 *     excitation, and a sleeping network is zeroed), enginesound's soft limit
 *     on every waveguide read (WAVEGUIDE_MAX_AMP), a DC blocker at the output
 *     (enginesound's dc_lp), a NaN guard that resets rather than rings, and a
 *     SEEDED xorshift32 in place of Math.random (enginesound uses XorShiftRng)
 *     so a render is deterministic.
 *  7. THE AEROPLANE'S LIFE, added on top (SOUND §3.1): load, cycle-to-cycle
 *     combustion jitter, misfire and coughs on starvation, the starter and its
 *     cranking, the catch, the run-down, the after-shutdown ticking and the
 *     blower's whistle. The prop is NOT here (SND-PROP, wave 2): the second
 *     output carries engine and prop rpm for it.
 *
 * THE API (one AudioWorkletNode per engine):
 *   new AudioWorkletNode(ctx, 'flydiy-engine', {
 *     numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [1, 2],
 *     processorOptions: { config: engineSoundConfig(spec, i), seed: 1 + i,
 *                         heat: 0,             // 0..1, the exhaust's heat (ticking)
 *                         running: false, rpm: 0 } })   // already turning at
 *                                                       // `rpm` (no catch)
 *   output 0 — 1 channel: the mixed voice; or 3 channels when the node is made
 *              with outputChannelCount [3, 2]: exhaust, intake, block (for
 *              CORE's exterior / interior routing)
 *   output 1 — 2 channels, control signal: engine rpm / 1000, prop rpm / 1000
 *              (the voice's own rpm: cranking, catch surge and run-down
 *              included, so the prop voice spins with the engine it hears)
 *   AudioParams (all k-rate; see engineSoundInputs in engine_config.js):
 *     rpm 0..20000   engine crank rpm (out.rpmEng[i])
 *     load 0..1      throttle x power fraction: ignition strength, intake roar
 *     running 0|1    eng[i].running
 *     starter 0|1    eng[i].crank > 0 (the 1.5 s crank)
 *     starve 0..1    the last seconds of fuel: misfires and coughs
 *     cold 0..1      a cold engine runs rougher
 *   port messages:
 *     { type: 'config', config, seed? }  rebuild the voice (allocates — not
 *                                        on the audio callback's hot path)
 *     { type: 'reset' }                  silence every pipe
 *     { type: 'heat', value }            the after-shutdown ticking's heat 0..1
 */
'use strict';

const SPEED_OF_SOUND = 343;          // m/s — the port's constant: lengths are acoustic lengths at it
const WAVEGUIDE_MAX_AMP = 20.0;      // enginesound gen.rs: above it a waveguide read is soft-limited
const DENORMAL_BIAS = 1e-18;         // far above float32's 1.2e-38, far below hearing
const TWO_PI = 2 * Math.PI;
const R30 = 1 / 1073741824;          // 2^-30: _r30() -> [0, 1)

const metresToSamples = (m, sr) => Math.max(1, Math.round((+m > 0 ? +m : 0) / SPEED_OF_SOUND * sr));

/*
 * ALLOCATION-FREE BY CONSTRUCTION. A JavaScript call that passes or returns a
 * double which the optimiser declines to inline boxes that double on the heap
 * (measured: ~140 B a block before this layout, so a GC every few seconds on
 * the audio thread). So no method on the per-sample path takes or returns a
 * double: its inputs and outputs are fields (a double field is updated in
 * place), the delay-line writes and enginesound's soft limit are written out
 * inside Waveguide.add, the low-pass filters are stepped inline by the network,
 * and the random source returns a 30-bit integer (a small integer is never
 * boxed). The structure — and every equation — is upstream's.
 */

/*
 * a lowpass filter based on https://en.wikipedia.org/wiki/Low-pass_filter#Simple_infinite_impulse_response_filter
 * (upstream's, with the rate passed in; stepped inline: y += alpha (x - y))
 */
class LowpassFilter {
   constructor (frequency, sr, lastValue = 0.0) {
      this.lastValue = lastValue;
      this.setFrequency(frequency, sr);
   }

   setFrequency (frequency, sr) {
      const w = TWO_PI * frequency / sr;
      this.frequency = frequency;
      this.alpha = w / (w + 1.0);
   }

   // upstream's method, for callers off the per-sample path
   getFilteredValue (value) {
      const filteredValue = this.lastValue + this.alpha * (value - this.lastValue);
      this.lastValue = filteredValue;
      return filteredValue;
   }
}

class DelayLine {

   constructor (length) {
      if (length < 1) {
         throw new Error("The length of the delay line needs to be a positive value.");
      }
      this.data = new Float32Array(length);
      this.index = 0;
   }

   // upstream's updateLeft / updateRight / getAtPosition(0) are written out in
   // Waveguide.add: write at the head, then step it forward (left) or back
   // (right); the head then holds the sample written `length` updates ago

   clear () {
      this.data.fill(0);
      this.index = 0;
   }
}

class Waveguide {

   constructor (length, reflectionFactorLeft, reflectionFactorRight) {
      this.upper = new DelayLine(length);
      this.lower = new DelayLine(length);
      this.reflectionFactorLeft = reflectionFactorLeft;
      this.reflectionFactorRight = reflectionFactorRight;
      this.outputLeft = 0.5; this.outputLeft = 0.0;     // (a double field from birth)
      this.outputRight = 0.5; this.outputRight = 0.0;
      this.valueLeft = 0.5; this.valueLeft = 0.0;       // add()'s two inputs
      this.valueRight = 0.5; this.valueRight = 0.0;
   }

   // upstream's add(valueLeft, valueRight), the inputs in this.valueLeft/Right
   add () {
      const lo = this.lower, up = this.upper;
      const ld = lo.data, ud = up.data;
      let lowerValue = ld[lo.index], upperValue = ud[up.index];
      // enginesound gen.rs WaveGuide::dampen — a soft knee above WAVEGUIDE_MAX_AMP
      if (lowerValue > WAVEGUIDE_MAX_AMP) lowerValue = 1.0 + WAVEGUIDE_MAX_AMP - 1.0/(lowerValue - WAVEGUIDE_MAX_AMP + 1.0);
      else if (lowerValue < -WAVEGUIDE_MAX_AMP) lowerValue = -(1.0 + WAVEGUIDE_MAX_AMP - 1.0/(-lowerValue - WAVEGUIDE_MAX_AMP + 1.0));
      if (upperValue > WAVEGUIDE_MAX_AMP) upperValue = 1.0 + WAVEGUIDE_MAX_AMP - 1.0/(upperValue - WAVEGUIDE_MAX_AMP + 1.0);
      else if (upperValue < -WAVEGUIDE_MAX_AMP) upperValue = -(1.0 + WAVEGUIDE_MAX_AMP - 1.0/(-upperValue - WAVEGUIDE_MAX_AMP + 1.0));

      const reflectedValueLeft = lowerValue*this.reflectionFactorLeft;
      this.outputLeft = lowerValue*(1.0-this.reflectionFactorLeft);

      const reflectedValueRight = upperValue*this.reflectionFactorRight;
      this.outputRight = upperValue*(1.0-this.reflectionFactorRight);

      // this.upper.updateRight(valueLeft+reflectedValueLeft)
      let i = up.index;
      ud[i] = this.valueLeft+reflectedValueLeft;
      up.index = i > 0 ? i-1 : ud.length-1;
      // this.lower.updateLeft(valueRight+reflectedValueRight)
      i = lo.index;
      ld[i] = this.valueRight+reflectedValueRight;
      lo.index = i+1 < ld.length ? i+1 : 0;
   }

   clear () {
      this.upper.clear();
      this.lower.clear();
      this.outputLeft = 0.0;
      this.outputRight = 0.0;
   }
}

class Cylinder {

   constructor ({index,

                cylinderWaveguideLength,
                intakeWaveguideLength,
                exhaustWaveguideLength,
                extractorWaveguideLength,

                intakeOpenReflectionFactor,
                intakeClosedReflectionFactor,

                exhaustOpenReflectionFactor,
                exhaustClosedReflectionFactor,

                ignitionTime, pistonFactor, ignitionFactor, twoStroke}) {
      this.index = index;

      this.cylinderWaveguide = new Waveguide(cylinderWaveguideLength, 0.75, 0.75);

      this.intakeWaveguide = new Waveguide(intakeWaveguideLength, 0.01, intakeOpenReflectionFactor);
      this.exhaustWaveguide = new Waveguide(exhaustWaveguideLength, exhaustClosedReflectionFactor, 0.01);
      this.extractorWaveguide = new Waveguide(extractorWaveguideLength, 0.01, 0.01);

      this.intakeOpenReflectionFactor = intakeOpenReflectionFactor;
      this.intakeClosedReflectionFactor = intakeClosedReflectionFactor;

      this.exhaustOpenReflectionFactor = exhaustOpenReflectionFactor;
      this.exhaustClosedReflectionFactor = exhaustClosedReflectionFactor;

      this.ignitionTime = ignitionTime;
      this.pistonFactor = pistonFactor;       // upstream's 1.5
      this.ignitionFactor = ignitionFactor;   // upstream's 5.0
      this.twoStroke = !!twoStroke;

      this.intakeValve = 0.5; this.intakeValve = 0.0;
      this.exhaustValve = 0.5; this.exhaustValve = 0.0;
      this.pistonMotion = 0.5; this.pistonMotion = 0.0;
      this.fuelIgnition = 0.5; this.fuelIgnition = 0.0;

      // THE LIFE (flyDiy): this cycle's combustion strength (load, jitter,
      // misfire), drawn by the processor when the cylinder's phase wraps
      this.ignitionGain = 0.5; this.ignitionGain = 1.0;
      this.lastX = 0.5; this.lastX = 0.0;
      this.currentCylinderAmplitude = 0.5; this.currentCylinderAmplitude = 0.0;
      // update()'s inputs (upstream's arguments): the phase, the intake noise,
      // the straight pipe's backward wave, the anti-denormal bias
      this.x = 0.5; this.x = 0.0;
      this.intakeNoise = 0.5; this.intakeNoise = 0.0;
      this.straightPipeOutputLeft = 0.5; this.straightPipeOutputLeft = 0.0;
      this.bias = 0.5; this.bias = 0.0;
   }

   updateWaveguidesReflectionValues () {
      this.intakeWaveguide.reflectionFactorRight = this.intakeOpenReflectionFactor*this.intakeValve+
                                                   this.intakeClosedReflectionFactor*(1.0-this.intakeValve);
      this.cylinderWaveguide.reflectionFactorLeft = this.intakeOpenReflectionFactor*this.intakeValve+
                                                    this.intakeClosedReflectionFactor*(1.0-this.intakeValve);

      this.exhaustWaveguide.reflectionFactorLeft = this.exhaustOpenReflectionFactor*this.exhaustValve+
                                                   this.exhaustClosedReflectionFactor*(1.0-this.exhaustValve);
      this.cylinderWaveguide.reflectionFactorRight = this.exhaustOpenReflectionFactor*this.exhaustValve+
                                                     this.exhaustClosedReflectionFactor*(1.0-this.exhaustValve);
   }

   // upstream's update(intakeNoise, straightPipeOutputLeft, x), its arguments
   // in fields; the valve, piston and ignition functions written out below
   update () {
      const x = this.x;
      if (this.twoStroke) {
         // the two-stroke's ports, open around bottom dead centre (x = 0; the
         // charge fires at top dead centre, x = 0.5): exhaust over +-72 deg,
         // the transfer over +-54 deg; the piston once a cycle
         let u = x < 0.5 ? x + 0.2 : x - 0.8;
         this.exhaustValve = (u > 0 && u < 0.4) ? Math.sin(Math.PI*u/0.4) : 0.0;
         u = x < 0.5 ? x + 0.15 : x - 0.85;
         this.intakeValve = (u > 0 && u < 0.3) ? Math.sin(Math.PI*u/0.3) : 0.0;
         this.pistonMotion = Math.cos(TWO_PI*x);
      } else {
         // _exhaustValve, _intakeValve, _pistonMotion
         this.exhaustValve = (0.75 < x && x < 1.0) ? -Math.sin(4.0*Math.PI*x) : 0.0;
         this.intakeValve = (0 < x && x < 0.25) ? Math.sin(4.0*Math.PI*x) : 0.0;
         this.pistonMotion = Math.cos(4.0*Math.PI*x);
      }
      // _fuelIgnition, after enginesound gen.rs fuel_ignition: a half sine from
      // x = 0.5, t/2 long (Antonio-R1 fires at 0; the reference wins, so the
      // exhaust valve's opening follows the power stroke)
      const t = this.ignitionTime;
      this.fuelIgnition = (0.5 < x && x < 0.5*t+0.5) ? Math.sin(2.0*Math.PI*((x-0.5)/t)) : 0.0;

      this.updateWaveguidesReflectionValues ();

      const intakeNoise = this.intakeNoise*this.intakeValve;
      const currentCylinderAmplitude = this.pistonMotion*this.pistonFactor+
                                       this.fuelIgnition*this.ignitionFactor*this.ignitionGain+this.bias;

      this.currentCylinderAmplitude = currentCylinderAmplitude;
      const ext = this.extractorWaveguide, exh = this.exhaustWaveguide;
      const cylw = this.cylinderWaveguide, inw = this.intakeWaveguide;
      const extractorOutputLeft = ext.outputLeft;
      const cylinderOutputLeft = cylw.outputLeft;
      const cylinderOutputRight = cylw.outputRight;
      const intakeOutputRight = inw.outputRight;

      ext.valueLeft = exh.outputRight; ext.valueRight = this.straightPipeOutputLeft;
      ext.add ();
      exh.valueLeft = cylinderOutputRight; exh.valueRight = extractorOutputLeft;
      exh.add ();
      cylw.valueLeft = currentCylinderAmplitude+intakeOutputRight*(1.0-inw.reflectionFactorRight);
      cylw.valueRight = extractorOutputLeft*(1.0-exh.reflectionFactorLeft);
      cylw.add ();
      inw.valueLeft = intakeNoise; inw.valueRight = cylinderOutputLeft*(1.0-inw.reflectionFactorRight);
      inw.add ();
   }

   clear () {
      this.cylinderWaveguide.clear();
      this.intakeWaveguide.clear();
      this.exhaustWaveguide.clear();
      this.extractorWaveguide.clear();
   }
}

class Muffler {
   constructor ({elementLengths, action}) {
      this.elements = [];
      this.elementsCount = elementLengths.length;
      this.elementsCountInverse = 1.0/this.elementsCount;
      for (let i=0; i<elementLengths.length; i++) {
         this.elements[i] = new Waveguide (elementLengths[i], 0.0, action);
      }
      this.outputLeft = 0.5; this.outputLeft = 0.0;
      this.outputRight = 0.5; this.outputRight = 0.0;
      this.mufflerInput = 0.5; this.mufflerInput = 0.0;   // update()'s two inputs
      this.outletValue = 0.5; this.outletValue = 0.0;
   }

   // upstream's update(mufflerInput, outletValue), the inputs in fields
   update () {
      const mufflerInput = this.elementsCountInverse*this.mufflerInput;
      const outletValue = this.elementsCountInverse*this.outletValue;
      let outputLeft = 0.0, outputRight = 0.0;
      for (let i=0; i<this.elementsCount; i++) {
         const e = this.elements[i];
         outputLeft += e.outputLeft;
         outputRight += e.outputRight;
         e.valueLeft = mufflerInput; e.valueRight = outletValue;
         e.add();
      }
      this.outputLeft = outputLeft;
      this.outputRight = outputRight;
   }

   clear () {
      for (let i=0; i<this.elementsCount; i++) this.elements[i].clear();
      this.outputLeft = 0.0;
      this.outputRight = 0.0;
   }
}

/*
 * THE NETWORK — upstream's EngineSoundGenerator (updateParameters +
 * _updateSample), lifted out of the processor so it can be built from a config
 * and owned by the processor's life model.
 */
class EngineNetwork {
   constructor (cfg, sr) {
      const N = Math.max(1, cfg.cyl | 0);
      const at = (arr, i, d) => (arr && arr.length ? +arr[i % arr.length] : d);
      this.sr = sr;
      this.secondsPerSample = 1.0/sr;
      this.cycleRevs = cfg.twoStroke ? 1 : 2;
      this.cylinders = [];
      this.offsets = new Float64Array(N);
      for (let i=0; i<N; i++) {
         this.offsets[i] = at(cfg.offsets, i, i/N);
         this.cylinders.push(new Cylinder({index: i,
            cylinderWaveguideLength: metresToSamples(cfg.cylinderLen, sr),
            intakeWaveguideLength: metresToSamples(at(cfg.intakeLen, i, 0.78), sr),
            exhaustWaveguideLength: metresToSamples(at(cfg.exhaustLen, i, 0.78), sr),
            extractorWaveguideLength: metresToSamples(at(cfg.extractorLen, i, 0.78), sr),
            intakeOpenReflectionFactor: cfg.intakeOpenRefl,
            intakeClosedReflectionFactor: cfg.intakeClosedRefl,
            exhaustOpenReflectionFactor: cfg.exhaustOpenRefl,
            exhaustClosedReflectionFactor: cfg.exhaustClosedRefl,
            ignitionTime: cfg.ignitionTime,
            pistonFactor: cfg.pistonK, ignitionFactor: cfg.ignitionK,
            twoStroke: cfg.twoStroke}));
      }
      this.straightPipe = new Waveguide (metresToSamples(cfg.straightPipeLen, sr),
                                         cfg.straightPipeRefl, cfg.straightPipeRefl);
      this.muffler = new Muffler ({elementLengths: cfg.mufflerLens.map(m => metresToSamples(m, sr)),
                                   action: cfg.mufflerAction});
      this.outlet = new Waveguide (metresToSamples(cfg.outletLen, sr), cfg.outletRefl, cfg.outletRefl);

      this.intakeNoiseLowPassFilter = new LowpassFilter (cfg.intakeNoiseHz, sr);
      this.crankshaftLowPassFilter = new LowpassFilter (cfg.crankFluctHz, sr);
      this.engineLowPassFilter = new LowpassFilter (cfg.blockLpHz, sr);
      this.crankFluct = cfg.crankFluct;

      this.currentRevolution = 0.5; this.currentRevolution = 0.0;
      this.cough = 0.5; this.cough = 0.0;          // an unburnt charge going off in the pipe
      this.coughDecay = Math.exp(-1/(0.018*sr));
      this.bias = DENORMAL_BIAS;
   }

   clear () {
      for (let i=0; i<this.cylinders.length; i++) this.cylinders[i].clear();
      this.straightPipe.clear();
      this.muffler.clear();
      this.outlet.clear();
      this.intakeNoiseLowPassFilter.lastValue = 0.0;
      this.crankshaftLowPassFilter.lastValue = 0.0;
      this.engineLowPassFilter.lastValue = 0.0;
      this.cough = 0.0;
   }
}

/*
 * THE PROCESSOR. The network is upstream's; around it, the life of an
 * aeroplane engine — all per-block decisions, all per-sample state in fields
 * and typed arrays, nothing allocated once constructed.
 */
class FlyDiyEngineProcessor extends AudioWorkletProcessor {

   static get parameterDescriptors () {
      return [
         { name: 'rpm',     defaultValue: 0, minValue: 0, maxValue: 20000, automationRate: 'k-rate' },
         { name: 'load',    defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
         { name: 'running', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
         { name: 'starter', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
         { name: 'starve',  defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
         { name: 'cold',    defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      ];
   }

   constructor (options) {
      super ();
      const po = (options && options.processorOptions) || {};
      this.sr = sampleRate;
      this.rs = new Uint32Array(1);
      this.tickF = new Float64Array(12);    // three resonators: b1[3] b2[3] y1[3] y2[3]
      // counters, for the gate and the dev panel: cycles drawn, misfires, the
      // sum and sum of squares of the firing strength's spread, ticks
      this.stats = new Float64Array(5);
      this._build(po.config || null, po.seed, po.heat);
      // an engine already turning when the voice is made (a spawn in flight,
      // a re-made voice): no catch, no spool-up from rest
      if (po.running) {
         this.wasRunning = true;
         this.catchT = 9;
         this.vRpm = po.rpm > 0 ? +po.rpm : this.idleRpm;
         this.level = 0.5;
      }
      if (this.port) {
         this.port.onmessage = (event) => this._onMessage(event.data);
      }
   }

   _onMessage (msg) {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'config') this._build(msg.config, msg.seed == null ? this.seed : msg.seed, this.heat);
      else if (msg.type === 'reset') { if (this.net) this.net.clear(); this.vRpm = 0; }
      else if (msg.type === 'heat') this.heat = Math.max(0, Math.min(1, +msg.value || 0));
   }

   _build (cfg, seed, heat) {
      this.cfg = cfg;
      this.seed = (seed >>> 0) || 1;
      this.rs[0] = this.seed;
      for (let i = 0; i < 8; i++) this._r30();
      this.piston = !!(cfg && cfg.piston);
      this.net = this.piston ? new EngineNetwork(cfg, this.sr) : null;
      const c = cfg || {};
      this.ratedRpm = c.ratedRpm > 0 ? c.ratedRpm : 2500;
      this.idleRpm = c.idleRpm > 0 ? c.idleRpm : 0.28 * this.ratedRpm;
      this.crankRpm = c.crankRpm > 0 ? c.crankRpm : 180;
      this.gear = c.gear > 0 ? c.gear : 1;
      this.firingsPerCycle = Math.max(1, c.cyl | 0);
      this.mixI = c.mix ? +c.mix.intake : 0.3;
      this.mixB = c.mix ? +c.mix.block : 0.2;
      this.mixE = c.mix ? +c.mix.exhaust : 0.6;
      this.gain = c.gain > 0 ? c.gain : 0.1;
      const J = c.jitter || {};
      this.jIdle = J.idle != null ? +J.idle : 0.35;
      this.jCruise = J.cruise != null ? +J.cruise : 0.05;
      this.jCold = J.cold != null ? +J.cold : 0.25;
      this.misIdle = J.misIdle != null ? +J.misIdle : 0.01;
      const S = c.starter || {};
      this.starterHzPerRpm = (S.pinion > 0 ? S.pinion : 12) * (S.segments > 0 ? S.segments : 16) / 60;
      this.starterLevel = S.level != null ? +S.level : 0.12;
      const B = c.blower || {};
      this.blowerKind = B.kind === 'turbo' ? 2 : B.kind === 'super' ? 1 : 0;
      this.blowerHz = B.hz > 0 ? B.hz : 4000;
      this.blowerLevel = B.level != null ? +B.level : 0.02;
      this.tickLevel = c.tick && c.tick.level != null ? +c.tick.level : 0.05;
      this.tickRate = c.tick && c.tick.rate != null ? +c.tick.rate : 4;
      this.heatTau = c.heatTau > 0 ? c.heatTau : 120;

      // the life's state
      this.vRpm = 0;            // the voice's own engine rpm (inertia, cranking, surge, run-down)
      this.wasRunning = false;
      this.catchT = 9; this.catching = false;
      this.offT = 1e9;          // seconds since the engine stopped
      this.heat = Math.max(0, Math.min(1, +heat || 0));
      this.starterEnv = 0;
      this.misEMA = 0;
      this.spool = 0;           // a turbo's spool, 0..1
      this.quietT = 0; this.asleep = false;
      this.phStarter = 0; this.phBlower = 0;
      this.dc0 = this.dc1 = this.dc2 = 0;     // DC blockers: last input per channel
      this.dy0 = this.dy1 = this.dy2 = 0;     //              last output per channel
      this.dcR = 1 - TWO_PI * 5 / this.sr;    // 5 Hz: below an A-65's 22 Hz idle firing
      this.biasSign = 1;
      this.tickF.fill(0);
      this.tickEnergy = 0;
      // per-block decisions, read by the sample loop
      this.comb = 0; this.pMis = 0; this.sigma = 0; this.popProb = 0;
      this.intakeK = 0; this.crankMod = 0; this.tgt = 0; this.alphaRpm = 0; this.fric = 0;
      this.level = 0; this.levelTgt = 0; this.levelA = 0;
      this.blowerAmp = 0; this.blowerF = 0; this.tickP = 0;
   }

   // xorshift32 on a typed cell (a 32-bit state in a plain field would box),
   // returning its top 30 bits: a small integer, never boxed; x R30 -> [0, 1)
   _r30 () {
      let x = this.rs[0];
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.rs[0] = x;
      return this.rs[0] >>> 2;
   }

   _block (n, parameters) {
      const P = parameters;
      let rpmIn = P.rpm ? +P.rpm[0] : 0;
      if (!(rpmIn >= 0)) rpmIn = 0; else if (rpmIn > 20000) rpmIn = 20000;
      let load = P.load ? +P.load[0] : 0;
      if (!(load >= 0)) load = 0; else if (load > 1) load = 1;
      const running = P.running ? P.running[0] > 0.5 : false;
      const starter = P.starter ? P.starter[0] > 0.5 : false;
      let starve = P.starve ? +P.starve[0] : 0;
      if (!(starve >= 0)) starve = 0; else if (starve > 1) starve = 1;
      let cold = P.cold ? +P.cold[0] : 0;
      if (!(cold >= 0)) cold = 0; else if (cold > 1) cold = 1;
      const dtB = n / this.sr;

      // the transitions: a catch when the key brings a stopped engine to life,
      // a run-down when it dies
      if (running && !this.wasRunning) {
         this.catchT = 0;
         this.catching = this.vRpm < 0.85 * this.idleRpm;
      }
      if (!running && this.wasRunning) this.offT = 0;
      this.wasRunning = running;
      if (running) {
         this.catchT += dtB;
         if (this.catchT > 2.0) this.catching = false;
         this.heat = Math.min(1, this.heat + dtB * (0.3 + 0.7 * load) / this.heatTau);
         this.offT = 1e9;
      } else {
         if (this.offT < 1e8) this.offT += dtB;
         this.heat -= this.heat * dtB / 900;
      }
      const cranking = starter && !running;
      const kS = 1 - Math.exp(-dtB / (cranking ? 0.06 : 0.25));
      this.starterEnv += ((cranking ? 1 : 0) - this.starterEnv) * kS;
      if (this.starterEnv < 1e-6) this.starterEnv = 0;

      // the rpm the voice turns at
      const idle = this.idleRpm, rated = this.ratedRpm;
      let tgt = rpmIn, tau;
      if (running) {
         let surge = 0;
         if (this.catching && this.catchT > 0.25 && this.catchT < 1.25)
            surge = 0.45 * idle * Math.sin(Math.PI * (this.catchT - 0.25));
         // a starving engine sags on its misfires (an idle's odd miss does not
         // move the tacho: the sim's rpm is the authority there)
         tgt = rpmIn * (1 - 0.3 * this.misEMA * Math.min(1, 2 * starve)) + surge;
         tau = tgt > this.vRpm ? (this.catching ? 0.16 : 0.3) : 0.45;
      } else if (this.starterEnv > 0.01) {
         tgt = Math.max(rpmIn, this.crankRpm * this.starterEnv);
         tau = 0.2;
      } else {
         tau = 1.2;                                           // the run-down's inertia...
      }
      // ...and its friction and compression, which stop a dead engine in ~2 s
      // from idle rather than letting an exponential's tail turn it for ever
      this.fric = (!running && this.starterEnv <= 0.01) ? 120 / this.sr : 0;
      this.tgt = tgt;
      this.alphaRpm = 1 - Math.exp(-1 / (tau * this.sr));

      // the combustion: strength from the load, roughness from idle and cold,
      // misfires from starvation and from a catching engine's first cycles
      let idleness = (0.75 * rated - this.vRpm) / Math.max(1, 0.75 * rated - idle);
      idleness = idleness < 0 ? 0 : idleness > 1 ? 1 : idleness;
      const coldE = Math.max(cold, this.catching ? 0.6 : 0);
      this.sigma = this.jCruise + (this.jIdle - this.jCruise) * Math.pow(idleness, 1.5)
                 + this.jCold * coldE;
      if (running) {
         this.comb = 0.35 + 0.65 * load;
         let pm = this.misIdle * idleness * (1 + 2 * coldE);
         const ps = 0.85 * Math.pow(starve, 1.5);
         if (ps > pm) pm = ps;
         if (this.catching) {
            const pc = 0.7 * Math.max(0, 1 - this.catchT / 0.6);
            if (pc > pm) pm = pc;
         }
         this.pMis = pm;
         this.popProb = 0;
      } else {
         this.comb = 0;
         this.pMis = 0;
         // the last stray firings of a dying engine
         this.popProb = (this.offT < 2.5 && this.vRpm > 0.3 * idle) ? 0.05 + 0.25 * starve : 0;
      }
      this.intakeK = running ? (0.25 + 0.75 * load) : (0.08 + 0.2 * this.starterEnv);
      // THE LEVEL the load gives (flyDiy): the waveguide's pulses barely grow
      // with the ignition strength (the piston term dominates them), while a
      // real engine is 10-15 dB louder at full power than at idle — the
      // pressure at the exhaust valve's opening goes with the load
      const vr = Math.min(1, this.vRpm / rated);
      this.levelTgt = running ? (0.28 + 0.72 * load) * (0.55 + 0.45 * vr)
                    : 0.3 * Math.max(this.starterEnv, Math.min(1, this.vRpm / idle));
      this.levelA = 1 - Math.exp(-1 / (0.08 * this.sr));
      this.crankMod = running ? 0 : 0.32 * this.starterEnv;

      // the blower: a supercharger turns with the crank; a turbo spools on
      // the exhaust's energy, slowly
      if (this.blowerKind) {
         const want = running ? Math.min(1, this.vRpm / rated) * (this.blowerKind === 2 ? 0.2 + 0.8 * load : 1) : 0;
         const sp = this.blowerKind === 2 ? 1.8 : 0.4;
         this.spool += (want - this.spool) * (1 - Math.exp(-dtB / sp));
         this.blowerF = this.blowerHz * (this.blowerKind === 2 ? this.spool : Math.min(1.3, this.vRpm / rated));
         this.blowerAmp = this.blowerLevel * this.spool * this.spool;
      } else this.blowerAmp = 0;

      // the ticks of a cooling exhaust
      const quietNow = !running && this.vRpm < 30;
      this.tickP = (quietNow && this.offT < 1e8 && this.offT > 2.5)
         ? this.tickRate * this.heat * Math.exp(-(this.offT - 2.5) / 150) / this.sr : 0;

      // sleep: a stopped, silent engine stops computing (and its pipes are
      // zeroed, which is also the last word on denormals)
      if (!running && this.starterEnv === 0 && this.vRpm < 5 && rpmIn < 5) this.quietT += dtB;
      else { this.quietT = 0; this.asleep = false; }
      if (!this.asleep && this.quietT > 1.5 && this.net && this.sleepEnabled !== false) {
         this.net.clear();
         this.asleep = true;
      }
   }

   process (inputs, outputs, parameters) {
      const out0 = outputs[0];
      if (!out0 || !out0.length) return true;
      const ch0 = out0[0], n = ch0.length;
      const split = out0.length >= 3;
      const ch1 = split ? out0[1] : null, ch2 = split ? out0[2] : null;
      const ctl = outputs.length > 1 && outputs[1] && outputs[1].length >= 2 ? outputs[1] : null;
      if (!this.piston) {
         ch0.fill(0);
         if (split) { ch1.fill(0); ch2.fill(0); }
         if (ctl) { ctl[0].fill(0); ctl[1].fill(0); }
         return true;
      }
      this._block(n, parameters);

      // EVERYTHING BELOW IS ONE FUNCTION, ON PURPOSE: the per-cycle draw and
      // the tick are rare, so as methods they would run in V8's lower tiers,
      // where every double is a heap allocation. Inline, they share the
      // optimised loop. The random source is xorshift32 in a local int.
      let rs = this.rs[0] | 0;
      const net = this.net, cyls = net.cylinders, N = cyls.length, offs = net.offsets;
      const sr = this.sr, spS = net.secondsPerSample, cycleRevs = net.cycleRevs;
      const aR = this.alphaRpm, tgt = this.tgt, fric = this.fric;
      const crankMod = this.crankMod, fpc = this.firingsPerCycle;
      const intakeK = this.intakeK * this.cfg.intakeNoiseK;
      const mixI = this.mixI, mixB = this.mixB, mixE = this.mixE, gain = this.gain;
      const stLevel = this.starterLevel * this.starterEnv, stHz = this.starterHzPerRpm;
      const blAmp = this.blowerAmp, blF = this.blowerF / sr;
      const tickP = this.tickP, F = this.tickF, ST = this.stats;
      const comb = this.comb, pMis = this.pMis, sigma = this.sigma, popProb = this.popProb;
      const dcR = this.dcR, invGear = 1 / this.gear;
      const asleep = this.asleep;
      const inLp = net.intakeNoiseLowPassFilter, ckLp = net.crankshaftLowPassFilter;
      const bLp = net.engineLowPassFilter;
      const sp = net.straightPipe, mu = net.muffler, ol = net.outlet;
      for (let s = 0; s < n; s++) {
         let v = this.vRpm + aR * (tgt - this.vRpm);
         if (fric > 0 && v > tgt) { v -= fric; if (v < tgt) v = tgt; }
         if (v < 1e-3) v = 0;
         this.vRpm = v;
         let intake = 0.0, block = 0.0, exhaust = 0.0;
         if (!asleep) {
            // the cranking engine labours through each compression
            const rpmInst = crankMod > 0
               ? v * (1 + crankMod * Math.sin(TWO_PI * net.currentRevolution * fpc)) : v;
            // ---- upstream's _updateSample, per sample ----
            rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
            inLp.lastValue += inLp.alpha * ((2.0*(rs >>> 2)*R30-1.0) - inLp.lastValue);
            let intakeNoise = inLp.lastValue * intakeK;
            if (rpmInst < 25.0) {
               intakeNoise = 0.0;
            }
            rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
            ckLp.lastValue += ckLp.alpha * ((2.0*(rs >>> 2)*R30-1.0) - ckLp.lastValue);
            const crankshaftValue = ckLp.lastValue * net.crankFluct;
            this.biasSign = -this.biasSign;
            const bias = net.bias * this.biasSign;
            const rev = net.currentRevolution;
            const spOutL = sp.outputLeft;
            for (let i=0; i<N; i++) {
               const cyl = cyls[i];
               let x = rev + offs[i] + i*crankshaftValue;
               x -= Math.floor(x);
               if (x < cyl.lastX - 0.5) {
                  // THE PHASE WRAPPED: this cylinder's next combustion
                  rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
                  const u = (rs >>> 2) * R30;
                  ST[0] += 1;
                  if (comb > 0) {
                     if (u < pMis) {
                        cyl.ignitionGain = 0.0;
                        ST[1] += 1;
                        this.misEMA += (1 - this.misEMA) * 0.15;
                        // half of the unburnt charges go off in the hot pipe: the cough
                        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
                        if ((rs >>> 2) * R30 < 0.5) net.cough += 0.9 + 0.8 * u / (pMis > 0 ? pMis : 1);
                     } else {
                        // the cycle-to-cycle spread: a unit-variance bell from three uniforms
                        let g3 = 0.0;
                        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; g3 += (rs >>> 2) * R30;
                        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; g3 += (rs >>> 2) * R30;
                        rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; g3 += (rs >>> 2) * R30;
                        let g = 1.0 + sigma * (g3 - 1.5) * 2.0;
                        if (g < 0) g = 0.0;
                        cyl.ignitionGain = comb * g;
                        ST[2] += g; ST[3] += g * g;
                        this.misEMA -= this.misEMA * 0.15;
                     }
                  } else {
                     // the last stray firings of a dying engine
                     cyl.ignitionGain = (popProb > 0 && u < popProb) ? 0.5 + 0.6 * u / popProb : 0.0;
                     this.misEMA -= this.misEMA * 0.15;
                  }
               }
               cyl.lastX = x;
               cyl.x = x; cyl.intakeNoise = intakeNoise; cyl.straightPipeOutputLeft = spOutL; cyl.bias = bias;
               cyl.update();
               block += cyl.cylinderWaveguide.outputLeft;
            }
            let r2 = rev + spS*rpmInst/(60.0*cycleRevs);
            if (r2 >= 1.0) {
               r2 -= 1.0;
            }
            net.currentRevolution = r2;

            for (let i=0; i<N; i++) {
               intake += cyls[i].intakeWaveguide.outputLeft;
            }

            let straightPipeInput = 0.0;
            for (let i=0; i<N; i++) {
               straightPipeInput += cyls[i].extractorWaveguide.outputRight;
            }
            if (net.cough > 1e-4) {
               rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
               straightPipeInput += net.cough * (2.0*(rs >>> 2)*R30-1.0) * 1.6;
               net.cough *= net.coughDecay;
            } else net.cough = 0.0;

            sp.valueLeft = straightPipeInput; sp.valueRight = mu.outputLeft;
            sp.add ();
            ol.valueLeft = mu.outputRight; ol.valueRight = 0.0;
            ol.add ();
            exhaust = ol.outputRight;

            mu.mufflerInput = sp.outputRight; mu.outletValue = ol.outputLeft;
            mu.update();
            bLp.lastValue += bLp.alpha * (block - bLp.lastValue);
            block = bLp.lastValue;
            // ---- end of upstream ----
         }
         // the mix, DC-blocked per channel (enginesound's dc_lp)
         this.level += this.levelA * (this.levelTgt - this.level);
         const g = gain * this.level;
         let e = exhaust * mixE * g, a = intake * mixI * g, b = block * mixB * g;
         // the starter: a DC motor's commutator whine, labouring with the crank
         if (stLevel > 1e-5) {
            this.phStarter += v * stHz / sr;
            if (this.phStarter >= 1) this.phStarter -= Math.floor(this.phStarter);
            const p = TWO_PI * this.phStarter;
            b += stLevel * (Math.sin(p) + 0.35 * Math.sin(2 * p) + 0.15 * Math.sin(3 * p));
         }
         // the blower's whistle, on the intake side
         if (blAmp > 1e-6) {
            this.phBlower += blF;
            if (this.phBlower >= 1) this.phBlower -= 1;
            a += blAmp * Math.sin(TWO_PI * this.phBlower);
         }
         // the cooling exhaust's ticks: three modes of a thin, hot steel shell
         // (1.8..7 kHz, 6..30 ms), rung by an impulse at random moments
         if (tickP > 0) {
            rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
            if ((rs >>> 2) * R30 < tickP) {
               for (let k = 0; k < 3; k++) {
                  rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
                  const f = 1800 + 5200 * (rs >>> 2) * R30;
                  rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
                  const r = Math.exp(-1 / ((0.006 + 0.024 * (rs >>> 2) * R30) * sr));
                  F[k] = 2 * r * Math.cos(TWO_PI * f / sr);       // b1
                  F[3 + k] = -r * r;                              // b2
               }
               rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
               const ka = this.tickLevel * (0.3 + 0.7 * (rs >>> 2) * R30);
               F[6] += ka; F[7] -= 0.7 * ka; F[8] += 0.5 * ka;
               this.tickEnergy = 1.0;
               ST[4] += 1;
            }
         }
         if (this.tickEnergy > 0) {
            let t = 0.0;
            for (let k = 0; k < 3; k++) {
               const y = F[k] * F[6 + k] + F[3 + k] * F[9 + k];
               F[9 + k] = F[6 + k];
               F[6 + k] = y;
               t += y;
            }
            e += t;
            this.tickEnergy *= 0.99995;
            if (this.tickEnergy < 1e-3) { this.tickEnergy = 0.0; for (let k = 6; k < 12; k++) F[k] = 0.0; }
         }
         const ye = e - this.dc0 + dcR * this.dy0; this.dc0 = e; this.dy0 = ye;
         const ya = a - this.dc1 + dcR * this.dy1; this.dc1 = a; this.dy1 = ya;
         const yb = b - this.dc2 + dcR * this.dy2; this.dc2 = b; this.dy2 = yb;
         let y = ye + ya + yb;
         if (y !== y) {             // a NaN reached the pipes: silence, never ring
            net.clear();
            this.dc0 = this.dc1 = this.dc2 = this.dy0 = this.dy1 = this.dy2 = 0.0;
            this.vRpm = 0.0;
            y = 0.0;
         }
         if (split) {
            const okS = y === y;
            ch0[s] = okS ? ye : 0; ch1[s] = okS ? ya : 0; ch2[s] = okS ? yb : 0;
         } else {
            ch0[s] = y;
         }
         if (ctl) {
            ctl[0][s] = this.vRpm * 0.001;
            ctl[1][s] = this.vRpm * invGear * 0.001;
         }
      }
      this.rs[0] = rs;
      return true;
   }

}

registerProcessor('flydiy-engine', FlyDiyEngineProcessor);

// node (the offline harness and GATE AUDIO): the same classes, no second copy
if (typeof module !== 'undefined' && module && module.exports) {
   module.exports = { FlyDiyEngineProcessor, EngineNetwork, Cylinder, Waveguide, DelayLine,
                      Muffler, LowpassFilter, metresToSamples, SPEED_OF_SOUND, DENORMAL_BIAS };
}
