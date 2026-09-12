// trees_pack.js - BAKED by tools/tree_prep.py, do not edit.
// The tree payload manifest: one collection per curated pack,
// its subjects, their rungs, and the maps their materials wear.
const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
const TREE_PACK = {
 "note": "baked by tools/tree_prep.py \u2014 see docs/TREE-IMPORT.md",
 "collections": [
  {
   "name": "cedar_tree.glb",
   "bin": "" + B + "media/geo/trees/cedar_tree.bdb2e7ac.bin",
   "bytes": 1508548,
   "credit": {
    "author": "Georgeous (https://sketchfab.com/intice184)",
    "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
    "source": "https://sketchfab.com/3d-models/cedar-tree-adf5bdebd05340659dae92219a63f62d",
    "title": "Cedar tree"
   },
   "licence": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
   "licenceOk": true,
   "place": {
    "size": 1,
    "proportion": 1,
    "sink": 2,
    "dead": 0.12,
    "impa": 6,
    "implight": 1,
    "crownH": 1.3
   },
   "tint": {
    "hue": 0.03,
    "sat": 1,
    "light": 0.59,
    "bark": 1,
    "alpha": 0.4
   },
   "materials": {
    "M_Bark.009": {
     "mode": "OPAQUE",
     "base": "" + B + "media/tex/trees/cedar_tree_m_bark_009_base.6d478c25.jpg",
     "baseSize": [
      256,
      1024
     ],
     "nor": "" + B + "media/tex/trees/cedar_tree_m_bark_009_nor.42e2e9bf.jpg"
    },
    "M_Branch.009": {
     "mode": "MASK",
     "cutoff": 0.6263,
     "coverageMips": true,
     "base": "" + B + "media/tex/trees/cedar_tree_m_branch_009_base.af7f7481.png",
     "baseSize": [
      1024,
      1024
     ],
     "nor": "" + B + "media/tex/trees/cedar_tree_m_branch_009_nor.89a16f71.jpg"
    }
   },
   "subjects": [
    {
     "name": "Cedar_LOD0",
     "h": 17.44,
     "tris": 20695,
     "bb": [
      -5.5168,
      0.0,
      -5.2306,
      5.5168,
      17.4408,
      5.2306
     ],
     "shipped": false,
     "rungs": [
      {
       "lod": 0,
       "tris": 20695,
       "parts": [
        {
         "mat": "M_Bark.009",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -1.035333,
          -0.995948
         ],
         "uvScl": [
          3.880029,
          7.2616
         ],
         "off": 0,
         "len": 84940
        },
        {
         "mat": "M_Branch.009",
         "mode": "MASK",
         "cutoff": 0.6263,
         "uvMin": [
          0.075373,
          0.0
         ],
         "uvScl": [
          0.819688,
          1.0
         ],
         "off": 84940,
         "len": 336124
        }
       ]
      },
      {
       "lod": 1,
       "tris": 15449,
       "parts": [
        {
         "mat": "M_Branch.009",
         "mode": "MASK",
         "cutoff": 0.6263,
         "uvMin": [
          0.075373,
          0.0
         ],
         "uvScl": [
          0.819688,
          1.0
         ],
         "off": 421064,
         "len": 336124
        },
        {
         "mat": "M_Bark.009",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 757188,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 8951,
       "parts": [
        {
         "mat": "M_Branch.009",
         "mode": "MASK",
         "cutoff": 0.6263,
         "uvMin": [
          0.075373,
          0.0
         ],
         "uvScl": [
          0.819688,
          1.0
         ],
         "off": 757508,
         "len": 194628
        },
        {
         "mat": "M_Bark.009",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 952136,
         "len": 320
        }
       ]
      }
     ],
     "stand": [
      {
       "lod": 0,
       "tris": 11899,
       "parts": [
        {
         "mat": "M_Bark.009",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -1.035333,
          -0.995948
         ],
         "uvScl": [
          3.880029,
          7.2616
         ],
         "off": 952456,
         "len": 84940
        },
        {
         "mat": "M_Branch.009",
         "mode": "MASK",
         "cutoff": 0.6263,
         "uvMin": [
          0.075373,
          0.0
         ],
         "uvScl": [
          0.819688,
          1.0
         ],
         "off": 1037396,
         "len": 144580
        }
       ]
      },
      {
       "lod": 1,
       "tris": 6653,
       "parts": [
        {
         "mat": "M_Branch.009",
         "mode": "MASK",
         "cutoff": 0.6263,
         "uvMin": [
          0.075373,
          0.0
         ],
         "uvScl": [
          0.819688,
          1.0
         ],
         "off": 1181976,
         "len": 144580
        },
        {
         "mat": "M_Bark.009",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 1326556,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 4442,
       "parts": [
        {
         "mat": "M_Branch.009",
         "mode": "MASK",
         "cutoff": 0.6263,
         "uvMin": [
          0.075373,
          0.0
         ],
         "uvScl": [
          0.819688,
          1.0
         ],
         "off": 1326876,
         "len": 96412
        },
        {
         "mat": "M_Bark.009",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 1423288,
         "len": 320
        }
       ]
      }
     ],
     "snag": [
      {
       "lod": 0,
       "tris": 5260,
       "parts": [
        {
         "mat": "M_Bark.009",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -1.035333,
          -0.995948
         ],
         "uvScl": [
          3.880029,
          7.2616
         ],
         "off": 1423608,
         "len": 84940
        }
       ]
      }
     ]
    }
   ]
  },
  {
   "name": "fir_tree_georgeous.glb",
   "bin": "" + B + "media/geo/trees/fir_tree_georgeous.a57e0115.bin",
   "bytes": 457952,
   "credit": {
    "author": "Georgeous (https://sketchfab.com/intice184)",
    "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
    "source": "https://sketchfab.com/3d-models/fir-tree-0965de5def1342cd8b8b1a0fa5643e27",
    "title": "Fir tree"
   },
   "licence": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
   "licenceOk": true,
   "place": {
    "size": 1,
    "proportion": 1,
    "sink": 1.5,
    "dead": 0.08,
    "impa": 6,
    "implight": 1,
    "crownH": 1.3
   },
   "tint": {
    "hue": 0.06,
    "sat": 1,
    "light": 0.43,
    "bark": 1,
    "alpha": 0.1
   },
   "materials": {
    "M_Branch.007": {
     "mode": "MASK",
     "cutoff": 0.608,
     "coverageMips": true,
     "base": "" + B + "media/tex/trees/fir_tree_georgeous_m_branch_007_base.4742577f.png",
     "baseSize": [
      1024,
      1024
     ],
     "nor": "" + B + "media/tex/trees/fir_tree_georgeous_m_branch_007_nor.e8688e34.jpg"
    },
    "M_Bark.007": {
     "mode": "OPAQUE",
     "base": "" + B + "media/tex/trees/fir_tree_georgeous_m_bark_007_base.4dc7a894.jpg",
     "baseSize": [
      256,
      1024
     ],
     "nor": "" + B + "media/tex/trees/fir_tree_georgeous_m_bark_007_nor.beac0ead.jpg"
    }
   },
   "subjects": [
    {
     "name": "Fir01_LOD0",
     "h": 13.42,
     "tris": 7784,
     "bb": [
      -4.3414,
      0.0,
      -4.0741,
      4.3414,
      13.4179,
      4.0741
     ],
     "shipped": false,
     "rungs": [
      {
       "lod": 0,
       "tris": 7784,
       "parts": [
        {
         "mat": "M_Branch.007",
         "mode": "MASK",
         "cutoff": 0.608,
         "uvMin": [
          0.045048,
          0.0
         ],
         "uvScl": [
          0.926313,
          1.0
         ],
         "off": 0,
         "len": 79724
        },
        {
         "mat": "M_Bark.007",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.999265,
          -0.985275
         ],
         "uvScl": [
          3.843961,
          6.180435
         ],
         "off": 79724,
         "len": 72676
        }
       ]
      },
      {
       "lod": 1,
       "tris": 3406,
       "parts": [
        {
         "mat": "M_Branch.007",
         "mode": "MASK",
         "cutoff": 0.608,
         "uvMin": [
          0.045048,
          0.0
         ],
         "uvScl": [
          0.926313,
          1.0
         ],
         "off": 152400,
         "len": 79724
        },
        {
         "mat": "M_Bark.007",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 232124,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 1798,
       "parts": [
        {
         "mat": "M_Branch.007",
         "mode": "MASK",
         "cutoff": 0.608,
         "uvMin": [
          0.045048,
          0.0
         ],
         "uvScl": [
          0.926313,
          1.0
         ],
         "off": 232444,
         "len": 41936
        },
        {
         "mat": "M_Bark.007",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 274380,
         "len": 320
        }
       ]
      }
     ],
     "stand": [
      {
       "lod": 0,
       "tris": 4992,
       "parts": [
        {
         "mat": "M_Branch.007",
         "mode": "MASK",
         "cutoff": 0.608,
         "uvMin": [
          0.045048,
          0.0
         ],
         "uvScl": [
          0.926313,
          1.0
         ],
         "off": 274700,
         "len": 14112
        },
        {
         "mat": "M_Bark.007",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.999265,
          -0.985275
         ],
         "uvScl": [
          3.843961,
          6.180435
         ],
         "off": 288812,
         "len": 72676
        }
       ]
      },
      {
       "lod": 1,
       "tris": 614,
       "parts": [
        {
         "mat": "M_Branch.007",
         "mode": "MASK",
         "cutoff": 0.608,
         "uvMin": [
          0.045048,
          0.0
         ],
         "uvScl": [
          0.926313,
          1.0
         ],
         "off": 361488,
         "len": 14112
        },
        {
         "mat": "M_Bark.007",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 375600,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 398,
       "parts": [
        {
         "mat": "M_Branch.007",
         "mode": "MASK",
         "cutoff": 0.608,
         "uvMin": [
          0.045048,
          0.0
         ],
         "uvScl": [
          0.926313,
          1.0
         ],
         "off": 375920,
         "len": 9036
        },
        {
         "mat": "M_Bark.007",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 384956,
         "len": 320
        }
       ]
      }
     ],
     "snag": [
      {
       "lod": 0,
       "tris": 4392,
       "parts": [
        {
         "mat": "M_Bark.007",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.999265,
          -0.985275
         ],
         "uvScl": [
          3.843961,
          6.180435
         ],
         "off": 385276,
         "len": 72676
        }
       ]
      }
     ]
    }
   ]
  },
  {
   "name": "larch_tree.glb",
   "bin": "" + B + "media/geo/trees/larch_tree.9c836604.bin",
   "bytes": 761868,
   "credit": {
    "author": "Georgeous (https://sketchfab.com/intice184)",
    "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
    "source": "https://sketchfab.com/3d-models/larch-tree-d027dae8c92544d79b946edcea98deca",
    "title": "Larch tree"
   },
   "licence": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
   "licenceOk": true,
   "place": {
    "size": 1,
    "proportion": 1,
    "sink": 2,
    "dead": 0.09,
    "impa": 6.5,
    "implight": 1,
    "crownH": 1.3
   },
   "tint": {
    "hue": 0.03,
    "sat": 0.48,
    "light": 0.68,
    "bark": 1,
    "alpha": 0
   },
   "materials": {
    "M_Bark": {
     "mode": "OPAQUE",
     "base": "" + B + "media/tex/trees/larch_tree_m_bark_base.3057dd84.jpg",
     "baseSize": [
      256,
      1024
     ],
     "nor": "" + B + "media/tex/trees/larch_tree_m_bark_nor.24e88780.jpg"
    },
    "M_Branch": {
     "mode": "MASK",
     "cutoff": 0.0777,
     "coverageMips": true,
     "base": "" + B + "media/tex/trees/larch_tree_m_branch_base.8e0f34a9.png",
     "baseSize": [
      1024,
      1024
     ],
     "nor": "" + B + "media/tex/trees/larch_tree_m_branch_nor.de257583.jpg"
    }
   },
   "subjects": [
    {
     "name": "Larch_LOD0",
     "h": 19.2,
     "tris": 12201,
     "bb": [
      -5.2387,
      0.0,
      -5.3227,
      5.2387,
      19.1929,
      5.3227
     ],
     "shipped": false,
     "rungs": [
      {
       "lod": 0,
       "tris": 12201,
       "parts": [
        {
         "mat": "M_Bark",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.991051,
          -1.0157
         ],
         "uvScl": [
          3.835747,
          8.146577
         ],
         "off": 0,
         "len": 82204
        },
        {
         "mat": "M_Branch",
         "mode": "MASK",
         "cutoff": 0.0777,
         "uvMin": [
          0.073034,
          0.0
         ],
         "uvScl": [
          0.853422,
          1.0
         ],
         "off": 82204,
         "len": 146580
        }
       ]
      },
      {
       "lod": 1,
       "tris": 6725,
       "parts": [
        {
         "mat": "M_Branch",
         "mode": "MASK",
         "cutoff": 0.0777,
         "uvMin": [
          0.073034,
          0.0
         ],
         "uvScl": [
          0.853422,
          1.0
         ],
         "off": 228784,
         "len": 146580
        },
        {
         "mat": "M_Bark",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 375364,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 3613,
       "parts": [
        {
         "mat": "M_Branch",
         "mode": "MASK",
         "cutoff": 0.0777,
         "uvMin": [
          0.073034,
          0.0
         ],
         "uvScl": [
          0.853422,
          1.0
         ],
         "off": 375684,
         "len": 78656
        },
        {
         "mat": "M_Bark",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 454340,
         "len": 320
        }
       ]
      }
     ],
     "stand": [
      {
       "lod": 0,
       "tris": 7964,
       "parts": [
        {
         "mat": "M_Bark",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.991051,
          -1.0157
         ],
         "uvScl": [
          3.835747,
          8.146577
         ],
         "off": 454660,
         "len": 82204
        },
        {
         "mat": "M_Branch",
         "mode": "MASK",
         "cutoff": 0.0777,
         "uvMin": [
          0.073034,
          0.0
         ],
         "uvScl": [
          0.853422,
          1.0
         ],
         "off": 536864,
         "len": 54000
        }
       ]
      },
      {
       "lod": 1,
       "tris": 2488,
       "parts": [
        {
         "mat": "M_Branch",
         "mode": "MASK",
         "cutoff": 0.0777,
         "uvMin": [
          0.073034,
          0.0
         ],
         "uvScl": [
          0.853422,
          1.0
         ],
         "off": 590864,
         "len": 54000
        },
        {
         "mat": "M_Bark",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 644864,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 1580,
       "parts": [
        {
         "mat": "M_Branch",
         "mode": "MASK",
         "cutoff": 0.0777,
         "uvMin": [
          0.073034,
          0.0
         ],
         "uvScl": [
          0.853422,
          1.0
         ],
         "off": 645184,
         "len": 34160
        },
        {
         "mat": "M_Bark",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 679344,
         "len": 320
        }
       ]
      }
     ],
     "snag": [
      {
       "lod": 0,
       "tris": 5490,
       "parts": [
        {
         "mat": "M_Bark",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.991051,
          -1.0157
         ],
         "uvScl": [
          3.835747,
          8.146577
         ],
         "off": 679664,
         "len": 82204
        }
       ]
      }
     ]
    }
   ]
  },
  {
   "name": "realistic_fir_trees_pack_lods_gameready.glb",
   "bin": "" + B + "media/geo/trees/realistic_fir_trees_pack_lods_gameready.28e93c73.bin",
   "bytes": 1157756,
   "credit": {
    "author": "LOLIPOP (https://sketchfab.com/lolipop_1707)",
    "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
    "source": "https://sketchfab.com/3d-models/realistic-fir-trees-pack-lods-gameready-f58e8b6d733e4b0586e5b7db847b89e7",
    "title": "Realistic Fir Trees Pack (LODS, gameready)"
   },
   "licence": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
   "licenceOk": true,
   "place": {
    "size": 2.1,
    "proportion": 2.85,
    "sink": 0,
    "dead": 0.08,
    "impa": 6,
    "implight": 1,
    "crownH": 1.3
   },
   "tint": {
    "hue": 0.08,
    "sat": 0.47,
    "light": 1.3,
    "bark": 1,
    "alpha": 0.1
   },
   "materials": {
    "Bark_Mat": {
     "mode": "OPAQUE",
     "base": "" + B + "media/tex/trees/realistic_fir_trees_pack_lods_gameready_bark_mat_base.14a749d2.jpg",
     "baseSize": [
      512,
      1024
     ],
     "nor": "" + B + "media/tex/trees/realistic_fir_trees_pack_lods_gameready_bark_mat_nor.c153a8b2.jpg"
    },
    "Brunches_Mat": {
     "mode": "MASK",
     "cutoff": 0.3764,
     "coverageMips": true,
     "base": "" + B + "media/tex/trees/realistic_fir_trees_pack_lods_gameready_brunches_mat_base.96c367ea.png",
     "baseSize": [
      1024,
      1024
     ],
     "nor": "" + B + "media/tex/trees/realistic_fir_trees_pack_lods_gameready_brunches_mat_nor.b86b2b72.jpg"
    }
   },
   "subjects": [
    {
     "name": "Christmas tree",
     "h": 9.29,
     "tris": 22890,
     "bb": [
      -2.6433,
      0.0,
      -2.5178,
      2.6433,
      9.293,
      2.5178
     ],
     "shipped": true,
     "rungs": [
      {
       "lod": 0,
       "tris": 12969,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 0,
         "len": 121988
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.962198,
          -0.997988
         ],
         "uvScl": [
          4.235118,
          28.290287
         ],
         "off": 121988,
         "len": 120686
        }
       ]
      },
      {
       "lod": 1,
       "tris": 6110,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 242674,
         "len": 121988
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 364662,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 3190,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 364982,
         "len": 63588
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 428570,
         "len": 320
        }
       ]
      }
     ],
     "stand": [
      {
       "lod": 0,
       "tris": 8389,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 428890,
         "len": 30388
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.962198,
          -0.997988
         ],
         "uvScl": [
          4.235118,
          28.290287
         ],
         "off": 459278,
         "len": 120686
        }
       ]
      },
      {
       "lod": 1,
       "tris": 1530,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 579964,
         "len": 30388
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 610352,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 980,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 610672,
         "len": 19388
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 630060,
         "len": 320
        }
       ]
      }
     ],
     "snag": [
      {
       "lod": 0,
       "tris": 6873,
       "parts": [
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.962198,
          -0.997988
         ],
         "uvScl": [
          4.235118,
          28.290287
         ],
         "off": 630380,
         "len": 120686
        }
       ]
      }
     ]
    },
    {
     "name": "Christmas tree_2",
     "h": 4.16,
     "tris": 12709,
     "bb": [
      -1.3584,
      0.0,
      -1.3636,
      1.3584,
      4.1583,
      1.3636
     ],
     "shipped": true,
     "rungs": [
      {
       "lod": 0,
       "tris": 6813,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 751066,
         "len": 66788
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.968788,
          -0.984434
         ],
         "uvScl": [
          4.222178,
          41.036432
         ],
         "off": 817854,
         "len": 63294
        }
       ]
      },
      {
       "lod": 1,
       "tris": 3350,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 881148,
         "len": 66788
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 947936,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 1770,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 948256,
         "len": 35188
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 983444,
         "len": 320
        }
       ]
      }
     ],
     "stand": [
      {
       "lod": 0,
       "tris": 4373,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 983764,
         "len": 17988
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.968788,
          -0.984434
         ],
         "uvScl": [
          4.222178,
          41.036432
         ],
         "off": 1001752,
         "len": 63294
        }
       ]
      },
      {
       "lod": 1,
       "tris": 910,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 1065046,
         "len": 17988
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 1083034,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 550,
       "parts": [
        {
         "mat": "Brunches_Mat",
         "mode": "MASK",
         "cutoff": 0.3764,
         "uvMin": [
          0.017154,
          0.0
         ],
         "uvScl": [
          0.97667,
          0.991093
         ],
         "off": 1083354,
         "len": 10788
        },
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 1094142,
         "len": 320
        }
       ]
      }
     ],
     "snag": [
      {
       "lod": 0,
       "tris": 3477,
       "parts": [
        {
         "mat": "Bark_Mat",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.968788,
          -0.984434
         ],
         "uvScl": [
          4.222178,
          41.036432
         ],
         "off": 1094462,
         "len": 63294
        }
       ]
      }
     ]
    }
   ]
  },
  {
   "name": "spruce_tree.glb",
   "bin": "" + B + "media/geo/trees/spruce_tree.e8a3ee71.bin",
   "bytes": 582900,
   "credit": {
    "author": "Georgeous (https://sketchfab.com/intice184)",
    "license": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
    "source": "https://sketchfab.com/3d-models/spruce-tree-7a5db417827244d98827459bce0cc944",
    "title": "Spruce tree"
   },
   "licence": "CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)",
   "licenceOk": true,
   "place": {
    "size": 1.08,
    "proportion": 1,
    "sink": 0.5,
    "dead": 0.08,
    "impa": 6,
    "implight": 1,
    "crownH": 1.3
   },
   "tint": {
    "hue": -0.01,
    "sat": 1.1,
    "light": 0.54,
    "bark": 1,
    "alpha": 0.2
   },
   "materials": {
    "M_Bark.001": {
     "mode": "OPAQUE",
     "base": "" + B + "media/tex/trees/spruce_tree_m_bark_001_base.b686d5b2.jpg",
     "baseSize": [
      256,
      1024
     ],
     "nor": "" + B + "media/tex/trees/spruce_tree_m_bark_001_nor.26e3e887.jpg"
    },
    "M_Branch.001": {
     "mode": "MASK",
     "cutoff": 0.2971,
     "coverageMips": true,
     "base": "" + B + "media/tex/trees/spruce_tree_m_branch_001_base.f76f96b7.png",
     "baseSize": [
      1024,
      1024
     ],
     "nor": "" + B + "media/tex/trees/spruce_tree_m_branch_001_nor.d03d0d8d.jpg"
    }
   },
   "subjects": [
    {
     "name": "Spruce_LOD0",
     "h": 17.43,
     "tris": 10387,
     "bb": [
      -4.0477,
      0.0,
      -4.2117,
      4.0477,
      17.4215,
      4.2117
     ],
     "shipped": false,
     "rungs": [
      {
       "lod": 0,
       "tris": 10387,
       "parts": [
        {
         "mat": "M_Bark.001",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.938993,
          -0.991626
         ],
         "uvScl": [
          2.873005,
          9.755025
         ],
         "off": 0,
         "len": 76056
        },
        {
         "mat": "M_Branch.001",
         "mode": "MASK",
         "cutoff": 0.2971,
         "uvMin": [
          0.060496,
          0.0
         ],
         "uvScl": [
          0.840352,
          1.0
         ],
         "off": 76056,
         "len": 120060
        }
       ]
      },
      {
       "lod": 1,
       "tris": 5616,
       "parts": [
        {
         "mat": "M_Branch.001",
         "mode": "MASK",
         "cutoff": 0.2971,
         "uvMin": [
          0.060496,
          0.0
         ],
         "uvScl": [
          0.840352,
          1.0
         ],
         "off": 196116,
         "len": 120060
        },
        {
         "mat": "M_Bark.001",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 316176,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 3004,
       "parts": [
        {
         "mat": "M_Branch.001",
         "mode": "MASK",
         "cutoff": 0.2971,
         "uvMin": [
          0.060496,
          0.0
         ],
         "uvScl": [
          0.840352,
          1.0
         ],
         "off": 316496,
         "len": 64068
        },
        {
         "mat": "M_Bark.001",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 380564,
         "len": 320
        }
       ]
      }
     ],
     "stand": [
      {
       "lod": 0,
       "tris": 5618,
       "parts": [
        {
         "mat": "M_Bark.001",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.938993,
          -0.991626
         ],
         "uvScl": [
          2.873005,
          9.755025
         ],
         "off": 380884,
         "len": 76056
        },
        {
         "mat": "M_Branch.001",
         "mode": "MASK",
         "cutoff": 0.2971,
         "uvMin": [
          0.060496,
          0.0
         ],
         "uvScl": [
          0.840352,
          1.0
         ],
         "off": 456940,
         "len": 17848
        }
       ]
      },
      {
       "lod": 1,
       "tris": 847,
       "parts": [
        {
         "mat": "M_Branch.001",
         "mode": "MASK",
         "cutoff": 0.2971,
         "uvMin": [
          0.060496,
          0.0
         ],
         "uvScl": [
          0.840352,
          1.0
         ],
         "off": 474788,
         "len": 17848
        },
        {
         "mat": "M_Bark.001",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 492636,
         "len": 320
        }
       ]
      },
      {
       "lod": 2,
       "tris": 647,
       "parts": [
        {
         "mat": "M_Branch.001",
         "mode": "MASK",
         "cutoff": 0.2971,
         "uvMin": [
          0.060496,
          0.0
         ],
         "uvScl": [
          0.840352,
          1.0
         ],
         "off": 492956,
         "len": 13568
        },
        {
         "mat": "M_Bark.001",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          0.0,
          0
         ],
         "uvScl": [
          1.0,
          1
         ],
         "off": 506524,
         "len": 320
        }
       ]
      }
     ],
     "snag": [
      {
       "lod": 0,
       "tris": 4785,
       "parts": [
        {
         "mat": "M_Bark.001",
         "mode": "OPAQUE",
         "cutoff": 0.0,
         "uvMin": [
          -0.938993,
          -0.991626
         ],
         "uvScl": [
          2.873005,
          9.755025
         ],
         "off": 506844,
         "len": 76056
        }
       ]
      }
     ]
    }
   ]
  }
 ]
};
if (typeof module !== 'undefined' && module.exports) module.exports = TREE_PACK;
