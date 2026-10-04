#!/usr/bin/env python3
# SND-VOICE (G1626): the Piper half of tools/audio/prep_voice.js - one process renders a whole job.
#
#   python tools/audio/voice_render.py job.json
#
# job.json: { "model": ".../x.onnx", "config": ".../x.onnx.json", "speaker": int | null, "seed": number,
#             "noise_scale": float, "noise_w": float, "out": "dir",
#             "items": [{ "key", "text", "length_scale", "pick"?: int }] }
# writes <out>/<key>.wav (16-bit PCM mono at the voice's rate), prints one line per item.
#
# TWO THINGS PLAIN PIPER DOES NOT DO, done by patching the voice's ONNX graph in memory (never on disk):
#   SEEDED     the model draws its noise from RandomNormalLike nodes with no seed: two runs of one line differ, so a
#              re-render would re-hash every clip. Each such node becomes a slice of a noise bank drawn per item from
#              the job's seed (G1682: a session-wide seeded generator made a clip depend on its place in the job) - a
#              re-run is byte-identical, and a clip does not change when other clips are added.
#   ALIGNED    the duration predictor's frame counts (the graph's '/Ceil' node, frames per phoneme id; a frame is
#              the vocoder's hop, 256 samples) become a second output. An item with "pick": n is a CARRIER - a
#              comma list ("zero, seven, zero.") whose n-th item is the word wanted: a voice trained on sentences
#              says a lone word badly (VITS rarely saw one), the same word inside a phrase well. The slice runs
#              from the middle of the comma pause before the item to the middle of the one after (the last item:
#              to the end), and prep_voice.js trims the pause off.
#
# THE ENGINE: piper-tts 1.2.0 (rhasspy/piper, MIT) with piper-phonemize 1.1.0 (MIT), onnx (Apache-2.0) for the
# patch. Pinned on purpose: the maintained successor on PyPI (piper-tts >= 1.3, OHF-Voice/piper1-gpl) is GPL-3.0.
# Either way the engine is a TOOL here: nothing of it ships, only the audio it renders (piper-phonemize drives
# espeak-ng, GPL-3.0, for the phonemes; a program's output is not covered by its licence).
#   pip install "piper-tts==1.2.0" onnx
import json, sys, os, wave
import numpy as np

HOP = 256

# G1682 (SND-RADIO-2): PER ITEM. onnxruntime's seeded RandomNormalLike keeps ONE generator per session: the n-th item
# drew the n-th stretch of noise, so a clip depended on its PLACE in the job (six words added to the vocabulary re-hashed
# the 104 clips after them). Each RandomNormalLike is replaced by a slice of a NOISE BANK fed per item (Slice(bank, 0,
# Shape(like))), the banks drawn from numpy's PCG64 seeded with the job's seed for EVERY item: a clip is a function of its
# own text alone, whatever renders before it.
BANKS = [(1, 2, 4096), (1, 192, 16384)]   # per RandomNormalLike in graph order: [1, 2, phoneme ids], [1, 192, frames]

def session(model_path, seed):
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
    dur = [n.output[0] for n in m.graph.node if n.op_type == 'Ceil']
    if len(dur) != 1: raise SystemExit('voice_render: want exactly one Ceil node (the durations), found %d' % len(dur))
    m.graph.output.append(onnx.helper.make_tensor_value_info(dur[0], onnx.TensorProto.FLOAT, None))
    opt = onnxruntime.SessionOptions(); opt.intra_op_num_threads = 1; opt.inter_op_num_threads = 1   # threads can reorder float sums
    return onnxruntime.InferenceSession(m.SerializeToString(), sess_options=opt, providers=['CPUExecutionProvider']), dur[0], banks

def main():
    job = json.load(open(sys.argv[1], encoding='utf-8'))
    from piper.voice import PiperVoice
    from piper.const import BOS, EOS, PAD
    voice = PiperVoice.load(job['model'], config_path=job['config'])
    sess, dur_name, banks = session(job['model'], job.get('seed', 1))
    cfg = voice.config
    idmap = cfg.phoneme_id_map
    sr = cfg.sample_rate
    os.makedirs(job['out'], exist_ok=True)

    def synth(phonemes, ls):
        ids, owner = list(idmap[BOS]), [None] * len(idmap[BOS])
        for i, p in enumerate(phonemes):
            if p not in idmap: continue
            ids += idmap[p]; owner += [i] * len(idmap[p])
            ids += idmap[PAD]; owner += [i] * len(idmap[PAD])
        ids += idmap[EOS]; owner += [None] * len(idmap[EOS])
        feed = { 'input': np.array([ids], dtype=np.int64), 'input_lengths': np.array([len(ids)], dtype=np.int64),
                 'scales': np.array([job.get('noise_scale', 0.667), ls, job.get('noise_w', 0.8)], dtype=np.float32) }
        if cfg.num_speakers > 1: feed['sid'] = np.array([job.get('speaker') or 0], dtype=np.int64)
        rng = np.random.default_rng(int(job.get('seed', 1)))   # the same noise for every item: order-free
        for b, shape in zip(banks, BANKS): feed[b] = rng.standard_normal(shape, dtype=np.float32)
        audio, d = sess.run(['output', dur_name], feed)
        return audio.reshape(-1).astype(np.float32), d.reshape(-1).astype(np.int64), owner

    for it in job['items']:
        ls = it.get('length_scale', 1.0)
        sentences = voice.phonemize(it['text'])
        if it.get('pick') is None:
            gap = np.zeros(int(job.get('sentence_silence', 0.25) * sr), dtype=np.float32)
            parts = []
            for k, ph in enumerate(sentences):
                a, _, _ = synth(ph, ls)
                parts += [a] + ([gap] if k < len(sentences) - 1 else [])
            y = np.concatenate(parts)
        else:
            if len(sentences) != 1: raise SystemExit('voice_render: a carrier is one sentence: ' + it['text'])
            ph = sentences[0]
            a, d, owner = synth(ph, ls)
            if abs(int(d.sum()) * HOP - len(a)) > HOP: raise SystemExit('voice_render: durations do not cover the audio (%d frames, %d samples)' % (d.sum(), len(a)))
            starts = np.concatenate([[0], np.cumsum(d)]) * HOP
            # each comma phoneme's span in samples (its own id and the pad after it)
            commas = []
            for i, p in enumerate(ph):
                if p == ',':
                    js = [j for j, o in enumerate(owner) if o == i]
                    commas.append((starts[js[0]], starts[js[-1] + 1]))
            n = it['pick']
            if n > len(commas): raise SystemExit('voice_render: item %d of a %d-item carrier: %s' % (n, len(commas) + 1, it['text']))
            s0 = 0 if n == 0 else (commas[n - 1][0] + commas[n - 1][1]) // 2
            s1 = len(a) if n == len(commas) else (commas[n][0] + commas[n][1]) // 2
            y = a[int(s0):int(s1)]
        y = np.clip(y, -1, 1)
        with wave.open(os.path.join(job['out'], it['key'] + '.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((y * 32767).astype(np.int16).tobytes())
        print('ok', it['key'], flush=True)

if __name__ == '__main__':
    main()
