// GENERATED FILE - DO NOT EDIT. Built by tools/ground_tex_prep.js from tools/ground_sets.json and the maps under
// assets/lot, assets/splat, assets/airfield, assets/pavement (CC0: Poly Haven, ambientCG; see CREDITS.md).
// The files live under media/tex/ground/ (hash-in-filename).
//
// THE GROUND LIBRARY (G910, AS2): ONE table for the splat, the pavement, the lot and the site. A SET is its maps,
// once (diff / nor / rough / height JPEGs, for the consumers that bind plain textures and the editors' previews)
// and, for the sets an array can hold, `layers`: the two texture-array planes COOKED offline (tools/array_cook.js;
// colour rgb + height a, normal rgb + roughness a; raw RGBA8, one gzip stream) - src/viewer/ground_lib.js copies
// them into the arrays, no canvas. `libs` are each library's keys, in its order, with its own numbers, each
// naming its set. Below the table: the four libraries' views, under their old names (SPLAT_TEX_SETS,
// PAVEMENT_TEX_SETS, LOT_TEX_SETS, SITE_TEX_SETS), whose maps are lazily-made Images shared by every view.
const GROUND_TEX = {
  px: 512,
  sets: {
    beach: {"diff":"media/tex/ground/beach_diff_512.ea67fba6.jpg","nor":"media/tex/ground/beach_nor_gl_512.6bee5c90.jpg","rough":"media/tex/ground/beach_rough_512.7cc3d0fe.jpg","height":"media/tex/ground/beach_height_512.6bea814d.jpg","layers":"media/tex/ground/beach_layers_512.43f6ee2e.gz.bin"},
    rocksA: {"diff":"media/tex/ground/rocksA_diff_512.9c1bf1ef.jpg","nor":"media/tex/ground/rocksA_nor_gl_512.85631457.jpg","rough":"media/tex/ground/rocksA_rough_512.47168bf6.jpg","height":"media/tex/ground/rocksA_height_512.251b4884.jpg","layers":"media/tex/ground/rocksA_layers_512.5ed237f3.gz.bin"},
    rocksB: {"diff":"media/tex/ground/rocksB_diff_512.0b0af9e9.jpg","nor":"media/tex/ground/rocksB_nor_gl_512.4c42214e.jpg","rough":"media/tex/ground/rocksB_rough_512.e7b84911.jpg","height":"media/tex/ground/rocksB_height_512.fd54b346.jpg","layers":"media/tex/ground/rocksB_layers_512.1d086a2f.gz.bin"},
    mud: {"diff":"media/tex/ground/mud_diff_512.636dd758.jpg","nor":"media/tex/ground/mud_nor_gl_512.3c1c6eca.jpg","rough":"media/tex/ground/mud_rough_512.3411d15e.jpg","height":"media/tex/ground/mud_height_512.dbd5e95c.jpg","layers":"media/tex/ground/mud_layers_512.0b7ca78f.gz.bin"},
    leaves: {"diff":"media/tex/ground/leaves_diff_512.c5814c38.jpg","nor":"media/tex/ground/leaves_nor_gl_512.fd8b9ff4.jpg","rough":"media/tex/ground/leaves_rough_512.80568e0c.jpg","height":"media/tex/ground/leaves_height_512.2ea4040a.jpg","layers":"media/tex/ground/leaves_layers_512.9f9d1173.gz.bin"},
    cliff: {"diff":"media/tex/ground/cliff_diff_512.76c57eb9.jpg","nor":"media/tex/ground/cliff_nor_gl_512.226afdcc.jpg","rough":"media/tex/ground/cliff_rough_512.c4fdd0d3.jpg","height":"media/tex/ground/cliff_height_512.b8482fc3.jpg","layers":"media/tex/ground/cliff_layers_512.5953402e.gz.bin"},
    rocksG: {"diff":"media/tex/ground/rocksG_diff_512.98760b2f.jpg","nor":"media/tex/ground/rocksG_nor_gl_512.1db280fd.jpg","rough":"media/tex/ground/rocksG_rough_512.8b0cfbe4.jpg","height":"media/tex/ground/rocksG_height_512.449e6feb.jpg","layers":"media/tex/ground/rocksG_layers_512.ec55f67b.gz.bin"},
    rockyA: {"diff":"media/tex/ground/rockyA_diff_512.76703799.jpg","nor":"media/tex/ground/rockyA_nor_gl_512.f90cabd9.jpg","rough":"media/tex/ground/rockyA_rough_512.75cd2880.jpg","height":"media/tex/ground/rockyA_height_512.5425c5e1.jpg","layers":"media/tex/ground/rockyA_layers_512.c9d15f29.gz.bin"},
    rockyB: {"diff":"media/tex/ground/rockyB_diff_512.89dbf1a1.jpg","nor":"media/tex/ground/rockyB_nor_gl_512.49ff538c.jpg","rough":"media/tex/ground/rockyB_rough_512.30f3e232.jpg","height":"media/tex/ground/rockyB_height_512.330377f8.jpg","layers":"media/tex/ground/rockyB_layers_512.47d73432.gz.bin"},
    grassRock: {"diff":"media/tex/ground/grassRock_diff_512.8198f8c5.jpg","nor":"media/tex/ground/grassRock_nor_gl_512.1e5e64b9.jpg","rough":"media/tex/ground/grassRock_rough_512.549490b3.jpg","height":"media/tex/ground/grassRock_height_512.857d1079.jpg","layers":"media/tex/ground/grassRock_layers_512.f8d4bbe6.gz.bin"},
    forestAir: {"diff":"media/tex/ground/forestAir_diff_512.98ef9d66.jpg","nor":"media/tex/ground/forestAir_nor_gl_512.7d8881b5.jpg","rough":"media/tex/ground/forestAir_rough_512.63f3fe1e.jpg","height":"media/tex/ground/forestAir_height_512.0cce78f7.jpg","layers":"media/tex/ground/forestAir_layers_512.284cdb1b.gz.bin"},
    snowAir: {"diff":"media/tex/ground/snowAir_diff_512.ea591acc.jpg","nor":"media/tex/ground/snowAir_nor_gl_512.d34a594e.jpg","rough":"media/tex/ground/snowAir_rough_512.541c3bce.jpg","height":"media/tex/ground/snowAir_height_512.de33c545.jpg","layers":"media/tex/ground/snowAir_layers_512.c09bb296.gz.bin"},
    lush: {"diff":"media/tex/ground/lush_diff_512.90a67ae0.jpg","nor":"media/tex/ground/lush_nor_gl_512.379ad06b.jpg","rough":"media/tex/ground/lush_rough_512.8f65b07b.jpg","height":"media/tex/ground/lush_height_512.fcd11ebd.jpg","layers":"media/tex/ground/lush_layers_512.bd41ea2e.gz.bin"},
    grass: {"diff":"media/tex/ground/grass_diff_512.7cc9f4c2.jpg","nor":"media/tex/ground/grass_nor_gl_512.151550a5.jpg","rough":"media/tex/ground/grass_rough_512.f5626b4f.jpg","height":"media/tex/ground/grass_height_512.518d6118.jpg","layers":"media/tex/ground/grass_layers_512.6a165522.gz.bin"},
    pebble: {"diff":"media/tex/ground/pebble_diff_512.00fbe38a.jpg","nor":"media/tex/ground/pebble_nor_gl_512.b29a459b.jpg","rough":"media/tex/ground/pebble_rough_512.d985d705.jpg","height":"media/tex/ground/pebble_height_512.a96462f6.jpg","layers":"media/tex/ground/pebble_layers_512.9558b0ee.gz.bin"},
    dry: {"diff":"media/tex/ground/dry_diff_512.9f177ab8.jpg","nor":"media/tex/ground/dry_nor_gl_512.89d1ffc2.jpg","rough":"media/tex/ground/dry_rough_512.8360b752.jpg","height":"media/tex/ground/dry_height_512.0249b249.jpg","layers":"media/tex/ground/dry_layers_512.113f410a.gz.bin"},
    dirt: {"diff":"media/tex/ground/dirt_diff_512.c5983cf7.jpg","nor":"media/tex/ground/dirt_nor_gl_512.27f8e9b2.jpg","rough":"media/tex/ground/dirt_rough_512.a924c560.jpg","height":"media/tex/ground/dirt_height_512.ecb3a4f1.jpg","layers":"media/tex/ground/dirt_layers_512.1f228b98.gz.bin"},
    coastA: {"diff":"media/tex/ground/coastA_diff_512.d3bf0462.jpg","nor":"media/tex/ground/coastA_nor_gl_512.97e2058e.jpg","rough":"media/tex/ground/coastA_rough_512.88cd29a5.jpg","height":"media/tex/ground/coastA_height_512.5948d41b.jpg","layers":"media/tex/ground/coastA_layers_512.257fdf78.gz.bin"},
    coastSand: {"diff":"media/tex/ground/coastSand_diff_512.262f733c.jpg","nor":"media/tex/ground/coastSand_nor_gl_512.b2f0b5a8.jpg","rough":"media/tex/ground/coastSand_rough_512.6cf3034a.jpg","height":"media/tex/ground/coastSand_height_512.ef67ae07.jpg","layers":"media/tex/ground/coastSand_layers_512.09a23bf1.gz.bin"},
    brushed: {"diff":"media/tex/ground/brushed_diff_512.09ed18c5.jpg","nor":"media/tex/ground/brushed_nor_gl_512.ffe58c0f.jpg","rough":"media/tex/ground/brushed_rough_512.006fd4cf.jpg"},
    cracked: {"diff":"media/tex/ground/cracked_diff_512.53ca6cb6.jpg","nor":"media/tex/ground/cracked_nor_gl_512.25eb1586.jpg","rough":"media/tex/ground/cracked_rough_512.e6529d75.jpg"},
    antislip: {"diff":"media/tex/ground/antislip_diff_512.4a3ec588.jpg","nor":"media/tex/ground/antislip_nor_gl_512.47d37001.jpg","rough":"media/tex/ground/antislip_rough_512.773b9db1.jpg"},
    asphalt: {"diff":"media/tex/ground/asphalt_diff_512.97b52f47.jpg","nor":"media/tex/ground/asphalt_nor_gl_512.8cab2f84.jpg","rough":"media/tex/ground/asphalt_rough_512.ac02fc18.jpg"},
    asphaltaerial: {"diff":"media/tex/ground/asphaltaerial_diff_512.96d5e567.jpg","nor":"media/tex/ground/asphaltaerial_nor_gl_512.e32bc255.jpg","rough":"media/tex/ground/asphaltaerial_rough_512.a5c0e524.jpg"},
    grass005: {"diff":"media/tex/ground/grass005_diff_512.452ae05b.jpg","nor":"media/tex/ground/grass005_nor_gl_512.bf66784f.jpg","rough":"media/tex/ground/grass005_rough_512.5497193f.jpg"},
    leafygrass: {"diff":"media/tex/ground/leafygrass_diff_512.8e2afea6.jpg","nor":"media/tex/ground/leafygrass_nor_gl_512.9b63c7d7.jpg","rough":"media/tex/ground/leafygrass_rough_512.0187dd5d.jpg"},
    ground003: {"diff":"media/tex/ground/ground003_diff_512.c3aa8c9e.jpg","nor":"media/tex/ground/ground003_nor_gl_512.b6f78081.jpg","rough":"media/tex/ground/ground003_rough_512.ccf85026.jpg"},
    siteDirt: {"diff":"media/tex/ground/siteDirt_diff_512.d29ff9e3.jpg","nor":"media/tex/ground/siteDirt_nor_gl_512.51163e34.jpg","rough":"media/tex/ground/siteDirt_rough_512.29ee3f04.jpg"},
    concreteA: {"diff":"media/tex/ground/concreteA_diff_512.46078ce4.jpg","nor":"media/tex/ground/concreteA_nor_gl_512.4739ca06.jpg","rough":"media/tex/ground/concreteA_rough_512.90679e59.jpg","height":"media/tex/ground/concreteA_height_512.8054d239.jpg","layers":"media/tex/ground/concreteA_layers_512.1dce97da.gz.bin"},
    concreteB: {"diff":"media/tex/ground/concreteB_diff_512.acf8e898.jpg","nor":"media/tex/ground/concreteB_nor_gl_512.12e519d4.jpg","rough":"media/tex/ground/concreteB_rough_512.db6594c0.jpg","height":"media/tex/ground/concreteB_height_512.013127df.jpg","layers":"media/tex/ground/concreteB_layers_512.2664a07c.gz.bin"},
    concreteM: {"diff":"media/tex/ground/concreteM_diff_512.0fb22657.jpg","nor":"media/tex/ground/concreteM_nor_gl_512.c5315b1a.jpg","rough":"media/tex/ground/concreteM_rough_512.fd5950bc.jpg","height":"media/tex/ground/concreteM_height_512.2f573683.jpg","layers":"media/tex/ground/concreteM_layers_512.26a21bdd.gz.bin"},
    concreteD: {"diff":"media/tex/ground/concreteD_diff_512.bb617b45.jpg","nor":"media/tex/ground/concreteD_nor_gl_512.f10a91f3.jpg","rough":"media/tex/ground/concreteD_rough_512.a255dc73.jpg","height":"media/tex/ground/concreteD_height_512.7dea616a.jpg","layers":"media/tex/ground/concreteD_layers_512.6e33a006.gz.bin"},
    asphaltW: {"diff":"media/tex/ground/asphaltW_diff_512.da194623.jpg","nor":"media/tex/ground/asphaltW_nor_gl_512.0fb05575.jpg","rough":"media/tex/ground/asphaltW_rough_512.c625ed25.jpg","height":"media/tex/ground/asphaltW_height_512.f5eed78f.jpg","layers":"media/tex/ground/asphaltW_layers_512.0a2982ea.gz.bin"},
    asphaltC: {"diff":"media/tex/ground/asphaltC_diff_512.d5a619b5.jpg","nor":"media/tex/ground/asphaltC_nor_gl_512.c6610894.jpg","rough":"media/tex/ground/asphaltC_rough_512.f52db80e.jpg","height":"media/tex/ground/asphaltC_height_512.456c7bb7.jpg","layers":"media/tex/ground/asphaltC_layers_512.80752229.gz.bin"},
    gravelR: {"diff":"media/tex/ground/gravelR_diff_512.6802d340.jpg","nor":"media/tex/ground/gravelR_nor_gl_512.a88fdfc8.jpg","rough":"media/tex/ground/gravelR_rough_512.1eba9518.jpg","height":"media/tex/ground/gravelR_height_512.4d18d0d1.jpg","layers":"media/tex/ground/gravelR_layers_512.ef74fef9.gz.bin"},
    gravelK: {"diff":"media/tex/ground/gravelK_diff_512.6120c28d.jpg","nor":"media/tex/ground/gravelK_nor_gl_512.6e67ed24.jpg","rough":"media/tex/ground/gravelK_rough_512.b9e9118d.jpg","height":"media/tex/ground/gravelK_height_512.55de9f8d.jpg","layers":"media/tex/ground/gravelK_layers_512.9ad955ae.gz.bin"},
    gravelS: {"diff":"media/tex/ground/gravelS_diff_512.aa5661e4.jpg","nor":"media/tex/ground/gravelS_nor_gl_512.c14d9d5d.jpg","rough":"media/tex/ground/gravelS_rough_512.10735708.jpg","height":"media/tex/ground/gravelS_height_512.c0f812ec.jpg","layers":"media/tex/ground/gravelS_layers_512.9271691f.gz.bin"},
    dirtP: {"diff":"media/tex/ground/dirtP_diff_512.9939549e.jpg","nor":"media/tex/ground/dirtP_nor_gl_512.7d2b9f47.jpg","rough":"media/tex/ground/dirtP_rough_512.b5f149e2.jpg","height":"media/tex/ground/dirtP_height_512.411e0588.jpg","layers":"media/tex/ground/dirtP_layers_512.82ccdf19.gz.bin"},
    tracksM: {"diff":"media/tex/ground/tracksM_diff_512.dd58bb05.jpg","nor":"media/tex/ground/tracksM_nor_gl_512.162f98a2.jpg","rough":"media/tex/ground/tracksM_rough_512.82695519.jpg","height":"media/tex/ground/tracksM_height_512.8ba69d29.jpg","layers":"media/tex/ground/tracksM_layers_512.da46026b.gz.bin"},
    mudAir: {"diff":"media/tex/ground/mudAir_diff_512.84009967.jpg","nor":"media/tex/ground/mudAir_nor_gl_512.4051be3a.jpg","rough":"media/tex/ground/mudAir_rough_512.95027c71.jpg","height":"media/tex/ground/mudAir_height_512.ac5a927b.jpg","layers":"media/tex/ground/mudAir_layers_512.d9e2778b.gz.bin"},
    dirtAir: {"diff":"media/tex/ground/dirtAir_diff_512.b89fcf64.jpg","nor":"media/tex/ground/dirtAir_nor_gl_512.743d42f7.jpg","rough":"media/tex/ground/dirtAir_rough_512.6d30d975.jpg","height":"media/tex/ground/dirtAir_height_512.397e13dc.jpg","layers":"media/tex/ground/dirtAir_layers_512.0eaef37f.gz.bin"},
    sandC: {"diff":"media/tex/ground/sandC_diff_512.c491fcd1.jpg","nor":"media/tex/ground/sandC_nor_gl_512.f272fa16.jpg","rough":"media/tex/ground/sandC_rough_512.5ae4d4ca.jpg","height":"media/tex/ground/sandC_height_512.bd0a59c7.jpg","layers":"media/tex/ground/sandC_layers_512.d1b42e4b.gz.bin"},
    gravelG: {"diff":"media/tex/ground/gravelG_diff_512.520a980c.jpg","nor":"media/tex/ground/gravelG_nor_gl_512.76767670.jpg","rough":"media/tex/ground/gravelG_rough_512.4ad03bef.jpg","height":"media/tex/ground/gravelG_height_512.f365150b.jpg","layers":"media/tex/ground/gravelG_layers_512.7631e1e8.gz.bin"},
    gravelF: {"diff":"media/tex/ground/gravelF_diff_512.16231b93.jpg","nor":"media/tex/ground/gravelF_nor_gl_512.e4c59c90.jpg","rough":"media/tex/ground/gravelF_rough_512.bb7a8b6d.jpg","height":"media/tex/ground/gravelF_height_512.b802af8c.jpg","layers":"media/tex/ground/gravelF_layers_512.b7b91cf8.gz.bin"},
    gravelB: {"diff":"media/tex/ground/gravelB_diff_512.29720f30.jpg","nor":"media/tex/ground/gravelB_nor_gl_512.ea407253.jpg","rough":"media/tex/ground/gravelB_rough_512.9b22f115.jpg","height":"media/tex/ground/gravelB_height_512.49730146.jpg","layers":"media/tex/ground/gravelB_layers_512.c3612c62.gz.bin"},
    rockG: {"diff":"media/tex/ground/rockG_diff_512.7a842f21.jpg","nor":"media/tex/ground/rockG_nor_gl_512.8c4835e4.jpg","rough":"media/tex/ground/rockG_rough_512.cc1e0a66.jpg","height":"media/tex/ground/rockG_height_512.52dc0ac6.jpg","layers":"media/tex/ground/rockG_layers_512.580de0ce.gz.bin"},
    dirtS: {"diff":"media/tex/ground/dirtS_diff_512.13d8449c.jpg","nor":"media/tex/ground/dirtS_nor_gl_512.9ae6ffd2.jpg","rough":"media/tex/ground/dirtS_rough_512.1106a950.jpg","height":"media/tex/ground/dirtS_height_512.127561be.jpg","layers":"media/tex/ground/dirtS_layers_512.a5419e29.gz.bin"},
    trailR: {"diff":"media/tex/ground/trailR_diff_512.a4d7f5c3.jpg","nor":"media/tex/ground/trailR_nor_gl_512.baafc1af.jpg","rough":"media/tex/ground/trailR_rough_512.f234afed.jpg","height":"media/tex/ground/trailR_height_512.38ea3d1c.jpg","layers":"media/tex/ground/trailR_layers_512.0433a567.gz.bin"},
    dirtG: {"diff":"media/tex/ground/dirtG_diff_512.b598cc70.jpg","nor":"media/tex/ground/dirtG_nor_gl_512.df623c53.jpg","rough":"media/tex/ground/dirtG_rough_512.0f9ac2f6.jpg","height":"media/tex/ground/dirtG_height_512.8d91afbb.jpg","layers":"media/tex/ground/dirtG_layers_512.c1b90b0e.gz.bin"},
    grassG: {"diff":"media/tex/ground/grassG_diff_512.1188e448.jpg","nor":"media/tex/ground/grassG_nor_gl_512.aa1fb99a.jpg","rough":"media/tex/ground/grassG_rough_512.80037d2a.jpg","height":"media/tex/ground/grassG_height_512.2e323955.jpg","layers":"media/tex/ground/grassG_layers_512.86029458.gz.bin"},
    grassP: {"diff":"media/tex/ground/grassP_diff_512.2aa44b97.jpg","nor":"media/tex/ground/grassP_nor_gl_512.8734fa23.jpg","rough":"media/tex/ground/grassP_rough_512.3e951b28.jpg","height":"media/tex/ground/grassP_height_512.cd968547.jpg","layers":"media/tex/ground/grassP_layers_512.bd612a8e.gz.bin"},
    grassS: {"diff":"media/tex/ground/grassS_diff_512.f550f134.jpg","nor":"media/tex/ground/grassS_nor_gl_512.6c263be1.jpg","rough":"media/tex/ground/grassS_rough_512.761d90a8.jpg","height":"media/tex/ground/grassS_height_512.d5535f04.jpg","layers":"media/tex/ground/grassS_layers_512.ee27dcce.gz.bin"},
    crackedPv: {"diff":"media/tex/ground/crackedPv_diff_512.2bec12e1.jpg","nor":"media/tex/ground/crackedPv_nor_gl_512.a1a37a91.jpg","rough":"media/tex/ground/cracked_rough_512.e6529d75.jpg","height":"media/tex/ground/crackedPv_height_512.a54d935f.jpg","layers":"media/tex/ground/crackedPv_layers_512.4175733d.gz.bin"},
    brushedPv: {"diff":"media/tex/ground/brushedPv_diff_512.25ee4dad.jpg","nor":"media/tex/ground/brushedPv_nor_gl_512.7820a130.jpg","rough":"media/tex/ground/brushed_rough_512.006fd4cf.jpg","height":"media/tex/ground/brushedPv_height_512.d3b19b0e.jpg","layers":"media/tex/ground/brushedPv_layers_512.26701ce2.gz.bin"},
    asphaltPv: {"diff":"media/tex/ground/asphaltPv_diff_512.5cc5ee99.jpg","nor":"media/tex/ground/asphaltPv_nor_gl_512.7a5097f4.jpg","rough":"media/tex/ground/asphalt_rough_512.ac02fc18.jpg","height":"media/tex/ground/asphaltPv_height_512.867f12b4.jpg","layers":"media/tex/ground/asphaltPv_layers_512.c62c91b8.gz.bin"},
    asphaltaerialPv: {"diff":"media/tex/ground/asphaltaerialPv_diff_512.35669471.jpg","nor":"media/tex/ground/asphaltaerialPv_nor_gl_512.a8df7943.jpg","rough":"media/tex/ground/asphaltaerial_rough_512.a5c0e524.jpg","height":"media/tex/ground/asphaltaerialPv_height_512.668287fd.jpg","layers":"media/tex/ground/asphaltaerialPv_layers_512.b9c7fbdd.gz.bin"},
    leafygrassPv: {"diff":"media/tex/ground/leafygrassPv_diff_512.5146f9d1.jpg","nor":"media/tex/ground/leafygrassPv_nor_gl_512.7b0b82a6.jpg","rough":"media/tex/ground/leafygrass_rough_512.0187dd5d.jpg","height":"media/tex/ground/leafygrassPv_height_512.7782c9e8.jpg","layers":"media/tex/ground/leafygrassPv_layers_512.d203c378.gz.bin"},
    fieldgrass: {"diff":"media/tex/ground/fieldgrass_diff_512.cce845e9.jpg","nor":"media/tex/ground/fieldgrass_nor_gl_512.34959b05.jpg","rough":"media/tex/ground/grass005_rough_512.5497193f.jpg","height":"media/tex/ground/fieldgrass_height_512.4b0905a9.jpg","layers":"media/tex/ground/fieldgrass_layers_512.cd1c530c.gz.bin"},
    lushPv: {"diff":"media/tex/ground/lushPv_diff_512.60992fc9.jpg","nor":"media/tex/ground/lushPv_nor_gl_512.f2bc4f10.jpg","rough":"media/tex/ground/lush_rough_512.8f65b07b.jpg","height":"media/tex/ground/lushPv_height_512.ea34602f.jpg","layers":"media/tex/ground/lushPv_layers_512.73580a51.gz.bin"},
    grassPv: {"diff":"media/tex/ground/grassPv_diff_512.9265fd54.jpg","nor":"media/tex/ground/grassPv_nor_gl_512.61ae6347.jpg","rough":"media/tex/ground/grass_rough_512.f5626b4f.jpg","height":"media/tex/ground/grassPv_height_512.5a801cde.jpg","layers":"media/tex/ground/grassPv_layers_512.88605f85.gz.bin"},
    pebblePv: {"diff":"media/tex/ground/pebblePv_diff_512.40a4421d.jpg","nor":"media/tex/ground/pebblePv_nor_gl_512.69d75104.jpg","rough":"media/tex/ground/pebble_rough_512.d985d705.jpg","height":"media/tex/ground/pebblePv_height_512.f06ba062.jpg","layers":"media/tex/ground/pebblePv_layers_512.f9c07fe1.gz.bin"},
    dryPv: {"diff":"media/tex/ground/dryPv_diff_512.75fa2778.jpg","nor":"media/tex/ground/dryPv_nor_gl_512.f4f6e27d.jpg","rough":"media/tex/ground/dry_rough_512.8360b752.jpg","height":"media/tex/ground/dryPv_height_512.c822a8e1.jpg","layers":"media/tex/ground/dryPv_layers_512.6aea6768.gz.bin"},
    dirtPv: {"diff":"media/tex/ground/dirtPv_diff_512.b7294a0a.jpg","nor":"media/tex/ground/dirtPv_nor_gl_512.e87f2d2e.jpg","rough":"media/tex/ground/dirt_rough_512.a924c560.jpg","height":"media/tex/ground/dirtPv_height_512.bd31ef00.jpg","layers":"media/tex/ground/dirtPv_layers_512.4c91c4a2.gz.bin"},
  },
  libs: {
    splat: [
      {"key":"beach","set":"beach","metres":29.98,"mean":[0.2826,0.2371,0.196]},
      {"key":"rocksA","set":"rocksA","metres":78.93,"mean":[0.2155,0.1901,0.107]},
      {"key":"rocksB","set":"rocksB","metres":50.18,"mean":[0.1648,0.1158,0.046]},
      {"key":"mud","set":"mud","metres":1.25,"mean":[0.0897,0.0702,0.0458]},
      {"key":"leaves","set":"leaves","metres":1.49,"mean":[0.2264,0.1177,0.0461]},
      {"key":"cliff","set":"cliff","metres":6.86,"mean":[0.3136,0.1726,0.11]},
      {"key":"rocksG","set":"rocksG","metres":2.03,"mean":[0.2521,0.2134,0.1638]},
      {"key":"rockyA","set":"rockyA","metres":89.94,"mean":[0.0807,0.0773,0.0122]},
      {"key":"rockyB","set":"rockyB","metres":89.79,"mean":[0.0855,0.053,0.0176]},
      {"key":"grassRock","set":"grassRock","metres":15.04,"mean":[0.169,0.1211,0.0241]},
      {"key":"forestAir","set":"forestAir","metres":80.81,"mean":[0.132,0.1172,0.0305]},
      {"key":"snowAir","set":"snowAir","metres":81.2,"mean":[0.2491,0.2483,0.3039]},
      {"key":"lush","set":"lush","metres":2.4,"mean":[0.0584,0.1065,0.0218]},
      {"key":"grass","set":"grass","metres":2.4,"mean":[0.119,0.1528,0.0305]},
      {"key":"pebble","set":"pebble","metres":4.5,"mean":[0.2178,0.2034,0.1649]},
      {"key":"dry","set":"dry","metres":2.2,"mean":[0.3005,0.2486,0.1239]},
      {"key":"dirt","set":"dirt","metres":1.8,"mean":[0.1326,0.1085,0.0826]},
      {"key":"coastA","set":"coastA","metres":19.94,"mean":[0.0885,0.0593,0.0297]},
      {"key":"coastSand","set":"coastSand","metres":15.2,"mean":[0.0728,0.0598,0.0284]},
    ],
    pavement: [
      {"key":"concreteA","set":"concreteA","name":"the WWII runway - damaged poured concrete","metres":4.5,"role":"base","mean":[0.0662,0.045,0.0276],"source":"Poly Haven","slug":"damaged_concrete_floor"},
      {"key":"concreteB","set":"concreteB","name":"the runway broken up - the damage layer","metres":3.5,"role":"damage","mean":[0.1253,0.0942,0.0705],"source":"Poly Haven","slug":"damaged_concrete_floor_02"},
      {"key":"concreteM","set":"concreteM","name":"moss on concrete - the edges and the joints","metres":3,"role":"moss","mean":[0.0982,0.0967,0.0134],"source":"Poly Haven","slug":"concrete_moss"},
      {"key":"concreteD","set":"concreteD","name":"dirty concrete - taxiway / apron","metres":3,"role":"base","mean":[0.2513,0.2296,0.1895],"source":"Poly Haven","slug":"dirty_concrete"},
      {"key":"asphaltW","set":"asphaltW","name":"worn asphalt - the road","metres":2,"role":"base","mean":[0.0614,0.0405,0.0281],"source":"Poly Haven","slug":"worn_asphalt"},
      {"key":"asphaltC","set":"asphaltC","name":"cracked asphalt - the road damaged","metres":2.2,"role":"damage","mean":[0.0673,0.0404,0.0266],"source":"Poly Haven","slug":"road_damaged"},
      {"key":"gravelR","set":"gravelR","name":"a gravel road","metres":2,"role":"base","mean":[0.1923,0.0986,0.0508],"source":"Poly Haven","slug":"gravel_road"},
      {"key":"gravelK","set":"gravelK","name":"rocky gravel - the shoulder band","metres":1.81,"role":"shoulder","mean":[0.1424,0.058,0.019],"source":"Poly Haven","slug":"rocky_gravel"},
      {"key":"gravelS","set":"gravelS","name":"sandy gravel - the transition to sand","metres":2.53,"role":"base","mean":[0.3221,0.1719,0.0845],"source":"Poly Haven","slug":"sandy_gravel_02"},
      {"key":"dirtP","set":"dirtP","name":"park dirt - the dirt road","metres":3,"role":"base","mean":[0.1926,0.1292,0.0467],"source":"Poly Haven","slug":"park_dirt"},
      {"key":"tracksM","set":"tracksM","name":"muddy tracks - the ruts","metres":2.25,"role":"tracks","mean":[0.0802,0.0291,0.0114],"source":"Poly Haven","slug":"muddy_tracks"},
      {"key":"mudAir","set":"mudAir","name":"aerial mud with tyre tracks - the cleared band","metres":8,"role":"tracks","mean":[0.0489,0.0398,0.0356],"source":"Poly Haven","slug":"aerial_mud_1"},
      {"key":"dirtAir","set":"dirtAir","name":"dirt from above - the macro tier","metres":20,"role":"macro","mean":[0.2055,0.1168,0.0547],"source":"Poly Haven","slug":"dirt_aerial_02"},
      {"key":"sandC","set":"sandC","name":"coast sand - the sand strip","metres":3.94,"role":"base","mean":[0.1133,0.0891,0.0517],"source":"Poly Haven","slug":"coast_sand_04"},
      {"key":"gravelG","set":"gravelG","name":"gravel ground - the grey gravel strip","metres":3,"role":"base","mean":[0.2896,0.2277,0.1406],"source":"Poly Haven","slug":"gravel_ground_01"},
      {"key":"gravelF","set":"gravelF","name":"fine grey gravel - the compacted wheel band","metres":2,"role":"base","mean":[0.4046,0.3836,0.3301],"source":"Poly Haven","slug":"gravel_floor_02"},
      {"key":"gravelB","set":"gravelB","name":"crushed dark stone - the strip edges","metres":2,"role":"shoulder","mean":[0.0788,0.0778,0.0734],"source":"Poly Haven","slug":"gravel_stones"},
      {"key":"rockG","set":"rockG","name":"rocky ground - the coarse patches of a gravel strip","metres":3,"role":"damage","mean":[0.1733,0.1494,0.1073],"source":"Poly Haven","slug":"rock_ground_02"},
      {"key":"dirtS","set":"dirtS","name":"stony dirt path - the dirt road","metres":2.17,"role":"base","mean":[0.0658,0.037,0.0184],"source":"Poly Haven","slug":"stony_dirt_path"},
      {"key":"trailR","set":"trailR","name":"rocky trail - the dirt road coarse patches","metres":2,"role":"damage","mean":[0.2922,0.2182,0.1468],"source":"Poly Haven","slug":"rocky_trail"},
      {"key":"dirtG","set":"dirtG","name":"plain dirt - the compacted wheel tracks","metres":2,"role":"tracks","mean":[0.1253,0.0851,0.0487],"source":"Poly Haven","slug":"dirt"},
      {"key":"grassG","set":"grassG","name":"meadow grass - the grass strip","metres":2.51,"role":"base","mean":[0.1563,0.1181,0.0483],"source":"Poly Haven","slug":"grass_ground"},
      {"key":"grassP","set":"grassP","name":"worn grass with soil - the strip wheel tracks","metres":1,"role":"tracks","mean":[0.2729,0.2227,0.1287],"source":"Poly Haven","slug":"grass_path_2"},
      {"key":"grassS","set":"grassS","name":"sparse mossy grass - the strip rough patches","metres":2,"role":"damage","mean":[0.0796,0.0477,0.0078],"source":"Poly Haven","slug":"sparse_grass"},
      {"key":"cracked","set":"crackedPv","name":"cracked concrete (the old runway look)","metres":2.23,"role":"base","mean":null,"source":"Poly Haven","slug":"cracked_concrete_02"},
      {"key":"brushed","set":"brushedPv","name":"brushed concrete (the apron)","metres":2,"role":"base","mean":null,"source":"Poly Haven","slug":"brushed_concrete_04"},
      {"key":"asphalt","set":"asphaltPv","name":"asphalt","metres":3,"role":"base","mean":null,"source":"Poly Haven","slug":"asphalt_02"},
      {"key":"asphaltaerial","set":"asphaltaerialPv","name":"asphalt from above (the macro tier)","metres":30,"role":"macro","mean":null,"source":"Poly Haven","slug":"aerial_asphalt_01"},
      {"key":"leafygrass","set":"leafygrassPv","name":"leafy grass (the rougher lawn)","metres":2,"role":"grass","mean":null,"source":"Poly Haven","slug":"leafy_grass"},
      {"key":"fieldgrass","set":"fieldgrass","name":"field grass (the strip)","metres":2,"role":"grass","mean":null,"source":"ambientCG","slug":"Grass005"},
      {"key":"lush","set":"lushPv","name":"dense grass","metres":2.4,"role":"grass","mean":[0.0584,0.1065,0.0218],"source":"ambientCG","slug":"Grass001"},
      {"key":"grass","set":"grassPv","name":"grass","metres":2.4,"role":"grass","mean":[0.119,0.1528,0.0305],"source":"ambientCG","slug":"Grass004"},
      {"key":"pebble","set":"pebblePv","name":"pebbles","metres":4.5,"role":"shoulder","mean":[0.2178,0.2034,0.1649],"source":"ambientCG","slug":"Gravel022"},
      {"key":"dry","set":"dryPv","name":"dry ground (the cleared band)","metres":2.2,"role":"shoulder","mean":[0.3005,0.2486,0.1239],"source":"ambientCG","slug":"Ground081"},
      {"key":"dirt","set":"dirtPv","name":"dirt path","metres":1.8,"role":"base","mean":[0.1326,0.1085,0.0826],"source":"ambientCG","slug":"Ground110"},
    ],
    lot: [
      {"key":"lush","set":"lush","name":"dense grass","tile":2.4},
      {"key":"grass","set":"grass","name":"grass","tile":2.4},
      {"key":"pebble","set":"pebble","name":"pebbles","tile":4.5},
      {"key":"dry","set":"dry","name":"dry ground","tile":2.2},
      {"key":"dirt","set":"dirt","name":"dirt path","tile":1.8},
    ],
    site: [
      {"key":"brushed","set":"brushed","name":"brushed concrete","tile":2},
      {"key":"cracked","set":"cracked","name":"cracked concrete","tile":4},
      {"key":"antislip","set":"antislip","name":"anti-slip concrete","tile":2},
      {"key":"asphalt","set":"asphalt","name":"asphalt","tile":4},
      {"key":"asphaltaerial","set":"asphaltaerial","name":"asphalt · aerial","tile":16},
      {"key":"grass004","set":"grass","name":"lawn grass","tile":2},
      {"key":"grass005","set":"grass005","name":"field grass","tile":2},
      {"key":"leafygrass","set":"leafygrass","name":"leafy grass","tile":2},
      {"key":"ground003","set":"ground003","name":"dry ground","tile":2},
      {"key":"dirt","set":"siteDirt","name":"dirt floor","tile":2},
    ],
  },
};
// THE VIEWS: a library's key -> its numbers + getters for the maps its old manifest had (the Image made on first
// read, ONE per url whichever library reads it - a listener, never an onload property: they are shared) +
// `set` (the set's key) and `layers` (the cooked file, prefixed) where cooked.
const GROUND_VIEWS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  const IM = {};
  const mk = src => IM[src] || (IM[src] = (() => { const i = new Image(); i.src = B + src; return i; })());
  const MAPS = {"splat":["diff","nor","height","rough"],"pavement":["diff","nor","rough","height"],"lot":["diff","nor","rough"],"site":["diff","nor","rough"]};
  const view = (L, a) => {
    const s = GROUND_TEX.sets[a.set], o = {};
    for (const k in a) if (k !== 'source' && k !== 'slug') o[k] = a[k];
    if (L !== 'splat') delete o.key;
    o.px = GROUND_TEX.px;
    if (s.layers) o.layers = B + s.layers;
    for (const m of MAPS[L]) if (s[m]) Object.defineProperty(o, m, { get: () => mk(s[m]), enumerable: true });
    return o;
  };
  const dict = L => { const d = {}; for (const a of GROUND_TEX.libs[L]) d[a.key] = view(L, a); return d; };
  return { splat: GROUND_TEX.libs.splat.map(a => view('splat', a)), pavement: dict('pavement'), lot: dict('lot'), site: dict('site') };
})() : null;
const SPLAT_TEX_SETS = GROUND_VIEWS && GROUND_VIEWS.splat;
const PAVEMENT_TEX_SETS = GROUND_VIEWS && GROUND_VIEWS.pavement;
const LOT_TEX_SETS = GROUND_VIEWS && GROUND_VIEWS.lot;
const SITE_TEX_SETS = GROUND_VIEWS && GROUND_VIEWS.site;
// the pavement's provenance, for CREDITS.md and GATE PAVEMENT (never read at runtime)
const PAVEMENT_TEX_CREDITS = GROUND_TEX.libs.pavement.map(a => ({ key: a.key, source: a.source, slug: a.slug, licence: 'CC0', metres: a.metres }));
if (typeof module !== 'undefined' && module.exports) module.exports = { GROUND_TEX, PAVEMENT_TEX_CREDITS };
