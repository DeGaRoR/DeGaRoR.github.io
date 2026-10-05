#!/usr/bin/env python3
# SND-VOICE (G1626) / SND-RADIO-3 (G1701): the Piper half of tools/audio/prep_voice.js - one process renders a whole job.
#
#   python tools/audio/voice_render.py job.json
#
# job.json: { "model": ".../x.onnx", "config": ".../x.onnx.json", "voice": "norman" | "john" | "kristin" | "libritts",
#             "seed": number, "out": "dir", "items": [{ "key", "text", "speaker"?: int }] }
# writes <out>/<key>.wav (16-bit PCM mono at the voice's rate), prints one line per item.
#
# WHOLE TAKES (G1701, the user's verdict 2026-10-04: the stitched AWOS "really messes up punctuation, giving it a real
# robotic feeling"): every item is a whole line written for the ear, rendered as ONE take per sentence and joined
# with a breath between sentences - never a word cut out of a carrier phrase (SND-VOICE's ALIGNED patch is retired
# with the word clips it cut).
#
# THE PROSODY, per voice (PROSODY below - the only place these numbers live):
#   length_scale      the pace (> 1 slower). Norman a touch slower than the model's own pace: a host, not a reader.
#   noise_scale       the voice's variation (the VITS prior's noise). Lower = steadier, higher = livelier, too high =
#                     wobbly vowels. Under the model's 0.667 default: the long takes stay clean.
#   noise_w           the variation of the durations (the stochastic duration predictor's noise). Above the 0.8
#                     default: the rhythm breathes instead of ticking evenly - the main cure for "robotic".
#   sentence_silence  the breath between two sentences of one take, in seconds; a question gets a little longer, and
#                     every gap is nudged by a few tens of milliseconds (seeded per item) so no two are the same length.
# SEEDED: the model draws its noise from RandomNormalLike nodes with no seed: two runs of one line differ, so a re-render
# would re-hash every clip. Each such node becomes a slice of a noise bank drawn per SENTENCE from the job's seed and the
# sentence's own text (G1682: a session-wide generator made a clip depend on its place in the job) - a re-run is
# byte-identical, and a clip does not change when other clips are added.
#
# THE ENGINE: piper-tts 1.2.0 (rhasspy/piper, MIT) with piper-phonemize 1.1.0 (MIT), onnx (Apache-2.0) for the patch.
# Pinned on purpose: the maintained successor on PyPI (piper-tts >= 1.3, OHF-Voice/piper1-gpl) is GPL-3.0. Either way the
# engine is a TOOL here: nothing of it ships, only the audio it renders (piper-phonemize drives espeak-ng, GPL-3.0, for
# the phonemes; a program's output is not covered by its licence).
#   pip install "piper-tts==1.2.0" onnx
import json, sys, os, wave, hashlib
import numpy as np

PROSODY = {
    'norman':   {'length_scale': 1.06, 'noise_scale': 0.62, 'noise_w': 0.90, 'sentence_silence': 0.34},
    'john':     {'length_scale': 1.04, 'noise_scale': 0.60, 'noise_w': 0.88, 'sentence_silence': 0.32},
    'kristin':  {'length_scale': 1.00, 'noise_scale': 0.60, 'noise_w': 0.85, 'sentence_silence': 0.30},
    'libritts': {'length_scale': 1.00, 'noise_scale': 0.55, 'noise_w': 0.85, 'sentence_silence': 0.30},
}
QUESTION_EXTRA_S = 0.08     # a little more air after a question
JITTER_S = 0.05             # each gap nudged by up to this much, seeded per item

BANKS = [(1, 2, 4096), (1, 192, 16384)]   # per RandomNormalLike in graph order: [1, 2, phoneme ids], [1, 192, frames]

