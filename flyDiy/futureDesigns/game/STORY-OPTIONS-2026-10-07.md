# Where the story lives: three options (7 Oct 2026, G2204, the GAME COORDINATOR)

The user, 7 Oct ~18:00 (relayed by A0): *"we have not worked on the game story, and I'm not sure how to integrate it with
the game content. There still seems to be little to see in terms of game content, and I fear it goes too far before I
can steer it."*

**The steering page:** https://claude.ai/artifact/QjQYuYhf1RaoGmNezbvnNq ("flyDiy Game Checkpoint"). It shows what exists,
in play order with real stills, what each train adds, these three options, and the pace question. **No new game sessions
start until the user has picked** (A0's hold, 7 Oct). The running train-43 wave finishes; nothing lands without a train and
the user's OK at the checkpoint.

All three options keep GQ20 (fictional people and organisations only) and GQ21 (the user chooses and runs the AI).

| | A. The story is in the work | **B. A thin spine of scenes (DEFAULT)** | C. Characters on screen |
|---|---|---|---|
| what it is | providers' contacts write the briefs in their voices; the four pilots' barks (hired, take-off, delivery); each arc ends with a building + a two-line closing | A + an opening (the derelict field, the Field Trust's letter, Kit the companion) + 6-8 milestone scenes fired at arc stages (a painted illustration + a few paragraphs, full-screen once, kept in a journal) | B + contacts and pilots standing at their fields as Mixamo figures, talking-head cards at accept / delivery |
| the user writes / generates | 5 contacts + briefs, 4 pilots' bios + barks, 5 arc closings, 4 portraits (the prompt pack as it is) | A's + opening (~300 words) + 6-8 scenes (~150 words each) + one illustration per scene | B's + ~9 characters' dialogue + portraits + more Mixamo bodies (downloads, an OK each) |
| plugs into | CONTRACT_TEXT keys (`contractImportPack`), pilot text keys, the stage-reveal caption | + one record `story[]` keyed to track stages (STAGES' keys), shown by the stage reveal and the welcome's Continue | + the live-crew figurants (LIVE-CREW's texture-budget ruling: ~170 MB GPU per character) |
| cost | nothing new to build | one small cloud session; no perf cost (images load only when a scene shows) | several sessions; real perf risk on the laptop target; after Saturday, if at all |

**Pace** (default first): a checkpoint after every train · one visible slice at a time · keep the speed until Saturday.

**After the user picks:** adapt NARRATIVE-PROMPT-PACK-2026-10-06.md to the chosen option (B adds a Block for the opening
+ scenes, with an illustration style line matching the portraits). Then one STORY session (G2324-G2329 is free in
CAREER-WIRE's block, or the G2400 reserve).
