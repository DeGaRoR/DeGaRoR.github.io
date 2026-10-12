// the 11 Oct stills (grass_window.sh stills, GRASS_EVAL): the field on with the draw cut (2 tuft shapes, 3 x 3 blocks), the 'sides'
// law (cut grass on the bands and the grass runway; no grass on gravel-in-physics: hard 0), both rings replanted
PREMISES_GEN.grassSides({ law: 'sides', stripGrass: 1, hard: 0 });
const f = TREE_FILL.grass(); f.set({ variants: 2, block: 3 });
TREE_FILL.cover().replant(); f.replant();
return { field: f.get(), sides: PREMISES_GEN.grassSides() };