def session(model_path):
    import onnx, onnxruntime
    from onnx import helper, TensorProto
    m = onnx.load(model_path)
    nodes, banks = [], []
    for n in m.graph.node:
        if n.op_type in ('RandomNormalLike', 'RandomNormal', 'RandomUniformLike', 'RandomUniform'):
            if n.op_type != 'RandomNormalLike': raise SystemExit('voice_render: a %s node - only RandomNormalLike is banked' % n.op_type)
            k = len(banks)
            if k >= len(BANKS): raise SystemExit('voice_render: more random nodes than banks')
            attrs = {a.name: helper.get_attribute_value(a) for a in n.attribute}
            if attrs.get('mean', 0.0) != 0.0 or attrs.get('scale', 1.0) != 1.0: raise SystemExit('voice_render: a scaled RandomNormalLike')
            b, pre = 'noise_bank_%d' % k, '/bank%d' % k
            m.graph.input.append(helper.make_tensor_value_info(b, TensorProto.FLOAT, list(BANKS[k])))
            nodes += [helper.make_node('Shape', [n.input[0]], [pre + '/shape']),
                      helper.make_node('Mul', [pre + '/shape', pre + '/zero'], [pre + '/starts']),
                      helper.make_node('Slice', [b, pre + '/starts', pre + '/shape'], [n.output[0]])]
            m.graph.initializer.append(helper.make_tensor(pre + '/zero', TensorProto.INT64, [], [0]))
            banks.append(b)
        else:
            nodes.append(n)
    del m.graph.node[:]
    m.graph.node.extend(nodes)
    opt = onnxruntime.SessionOptions(); opt.intra_op_num_threads = 1; opt.inter_op_num_threads = 1   # threads can reorder float sums
    return onnxruntime.InferenceSession(m.SerializeToString(), sess_options=opt, providers=['CPUExecutionProvider']), banks

def seed_of(*parts):
    return int(hashlib.sha256('\u0000'.join(str(p) for p in parts).encode('utf-8')).hexdigest()[:12], 16)

def main():
    job = json.load(open(sys.argv[1], encoding='utf-8'))
    from piper.voice import PiperVoice
    from piper.const import BOS, EOS, PAD
    voice = PiperVoice.load(job['model'], config_path=job['config'])
    sess, banks = session(job['model'])
    cfg = voice.config
    idmap = cfg.phoneme_id_map
    sr = cfg.sample_rate
    P = PROSODY[job['voice']]
    os.makedirs(job['out'], exist_ok=True)

    def synth(phonemes, speaker, seed):
        ids = list(idmap[BOS])
        for p in phonemes:
            if p not in idmap: continue
            ids += idmap[p] + idmap[PAD]
        ids += idmap[EOS]
        feed = { 'input': np.array([ids], dtype=np.int64), 'input_lengths': np.array([len(ids)], dtype=np.int64),
                 'scales': np.array([P['noise_scale'], P['length_scale'], P['noise_w']], dtype=np.float32) }
        if cfg.num_speakers > 1: feed['sid'] = np.array([speaker or 0], dtype=np.int64)
        rng = np.random.default_rng(seed)
        for b, shape in zip(banks, BANKS): feed[b] = rng.standard_normal(shape, dtype=np.float32)
        return sess.run(['output'], feed)[0].reshape(-1).astype(np.float32)

    for it in job['items']:
        spk = it.get('speaker')
        sentences = voice.phonemize(it['text'])
        jit = np.random.default_rng(seed_of(job.get('seed', 1), 'gaps', it['text']))
        parts = []
        for k, ph in enumerate(sentences):
            parts.append(synth(ph, spk, seed_of(job.get('seed', 1), spk, ''.join(ph))))
            if k < len(sentences) - 1:
                g = P['sentence_silence'] + (QUESTION_EXTRA_S if '?' in ph else 0) + JITTER_S * (2 * jit.random() - 1)
                parts.append(np.zeros(int(g * sr), dtype=np.float32))
        y = np.clip(np.concatenate(parts), -1, 1)
        with wave.open(os.path.join(job['out'], it['key'] + '.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((y * 32767).astype(np.int16).tobytes())
        print('ok', it['key'], flush=True)

if __name__ == '__main__':
    main()
