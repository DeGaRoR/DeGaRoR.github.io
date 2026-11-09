# DERELICT-HANGAR: key shots for a GPU session

The cloud session has no GPU (SwiftShader), so it renders **low-res framing previews** only. They are in `store/gallery/`
at a quarter of the sizes below. A **local session with a graphics card** renders the key shots at full size with the
same rigs and the same cameras. Each rig prints what it did and writes a JSON beside its stills.

## The commands (local, from `flyDiy/`)

```bash
node tools/large_hangar_store_shot.js --scene roster --gallery --full --gpu
```

```bash
node tools/large_hangar_shot.js --planes dc3 --gpu --w 3840 --h 2160
```

- `--gpu` opens a visible Chromium window on the machine's GPU. On a GPU the page bakes its own reflection probe, so the
  rig's software-only probe bake does not run.
- `--full` renders the gallery at the sizes below instead of the quarter-size previews.
- Every still is taken after the garage's mood is pinned. The rigs log the mood they used.

## The roster scene (`large_hangar_store_shot.js --scene roster`)

A dev career whose main hangar is the large hangar, with 10 inside slots. The Jodel is on the stand. Stored round it
at their measured footprints, each turned by its own yaw: Metal Cessna, Piper Cub, STOL Cub, Twin busher on floats,
Rufus, pusherLight, B-ITES, PA-18 on floats and Chinook.

Cameras are in the room's frame: the door at -x, x the depth, z across, the gallery side at +z. `HW` / `HD` are the
hall's half-width / half-depth.

| shot | size | camera | moods |
|---|---|---|---|
| `hero_<mood>` | 3840 × 2160 (16:9) | eye `[HD-5, 7.6, -HW+5]`, at `[-5, 0.6, 3]`, vfov 52 | AFTERNOON, GOLDEN, NIGHT |
| `wide_AFTERNOON` | 5120 × 1440 (32:9) | eye `[HD-3, 6.2, 0]`, at `[-HD, 2.4, 0]`, hfov 96, inside the hall 3 m off the back wall | AFTERNOON |
| `top` | 3840 × 2160 | eye `[2, EAVE-1.7, 0]`, looking straight down, vfov 92 | AFTERNOON |
| `under` | 3840 × 2160 | from the floor under the first stored aeroplane's wing, looking up, vfov 70 | AFTERNOON |
| `window` | 3840 × 2160 | from outside the left flank, through a ground-row window, vfov 46 | AFTERNOON |
| `tele` | 3840 × 2160 | from the apron 26 m out, through the open door, vfov 22 | AFTERNOON |
| `dof_*` | 3840 × 2160 | a focus pull on the Jodel: eye `[-7.5, 1.5, -6.5]`, aimed at `[0, 1.3, 0]`, aperture 0.16 m, samples averaged afterwards | AFTERNOON |

## The DC-3 (`large_hangar_shot.js --planes dc3`)

The large hangar with the DC-3 on the stand, in the afternoon mood:

- `door`: from the apron.
- `hall`: from the back wall, high.
- `gallery`: **under the wing**, across to the facade side.
- `roof`: the trusses.

## Framing, from the previews (9 Nov)

- The hero and top-down eyes keep 2.5 m sideways from every lamp's line: the rig moves an eye that hangs among the
  pendants. In the first previews a pendant's rods crossed the hero, and the top-down sat inside a lamp's shade.
- The ultrawide frames from inside the hall with nothing clipping. The under-the-wing, window and telephoto shots work
  as framed.
- Three stored aeroplanes (PA-18 on floats, Rufus, B-ITES) had not finished baking in the SwiftShader previews. A GPU
  run bakes them in seconds.

## Notes

- The door's view of the world (HANGAR-VIEW) runs only on a GPU. On SwiftShader the rigs load `?soft=0` to get it.
- The depth-of-field samples are PNGs (`dof_00.png` …). Average them with any image tool.
