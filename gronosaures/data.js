/* ================================================================
   LE GRAND ATLAS DU TEMPS PROFOND — data.js
   Bloc 1 : généré par tools/ingest.py depuis 06_Index_creatures_MVP.json
   et quiz_paleontologie_300_questions.json. Ne pas éditer à la main.
   ================================================================ */
/* 110 créatures, 18 sites. */
const CREATURES=[
 {"id": "EDI-01", "site": "EDI", "nom": "Dickinsonia costata", "groupe": "Dickinsoniomorphe édiacarien", "periode": "Édiacarien terminal", "age": "≈ 558–550 Ma", "ageMin": 550.0, "ageMax": 558.0, "lieu": "Région de la mer Blanche, Russie, et Australie", "milieu": "Aquatique marin benthique", "regime": "Absorption externe ou broutage de tapis microbiens", "taille": "5 cm à plus de 1 m", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Organisme ovale et très aplati, composé d’unités répétées, capable de se déplacer sur des tapis microbiens.", "prudence": "Le contour est clair, mais la face supérieure, les organes internes et même sa position exacte dans l’arbre du vivant restent discutés.", "src": [["Dickinsonia — Geological Magazine", "https://www.cambridge.org/core/journals/geological-magazine/article/dickinsonia-mobile-and-adhered/A8BF44BADED149AF3E0F5EE930DAE02A"], ["Traces of locomotion — Geosciences", "https://www.mdpi.com/2076-3263/9/9/395"]], "pack": "Mer Blanche — Avant les plans corporels modernes", "img": "cartes/EDI-01.webp"},
 {"id": "EDI-02", "site": "EDI", "nom": "Yorgia waggoneri", "groupe": "Dickinsoniomorphe édiacarien", "periode": "Édiacarien terminal", "age": "≈ 558–550 Ma", "ageMin": 550.0, "ageMax": 558.0, "lieu": "Mer Blanche, Russie", "milieu": "Aquatique marin benthique", "regime": "Broutage ou absorption sur tapis microbiens", "taille": "10–25 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Organisme aplati asymétrique, composé de modules alternés, connu avec des traces successives de déplacement.", "prudence": "La forme externe est connue, mais l’anatomie interne et le mécanisme locomoteur ne le sont pas.", "src": [["Yorgia — Wikipedia", "https://en.wikipedia.org/wiki/Yorgia"], ["Wikipedia", "https://en.wikipedia.org/wiki/Yorgia_waggoneri"]], "pack": "Mer Blanche — Avant les plans corporels modernes", "img": "cartes/EDI-02.webp"},
 {"id": "EDI-03", "site": "EDI", "nom": "Kimberella quadrata", "groupe": "Bilatérien édiacarien probable", "periode": "Édiacarien terminal", "age": "≈ 558–550 Ma", "ageMin": 550.0, "ageMax": 558.0, "lieu": "Mer Blanche, Russie, et Australie", "milieu": "Aquatique marin benthique", "regime": "Brouteur de tapis microbiens", "taille": "3–15 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Animal en dôme bas, probablement musculeux, associé à des traces de raclage du substrat.", "prudence": "Il ne faut pas le copier sur une limace moderne : la coquille, le manteau et l’appareil buccal exacts restent débattus.", "src": [["UCMP Berkeley — Kimberella", "https://ucmp.berkeley.edu/vendian/kimberella.html"], ["Kimberella — Wikipedia", "https://en.wikipedia.org/wiki/Kimberella"]], "pack": "Mer Blanche — Avant les plans corporels modernes", "img": "cartes/EDI-03.webp"},
 {"id": "EDI-04", "site": "EDI", "nom": "Tribrachidium heraldicum", "groupe": "Trilobozoaire édiacarien", "periode": "Édiacarien terminal", "age": "≈ 558–550 Ma", "ageMin": 550.0, "ageMax": 558.0, "lieu": "Australie et Russie", "milieu": "Aquatique marin benthique", "regime": "Suspensivore passif probable", "taille": "2–5 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Organisme discoïde à symétrie triradiale et trois bras courbes, sans équivalent moderne évident.", "prudence": "Les flux d’eau suggèrent une suspension alimentaire, mais la bouche, les organes et l’orientation en vie restent inconnus.", "src": [["Tribrachidium — Wikipedia", "https://en.wikipedia.org/wiki/Tribrachidium"], ["Tribrachidium — Geosciences", "https://www.mdpi.com/2076-3263/9/9/395"]], "pack": "Mer Blanche — Avant les plans corporels modernes", "img": "cartes/EDI-04.webp"},
 {"id": "EDI-05", "site": "EDI", "nom": "Parvancorina minchami", "groupe": "Organisme édiacarien bilatérien énigmatique", "periode": "Édiacarien terminal", "age": "≈ 558–550 Ma", "ageMin": 550.0, "ageMax": 558.0, "lieu": "Australie et Russie", "milieu": "Aquatique marin benthique", "regime": "Suspensivore ou détritivore ; incertain", "taille": "1–3 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Faible à moyenne", "confN": 2, "desc": "Petit organisme en forme d’ancre ou de bouclier, parfois orienté par rapport aux courants.", "prudence": "L’aspect externe est connu, mais ses appendices, son alimentation et ses affinités restent très incertains.", "src": [["Parvancorina — Wikipedia", "https://en.wikipedia.org/wiki/Parvancorina"], ["Parvancorina — Scientific Reports", "https://www.nature.com/articles/srep45539"]], "pack": "Mer Blanche — Avant les plans corporels modernes", "img": "cartes/EDI-05.webp"},
 {"id": "EDI-06", "site": "EDI", "nom": "Andiva ivantsovi", "groupe": "Dickinsoniomorphe probable", "periode": "Édiacarien terminal", "age": "≈ 558–550 Ma", "ageMin": 550.0, "ageMax": 558.0, "lieu": "Mer Blanche, Russie", "milieu": "Aquatique marin benthique", "regime": "Broutage ou absorption ; incertain", "taille": "5–10 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Faible à moyenne", "confN": 2, "desc": "Organisme ovale compact à région antérieure distincte et segmentation oblique.", "prudence": "Connu par des empreintes aplaties : relief, tissus mous, locomotion et position phylogénétique restent très mal contraints.", "src": [["Andiva — Wikipedia", "https://en.wikipedia.org/wiki/Andiva"], ["Wikipedia", "https://en.wikipedia.org/wiki/Andiva_ivantsovi"]], "pack": "Mer Blanche — Avant les plans corporels modernes", "img": "cartes/EDI-06.webp"},
 {"id": "TRI-01", "site": "TRI", "nom": "Paradoxides davidis", "groupe": "Trilobite paradoxididé", "periode": "Cambrien moyen", "age": "≈ 509–497 Ma", "ageMin": 497.0, "ageMax": 509.0, "lieu": "Pays de Galles et Europe", "milieu": "Aquatique marin benthique", "regime": "Détritivore, charognard ou prédateur opportuniste", "taille": "30–60 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Très grand trilobite allongé, à nombreux segments thoraciques et longues épines génales.", "prudence": "L’exosquelette est bien connu ; les pattes, antennes, couleurs et habitudes alimentaires sont plus incertaines.", "src": [["Field Museum — Paradoxides", "https://www.fieldmuseum.org/blog/trilobite-paradoxides"], ["Wikipedia", "https://en.wikipedia.org/wiki/Paradoxides_davidis"]], "pack": "Trilobites et alliés", "img": "cartes/TRI-01.webp"},
 {"id": "TRI-02", "site": "TRI", "nom": "Olenoides serratus", "groupe": "Trilobite dorypygidé", "periode": "Cambrien moyen", "age": "≈ 508–505 Ma", "ageMin": 505.0, "ageMax": 508.0, "lieu": "Colombie-Britannique, Canada", "milieu": "Aquatique marin benthique", "regime": "Prédateur, charognard ou détritivore", "taille": "5–10 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Trilobite épineux du Schiste de Burgess, connu avec antennes, pattes et branchies exceptionnellement préservées.", "prudence": "Les appendices sont bien contraints ; la couleur et le comportement restent inconnus.", "src": [["Olenoides — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/olenoides-serratus/"], ["Wikipedia", "https://en.wikipedia.org/wiki/Olenoides_serratus"]], "pack": "Trilobites et alliés", "img": "cartes/TRI-02.webp"},
 {"id": "TRI-03", "site": "TRI", "nom": "Dicranurus monstrosus", "groupe": "Trilobite odontopleuridé", "periode": "Dévonien inférieur", "age": "≈ 408–397 Ma", "ageMin": 397.0, "ageMax": 408.0, "lieu": "Maroc", "milieu": "Aquatique marin benthique", "regime": "Détritivore ou charognard", "taille": "5–10 cm avec les cornes", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Trilobite très épineux portant deux longues cornes céphaliques recourbées vers l’arrière.", "prudence": "L’exosquelette est spectaculaire et bien connu ; les fonctions des épines et la posture des appendices restent discutées.", "src": [["Dicranurus — Wikipedia", "https://en.wikipedia.org/wiki/Dicranurus"], ["American Museum of Natural History — Trilobites", "https://www.amnh.org/research/paleontology/collections/fossil-invertebrate-collection/trilobite-website"]], "pack": "Trilobites et alliés", "img": "cartes/TRI-03.webp"},
 {"id": "TRI-04", "site": "TRI", "nom": "Walliserops trifurcatus", "groupe": "Trilobite asteropyginé", "periode": "Dévonien inférieur", "age": "≈ 408–393 Ma", "ageMin": 393.0, "ageMax": 408.0, "lieu": "Maroc", "milieu": "Aquatique marin benthique", "regime": "Détritivore, charognard ou prédateur opportuniste", "taille": "5–10 cm, trident inclus", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Trilobite célèbre pour son long trident frontal à trois pointes.", "prudence": "Le trident est certain, mais son usage — combat, affichage ou défense — reste hypothétique ; éviter une fonction présentée comme acquise.", "src": [["Walliserops — Wikipedia", "https://en.wikipedia.org/wiki/Walliserops"], ["Walliserops — PNAS", "https://www.pnas.org/doi/10.1073/pnas.2119970120"]], "pack": "Trilobites et alliés", "img": "cartes/TRI-04.webp"},
 {"id": "TRI-05", "site": "TRI", "nom": "Drotops armatus", "groupe": "Trilobite phacopidé", "periode": "Dévonien inférieur", "age": "≈ 408–393 Ma", "ageMin": 393.0, "ageMax": 408.0, "lieu": "Maroc", "milieu": "Aquatique marin benthique", "regime": "Charognard, détritivore ou petit prédateur", "taille": "10–20 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Trilobite robuste aux grands yeux schizochroaux composés de nombreuses lentilles distinctes.", "prudence": "L’exosquelette et les yeux sont très bien documentés ; les pattes, les couleurs et le comportement restent moins connus.", "src": [["Drotops — Wikipedia", "https://en.wikipedia.org/wiki/Drotops"], ["Wikipedia", "https://en.wikipedia.org/wiki/Drotops_armatus"]], "pack": "Trilobites et alliés", "img": "cartes/TRI-05.webp"},
 {"id": "TRI-06", "site": "TRI", "nom": "Trinucleus fimbriatus", "groupe": "Trilobite trinucleidé", "periode": "Ordovicien supérieur", "age": "≈ 460–445 Ma", "ageMin": 445.0, "ageMax": 460.0, "lieu": "Royaume-Uni et Europe", "milieu": "Aquatique marin benthique", "regime": "Suspensivore ou déposivore", "taille": "2–5 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Petit trilobite doté d’une vaste frange céphalique perforée, radicalement différente des formes épineuses.", "prudence": "La frange est bien connue, mais son rôle hydrodynamique ou alimentaire et les appendices ventraux restent discutés.", "src": [["Trinucleus — Wikipedia", "https://en.wikipedia.org/wiki/Trinucleus"], ["American Museum of Natural History — Trilobites", "https://www.amnh.org/research/paleontology/collections/fossil-invertebrate-collection/trilobite-website"]], "pack": "Trilobites et alliés", "img": "cartes/TRI-06.webp"},
 {"id": "BURG-01", "site": "BURG", "nom": "Anomalocaris canadensis", "groupe": "Radiodonte, arthropode souche", "periode": "Cambrien moyen", "age": "≈ 508–505 Ma", "ageMin": 505.0, "ageMax": 508.0, "lieu": "Colombie-Britannique, Canada", "milieu": "Aquatique marin", "regime": "Prédateur ou nécrophage de proies relativement tendres", "taille": "0,6–1 m", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 5, "desc": "Grand nageur du Schiste de Burgess, muni de lobes latéraux, d’yeux pédonculés et de deux appendices frontaux articulés.", "prudence": "La forme générale est bien connue, mais les couleurs, la texture cuticulaire et la puissance exacte de la morsure restent hypothétiques.", "src": [["Anomalocaris — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/anomalocaris-canadensis/"], ["Royal Ontario Museum — Burgess Shale", "https://burgess-shale.rom.on.ca/"]], "pack": "Burgess — L’étrangeté cambrienne", "img": "cartes/BURG-01.webp"},
 {"id": "BURG-02", "site": "BURG", "nom": "Opabinia regalis", "groupe": "Arthropode souche", "periode": "Cambrien moyen", "age": "≈ 508–505 Ma", "ageMin": 505.0, "ageMax": 508.0, "lieu": "Colombie-Britannique, Canada", "milieu": "Aquatique marin", "regime": "Petit prédateur, fouisseur ou collecteur de particules ; régime discuté", "taille": "4–7 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 5, "desc": "Petit animal nageur à cinq yeux, proboscis préhensile et éventail caudal, emblématique des plans corporels cambriens.", "prudence": "Le contour est exceptionnellement préservé ; le fonctionnement du proboscis et le mode alimentaire précis restent débattus.", "src": [["Opabinia — Encyclopaedia Britannica", "https://www.britannica.com/animal/Opabinia"], ["Wikipedia", "https://en.wikipedia.org/wiki/Opabinia_regalis"]], "pack": "Burgess — L’étrangeté cambrienne", "img": "cartes/BURG-02.webp"},
 {"id": "BURG-03", "site": "BURG", "nom": "Hallucigenia sparsa", "groupe": "Lobopodien, proche des onychophores", "periode": "Cambrien moyen", "age": "≈ 508–505 Ma", "ageMin": 505.0, "ageMax": 508.0, "lieu": "Colombie-Britannique, Canada", "milieu": "Aquatique marin benthique", "regime": "Microphage, détritivore ou brouteur ; incertain", "taille": "1–3 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 5, "desc": "Lobopodien vermiforme portant des pattes souples ventrales et une double rangée d’épines dorsales rigides.", "prudence": "La reconstruction moderne est solide, mais la couleur et plusieurs détails de la tête restent incertains.", "src": [["Hallucigenia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/hallucigenia-sparsa/"], ["Royal Ontario Museum — Burgess Shale", "https://burgess-shale.rom.on.ca/"]], "pack": "Burgess — L’étrangeté cambrienne", "img": "cartes/BURG-03.webp"},
 {"id": "BURG-04", "site": "BURG", "nom": "Marrella splendens", "groupe": "Marrellomorphe, arthropode", "periode": "Cambrien moyen", "age": "≈ 508–505 Ma", "ageMin": 505.0, "ageMax": 508.0, "lieu": "Colombie-Britannique, Canada", "milieu": "Aquatique marin benthique", "regime": "Détritivore, microphage ou charognard", "taille": "1,5–2,5 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Arthropode délicat aux longues épines céphaliques recourbées, extrêmement abondant dans le Schiste de Burgess.", "prudence": "Les appendices sont bien documentés ; les tissus internes, les couleurs et le comportement exact ne le sont pas.", "src": [["Marrella — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/marrella-splendens/"], ["Wikipedia", "https://en.wikipedia.org/wiki/Marrella_splendens"]], "pack": "Burgess — L’étrangeté cambrienne", "img": "cartes/BURG-04.webp"},
 {"id": "BURG-05", "site": "BURG", "nom": "Wiwaxia corrugata", "groupe": "Wiwaxiidé, animal lophotrochozoaire énigmatique", "periode": "Cambrien moyen", "age": "≈ 508–505 Ma", "ageMin": 505.0, "ageMax": 508.0, "lieu": "Colombie-Britannique, Canada", "milieu": "Aquatique marin benthique", "regime": "Brouteur du fond, probablement sur tapis microbiens", "taille": "1–5 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 5, "desc": "Petit animal ovale recouvert de sclérites imbriqués et de longues épines dorsolatérales.", "prudence": "Le revêtement est bien connu, mais ses affinités exactes et l’aspect des tissus mous sous les sclérites restent discutés.", "src": [["Wiwaxia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/wiwaxia-corrugata/"], ["Wikipedia", "https://en.wikipedia.org/wiki/Wiwaxia_corrugata"]], "pack": "Burgess — L’étrangeté cambrienne", "img": "cartes/BURG-05.webp"},
 {"id": "BURG-06", "site": "BURG", "nom": "Pikaia gracilens", "groupe": "Chordé basal", "periode": "Cambrien moyen", "age": "≈ 508–505 Ma", "ageMin": 505.0, "ageMax": 508.0, "lieu": "Colombie-Britannique, Canada", "milieu": "Aquatique marin", "regime": "Microphage ou suspensivore opportuniste ; incertain", "taille": "3–6 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Chordé rubané à myomères visibles, important pour comprendre les premières étapes du plan corporel des vertébrés.", "prudence": "Le contour musculaire est lisible, mais les organes sensoriels, la bouche et les nageoires charnues sont peu contraints.", "src": [["Pikaia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/pikaia-gracilens/"], ["Wikipedia", "https://en.wikipedia.org/wiki/Pikaia_gracilens"]], "pack": "Burgess — L’étrangeté cambrienne", "img": "cartes/BURG-06.webp"},
 {"id": "CEP-01", "site": "CEP", "nom": "Endoceras giganteum", "groupe": "Nautiloïde endocératide", "periode": "Ordovicien moyen–supérieur", "age": "≈ 470–450 Ma", "ageMin": 450.0, "ageMax": 470.0, "lieu": "Amérique du Nord et régions baltiques", "milieu": "Aquatique marin", "regime": "Prédateur", "taille": "Coquille ≈ 3–6 m", "masse": "Non estimable ; probablement plusieurs centaines de kg pour les plus grands", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Faible à moyenne", "confN": 2, "desc": "Nautiloïde géant à immense coquille droite compartimentée.", "prudence": "La coquille est connue, mais la longueur des bras, la position de nage, la masse et presque tous les tissus mous sont très hypothétiques.", "src": [["Endoceras — Wikipedia", "https://en.wikipedia.org/wiki/Endoceras"], ["Wikipedia", "https://en.wikipedia.org/wiki/Endoceras_giganteum"]], "pack": "Céphalopodes impossibles", "img": "cartes/CEP-01.webp"},
 {"id": "CEP-02", "site": "CEP", "nom": "Nipponites mirabilis", "groupe": "Ammonite hétéromorphe", "periode": "Crétacé supérieur, Turonien–Coniacien", "age": "≈ 93–83 Ma", "ageMin": 83.0, "ageMax": 93.0, "lieu": "Japon", "milieu": "Aquatique marin", "regime": "Carnivore de petites proies et plancton", "taille": "Coquille ≈ 20–40 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Ammonite dont la coquille forme un enchevêtrement irrégulier spectaculaire, mais géométriquement organisé.", "prudence": "La coquille est certaine ; la tête, les bras, les yeux et la posture en nage sont reconstruits à partir d’autres céphalopodes.", "src": [["Nipponites — Wikipedia", "https://en.wikipedia.org/wiki/Nipponites"], ["Britannica — Ammonoid", "https://www.britannica.com/animal/ammonoid"]], "pack": "Céphalopodes impossibles", "img": "cartes/CEP-02.webp"},
 {"id": "CEP-03", "site": "CEP", "nom": "Diplomoceras maximum", "groupe": "Ammonite hétéromorphe", "periode": "Crétacé supérieur, Maastrichtien", "age": "≈ 72–66 Ma", "ageMin": 66.0, "ageMax": 72.0, "lieu": "Antarctique", "milieu": "Aquatique marin", "regime": "Carnivore ou planctonivore", "taille": "Coquille déroulée ≈ 1,5–2 m", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Ammonite géante à coquille en forme de trombone allongé, parmi les dernières ammonites du Crétacé.", "prudence": "La coquille est excellente, mais la flottabilité, l’orientation et les tissus mous restent très spéculatifs.", "src": [["Diplomoceras — Wikipedia", "https://en.wikipedia.org/wiki/Diplomoceras"], ["Britannica — Ammonoid", "https://www.britannica.com/animal/ammonoid"]], "pack": "Céphalopodes impossibles", "img": "cartes/CEP-03.webp"},
 {"id": "CEP-04", "site": "CEP", "nom": "Belemnotheutis antiquus", "groupe": "Bélemnoïde", "periode": "Jurassique moyen, Callovien", "age": "≈ 166–160 Ma", "ageMin": 160.0, "ageMax": 166.0, "lieu": "Angleterre et Europe", "milieu": "Aquatique marin", "regime": "Carnivore", "taille": "40–60 cm", "masse": "≈ 1–3 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Céphalopode proche des bélemnites, ressemblant à un calmar et connu avec bras, crochets et poche à encre.", "prudence": "Les tissus mous sont exceptionnellement préservés, mais les couleurs et la transparence du corps restent inconnues.", "src": [["Belemnotheutis — Wikipedia", "https://en.wikipedia.org/wiki/Belemnotheutis"], ["Britannica — Cephalopod", "https://www.britannica.com/animal/cephalopod"]], "pack": "Céphalopodes impossibles", "img": "cartes/CEP-04.webp"},
 {"id": "CEP-05", "site": "CEP", "nom": "Vampyronassa rhodanica", "groupe": "Vampyromorphe", "periode": "Jurassique moyen, Callovien", "age": "≈ 166–160 Ma", "ageMin": 160.0, "ageMax": 166.0, "lieu": "La Voulte-sur-Rhône, France", "milieu": "Aquatique marin", "regime": "Carnivore actif", "taille": "20–40 cm", "masse": "Probablement < 1 kg", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Vampyromorphe jurassique doté de bras robustes et d’une anatomie suggérant un prédateur plus actif que le vampire des abysses actuel.", "prudence": "La morphologie est bien conservée ; la membrane entre les bras, les photophores et le comportement restent partiellement interprétés.", "src": [["Vampyronassa — Scientific Reports", "https://www.nature.com/articles/s41598-022-12269-3"], ["Britannica — Cephalopod", "https://www.britannica.com/animal/cephalopod"]], "pack": "Céphalopodes impossibles", "img": "cartes/CEP-05.webp"},
 {"id": "CEP-06", "site": "CEP", "nom": "Keuppia levante", "groupe": "Octopode", "periode": "Crétacé supérieur, Cénomanien", "age": "≈ 100–93 Ma", "ageMin": 93.0, "ageMax": 100.0, "lieu": "Liban", "milieu": "Aquatique marin", "regime": "Carnivore", "taille": "20–40 cm", "masse": "Probablement < 1 kg", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Véritable poulpe fossile exceptionnellement préservé, montrant huit bras et un corps mou sans coquille externe.", "prudence": "Le contour est remarquable, mais la couleur, la texture, les ventouses et la physiologie restent inconnues.", "src": [["Keuppia — Wikipedia", "https://en.wikipedia.org/wiki/Keuppia"], ["Wikipedia", "https://en.wikipedia.org/wiki/Keuppia_levante"]], "pack": "Céphalopodes impossibles", "img": "cartes/CEP-06.webp"},
 {"id": "CHO-01", "site": "CHO", "nom": "Doliodus problematicus", "groupe": "Chondrichthyen basal", "periode": "Dévonien inférieur", "age": "≈ 410–397 Ma", "ageMin": 397.0, "ageMax": 410.0, "lieu": "Nouveau-Brunswick, Canada", "milieu": "Aquatique marin", "regime": "Prédateur de petites proies", "taille": "1–1,5 m", "masse": "≈ 10–30 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Un des plus anciens poissons cartilagineux articulés, combinant une silhouette de requin et plusieurs épines paires.", "prudence": "Le squelette est incomplet ; la forme des nageoires, la peau et les proportions finales restent en partie inférées.", "src": [["Doliodus — Wikipedia", "https://en.wikipedia.org/wiki/Doliodus"], ["Wikipedia", "https://en.wikipedia.org/wiki/Doliodus_problematicus"]], "pack": "Les expériences des chondrichthyens", "img": "cartes/CHO-01.webp"},
 {"id": "CHO-02", "site": "CHO", "nom": "Stethacanthus altonensis", "groupe": "Symmoriiforme, chondrichthyen", "periode": "Carbonifère inférieur", "age": "≈ 350–330 Ma", "ageMin": 330.0, "ageMax": 350.0, "lieu": "Amérique du Nord", "milieu": "Aquatique marin", "regime": "Prédateur de petites proies", "taille": "0,7–1 m", "masse": "≈ 5–10 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Petit chondrichthyen dont les mâles portaient une spectaculaire structure dorsale en forme d’enclume couverte de denticules.", "prudence": "La structure est sexuellement dimorphe et ne doit pas être donnée aux femelles ; les couleurs et sa fonction exacte restent inconnues.", "src": [["Stethacanthus — Wikipedia", "https://en.wikipedia.org/wiki/Stethacanthus"], ["Wikipedia", "https://en.wikipedia.org/wiki/Stethacanthus_altonensis"]], "pack": "Les expériences des chondrichthyens", "img": "cartes/CHO-02.webp"},
 {"id": "CHO-03", "site": "CHO", "nom": "Iniopteryx rushlaui", "groupe": "Holocephale inioptérygien", "periode": "Carbonifère supérieur", "age": "≈ 318–307 Ma", "ageMin": 307.0, "ageMax": 318.0, "lieu": "Kansas et Oklahoma, États-Unis", "milieu": "Aquatique marin", "regime": "Prédateur ou durophage de petites proies", "taille": "30–50 cm", "masse": "≈ 1–3 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Petit holocephale aux grands yeux et aux nageoires pectorales haut placées donnant une silhouette presque ailée.", "prudence": "Des spécimens articulés contraignent le squelette, mais les membranes des nageoires et l’aspect de la tête restent partiellement inférés.", "src": [["Iniopteryx — Wikipedia", "https://en.wikipedia.org/wiki/Iniopteryx"], ["Wikipedia", "https://en.wikipedia.org/wiki/Iniopteryx_rushlaui"]], "pack": "Les expériences des chondrichthyens", "img": "cartes/CHO-03.webp"},
 {"id": "CHO-04", "site": "CHO", "nom": "Belantsea montana", "groupe": "Petalodonte", "periode": "Carbonifère inférieur", "age": "≈ 325–318 Ma", "ageMin": 318.0, "ageMax": 325.0, "lieu": "Montana, États-Unis", "milieu": "Aquatique marin", "regime": "Durophage, broyeur de coquillages", "taille": "50–70 cm", "masse": "≈ 3–8 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Poisson cartilagineux au corps très haut et comprimé latéralement, muni de grandes dents triangulaires broyeuses.", "prudence": "La forme générale est exceptionnelle, mais les tissus mous et la propulsion exacte de cette silhouette en feuille restent discutés.", "src": [["Belantsea — Wikipedia", "https://en.wikipedia.org/wiki/Belantsea"], ["Wikipedia", "https://en.wikipedia.org/wiki/Belantsea_montana"]], "pack": "Les expériences des chondrichthyens", "img": "cartes/CHO-04.webp"},
 {"id": "CHO-05", "site": "CHO", "nom": "Helicoprion davisii", "groupe": "Eugénéodonte", "periode": "Permien inférieur", "age": "≈ 290–272 Ma", "ageMin": 272.0, "ageMax": 290.0, "lieu": "Idaho et Nevada, États-Unis, et régions boréales", "milieu": "Aquatique marin", "regime": "Prédateur de céphalopodes et proies molles", "taille": "5–8 m", "masse": "≈ 1–3 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Grand poisson cartilagineux à spirale dentaire logée dans la mandibule inférieure.", "prudence": "La mâchoire est désormais bien comprise, mais le corps entier, la nageoire caudale et la masse sont largement extrapolés.", "src": [["Australian Museum — Helicoprion", "https://australian.museum/learn/animals/fishes/helicoprion/"], ["Helicoprion — Wikipedia", "https://en.wikipedia.org/wiki/Helicoprion"]], "pack": "Les expériences des chondrichthyens", "img": "cartes/CHO-05.webp"},
 {"id": "CHO-06", "site": "CHO", "nom": "Edestus heinrichi", "groupe": "Eugénéodonte", "periode": "Carbonifère supérieur", "age": "≈ 313–307 Ma", "ageMin": 307.0, "ageMax": 313.0, "lieu": "Amérique du Nord", "milieu": "Aquatique marin", "regime": "Grand prédateur trancheur", "taille": "5–7 m", "masse": "≈ 1–2 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Faible à moyenne", "confN": 2, "desc": "Prédateur portant une lame médiane de dents dans chacune des deux mâchoires, formant un appareil de coupe unique.", "prudence": "Les mâchoires sont bien connues, mais presque tout le corps est reconstruit par comparaison ; garder une silhouette conservatrice.", "src": [["Edestus — Scientific Reports", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6726245/"], ["Wikipedia", "https://en.wikipedia.org/wiki/Edestus_heinrichi"]], "pack": "Les expériences des chondrichthyens", "img": "cartes/CHO-06.webp"},
 {"id": "HUN-01", "site": "HUN", "nom": "Palaeoisopus problematicus", "groupe": "Pycnogonide, araignée de mer", "periode": "Dévonien inférieur", "age": "≈ 408–400 Ma", "ageMin": 400.0, "ageMax": 408.0, "lieu": "Rhénanie-Palatinat, Allemagne", "milieu": "Aquatique marin", "regime": "Prédateur ou charognard", "taille": "20–40 cm d’envergure", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Grande araignée de mer dévonienne aux pattes robustes et nageuses, bien plus massive que la plupart des formes actuelles.", "prudence": "Une révision récente clarifie la tête ; les volumes musculaires et le mouvement précis des pattes restent incertains.", "src": [["Revision of Palaeoisopus — Royal Society Open Science", "https://royalsocietypublishing.org/doi/10.1098/rsos.240749"], ["Palaeoisopus — Wikipedia", "https://en.wikipedia.org/wiki/Palaeoisopus"]], "pack": "Hunsrück — La mer de pyrite", "img": "cartes/HUN-01.webp"},
 {"id": "HUN-02", "site": "HUN", "nom": "Mimetaster hexagonalis", "groupe": "Marrellomorphe", "periode": "Dévonien inférieur", "age": "≈ 408–400 Ma", "ageMin": 400.0, "ageMax": 408.0, "lieu": "Rhénanie-Palatinat, Allemagne", "milieu": "Aquatique marin benthique", "regime": "Suspensivore ou microphage", "taille": "10–30 cm avec les épines", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Arthropode étoilé à longues épines céphaliques et appendices délicats, magnifiquement conservé dans les schistes.", "prudence": "Le squelette externe est précis ; la fonction des épines et le régime alimentaire sont moins assurés.", "src": [["Mimetaster — Bundenbach Fossil Gallery", "https://bundenbachfossil.com/arthropods.html"], ["Wikipedia", "https://en.wikipedia.org/wiki/Mimetaster_hexagonalis"]], "pack": "Hunsrück — La mer de pyrite", "img": "cartes/HUN-02.webp"},
 {"id": "HUN-03", "site": "HUN", "nom": "Cheloniellon calmani", "groupe": "Cheloniellide, arthropode", "periode": "Dévonien inférieur", "age": "≈ 408–400 Ma", "ageMin": 400.0, "ageMax": 408.0, "lieu": "Rhénanie-Palatinat, Allemagne", "milieu": "Aquatique marin benthique", "regime": "Charognard, détritivore ou petit prédateur", "taille": "20–30 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Arthropode ovale et aplati, couvert de plaques segmentées sous lesquelles dépassaient de nombreuses pattes.", "prudence": "Il ne faut pas en faire une limule ou une tortue ; les appendices ventraux et les tissus mous sont partiellement reconstruits.", "src": [["Cheloniellon — Wikipedia", "https://en.wikipedia.org/wiki/Cheloniellon"], ["Wikipedia", "https://en.wikipedia.org/wiki/Cheloniellon_calmani"]], "pack": "Hunsrück — La mer de pyrite", "img": "cartes/HUN-03.webp"},
 {"id": "HUN-04", "site": "HUN", "nom": "Schinderhannes bartelsi", "groupe": "Dinocaridide tardif, arthropode souche", "periode": "Dévonien inférieur", "age": "≈ 408–400 Ma", "ageMin": 400.0, "ageMax": 408.0, "lieu": "Rhénanie-Palatinat, Allemagne", "milieu": "Aquatique marin", "regime": "Petit prédateur nageur", "taille": "≈ 10 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Faible à moyenne", "confN": 2, "desc": "Petit prédateur aux grands yeux, bouche radiale, appendices frontaux épineux et palettes céphaliques.", "prudence": "Connu d’un seul spécimen : la structure générale est publiée, mais les volumes, les couleurs et plusieurs appendices sont très incertains.", "src": [["Schinderhannes — PubMed", "https://pubmed.ncbi.nlm.nih.gov/19197061/"], ["Wikipedia", "https://en.wikipedia.org/wiki/Schinderhannes_bartelsi"]], "pack": "Hunsrück — La mer de pyrite", "img": "cartes/HUN-04.webp"},
 {"id": "HUN-05", "site": "HUN", "nom": "Gemuendina stuertzi", "groupe": "Placoderme rhénanide", "periode": "Dévonien inférieur", "age": "≈ 408–400 Ma", "ageMin": 400.0, "ageMax": 408.0, "lieu": "Rhénanie-Palatinat, Allemagne", "milieu": "Aquatique marin benthique", "regime": "Prédateur benthique ou durophage", "taille": "30–70 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Poisson cuirassé aplati ayant convergé vers une silhouette de raie, avec de grandes nageoires pectorales.", "prudence": "La forme générale est solide ; les nageoires, la bouche, la peau et la propulsion ne doivent pas copier une raie moderne.", "src": [["Gemuendina — Wikipedia", "https://en.wikipedia.org/wiki/Gemuendina"], ["Drepanaspis — Wikipedia", "https://en.wikipedia.org/wiki/Drepanaspis"]], "pack": "Hunsrück — La mer de pyrite", "img": "cartes/HUN-05.webp"},
 {"id": "HUN-06", "site": "HUN", "nom": "Drepanaspis gemuendenensis", "groupe": "Hétérostracé sans mâchoires", "periode": "Dévonien inférieur", "age": "≈ 408–400 Ma", "ageMin": 400.0, "ageMax": 408.0, "lieu": "Rhénanie-Palatinat, Allemagne", "milieu": "Aquatique marin benthique", "regime": "Déposivore ou suspensivore", "taille": "40–80 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Vertébré sans mâchoires extrêmement aplati, protégé par un large bouclier dermique.", "prudence": "L’armure est bien connue ; les yeux, la bouche charnue, les nageoires et le comportement alimentaire restent moins contraints.", "src": [["Drepanaspis — Wikipedia", "https://en.wikipedia.org/wiki/Drepanaspis"], ["The Hunsrück Slate Konservat-Lagerstätte", "https://ore.exeter.ac.uk/ndownloader/files/56832407"]], "pack": "Hunsrück — La mer de pyrite", "img": "cartes/HUN-06.webp"},
 {"id": "DEV-01", "site": "DEV", "nom": "Eusthenopteron foordi", "groupe": "Tétrapodomorphe à nageoires charnues", "periode": "Dévonien supérieur, Frasnien", "age": "≈ 385–380 Ma", "ageMin": 380.0, "ageMax": 385.0, "lieu": "Québec, Canada", "milieu": "Aquatique dulçaquicole ou estuarien", "regime": "Carnivore piscivore", "taille": "1,2–1,8 m", "masse": "≈ 10–30 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Poisson à nageoires charnues dont les os internes préfigurent ceux des membres, mais restant entièrement aquatique.", "prudence": "Le squelette est exceptionnellement étudié ; il ne faut pas lui donner de doigts, de cou mobile ou une capacité de marche.", "src": [["Eusthenopteron — Britannica", "https://www.britannica.com/animal/Eusthenopteron"], ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]], "pack": "Dévonien — Inventer les jambes", "img": "cartes/DEV-01.webp"},
 {"id": "DEV-02", "site": "DEV", "nom": "Panderichthys rhombolepis", "groupe": "Tétrapodomorphe elpistostégalien", "periode": "Dévonien supérieur, Frasnien", "age": "≈ 383–375 Ma", "ageMin": 375.0, "ageMax": 383.0, "lieu": "Lettonie", "milieu": "Aquatique peu profond", "regime": "Carnivore piscivore", "taille": "1–1,3 m", "masse": "≈ 10–20 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Poisson aplati à yeux dorsaux, adapté aux eaux peu profondes et doté de nageoires paires plus robustes.", "prudence": "Il demeure un poisson sans vrais doigts ; les tissus mous et l’utilisation des nageoires sur le fond restent inférés.", "src": [["Panderichthys — Wikipedia", "https://en.wikipedia.org/wiki/Panderichthys"], ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]], "pack": "Dévonien — Inventer les jambes", "img": "cartes/DEV-02.webp"},
 {"id": "DEV-03", "site": "DEV", "nom": "Tiktaalik roseae", "groupe": "Tétrapodomorphe elpistostégalien", "periode": "Dévonien supérieur, Frasnien", "age": "≈ 377–373 Ma", "ageMin": 373.0, "ageMax": 377.0, "lieu": "Nunavut, Canada", "milieu": "Aquatique peu profond, amphibie fonctionnel limité", "regime": "Carnivore piscivore", "taille": "2–3 m", "masse": "≈ 20–70 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Poisson à écailles possédant un cou mobile, des côtes robustes et des nageoires capables de soutenir l’avant du corps.", "prudence": "Il ne possédait pas de doigts externes et ne doit pas être représenté comme un animal terrestre accompli.", "src": [["University of Chicago — Tiktaalik", "https://tiktaalik.uchicago.edu/"], ["Tetrapod trackways — Nature", "https://www.nature.com/articles/nature08623"]], "pack": "Dévonien — Inventer les jambes", "img": "cartes/DEV-03.webp"},
 {"id": "DEV-04", "site": "DEV", "nom": "Elpistostege watsoni", "groupe": "Tétrapodomorphe elpistostégalien", "periode": "Dévonien supérieur, Frasnien", "age": "≈ 383–375 Ma", "ageMin": 375.0, "ageMax": 383.0, "lieu": "Québec, Canada", "milieu": "Aquatique peu profond", "regime": "Carnivore piscivore", "taille": "≈ 1,5 m", "masse": "≈ 15–30 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Forme très proche des tétrapodes, conservant des rayons de nageoire mais possédant des os homologues à des doigts.", "prudence": "Les doigts étaient inclus dans la nageoire ; éviter toute main externe ou marche terrestre.", "src": [["Elpistostege — Nature", "https://www.nature.com/articles/s41586-020-2100-8"], ["Wikipedia", "https://en.wikipedia.org/wiki/Elpistostege_watsoni"]], "pack": "Dévonien — Inventer les jambes", "img": "cartes/DEV-04.webp"},
 {"id": "DEV-05", "site": "DEV", "nom": "Acanthostega gunnari", "groupe": "Tétrapode basal", "periode": "Dévonien supérieur, Famennien", "age": "≈ 367–360 Ma", "ageMin": 360.0, "ageMax": 367.0, "lieu": "Groenland oriental", "milieu": "Aquatique dulçaquicole", "regime": "Carnivore aquatique", "taille": "50–70 cm", "masse": "≈ 3–6 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Premier tétrapode à huit doigts, mais encore fortement aquatique et mal adapté au soutien du corps sur terre.", "prudence": "Les membres doivent apparaître comme des palettes à doigts ; une posture de salamandre terrestre serait trompeuse.", "src": [["Acanthostega — Britannica", "https://www.britannica.com/animal/Acanthostega"], ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]], "pack": "Dévonien — Inventer les jambes", "img": "cartes/DEV-05.webp"},
 {"id": "DEV-06", "site": "DEV", "nom": "Ichthyostega stensioei", "groupe": "Tétrapode basal", "periode": "Dévonien supérieur, Famennien", "age": "≈ 367–360 Ma", "ageMin": 360.0, "ageMax": 367.0, "lieu": "Groenland oriental", "milieu": "Amphibie, aquatique dominant", "regime": "Carnivore", "taille": "1,2–1,5 m", "masse": "≈ 20–40 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Tétrapode robuste capable de mouvements hors de l’eau, mais doté d’une colonne et de membres fonctionnant différemment de ceux des amphibiens modernes.", "prudence": "Sa locomotion terrestre est atypique ; éviter une marche alternée fluide de salamandre.", "src": [["Ichthyostega — Britannica", "https://www.britannica.com/animal/Ichthyostega"], ["Ichthyostega locomotion — Nature", "https://www.nature.com/articles/nature11523"]], "pack": "Dévonien — Inventer les jambes", "img": "cartes/DEV-06.webp"},
 {"id": "CAR-01", "site": "CAR", "nom": "Arthropleura armata", "groupe": "Myriapode arthropleuridé", "periode": "Carbonifère supérieur", "age": "≈ 315–299 Ma", "ageMin": 299.0, "ageMax": 315.0, "lieu": "Europe et Amérique du Nord", "milieu": "Terrestre humide", "regime": "Herbivore et détritivore probable", "taille": "1,8–2,6 m", "masse": "≈ 30–50 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Plus grand arthropode terrestre connu, myriapode cuirassé des forêts humides carbonifères.", "prudence": "La tête n’a été clarifiée que récemment ; le nombre exact de segments, la masse et les pièces buccales visibles doivent rester prudents.", "src": [["Natural History Museum — Arthropleura", "https://www.nhm.ac.uk/discover/news/2024/october/largest-ever-millipede-head-revealed.html"], ["Hibbertopterus — Wikipedia", "https://en.wikipedia.org/wiki/Hibbertopterus"]], "pack": "Carbonifère — L’air des géants", "img": "cartes/CAR-01.webp"},
 {"id": "CAR-02", "site": "CAR", "nom": "Meganeura monyi", "groupe": "Méganeuridé, griffinfly", "periode": "Carbonifère supérieur", "age": "≈ 307–300 Ma", "ageMin": 300.0, "ageMax": 307.0, "lieu": "Commentry, France", "milieu": "Aérien ; larves probablement aquatiques", "regime": "Prédateur d’insectes", "taille": "Envergure ≈ 65–70 cm", "masse": "≈ 0,1–0,2 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Grand insecte volant proche des libellules, prédateur des marais carbonifères.", "prudence": "Les ailes fossiles sont solides, mais la forme complète du corps, les couleurs et les yeux sont extrapolés à partir de parents.", "src": [["Meganeura — Britannica", "https://www.britannica.com/animal/Meganeura"], ["Wikipedia", "https://en.wikipedia.org/wiki/Meganeura_monyi"]], "pack": "Carbonifère — L’air des géants", "img": "cartes/CAR-02.webp"},
 {"id": "CAR-03", "site": "CAR", "nom": "Mazothairos enormis", "groupe": "Paléodictyoptère", "periode": "Carbonifère supérieur", "age": "≈ 310–307 Ma", "ageMin": 307.0, "ageMax": 310.0, "lieu": "Illinois, États-Unis", "milieu": "Aérien", "regime": "Herbivore suceur de fluides végétaux", "taille": "Envergure ≈ 50–60 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Grand insecte paléodictyoptère à rostre piqueur et probablement trois paires de lobes ou d’ailes thoraciques.", "prudence": "Connu surtout par des ailes et éléments fragmentaires : le corps, les motifs et la pose doivent rester conservateurs.", "src": [["Mazothairos — Wikipedia", "https://en.wikipedia.org/wiki/Mazothairos"], ["Palaeodictyoptera — Wikipedia", "https://en.wikipedia.org/wiki/Palaeodictyoptera"]], "pack": "Carbonifère — L’air des géants", "img": "cartes/CAR-03.webp"},
 {"id": "CAR-04", "site": "CAR", "nom": "Pulmonoscorpius kirktonensis", "groupe": "Scorpion", "periode": "Carbonifère inférieur, Viséen", "age": "≈ 340–330 Ma", "ageMin": 330.0, "ageMax": 340.0, "lieu": "East Kirkton, Écosse", "milieu": "Terrestre ou semi-terrestre humide", "regime": "Carnivore", "taille": "≈ 70 cm", "masse": "≈ 2–5 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Grand scorpion du Carbonifère inférieur, adapté aux milieux humides proches des eaux douces.", "prudence": "Les proportions sont fondées sur des fragments ; la taille maximale, les yeux, la couleur et le mode de vie terrestre restent incertains.", "src": [["Pulmonoscorpius — Wikipedia", "https://en.wikipedia.org/wiki/Pulmonoscorpius"], ["Wikipedia", "https://en.wikipedia.org/wiki/Pulmonoscorpius_kirktonensis"]], "pack": "Carbonifère — L’air des géants", "img": "cartes/CAR-04.webp"},
 {"id": "CAR-05", "site": "CAR", "nom": "Hibbertopterus scouleri", "groupe": "Euryptéride hibbertoptéride", "periode": "Carbonifère", "age": "≈ 340–300 Ma", "ageMin": 300.0, "ageMax": 340.0, "lieu": "Écosse et autres régions d’Europe", "milieu": "Aquatique dulçaquicole ou saumâtre", "regime": "Balayeur du fond, collecteur de petites proies et particules", "taille": "1,5–2 m", "masse": "≈ 40–100 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Euryptéride large et lourd qui ratissait le fond avec ses appendices spécialisés.", "prudence": "Ce n’était pas un scorpion terrestre géant ; la masse et les tissus mous sont des estimations.", "src": [["Hibbertopterus — Wikipedia", "https://en.wikipedia.org/wiki/Hibbertopterus"], ["Wikipedia", "https://en.wikipedia.org/wiki/Hibbertopterus_scouleri"]], "pack": "Carbonifère — L’air des géants", "img": "cartes/CAR-05.webp"},
 {"id": "CAR-06", "site": "CAR", "nom": "Euphoberia armigera", "groupe": "Myriapode euphobériidé", "periode": "Carbonifère supérieur", "age": "≈ 315–307 Ma", "ageMin": 307.0, "ageMax": 315.0, "lieu": "Illinois, États-Unis", "milieu": "Terrestre humide", "regime": "Détritivore ou herbivore", "taille": "20–30 cm", "masse": "≈ 0,1–0,3 kg", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Myriapode de taille modeste mais spectaculaire, portant de longues épines latérales défensives.", "prudence": "L’exosquelette est connu ; la couleur, les pièces buccales et le comportement restent inférés.", "src": [["Euphoberia — Wikipedia", "https://en.wikipedia.org/wiki/Euphoberia"], ["Natural History Museum — Arthropleura", "https://www.nhm.ac.uk/discover/news/2024/october/largest-ever-millipede-head-revealed.html"]], "pack": "Carbonifère — L’air des géants", "img": "cartes/CAR-06.webp"},
 {"id": "MAZ-01", "site": "MAZ", "nom": "Tullimonstrum gregarium", "groupe": "Bilatérien énigmatique, possiblement vertébré", "periode": "Carbonifère supérieur, Moscovien", "age": "≈ 310–307 Ma", "ageMin": 307.0, "ageMax": 310.0, "lieu": "Illinois, États-Unis", "milieu": "Aquatique marin ou saumâtre", "regime": "Prédateur ou charognard", "taille": "10–35 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "« Monstre de Tully » au corps fuselé, aux yeux sur une barre transversale et au proboscis terminé par une pince dentée.", "prudence": "La forme fossile est claire, mais sa classification, ses nageoires et certains organes internes restent controversés.", "src": [["Tullimonstrum — Field Museum", "https://www.fieldmuseum.org/blog/tully-monster"], ["Wikipedia", "https://en.wikipedia.org/wiki/Tullimonstrum_gregarium"]], "pack": "Mazon Creek — Le delta des aberrations", "img": "cartes/MAZ-01.webp"},
 {"id": "MAZ-02", "site": "MAZ", "nom": "Essexella asherae", "groupe": "Cnidaire, anémone de mer", "periode": "Carbonifère supérieur, Moscovien", "age": "≈ 310–307 Ma", "ageMin": 307.0, "ageMax": 310.0, "lieu": "Illinois, États-Unis", "milieu": "Aquatique marin benthique", "regime": "Carnivore suspensivore", "taille": "3–15 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Anémone abondante de l’assemblage d’Essex, longtemps prise à tort pour une méduse.", "prudence": "La réinterprétation en anémone est récente ; la position du pied, des tentacules et le mode d’enfouissement doivent être illustrés prudemment.", "src": [["Essexella reinterpreted as a sea anemone — Papers in Palaeontology", "https://onlinelibrary.wiley.com/doi/10.1002/spp2.1479"], ["Mazon Creek fossil beds", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]], "pack": "Mazon Creek — Le delta des aberrations", "img": "cartes/MAZ-02.webp"},
 {"id": "MAZ-03", "site": "MAZ", "nom": "Kallidecthes richardsoni", "groupe": "Crustacé eumalacostracé basal", "periode": "Carbonifère supérieur, Moscovien", "age": "≈ 310–307 Ma", "ageMin": 307.0, "ageMax": 310.0, "lieu": "Illinois, États-Unis", "milieu": "Aquatique marin ou saumâtre", "regime": "Prédateur, charognard ou omnivore", "taille": "5–15 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Crustacé comprimé latéralement, apparenté de loin aux stomatopodes mais distinct d’une crevette moderne.", "prudence": "Le corps articulé est bien connu ; les couleurs, les yeux et la spécialisation des appendices restent en partie inférés.", "src": [["Kallidecthes — Wikipedia", "https://en.wikipedia.org/wiki/Kallidecthes"], ["Mazon Creek fossil beds — Wikipedia", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]], "pack": "Mazon Creek — Le delta des aberrations", "img": "cartes/MAZ-03.webp"},
 {"id": "MAZ-04", "site": "MAZ", "nom": "Palaeocampa anthrax", "groupe": "Lobopodien xénusiide tardif", "periode": "Carbonifère supérieur, Moscovien", "age": "≈ 310–307 Ma", "ageMin": 307.0, "ageMax": 310.0, "lieu": "Illinois, États-Unis, et Montceau-les-Mines, France", "milieu": "Aquatique dulçaquicole ou humide", "regime": "Microphage ou détritivore ; régime incertain", "taille": "3–10 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Lobopodien cuirassé à nombreuses pattes, portant des sclérites qui auraient pu assurer une défense chimique.", "prudence": "Sa réinterprétation comme lobopodien date de 2025 ; plusieurs détails des tissus mous et de l’écologie restent nouveaux et révisables.", "src": [["Palaeocampa — Communications Biology", "https://www.nature.com/articles/s42003-025-08483-0"], ["Wikipedia", "https://en.wikipedia.org/wiki/Palaeocampa_anthrax"]], "pack": "Mazon Creek — Le delta des aberrations", "img": "cartes/MAZ-04.webp"},
 {"id": "MAZ-05", "site": "MAZ", "nom": "Joermungandr bolti", "groupe": "Recumbirostre, tétrapode allongé", "periode": "Carbonifère supérieur, Moscovien", "age": "≈ 310–307 Ma", "ageMin": 307.0, "ageMax": 310.0, "lieu": "Illinois, États-Unis", "milieu": "Terrestre fouisseur ou semi-aquatique", "regime": "Carnivore insectivore", "taille": "5–10 cm", "masse": "Quelques grammes, non mesurés", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Petit tétrapode serpentiforme à membres réduits et peau exceptionnellement préservée.", "prudence": "La peau est bien connue, mais la couleur, le comportement fouisseur et la physiologie restent inférés.", "src": [["Joermungandr — Royal Society Open Science", "https://royalsocietypublishing.org/doi/10.1098/rsos.210319"], ["Wikipedia", "https://en.wikipedia.org/wiki/Joermungandr_bolti"]], "pack": "Mazon Creek — Le delta des aberrations", "img": "cartes/MAZ-05.webp"},
 {"id": "MAZ-06", "site": "MAZ", "nom": "Euproops danae", "groupe": "Xiphosure", "periode": "Carbonifère supérieur, Moscovien", "age": "≈ 310–307 Ma", "ageMin": 307.0, "ageMax": 310.0, "lieu": "Illinois, États-Unis", "milieu": "Aquatique marin, saumâtre ou dulçaquicole côtier", "regime": "Détritivore, charognard et petit prédateur", "taille": "5–15 cm", "masse": "Non estimable", "longevite": "Inconnue ; non estimable de façon robuste à partir des fossiles disponibles", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Petit parent des limules, à carapace arrondie, épines postérieures et telson allongé.", "prudence": "Le squelette et même le système nerveux sont remarquablement documentés ; les couleurs et les tissus périphériques le sont moins.", "src": [["Euproops — Wikipedia", "https://en.wikipedia.org/wiki/Euproops"], ["Mazon Creek fossil beds — Wikipedia", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]], "pack": "Mazon Creek — Le delta des aberrations", "img": "cartes/MAZ-06.webp"},
 {"id": "KAR2-01", "site": "KAR2", "nom": "Moschops capensis", "groupe": "Thérapside dinocephale", "periode": "Permien moyen", "age": "≈ 265–260 Ma", "ageMin": 260.0, "ageMax": 265.0, "lieu": "Cap-Oriental et Karoo, Afrique du Sud", "milieu": "Terrestre", "regime": "Herbivore", "taille": "2,5–3 m", "masse": "≈ 300–500 kg", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Herbivore massif au corps en tonneau et au crâne remarquablement épaissi.", "prudence": "Le squelette est bien connu ; le rôle comportemental du crâne et le degré de couverture cutanée restent incertains.", "src": [["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"], ["Moschops — Britannica", "https://www.britannica.com/animal/Moschops"]], "pack": "Karoo revisité — Le règne des synapsides", "img": "cartes/KAR2-01.webp"},
 {"id": "KAR2-02", "site": "KAR2", "nom": "Pareiasaurus serridens", "groupe": "Parareptile pareiasaure", "periode": "Permien supérieur", "age": "≈ 259–252 Ma", "ageMin": 252.0, "ageMax": 259.0, "lieu": "Bassin du Karoo, Afrique du Sud", "milieu": "Terrestre", "regime": "Herbivore", "taille": "2,5–3 m", "masse": "≈ 600–1 000 kg", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Grand herbivore bas et robuste, doté d’un crâne court orné de bosses et d’ostéodermes cutanés.", "prudence": "La silhouette osseuse est solide ; la densité de l’armure et le volume exact des tissus mous sont estimés.", "src": [["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"], ["Pareiasaurus — Encyclopaedia Britannica", "https://www.britannica.com/animal/pareiasaur"]], "pack": "Karoo revisité — Le règne des synapsides", "img": "cartes/KAR2-02.webp"},
 {"id": "KAR2-03", "site": "KAR2", "nom": "Rubidgea atrox", "groupe": "Gorgonopsien rubidgéiné", "periode": "Permien supérieur", "age": "≈ 259–252 Ma", "ageMin": 252.0, "ageMax": 259.0, "lieu": "Afrique du Sud et peut-être Afrique orientale", "milieu": "Terrestre", "regime": "Carnivore, grand prédateur", "taille": "3–3,5 m", "masse": "≈ 200–300 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Grand gorgonopsien à crâne puissant et canines sabrées, parmi les principaux prédateurs du Karoo tardif.", "prudence": "Le crâne est bien connu, mais le pelage, les lèvres, les oreilles externes et la masse corporelle restent spéculatifs.", "src": [["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"], ["Rubidgea — Wikipedia", "https://en.wikipedia.org/wiki/Rubidgea"]], "pack": "Karoo revisité — Le règne des synapsides", "img": "cartes/KAR2-03.webp"},
 {"id": "KAR2-04", "site": "KAR2", "nom": "Diictodon feliceps", "groupe": "Dicynodonte", "periode": "Permien supérieur", "age": "≈ 259–252 Ma", "ageMin": 252.0, "ageMax": 259.0, "lieu": "Afrique du Sud et Tanzanie", "milieu": "Terrestre fouisseur", "regime": "Herbivore ou omnivore à dominante végétale", "taille": "45–60 cm", "masse": "≈ 3–6 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 5, "desc": "Petit dicynodonte fouisseur au bec corné, très fréquent dans les dépôts du Karoo.", "prudence": "Les défenses varient entre individus ; il ne faut pas les représenter systématiquement ni surdimensionnées.", "src": [["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"], ["Diictodon — Wikipedia", "https://en.wikipedia.org/wiki/Diictodon"]], "pack": "Karoo revisité — Le règne des synapsides", "img": "cartes/KAR2-04.webp"},
 {"id": "KAR2-05", "site": "KAR2", "nom": "Lystrosaurus curvatus", "groupe": "Dicynodonte lystrosauridé", "periode": "Permien terminal–Trias inférieur", "age": "≈ 253–250 Ma", "ageMin": 250.0, "ageMax": 253.0, "lieu": "Afrique du Sud et Antarctique", "milieu": "Terrestre, possiblement semi-fouisseur", "regime": "Herbivore", "taille": "0,7–1 m", "masse": "≈ 15–40 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 5, "desc": "Dicynodonte trapu à bec puissant et deux défenses, emblématique de la survie après l’extinction permienne.", "prudence": "La silhouette est bien contrainte ; l’écologie exacte, la peau et le degré de vie fouisseuse restent discutés.", "src": [["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"], ["Lystrosaurus — Britannica", "https://www.britannica.com/animal/Lystrosaurus"]], "pack": "Karoo revisité — Le règne des synapsides", "img": "cartes/KAR2-05.webp"},
 {"id": "KAR2-06", "site": "KAR2", "nom": "Thrinaxodon liorhinus", "groupe": "Cynodonte basal", "periode": "Trias inférieur", "age": "≈ 251–247 Ma", "ageMin": 247.0, "ageMax": 251.0, "lieu": "Afrique du Sud et Antarctique", "milieu": "Terrestre fouisseur", "regime": "Carnivore insectivore", "taille": "40–50 cm", "masse": "≈ 2–5 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Petit cynodonte à denture différenciée, souvent associé à des terriers et proche de la lignée mammalienne.", "prudence": "Un revêtement filamentaire est plausible mais non directement démontré pour cette espèce ; éviter une fourrure moderne trop certaine.", "src": [["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"], ["Thrinaxodon — Wikipedia", "https://en.wikipedia.org/wiki/Thrinaxodon"]], "pack": "Karoo revisité — Le règne des synapsides", "img": "cartes/KAR2-06.webp"},
 {"id": "LUO-01", "site": "LUO", "nom": "Atopodentatus unicus", "groupe": "Sauropside marin, saurosphargidé proche", "periode": "Trias moyen, Anisien", "age": "≈ 247–242 Ma", "ageMin": 242.0, "ageMax": 247.0, "lieu": "Yunnan, Chine", "milieu": "Aquatique marin", "regime": "Herbivore brouteur et filtreur du fond", "taille": "2,5–3 m", "masse": "≈ 100–200 kg", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Reptile marin à tête transversale en forme de pelle, doté d’une dentition adaptée au raclage et au filtrage des végétaux.", "prudence": "La nouvelle reconstruction du crâne est solide ; la masse, les couleurs et la mécanique fine de l’alimentation restent estimées.", "src": [["Atopodentatus — Nature", "https://www.nature.com/articles/srep20925"], ["The Luoping biota — Proceedings B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]], "pack": "Luoping — La mer après l’apocalypse", "img": "cartes/LUO-01.webp"},
 {"id": "LUO-02", "site": "LUO", "nom": "Dinocephalosaurus orientalis", "groupe": "Archosauromorphe tanystrophéidé", "periode": "Trias moyen, Anisien", "age": "≈ 247–242 Ma", "ageMin": 242.0, "ageMax": 247.0, "lieu": "Yunnan et Guizhou, Chine", "milieu": "Aquatique marin", "regime": "Piscivore et carnivore", "taille": "5–6 m", "masse": "≈ 100–200 kg", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Reptile marin au cou extraordinairement allongé, composé de nombreuses vertèbres, et aux membres relativement courts.", "prudence": "Le squelette et même la viviparité sont bien documentés ; la posture de chasse et les tissus mous restent interprétés.", "src": [["Dinocephalosaurus — Nature Communications", "https://www.nature.com/articles/ncomms14445"], ["Wikipedia", "https://en.wikipedia.org/wiki/Dinocephalosaurus_orientalis"]], "pack": "Luoping — La mer après l’apocalypse", "img": "cartes/LUO-02.webp"},
 {"id": "LUO-03", "site": "LUO", "nom": "Sinosaurosphargis yunguiensis", "groupe": "Saurosphargidé cuirassé", "periode": "Trias moyen, Anisien", "age": "≈ 247–242 Ma", "ageMin": 242.0, "ageMax": 247.0, "lieu": "Yunnan et Guizhou, Chine", "milieu": "Aquatique marin côtier", "regime": "Durophage ou omnivore benthique ; incertain", "taille": "1,5–2 m", "masse": "≈ 40–80 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Reptile marin très large et aplati, portant des côtes élargies et une mosaïque d’ostéodermes.", "prudence": "Il ne possédait pas une véritable carapace de tortue ; la tête, les tissus mous et le régime précis sont moins bien contraints.", "src": [["Sinosaurosphargis — Wikipedia", "https://en.wikipedia.org/wiki/Sinosaurosphargis"], ["Luoping biota overview", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]], "pack": "Luoping — La mer après l’apocalypse", "img": "cartes/LUO-03.webp"},
 {"id": "LUO-04", "site": "LUO", "nom": "Nothosaurus zhangi", "groupe": "Nothosaure", "periode": "Trias moyen, Anisien", "age": "≈ 247–242 Ma", "ageMin": 242.0, "ageMax": 247.0, "lieu": "Yunnan, Chine", "milieu": "Aquatique marin, probablement capable de repos côtier", "regime": "Carnivore piscivore", "taille": "5–7 m", "masse": "≈ 500–1 000 kg", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Très grand nothosaure au corps allongé et au museau étroit garni de dents antérieures saillantes.", "prudence": "Le crâne et la taille sont bien contraints, mais la silhouette complète et les masses musculaires reposent sur des parents proches.", "src": [["A gigantic nothosaur — Scientific Reports", "https://www.nature.com/articles/srep07142"], ["The Luoping biota — Proceedings B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]], "pack": "Luoping — La mer après l’apocalypse", "img": "cartes/LUO-04.webp"},
 {"id": "LUO-05", "site": "LUO", "nom": "Phalarodon atavus", "groupe": "Ichthyosaure mixosauridé", "periode": "Trias moyen, Anisien", "age": "≈ 247–242 Ma", "ageMin": 242.0, "ageMax": 247.0, "lieu": "Yunnan, Chine et autres régions téthysiennes", "milieu": "Aquatique marin", "regime": "Carnivore, probablement durophage ou piscivore", "taille": "1,5–2 m", "masse": "≈ 30–60 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Ichthyosaure basal fuselé, moins spécialisé et moins « dauphiniforme » que les formes jurassiques tardives.", "prudence": "Le squelette est bien connu ; la forme exacte de la nageoire caudale et la coloration restent inférées.", "src": [["Phalarodon — Wikipedia", "https://en.wikipedia.org/wiki/Phalarodon"], ["Wikipedia", "https://en.wikipedia.org/wiki/Phalarodon_atavus"]], "pack": "Luoping — La mer après l’apocalypse", "img": "cartes/LUO-05.webp"},
 {"id": "LUO-06", "site": "LUO", "nom": "Diandongosaurus acutidentatus", "groupe": "Pachypleurosaure", "periode": "Trias moyen, Anisien", "age": "≈ 247–242 Ma", "ageMin": 242.0, "ageMax": 247.0, "lieu": "Yunnan, Chine", "milieu": "Aquatique marin côtier", "regime": "Petit carnivore piscivore", "taille": "50–70 cm", "masse": "≈ 1–3 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Petit reptile aquatique gracile à longue queue, cou modérément allongé et membres encore lézardiformes.", "prudence": "Le squelette presque complet contraint fortement la forme ; les tissus mous et la propulsion exacte restent incertains.", "src": [["Diandongosaurus — Scientific Reports", "https://www.nature.com/articles/s41598-021-01309-z"], ["Wikipedia", "https://en.wikipedia.org/wiki/Diandongosaurus_acutidentatus"]], "pack": "Luoping — La mer après l’apocalypse", "img": "cartes/LUO-06.webp"},
 {"id": "JUR-01", "site": "JUR", "nom": "Spicomellus afer", "groupe": "Ankylosaure basal", "periode": "Jurassique moyen, Bathonien–Callovien", "age": "≈ 168–164 Ma", "ageMin": 164.0, "ageMax": 168.0, "lieu": "Moyen Atlas, Maroc", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 4 m", "masse": "Non estimable robustement ; probablement de l’ordre de 1–2 t", "longevite": "Plusieurs décennies possibles ; aucune estimation histologique spécifique", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Ankylosaure très ancien doté d’une armure extraordinairement élaborée : collier cervical à longues pointes, ostéodermes associés aux côtes et premiers éléments d’une arme caudale.", "prudence": "Le nouveau matériel est beaucoup plus complet qu’en 2021, mais le squelette reste incomplet ; la disposition exacte de certaines pointes, leur enveloppe kératinée, la masse et la coloration demeurent incertaines.", "src": [["Bizarre dermal armour suggests the first African ankylosaur — Nature Ecology & Evolution", "https://www.nature.com/articles/s41559-021-01553-6"], ["Extreme armour in the world's oldest ankylosaur — Nature", "https://www.nature.com/articles/s41586-025-09453-6"]], "pack": "Jurassique revisité — Découvertes et réinterprétations", "img": "cartes/JUR-01.webp"},
 {"id": "JUR-02", "site": "JUR", "nom": "Alpkarakush kyrgyzicus", "groupe": "Théropode metriacanthosauridé", "periode": "Jurassique moyen, Callovien", "age": "≈ 165 Ma", "ageMin": 165.0, "ageMax": 165.0, "lieu": "Région de Jalal-Abad, Kirghizistan", "milieu": "Terrestre", "regime": "Carnivore", "taille": "≈ 7–8 m", "masse": "≈ 1–1,5 t ; estimation indirecte", "longevite": "Plusieurs décennies possibles ; aucune estimation histologique spécifique", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Grand prédateur d’Asie centrale caractérisé par une arcade postorbitaire très développée formant un « sourcil » osseux spectaculaire au-dessus de l’œil.", "prudence": "L’espèce repose sur des squelettes partiels d’au moins deux individus ; le crâne complet, les tissus mous, le revêtement cutané et les proportions fines restent extrapolés.", "src": [["A new theropod dinosaur from the Callovian Balabansai Formation — Zoological Journal of the Linnean Society", "https://academic.oup.com/zoolinnean/article/201/4/zlae090/7736730"], ["A new predatory dinosaur with a distinctive eyebrow — SNSB", "https://snsb.de/en/raubdinosaurier-mit-markanter-augenbraue/"]], "pack": "Jurassique revisité — Découvertes et réinterprétations", "img": "cartes/JUR-02.webp"},
 {"id": "JUR-03", "site": "JUR", "nom": "Fujianvenator prodigiosus", "groupe": "Avialien basal", "periode": "Jurassique supérieur, Tithonien", "age": "≈ 150 Ma", "ageMin": 150.0, "ageMax": 150.0, "lieu": "Fujian, sud-est de la Chine", "milieu": "Terrestre, probablement lié aux zones humides", "regime": "Petites proies et invertébrés probables ; régime incertain", "taille": "≈ 0,5–0,7 m", "masse": "≈ 0,5–1 kg ; très incertain", "longevite": "Probablement quelques années ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Moyenne à élevée", "confN": 4, "desc": "Petit avialien aux membres postérieurs très allongés, notamment au tibia, donnant une silhouette inhabituelle de coureur ou d’échassier.", "prudence": "Le squelette est articulé mais incomplet, sans crâne complet ni plumage directement conservé ; le mode de vie d’échassier ou de coureur reste une hypothèse fonctionnelle.", "src": [["A new avialan theropod from an emerging Jurassic terrestrial fauna — Nature", "https://www.nature.com/articles/s41586-023-06513-7"], ["Fujianvenator prodigiosus — PubMed", "https://pubmed.ncbi.nlm.nih.gov/37674081/"]], "pack": "Jurassique revisité — Découvertes et réinterprétations", "img": "cartes/JUR-03.webp"},
 {"id": "JUR-04", "site": "JUR", "nom": "Mamenchisaurus sinocanadorum", "groupe": "Sauropode mamenchisauridé", "periode": "Jurassique supérieur, Oxfordien", "age": "≈ 162 Ma", "ageMin": 162.0, "ageMax": 162.0, "lieu": "Xinjiang, nord-ouest de la Chine", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 30–35 m ; extrapolé", "masse": "≈ 25–40 t ; très incertain", "longevite": "Plusieurs décennies, potentiellement davantage ; estimation indirecte", "confLong": "Très faible", "conf": "Faible à moyenne", "confN": 2, "desc": "Sauropode connu pour un cou estimé à environ 15,1 m, probablement le plus long pouvant être défendu avec un modèle anatomique explicite.", "prudence": "Le spécimen est très incomplet : longueur totale, masse, posture du cou et silhouette générale sont largement extrapolées à partir de parents mieux connus.", "src": [["Re-assessment of the Late Jurassic eusauropod Mamenchisaurus sinocanadorum — Journal of Systematic Palaeontology", "https://www.tandfonline.com/doi/abs/10.1080/14772019.2023.2171818"], ["Record-holding 15-metre neck — Stony Brook University", "https://news.stonybrook.edu/newsroom/press-release/medical/new-fossil-analysis-reveals-dinosaur-with-record-holding-15-meter-long-neck/"]], "pack": "Jurassique revisité — Découvertes et réinterprétations", "img": "cartes/JUR-04.webp"},
 {"id": "JUR-05", "site": "JUR", "nom": "Dilophosaurus wetherilli", "groupe": "Théropode néothéropode basal", "periode": "Jurassique inférieur, Sinémurien–Pliensbachien", "age": "≈ 186–182 Ma", "ageMin": 182.0, "ageMax": 186.0, "lieu": "Arizona, États-Unis", "milieu": "Terrestre", "regime": "Carnivore", "taille": "≈ 6–7 m", "masse": "≈ 300–450 kg", "longevite": "Probablement plusieurs décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grand prédateur robuste à deux crêtes crâniennes minces, aux mâchoires fonctionnelles et au squelette fortement pneumatisé, très différent de la caricature populaire frêle.", "prudence": "Le squelette est bien documenté, mais l’étendue des tissus mous sur les crêtes, les lèvres, la peau et les couleurs sont inconnues ; aucune preuve n’appuie une collerette extensible ou du venin.", "src": [["A comprehensive anatomical and phylogenetic evaluation of Dilophosaurus wetherilli — Journal of Paleontology", "https://www.cambridge.org/core/journals/journal-of-paleontology/article/comprehensive-anatomical-and-phylogenetic-evaluation-of-dilophosaurus-wetherilli-dinosauria-theropoda-with-descriptions-of-new-specimens-from-the-kayenta-formation-of-northern-arizona/39C2921EDC6E951AC9F94A22158CA4E5"], ["Dilophosaurus wetherilli research resources — Jackson School of Geosciences", "https://www.jsg.utexas.edu/txvp/dilophosaurus/"]], "pack": "Jurassique revisité — Découvertes et réinterprétations", "img": "cartes/JUR-05.webp"},
 {"id": "JUR-06", "site": "JUR", "nom": "Yi qi", "groupe": "Scansorioptérygidé", "periode": "Jurassique moyen–supérieur, Callovien–Oxfordien", "age": "≈ 160 Ma", "ageMin": 160.0, "ageMax": 160.0, "lieu": "Hebei, nord de la Chine", "milieu": "Arboricole et aérien par vol plané", "regime": "Insectivore ou omnivore probable", "taille": "≈ 50–60 cm", "masse": "≈ 0,4–0,6 kg", "longevite": "Probablement quelques années ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Petit dinosaure emplumé portant un élément styliforme au poignet et une membrane alaire sans équivalent direct chez les autres dinosaures.", "prudence": "La membrane est directement attestée, mais sa forme exacte, son ancrage au corps et la posture en vol restent débattus ; les modèles suggèrent un planeur peu performant plutôt qu’un volant actif.", "src": [["A bizarre Jurassic maniraptoran with elongate ribbon-like feathers and membranous wings — Nature", "https://www.nature.com/articles/nature14423"], ["Aerodynamics show membrane-winged theropods were poor gliders — iScience", "https://www.cell.com/iscience/fulltext/S2589-0042(20)30766-5"]], "pack": "Jurassique revisité — Découvertes et réinterprétations", "img": "cartes/JUR-06.webp"},
 {"id": "MOR-01", "site": "MOR", "nom": "Allosaurus fragilis", "groupe": "Théropode allosauridé", "periode": "Jurassique supérieur, Kimméridgien–Tithonien", "age": "≈ 157–148 Ma", "ageMin": 148.0, "ageMax": 157.0, "lieu": "Ouest des États-Unis", "milieu": "Terrestre", "regime": "Carnivore", "taille": "8,5–10 m", "masse": "≈ 1,5–2,5 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grand prédateur emblématique de la Formation de Morrison, reconnaissable à ses petites crêtes au-dessus des yeux.", "prudence": "Le squelette est très bien connu ; les lèvres, le revêtement cutané et la coloration restent discutés.", "src": [["Allosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/allosaurus.html"], ["Histology and Geochemistry of Allosaurus — Frontiers in Earth Science", "https://www.frontiersin.org/journals/earth-science/articles/10.3389/feart.2021.641060/full"]], "pack": "Morrison — Les géants du Jurassique américain", "img": "cartes/MOR-01.webp"},
 {"id": "MOR-02", "site": "MOR", "nom": "Stegosaurus stenops", "groupe": "Stégosauridé", "periode": "Jurassique supérieur, Kimméridgien–Tithonien", "age": "≈ 157–148 Ma", "ageMin": 148.0, "ageMax": 157.0, "lieu": "Colorado, Wyoming et Utah, États-Unis", "milieu": "Terrestre", "regime": "Herbivore", "taille": "6,5–7,5 m", "masse": "≈ 3–4,5 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Herbivore quadrupède à deux rangées de plaques dorsales et à queue armée de quatre pointes.", "prudence": "Le squelette est excellent ; l’orientation précise des plaques, leur couleur et leur fonction d’affichage restent partiellement interprétées.", "src": [["Stegosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/stegosaurus.html"], ["Wikipedia", "https://en.wikipedia.org/wiki/Stegosaurus_stenops"]], "pack": "Morrison — Les géants du Jurassique américain", "img": "cartes/MOR-02.webp"},
 {"id": "MOR-04", "site": "MOR", "nom": "Diplodocus carnegii", "groupe": "Sauropode diplodocidé", "periode": "Jurassique supérieur, Kimméridgien–Tithonien", "age": "≈ 157–148 Ma", "ageMin": 148.0, "ageMax": 157.0, "lieu": "Wyoming et Colorado, États-Unis", "milieu": "Terrestre", "regime": "Herbivore", "taille": "24–26 m", "masse": "≈ 12–16 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Sauropode gracile à très long cou, crâne léger et queue en fouet.", "prudence": "Le squelette est complet, mais la posture du cou, la position des narines charnues et l’emploi de la queue restent débattus.", "src": [["Diplodocus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/diplodocus.html"], ["Diplodocus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/diplodocus.html"]], "pack": "Morrison — Les géants du Jurassique américain", "img": "cartes/MOR-04.webp"},
 {"id": "MOR-07", "site": "MOR", "nom": "Brachiosaurus altithorax", "groupe": "Sauropode brachiosauridé", "periode": "Jurassique supérieur, Kimméridgien", "age": "≈ 154–150 Ma", "ageMin": 150.0, "ageMax": 154.0, "lieu": "Colorado et Utah, États-Unis", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 20–22 m", "masse": "≈ 28–40 t ; estimation indirecte", "longevite": "Plusieurs décennies, potentiellement davantage ; estimation indirecte", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Sauropode à épaules très hautes, membres antérieurs plus longs que les postérieurs et tronc profond, adapté à un broutage nettement plus élevé que les diplodocidés.", "prudence": "L’espèce nord-américaine est connue par un squelette partiel et peu de matériel attribuable avec certitude ; le crâne, la masse et plusieurs proportions sont souvent confondus avec Giraffatitan.", "src": [["A re-evaluation of Brachiosaurus altithorax — Journal of Vertebrate Paleontology", "https://www.tandfonline.com/doi/abs/10.1671/039.029.0309"], ["Redescription of brachiosaurid sauropod dinosaur material from the Morrison Formation — The Anatomical Record", "https://anatomypubs.onlinelibrary.wiley.com/doi/10.1002/ar.24198"]], "pack": "Morrison — Les géants du Jurassique américain", "img": "cartes/MOR-07.webp"},
 {"id": "MOR-08", "site": "MOR", "nom": "Ceratosaurus nasicornis", "groupe": "Théropode cératosauridé", "periode": "Jurassique supérieur, Kimméridgien–Tithonien", "age": "≈ 153–148 Ma", "ageMin": 148.0, "ageMax": 153.0, "lieu": "Colorado et Utah, États-Unis", "milieu": "Terrestre, probablement fréquent dans les milieux riverains", "regime": "Carnivore", "taille": "≈ 5,5–7 m", "masse": "≈ 0,5–1 t", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Prédateur reconnaissable à sa corne nasale, ses bosses supra-orbitaires, son crâne profond et une rangée d’ostéodermes le long du dos.", "prudence": "Le squelette type est relativement complet, mais les limites entre espèces attribuées au genre, la taille maximale, les gaines cornées et la couverture cutanée restent discutées.", "src": [["Ceratosaurus: a revised osteology — Utah Geological Survey", "https://ugspub.nr.utah.gov/publications/misc_pubs/mp-00-2.pdf"], ["The endocranium of Ceratosaurus — Acta Palaeontologica Polonica", "https://www.app.pan.pl/archive/published/app50/app50-601.pdf"]], "pack": "Morrison — Les géants du Jurassique américain", "img": "cartes/MOR-08.webp"},
 {"id": "MOR-09", "site": "MOR", "nom": "Camptosaurus dispar", "groupe": "Ornithopode iguanodontien basal", "periode": "Jurassique supérieur, Kimméridgien–Tithonien", "age": "≈ 155–148 Ma", "ageMin": 148.0, "ageMax": 155.0, "lieu": "Wyoming, Colorado et Utah, États-Unis", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 5–7 m", "masse": "≈ 0,5–1 t", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Ornithopode robuste à bec, probablement capable d’alterner locomotion bipède et quadrupède, occupant une taille intermédiaire entre Dryosaurus et les grands sauropodes.", "prudence": "Le matériel est abondant mais historiquement mélangé entre plusieurs noms ; une révision de 2026 consolide le type, tandis que la posture habituelle, la peau et les couleurs restent inférées.", "src": [["Osteology atlas of the type materials of Camptosaurus dispar — New Mexico Museum of Natural History and Science Bulletin", "https://www.researchgate.net/publication/400035537_OSTEOLOGY_ATLAS_OF_THE_TYPE_MATERIALS_IN_THE_YALE_PAEABODY_MUSEUM_OF"], ["Osteology of the Jurassic reptile Camptosaurus — Proceedings of the U.S. National Museum", "https://doi.org/10.5479/si.00963801.36-1666.197"]], "pack": "Morrison — Les géants du Jurassique américain", "img": "cartes/MOR-09.webp"},
 {"id": "NEM-01", "site": "NEM", "nom": "Tarbosaurus bataar", "groupe": "Tyrannosauridé", "periode": "Crétacé supérieur, Maastrichtien inférieur", "age": "≈ 70–68 Ma", "ageMin": 68.0, "ageMax": 70.0, "lieu": "Désert de Gobi, Mongolie ; possibles occurrences voisines en Chine", "milieu": "Terrestre", "regime": "Carnivore", "taille": "≈ 10–12 m", "masse": "≈ 4–6 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grand tyrannosauridé asiatique au crâne profond mais relativement plus étroit que celui de Tyrannosaurus, superprédateur des plaines fluviales de Nemegt.", "prudence": "De nombreux squelettes documentent bien l’anatomie ; lèvres, coloration, étendue éventuelle d’un revêtement filamentaire chez les jeunes et masse maximale restent discutées.", "src": [["Description of the skull of Tarbosaurus bataar — Acta Palaeontologica Polonica", "https://www.app.pan.pl/archive/published/app48/app48-161.pdf"], ["Cranial osteology of a juvenile Tarbosaurus bataar — Journal of Vertebrate Paleontology", "https://doi.org/10.1080/02724634.2011.557116"]], "pack": "Nemegt — Le Gobi vert", "img": "cartes/NEM-01.webp"},
 {"id": "NEM-02", "site": "NEM", "nom": "Deinocheirus mirificus", "groupe": "Ornithomimosaure deinocheiridé", "periode": "Crétacé supérieur, Maastrichtien inférieur", "age": "≈ 70–68 Ma", "ageMin": 68.0, "ageMax": 70.0, "lieu": "Désert de Gobi, Mongolie", "milieu": "Terrestre, fréquentant les zones humides", "regime": "Omnivore à forte composante végétale, incluant des poissons", "taille": "≈ 10–11 m", "masse": "≈ 6–7 t", "longevite": "Plusieurs décennies possibles ; aucune estimation histologique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Ornithomimosaure géant à large bec édenté, dos bossu porté par de hautes épines neurales, bassin massif et longs bras griffus.", "prudence": "Deux squelettes presque complets contraignent fortement la silhouette ; le volume de la bosse, l’étendue du plumage, la forme de la queue et les couleurs restent néanmoins interprétés.", "src": [["Resolving the long-standing enigmas of a giant ornithomimosaur Deinocheirus mirificus — Nature", "https://www.nature.com/articles/nature13874"], ["Deinocheirus mirificus — PubMed", "https://pubmed.ncbi.nlm.nih.gov/25337880/"]], "pack": "Nemegt — Le Gobi vert", "img": "cartes/NEM-02.webp"},
 {"id": "NEM-03", "site": "NEM", "nom": "Therizinosaurus cheloniformis", "groupe": "Thérizinosauridé", "periode": "Crétacé supérieur, Maastrichtien inférieur", "age": "≈ 70–68 Ma", "ageMin": 68.0, "ageMax": 70.0, "lieu": "Désert de Gobi, Mongolie", "milieu": "Terrestre", "regime": "Herbivore ou omnivore à forte composante végétale", "taille": "≈ 9–10 m", "masse": "≈ 4–5 t ; extrapolé", "longevite": "Plusieurs décennies possibles ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Très grand théropode à long cou et mains portant des griffes osseuses dépassant 50 cm, probablement utilisées pour atteindre ou manipuler la végétation et pour l’affichage.", "prudence": "Therizinosaurus lui-même est connu surtout par des membres et quelques éléments ; le crâne, le tronc, le plumage et les proportions générales sont reconstruits à partir de thérizinosaures proches.", "src": [["Morphological and functional diversity in therizinosaur claws — Proceedings of the Royal Society B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC4024305/"], ["Therizinosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/therizinosaurus.html"]], "pack": "Nemegt — Le Gobi vert", "img": "cartes/NEM-03.webp"},
 {"id": "NEM-04", "site": "NEM", "nom": "Saurolophus angustirostris", "groupe": "Hadrosauridé saurolophiné", "periode": "Crétacé supérieur, Maastrichtien inférieur", "age": "≈ 70–68 Ma", "ageMin": 68.0, "ageMax": 70.0, "lieu": "Désert de Gobi, Mongolie", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 10–12 m", "masse": "≈ 3–5 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grand hadrosaure à longue crête osseuse pleine projetée vers l’arrière, très abondant dans la Formation de Nemegt et connu à plusieurs stades de croissance.", "prudence": "Crâne, squelette et certaines empreintes de peau sont bien documentés ; la forme des tissus mous autour de la crête, les couleurs et la structure sociale restent incertaines.", "src": [["Cranial osteology and ontogeny of Saurolophus angustirostris — Acta Palaeontologica Polonica", "https://www.app.pan.pl/archive/published/app56/app20100061.pdf"], ["Perinatal specimens of Saurolophus angustirostris — PLOS ONE", "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0138806"]], "pack": "Nemegt — Le Gobi vert", "img": "cartes/NEM-04.webp"},
 {"id": "NEM-05", "site": "NEM", "nom": "Tarchia tumanovae", "groupe": "Ankylosauridé", "periode": "Crétacé supérieur, Maastrichtien inférieur", "age": "≈ 70–68 Ma", "ageMin": 68.0, "ageMax": 70.0, "lieu": "Désert de Gobi, Mongolie", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 5–6 m", "masse": "≈ 2–3 t ; estimation indirecte", "longevite": "Plusieurs décennies possibles ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Ankylosauridé à crâne large, armure osseuse et massue caudale ; des lésions sur le bassin et la queue suggèrent des combats entre congénères.", "prudence": "Le spécimen type conserve crâne, colonne, bassin, ostéodermes et massue, mais pas une armure articulée complète ; l’emplacement exact de plusieurs plaques reste extrapolé.", "src": [["A new ankylosaurid from the Upper Cretaceous Nemegt Formation — Scientific Reports", "https://www.nature.com/articles/s41598-021-02273-4"], ["Palaeopathological evidence for intraspecific combat in ankylosaurs — Biology Letters", "https://royalsocietypublishing.org/rsbl/article/18/12/20220404/63066/Palaeopathological-evidence-for-intraspecific"]], "pack": "Nemegt — Le Gobi vert", "img": "cartes/NEM-05.webp"},
 {"id": "NEM-06", "site": "NEM", "nom": "Gallimimus bullatus", "groupe": "Ornithomimidé", "periode": "Crétacé supérieur, Maastrichtien inférieur", "age": "≈ 70–68 Ma", "ageMin": 68.0, "ageMax": 70.0, "lieu": "Désert de Gobi, Mongolie", "milieu": "Terrestre", "regime": "Omnivore ou herbivore opportuniste ; régime discuté", "taille": "≈ 5,5–6 m", "masse": "≈ 0,4–0,6 t", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grand ornithomimidé à petite tête, long cou et membres postérieurs adaptés à une locomotion rapide, connu par plusieurs squelettes dont des juvéniles.", "prudence": "Le squelette est excellent, mais le bec, le régime précis et l’étendue du plumage sont inférés ; des ailes pennées sont plausibles par comparaison avec des ornithomimidés proches.", "src": [["New material of a derived ornithomimosaur from the Nemegt Formation — Acta Palaeontologica Polonica", "https://bioone.org/journals/acta-palaeontologica-polonica/volume-56/issue-3/app.2009.1123/New-Material-of-a-Derived-Ornithomimosaur-from-the-Upper-Cretaceous/10.4202/app.2009.1123.full"], ["Body mass estimation in non-avian bipeds — Methods in Ecology and Evolution", "https://besjournals.onlinelibrary.wiley.com/doi/10.1111/2041-210X.12226"]], "pack": "Nemegt — Le Gobi vert", "img": "cartes/NEM-06.webp"},
 {"id": "NWE-01", "site": "NWE", "nom": "Iguanodon bernissartensis", "groupe": "Ornithopode iguanodontien", "periode": "Crétacé inférieur, Barrémien–Aptien", "age": "≈ 126–122 Ma", "ageMin": 122.0, "ageMax": 126.0, "lieu": "Bernissart, Belgique, et Europe occidentale", "milieu": "Terrestre", "regime": "Herbivore", "taille": "9–10 m", "masse": "≈ 3–5 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grand herbivore de Bernissart, doté d’un pouce en pointe et capable d’alterner locomotion bipède et quadrupède.", "prudence": "Les squelettes sont exceptionnels ; la posture verticale historique est obsolète et doit être évitée.", "src": [["Iguanodon — Collections IRSNB", "https://collections.naturalsciences.be/ssh-paleontology/masterpieces/bernissart"], ["Institut des Sciences naturelles — Bernissart", "https://www.naturalsciences.be/en/discover-join/discover/the-bernissart-iguanodons-at-a-glance"]], "pack": "De Bernissart à Maastricht — Le Crétacé d’Europe du Nord-Ouest", "img": "cartes/NWE-01.webp"},
 {"id": "NWE-02", "site": "NWE", "nom": "Baryonyx walkeri", "groupe": "Théropode spinosauridé", "periode": "Crétacé inférieur, Barrémien", "age": "≈ 130–125 Ma", "ageMin": 125.0, "ageMax": 130.0, "lieu": "Surrey, Angleterre", "milieu": "Terrestre et semi-aquatique opportuniste", "regime": "Carnivore piscivore", "taille": "7,5–10 m", "masse": "≈ 1,2–2 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Spinosauridé au museau étroit, aux dents coniques et à l’immense griffe du pouce.", "prudence": "Le squelette est très informatif ; la hauteur d’une éventuelle crête dorsale, la couverture et le degré de spécialisation aquatique restent incertains.", "src": [["Natural History Museum — Baryonyx", "https://www.nhm.ac.uk/discover/how-did-baryonyx-change-what-we-knew-about-spinosaurs.html"], ["Wikipedia", "https://en.wikipedia.org/wiki/Baryonyx_walkeri"]], "pack": "De Bernissart à Maastricht — Le Crétacé d’Europe du Nord-Ouest", "img": "cartes/NWE-02.webp"},
 {"id": "NWE-03", "site": "NWE", "nom": "Hypsilophodon foxii", "groupe": "Ornithopode basal", "periode": "Crétacé inférieur, Barrémien", "age": "≈ 126–120 Ma", "ageMin": 120.0, "ageMax": 126.0, "lieu": "Île de Wight, Angleterre", "milieu": "Terrestre", "regime": "Herbivore", "taille": "1,8–2,3 m", "masse": "≈ 15–25 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Petit herbivore bipède agile, autrefois imaginé à tort comme un grimpeur arboricole.", "prudence": "Le squelette est abondant ; les couleurs, la peau et le comportement grégaire restent spéculatifs.", "src": [["Natural History Museum — Hypsilophodon", "https://www.nhm.ac.uk/discover/dino-directory/hypsilophodon.html"], ["Wikipedia", "https://en.wikipedia.org/wiki/Hypsilophodon_foxii"]], "pack": "De Bernissart à Maastricht — Le Crétacé d’Europe du Nord-Ouest", "img": "cartes/NWE-03.webp"},
 {"id": "NWE-04", "site": "NWE", "nom": "Vectipelta barretti", "groupe": "Ankylosaure", "periode": "Crétacé inférieur, Barrémien", "age": "≈ 129–125 Ma", "ageMin": 125.0, "ageMax": 129.0, "lieu": "Île de Wight, Angleterre", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 4–5 m", "masse": "≈ 1–2 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Ankylosaure récemment décrit, doté d’une armure plus lamellaire et d’épines recourbées distinctes de Polacanthus.", "prudence": "Le squelette est incomplet et l’armure n’est pas entièrement articulée ; la distribution des plaques est donc partiellement reconstruite.", "src": [["Natural History Museum — Vectipelta", "https://www.nhm.ac.uk/press-office/new-dinosaur-named-for-natural-history-museum-professor-.html"], ["Wikipedia", "https://en.wikipedia.org/wiki/Vectipelta_barretti"]], "pack": "De Bernissart à Maastricht — Le Crétacé d’Europe du Nord-Ouest", "img": "cartes/NWE-04.webp"},
 {"id": "NWE-05", "site": "NWE", "nom": "Prognathodon saturator", "groupe": "Mosasaure prognathodontiné", "periode": "Crétacé supérieur, Maastrichtien", "age": "≈ 68–66 Ma", "ageMin": 66.0, "ageMax": 68.0, "lieu": "Maastricht, Pays-Bas", "milieu": "Aquatique marin", "regime": "Grand prédateur, durophage et carnivore", "taille": "10–13 m", "masse": "≈ 4–8 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Mosasaure massif à crâne court et très robuste, adapté à de puissantes morsures.", "prudence": "Le crâne est excellent ; la longueur totale et la masse dépendent de comparaisons avec d’autres mosasaures.", "src": [["Mosasaur — Wikipedia", "https://en.wikipedia.org/wiki/Mosasaur"], ["Prognathodon saturator — Netherlands Journal of Geosciences", "https://njgjournal.nl/index.php/njg/article/view/11353"]], "pack": "De Bernissart à Maastricht — Le Crétacé d’Europe du Nord-Ouest", "img": "cartes/NWE-05.webp"},
 {"id": "NWE-06", "site": "NWE", "nom": "Plioplatecarpus marshi", "groupe": "Mosasaure plioplatecarpiné", "periode": "Crétacé supérieur, Campanien–Maastrichtien", "age": "≈ 72–66 Ma", "ageMin": 66.0, "ageMax": 72.0, "lieu": "Belgique et Pays-Bas", "milieu": "Aquatique marin", "regime": "Piscivore et prédateur de petites proies", "taille": "5–6 m", "masse": "≈ 500–1 000 kg", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Mosasaure plus gracile, au crâne étroit et aux membres transformés en palettes natatoires.", "prudence": "La silhouette est bien documentée ; la nageoire caudale, les lèvres et les motifs cutanés restent reconstruits.", "src": [["Mosasaur — Wikipedia", "https://en.wikipedia.org/wiki/Mosasaur"], ["Plioplatecarpus — Wikipedia", "https://en.wikipedia.org/wiki/Plioplatecarpus"]], "pack": "De Bernissart à Maastricht — Le Crétacé d’Europe du Nord-Ouest", "img": "cartes/NWE-06.webp"},
 {"id": "YIX-01", "site": "YIX", "nom": "Yutyrannus huali", "groupe": "Tyrannosauroïde basal", "periode": "Crétacé inférieur, Aptien", "age": "≈ 126–122 Ma", "ageMin": 122.0, "ageMax": 126.0, "lieu": "Liaoning, nord-est de la Chine", "milieu": "Terrestre", "regime": "Carnivore", "taille": "8–9 m", "masse": "≈ 1,2–1,5 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grand tyrannosauroïde à trois doigts, exceptionnellement conservé avec un revêtement filamentaire étendu.", "prudence": "La présence de filaments est certaine, mais leur densité, couleur complète et distribution précise sur tout le corps restent partiellement interprétées.", "src": [["A gigantic feathered dinosaur from the Lower Cretaceous of China — Nature", "https://www.nature.com/articles/nature10906"], ["Yutyrannus — Institute of Vertebrate Paleontology and Paleoanthropology", "https://english.ivpp.cas.cn/rh/rp/201204/t20120405_83315.html"]], "pack": "Yixian — La Chine du Crétacé à plumes", "img": "cartes/YIX-01.webp"},
 {"id": "YIX-02", "site": "YIX", "nom": "Sinosauropteryx prima", "groupe": "Compsognathidé", "periode": "Crétacé inférieur, Aptien", "age": "≈ 126–122 Ma", "ageMin": 122.0, "ageMax": 126.0, "lieu": "Liaoning, Chine", "milieu": "Terrestre", "regime": "Carnivore insectivore", "taille": "1–1,3 m", "masse": "≈ 0,5–1 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Petit théropode filamentaire dont la queue annelée a été partiellement reconstituée grâce aux mélanosomes.", "prudence": "Les motifs de couleur sont mieux contraints que chez beaucoup de dinosaures, mais les teintes exactes restent dépendantes des modèles.", "src": [["Countershading and stripes in Sinosauropteryx — Current Biology", "https://www.cell.com/current-biology/fulltext/S0960-9822(17)31197-1"], ["Fossilized melanosomes and the colour of Cretaceous dinosaurs and birds — Nature", "https://www.nature.com/articles/nature08740"]], "pack": "Yixian — La Chine du Crétacé à plumes", "img": "cartes/YIX-02.webp"},
 {"id": "YIX-03", "site": "YIX", "nom": "Caudipteryx zoui", "groupe": "Oviraptorosaure basal", "periode": "Crétacé inférieur, Aptien", "age": "≈ 126–122 Ma", "ageMin": 122.0, "ageMax": 126.0, "lieu": "Liaoning, Chine", "milieu": "Terrestre", "regime": "Omnivore, probablement à forte composante végétale", "taille": "0,9–1,1 m", "masse": "≈ 5–7 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Petit théropode au bec court, muni de grandes plumes symétriques sur les bras et d’un éventail caudal.", "prudence": "Le plumage est bien conservé ; les couleurs et le régime exact restent moins certains.", "src": [["Two feathered dinosaurs from northeastern China — Nature", "https://www.nature.com/articles/32447"], ["Caudipteryx — Encyclopaedia Britannica", "https://www.britannica.com/animal/Caudipteryx"]], "pack": "Yixian — La Chine du Crétacé à plumes", "img": "cartes/YIX-03.webp"},
 {"id": "YIX-04", "site": "YIX", "nom": "Psittacosaurus lujiatunensis", "groupe": "Cératopsien basal", "periode": "Crétacé inférieur, Aptien", "age": "≈ 126–123 Ma", "ageMin": 123.0, "ageMax": 126.0, "lieu": "Liaoning, Chine", "milieu": "Terrestre", "regime": "Herbivore", "taille": "1,5–2 m", "masse": "≈ 15–25 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Petit cératopsien bipède ou quadrupède, à bec puissant, courte collerette et soies caudales.", "prudence": "Des tissus mous et motifs cutanés sont connus chez le genre ; leur transposition exacte à l’espèce doit rester prudente.", "src": [["Three-dimensional preservation of skin in Psittacosaurus — Communications Biology", "https://www.nature.com/articles/s42003-022-03749-3"], ["Ontogenetic stages of Psittacosaurus — Acta Palaeontologica Polonica", "https://www.app.pan.pl/archive/published/app64/app005592018.html"]], "pack": "Yixian — La Chine du Crétacé à plumes", "img": "cartes/YIX-04.webp"},
 {"id": "YIX-05", "site": "YIX", "nom": "Repenomamus robustus", "groupe": "Mammifère eutriconodonte", "periode": "Crétacé inférieur, Aptien", "age": "≈ 126–122 Ma", "ageMin": 122.0, "ageMax": 126.0, "lieu": "Liaoning, Chine", "milieu": "Terrestre", "regime": "Carnivore ou omnivore, incluant de petits vertébrés", "taille": "50–70 cm", "masse": "≈ 4–6 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Mammifère robuste dont un spécimen a conservé dans l’abdomen les restes d’un jeune dinosaure.", "prudence": "Le squelette est complet, mais le pelage, la coloration et le comportement restent inférés à partir de mammifères proches.", "src": [["Repenomamus — Nature", "https://www.nature.com/articles/433149a"], ["Wikipedia", "https://en.wikipedia.org/wiki/Repenomamus_robustus"]], "pack": "Yixian — La Chine du Crétacé à plumes", "img": "cartes/YIX-05.webp"},
 {"id": "YIX-06", "site": "YIX", "nom": "Confuciusornis sanctus", "groupe": "Oiseau basal confuciusornithidé", "periode": "Crétacé inférieur, Aptien", "age": "≈ 125–120 Ma", "ageMin": 120.0, "ageMax": 125.0, "lieu": "Liaoning et Hebei, Chine", "milieu": "Aérien et terrestre", "regime": "Omnivore ou insectivore ; régime discuté", "taille": "25–35 cm ; envergure ≈ 50–70 cm", "masse": "≈ 0,2–0,5 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Oiseau primitif à bec édenté, avec de longues plumes caudales chez certains individus.", "prudence": "Le plumage est bien connu, mais la couleur, le dimorphisme sexuel et le régime alimentaire exact restent débattus.", "src": [["Confuciusornis — Britannica", "https://www.britannica.com/animal/Confuciusornis"], ["Jehol Biota — Wikipedia", "https://en.wikipedia.org/wiki/Jehol_Biota"]], "pack": "Yixian — La Chine du Crétacé à plumes", "img": "cartes/YIX-06.webp"},
 {"id": "YIX-07", "site": "YIX", "nom": "Beipiaosaurus inexpectus", "groupe": "Thérizinosaure basal", "periode": "Crétacé inférieur, Aptien", "age": "≈ 125 Ma", "ageMin": 125.0, "ageMax": 125.0, "lieu": "Liaoning, nord-est de la Chine", "milieu": "Terrestre", "regime": "Herbivore ou omnivore à forte composante végétale", "taille": "≈ 2,2 m", "masse": "≈ 80–100 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Thérizinosaure basal à corps trapu, long cou et longues griffes, couvert d’un duvet filamentaire et de grandes plumes simples probablement liées à l’affichage.", "prudence": "Plusieurs spécimens préservent le squelette et le tégument, mais la palette complète, la densité du plumage et la fonction exacte des longues plumes restent incertaines.", "src": [["Postcranial osteology of Beipiaosaurus inexpectus — PLOS ONE", "https://pmc.ncbi.nlm.nih.gov/articles/PMC8483305/"], ["A new feather type in a nonavian theropod — PNAS", "https://www.pnas.org/doi/10.1073/pnas.0810055106"]], "pack": "Yixian — La Chine du Crétacé à plumes", "img": "cartes/YIX-07.webp"},
 {"id": "YIX-08", "site": "YIX", "nom": "Changyuraptor yangi", "groupe": "Dromaeosauridé microraptoriné", "periode": "Crétacé inférieur, Aptien", "age": "≈ 125 Ma", "ageMin": 125.0, "ageMax": 125.0, "lieu": "Liaoning, nord-est de la Chine", "milieu": "Arboricole et aérien par vol plané", "regime": "Carnivore, probablement insectivore et prédateur de petits vertébrés", "taille": "≈ 1,2 m", "masse": "≈ 4 kg", "longevite": "Probablement quelques années ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grand microraptoriné à quatre ailes, entièrement emplumé, doté de rectrices caudales exceptionnellement longues pouvant stabiliser la descente.", "prudence": "Le spécimen est remarquablement complet, mais les couleurs ne sont pas directement établies et la capacité exacte de décollage, de vol battu ou de simple plané reste modélisée.", "src": [["A new raptorial dinosaur with exceptionally long feathering — Nature Communications", "https://www.nature.com/articles/ncomms5382"], ["The fast and the frugal: locomotory strategies in paravians — Current Biology/PMC", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7220109/"]], "pack": "Yixian — La Chine du Crétacé à plumes", "img": "cartes/YIX-08.webp"},
 {"id": "HC-01", "site": "HC", "nom": "Tyrannosaurus rex", "groupe": "Tyrannosauridé", "periode": "Crétacé supérieur, Maastrichtien terminal", "age": "≈ 68–66 Ma", "ageMin": 66.0, "ageMax": 68.0, "lieu": "Montana, Wyoming, Dakota du Nord, Dakota du Sud et régions voisines d’Amérique du Nord", "milieu": "Terrestre", "regime": "Carnivore", "taille": "≈ 12–13 m", "masse": "≈ 7–9 t", "longevite": "Environ 45–50 ans proposés par une analyse histologique de 2026 ; estimation encore discutée", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Tyrannosauridé géant au crâne massif, à la morsure broyeuse, aux membres postérieurs puissants et aux bras très courts à deux doigts.", "prudence": "Le squelette et la croissance sont exceptionnellement documentés, mais les lèvres, la peau, la coloration et l’étendue d’un éventuel duvet chez les jeunes restent débattues.", "src": [["Prolonged growth and extended subadult development in Tyrannosaurus rex — PeerJ/PMC", "https://pmc.ncbi.nlm.nih.gov/articles/PMC12811967/"], ["Growing up Tyrannosaurus rex — Science Advances", "https://www.science.org/doi/10.1126/sciadv.aax6250"]], "pack": "Hell Creek — La dernière grande plaine marécageuse", "img": "cartes/HC-01.webp"},
 {"id": "HC-02", "site": "HC", "nom": "Triceratops prorsus", "groupe": "Cératopsidé chasmosauriné", "periode": "Crétacé supérieur, Maastrichtien terminal", "age": "≈ 67–66 Ma", "ageMin": 66.0, "ageMax": 67.0, "lieu": "Montana, Wyoming et Dakotas, États-Unis", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 8–9 m", "masse": "≈ 6–10 t", "longevite": "Plusieurs décennies possibles ; aucune durée maximale robuste", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Très grand cératopsidé à deux longues cornes frontales, une corne nasale et une vaste collerette osseuse, dominant les niveaux supérieurs de Hell Creek.", "prudence": "Plus de cinquante crânes documentent l’évolution stratigraphique du genre ; la distinction entre variabilité, ontogénie et espèces, ainsi que la longueur des gaines cornées, exigent de la prudence.", "src": [["Evolutionary trends in Triceratops from the Hell Creek Formation — PNAS", "https://www.pnas.org/doi/10.1073/pnas.1313334111"], ["A comprehensive osteohistological analysis of Triceratops — Cretaceous Research", "https://www.sciencedirect.com/science/article/pii/S0195667123002665"]], "pack": "Hell Creek — La dernière grande plaine marécageuse", "img": "cartes/HC-02.webp"},
 {"id": "HC-03", "site": "HC", "nom": "Ankylosaurus magniventris", "groupe": "Ankylosauridé", "periode": "Crétacé supérieur, Maastrichtien terminal", "age": "≈ 68–66 Ma", "ageMin": 66.0, "ageMax": 68.0, "lieu": "Montana, Wyoming, Alberta et Saskatchewan", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 6–8 m", "masse": "≈ 5–8 t", "longevite": "Plusieurs décennies possibles ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "L’un des plus grands ankylosauridés, très large et bas, protégé par des ostéodermes et muni d’une imposante massue caudale.", "prudence": "Malgré son statut iconique, l’espèce est connue par un nombre limité de squelettes fragmentaires ; l’agencement complet de l’armure et la taille maximale restent partiellement reconstruits.", "src": [["Unusual cranial and postcranial anatomy in Ankylosaurus magniventris — FACETS", "https://dinodata.de/bibliothek/pdf_u/2017/01_facets-2017-0063_dd.pdf"], ["Ankylosaurid dinosaur tail clubs evolved through stepwise acquisition — Journal of Anatomy", "https://pmc.ncbi.nlm.nih.gov/articles/PMC4580109/"]], "pack": "Hell Creek — La dernière grande plaine marécageuse", "img": "cartes/HC-03.webp"},
 {"id": "HC-04", "site": "HC", "nom": "Edmontosaurus annectens", "groupe": "Hadrosauridé saurolophiné", "periode": "Crétacé supérieur, Maastrichtien terminal", "age": "≈ 67–66 Ma", "ageMin": 66.0, "ageMax": 67.0, "lieu": "Dakotas, Montana, Wyoming et Saskatchewan", "milieu": "Terrestre", "regime": "Herbivore", "taille": "≈ 9–12 m", "masse": "≈ 4–7 t", "longevite": "Au moins une quinzaine d’années attestées chez certains individus ; plusieurs décennies possibles", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grand hadrosaure à bec large, dépourvu de crête osseuse, fréquent dans les plaines de Hell Creek et parfois conservé avec de vastes empreintes cutanées.", "prudence": "Les squelettes, séries de croissance et peaux sont abondants, mais la taille maximale, la présence de structures charnues variables et les motifs de couleur restent incertains.", "src": [["Growth and demography of Edmontosaurus annectens — Scientific Reports", "https://pmc.ncbi.nlm.nih.gov/articles/PMC9296034/"], ["A juvenile Edmontosaurus from the late Maastrichtian Hell Creek Formation — Cretaceous Research", "https://www.sciencedirect.com/science/article/abs/pii/S0195667114000950"]], "pack": "Hell Creek — La dernière grande plaine marécageuse", "img": "cartes/HC-04.webp"},
 {"id": "HC-05", "site": "HC", "nom": "Pachycephalosaurus wyomingensis", "groupe": "Pachycéphalosauridé", "periode": "Crétacé supérieur, Maastrichtien terminal", "age": "≈ 68–66 Ma", "ageMin": 66.0, "ageMax": 68.0, "lieu": "Montana, Wyoming, Dakota du Sud et Alberta", "milieu": "Terrestre", "regime": "Herbivore ou omnivore ; régime discuté", "taille": "≈ 4–5 m", "masse": "≈ 300–450 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Dinosaure bipède à épais dôme frontopariétal entouré de bosses et de pointes, dont les traumatismes crâniens soutiennent des interactions physiques entre individus.", "prudence": "Le crâne adulte est bien connu, mais le postcrâne est moins complet ; la synonymie possible de formes juvéniles, le type de combat et les tissus mous restent débattus.", "src": [["Extreme cranial ontogeny in Pachycephalosaurus — PLOS ONE", "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0007626"], ["Cranial pathologies in Pachycephalosaurus — PLOS ONE", "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0036227"]], "pack": "Hell Creek — La dernière grande plaine marécageuse", "img": "cartes/HC-05.webp"},
 {"id": "HC-06", "site": "HC", "nom": "Anzu wyliei", "groupe": "Oviraptorosaure caenagnathidé", "periode": "Crétacé supérieur, Maastrichtien terminal", "age": "≈ 67–66 Ma", "ageMin": 66.0, "ageMax": 67.0, "lieu": "Dakota du Nord et Dakota du Sud, États-Unis", "milieu": "Terrestre", "regime": "Omnivore probable", "taille": "≈ 3,5 m", "masse": "≈ 0,2–0,3 t", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Grand caenagnathidé à bec édenté, crête crânienne, long cou et membres graciles, donnant une silhouette d’oiseau coureur de grande taille.", "prudence": "Trois squelettes partiels donnent une bonne vue de l’anatomie, mais aucun plumage n’est directement conservé et le régime alimentaire demeure inféré du bec et des proches parents.", "src": [["A new large-bodied oviraptorosaurian theropod dinosaur from Hell Creek — PLOS ONE", "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0092022"], ["A new caenagnathid from the end-Maastrichtian Hell Creek Formation — PLOS ONE", "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0294901"]], "pack": "Hell Creek — La dernière grande plaine marécageuse", "img": "cartes/HC-06.webp"},
 {"id": "WHA-01", "site": "WHA", "nom": "Indohyus indirae", "groupe": "Raoellidé, artiodactyle proche des cétacés", "periode": "Éocène moyen", "age": "≈ 49–47 Ma", "ageMin": 47.0, "ageMax": 49.0, "lieu": "Cachemire, Inde", "milieu": "Terrestre et semi-aquatique", "regime": "Herbivore ou omnivore", "taille": "60–80 cm", "masse": "≈ 10–20 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Petit mammifère ressemblant à un chevrotain, doté d’os épaissis compatibles avec un comportement de plongée ou d’immersion.", "prudence": "Il est proche des cétacés mais n’est pas une baleine ; le degré réel de vie aquatique et l’apparence du pelage sont inférés.", "src": [["Indohyus — Nature", "https://www.nature.com/articles/nature06343"], ["Wikipedia", "https://en.wikipedia.org/wiki/Indohyus_indirae"]], "pack": "Des sabots aux baleines", "img": "cartes/WHA-01.webp"},
 {"id": "WHA-02", "site": "WHA", "nom": "Pakicetus attocki", "groupe": "Cétacé pakicétidé", "periode": "Éocène inférieur", "age": "≈ 51–48 Ma", "ageMin": 48.0, "ageMax": 51.0, "lieu": "Pakistan", "milieu": "Terrestre, fréquentant les berges", "regime": "Carnivore, probablement piscivore opportuniste", "taille": "1,5–2 m", "masse": "≈ 30–50 kg", "longevite": "Probablement plusieurs années à quelques décennies ; aucune estimation spécifique robuste", "confLong": "Très faible", "conf": "Élevée", "confN": 4, "desc": "Cétacé très basal encore quadrupède terrestre, identifié comme baleine surtout par la structure de l’oreille.", "prudence": "La tête et les membres sont bien connus ; le pelage, la queue et le comportement aquatique exact restent incertains.", "src": [["Smithsonian — Evolution of Whales", "https://naturalhistory.si.edu/education/teaching-resources/life-science/evolution-whales-animation"], ["Wikipedia", "https://en.wikipedia.org/wiki/Pakicetus_attocki"]], "pack": "Des sabots aux baleines", "img": "cartes/WHA-02.webp"},
 {"id": "WHA-03", "site": "WHA", "nom": "Ambulocetus natans", "groupe": "Cétacé ambulocétidé", "periode": "Éocène moyen", "age": "≈ 49–47 Ma", "ageMin": 47.0, "ageMax": 49.0, "lieu": "Pakistan", "milieu": "Amphibie", "regime": "Carnivore piscivore", "taille": "3–3,5 m", "masse": "≈ 180–300 kg", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Grande baleine amphibie aux membres puissants, nageant probablement par ondulations du tronc et poussées des pieds.", "prudence": "Le squelette est excellent ; il ne faut pas lui ajouter une nageoire caudale moderne ni une posture de crocodile trop littérale.", "src": [["Understanding Evolution — Ambulocetus", "https://evolution.berkeley.edu/what-are-evograms/the-evolution-of-whales/"], ["Understanding Evolution — Whale evolution", "https://evolution.berkeley.edu/what-are-evograms/the-evolution-of-whales/"]], "pack": "Des sabots aux baleines", "img": "cartes/WHA-03.webp"},
 {"id": "WHA-04", "site": "WHA", "nom": "Maiacetus inuus", "groupe": "Cétacé protocétidé", "periode": "Éocène moyen", "age": "≈ 48–46 Ma", "ageMin": 46.0, "ageMax": 48.0, "lieu": "Pakistan", "milieu": "Amphibie, marin côtier", "regime": "Carnivore piscivore", "taille": "2,5–3 m", "masse": "≈ 200–400 kg", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Protocétidé capable de nager en mer tout en soutenant encore son poids sur terre.", "prudence": "Le squelette est bien connu ; l’interprétation d’un petit spécimen comme fœtus et le mode de mise bas restent discutés.", "src": [["Maiacetus — PLOS ONE", "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0004366"], ["Wikipedia", "https://en.wikipedia.org/wiki/Maiacetus_inuus"]], "pack": "Des sabots aux baleines", "img": "cartes/WHA-04.webp"},
 {"id": "WHA-05", "site": "WHA", "nom": "Basilosaurus isis", "groupe": "Cétacé basilosauridé", "periode": "Éocène supérieur", "age": "≈ 40–34 Ma", "ageMin": 34.0, "ageMax": 40.0, "lieu": "Égypte et Afrique du Nord", "milieu": "Aquatique marin", "regime": "Grand prédateur", "taille": "15–18 m", "masse": "≈ 5–10 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Très élevée", "confN": 5, "desc": "Baleine pleinement marine au corps extrêmement allongé, avec de minuscules membres postérieurs externes.", "prudence": "Le squelette est complet ; la forme exacte de la nageoire caudale, les tissus adipeux et les couleurs restent inférés.", "src": [["NCSE — Origin of Whales", "https://ncse.ngo/origin-whales-and-power-independent-evidence"], ["Basilosaurus — Britannica", "https://www.britannica.com/animal/Basilosaurus"]], "pack": "Des sabots aux baleines", "img": "cartes/WHA-05.webp"},
 {"id": "WHA-06", "site": "WHA", "nom": "Aetiocetus cotylalveus", "groupe": "Mysticète basal aetiocétidé", "periode": "Oligocène supérieur", "age": "≈ 28–24 Ma", "ageMin": 24.0, "ageMax": 28.0, "lieu": "Oregon, États-Unis", "milieu": "Aquatique marin", "regime": "Piscivore et alimentation mixte ; possible étape vers la filtration", "taille": "6–8 m", "masse": "≈ 1–3 t", "longevite": "Plusieurs décennies possibles ; estimation indirecte et très incertaine", "confLong": "Très faible", "conf": "Moyenne", "confN": 3, "desc": "Baleine à fanons basale conservant des dents adultes, centrale dans le débat sur la transition des dents vers les fanons.", "prudence": "La présence simultanée de dents et de proto-fanons est plausible mais discutée ; la silhouette complète est moins connue que le crâne.", "src": [["Aetiocetus — Wikipedia", "https://en.wikipedia.org/wiki/Aetiocetus"], ["Aetiocetus — Systematic Biology", "https://academic.oup.com/sysbio/article/57/1/15/1698976"]], "pack": "Des sabots aux baleines", "img": "cartes/WHA-06.webp"},
];

/* 360 QCM paléontologiques, 20 par site. */
const QUIZ_PALEO=[
 {"id": "EDI-01", "site": "EDI", "diff": "facile", "q": "À quelle période appartient la faune de la mer Blanche du pack ?", "choix": ["À l’Édiacarien", "Au Jurassique", "Au Dévonien", "Au Paléocène"], "r": "À l’Édiacarien", "exp": "La faune date de la fin du Précambrien, avant le Cambrien.", "src": ["Food sources for the Ediacara biota", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7062841/"]},
 {"id": "EDI-02", "site": "EDI", "diff": "facile", "q": "Les organismes de ce pack vivaient principalement dans quel milieu ?", "choix": ["Dans des lacs alpins", "Dans l’atmosphère", "Sur le fond marin", "Dans une forêt de conifères"], "r": "Sur le fond marin", "exp": "Ils formaient des communautés benthiques souvent associées à des tapis microbiens.", "src": ["Food sources for the Ediacara biota", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7062841/"]},
 {"id": "EDI-03", "site": "EDI", "diff": "intermédiaire", "q": "Pourquoi faut-il être prudent quand on compare les organismes édiacariens à des animaux modernes ?", "choix": ["Ils sont tous identiques aux méduses actuelles", "Ils possédaient tous un squelette complet", "Ils ont été observés vivants au XIXe siècle", "Leurs affinités évolutives et leurs tissus mous restent souvent incertains"], "r": "Leurs affinités évolutives et leurs tissus mous restent souvent incertains", "exp": "Les empreintes préservent des formes, mais pas toujours les organes permettant une classification sûre.", "src": ["Food sources for the Ediacara biota", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7062841/"]},
 {"id": "EDI-04", "site": "EDI", "diff": "facile", "q": "Quel organisme avait un corps ovale aplati divisé en unités répétées ?", "choix": ["Parvancorina minchami", "Dickinsonia costata", "Kimberella quadrata", "Tribrachidium heraldicum"], "r": "Dickinsonia costata", "exp": "Dickinsonia possède une morphologie matelassée et bilatéralement organisée.", "src": ["Dickinsonia — Geological Magazine", "https://www.cambridge.org/core/journals/geological-magazine/article/dickinsonia-mobile-and-adhered/A8BF44BADED149AF3E0F5EE930DAE02A"]},
 {"id": "EDI-05", "site": "EDI", "diff": "intermédiaire", "q": "Quelle découverte soutient l’idée que Dickinsonia pouvait se déplacer ?", "choix": ["Des séries d’empreintes et de traces d’alimentation associées", "Des œufs à coquille dure", "Des sabots articulés", "Des ailes fossilisées"], "r": "Des séries d’empreintes et de traces d’alimentation associées", "exp": "Les traces successives sur les tapis microbiens sont compatibles avec une mobilité lente.", "src": ["Dickinsonia — Geological Magazine", "https://www.cambridge.org/core/journals/geological-magazine/article/dickinsonia-mobile-and-adhered/A8BF44BADED149AF3E0F5EE930DAE02A"]},
 {"id": "EDI-06", "site": "EDI", "diff": "facile", "q": "Quel organisme était asymétrique, aplati et composé de modules alternés ?", "choix": ["Kimberella quadrata", "Tribrachidium heraldicum", "Parvancorina minchami", "Yorgia waggoneri"], "r": "Yorgia waggoneri", "exp": "Yorgia est un dickinsoniomorphe à organisation alternée et forme asymétrique.", "src": ["Yorgia — Wikipedia", "https://en.wikipedia.org/wiki/Yorgia"]},
 {"id": "EDI-07", "site": "EDI", "diff": "intermédiaire", "q": "Quel type de trace est associé à Yorgia ?", "choix": ["Des pistes de vol", "Des empreintes successives indiquant une locomotion ou alimentation sur le fond", "Des morsures dans des os", "Des terriers verticaux profonds à griffes"], "r": "Des empreintes successives indiquant une locomotion ou alimentation sur le fond", "exp": "Des séries d’empreintes répétées documentent son interaction avec le tapis microbien.", "src": ["Yorgia — Wikipedia", "https://en.wikipedia.org/wiki/Yorgia"]},
 {"id": "EDI-08", "site": "EDI", "diff": "facile", "q": "Quel organisme est souvent interprété comme un animal bilatéral brouteur du fond ?", "choix": ["Dickinsonia costata", "Kimberella quadrata", "Tribrachidium heraldicum", "Parvancorina minchami"], "r": "Kimberella quadrata", "exp": "Kimberella est associée à des traces de raclage et présente une symétrie bilatérale.", "src": ["UCMP Berkeley — Kimberella", "https://ucmp.berkeley.edu/vendian/kimberella.html"]},
 {"id": "EDI-09", "site": "EDI", "diff": "intermédiaire", "q": "Quel indice suggère que Kimberella se nourrissait en raclant les tapis microbiens ?", "choix": ["Des traces de grattage en éventail près des fossiles", "Des feuilles mâchées", "Des coprolithes contenant des os", "Des dents de requin isolées"], "r": "Des traces de grattage en éventail près des fossiles", "exp": "Les traces Kimberichnus sont interprétées comme des marques d’alimentation.", "src": ["Kimberella — Wikipedia", "https://en.wikipedia.org/wiki/Kimberella"]},
 {"id": "EDI-10", "site": "EDI", "diff": "facile", "q": "Quel organisme possédait une symétrie à trois branches recourbées ?", "choix": ["Andiva ivantsovi", "Dickinsonia costata", "Tribrachidium heraldicum", "Yorgia waggoneri"], "r": "Tribrachidium heraldicum", "exp": "Tribrachidium est l’un des exemples classiques de symétrie triradiale édiacarienne.", "src": ["Tribrachidium — Wikipedia", "https://en.wikipedia.org/wiki/Tribrachidium"]},
 {"id": "EDI-11", "site": "EDI", "diff": "avancé", "q": "Quelle fonction a été proposée pour la forme triradiale de Tribrachidium ?", "choix": ["Mâcher des végétaux terrestres", "Canaliser l’eau vers des zones d’alimentation sur la surface corporelle", "Creuser avec des mandibules", "Battre des ailes"], "r": "Canaliser l’eau vers des zones d’alimentation sur la surface corporelle", "exp": "Des modèles hydrodynamiques suggèrent une alimentation par dépôt ou suspension, sans certitude absolue.", "src": ["Tribrachidium — Geosciences", "https://www.mdpi.com/2076-3263/9/9/395"]},
 {"id": "EDI-12", "site": "EDI", "diff": "facile", "q": "Quel petit organisme avait une silhouette en forme d’ancre ou de bouclier ?", "choix": ["Parvancorina minchami", "Dickinsonia costata", "Yorgia waggoneri", "Kimberella quadrata"], "r": "Parvancorina minchami", "exp": "Parvancorina porte une crête centrale et des bras latéraux donnant une forme d’ancre.", "src": ["Parvancorina — Wikipedia", "https://en.wikipedia.org/wiki/Parvancorina"]},
 {"id": "EDI-13", "site": "EDI", "diff": "intermédiaire", "q": "Que suggère l’orientation fréquente de Parvancorina dans certains assemblages ?", "choix": ["Une interaction possible avec les courants", "Un enfouissement dans des arbres", "Une dépendance aux volcans", "Une migration aérienne saisonnière"], "r": "Une interaction possible avec les courants", "exp": "Les fossiles orientés ont été interprétés comme la réponse d’un organisme au flux d’eau.", "src": ["Parvancorina — Scientific Reports", "https://www.nature.com/articles/srep45539"]},
 {"id": "EDI-14", "site": "EDI", "diff": "facile", "q": "Quel organisme avait une forme ovale compacte avec une région antérieure distincte et des segments obliques ?", "choix": ["Parvancorina minchami", "Kimberella quadrata", "Andiva ivantsovi", "Tribrachidium heraldicum"], "r": "Andiva ivantsovi", "exp": "Andiva est un organisme benthique aplati apparenté morphologiquement aux dickinsoniomorphes.", "src": ["Andiva — Wikipedia", "https://en.wikipedia.org/wiki/Andiva"]},
 {"id": "EDI-15", "site": "EDI", "diff": "intermédiaire", "q": "Quel substrat jouait un rôle majeur dans ces écosystèmes ?", "choix": ["Les tapis microbiens", "Les récifs de coraux modernes", "Les sols forestiers riches en humus", "Les prairies de plantes à fleurs"], "r": "Les tapis microbiens", "exp": "Avant la bioturbation intense du Cambrien, des tapis microbiens couvraient largement les fonds.", "src": ["Food sources for the Ediacara biota", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7062841/"]},
 {"id": "EDI-16", "site": "EDI", "diff": "avancé", "q": "Pourquoi les tapis microbiens se conservaient-ils mieux avant le Cambrien ?", "choix": ["Les sédiments étaient faits de métal", "Les fonds étaient entièrement gelés", "Les océans ne contenaient aucun microbe", "Les animaux fouisseurs remuaient moins intensément les sédiments"], "r": "Les animaux fouisseurs remuaient moins intensément les sédiments", "exp": "L’augmentation ultérieure de la bioturbation a profondément modifié les surfaces sédimentaires.", "src": ["Food sources for the Ediacara biota", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7062841/"]},
 {"id": "EDI-17", "site": "EDI", "diff": "intermédiaire", "q": "Quelle affirmation est la plus rigoureuse sur Dickinsonia ?", "choix": ["C’était certainement une méduse moderne", "C’était un trilobite à carapace", "C’était un organisme mobile, mais sa position exacte dans l’arbre animal reste discutée", "C’était une plante terrestre"], "r": "C’était un organisme mobile, mais sa position exacte dans l’arbre animal reste discutée", "exp": "Des biomarqueurs et des traces renforcent son interprétation animale, sans résoudre tous les détails phylogénétiques.", "src": ["Dickinsonia — Geological Magazine", "https://www.cambridge.org/core/journals/geological-magazine/article/dickinsonia-mobile-and-adhered/A8BF44BADED149AF3E0F5EE930DAE02A"]},
 {"id": "EDI-18", "site": "EDI", "diff": "avancé", "q": "Quel changement majeur survient après l’Édiacarien dans le registre fossile ?", "choix": ["La disparition définitive de toute vie marine", "L’apparition immédiate des mammifères", "La formation de la Lune", "Une diversification cambrienne d’animaux à parties dures et de traces complexes"], "r": "Une diversification cambrienne d’animaux à parties dures et de traces complexes", "exp": "Le passage au Cambrien voit se multiplier squelettes minéralisés, terriers et nouveaux plans corporels.", "src": ["Smithsonian — Ediacaran Period", "https://naturalhistory.si.edu/education/teaching-resources/paleontology/ediacaran-period"]},
 {"id": "EDI-19", "site": "EDI", "diff": "intermédiaire", "q": "Quel duo est le plus directement associé à des traces de déplacement ou d’alimentation ?", "choix": ["Tous les organismes sans exception avec certitude", "Dickinsonia et Kimberella", "Andiva et aucun autre", "Tribrachidium et Parvancorina uniquement"], "r": "Dickinsonia et Kimberella", "exp": "Dickinsonia et Kimberella sont particulièrement bien associées à des traces comportementales.", "src": ["Traces of locomotion — Geosciences", "https://www.mdpi.com/2076-3263/9/9/395"]},
 {"id": "EDI-20", "site": "EDI", "diff": "avancé", "q": "Pourquoi un illustrateur doit-il éviter d’ajouter des yeux, bouches et tentacules détaillés à toutes ces formes ?", "choix": ["Ces organes ne sont généralement pas conservés et seraient spéculatifs", "Ils étaient interdits chez les organismes marins", "Les organismes ne possédaient aucune cellule", "Les fossiles montrent qu’ils avaient tous un visage humain"], "r": "Ces organes ne sont généralement pas conservés et seraient spéculatifs", "exp": "La rigueur consiste à rendre les morphologies attestées sans inventer une anatomie moderne complète.", "src": ["Food sources for the Ediacara biota", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7062841/"]},
 {"id": "TRI-01", "site": "TRI", "diff": "facile", "q": "Les trilobites étaient quel type d’animaux ?", "choix": ["Des plantes", "Des mollusques terrestres", "Des arthropodes marins", "Des vertébrés"], "r": "Des arthropodes marins", "exp": "Ils appartiennent aux arthropodes, comme les crustacés, insectes et arachnides.", "src": ["American Museum of Natural History — Trilobites", "https://www.amnh.org/research/paleontology/collections/fossil-invertebrate-collection/trilobite-website"]},
 {"id": "TRI-02", "site": "TRI", "diff": "facile", "q": "Que signifie le nom « trilobite » ?", "choix": ["Une coquille à trois chambres", "Un animal à trois pattes", "Un animal à trois yeux", "Un corps organisé en trois lobes longitudinaux"], "r": "Un corps organisé en trois lobes longitudinaux", "exp": "Un lobe axial est encadré par deux lobes pleuraux.", "src": ["American Museum of Natural History — Trilobites", "https://www.amnh.org/research/paleontology/collections/fossil-invertebrate-collection/trilobite-website"]},
 {"id": "TRI-03", "site": "TRI", "diff": "intermédiaire", "q": "Quelles sont les trois grandes régions transversales d’un trilobite ?", "choix": ["Crâne, cou et bassin", "Céphalon, thorax et pygidium", "Tête, coquille et siphon", "Prosoma, abdomen et dard"], "r": "Céphalon, thorax et pygidium", "exp": "Le céphalon forme la tête, le thorax est articulé et le pygidium constitue la région postérieure.", "src": ["American Museum of Natural History — Trilobites", "https://www.amnh.org/research/paleontology/collections/fossil-invertebrate-collection/trilobite-website"]},
 {"id": "TRI-04", "site": "TRI", "diff": "facile", "q": "Quand les trilobites ont-ils disparu ?", "choix": ["Après l’apparition humaine", "Au début du Jurassique", "À la fin du Crétacé", "À la fin du Permien"], "r": "À la fin du Permien", "exp": "Les dernières lignées ont disparu lors de l’extinction de fin du Permien.", "src": ["American Museum of Natural History — Trilobites", "https://www.amnh.org/research/paleontology/collections/fossil-invertebrate-collection/trilobite-website"]},
 {"id": "TRI-05", "site": "TRI", "diff": "intermédiaire", "q": "Pourquoi trouve-t-on souvent des morceaux séparés de trilobites ?", "choix": ["Ils muaient et leur exosquelette articulé se désarticulait facilement", "Ils explosaient après la mort", "Ils n’avaient jamais de corps entier", "Ils étaient composés de plusieurs individus"], "r": "Ils muaient et leur exosquelette articulé se désarticulait facilement", "exp": "De nombreux céphalons et pygidiums sont des exuvies de mue.", "src": ["University of Oregon — Trilobites", "https://mnch.uoregon.edu/collections-galleries/trilobites"]},
 {"id": "TRI-06", "site": "TRI", "diff": "facile", "q": "Quel trilobite du pack était particulièrement grand et allongé au Cambrien ?", "choix": ["Walliserops trifurcatus", "Drotops armatus", "Trinucleus fimbriatus", "Paradoxides davidis"], "r": "Paradoxides davidis", "exp": "Paradoxides pouvait atteindre plusieurs dizaines de centimètres.", "src": ["Field Museum — Paradoxides", "https://www.fieldmuseum.org/blog/trilobite-paradoxides"]},
 {"id": "TRI-07", "site": "TRI", "diff": "intermédiaire", "q": "Quel trait de Paradoxides est typique de nombreux trilobites cambriens ?", "choix": ["Une large frange perforée", "Des yeux sur pédoncules mobiles", "Un trident frontal", "Un thorax à nombreux segments et un pygidium relativement petit"], "r": "Un thorax à nombreux segments et un pygidium relativement petit", "exp": "Les formes cambriens basales ont souvent un thorax long et une petite région caudale.", "src": ["Field Museum — Paradoxides", "https://www.fieldmuseum.org/blog/trilobite-paradoxides"]},
 {"id": "TRI-08", "site": "TRI", "diff": "facile", "q": "Quel trilobite de Burgess possédait des épines et est parfois conservé avec ses pattes ?", "choix": ["Dicranurus monstrosus", "Walliserops trifurcatus", "Trinucleus fimbriatus", "Olenoides serratus"], "r": "Olenoides serratus", "exp": "Olenoides est l’un des trilobites dont les appendices mous sont exceptionnellement connus.", "src": ["Olenoides — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/olenoides-serratus/"]},
 {"id": "TRI-09", "site": "TRI", "diff": "intermédiaire", "q": "Que montrent les fossiles à appendices d’Olenoides ?", "choix": ["Des ailes plumeuses", "Des pattes biramées avec une branche locomotrice et une branche branchiale", "Des nageoires de poisson", "Des tentacules de poulpe"], "r": "Des pattes biramées avec une branche locomotrice et une branche branchiale", "exp": "Les appendices biramés sont un trait important des trilobites et autres arthropodes basaux.", "src": ["Olenoides — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/olenoides-serratus/"]},
 {"id": "TRI-10", "site": "TRI", "diff": "facile", "q": "Quel trilobite portait de longues cornes recourbées sur le céphalon ?", "choix": ["Dicranurus monstrosus", "Trinucleus fimbriatus", "Drotops armatus", "Paradoxides davidis"], "r": "Dicranurus monstrosus", "exp": "Dicranurus est célèbre pour ses épines céphaliques spectaculaires.", "src": ["Dicranurus — Wikipedia", "https://en.wikipedia.org/wiki/Dicranurus"]},
 {"id": "TRI-11", "site": "TRI", "diff": "intermédiaire", "q": "Quelle fonction est la plus plausible pour les grandes épines de Dicranurus ?", "choix": ["Mastication de plantes", "Vol battu", "Défense, affichage ou augmentation apparente de la taille, sans certitude unique", "Filtration par fanons"], "r": "Défense, affichage ou augmentation apparente de la taille, sans certitude unique", "exp": "Les épines compliquent la prédation, mais leur rôle précis ne peut être démontré directement.", "src": ["Dicranurus — Wikipedia", "https://en.wikipedia.org/wiki/Dicranurus"]},
 {"id": "TRI-12", "site": "TRI", "diff": "facile", "q": "Quel trilobite possédait un spectaculaire trident frontal ?", "choix": ["Walliserops trifurcatus", "Olenoides serratus", "Paradoxides davidis", "Drotops armatus"], "r": "Walliserops trifurcatus", "exp": "Le trident est une extension du céphalon unique chez Walliserops.", "src": ["Walliserops — Wikipedia", "https://en.wikipedia.org/wiki/Walliserops"]},
 {"id": "TRI-13", "site": "TRI", "diff": "avancé", "q": "Quelle hypothèse récente concerne le trident de Walliserops ?", "choix": ["Il servait à voler", "Il était une antenne radio", "Il contenait des dents", "Il aurait pu servir lors de combats entre individus, comme une arme sexuelle"], "r": "Il aurait pu servir lors de combats entre individus, comme une arme sexuelle", "exp": "La comparaison avec des armes d’arthropodes modernes suggère un rôle possible dans la compétition, mais l’hypothèse reste discutée.", "src": ["Walliserops — PNAS", "https://www.pnas.org/doi/10.1073/pnas.2119970120"]},
 {"id": "TRI-14", "site": "TRI", "diff": "facile", "q": "Quel trilobite avait de très grands yeux composés à nombreuses lentilles ?", "choix": ["Dicranurus monstrosus", "Drotops armatus", "Paradoxides davidis", "Trinucleus fimbriatus"], "r": "Drotops armatus", "exp": "Drotops est un phacopide célèbre pour ses yeux schizochroaux.", "src": ["Drotops — Wikipedia", "https://en.wikipedia.org/wiki/Drotops"]},
 {"id": "TRI-15", "site": "TRI", "diff": "intermédiaire", "q": "Qu’est-ce qu’un œil schizochroal ?", "choix": ["Un œil composé de lentilles relativement grandes et séparées individuellement", "Un organe sans lentilles", "Une paire d’yeux sur antennes", "Un œil unique de vertébré"], "r": "Un œil composé de lentilles relativement grandes et séparées individuellement", "exp": "Ce type d’œil est caractéristique des trilobites phacopides.", "src": ["Trilobite eyes — AMNH", "https://www.amnh.org/research/paleontology/collections/fossil-invertebrate-collection/trilobite-website"]},
 {"id": "TRI-16", "site": "TRI", "diff": "facile", "q": "Quel trilobite possédait une large frange céphalique perforée ?", "choix": ["Walliserops trifurcatus", "Drotops armatus", "Trinucleus fimbriatus", "Paradoxides davidis"], "r": "Trinucleus fimbriatus", "exp": "Les trinucleidés ont une frange ponctuée de nombreuses fossules.", "src": ["Trinucleus — Wikipedia", "https://en.wikipedia.org/wiki/Trinucleus"]},
 {"id": "TRI-17", "site": "TRI", "diff": "avancé", "q": "Quelle fonction de la frange perforée de Trinucleus reste discutée ?", "choix": ["Elle servait certainement d’aile", "Elle était une nageoire caudale", "Elle pourrait avoir participé au soutien, à l’alimentation ou aux échanges sensoriels près du sédiment", "Elle produisait du venin"], "r": "Elle pourrait avoir participé au soutien, à l’alimentation ou aux échanges sensoriels près du sédiment", "exp": "La morphologie est claire, mais sa fonction biologique exacte n’est pas résolue.", "src": ["Trinucleus — Wikipedia", "https://en.wikipedia.org/wiki/Trinucleus"]},
 {"id": "TRI-18", "site": "TRI", "diff": "intermédiaire", "q": "Pourquoi certains trilobites pouvaient-ils s’enrouler ?", "choix": ["Pour protéger les parties ventrales et les appendices", "Pour pondre dans les arbres", "Pour voler", "Pour respirer dans l’air"], "r": "Pour protéger les parties ventrales et les appendices", "exp": "L’enroulement rapprochait céphalon et pygidium, formant une capsule défensive.", "src": ["Museum of the Earth — Trilobites", "https://www.museumoftheearth.org/ny-rocks/devonian-sea-life/taxon/trilobites"]},
 {"id": "TRI-19", "site": "TRI", "diff": "avancé", "q": "Tous les trilobites vivaient-ils de la même manière sur le fond ?", "choix": ["Oui, tous étaient des prédateurs identiques", "Oui, tous étaient fixés", "Non, car la moitié vivait sur terre", "Non, certains rampaient, fouissaient, nageaient ou occupaient différentes profondeurs"], "r": "Non, certains rampaient, fouissaient, nageaient ou occupaient différentes profondeurs", "exp": "Le groupe a duré environ 270 millions d’années et occupé de nombreuses niches marines.", "src": ["American Museum of Natural History — Trilobites", "https://www.amnh.org/research/paleontology/collections/fossil-invertebrate-collection/trilobite-website"]},
 {"id": "TRI-20", "site": "TRI", "diff": "intermédiaire", "q": "Quel trio présente les ornements les plus spectaculaires du pack ?", "choix": ["Paradoxides, Drotops et Olenoides uniquement", "Olenoides, Paradoxides et aucun autre", "Paradoxides, Olenoides et Drotops uniquement", "Dicranurus, Walliserops et Trinucleus"], "r": "Dicranurus, Walliserops et Trinucleus", "exp": "Cornes, trident et frange perforée rendent ces trois formes immédiatement distinctes.", "src": ["American Museum of Natural History — Trilobites", "https://www.amnh.org/research/paleontology/collections/fossil-invertebrate-collection/trilobite-website"]},
 {"id": "BURG-01", "site": "BURG", "diff": "facile", "q": "À quelle période géologique appartient principalement le Schiste de Burgess ?", "choix": ["Au Dévonien supérieur", "Au Jurassique supérieur", "Au Cambrien moyen", "Au Paléogène"], "r": "Au Cambrien moyen", "exp": "Le gisement emblématique du Schiste de Burgess date du Cambrien moyen, il y a environ 508 millions d’années.", "src": ["Royal Ontario Museum — Burgess Shale", "https://burgess-shale.rom.on.ca/"]},
 {"id": "BURG-02", "site": "BURG", "diff": "facile", "q": "Dans quel pays se situe le gisement classique du Schiste de Burgess ?", "choix": ["En Afrique du Sud", "Au Canada", "En Chine", "En Allemagne"], "r": "Au Canada", "exp": "Le site classique se trouve dans les Rocheuses canadiennes, en Colombie-Britannique.", "src": ["Royal Ontario Museum — Burgess Shale", "https://burgess-shale.rom.on.ca/"]},
 {"id": "BURG-03", "site": "BURG", "diff": "intermédiaire", "q": "Pourquoi le Schiste de Burgess est-il particulièrement précieux pour les paléontologues ?", "choix": ["Il préserve uniquement des empreintes de pas", "Il contient surtout des os de dinosaures complets", "Il est le plus ancien gisement terrestre connu", "Il conserve de nombreux tissus mous"], "r": "Il conserve de nombreux tissus mous", "exp": "La conservation exceptionnelle des parties molles révèle des anatomies rarement fossilisées.", "src": ["Royal Ontario Museum — Discoveries", "https://burgess-shale.rom.on.ca/history/discoveries/"]},
 {"id": "BURG-04", "site": "BURG", "diff": "facile", "q": "Quelle créature du pack possédait cinq yeux et une trompe frontale terminée par une pince ?", "choix": ["Wiwaxia corrugata", "Opabinia regalis", "Pikaia gracilens", "Marrella splendens"], "r": "Opabinia regalis", "exp": "Opabinia se distingue par ses cinq yeux et son proboscis préhensile.", "src": ["Opabinia — Encyclopaedia Britannica", "https://www.britannica.com/animal/Opabinia"]},
 {"id": "BURG-05", "site": "BURG", "diff": "facile", "q": "Quelle créature était un grand prédateur nageur muni d’appendices frontaux épineux ?", "choix": ["Pikaia gracilens", "Hallucigenia sparsa", "Marrella splendens", "Anomalocaris canadensis"], "r": "Anomalocaris canadensis", "exp": "Anomalocaris utilisait ses appendices frontaux pour saisir des proies.", "src": ["Anomalocaris — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/anomalocaris-canadensis/"]},
 {"id": "BURG-06", "site": "BURG", "diff": "intermédiaire", "q": "Quelle affirmation décrit le mieux la bouche d’Anomalocaris ?", "choix": ["Un bec corné comparable à celui d’un perroquet", "Une mâchoire osseuse à dents remplacées en continu", "Une trompe filtrante sans pièces dures", "Une structure circulaire composée de plaques"], "r": "Une structure circulaire composée de plaques", "exp": "Sa bouche était formée d’un anneau de plaques, souvent appelé cône oral.", "src": ["Anomalocaris — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/anomalocaris-canadensis/"]},
 {"id": "BURG-07", "site": "BURG", "diff": "facile", "q": "Quelle créature a longtemps été reconstruite à l’envers, ses épines ayant été prises pour des pattes ?", "choix": ["Marrella splendens", "Anomalocaris canadensis", "Hallucigenia sparsa", "Pikaia gracilens"], "r": "Hallucigenia sparsa", "exp": "Les premières reconstructions plaçaient les épines ventralement; de meilleurs fossiles ont corrigé cette erreur.", "src": ["Hallucigenia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/hallucigenia-sparsa/"]},
 {"id": "BURG-08", "site": "BURG", "diff": "intermédiaire", "q": "Quel groupe vivant est le plus proche d’Hallucigenia ?", "choix": ["Les onychophores ou vers de velours", "Les mollusques bivalves", "Les échinodermes", "Les vertébrés"], "r": "Les onychophores ou vers de velours", "exp": "Hallucigenia est généralement considérée comme un lobopodien proche de la lignée des onychophores.", "src": ["Hallucigenia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/hallucigenia-sparsa/"]},
 {"id": "BURG-09", "site": "BURG", "diff": "facile", "q": "Quelle créature possédait deux grandes épines céphaliques recourbées et un corps d’arthropode délicat ?", "choix": ["Marrella splendens", "Opabinia regalis", "Pikaia gracilens", "Wiwaxia corrugata"], "r": "Marrella splendens", "exp": "Marrella est un petit arthropode à bouclier céphalique très caractéristique.", "src": ["Marrella — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/marrella-splendens/"]},
 {"id": "BURG-10", "site": "BURG", "diff": "intermédiaire", "q": "Pourquoi Marrella est-elle importante dans l’histoire du Schiste de Burgess ?", "choix": ["C’est un dinosaure nain exceptionnel", "C’est le fossile le plus abondant du gisement classique", "C’est le seul vertébré du gisement", "C’est le plus grand animal du Cambrien"], "r": "C’est le fossile le plus abondant du gisement classique", "exp": "Des milliers de spécimens de Marrella ont été recueillis, ce qui permet d’étudier finement son anatomie.", "src": ["Marrella — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/marrella-splendens/"]},
 {"id": "BURG-11", "site": "BURG", "diff": "facile", "q": "Quelle créature était couverte de plaques et d’épines, donnant une silhouette de petit animal cuirassé ?", "choix": ["Marrella splendens", "Wiwaxia corrugata", "Opabinia regalis", "Pikaia gracilens"], "r": "Wiwaxia corrugata", "exp": "Wiwaxia portait des sclérites en forme d’écailles et de longues épines dorsales.", "src": ["Wiwaxia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/wiwaxia-corrugata/"]},
 {"id": "BURG-12", "site": "BURG", "diff": "avancé", "q": "Quel élément de Wiwaxia alimente les discussions sur ses affinités avec les mollusques ?", "choix": ["Des nageoires rayonnées", "Des vertèbres articulées", "Une radula ou structure buccale râpeuse", "Un squelette interne calcaire"], "r": "Une radula ou structure buccale râpeuse", "exp": "Sa structure buccale ressemblant à une radula est un argument important, même si ses relations restent discutées.", "src": ["Wiwaxia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/wiwaxia-corrugata/"]},
 {"id": "BURG-13", "site": "BURG", "diff": "facile", "q": "Quelle créature du pack est souvent présentée comme un chordé très basal ?", "choix": ["Anomalocaris canadensis", "Wiwaxia corrugata", "Pikaia gracilens", "Hallucigenia sparsa"], "r": "Pikaia gracilens", "exp": "Pikaia possède une structure longitudinale interprétée comme une notochorde et appartient aux chordés basaux.", "src": ["Pikaia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/pikaia-gracilens/"]},
 {"id": "BURG-14", "site": "BURG", "diff": "intermédiaire", "q": "Quelle structure de Pikaia annonce le plan d’organisation des chordés ?", "choix": ["La notochorde", "Le cône oral", "Le trident céphalique", "La carapace bivalve"], "r": "La notochorde", "exp": "La notochorde est une tige de soutien longitudinale caractéristique des chordés.", "src": ["Pikaia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/pikaia-gracilens/"]},
 {"id": "BURG-15", "site": "BURG", "diff": "intermédiaire", "q": "Quelle formulation est la plus rigoureuse au sujet de l’« explosion cambrienne » ?", "choix": ["L’apparition des premiers organismes vivants", "Un événement d’une seule journée", "L’extinction de tous les animaux précambriens", "Une diversification rapide à l’échelle géologique, pas une apparition instantanée de toute vie animale"], "r": "Une diversification rapide à l’échelle géologique, pas une apparition instantanée de toute vie animale", "exp": "Le terme désigne une diversification majeure des plans corporels sur plusieurs millions d’années.", "src": ["Smithsonian — Cambrian Period", "https://naturalhistory.si.edu/education/teaching-resources/anthropology-and-social-studies/cambrian-period"]},
 {"id": "BURG-16", "site": "BURG", "diff": "intermédiaire", "q": "Le Schiste de Burgess représente principalement quel type de milieu ?", "choix": ["Un désert de dunes", "Un lac glaciaire continental", "Une forêt tropicale terrestre", "Un milieu marin"], "r": "Un milieu marin", "exp": "Les organismes vivaient dans une mer cambrienne, au pied d’un escarpement sous-marin.", "src": ["Royal Ontario Museum — Burgess Shale", "https://burgess-shale.rom.on.ca/"]},
 {"id": "BURG-17", "site": "BURG", "diff": "avancé", "q": "Pourquoi ne faut-il pas représenter tous les animaux de Burgess comme s’ils nageaient en pleine eau ?", "choix": ["Aucun animal cambrien ne savait nager", "Beaucoup vivaient sur ou près du fond marin", "Tous étaient fixés à des arbres", "L’eau n’existait pas encore sous forme liquide"], "r": "Beaucoup vivaient sur ou près du fond marin", "exp": "Le gisement mélange des nageurs, des marcheurs benthiques et des organismes vivant au contact du substrat.", "src": ["Royal Ontario Museum — Burgess Shale", "https://burgess-shale.rom.on.ca/"]},
 {"id": "BURG-18", "site": "BURG", "diff": "intermédiaire", "q": "Quel duo oppose le mieux un grand nageur prédateur et un petit animal vermiforme cuirassé ?", "choix": ["Marrella et Pikaia", "Anomalocaris et Hallucigenia", "Wiwaxia et Opabinia", "Pikaia et Marrella"], "r": "Anomalocaris et Hallucigenia", "exp": "Anomalocaris était un grand radiodonte nageur; Hallucigenia, un petit lobopodien à épines.", "src": ["Royal Ontario Museum — Burgess Shale", "https://burgess-shale.rom.on.ca/"]},
 {"id": "BURG-19", "site": "BURG", "diff": "avancé", "q": "Pourquoi les couleurs exactes des animaux de Burgess sont-elles généralement inconnues ?", "choix": ["Les animaux vivaient sans lumière et sans pigments", "Les couleurs ont été décrites par Charles Walcott", "Tous les fossiles étaient naturellement incolores", "Les pigments originaux sont rarement conservés ou identifiables"], "r": "Les pigments originaux sont rarement conservés ou identifiables", "exp": "Les reconstructions colorées sont plausibles mais restent largement spéculatives.", "src": ["Royal Ontario Museum — Burgess Shale", "https://burgess-shale.rom.on.ca/"]},
 {"id": "BURG-20", "site": "BURG", "diff": "intermédiaire", "q": "Quel comportement est le plus plausible pour Pikaia ?", "choix": ["Nager près du fond par ondulations du corps", "Brouter avec un bec corné", "Creuser avec de grandes pinces", "Voler au-dessus de la mer"], "r": "Nager près du fond par ondulations du corps", "exp": "Son corps comprimé et segmenté suggère une nage ondulatoire proche du fond.", "src": ["Pikaia — Royal Ontario Museum", "https://burgess-shale.rom.on.ca/fossils/pikaia-gracilens/"]},
 {"id": "CEP-01", "site": "CEP", "diff": "facile", "q": "À quel embranchement appartiennent les céphalopodes ?", "choix": ["Aux échinodermes", "Aux mollusques", "Aux arthropodes", "Aux vertébrés"], "r": "Aux mollusques", "exp": "Poulpes, calmars, seiches, nautiles et ammonites sont des mollusques céphalopodes.", "src": ["Britannica — Cephalopod", "https://www.britannica.com/animal/cephalopod"]},
 {"id": "CEP-02", "site": "CEP", "diff": "intermédiaire", "q": "Quel trait commun caractérise le plan corporel des céphalopodes ?", "choix": ["Le pied ancestral est transformé en bras et en entonnoir autour de la tête", "Une carapace de chitine", "Six pattes articulées", "Une colonne vertébrale"], "r": "Le pied ancestral est transformé en bras et en entonnoir autour de la tête", "exp": "Le nom signifie littéralement « pieds sur la tête ».", "src": ["Britannica — Cephalopod", "https://www.britannica.com/animal/cephalopod"]},
 {"id": "CEP-03", "site": "CEP", "diff": "facile", "q": "Quel animal du pack avait une immense coquille droite ?", "choix": ["Vampyronassa rhodanica", "Nipponites mirabilis", "Keuppia levante", "Endoceras giganteum"], "r": "Endoceras giganteum", "exp": "Endoceras est un nautiloïde orthocône de l’Ordovicien.", "src": ["Endoceras — Wikipedia", "https://en.wikipedia.org/wiki/Endoceras"]},
 {"id": "CEP-04", "site": "CEP", "diff": "intermédiaire", "q": "À quoi servaient les chambres de la coquille d’Endoceras ?", "choix": ["À produire des œufs dans chaque chambre", "À contrôler la flottabilité, tandis que l’animal occupait la chambre terminale", "À loger plusieurs individus indépendants", "À digérer les proies"], "r": "À contrôler la flottabilité, tandis que l’animal occupait la chambre terminale", "exp": "Comme chez d’autres céphalopodes à coquille, un siphon régulait les fluides et les gaz.", "src": ["Endoceras — Wikipedia", "https://en.wikipedia.org/wiki/Endoceras"]},
 {"id": "CEP-05", "site": "CEP", "diff": "avancé", "q": "Pourquoi la posture exacte d’un très grand Endoceras reste-t-elle discutée ?", "choix": ["Il possédait des ailes", "La répartition des dépôts internes et la flottabilité d’une longue coquille sont complexes à modéliser", "Il vivait sur terre", "Aucune coquille n’a jamais été trouvée"], "r": "La répartition des dépôts internes et la flottabilité d’une longue coquille sont complexes à modéliser", "exp": "Les reconstructions horizontales, obliques ou plus verticales dépendent de l’équilibre hydrostatique estimé.", "src": ["Endoceras — Wikipedia", "https://en.wikipedia.org/wiki/Endoceras"]},
 {"id": "CEP-06", "site": "CEP", "diff": "facile", "q": "Quelle ammonite avait une coquille enroulée de façon irrégulière et apparemment chaotique ?", "choix": ["Diplomoceras maximum", "Belemnotheutis antiquus", "Nipponites mirabilis", "Endoceras giganteum"], "r": "Nipponites mirabilis", "exp": "Nipponites est une ammonite hétéromorphe à enroulement complexe.", "src": ["Nipponites — Wikipedia", "https://en.wikipedia.org/wiki/Nipponites"]},
 {"id": "CEP-07", "site": "CEP", "diff": "intermédiaire", "q": "La coquille de Nipponites était-elle un tube mou noué ?", "choix": ["Oui, un intestin externe", "Oui, un tentacule calcifié", "Non, une colonne vertébrale", "Non, c’était une coquille rigide cloisonnée selon un développement régulier complexe"], "r": "Non, c’était une coquille rigide cloisonnée selon un développement régulier complexe", "exp": "L’aspect désordonné suit une croissance géométrique déterminée.", "src": ["Nipponites — Wikipedia", "https://en.wikipedia.org/wiki/Nipponites"]},
 {"id": "CEP-08", "site": "CEP", "diff": "facile", "q": "Quelle ammonite géante avait une coquille en forme de trombone ou de crosse allongée ?", "choix": ["Nipponites mirabilis", "Diplomoceras maximum", "Keuppia levante", "Vampyronassa rhodanica"], "r": "Diplomoceras maximum", "exp": "Diplomoceras est un hétéromorphe du Crétacé terminal antarctique.", "src": ["Diplomoceras — Wikipedia", "https://en.wikipedia.org/wiki/Diplomoceras"]},
 {"id": "CEP-09", "site": "CEP", "diff": "intermédiaire", "q": "Quel avantage général une coquille cloisonnée donnait-elle aux ammonites ?", "choix": ["Le vol plané", "La production de venin", "Le contrôle de la flottabilité", "La respiration aérienne sur terre"], "r": "Le contrôle de la flottabilité", "exp": "Les chambres reliées par un siphon permettaient de régler la densité globale.", "src": ["Britannica — Ammonoid", "https://www.britannica.com/animal/ammonoid"]},
 {"id": "CEP-10", "site": "CEP", "diff": "facile", "q": "Quel animal ressemblait à un calmar mais possédait un rostre interne de bélemnoïde ?", "choix": ["Belemnotheutis antiquus", "Nipponites mirabilis", "Keuppia levante", "Endoceras giganteum"], "r": "Belemnotheutis antiquus", "exp": "Belemnotheutis est un coleoïde jurassique connu avec des tissus mous.", "src": ["Belemnotheutis — Wikipedia", "https://en.wikipedia.org/wiki/Belemnotheutis"]},
 {"id": "CEP-11", "site": "CEP", "diff": "intermédiaire", "q": "Quel organe a été préservé chez certains Belemnotheutis et utilisé historiquement ?", "choix": ["Des poumons", "Des fanons", "Un placenta", "Une poche à encre"], "r": "Une poche à encre", "exp": "L’encre fossile a même servi à produire des dessins au XIXe siècle.", "src": ["Belemnotheutis — Wikipedia", "https://en.wikipedia.org/wiki/Belemnotheutis"]},
 {"id": "CEP-12", "site": "CEP", "diff": "facile", "q": "Quel animal jurassique appartenait à la lignée des vampyromorphes ?", "choix": ["Vampyronassa rhodanica", "Keuppia levante", "Endoceras giganteum", "Diplomoceras maximum"], "r": "Vampyronassa rhodanica", "exp": "Vampyronassa est proche du vampire des abysses moderne.", "src": ["Vampyronassa — Scientific Reports", "https://www.nature.com/articles/s41598-022-12269-3"]},
 {"id": "CEP-13", "site": "CEP", "diff": "intermédiaire", "q": "Quel trait de Vampyronassa suggère un mode de vie prédateur actif différent du vampire des abysses actuel ?", "choix": ["Des sabots", "Des fanons filtrants", "Une coquille externe géante", "Des ventouses robustes adaptées à saisir des proies"], "r": "Des ventouses robustes adaptées à saisir des proies", "exp": "L’anatomie des bras indique probablement une capture active de petites proies.", "src": ["Vampyronassa — Scientific Reports", "https://www.nature.com/articles/s41598-022-12269-3"]},
 {"id": "CEP-14", "site": "CEP", "diff": "facile", "q": "Quel animal du pack est un véritable octopode fossile du Crétacé ?", "choix": ["Belemnotheutis antiquus", "Nipponites mirabilis", "Keuppia levante", "Endoceras giganteum"], "r": "Keuppia levante", "exp": "Keuppia est connu grâce aux calcaires à conservation exceptionnelle du Liban.", "src": ["Keuppia — Wikipedia", "https://en.wikipedia.org/wiki/Keuppia"]},
 {"id": "CEP-15", "site": "CEP", "diff": "intermédiaire", "q": "Pourquoi les fossiles de poulpes sont-ils rares ?", "choix": ["Leurs os se dissolvent toujours dans l’air", "Ils sont plus récents que les humains", "Leur corps est presque entièrement mou et se décompose rapidement", "Ils ne vivent jamais dans les sédiments"], "r": "Leur corps est presque entièrement mou et se décompose rapidement", "exp": "Il faut un enfouissement rapide et des conditions anoxiques exceptionnelles pour conserver leurs contours.", "src": ["Keuppia — Wikipedia", "https://en.wikipedia.org/wiki/Keuppia"]},
 {"id": "CEP-16", "site": "CEP", "diff": "avancé", "q": "Quel fossile longtemps présenté comme le plus ancien poulpe a récemment été réinterprété comme un nautiloïde ?", "choix": ["Keuppia levante", "Nipponites mirabilis", "Vampyronassa rhodanica", "Pohlsepia mazonensis"], "r": "Pohlsepia mazonensis", "exp": "De nouvelles données tomographiques ont révélé des caractères de nautiloïde, illustrant la difficulté des fossiles mous.", "src": ["Pohlsepia reinterpretation — Proceedings B", "https://royalsocietypublishing.org/rspb/article/293/2068/20252369/481251/Synchrotron-data-reveal-nautiloid-characters-in"]},
 {"id": "CEP-17", "site": "CEP", "diff": "intermédiaire", "q": "Quel duo possède une coquille externe hétéromorphe ?", "choix": ["Belemnotheutis et Keuppia", "Endoceras et Keuppia", "Vampyronassa et Keuppia", "Nipponites et Diplomoceras"], "r": "Nipponites et Diplomoceras", "exp": "Les deux sont des ammonites dont l’enroulement s’écarte de la spirale plane classique.", "src": ["Britannica — Ammonoid", "https://www.britannica.com/animal/ammonoid"]},
 {"id": "CEP-18", "site": "CEP", "diff": "intermédiaire", "q": "Quel duo représente des coleoïdes à coquille interne ou très réduite ?", "choix": ["Nipponites et Endoceras", "Diplomoceras et Nipponites", "Belemnotheutis et Vampyronassa", "Endoceras et Diplomoceras"], "r": "Belemnotheutis et Vampyronassa", "exp": "Les coleoïdes comprennent les lignées des calmars, seiches, vampires et poulpes.", "src": ["Britannica — Cephalopod", "https://www.britannica.com/animal/cephalopod"]},
 {"id": "CEP-19", "site": "CEP", "diff": "avancé", "q": "Pourquoi les parties molles des ammonites doivent-elles être reconstruites prudemment ?", "choix": ["Les coquilles sont abondantes, mais les bras, yeux et tissus sont rarement conservés", "Les ammonites n’avaient aucun tissu mou", "Les coquilles appartenaient à des plantes", "Tous les détails sont connus par photographie"], "r": "Les coquilles sont abondantes, mais les bras, yeux et tissus sont rarement conservés", "exp": "Les analogies avec nautiles et coleoïdes donnent des hypothèses, pas une image complète certaine.", "src": ["Britannica — Ammonoid", "https://www.britannica.com/animal/ammonoid"]},
 {"id": "CEP-20", "site": "CEP", "diff": "avancé", "q": "Quelle leçon donne la diversité des coquilles de ce pack ?", "choix": ["Toutes les coquilles évoluent vers une sphère", "Les céphalopodes descendent des vertébrés", "Une coquille peut être modifiée en de nombreuses architectures tout en conservant une fonction hydrostatique", "La forme n’a aucun lien avec la locomotion"], "r": "Une coquille peut être modifiée en de nombreuses architectures tout en conservant une fonction hydrostatique", "exp": "Orthocônes et hétéromorphes montrent une forte expérimentation géométrique.", "src": ["Britannica — Cephalopod", "https://www.britannica.com/animal/cephalopod"]},
 {"id": "CHO-01", "site": "CHO", "diff": "facile", "q": "Quel trait général définit les chondrichthyens ?", "choix": ["L’absence de mâchoires chez toutes les espèces", "Des plumes sur tout le corps", "Un squelette principalement cartilagineux", "Un squelette fait uniquement de coquille"], "r": "Un squelette principalement cartilagineux", "exp": "Requins, raies et chimères appartiennent aux poissons cartilagineux.", "src": ["Palaeozoic chondrichthyan fossil record", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10827434/"]},
 {"id": "CHO-02", "site": "CHO", "diff": "intermédiaire", "q": "Pourquoi leur registre fossile est-il souvent incomplet ?", "choix": ["Ils vivaient uniquement dans l’air", "Tous les fossiles ont fondu", "Ils ne possédaient aucune partie dure", "Le cartilage se fossilise moins facilement que l’os minéralisé"], "r": "Le cartilage se fossilise moins facilement que l’os minéralisé", "exp": "Dents, épines et éléments calcifiés sont plus souvent préservés que les squelettes complets.", "src": ["Palaeozoic chondrichthyan fossil record", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10827434/"]},
 {"id": "CHO-03", "site": "CHO", "diff": "facile", "q": "Le pack représente-t-il une suite linéaire menant au requin blanc moderne ?", "choix": ["Oui, chaque espèce est l’ancêtre direct de la suivante", "Non, il présente plusieurs branches divergentes", "Oui, toutes sont du même genre", "Non, car aucune n’est un poisson"], "r": "Non, il présente plusieurs branches divergentes", "exp": "Les chondrichthyens paléozoïques formaient un arbre ramifié avec de nombreuses lignées éteintes.", "src": ["Palaeozoic chondrichthyan fossil record", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10827434/"]},
 {"id": "CHO-04", "site": "CHO", "diff": "facile", "q": "Quel animal est l’un des plus anciens chondrichthyens articulés connus ?", "choix": ["Helicoprion davisii", "Belantsea montana", "Doliodus problematicus", "Edestus heinrichi"], "r": "Doliodus problematicus", "exp": "Doliodus, du Dévonien inférieur, combine des traits de chondrichthyens basaux.", "src": ["Doliodus — Wikipedia", "https://en.wikipedia.org/wiki/Doliodus"]},
 {"id": "CHO-05", "site": "CHO", "diff": "intermédiaire", "q": "Quel trait inhabituel portait Doliodus ?", "choix": ["Une coquille spiralée", "Une trompe préhensile", "Des doigts dans les nageoires", "Plusieurs épines paires devant les nageoires"], "r": "Plusieurs épines paires devant les nageoires", "exp": "Ces épines rappellent certains « acanthodiens » et éclairent l’assemblage du plan corporel des chondrichthyens.", "src": ["Doliodus — Wikipedia", "https://en.wikipedia.org/wiki/Doliodus"]},
 {"id": "CHO-06", "site": "CHO", "diff": "facile", "q": "Quel animal mâle portait une structure dorsale en forme d’enclume ou de brosse ?", "choix": ["Helicoprion davisii", "Iniopteryx rushlaui", "Edestus heinrichi", "Stethacanthus altonensis"], "r": "Stethacanthus altonensis", "exp": "Le complexe épine-brosse de Stethacanthus est l’un des ornements les plus étranges des poissons fossiles.", "src": ["Stethacanthus — Wikipedia", "https://en.wikipedia.org/wiki/Stethacanthus"]},
 {"id": "CHO-07", "site": "CHO", "diff": "avancé", "q": "Pourquoi ne faut-il pas donner la « brosse » à tous les Stethacanthus ?", "choix": ["Elle n’existait que chez les embryons", "Elle était une plante fixée sur le dos", "Tous les fossiles ont perdu leur tête", "Elle est surtout connue chez les mâles et reflète un dimorphisme sexuel"], "r": "Elle est surtout connue chez les mâles et reflète un dimorphisme sexuel", "exp": "Les spécimens femelles ou immatures ne présentent pas nécessairement ce complexe.", "src": ["Stethacanthus — Wikipedia", "https://en.wikipedia.org/wiki/Stethacanthus"]},
 {"id": "CHO-08", "site": "CHO", "diff": "facile", "q": "Quel petit holocephale avait de grands yeux et des nageoires pectorales haut placées ?", "choix": ["Doliodus problematicus", "Helicoprion davisii", "Iniopteryx rushlaui", "Belantsea montana"], "r": "Iniopteryx rushlaui", "exp": "Iniopteryx avait une silhouette compacte et presque ailée.", "src": ["Iniopteryx — Wikipedia", "https://en.wikipedia.org/wiki/Iniopteryx"]},
 {"id": "CHO-09", "site": "CHO", "diff": "intermédiaire", "q": "À quel groupe vivant les holocephales sont-ils aujourd’hui représentés ?", "choix": ["Aux chimères", "Aux thons", "Aux baleines", "Aux crocodiles"], "r": "Aux chimères", "exp": "Les chimères sont la branche actuelle des Holocephali.", "src": ["Smithsonian Ocean — Chimaeras", "https://ocean.si.edu/ocean-life/sharks-rays/chimaeras"]},
 {"id": "CHO-10", "site": "CHO", "diff": "facile", "q": "Quel animal avait un corps très haut et comprimé, presque en forme de feuille ?", "choix": ["Belantsea montana", "Edestus heinrichi", "Doliodus problematicus", "Stethacanthus altonensis"], "r": "Belantsea montana", "exp": "Belantsea est un pétalodonte au profil profond et à petite queue.", "src": ["Belantsea — Wikipedia", "https://en.wikipedia.org/wiki/Belantsea"]},
 {"id": "CHO-11", "site": "CHO", "diff": "intermédiaire", "q": "Quel type d’alimentation suggèrent les dents de Belantsea ?", "choix": ["La découpe avec une spirale dentaire", "Le broyage de proies dures ou d’aliments résistants", "La filtration par fanons", "Le broutage de feuilles terrestres"], "r": "Le broyage de proies dures ou d’aliments résistants", "exp": "Ses dents larges et triangulaires étaient adaptées à écraser plutôt qu’à trancher.", "src": ["Belantsea — Wikipedia", "https://en.wikipedia.org/wiki/Belantsea"]},
 {"id": "CHO-12", "site": "CHO", "diff": "facile", "q": "Quel animal possédait une spirale de dents dans la mandibule inférieure ?", "choix": ["Helicoprion davisii", "Iniopteryx rushlaui", "Doliodus problematicus", "Stethacanthus altonensis"], "r": "Helicoprion davisii", "exp": "Le célèbre « tourbillon » dentaire se trouvait dans la mâchoire inférieure.", "src": ["Australian Museum — Helicoprion", "https://australian.museum/learn/animals/fishes/helicoprion/"]},
 {"id": "CHO-13", "site": "CHO", "diff": "intermédiaire", "q": "Quelle ancienne reconstruction d’Helicoprion est incorrecte ?", "choix": ["Un poisson cartilagineux marin", "Une scie dentaire externe enroulée sur le museau", "Une spirale intégrée à la mâchoire inférieure", "Des dents remplacées en continu dans le tourbillon"], "r": "Une scie dentaire externe enroulée sur le museau", "exp": "La tomographie d’un spécimen a permis de replacer la spirale dans la mandibule.", "src": ["Australian Museum — Helicoprion", "https://australian.museum/learn/animals/fishes/helicoprion/"]},
 {"id": "CHO-14", "site": "CHO", "diff": "avancé", "q": "Helicoprion était-il un requin moderne au sens strict ?", "choix": ["Non, un mammifère marin", "Oui, un grand requin blanc", "Oui, une raie actuelle", "Non, c’était un eugénéodonte, probablement plus proche des holocephales"], "r": "Non, c’était un eugénéodonte, probablement plus proche des holocephales", "exp": "Le mot « requin » est souvent utilisé informellement, mais sa position est plus basale et particulière.", "src": ["Helicoprion — Wikipedia", "https://en.wikipedia.org/wiki/Helicoprion"]},
 {"id": "CHO-15", "site": "CHO", "diff": "facile", "q": "Quel animal possédait deux lames dentaires médianes comparées à des ciseaux ?", "choix": ["Belantsea montana", "Doliodus problematicus", "Iniopteryx rushlaui", "Edestus heinrichi"], "r": "Edestus heinrichi", "exp": "Edestus conservait les anciennes dents, formant des rangées saillantes dans les mâchoires.", "src": ["Edestus — Scientific Reports", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6726245/"]},
 {"id": "CHO-16", "site": "CHO", "diff": "intermédiaire", "q": "Comment Edestus remplaçait-il ses dents ?", "choix": ["Les dents repoussaient dans l’estomac", "Les nouvelles dents poussaient à l’arrière et repoussaient les anciennes vers l’avant", "Toutes les dents tombaient simultanément", "Il n’avait pas de nouvelles dents"], "r": "Les nouvelles dents poussaient à l’arrière et repoussaient les anciennes vers l’avant", "exp": "L’absence de chute normale produisait des lames dentaires continues.", "src": ["Edestus — Scientific Reports", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6726245/"]},
 {"id": "CHO-17", "site": "CHO", "diff": "avancé", "q": "Pourquoi le corps d’Edestus doit-il être reconstruit avec prudence ?", "choix": ["Les mâchoires et dents sont mieux connues que le squelette complet", "Il est connu par une momie complète", "Il n’existe aucun fossile dentaire", "Son corps était fait de tissu végétal"], "r": "Les mâchoires et dents sont mieux connues que le squelette complet", "exp": "Comme beaucoup de chondrichthyens, le squelette cartilagineux est rarement conservé en entier.", "src": ["Edestus — Scientific Reports", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6726245/"]},
 {"id": "CHO-18", "site": "CHO", "diff": "intermédiaire", "q": "Quel duo illustre deux dispositifs dentaires très différents chez des eugénéodontes ?", "choix": ["Iniopteryx et Stethacanthus", "Belantsea et Stethacanthus", "Helicoprion et Edestus", "Doliodus et Iniopteryx"], "r": "Helicoprion et Edestus", "exp": "Helicoprion a un tourbillon dentaire; Edestus, des lames saillantes.", "src": ["Edestus — Scientific Reports", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6726245/"]},
 {"id": "CHO-19", "site": "CHO", "diff": "avancé", "q": "Quelle leçon évolutive donne ce pack ?", "choix": ["Les poissons cartilagineux anciens exploraient une diversité de formes bien supérieure au stéréotype du requin fuselé", "La cartilagine a empêché toute diversification", "Tous les chondrichthyens ont toujours été identiques", "Les requins descendent des baleines"], "r": "Les poissons cartilagineux anciens exploraient une diversité de formes bien supérieure au stéréotype du requin fuselé", "exp": "Ornements, corps comprimés, grandes nageoires et appareils dentaires spécialisés montrent une forte disparité.", "src": ["Palaeozoic chondrichthyan fossil record", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10827434/"]},
 {"id": "CHO-20", "site": "CHO", "diff": "intermédiaire", "q": "Quel animal du pack est le plus proche du plan corporel d’une chimère plutôt que d’un requin classique ?", "choix": ["Edestus heinrichi", "Stethacanthus altonensis", "Iniopteryx rushlaui", "Doliodus problematicus"], "r": "Iniopteryx rushlaui", "exp": "Iniopteryx est un holocephale, branche qui comprend les chimères actuelles.", "src": ["Iniopteryx — Wikipedia", "https://en.wikipedia.org/wiki/Iniopteryx"]},
 {"id": "HUN-01", "site": "HUN", "diff": "facile", "q": "Dans quel pays se trouve le gisement du Hunsrück ?", "choix": ["En Chine", "En Allemagne", "En Égypte", "Au Brésil"], "r": "En Allemagne", "exp": "Le Hunsrück Slate affleure dans l’ouest de l’Allemagne.", "src": ["The Hunsrück Slate Konservat-Lagerstätte", "https://ore.exeter.ac.uk/ndownloader/files/56832407"]},
 {"id": "HUN-02", "site": "HUN", "diff": "facile", "q": "À quelle période appartient le Hunsrück Slate ?", "choix": ["Au Dévonien inférieur", "Au Crétacé supérieur", "À l’Édiacarien", "Au Trias supérieur"], "r": "Au Dévonien inférieur", "exp": "Le gisement date du début du Dévonien, vers 407 millions d’années.", "src": ["The Hunsrück Slate Konservat-Lagerstätte", "https://ore.exeter.ac.uk/ndownloader/files/56832407"]},
 {"id": "HUN-03", "site": "HUN", "diff": "intermédiaire", "q": "Quel processus minéral rend de nombreux fossiles du Hunsrück spectaculaires aux rayons X ?", "choix": ["La congélation", "La pyritisation", "La silicification par lave", "La carbonisation en diamant"], "r": "La pyritisation", "exp": "La pyrite a remplacé ou souligné des tissus et appendices délicats.", "src": ["The Hunsrück Slate Konservat-Lagerstätte", "https://ore.exeter.ac.uk/ndownloader/files/56832407"]},
 {"id": "HUN-04", "site": "HUN", "diff": "intermédiaire", "q": "Quel type d’environnement est documenté par le Hunsrück Slate ?", "choix": ["Une forêt désertique", "Une savane à mammifères", "Un bassin marin", "Une calotte glaciaire"], "r": "Un bassin marin", "exp": "La faune comprend poissons, arthropodes, échinodermes et autres organismes marins.", "src": ["The Hunsrück Slate Konservat-Lagerstätte", "https://ore.exeter.ac.uk/ndownloader/files/56832407"]},
 {"id": "HUN-05", "site": "HUN", "diff": "facile", "q": "Quelle créature était une grande araignée de mer à longues pattes adaptées à la nage ?", "choix": ["Mimetaster hexagonalis", "Gemuendina stuertzi", "Palaeoisopus problematicus", "Drepanaspis gemuendenensis"], "r": "Palaeoisopus problematicus", "exp": "Palaeoisopus est un pycnogonide robuste, très différent des minuscules formes modernes courantes.", "src": ["Palaeoisopus — Wikipedia", "https://en.wikipedia.org/wiki/Palaeoisopus"]},
 {"id": "HUN-06", "site": "HUN", "diff": "intermédiaire", "q": "Pourquoi Palaeoisopus ne doit-elle pas être représentée comme une araignée terrestre velue ?", "choix": ["Elle n’avait aucune patte", "Elle était un insecte volant", "C’est un pycnogonide marin avec une anatomie propre aux araignées de mer", "Elle possédait des poumons de mammifère"], "r": "C’est un pycnogonide marin avec une anatomie propre aux araignées de mer", "exp": "La ressemblance avec une araignée est superficielle et le mode de vie était entièrement marin.", "src": ["Palaeoisopus — Wikipedia", "https://en.wikipedia.org/wiki/Palaeoisopus"]},
 {"id": "HUN-07", "site": "HUN", "diff": "facile", "q": "Quelle créature possédait un bouclier céphalique presque étoilé avec de longues épines ?", "choix": ["Schinderhannes bartelsi", "Cheloniellon calmani", "Mimetaster hexagonalis", "Drepanaspis gemuendenensis"], "r": "Mimetaster hexagonalis", "exp": "Mimetaster est un marrellomorphe à silhouette rayonnante.", "src": ["Mimetaster — Bundenbach Fossil Gallery", "https://bundenbachfossil.com/arthropods.html"]},
 {"id": "HUN-08", "site": "HUN", "diff": "intermédiaire", "q": "À quel grand groupe appartient Mimetaster ?", "choix": ["Aux arthropodes marrellomorphes", "Aux échinodermes", "Aux mollusques", "Aux vertébrés"], "r": "Aux arthropodes marrellomorphes", "exp": "Sa forme étoilée ne doit pas le faire confondre avec une étoile de mer.", "src": ["Mimetaster — Bundenbach Fossil Gallery", "https://bundenbachfossil.com/arthropods.html"]},
 {"id": "HUN-09", "site": "HUN", "diff": "facile", "q": "Quelle créature avait un corps ovale aplati composé de plaques et de nombreuses pattes ?", "choix": ["Palaeoisopus problematicus", "Schinderhannes bartelsi", "Gemuendina stuertzi", "Cheloniellon calmani"], "r": "Cheloniellon calmani", "exp": "Cheloniellon était un cheloniellide au bouclier segmenté.", "src": ["Cheloniellon — Wikipedia", "https://en.wikipedia.org/wiki/Cheloniellon"]},
 {"id": "HUN-10", "site": "HUN", "diff": "intermédiaire", "q": "Quel animal moderne Cheloniellon évoque-t-il superficiellement sans en être un ?", "choix": ["Une baleine", "Une salamandre", "Une limule", "Un papillon"], "r": "Une limule", "exp": "Le corps aplati et le bouclier rappellent une limule, mais l’organisation est différente.", "src": ["Cheloniellon — Wikipedia", "https://en.wikipedia.org/wiki/Cheloniellon"]},
 {"id": "HUN-11", "site": "HUN", "diff": "facile", "q": "Quelle créature prolonge au Dévonien un plan corporel associé aux radiodontes du Cambrien ?", "choix": ["Cheloniellon calmani", "Schinderhannes bartelsi", "Gemuendina stuertzi", "Drepanaspis gemuendenensis"], "r": "Schinderhannes bartelsi", "exp": "Schinderhannes possède de grands appendices frontaux et une bouche radiale.", "src": ["Schinderhannes — PubMed", "https://pubmed.ncbi.nlm.nih.gov/19197061/"]},
 {"id": "HUN-12", "site": "HUN", "diff": "avancé", "q": "Pourquoi Schinderhannes est-il paléontologiquement surprenant ?", "choix": ["Il possède des fleurs fossilisées", "Il apparaît environ cent millions d’années après l’apogée cambrienne de formes apparentées", "Il est le premier mammifère marin", "Il est le dernier dinosaure non avien"], "r": "Il apparaît environ cent millions d’années après l’apogée cambrienne de formes apparentées", "exp": "Il étend fortement la durée connue de ce type de plan corporel arthropodien.", "src": ["Schinderhannes — PubMed", "https://pubmed.ncbi.nlm.nih.gov/19197061/"]},
 {"id": "HUN-13", "site": "HUN", "diff": "facile", "q": "Quelle créature était un placoderme aplati convergeant vers une silhouette de raie ?", "choix": ["Mimetaster hexagonalis", "Gemuendina stuertzi", "Palaeoisopus problematicus", "Drepanaspis gemuendenensis"], "r": "Gemuendina stuertzi", "exp": "Gemuendina avait de larges nageoires pectorales et un corps très aplati.", "src": ["Gemuendina — Wikipedia", "https://en.wikipedia.org/wiki/Gemuendina"]},
 {"id": "HUN-14", "site": "HUN", "diff": "intermédiaire", "q": "Gemuendina était-elle une véritable raie ?", "choix": ["Oui, un mammifère marin", "Non, c’était un mollusque", "Oui, une raie moderne", "Non, c’était un placoderme cuirassé"], "r": "Non, c’était un placoderme cuirassé", "exp": "La forme de raie est un exemple de convergence évolutive.", "src": ["Gemuendina — Wikipedia", "https://en.wikipedia.org/wiki/Gemuendina"]},
 {"id": "HUN-15", "site": "HUN", "diff": "facile", "q": "Quelle créature était un poisson sans mâchoires extrêmement aplati et blindé ?", "choix": ["Gemuendina stuertzi", "Schinderhannes bartelsi", "Drepanaspis gemuendenensis", "Mimetaster hexagonalis"], "r": "Drepanaspis gemuendenensis", "exp": "Drepanaspis est un hétérostracé au large bouclier dermique.", "src": ["Drepanaspis — Wikipedia", "https://en.wikipedia.org/wiki/Drepanaspis"]},
 {"id": "HUN-16", "site": "HUN", "diff": "intermédiaire", "q": "Quel trait distingue Drepanaspis de Gemuendina ?", "choix": ["Drepanaspis est un insecte", "Gemuendina est un mammifère", "Les deux sont la même espèce", "Drepanaspis est un vertébré sans mâchoires, Gemuendina un placoderme à mâchoires"], "r": "Drepanaspis est un vertébré sans mâchoires, Gemuendina un placoderme à mâchoires", "exp": "Leur silhouette benthique est convergente mais leur anatomie fondamentale diffère.", "src": ["Drepanaspis — Wikipedia", "https://en.wikipedia.org/wiki/Drepanaspis"]},
 {"id": "HUN-17", "site": "HUN", "diff": "avancé", "q": "Pourquoi la pyritisation est-elle rare ?", "choix": ["Elle nécessite des températures de fusion", "Elle exige une combinaison précise d’enfouissement, de matière organique, de fer et de conditions chimiques", "Elle se produit dans tous les fossiles", "La pyrite n’existe que sur la Lune"], "r": "Elle exige une combinaison précise d’enfouissement, de matière organique, de fer et de conditions chimiques", "exp": "Des conditions géochimiques particulières permettent aux sulfures de fer de reproduire les tissus.", "src": ["The Hunsrück Slate Konservat-Lagerstätte", "https://ore.exeter.ac.uk/ndownloader/files/56832407"]},
 {"id": "HUN-18", "site": "HUN", "diff": "intermédiaire", "q": "Quel duo illustre deux vertébrés benthiques aplatis mais non proches parents ?", "choix": ["Cheloniellon et Schinderhannes", "Gemuendina et Drepanaspis", "Mimetaster et Palaeoisopus", "Palaeoisopus et Drepanaspis"], "r": "Gemuendina et Drepanaspis", "exp": "Ils partagent une silhouette adaptée au fond, mais appartiennent à des branches très différentes.", "src": ["The Hunsrück Slate Konservat-Lagerstätte", "https://ore.exeter.ac.uk/ndownloader/files/56832407"]},
 {"id": "HUN-19", "site": "HUN", "diff": "avancé", "q": "Quelle précaution faut-il prendre avec Schinderhannes ?", "choix": ["Le taxon est connu d’un matériel limité, donc les tissus externes et couleurs restent spéculatifs", "Son anatomie complète a été filmée vivante", "Il faut le représenter comme un Anomalocaris identique", "Il faut lui ajouter des nageoires de requin"], "r": "Le taxon est connu d’un matériel limité, donc les tissus externes et couleurs restent spéculatifs", "exp": "Les éléments principaux sont décrits, mais un unique spécimen limite la certitude sur l’apparence vivante.", "src": ["Schinderhannes — PubMed", "https://pubmed.ncbi.nlm.nih.gov/19197061/"]},
 {"id": "HUN-20", "site": "HUN", "diff": "intermédiaire", "q": "Que démontre la diversité du Hunsrück sur les mers dévoniennes ?", "choix": ["Elles abritaient déjà des communautés complexes de poissons, arthropodes et échinodermes", "Elles ne contenaient que des trilobites", "Elles étaient dominées par des baleines", "Elles étaient presque dépourvues de vie"], "r": "Elles abritaient déjà des communautés complexes de poissons, arthropodes et échinodermes", "exp": "Le gisement offre une fenêtre détaillée sur un écosystème marin du début de l’âge des poissons.", "src": ["The Hunsrück Slate Konservat-Lagerstätte", "https://ore.exeter.ac.uk/ndownloader/files/56832407"]},
 {"id": "DEV-01", "site": "DEV", "diff": "facile", "q": "À quelle période se déroule l’essentiel de la transition présentée ?", "choix": ["Au Dévonien supérieur", "Au Néogène", "Au Trias", "Au Crétacé"], "r": "Au Dévonien supérieur", "exp": "Les formes du pack datent surtout d’environ 385 à 365 millions d’années.", "src": ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]},
 {"id": "DEV-02", "site": "DEV", "diff": "intermédiaire", "q": "Le passage des nageoires aux membres fut-il une marche linéaire d’une espèce à la suivante ?", "choix": ["Oui, toutes vivaient exactement ensemble", "Oui, les six espèces sont une seule population", "Non, plusieurs lignées proches ont expérimenté des combinaisons de caractères", "Non, car les membres sont apparus chez les oiseaux"], "r": "Non, plusieurs lignées proches ont expérimenté des combinaisons de caractères", "exp": "Les fossiles représentent un arbre ramifié et des mosaïques anatomiques.", "src": ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]},
 {"id": "DEV-03", "site": "DEV", "diff": "facile", "q": "Quel animal du pack est un poisson à nageoires charnues encore nettement aquatique ?", "choix": ["Eusthenopteron foordi", "Acanthostega gunnari", "Tiktaalik roseae", "Ichthyostega stensioei"], "r": "Eusthenopteron foordi", "exp": "Eusthenopteron possède des os homologues à ceux des membres, mais garde des nageoires rayonnées.", "src": ["Eusthenopteron — Britannica", "https://www.britannica.com/animal/Eusthenopteron"]},
 {"id": "DEV-04", "site": "DEV", "diff": "intermédiaire", "q": "Pourquoi Eusthenopteron ne pouvait-il probablement pas marcher comme un tétrapode ?", "choix": ["Il était dépourvu de muscles", "Ses nageoires et articulations ne supportaient pas une locomotion terrestre efficace", "Il n’avait aucune colonne vertébrale", "Il possédait des ailes"], "r": "Ses nageoires et articulations ne supportaient pas une locomotion terrestre efficace", "exp": "Les similitudes osseuses ne suffisent pas à produire un membre porteur complet.", "src": ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]},
 {"id": "DEV-05", "site": "DEV", "diff": "facile", "q": "Quel poisson avait une tête aplatie, des yeux dorsaux et un corps adapté aux eaux peu profondes ?", "choix": ["Panderichthys rhombolepis", "Eusthenopteron foordi", "Ichthyostega stensioei", "Acanthostega gunnari"], "r": "Panderichthys rhombolepis", "exp": "Panderichthys est un elpistostégidé très aplati.", "src": ["Panderichthys — Wikipedia", "https://en.wikipedia.org/wiki/Panderichthys"]},
 {"id": "DEV-06", "site": "DEV", "diff": "intermédiaire", "q": "Quel changement des nageoires paires apparaît chez Panderichthys ?", "choix": ["Une réduction des rayons et un squelette interne plus robuste", "Des doigts externes complets", "Une nageoire caudale de baleine", "Des plumes"], "r": "Une réduction des rayons et un squelette interne plus robuste", "exp": "Il approche le plan des membres sans encore posséder de vrais doigts.", "src": ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]},
 {"id": "DEV-07", "site": "DEV", "diff": "facile", "q": "Quel animal célèbre combinait écailles et nageoires avec un cou mobile et des os de type poignet ?", "choix": ["Acanthostega gunnari", "Eusthenopteron foordi", "Tiktaalik roseae", "Ichthyostega stensioei"], "r": "Tiktaalik roseae", "exp": "Tiktaalik est un poisson tétrapodomorphe présentant une mosaïque de traits.", "src": ["University of Chicago — Tiktaalik", "https://tiktaalik.uchicago.edu/"]},
 {"id": "DEV-08", "site": "DEV", "diff": "intermédiaire", "q": "Quel trait permettait à Tiktaalik de relever l’avant du corps dans l’eau peu profonde ?", "choix": ["Une queue préhensile", "Des nageoires pectorales robustes avec articulations comparables à un poignet", "Des sabots", "Des ailes"], "r": "Des nageoires pectorales robustes avec articulations comparables à un poignet", "exp": "Les nageoires pouvaient fléchir et transmettre une partie du poids au substrat.", "src": ["University of Chicago — Tiktaalik", "https://tiktaalik.uchicago.edu/"]},
 {"id": "DEV-09", "site": "DEV", "diff": "intermédiaire", "q": "Tiktaalik possédait-il de vrais doigts ?", "choix": ["Non, il n’avait aucun os dans les nageoires", "Oui, huit doigts externes", "Non, il avait encore des rayons de nageoire", "Oui, cinq doigts modernes"], "r": "Non, il avait encore des rayons de nageoire", "exp": "Ses éléments distaux préfigurent le poignet, mais les doigts apparaissent chez des tétrapodes ultérieurs.", "src": ["University of Chicago — Tiktaalik", "https://tiktaalik.uchicago.edu/"]},
 {"id": "DEV-10", "site": "DEV", "diff": "facile", "q": "Quel animal a révélé des os correspondant à des doigts à l’intérieur d’une nageoire encore rayonnée ?", "choix": ["Ichthyostega stensioei", "Acanthostega gunnari", "Elpistostege watsoni", "Eusthenopteron foordi"], "r": "Elpistostege watsoni", "exp": "La tomographie d’Elpistostege montre des éléments digitaux enfermés dans la nageoire.", "src": ["Elpistostege — Nature", "https://www.nature.com/articles/s41586-020-2100-8"]},
 {"id": "DEV-11", "site": "DEV", "diff": "avancé", "q": "Pourquoi Elpistostege est-il important pour l’origine de la main ?", "choix": ["Il montre que des doigts ont commencé à évoluer avant la disparition complète des rayons de nageoire", "Il était déjà un mammifère terrestre", "Il ne possédait aucun membre pair", "Il prouve que les doigts viennent des plumes"], "r": "Il montre que des doigts ont commencé à évoluer avant la disparition complète des rayons de nageoire", "exp": "La transition est une transformation graduelle et imbriquée, non un remplacement instantané.", "src": ["Elpistostege — Nature", "https://www.nature.com/articles/s41586-020-2100-8"]},
 {"id": "DEV-12", "site": "DEV", "diff": "facile", "q": "Quel premier tétrapode possédait huit doigts à chaque main ?", "choix": ["Panderichthys rhombolepis", "Acanthostega gunnari", "Eusthenopteron foordi", "Tiktaalik roseae"], "r": "Acanthostega gunnari", "exp": "Acanthostega montre que le nombre de doigts n’était pas initialement fixé à cinq.", "src": ["Acanthostega — Britannica", "https://www.britannica.com/animal/Acanthostega"]},
 {"id": "DEV-13", "site": "DEV", "diff": "intermédiaire", "q": "Acanthostega était-il bien adapté à la marche terrestre ?", "choix": ["Non, car il était un insecte", "Oui, il courait comme un lézard moderne", "Oui, il grimpait aux arbres", "Non, ses membres et sa queue indiquent une vie surtout aquatique"], "r": "Non, ses membres et sa queue indiquent une vie surtout aquatique", "exp": "Ses membres servaient probablement dans l’eau et la végétation plutôt qu’à soutenir longtemps le corps sur terre.", "src": ["Acanthostega — Britannica", "https://www.britannica.com/animal/Acanthostega"]},
 {"id": "DEV-14", "site": "DEV", "diff": "facile", "q": "Quel animal était plus robuste et capable de mouvements hors de l’eau, mais restait locomoteur atypique ?", "choix": ["Ichthyostega stensioei", "Eusthenopteron foordi", "Panderichthys rhombolepis", "Elpistostege watsoni"], "r": "Ichthyostega stensioei", "exp": "Ichthyostega avait des membres puissants et un thorax rigide.", "src": ["Ichthyostega — Britannica", "https://www.britannica.com/animal/Ichthyostega"]},
 {"id": "DEV-15", "site": "DEV", "diff": "avancé", "q": "Pourquoi Ichthyostega ne marchait-il probablement pas comme une salamandre moderne ?", "choix": ["Ses côtes imbriquées et ses articulations limitaient les ondulations latérales", "Il était entièrement dépourvu de muscles", "Il n’avait pas de colonne", "Ses membres étaient des ailes"], "r": "Ses côtes imbriquées et ses articulations limitaient les ondulations latérales", "exp": "Les reconstructions biomécaniques suggèrent une progression de type béquillage ou mouvement spécialisé.", "src": ["Ichthyostega locomotion — Nature", "https://www.nature.com/articles/nature11523"]},
 {"id": "DEV-16", "site": "DEV", "diff": "intermédiaire", "q": "Dans quel milieu les premières étapes de cette transition se sont-elles probablement déroulées ?", "choix": ["Sur des sommets enneigés", "Dans des déserts sans eau", "Dans des eaux peu profondes, chenaux, deltas et zones végétalisées", "Dans l’océan abyssal uniquement"], "r": "Dans des eaux peu profondes, chenaux, deltas et zones végétalisées", "exp": "Les membres ont probablement acquis des fonctions dans l’eau avant de devenir efficaces sur terre.", "src": ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]},
 {"id": "DEV-17", "site": "DEV", "diff": "avancé", "q": "Quelle idée traditionnelle est aujourd’hui trop simpliste ?", "choix": ["Les vertébrés possèdent une colonne", "Les poissons vivent dans l’eau", "Le Dévonien précède le Carbonifère", "Des poissons forcés de sortir de mares qui s’asséchaient pour survivre"], "r": "Des poissons forcés de sortir de mares qui s’asséchaient pour survivre", "exp": "Les environnements étaient souvent humides et les innovations des membres ont d’abord servi en milieu aquatique.", "src": ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]},
 {"id": "DEV-18", "site": "DEV", "diff": "intermédiaire", "q": "Quel changement libère la tête des mouvements de la ceinture scapulaire chez Tiktaalik ?", "choix": ["L’apparition d’un cou mobile", "La disparition du crâne", "L’apparition d’antennes", "La fusion des mâchoires au thorax"], "r": "L’apparition d’un cou mobile", "exp": "Chez les poissons plus basaux, la ceinture pectorale est attachée à l’arrière du crâne.", "src": ["University of Chicago — Tiktaalik", "https://tiktaalik.uchicago.edu/"]},
 {"id": "DEV-19", "site": "DEV", "diff": "avancé", "q": "Que montrent les empreintes de tétrapodes plus anciennes que Tiktaalik ?", "choix": ["Que les poissons n’ont jamais eu de nageoires", "Que les dinosaures vivaient au Dévonien", "Que Tiktaalik est un faux fossile", "Que des tétrapodes à doigts existaient déjà tandis que des formes comme Tiktaalik survivaient sur d’autres branches"], "r": "Que des tétrapodes à doigts existaient déjà tandis que des formes comme Tiktaalik survivaient sur d’autres branches", "exp": "La coexistence de formes basales et plus dérivées est normale dans un arbre évolutif ramifié.", "src": ["Tetrapod trackways — Nature", "https://www.nature.com/articles/nature08623"]},
 {"id": "DEV-20", "site": "DEV", "diff": "intermédiaire", "q": "Quel ordre général va du plus poisson à nageoires au tétrapode à doigts robuste ?", "choix": ["Tiktaalik, Ichthyostega, Panderichthys, Eusthenopteron, Acanthostega", "Acanthostega, Eusthenopteron, Ichthyostega, Tiktaalik, Panderichthys", "Ichthyostega, Acanthostega, Tiktaalik, Panderichthys, Eusthenopteron", "Eusthenopteron, Panderichthys, Tiktaalik, Acanthostega, Ichthyostega"], "r": "Eusthenopteron, Panderichthys, Tiktaalik, Acanthostega, Ichthyostega", "exp": "Cet ordre résume des grades anatomiques, sans prétendre que chaque espèce descend directement de la précédente.", "src": ["The Fish–Tetrapod Transition", "https://link.springer.com/article/10.1007/s12052-009-0119-2"]},
 {"id": "CAR-01", "site": "CAR", "diff": "facile", "q": "À quelle période vivaient les créatures du pack ?", "choix": ["Au Cambrien", "Au Crétacé", "Au Carbonifère", "Au Paléocène"], "r": "Au Carbonifère", "exp": "Le Carbonifère s’étend approximativement de 359 à 299 millions d’années.", "src": ["Natural History Museum — Arthropleura", "https://www.nhm.ac.uk/discover/news/2024/october/largest-ever-millipede-head-revealed.html"]},
 {"id": "CAR-02", "site": "CAR", "diff": "intermédiaire", "q": "Quel paysage est emblématique du Carbonifère tropical ?", "choix": ["De vastes forêts marécageuses de lycophytes et fougères arborescentes", "Des déserts de cactus", "Des forêts de plantes à fleurs", "Des prairies de graminées modernes"], "r": "De vastes forêts marécageuses de lycophytes et fougères arborescentes", "exp": "L’enfouissement de cette végétation a contribué à la formation de nombreux gisements de charbon.", "src": ["Britannica — Carboniferous Period", "https://www.britannica.com/science/Carboniferous-Period"]},
 {"id": "CAR-03", "site": "CAR", "diff": "facile", "q": "Quel animal était le plus grand arthropode terrestre connu ?", "choix": ["Arthropleura armata", "Pulmonoscorpius kirktonensis", "Meganeura monyi", "Euphoberia armigera"], "r": "Arthropleura armata", "exp": "Certaines Arthropleura dépassaient deux mètres de long.", "src": ["Natural History Museum — Arthropleura", "https://www.nhm.ac.uk/discover/news/2024/october/largest-ever-millipede-head-revealed.html"]},
 {"id": "CAR-04", "site": "CAR", "diff": "intermédiaire", "q": "Arthropleura était-elle un insecte ?", "choix": ["Oui, un coléoptère", "Non, un vertébré", "Oui, une libellule", "Non, c’était un myriapode"], "r": "Non, c’était un myriapode", "exp": "Elle était apparentée aux mille-pattes et centipèdes, pas aux insectes.", "src": ["Natural History Museum — Arthropleura", "https://www.nhm.ac.uk/discover/news/2024/october/largest-ever-millipede-head-revealed.html"]},
 {"id": "CAR-05", "site": "CAR", "diff": "avancé", "q": "Que révèle la découverte récente de la tête d’Arthropleura ?", "choix": ["Des ailes complètes", "Un mélange de caractères rappelant millipèdes et centipèdes", "Une trompe de mammifère", "Une mâchoire de dinosaure"], "r": "Un mélange de caractères rappelant millipèdes et centipèdes", "exp": "La microtomographie a clarifié ses pièces buccales et ses affinités.", "src": ["Natural History Museum — Arthropleura", "https://www.nhm.ac.uk/discover/news/2024/october/largest-ever-millipede-head-revealed.html"]},
 {"id": "CAR-06", "site": "CAR", "diff": "facile", "q": "Quel grand insecte volant ressemblait à une libellule géante ?", "choix": ["Euphoberia armigera", "Meganeura monyi", "Hibbertopterus scouleri", "Mazothairos enormis"], "r": "Meganeura monyi", "exp": "Meganeura était un griffinfly, proche mais extérieur aux vraies libellules modernes.", "src": ["Meganeura — Britannica", "https://www.britannica.com/animal/Meganeura"]},
 {"id": "CAR-07", "site": "CAR", "diff": "intermédiaire", "q": "Quelle envergure maximale approximative atteignaient les plus grands griffinflies ?", "choix": ["Environ 5 mètres", "Environ 65 à 70 centimètres", "Moins de 2 centimètres", "Plus de 20 mètres"], "r": "Environ 65 à 70 centimètres", "exp": "Ils étaient gigantesques pour des insectes, mais pas de plusieurs mètres.", "src": ["Meganeura — Britannica", "https://www.britannica.com/animal/Meganeura"]},
 {"id": "CAR-08", "site": "CAR", "diff": "facile", "q": "Quel insecte du pack appartenait aux paléodictyoptères et possédait un rostre piqueur ?", "choix": ["Arthropleura armata", "Pulmonoscorpius kirktonensis", "Mazothairos enormis", "Meganeura monyi"], "r": "Mazothairos enormis", "exp": "Mazothairos appartient à un groupe d’insectes paléozoïques aujourd’hui entièrement éteint.", "src": ["Mazothairos — Wikipedia", "https://en.wikipedia.org/wiki/Mazothairos"]},
 {"id": "CAR-09", "site": "CAR", "diff": "intermédiaire", "q": "Quel trait distingue les paléodictyoptères comme Mazothairos ?", "choix": ["De petits lobes ou ailettes sur le premier segment thoracique en plus des deux paires d’ailes", "Une seule paire d’ailes", "Une coquille spiralée", "Des plumes"], "r": "De petits lobes ou ailettes sur le premier segment thoracique en plus des deux paires d’ailes", "exp": "Ces structures donnent parfois l’impression de six ailes, même si leur fonction reste discutée.", "src": ["Palaeodictyoptera — Wikipedia", "https://en.wikipedia.org/wiki/Palaeodictyoptera"]},
 {"id": "CAR-10", "site": "CAR", "diff": "facile", "q": "Quel animal était un grand scorpion terrestre ou semi-terrestre ?", "choix": ["Pulmonoscorpius kirktonensis", "Meganeura monyi", "Euphoberia armigera", "Hibbertopterus scouleri"], "r": "Pulmonoscorpius kirktonensis", "exp": "Pulmonoscorpius est connu du Carbonifère inférieur d’Écosse.", "src": ["Pulmonoscorpius — Wikipedia", "https://en.wikipedia.org/wiki/Pulmonoscorpius"]},
 {"id": "CAR-11", "site": "CAR", "diff": "intermédiaire", "q": "Quelle taille approximative pouvait atteindre Pulmonoscorpius ?", "choix": ["Moins d’un millimètre", "Plus de 8 mètres", "Environ 70 centimètres", "Environ 20 mètres"], "r": "Environ 70 centimètres", "exp": "Les estimations atteignent environ 70 cm, mais l’animal n’était pas un monstre de plusieurs mètres.", "src": ["Pulmonoscorpius — Wikipedia", "https://en.wikipedia.org/wiki/Pulmonoscorpius"]},
 {"id": "CAR-12", "site": "CAR", "diff": "facile", "q": "Quel animal était un grand euryptéride vivant dans des eaux douces ou saumâtres ?", "choix": ["Meganeura monyi", "Euphoberia armigera", "Hibbertopterus scouleri", "Arthropleura armata"], "r": "Hibbertopterus scouleri", "exp": "Hibbertopterus était un « scorpion de mer » tardif, lourd et benthique.", "src": ["Hibbertopterus — Wikipedia", "https://en.wikipedia.org/wiki/Hibbertopterus"]},
 {"id": "CAR-13", "site": "CAR", "diff": "intermédiaire", "q": "Comment Hibbertopterus cherchait-il probablement sa nourriture ?", "choix": ["En mordant avec des dents de requin", "En broutant la cime des arbres", "En balayant le sédiment avec des appendices spécialisés", "En volant après des insectes"], "r": "En balayant le sédiment avec des appendices spécialisés", "exp": "Ses appendices antérieurs portaient des structures adaptées au ratissage.", "src": ["Hibbertopterus — Wikipedia", "https://en.wikipedia.org/wiki/Hibbertopterus"]},
 {"id": "CAR-14", "site": "CAR", "diff": "facile", "q": "Quel myriapode plus petit était hérissé de longues épines ?", "choix": ["Arthropleura armata", "Euphoberia armigera", "Pulmonoscorpius kirktonensis", "Mazothairos enormis"], "r": "Euphoberia armigera", "exp": "Euphoberia est un diplopode épineux à défense passive spectaculaire.", "src": ["Euphoberia — Wikipedia", "https://en.wikipedia.org/wiki/Euphoberia"]},
 {"id": "CAR-15", "site": "CAR", "diff": "intermédiaire", "q": "À quoi servaient probablement les épines d’Euphoberia ?", "choix": ["À produire du vol battu", "À décourager les prédateurs", "À porter des fanons", "À filtrer le plancton"], "r": "À décourager les prédateurs", "exp": "Les longues projections augmentaient le volume apparent et rendaient la capture difficile.", "src": ["Euphoberia — Wikipedia", "https://en.wikipedia.org/wiki/Euphoberia"]},
 {"id": "CAR-16", "site": "CAR", "diff": "avancé", "q": "L’oxygène élevé explique-t-il à lui seul le gigantisme des arthropodes carbonifères ?", "choix": ["Non, il a probablement facilité le gigantisme avec d’autres facteurs écologiques et évolutifs", "Oui, c’est la seule cause possible", "Non, l’oxygène était absent", "Oui, et tous les animaux étaient géants"], "r": "Non, il a probablement facilité le gigantisme avec d’autres facteurs écologiques et évolutifs", "exp": "Le système trachéen des insectes est sensible à l’oxygène, mais prédation, climat et histoire des lignées comptent aussi.", "src": ["PNAS — Oxygen and insect gigantism", "https://www.pnas.org/doi/10.1073/pnas.1204026109"]},
 {"id": "CAR-17", "site": "CAR", "diff": "intermédiaire", "q": "Pourquoi les forêts carbonifères ont-elles produit beaucoup de charbon ?", "choix": ["Une grande quantité de matière végétale fut enfouie dans des milieux saturés en eau et pauvres en oxygène", "Les arbres étaient faits de charbon pur", "Les insectes transformaient immédiatement le bois en roche", "Les volcans fabriquaient du charbon"], "r": "Une grande quantité de matière végétale fut enfouie dans des milieux saturés en eau et pauvres en oxygène", "exp": "La décomposition incomplète et l’enfouissement ont accumulé la tourbe, ensuite transformée.", "src": ["Britannica — Carboniferous Period", "https://www.britannica.com/science/Carboniferous-Period"]},
 {"id": "CAR-18", "site": "CAR", "diff": "avancé", "q": "Pourquoi Hibbertopterus ne doit-il pas être placé sur un sol forestier sec avec Arthropleura ?", "choix": ["Il était un mammifère marin", "Son anatomie et ses traces indiquent un mode de vie aquatique ou amphibie en eau peu profonde", "Il pouvait uniquement voler", "Il vivait dans les arbres"], "r": "Son anatomie et ses traces indiquent un mode de vie aquatique ou amphibie en eau peu profonde", "exp": "Le pack couvre plusieurs habitats du monde carbonifère, pas une unique clairière.", "src": ["Hibbertopterus — Wikipedia", "https://en.wikipedia.org/wiki/Hibbertopterus"]},
 {"id": "CAR-19", "site": "CAR", "diff": "intermédiaire", "q": "Quel duo représente deux myriapodes très différents ?", "choix": ["Meganeura et Mazothairos", "Arthropleura et Euphoberia", "Meganeura et Pulmonoscorpius", "Pulmonoscorpius et Hibbertopterus"], "r": "Arthropleura et Euphoberia", "exp": "Arthropleura était gigantesque et large; Euphoberia plus petite et fortement épineuse.", "src": ["Natural History Museum — Arthropleura", "https://www.nhm.ac.uk/discover/news/2024/october/largest-ever-millipede-head-revealed.html"]},
 {"id": "CAR-20", "site": "CAR", "diff": "avancé", "q": "Quelle affirmation évite le mieux le cliché du Carbonifère ?", "choix": ["L’atmosphère était composée d’oxygène pur", "Aucun vertébré ne vivait dans ces forêts", "Quelques arthropodes atteignaient des tailles remarquables, mais la majorité des espèces n’étaient pas géantes", "Tous les insectes mesuraient plusieurs mètres"], "r": "Quelques arthropodes atteignaient des tailles remarquables, mais la majorité des espèces n’étaient pas géantes", "exp": "Le gigantisme concernait certaines lignées et ne résume pas toute la biodiversité carbonifère.", "src": ["Britannica — Carboniferous Period", "https://www.britannica.com/science/Carboniferous-Period"]},
 {"id": "MAZ-01", "site": "MAZ", "diff": "facile", "q": "Dans quel État américain se trouve Mazon Creek ?", "choix": ["En Alaska", "Dans l’Utah", "En Floride", "Dans l’Illinois"], "r": "Dans l’Illinois", "exp": "Mazon Creek est un célèbre gisement du nord-est de l’Illinois.", "src": ["Mazon Creek fossil beds — Wikipedia", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]},
 {"id": "MAZ-02", "site": "MAZ", "diff": "facile", "q": "À quelle période appartient Mazon Creek ?", "choix": ["Au Pléistocène", "Au Crétacé inférieur", "Au Cambrien", "Au Carbonifère supérieur"], "r": "Au Carbonifère supérieur", "exp": "Le gisement date du Pennsylvanien, vers 309 millions d’années.", "src": ["Mazon Creek fossil beds — Wikipedia", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]},
 {"id": "MAZ-03", "site": "MAZ", "diff": "intermédiaire", "q": "Dans quel type de roche les fossiles de Mazon Creek sont-ils souvent enfermés ?", "choix": ["Des ambres uniquement", "Des basaltes volcaniques", "Des concrétions de sidérite", "Des blocs de glace"], "r": "Des concrétions de sidérite", "exp": "La matière organique a favorisé la formation de concrétions de carbonate de fer autour des organismes.", "src": ["Mazon Creek fossil beds — Wikipedia", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]},
 {"id": "MAZ-04", "site": "MAZ", "diff": "intermédiaire", "q": "Pourquoi parle-t-on de plusieurs assemblages à Mazon Creek ?", "choix": ["Les fossiles ont tous été transportés depuis le Jurassique", "Le site est une grotte à plusieurs étages", "Le complexe comprend des milieux terrestres, deltaïques, saumâtres et marins", "Chaque espèce vient d’un continent différent"], "r": "Le complexe comprend des milieux terrestres, deltaïques, saumâtres et marins", "exp": "Les assemblages Braidwood et Essex reflètent notamment des environnements différents.", "src": ["Mazon Creek fossil beds — Wikipedia", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]},
 {"id": "MAZ-05", "site": "MAZ", "diff": "facile", "q": "Quelle créature est surnommée le « monstre de Tully » ?", "choix": ["Tullimonstrum gregarium", "Joermungandr bolti", "Essexella asherae", "Euproops danae"], "r": "Tullimonstrum gregarium", "exp": "Tullimonstrum est l’animal emblématique et officiel de l’État de l’Illinois.", "src": ["Tullimonstrum — Field Museum", "https://www.fieldmuseum.org/blog/tully-monster"]},
 {"id": "MAZ-06", "site": "MAZ", "diff": "intermédiaire", "q": "Quel trait rend Tullimonstrum immédiatement reconnaissable ?", "choix": ["Des ailes couvertes d’écailles", "Une carapace de tortue", "Une coquille spiralée géante", "Une longue trompe terminée par une pince dentée et des yeux sur une barre transversale"], "r": "Une longue trompe terminée par une pince dentée et des yeux sur une barre transversale", "exp": "Sa combinaison de proboscis, pince et barre oculaire est unique.", "src": ["Tullimonstrum — Field Museum", "https://www.fieldmuseum.org/blog/tully-monster"]},
 {"id": "MAZ-07", "site": "MAZ", "diff": "avancé", "q": "Quelle affirmation sur la classification de Tullimonstrum est la plus rigoureuse ?", "choix": ["Il s’agit d’une plante marine", "Il est unanimement reconnu comme un mammifère", "Son appartenance exacte reste débattue malgré plusieurs études", "Il est certainement un trilobite"], "r": "Son appartenance exacte reste débattue malgré plusieurs études", "exp": "Différentes analyses l’ont rapproché des vertébrés ou d’invertébrés; le débat n’est pas entièrement clos.", "src": ["Tullimonstrum — Field Museum", "https://www.fieldmuseum.org/blog/tully-monster"]},
 {"id": "MAZ-08", "site": "MAZ", "diff": "facile", "q": "Quelle créature longtemps prise pour une méduse est aujourd’hui souvent interprétée comme une anémone ?", "choix": ["Kallidecthes richardsoni", "Euproops danae", "Palaeocampa anthrax", "Essexella asherae"], "r": "Essexella asherae", "exp": "Une réinterprétation récente propose un mode de vie fouisseur ou semi-fouisseur d’anémone.", "src": ["Essexella — Wikipedia", "https://en.wikipedia.org/wiki/Essexella"]},
 {"id": "MAZ-09", "site": "MAZ", "diff": "intermédiaire", "q": "Quel élément d’Essexella aurait été confondu avec une cloche de méduse ?", "choix": ["Une base élargie adaptée à l’ancrage dans le sédiment", "Un crâne osseux", "Une nageoire caudale", "Une coquille calcaire"], "r": "Une base élargie adaptée à l’ancrage dans le sédiment", "exp": "La morphologie fossile peut être déformée et inverser l’interprétation du mode de vie.", "src": ["Essexella — Wikipedia", "https://en.wikipedia.org/wiki/Essexella"]},
 {"id": "MAZ-10", "site": "MAZ", "diff": "facile", "q": "Quelle créature du pack était un crustacé nageur comprimé latéralement ?", "choix": ["Joermungandr bolti", "Tullimonstrum gregarium", "Kallidecthes richardsoni", "Palaeocampa anthrax"], "r": "Kallidecthes richardsoni", "exp": "Kallidecthes appartient aux paléostomatopodes, des crustacés paléozoïques.", "src": ["Kallidecthes — Wikipedia", "https://en.wikipedia.org/wiki/Kallidecthes"]},
 {"id": "MAZ-11", "site": "MAZ", "diff": "intermédiaire", "q": "Pourquoi ne faut-il pas dessiner Kallidecthes comme une crevette moderne générique ?", "choix": ["Il vivait uniquement sur terre", "Il n’avait aucun appendice", "Son groupe et l’organisation de ses appendices sont propres aux crustacés paléozoïques", "Il possédait un squelette de vertébré"], "r": "Son groupe et l’organisation de ses appendices sont propres aux crustacés paléozoïques", "exp": "La reconstruction doit suivre les fossiles plutôt que copier un crustacé actuel.", "src": ["Kallidecthes — Wikipedia", "https://en.wikipedia.org/wiki/Kallidecthes"]},
 {"id": "MAZ-12", "site": "MAZ", "diff": "facile", "q": "Quelle créature était un lobopodien cuirassé muni de nombreuses petites pattes ?", "choix": ["Joermungandr bolti", "Palaeocampa anthrax", "Euproops danae", "Essexella asherae"], "r": "Palaeocampa anthrax", "exp": "Palaeocampa est une forme tardive et spectaculaire de lobopodien.", "src": ["Palaeocampa — Communications Biology", "https://www.nature.com/articles/s42003-025-08483-0"]},
 {"id": "MAZ-13", "site": "MAZ", "diff": "avancé", "q": "Pourquoi Palaeocampa est-elle surprenante dans le Carbonifère ?", "choix": ["Les lobopodiens sont surtout connus dans des gisements beaucoup plus anciens", "Elle est le seul animal marin connu", "Elle vivait après l’apparition des humains", "Elle est le premier dinosaure à plumes"], "r": "Les lobopodiens sont surtout connus dans des gisements beaucoup plus anciens", "exp": "Elle prolonge très tardivement une architecture corporelle souvent associée au Cambrien.", "src": ["Palaeocampa — Communications Biology", "https://www.nature.com/articles/s42003-025-08483-0"]},
 {"id": "MAZ-14", "site": "MAZ", "diff": "facile", "q": "Quelle créature ressemblait à un petit serpent muni de membres minuscules ?", "choix": ["Joermungandr bolti", "Kallidecthes richardsoni", "Euproops danae", "Tullimonstrum gregarium"], "r": "Joermungandr bolti", "exp": "Joermungandr est un recumbirostre au corps fortement allongé.", "src": ["Joermungandr — Royal Society Open Science", "https://royalsocietypublishing.org/doi/10.1098/rsos.210319"]},
 {"id": "MAZ-15", "site": "MAZ", "diff": "intermédiaire", "q": "Quel type d’animal était Joermungandr ?", "choix": ["Un serpent moderne", "Un poisson cartilagineux", "Un tétrapode recumbirostre proche de lignées amphibiennes anciennes", "Un arthropode"], "r": "Un tétrapode recumbirostre proche de lignées amphibiennes anciennes", "exp": "Il avait une colonne et des membres de tétrapode, malgré une silhouette serpentiforme.", "src": ["Joermungandr — Royal Society Open Science", "https://royalsocietypublishing.org/doi/10.1098/rsos.210319"]},
 {"id": "MAZ-16", "site": "MAZ", "diff": "facile", "q": "Quelle créature était un petit xiphosure apparenté aux limules ?", "choix": ["Palaeocampa anthrax", "Euproops danae", "Tullimonstrum gregarium", "Essexella asherae"], "r": "Euproops danae", "exp": "Euproops possédait une carapace et un telson rappelant les limules.", "src": ["Euproops — Wikipedia", "https://en.wikipedia.org/wiki/Euproops"]},
 {"id": "MAZ-17", "site": "MAZ", "diff": "intermédiaire", "q": "Quel type de préservation exceptionnelle est connu chez Euproops ?", "choix": ["Des détails du système nerveux central", "Des plumes colorées", "Un placenta fossilisé", "Des poumons gonflés"], "r": "Des détails du système nerveux central", "exp": "Certains spécimens de Mazon Creek conservent des structures nerveuses rarement fossilisées.", "src": ["Euproops — Wikipedia", "https://en.wikipedia.org/wiki/Euproops"]},
 {"id": "MAZ-18", "site": "MAZ", "diff": "avancé", "q": "Pourquoi une seule scène réunissant les six animaux serait-elle trompeuse ?", "choix": ["Aucun n’est trouvé à Mazon Creek", "Ils vivaient à des centaines de millions d’années d’écart", "Certains viennent de Mars", "Ils n’occupaient pas tous le même microhabitat dans le complexe deltaïque"], "r": "Ils n’occupaient pas tous le même microhabitat dans le complexe deltaïque", "exp": "Le gisement regroupe plusieurs environnements voisins, du continent au large marin.", "src": ["Mazon Creek fossil beds — Wikipedia", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]},
 {"id": "MAZ-19", "site": "MAZ", "diff": "intermédiaire", "q": "Quel duo représente deux arthropodes mais avec des plans corporels très différents ?", "choix": ["Kallidecthes et Euproops", "Essexella et Joermungandr", "Palaeocampa et Joermungandr", "Joermungandr et Tullimonstrum"], "r": "Kallidecthes et Euproops", "exp": "Kallidecthes est un crustacé; Euproops, un xiphosure.", "src": ["Mazon Creek fossil beds — Wikipedia", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]},
 {"id": "MAZ-20", "site": "MAZ", "diff": "avancé", "q": "Quelle leçon générale donne Mazon Creek sur la fossilisation ?", "choix": ["Les fossiles se forment uniquement dans la glace", "Les tissus mous peuvent être préservés si enfouissement et chimie du sédiment sont favorables", "Tout organisme mort devient automatiquement un fossile complet", "Seuls les os se fossilisent"], "r": "Les tissus mous peuvent être préservés si enfouissement et chimie du sédiment sont favorables", "exp": "La formation rapide de concrétions a protégé des anatomies délicates.", "src": ["Mazon Creek fossil beds — Wikipedia", "https://en.wikipedia.org/wiki/Mazon_Creek_fossil_beds"]},
 {"id": "KAR2-01", "site": "KAR2", "diff": "facile", "q": "Dans quel pays se trouve l’essentiel du bassin fossilifère du Karoo ?", "choix": ["En Afrique du Sud", "En Mongolie", "Au Canada", "Au Pérou"], "r": "En Afrique du Sud", "exp": "Le vaste bassin du Karoo occupe une grande partie de l’intérieur de l’Afrique du Sud.", "src": ["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"]},
 {"id": "KAR2-02", "site": "KAR2", "diff": "facile", "q": "Les créatures principales du pack Karoo revisité sont-elles des dinosaures ?", "choix": ["Non, ce sont uniquement des amphibiens", "Oui, toutes sont des dinosaures ornithischiens", "Non, ce sont surtout des synapsides et d’autres amniotes", "Oui, toutes sont des oiseaux primitifs"], "r": "Non, ce sont surtout des synapsides et d’autres amniotes", "exp": "Moschops, Rubidgea, Diictodon, Lystrosaurus et Thrinaxodon appartiennent à des lignées de synapsides; Pareiasaurus est un parareptile.", "src": ["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"]},
 {"id": "KAR2-03", "site": "KAR2", "diff": "facile", "q": "Quelle créature du pack est un grand herbivore au crâne très épaissi ?", "choix": ["Rubidgea atrox", "Diictodon feliceps", "Thrinaxodon liorhinus", "Moschops capensis"], "r": "Moschops capensis", "exp": "Moschops est un dinocéphale massif, célèbre pour les os épais de son crâne.", "src": ["Moschops — Britannica", "https://www.britannica.com/animal/Moschops"]},
 {"id": "KAR2-04", "site": "KAR2", "diff": "intermédiaire", "q": "Quelle fonction a parfois été proposée pour le crâne épaissi de Moschops ?", "choix": ["Porter des bois ramifiés", "Des interactions par poussées ou coups de tête", "Filtrer le plancton", "Produire un sonar"], "r": "Des interactions par poussées ou coups de tête", "exp": "L’hypothèse de comportements de confrontation existe, mais le comportement exact reste impossible à observer directement.", "src": ["Moschops — Britannica", "https://www.britannica.com/animal/Moschops"]},
 {"id": "KAR2-05", "site": "KAR2", "diff": "facile", "q": "Quelle créature était un grand herbivore cuirassé appartenant aux parareptiles ?", "choix": ["Thrinaxodon liorhinus", "Moschops capensis", "Pareiasaurus serridens", "Rubidgea atrox"], "r": "Pareiasaurus serridens", "exp": "Pareiasaurus était un grand parareptile robuste portant des ostéodermes.", "src": ["Pareiasaurus — Encyclopaedia Britannica", "https://www.britannica.com/animal/pareiasaur"]},
 {"id": "KAR2-06", "site": "KAR2", "diff": "intermédiaire", "q": "Quel trait distingue visuellement Pareiasaurus ?", "choix": ["Une voile dorsale haute", "Un corps massif avec des bosses et une armure dermique", "Des ailes membraneuses", "Un cou de plusieurs mètres"], "r": "Un corps massif avec des bosses et une armure dermique", "exp": "Sa peau portait des ostéodermes et son crâne était sculpté d’excroissances.", "src": ["Pareiasaurus — Encyclopaedia Britannica", "https://www.britannica.com/animal/pareiasaur"]},
 {"id": "KAR2-07", "site": "KAR2", "diff": "facile", "q": "Quel animal du pack était un prédateur gorgonopsien à grandes canines ?", "choix": ["Diictodon feliceps", "Rubidgea atrox", "Moschops capensis", "Lystrosaurus curvatus"], "r": "Rubidgea atrox", "exp": "Rubidgea était un grand gorgonopsien, groupe de prédateurs synapsides aux canines développées.", "src": ["Rubidgea — Wikipedia", "https://en.wikipedia.org/wiki/Rubidgea"]},
 {"id": "KAR2-08", "site": "KAR2", "diff": "intermédiaire", "q": "Quelle reconstruction de Rubidgea serait incorrecte ?", "choix": ["Un prédateur à museau robuste", "Un quadrupède terrestre", "Un animal muni d’un bec de tortue", "Un synapside à longues canines"], "r": "Un animal muni d’un bec de tortue", "exp": "Les gorgonopsiens avaient des mâchoires dentées, pas un bec de dicynodonte.", "src": ["Rubidgea — Wikipedia", "https://en.wikipedia.org/wiki/Rubidgea"]},
 {"id": "KAR2-09", "site": "KAR2", "diff": "facile", "q": "Quelle petite créature fouisseuse possédait un bec et, chez certains individus, des défenses ?", "choix": ["Diictodon feliceps", "Rubidgea atrox", "Pareiasaurus serridens", "Thrinaxodon liorhinus"], "r": "Diictodon feliceps", "exp": "Diictodon était un petit dicynodonte très commun, souvent associé à des terriers.", "src": ["Diictodon — Wikipedia", "https://en.wikipedia.org/wiki/Diictodon"]},
 {"id": "KAR2-10", "site": "KAR2", "diff": "avancé", "q": "Pourquoi ne faut-il pas donner de grandes défenses à tous les Diictodon représentés ?", "choix": ["Les défenses n’existaient que chez les juvéniles de toutes les espèces", "La présence de défenses variait entre individus et pourrait refléter un dimorphisme", "Les défenses tombaient chaque hiver", "Les fossiles montrent qu’aucun Diictodon n’en avait"], "r": "La présence de défenses variait entre individus et pourrait refléter un dimorphisme", "exp": "Les spécimens ne portent pas tous des défenses, et cette variation a été interprétée comme un possible dimorphisme sexuel.", "src": ["Diictodon — Wikipedia", "https://en.wikipedia.org/wiki/Diictodon"]},
 {"id": "KAR2-11", "site": "KAR2", "diff": "facile", "q": "Quelle créature est célèbre pour avoir dominé de nombreuses faunes juste après l’extinction de fin du Permien ?", "choix": ["Lystrosaurus curvatus", "Moschops capensis", "Pareiasaurus serridens", "Rubidgea atrox"], "r": "Lystrosaurus curvatus", "exp": "Les lystrosaures furent extrêmement abondants dans certains assemblages du Trias inférieur.", "src": ["Lystrosaurus — Britannica", "https://www.britannica.com/animal/Lystrosaurus"]},
 {"id": "KAR2-12", "site": "KAR2", "diff": "intermédiaire", "q": "Quel trait alimentaire caractérise Lystrosaurus ?", "choix": ["Un bec corné d’herbivore", "Des mandibules à spirale dentaire", "Une trompe filtrante", "Des dents de requin remplacées en continu"], "r": "Un bec corné d’herbivore", "exp": "Comme les autres dicynodontes, Lystrosaurus avait un bec et des défenses, avec une dentition très réduite.", "src": ["Lystrosaurus — Britannica", "https://www.britannica.com/animal/Lystrosaurus"]},
 {"id": "KAR2-13", "site": "KAR2", "diff": "facile", "q": "Quelle créature du pack est un petit cynodonte proche de la lignée des mammifères ?", "choix": ["Pareiasaurus serridens", "Thrinaxodon liorhinus", "Moschops capensis", "Lystrosaurus curvatus"], "r": "Thrinaxodon liorhinus", "exp": "Thrinaxodon appartient aux cynodontes, groupe étroitement lié à l’origine des mammifères.", "src": ["Thrinaxodon — Wikipedia", "https://en.wikipedia.org/wiki/Thrinaxodon"]},
 {"id": "KAR2-14", "site": "KAR2", "diff": "intermédiaire", "q": "Quel trait dentaire de Thrinaxodon annonce la condition mammalienne ?", "choix": ["L’absence totale de dents", "Un bec sans mâchoires", "Une denture différenciée en plusieurs types de dents", "Une spirale de dents"], "r": "Une denture différenciée en plusieurs types de dents", "exp": "Les cynodontes possédaient incisives, canines et postcanines spécialisées.", "src": ["Thrinaxodon — Wikipedia", "https://en.wikipedia.org/wiki/Thrinaxodon"]},
 {"id": "KAR2-15", "site": "KAR2", "diff": "avancé", "q": "Quelle affirmation sur le revêtement de Thrinaxodon est la plus prudente ?", "choix": ["Il portait forcément des plumes modernes", "Une fourrure rayée est fossilisée sur tous les spécimens", "Des filaments ou une pilosité sont plausibles, mais la couverture exacte n’est pas directement connue", "Sa peau était une carapace osseuse continue"], "r": "Des filaments ou une pilosité sont plausibles, mais la couverture exacte n’est pas directement connue", "exp": "La physiologie des cynodontes rend une couverture filamentaire plausible, mais les détails restent inférés.", "src": ["Thrinaxodon — Wikipedia", "https://en.wikipedia.org/wiki/Thrinaxodon"]},
 {"id": "KAR2-16", "site": "KAR2", "diff": "intermédiaire", "q": "Quel événement sépare approximativement les faunes à Rubidgea ou Pareiasaurus de celles à Lystrosaurus et Thrinaxodon ?", "choix": ["La crise Crétacé-Paléogène", "L’apparition des plantes à fleurs", "L’impact de Chicxulub", "L’extinction de fin du Permien"], "r": "L’extinction de fin du Permien", "exp": "Le pack traverse la plus grande extinction connue, suivie d’une reconstruction écologique au Trias inférieur.", "src": ["Karoo Origins Fossil Centre", "https://fossilcentre.co.za/"]},
 {"id": "KAR2-17", "site": "KAR2", "diff": "avancé", "q": "Pourquoi le pack Karoo ne doit-il pas être illustré comme un seul instant écologique ?", "choix": ["Les six taxons proviennent de niveaux et d’âges différents", "Ils vivaient tous sur des continents différents", "Aucun fossile ne vient du Karoo", "Les espèces sont toutes modernes"], "r": "Les six taxons proviennent de niveaux et d’âges différents", "exp": "Le Karoo enregistre une longue succession allant du Permien moyen au Trias inférieur.", "src": ["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"]},
 {"id": "KAR2-18", "site": "KAR2", "diff": "intermédiaire", "q": "Quel duo présente deux herbivores très différents : un dinocephale au crâne épais et un parareptile cuirassé ?", "choix": ["Moschops et Pareiasaurus", "Diictodon et Rubidgea", "Rubidgea et Thrinaxodon", "Lystrosaurus et Rubidgea"], "r": "Moschops et Pareiasaurus", "exp": "Moschops et Pareiasaurus occupaient tous deux des rôles herbivores, mais appartenaient à des lignées et plans corporels distincts.", "src": ["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"]},
 {"id": "KAR2-19", "site": "KAR2", "diff": "intermédiaire", "q": "Quel duo de dicynodontes du pack partage un bec corné ?", "choix": ["Moschops et Pareiasaurus", "Rubidgea et Moschops", "Rubidgea et Thrinaxodon", "Diictodon et Lystrosaurus"], "r": "Diictodon et Lystrosaurus", "exp": "Diictodon et Lystrosaurus sont des dicynodontes; le premier est petit et fouisseur, le second beaucoup plus robuste.", "src": ["Lystrosaurus — Britannica", "https://www.britannica.com/animal/Lystrosaurus"]},
 {"id": "KAR2-20", "site": "KAR2", "diff": "avancé", "q": "Quelle est la relation la plus juste entre les thérapsides du Karoo et les mammifères ?", "choix": ["Les thérapsides n’ont aucun lien avec les mammifères", "Certains thérapsides appartiennent à la grande lignée ayant conduit aux mammifères, mais tous ne sont pas leurs ancêtres directs", "Les mammifères descendent des dinosaures du Karoo", "Tous les thérapsides sont des mammifères modernes"], "r": "Certains thérapsides appartiennent à la grande lignée ayant conduit aux mammifères, mais tous ne sont pas leurs ancêtres directs", "exp": "L’évolution est ramifiée : les cynodontes sont proches de la lignée mammalienne, tandis que d’autres thérapsides sont des branches cousines éteintes.", "src": ["Iziko — Karoo Palaeontology", "https://www.iziko.org.za/collection/karoo-palaeontology/"]},
 {"id": "LUO-01", "site": "LUO", "diff": "facile", "q": "À quelle période appartient le biote de Luoping ?", "choix": ["Au Jurassique supérieur", "Au Miocène", "Au Trias moyen", "Au Cambrien inférieur"], "r": "Au Trias moyen", "exp": "Luoping date de l’Anisien, au Trias moyen.", "src": ["The Luoping biota — Proceedings B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]},
 {"id": "LUO-02", "site": "LUO", "diff": "facile", "q": "Dans quel pays se trouve Luoping ?", "choix": ["En Australie", "En Chine", "En Belgique", "En Russie"], "r": "En Chine", "exp": "Le gisement se situe dans la province du Yunnan, au sud-ouest de la Chine.", "src": ["The Luoping biota — Proceedings B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]},
 {"id": "LUO-03", "site": "LUO", "diff": "intermédiaire", "q": "Pourquoi Luoping est-il important dans l’histoire de la vie ?", "choix": ["Il montre la reconstruction d’un écosystème marin complexe après l’extinction de fin du Permien", "Il contient les premiers dinosaures terrestres connus", "Il est le dernier refuge des trilobites", "Il documente l’origine des plantes à fleurs"], "r": "Il montre la reconstruction d’un écosystème marin complexe après l’extinction de fin du Permien", "exp": "Environ dix millions d’années après la crise, la faune montre un réseau trophique diversifié.", "src": ["The Luoping biota — Proceedings B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]},
 {"id": "LUO-04", "site": "LUO", "diff": "facile", "q": "Quel reptile marin possédait une tête élargie en forme de pelle ou de marteau ?", "choix": ["Atopodentatus unicus", "Nothosaurus zhangi", "Phalarodon atavus", "Dinocephalosaurus orientalis"], "r": "Atopodentatus unicus", "exp": "La nouvelle reconstruction d’Atopodentatus montre un museau transversal très large.", "src": ["Atopodentatus — Nature", "https://www.nature.com/articles/srep20925"]},
 {"id": "LUO-05", "site": "LUO", "diff": "intermédiaire", "q": "Quel régime alimentaire est attribué à Atopodentatus ?", "choix": ["Filtreur de plancton avec des fanons", "Superprédateur de grands reptiles", "Charognard terrestre", "Herbivore se nourrissant de végétation marine"], "r": "Herbivore se nourrissant de végétation marine", "exp": "Sa mâchoire en pelle et ses dents fines sont interprétées comme des adaptations à l’alimentation végétale.", "src": ["Atopodentatus — Nature", "https://www.nature.com/articles/srep20925"]},
 {"id": "LUO-06", "site": "LUO", "diff": "avancé", "q": "Quelle ancienne reconstruction d’Atopodentatus est aujourd’hui abandonnée ?", "choix": ["Un museau vertical en fermeture éclair", "Un corps aquatique à quatre membres", "Une tête transversale en marteau", "Une dentition fine et nombreuse"], "r": "Un museau vertical en fermeture éclair", "exp": "Le premier fossile écrasé avait conduit à une interprétation erronée du museau.", "src": ["Atopodentatus — Nature", "https://www.nature.com/articles/srep20925"]},
 {"id": "LUO-07", "site": "LUO", "diff": "facile", "q": "Quel animal possédait un cou extraordinairement long formé de nombreuses vertèbres ?", "choix": ["Diandongosaurus acutidentatus", "Phalarodon atavus", "Sinosaurosphargis yunguiensis", "Dinocephalosaurus orientalis"], "r": "Dinocephalosaurus orientalis", "exp": "Dinocephalosaurus avait un tronc relativement compact et un cou très allongé.", "src": ["Dinocephalosaurus — Nature Communications", "https://www.nature.com/articles/ncomms14445"]},
 {"id": "LUO-08", "site": "LUO", "diff": "intermédiaire", "q": "Dinocephalosaurus était-il un plésiosaure ?", "choix": ["Oui, un plésiosaure jurassique classique", "Non, c’était un archosauromorphe marin d’une autre lignée", "Oui, un mosasaure", "Non, c’était un mammifère marin"], "r": "Non, c’était un archosauromorphe marin d’une autre lignée", "exp": "La convergence a produit un long cou, mais son appartenance évolutive est différente.", "src": ["Dinocephalosaurus — Nature Communications", "https://www.nature.com/articles/ncomms14445"]},
 {"id": "LUO-09", "site": "LUO", "diff": "facile", "q": "Quelle créature ressemblait superficiellement à une tortue aplatie et cuirassée ?", "choix": ["Atopodentatus unicus", "Sinosaurosphargis yunguiensis", "Phalarodon atavus", "Nothosaurus zhangi"], "r": "Sinosaurosphargis yunguiensis", "exp": "Sinosaurosphargis avait des côtes élargies et une armure d’ostéodermes.", "src": ["Sinosaurosphargis — Wikipedia", "https://en.wikipedia.org/wiki/Sinosaurosphargis"]},
 {"id": "LUO-10", "site": "LUO", "diff": "intermédiaire", "q": "Pourquoi Sinosaurosphargis n’est-il pas une tortue ?", "choix": ["Il possédait des plumes", "Il n’avait aucun os", "Il vivait uniquement sur terre", "Son armure et ses côtes résultent d’une lignée distincte"], "r": "Son armure et ses côtes résultent d’une lignée distincte", "exp": "La silhouette est convergente; l’anatomie et la phylogénie diffèrent de celles des tortues.", "src": ["Sinosaurosphargis — Wikipedia", "https://en.wikipedia.org/wiki/Sinosaurosphargis"]},
 {"id": "LUO-11", "site": "LUO", "diff": "facile", "q": "Quel animal était le grand prédateur nothosaure du pack ?", "choix": ["Atopodentatus unicus", "Sinosaurosphargis yunguiensis", "Nothosaurus zhangi", "Diandongosaurus acutidentatus"], "r": "Nothosaurus zhangi", "exp": "Nothosaurus zhangi était un sauroptérygien géant aux longues mâchoires dentées.", "src": ["A gigantic nothosaur — Scientific Reports", "https://www.nature.com/articles/srep07142"]},
 {"id": "LUO-12", "site": "LUO", "diff": "intermédiaire", "q": "Quel trait de Nothosaurus zhangi suggère un rôle de prédateur supérieur ?", "choix": ["Un bec édenté de brouteur", "Sa grande taille et ses longues mâchoires à dents saisissantes", "Une carapace de tortue", "Des sabots adaptés à la course"], "r": "Sa grande taille et ses longues mâchoires à dents saisissantes", "exp": "Le taxon possédait l’une des plus grandes mandibules connues chez les sauroptérygiens triasiques.", "src": ["A gigantic nothosaur — Scientific Reports", "https://www.nature.com/articles/srep07142"]},
 {"id": "LUO-13", "site": "LUO", "diff": "facile", "q": "Quel animal du pack est un ichthyosaure basal au corps fuselé ?", "choix": ["Atopodentatus unicus", "Diandongosaurus acutidentatus", "Phalarodon atavus", "Dinocephalosaurus orientalis"], "r": "Phalarodon atavus", "exp": "Phalarodon est un mixosauridé, groupe d’ichthyosaures du Trias moyen.", "src": ["Phalarodon — Wikipedia", "https://en.wikipedia.org/wiki/Phalarodon"]},
 {"id": "LUO-14", "site": "LUO", "diff": "intermédiaire", "q": "En quoi Phalarodon diffère-t-il d’un dauphin moderne malgré une silhouette hydrodynamique ?", "choix": ["Il s’agit d’un reptile marin et non d’un mammifère", "Il était un poisson cartilagineux", "Il respirait par des branchies", "Il possédait une carapace osseuse"], "r": "Il s’agit d’un reptile marin et non d’un mammifère", "exp": "La ressemblance est une convergence liée à la nage rapide.", "src": ["Phalarodon — Wikipedia", "https://en.wikipedia.org/wiki/Phalarodon"]},
 {"id": "LUO-15", "site": "LUO", "diff": "facile", "q": "Quelle petite créature gracile ressemblait encore à un lézard aquatique à long cou et longue queue ?", "choix": ["Diandongosaurus acutidentatus", "Sinosaurosphargis yunguiensis", "Atopodentatus unicus", "Nothosaurus zhangi"], "r": "Diandongosaurus acutidentatus", "exp": "Diandongosaurus est un petit pachypleurosaure aux membres et au corps allongés.", "src": ["Diandongosaurus — Scientific Reports", "https://www.nature.com/articles/s41598-021-01309-z"]},
 {"id": "LUO-16", "site": "LUO", "diff": "intermédiaire", "q": "Quel contraste écologique est le plus marqué ?", "choix": ["Phalarodon herbivore face à Diandongosaurus plante", "Sinosaurosphargis volant face à Dinocephalosaurus terrestre", "Tous avaient exactement le même régime", "Atopodentatus herbivore face à Nothosaurus prédateur"], "r": "Atopodentatus herbivore face à Nothosaurus prédateur", "exp": "Luoping combine des spécialisations alimentaires très diverses.", "src": ["The Luoping biota — Proceedings B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]},
 {"id": "LUO-17", "site": "LUO", "diff": "avancé", "q": "Quelle formulation décrit correctement le rétablissement après l’extinction de fin du Permien ?", "choix": ["La diversité et la complexité sont revenues progressivement, avec des innovations et radiations nouvelles", "Tous les écosystèmes ont retrouvé leur état antérieur en un an", "Les reptiles marins existaient déjà sous leur forme moderne", "Aucune espèce marine n’a survécu"], "r": "La diversité et la complexité sont revenues progressivement, avec des innovations et radiations nouvelles", "exp": "Luoping illustre une phase avancée, mais non instantanée, de la récupération triasique.", "src": ["The Luoping biota — Proceedings B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]},
 {"id": "LUO-18", "site": "LUO", "diff": "intermédiaire", "q": "Le biote de Luoping comprend-il seulement des reptiles marins ?", "choix": ["Oui, uniquement six reptiles", "Non, mais seulement des dinosaures terrestres", "Oui, à l’exception d’un mammifère", "Non, il comprend aussi poissons, arthropodes, mollusques et plantes"], "r": "Non, il comprend aussi poissons, arthropodes, mollusques et plantes", "exp": "La richesse de plusieurs groupes permet de reconstituer un réseau trophique complet.", "src": ["The Luoping biota — Proceedings B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]},
 {"id": "LUO-19", "site": "LUO", "diff": "avancé", "q": "Pourquoi les silhouettes de Luoping sont-elles un bon exemple de convergence évolutive ?", "choix": ["Toutes descendent directement d’un dauphin", "Elles possèdent toutes la même anatomie interne", "Plusieurs lignées différentes ont acquis des formes adaptées à la nage ou au fond marin", "Elles étaient fabriquées par le même organisme colonial"], "r": "Plusieurs lignées différentes ont acquis des formes adaptées à la nage ou au fond marin", "exp": "Fuselage, palettes natatoires, cou allongé et armures apparaissent dans des lignées distinctes.", "src": ["The Luoping biota — Proceedings B", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3119007/"]},
 {"id": "LUO-20", "site": "LUO", "diff": "intermédiaire", "q": "Quel animal doit être représenté avec un corps très large et aplati plutôt qu’avec une silhouette de nageur fuselé ?", "choix": ["Phalarodon atavus", "Nothosaurus zhangi", "Dinocephalosaurus orientalis", "Sinosaurosphargis yunguiensis"], "r": "Sinosaurosphargis yunguiensis", "exp": "Son tronc élargi et son armure produisaient une silhouette discoïde.", "src": ["Sinosaurosphargis — Wikipedia", "https://en.wikipedia.org/wiki/Sinosaurosphargis"]},
 {"id": "JUR-01", "site": "JUR", "diff": "facile", "q": "Où a vécu Spicomellus afer, le plus ancien ankylosaure connu ?", "choix": ["Au Maroc", "En Mongolie", "Au Canada", "En Argentine"], "r": "Au Maroc", "exp": "Ses fossiles proviennent de la Formation d'El Mers III, près de Boulemane dans le Moyen Atlas marocain, et datent d'environ 165 millions d'années. C'est aussi le premier ankylosaure décrit pour l'Afrique.", "src": ["Natural History Museum — Spicomellus afer", "https://www.nhm.ac.uk/discover/news/2025/august/bizarre-armoured-dinosaur-spicomellus-afer-rewrites-ankylosaur-evolution.html"]},
 {"id": "JUR-02", "site": "JUR", "diff": "moyen", "q": "Sur quoi reposait la première description de Spicomellus, en 2021 ?", "choix": ["Sur une seule côte portant des épines soudées", "Sur un squelette complet", "Sur une empreinte de peau", "Sur des œufs fossiles"], "r": "Sur une seule côte portant des épines soudées", "exp": "Une côte unique suffisait à établir l'espèce : aucun animal connu, vivant ou fossile, ne porte d'épines soudées directement à l'os. Les squelettes plus complets n'ont été décrits qu'en 2025.", "src": ["Sci.News — World's Oldest Ankylosaur", "https://www.sci.news/paleontology/spicomellus-afer-14173.html"]},
 {"id": "JUR-03", "site": "JUR", "diff": "difficile", "q": "Comment la côte fondatrice de Spicomellus est-elle arrivée au Musée d'histoire naturelle de Londres ?", "choix": ["Achetée à un marchand de fossiles, sans données de terrain précises", "Collectée lors d'une fouille programmée", "Léguée par un collectionneur du XIXᵉ siècle", "Trouvée dans les réserves du musée"], "r": "Achetée à un marchand de fossiles, sans données de terrain précises", "exp": "Susannah Maidment l'a acquise en 2019 auprès d'un marchand de Cambridge. On savait le fossile marocain, mais son gisement exact restait incertain — il a fallu retourner sur le terrain en 2022 et 2023 pour le retrouver.", "src": ["Natural History Museum — Spicomellus afer", "https://www.nhm.ac.uk/discover/news/2025/august/bizarre-armoured-dinosaur-spicomellus-afer-rewrites-ankylosaur-evolution.html"]},
 {"id": "JUR-04", "site": "JUR", "diff": "moyen", "q": "Quelle particularité du squelette de Spicomellus a surpris les chercheurs en 2025 ?", "choix": ["Un collier osseux portant des épines pouvant atteindre un mètre", "Une nageoire caudale", "Des plumes sur le dos", "Une double rangée de dents"], "r": "Un collier osseux portant des épines pouvant atteindre un mètre", "exp": "Aucun autre vertébré, vivant ou fossile, ne porte une armure aussi élaborée. Les vertèbres caudales soudées suggèrent en plus une arme au bout de la queue, trente millions d'années avant tout autre ankylosaure connu.", "src": ["Sci.News — World's Oldest Ankylosaur", "https://www.sci.news/paleontology/spicomellus-afer-14173.html"]},
 {"id": "JUR-05", "site": "JUR", "diff": "facile", "q": "Dans quel pays a été découvert Alpkarakush kyrgyzicus ?", "choix": ["Au Kirghizistan", "En Ouzbékistan", "En Mongolie", "Au Kazakhstan"], "r": "Au Kirghizistan", "exp": "Près de Tachkoumyr, dans la Formation de Balabansaï, datée du Callovien — environ 165 millions d'années. C'est le premier dinosaure théropode décrit pour le Kirghizistan.", "src": ["Sci.News — Alpkarakush kyrgyzicus", "https://www.sci.news/paleontology/alpkarakush-kyrgyzicus-13198.html"]},
 {"id": "JUR-06", "site": "JUR", "diff": "moyen", "q": "D'où vient le nom d'Alpkarakush ?", "choix": ["D'un oiseau géant de l'épopée kirghize de Manas", "Du nom de son découvreur", "D'un mot signifiant « griffe »", "Du nom de la rivière voisine"], "r": "D'un oiseau géant de l'épopée kirghize de Manas", "exp": "L'épopée de Manas est le grand poème traditionnel kirghize. Nommer un fossile d'après la culture du pays où il a été trouvé est devenu une pratique courante, et une manière de reconnaître les équipes locales.", "src": ["Sci.News — Alpkarakush kyrgyzicus", "https://www.sci.news/paleontology/alpkarakush-kyrgyzicus-13198.html"]},
 {"id": "JUR-07", "site": "JUR", "diff": "difficile", "q": "Pourquoi la découverte d'Alpkarakush comble-t-elle un vide important ?", "choix": ["Aucun grand prédateur jurassique n'était connu entre l'Europe et l'Asie de l'Est", "C'était le premier théropode à plumes", "C'était le plus grand théropode connu", "Il datait du Trias, avant les autres théropodes"], "r": "Aucun grand prédateur jurassique n'était connu entre l'Europe et l'Asie de l'Est", "exp": "Allosaurus occupait l'Amérique du Nord et l'Europe occidentale, les métriacanthosauridés la Chine ; l'immense région intermédiaire restait vide sur les cartes. Une absence de fossiles n'est pas une absence d'animaux.", "src": ["Sci.News — Alpkarakush kyrgyzicus", "https://www.sci.news/paleontology/alpkarakush-kyrgyzicus-13198.html"]},
 {"id": "JUR-08", "site": "JUR", "diff": "moyen", "q": "Combien de temps s'est écoulé entre la découverte des premiers restes d'Alpkarakush et sa description ?", "choix": ["Environ dix-huit ans", "Quelques mois", "Deux ans", "Plus d'un siècle"], "r": "Environ dix-huit ans", "exp": "Les premiers os sont trouvés en 2006 par le paléontologue kirghize Aizek Bakirov ; les campagnes s'étalent jusqu'en 2023 et la description paraît en 2024. Extraire, préparer et comparer un squelette prend des années.", "src": ["Phys.org — A new predatory dinosaur with a distinctive eyebrow", "https://phys.org/news/2024-08-paleontologists-predatory-dinosaur-distinctive-eyebrow.html"]},
 {"id": "JUR-09", "site": "JUR", "diff": "moyen", "q": "Qu'est-ce qui distingue Fujianvenator prodigiosus de tous les autres théropodes mésozoïques ?", "choix": ["Ses membres postérieurs très allongés, tibia deux fois plus long que le fémur", "L'absence totale de queue", "Ses quatre ailes", "Sa taille, la plus grande du Jurassique"], "r": "Ses membres postérieurs très allongés, tibia deux fois plus long que le fémur", "exp": "Cette proportion est inconnue chez les autres dinosaures non aviens. Elle évoque un coureur rapide ou un échassier, alors que les autres avialiens jurassiques sont interprétés comme arboricoles.", "src": ["Sci.News — Fujianvenator prodigiosus", "https://www.sci.news/paleontology/fujianvenator-prodigiosus-12246.html"]},
 {"id": "JUR-10", "site": "JUR", "diff": "difficile", "q": "Qu'est-ce que la faune de Zhenghe, décrite en même temps que Fujianvenator ?", "choix": ["Un assemblage de vertébrés du Jurassique supérieur, daté par radioisotopes entre 148 et 150 Ma", "Un gisement d'ambre crétacé", "Une faune marine du Trias", "Un ensemble d'empreintes de pas"], "r": "Un assemblage de vertébrés du Jurassique supérieur, daté par radioisotopes entre 148 et 150 Ma", "exp": "Le gisement du Fujian a livré plus d'une centaine de vertébrés, surtout aquatiques et semi-aquatiques : poissons, tortues, choristodères. Le milieu était marécageux, ce qui éclaire l'anatomie de Fujianvenator.", "src": ["EurekAlert — Chinese paleontologists find new fossil link in bird evolution", "https://www.eurekalert.org/news-releases/1000320"]},
 {"id": "JUR-11", "site": "JUR", "diff": "moyen", "q": "Que désigne le « mosaïcisme évolutif » observé chez Fujianvenator ?", "choix": ["La combinaison de caractères propres à plusieurs groupes voisins chez un même animal", "Un motif de coloration en damier", "Un fossile composé de plusieurs individus", "Une roche formée de plusieurs couches"], "r": "La combinaison de caractères propres à plusieurs groupes voisins chez un même animal", "exp": "Fujianvenator mêle des traits d'avialiens, de troodontidés et de dromæosauridés. Les caractères n'évoluent pas en bloc : c'est ce qui rend l'arbre des premiers oiseaux si difficile à établir.", "src": ["Sci.News — Fujianvenator prodigiosus", "https://www.sci.news/paleontology/fujianvenator-prodigiosus-12246.html"]},
 {"id": "JUR-12", "site": "JUR", "diff": "facile", "q": "Quel record est attribué à Mamenchisaurus sinocanadorum ?", "choix": ["Le plus long cou connu chez un animal, environ 15 mètres", "Le plus lourd dinosaure connu", "La plus longue queue connue", "Le plus grand œuf connu"], "r": "Le plus long cou connu chez un animal, environ 15 mètres", "exp": "Soit plus de six fois le cou d'une girafe. L'animal n'est pourtant pas le plus grand dinosaure : son corps et sa queue restent modestes en comparaison.", "src": ["Natural History Museum — Longest ever necked dinosaur", "https://www.nhm.ac.uk/discover/news/2023/march/longest-ever-necked-dinosaur-discovered-in-china.html"]},
 {"id": "JUR-13", "site": "JUR", "diff": "difficile", "q": "Comment les chercheurs ont-ils estimé en 2023 la longueur du cou de Mamenchisaurus sinocanadorum ?", "choix": ["Par comparaison avec des parents proches mieux conservés, à partir de trois vertèbres seulement", "En mesurant directement un squelette complet", "En modélisant l'empreinte de pas", "En analysant l'ADN fossile"], "r": "Par comparaison avec des parents proches mieux conservés, à partir de trois vertèbres seulement", "exp": "L'espèce n'est connue que par quelques os du cou et du crâne. Le chiffre de 15,1 m est une inférence, pas une mesure — c'est d'ailleurs pour cela que les auteurs parlent d'un record « jusqu'à preuve du contraire ».", "src": ["Sci.News — Mamenchisaurus sinocanadorum", "https://www.sci.news/paleontology/mamenchisaurus-sinocanadorum-neck-11744.html"]},
 {"id": "JUR-14", "site": "JUR", "diff": "moyen", "q": "Qu'est-ce qui permettait à un cou de quinze mètres de rester léger ?", "choix": ["Des vertèbres creusées par des sacs aériens, en structure alvéolaire", "Des os en cartilage", "Une colonne vertébrale réduite à trois vertèbres", "Un cou rempli d'eau"], "r": "Des vertèbres creusées par des sacs aériens, en structure alvéolaire", "exp": "Comme chez les oiseaux, un réseau de sacs aériens envahit les os et les évide. Des côtes cervicales longues de quatre mètres servaient de haubans pour rigidifier l'ensemble.", "src": ["Natural History Museum — Longest ever necked dinosaur", "https://www.nhm.ac.uk/discover/news/2023/march/longest-ever-necked-dinosaur-discovered-in-china.html"]},
 {"id": "JUR-15", "site": "JUR", "diff": "facile", "q": "Quels traits attribués à Dilophosaurus par « Jurassic Park » sont des inventions ?", "choix": ["La collerette déployable et le crachat venimeux", "Les deux crêtes crâniennes", "La marche bipède", "Les dents recourbées"], "r": "La collerette déployable et le crachat venimeux", "exp": "Aucun fossile ne les documente. Les deux crêtes, elles, sont bien réelles — elles donnent son nom à l'animal, « lézard à deux crêtes ».", "src": ["National Geographic — Jurassic Park got almost everything wrong", "https://www.nationalgeographic.com/science/article/jurassic-park-got-almost-everything-wrong-about-iconic-dinosaur-dilophosaurus"]},
 {"id": "JUR-16", "site": "JUR", "diff": "difficile", "q": "Pourquoi croyait-on Dilophosaurus doté de mâchoires fragiles ?", "choix": ["Le spécimen de référence avait été largement reconstitué au plâtre, ce qui faussait la lecture", "Ses dents étaient minuscules", "On n'avait jamais trouvé de crâne", "Ses os avaient été écrasés par la pression"], "r": "Le spécimen de référence avait été largement reconstitué au plâtre, ce qui faussait la lecture", "exp": "La redescription de 2020 par Adam Marsh et Timothy Rowe, après nettoyage, montre au contraire une mâchoire robuste et de puissantes insertions musculaires. Une restauration ancienne peut égarer un siècle de lecture.", "src": ["UT Austin — Famous Jurassic Park dinosaur is less lizard, more bird", "https://news.utexas.edu/2020/07/07/famous-jurassic-park-dinosaur-is-less-lizard-more-bird/"]},
 {"id": "JUR-17", "site": "JUR", "diff": "moyen", "q": "Que contenaient les crêtes de Dilophosaurus, d'après l'étude de 2020 ?", "choix": ["Un réseau de cavités aériennes reliées aux sinus, comme chez les oiseaux", "De la moelle osseuse", "Des glandes à venin", "Rien : elles étaient pleines"], "r": "Un réseau de cavités aériennes reliées aux sinus, comme chez les oiseaux", "exp": "Ces cavités renforçaient une structure faite d'os très mince. Les crêtes étaient probablement recouvertes de kératine et pouvaient donc être bien plus hautes que l'os ne le laisse voir.", "src": ["UT Austin — Famous Jurassic Park dinosaur is less lizard, more bird", "https://news.utexas.edu/2020/07/07/famous-jurassic-park-dinosaur-is-less-lizard-more-bird/"]},
 {"id": "JUR-18", "site": "JUR", "diff": "moyen", "q": "Qu'avait Yi qi à la place d'une aile emplumée classique ?", "choix": ["Une membrane de peau tendue sur un long os en baguette issu du poignet", "Des écailles rigides", "Quatre ailes emplumées", "Une aile en os plein, sans peau"], "r": "Une membrane de peau tendue sur un long os en baguette issu du poignet", "exp": "Cet os, dit élément styliforme, n'existe chez aucun autre dinosaure. Il rappelle des solutions de chauves-souris ou d'écureuils volants, apparues indépendamment — un cas d'école de convergence.", "src": ["Sci.News — Membrane-winged dinosaurs were poor gliders", "https://www.sci.news/paleontology/gliding-scansoriopterygid-dinosaurs-08981.html"]},
 {"id": "JUR-19", "site": "JUR", "diff": "difficile", "q": "Que conclut l'étude aérodynamique de 2020 sur Yi qi ?", "choix": ["Il planait mal et ne pouvait pas voler activement : une voie sans lendemain", "Il volait aussi bien qu'un oiseau moderne", "Il ne quittait jamais le sol", "Il nageait plutôt qu'il ne volait"], "r": "Il planait mal et ne pouvait pas voler activement : une voie sans lendemain", "exp": "Faute de la musculature pectorale qu'exige le vol battu, Yi qi était limité au plané, et de façon médiocre. Les scansorioptérygidés représentent donc une conquête de l'air distincte de celle des oiseaux, et abandonnée.", "src": ["iScience — Aerodynamics show membrane-winged theropods were a poor gliding dead-end", "https://www.cell.com/iscience/fulltext/S2589-0042(20)30766-5"]},
 {"id": "JUR-20", "site": "JUR", "diff": "moyen", "q": "Qu'ont en commun Spicomellus, Dilophosaurus et Mamenchisaurus dans ce chantier ?", "choix": ["Leur image a changé après réexamen ou nouveaux fossiles, sans que l'animal ait bougé", "Ils vivaient tous au même endroit", "Ils appartiennent tous au même groupe", "Ils ont tous été découverts en 2020"], "r": "Leur image a changé après réexamen ou nouveaux fossiles, sans que l'animal ait bougé", "exp": "C'est le fil de ce chantier : une côte devient un animal couvert d'épines, un prédateur « fragile » retrouve ses mâchoires, trois vertèbres livrent un record. Ce qui change, c'est ce qu'on sait, pas ce qui a existé.", "src": ["Natural History Museum — Spicomellus afer", "https://www.nhm.ac.uk/discover/news/2025/august/bizarre-armoured-dinosaur-spicomellus-afer-rewrites-ankylosaur-evolution.html"]},
 {"id": "MOR-01", "site": "MOR", "diff": "facile", "q": "À quelle période appartient la Formation de Morrison ?", "choix": ["Au Crétacé supérieur", "Au Paléogène", "Au Jurassique supérieur", "Au Cambrien"], "r": "Au Jurassique supérieur", "exp": "La Formation de Morrison date approximativement de 157 à 150 millions d’années.", "src": ["U.S. National Park Service — Morrison Formation", "https://www.nps.gov/subjects/fossils/the-morrison-formation.htm"]},
 {"id": "MOR-02", "site": "MOR", "diff": "facile", "q": "Dans quelle région générale se trouve la Formation de Morrison ?", "choix": ["En Afrique australe", "Dans le nord de la France", "En Sibérie", "Dans l’ouest des États-Unis"], "r": "Dans l’ouest des États-Unis", "exp": "Elle s’étend sur une vaste partie de l’Ouest américain.", "src": ["U.S. National Park Service — Morrison Formation", "https://www.nps.gov/subjects/fossils/the-morrison-formation.htm"]},
 {"id": "MOR-03", "site": "MOR", "diff": "intermédiaire", "q": "Quels environnements dominaient la Morrison ?", "choix": ["Calotte glaciaire", "Océan profond uniquement", "Rivières, plaines inondables, lacs et zones saisonnièrement sèches", "Forêt de plantes à fleurs modernes uniquement"], "r": "Rivières, plaines inondables, lacs et zones saisonnièrement sèches", "exp": "Les sédiments enregistrent une mosaïque de milieux continentaux.", "src": ["U.S. National Park Service — Morrison Formation", "https://www.nps.gov/subjects/fossils/the-morrison-formation.htm"]},
 {"id": "MOR-04", "site": "MOR", "diff": "facile", "q": "Quel grand prédateur bipède est emblématique de la Morrison ?", "choix": ["Allosaurus fragilis", "Apatosaurus louisae", "Camarasaurus lentus", "Stegosaurus stenops"], "r": "Allosaurus fragilis", "exp": "Allosaurus est l’un des théropodes les plus fréquents de la formation.", "src": ["Allosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/allosaurus.html"]},
 {"id": "MOR-05", "site": "MOR", "diff": "intermédiaire", "q": "Quel trait distingue la tête d’Allosaurus ?", "choix": ["Trois cornes faciales", "Un bec sans dents", "Une large collerette osseuse", "De petites crêtes osseuses au-dessus des yeux"], "r": "De petites crêtes osseuses au-dessus des yeux", "exp": "Les crêtes lacrymales donnent à son crâne une silhouette caractéristique.", "src": ["Allosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/allosaurus.html"]},
 {"id": "MOR-06", "site": "MOR", "diff": "facile", "q": "Quel herbivore portait deux rangées de grandes plaques dorsales et des pointes caudales ?", "choix": ["Diplodocus carnegii", "Stegosaurus stenops", "Allosaurus fragilis", "Camarasaurus lentus"], "r": "Stegosaurus stenops", "exp": "Stegosaurus combine plaques dorsales et thagomizer à quatre pointes.", "src": ["Stegosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/stegosaurus.html"]},
 {"id": "MOR-07", "site": "MOR", "diff": "intermédiaire", "q": "Quelle fonction des plaques de Stegosaurus est la plus prudente ?", "choix": ["Elles ont probablement servi à l’affichage et peut-être à la thermorégulation", "Elles étaient des nageoires respiratoires", "Elles servaient uniquement à voler", "Elles contenaient des dents de réserve"], "r": "Elles ont probablement servi à l’affichage et peut-être à la thermorégulation", "exp": "Les fonctions exactes restent discutées; l’affichage est aujourd’hui fortement considéré.", "src": ["Stegosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/stegosaurus.html"]},
 {"id": "MOR-08", "site": "MOR", "diff": "facile", "q": "Quel sauropode avait une silhouette robuste et un crâne haut et court ?", "choix": ["Allosaurus fragilis", "Camarasaurus lentus", "Diplodocus carnegii", "Stegosaurus stenops"], "r": "Camarasaurus lentus", "exp": "Camarasaurus était plus trapu que Diplodocus, avec de grandes dents en forme de cuillère.", "src": ["Camarasaurus — NPS", "https://www.nps.gov/dino/learn/nature/camarasaurus.htm"]},
 {"id": "MOR-09", "site": "MOR", "diff": "intermédiaire", "q": "Quel régime alimentaire est le plus probable pour Camarasaurus ?", "choix": ["Prédateur piscivore", "Herbivore utilisant de grandes dents pour arracher la végétation", "Filtreur de plancton", "Durophage de coquillages"], "r": "Herbivore utilisant de grandes dents pour arracher la végétation", "exp": "Ses dents robustes contrastaient avec les dents fines de diplodocidés.", "src": ["Camarasaurus — NPS", "https://www.nps.gov/dino/learn/nature/camarasaurus.htm"]},
 {"id": "MOR-10", "site": "MOR", "diff": "facile", "q": "Quel sauropode se caractérisait par un très long cou, une longue queue en fouet et un crâne léger ?", "choix": ["Stegosaurus stenops", "Diplodocus carnegii", "Camarasaurus lentus", "Allosaurus fragilis"], "r": "Diplodocus carnegii", "exp": "Diplodocus est un diplodocidé gracile aux membres antérieurs relativement courts.", "src": ["Diplodocus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/diplodocus.html"]},
 {"id": "MOR-11", "site": "MOR", "diff": "intermédiaire", "q": "Où se trouvaient les narines osseuses de Diplodocus sur le crâne ?", "choix": ["Au bout de la queue", "Sous la mâchoire", "Haut sur le crâne, bien que les narines charnues aient pu être plus en avant", "Dans les pieds"], "r": "Haut sur le crâne, bien que les narines charnues aient pu être plus en avant", "exp": "La position des ouvertures osseuses ne fixe pas exactement celle des tissus mous externes.", "src": ["Diplodocus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/diplodocus.html"]},
 {"id": "MOR-12", "site": "MOR", "diff": "facile", "q": "Quel sauropode robuste de la Morrison a longtemps été confondu avec Brontosaurus dans l’histoire populaire ?", "choix": ["Apatosaurus", "Ceratosaurus", "Stegosaurus", "Allosaurus"], "r": "Apatosaurus", "exp": "Apatosaurus et Brontosaurus ont une histoire taxonomique complexe, aujourd’hui réévaluée.", "src": ["Apatosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/apatosaurus.html"]},
 {"id": "MOR-13", "site": "MOR", "diff": "intermédiaire", "q": "Quel trait distingue souvent Apatosaurus de Diplodocus ?", "choix": ["Une carapace complète", "Des bras transformés en ailes", "Un cou et un squelette plus massifs", "Une collerette et trois cornes"], "r": "Un cou et un squelette plus massifs", "exp": "Apatosaurus avait des vertèbres cervicales et une constitution plus robustes.", "src": ["Apatosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/apatosaurus.html"]},
 {"id": "MOR-14", "site": "MOR", "diff": "facile", "q": "Quel petit ornithopode rapide complète souvent les faunes de Morrison face aux géants ?", "choix": ["Yutyrannus huali", "Tyrannosaurus rex", "Dryosaurus altus", "Iguanodon bernissartensis"], "r": "Dryosaurus altus", "exp": "Dryosaurus était un herbivore bipède beaucoup plus petit que les sauropodes.", "src": ["Dryosaurus — Wikipedia", "https://en.wikipedia.org/wiki/Dryosaurus"]},
 {"id": "MOR-15", "site": "MOR", "diff": "intermédiaire", "q": "Pourquoi les sauropodes pouvaient-ils atteindre de très grandes tailles ?", "choix": ["Ils ne respiraient pas", "Leur plan corporel combinait quadrupédie, petits crânes et vertèbres pneumatisées", "Ils possédaient un squelette entièrement plein de fer", "Ils vivaient sans gravité"], "r": "Leur plan corporel combinait quadrupédie, petits crânes et vertèbres pneumatisées", "exp": "Les sacs aériens et os allégés ont contribué à soutenir des cous extrêmement longs.", "src": ["Why sauropods had long necks", "https://arxiv.org/abs/1209.5439"]},
 {"id": "MOR-16", "site": "MOR", "diff": "avancé", "q": "Quelle affirmation sur les dinosaures de Morrison est la plus rigoureuse ?", "choix": ["Ils appartiennent tous à la même famille", "Ils formaient toujours un seul troupeau mixte", "Ils vivaient exactement avec Tyrannosaurus", "Tous n’ont pas nécessairement vécu au même endroit et au même moment dans toute l’étendue de la formation"], "r": "Tous n’ont pas nécessairement vécu au même endroit et au même moment dans toute l’étendue de la formation", "exp": "La formation couvre une vaste zone et plusieurs millions d’années.", "src": ["U.S. National Park Service — Morrison Formation", "https://www.nps.gov/subjects/fossils/the-morrison-formation.htm"]},
 {"id": "MOR-17", "site": "MOR", "diff": "intermédiaire", "q": "Quel duo oppose deux stratégies de sauropodes : crâne robuste et dents larges contre museau léger et dents en crayons ?", "choix": ["Allosaurus et Stegosaurus", "Apatosaurus et Allosaurus", "Dryosaurus et Stegosaurus", "Camarasaurus et Diplodocus"], "r": "Camarasaurus et Diplodocus", "exp": "Les deux sauropodes exploitaient probablement la végétation de façons différentes.", "src": ["U.S. National Park Service — Morrison Formation", "https://www.nps.gov/subjects/fossils/the-morrison-formation.htm"]},
 {"id": "MOR-18", "site": "MOR", "diff": "avancé", "q": "Pourquoi le terme « Brontosaurus » n’est-il plus simplement considéré comme une erreur absolue ?", "choix": ["Il s’agit d’un mosasaure", "Le nom désigne maintenant Allosaurus", "Une révision phylogénétique a proposé de reconnaître à nouveau Brontosaurus comme genre distinct", "Le fossile a été découvert vivant"], "r": "Une révision phylogénétique a proposé de reconnaître à nouveau Brontosaurus comme genre distinct", "exp": "La validité exacte reste discutée, mais le genre a été ressuscité dans une analyse de 2015.", "src": ["Brontosaurus — PeerJ", "https://peerj.com/articles/857/"]},
 {"id": "MOR-19", "site": "MOR", "diff": "intermédiaire", "q": "Quelle arme défensive de Stegosaurus pouvait infliger des blessures graves ?", "choix": ["Les plaques du cou utilisées comme mâchoires", "Des cornes nasales", "Les dents de la queue", "Les pointes de la queue"], "r": "Les pointes de la queue", "exp": "Des lésions sur des os d’Allosaurus sont compatibles avec des coups de thagomizer.", "src": ["Stegosaurus — Natural History Museum", "https://www.nhm.ac.uk/discover/dino-directory/stegosaurus.html"]},
 {"id": "MOR-20", "site": "MOR", "diff": "avancé", "q": "Quel facteur rend les assemblages de dinosaures de la Morrison particulièrement riches ?", "choix": ["Une grande étendue d’affleurements et de nombreux dépôts fluviaux favorables à l’enfouissement", "Une conservation dans l’ambre de tous les animaux", "Une unique catastrophe mondiale", "Un océan sans sédiments"], "r": "Une grande étendue d’affleurements et de nombreux dépôts fluviaux favorables à l’enfouissement", "exp": "Les systèmes fluviaux ont transporté et enterré de nombreux restes dans une formation largement exposée.", "src": ["U.S. National Park Service — Morrison Formation", "https://www.nps.gov/subjects/fossils/the-morrison-formation.htm"]},
 {"id": "NEM-01", "site": "NEM", "diff": "facile", "q": "Dans quel pays affleure la Formation de Nemegt ?", "choix": ["En Mongolie", "En Chine", "Au Kazakhstan", "En Russie"], "r": "En Mongolie", "exp": "Elle occupe le sud du désert de Gobi et date de la fin du Crétacé, autour de 70 millions d'années. C'est l'un des gisements de dinosaures les plus riches au monde.", "src": ["Wikipédia — Formation de Nemegt", "https://fr.wikipedia.org/wiki/Formation_de_Nemegt"]},
 {"id": "NEM-02", "site": "NEM", "diff": "moyen", "q": "Qu'est-ce qui distingue le paysage de Nemegt de celui des formations plus anciennes du Gobi ?", "choix": ["Des rivières et des plaines inondables, au lieu d'un désert de dunes", "Une mer profonde", "Une calotte glaciaire", "Une chaîne volcanique active"], "r": "Des rivières et des plaines inondables, au lieu d'un désert de dunes", "exp": "Les formations sous-jacentes conservent des dunes éoliennes ; Nemegt livre poissons, tortues, crocodiliens et mollusques d'eau douce. Le Gobi de cette époque était vert et humide.", "src": ["Wikipédia — Formation de Nemegt", "https://fr.wikipedia.org/wiki/Formation_de_Nemegt"]},
 {"id": "NEM-03", "site": "NEM", "diff": "facile", "q": "De quel groupe Tarbosaurus bataar fait-il partie ?", "choix": ["Des tyrannosauridés", "Des sauropodes", "Des cératopsiens", "Des ptérosaures"], "r": "Des tyrannosauridés", "exp": "C'est le grand prédateur asiatique du Crétacé terminal, proche parent de Tyrannosaurus rex. On le trouve uniquement en Mongolie et, peut-être, dans le nord de la Chine.", "src": ["Wikipédia — Tarbosaurus", "https://fr.wikipedia.org/wiki/Tarbosaurus"]},
 {"id": "NEM-04", "site": "NEM", "diff": "moyen", "q": "Que s'est-il passé en 2012 avec un squelette de Tarbosaurus mis aux enchères à New York ?", "choix": ["La vente a été bloquée et le squelette rendu à la Mongolie", "Il a été acheté par un musée américain", "Il s'est révélé être un faux", "Il a été détruit pendant le transport"], "r": "La vente a été bloquée et le squelette rendu à la Mongolie", "exp": "Adjugé plus d'un million de dollars, il avait été sorti clandestinement du Gobi et déclaré en douane comme provenant de Grande-Bretagne. Il a été restitué en mai 2013.", "src": ["NPR — Stolen dinosaur heads back to Mongolia", "https://www.npr.org/sections/thetwo-way/2013/05/06/181689562/stolen-dinosaur-heads-back-to-mongolia"]},
 {"id": "NEM-05", "site": "NEM", "diff": "difficile", "q": "Que dit la loi mongole sur les fossiles de dinosaures ?", "choix": ["Ils appartiennent à l'État et ne peuvent être ni vendus ni exportés sans autorisation", "Ils appartiennent au propriétaire du terrain", "Ils sont librement commercialisables", "Ils sont détruits s'ils ne sont pas étudiés"], "r": "Ils appartiennent à l'État et ne peuvent être ni vendus ni exportés sans autorisation", "exp": "C'est ce qui a fondé la procédure américaine « United States v. One Tyrannosaurus Bataar Skeleton ». Un fossile mongol proposé sur le marché international est donc, sauf exception, d'origine illicite.", "src": ["Department of Justice — Prokopi plea", "https://www.justice.gov/archive/usao/nys/pressreleases/December12/ProkopiEricPleaPR.html"]},
 {"id": "NEM-06", "site": "NEM", "diff": "facile", "q": "Que connaissait-on de Deinocheirus entre 1965 et 2014 ?", "choix": ["Essentiellement une paire de bras géants", "Un squelette complet", "Seulement des empreintes", "Uniquement des œufs"], "r": "Essentiellement une paire de bras géants", "exp": "Deux bras de 2,4 mètres, trouvés par Zofia Kielan-Jaworowska lors des expéditions polono-mongoles. Le nom signifie « terrible main ». Le reste de l'animal est resté inconnu pendant près de cinquante ans.", "src": ["Wikipédia — Deinocheirus", "https://fr.wikipedia.org/wiki/Deinocheirus"]},
 {"id": "NEM-07", "site": "NEM", "diff": "moyen", "q": "À quoi ressemblait finalement Deinocheirus, une fois les squelettes complets décrits en 2014 ?", "choix": ["Un ornithomimosaure massif, à bec de canard et à bosse dorsale", "Un carnivore semblable à Tyrannosaurus", "Un sauropode à long cou", "Un ankylosaure cuirassé"], "r": "Un ornithomimosaure massif, à bec de canard et à bosse dorsale", "exp": "Onze mètres, plus de six tonnes, un bec édenté, une bosse portée par de hautes épines dorsales, et des gastrolithes dans l'estomac. Les grandes griffes servaient à ramener la végétation, pas à tuer.", "src": ["Wikipédia — Deinocheirus", "https://fr.wikipedia.org/wiki/Deinocheirus"]},
 {"id": "NEM-08", "site": "NEM", "diff": "difficile", "q": "Comment le crâne de Deinocheirus a-t-il été retrouvé ?", "choix": ["Pillé puis repéré dans une collection privée en Europe, et restitué à la Mongolie", "Découvert intact dans la carrière d'origine", "Reconstitué numériquement, faute d'original", "Retrouvé dans les réserves d'un musée polonais"], "r": "Pillé puis repéré dans une collection privée en Europe, et restitué à la Mongolie", "exp": "Les pilleurs avaient emporté crâne, mains et pieds. Un orteil resté dans la carrière s'est ajusté exactement au pied récupéré, prouvant qu'il s'agissait du même individu. La restitution date de mai 2014.", "src": ["Christian Science Monitor — Humongous, toothless wonder of a dinosaur unveiled", "https://www.csmonitor.com/Science/2014/1022/Humongous-toothless-wonder-of-a-dinosaur-unveiled"]},
 {"id": "NEM-09", "site": "NEM", "diff": "moyen", "q": "Que mangeait Deinocheirus, d'après les restes conservés dans son abdomen ?", "choix": ["Des végétaux et des poissons", "Uniquement de grands dinosaures", "Uniquement des insectes", "Rien : son estomac était vide"], "r": "Des végétaux et des poissons", "exp": "Un régime omnivore, cohérent avec un bec large de brouteur et un milieu de deltas et de rivières. Plus de mille gastrolithes accompagnaient ces restes : des pierres avalées pour broyer la nourriture.", "src": ["Wikipédia — Deinocheirus", "https://fr.wikipedia.org/wiki/Deinocheirus"]},
 {"id": "NEM-10", "site": "NEM", "diff": "moyen", "q": "Pour quoi Therizinosaurus cheloniformis est-il surtout connu ?", "choix": ["Ses griffes manuelles, parmi les plus longues connues chez un animal", "Sa vitesse de course", "Ses ailes", "Sa cuirasse dorsale"], "r": "Ses griffes manuelles, parmi les plus longues connues chez un animal", "exp": "L'os de la griffe atteint une cinquantaine de centimètres, et l'étui de kératine qui le recouvrait allongeait encore l'ensemble. Malgré cet outillage, l'animal était herbivore.", "src": ["Wikipédia — Therizinosaurus", "https://fr.wikipedia.org/wiki/Therizinosaurus"]},
 {"id": "NEM-11", "site": "NEM", "diff": "difficile", "q": "Pour quoi Therizinosaurus a-t-il d'abord été pris, lors de sa description en 1954 ?", "choix": ["Pour une tortue géante", "Pour un ptérosaure", "Pour un crocodile marin", "Pour un mammifère"], "r": "Pour une tortue géante", "exp": "Evgeny Maleev ne disposait que de griffes ; il y a vu les membres d'un immense reptile marin proche des tortues, d'où le nom d'espèce « cheloniformis ». Comme pour Deinocheirus, quelques os isolés ont suffi à égarer la lecture pendant des décennies.", "src": ["Wikipédia — Therizinosaurus", "https://fr.wikipedia.org/wiki/Therizinosaurus"]},
 {"id": "NEM-12", "site": "NEM", "diff": "facile", "q": "À quel groupe appartient Saurolophus angustirostris ?", "choix": ["Aux hadrosaures, les dinosaures à bec de canard", "Aux tyrannosauridés", "Aux ankylosaures", "Aux sauropodes"], "r": "Aux hadrosaures, les dinosaures à bec de canard", "exp": "C'est le grand herbivore de Nemegt, reconnaissable à la crête osseuse pleine, dirigée vers l'arrière, qui prolonge son crâne. L'espèce mongole dépasse en taille sa cousine nord-américaine.", "src": ["Wikipédia — Saurolophus", "https://fr.wikipedia.org/wiki/Saurolophus"]},
 {"id": "NEM-13", "site": "NEM", "diff": "moyen", "q": "Quelle particularité conservent certains spécimens de Saurolophus de Mongolie ?", "choix": ["Des empreintes de peau écailleuse", "Des plumes", "Des poils", "Des restes de coquille d'œuf collés au crâne"], "r": "Des empreintes de peau écailleuse", "exp": "L'enfouissement rapide dans les sédiments fluviatiles a permis de mouler le tégument. Cela reste rare : chez la plupart des dinosaures, l'aspect de la peau est inféré, pas observé.", "src": ["Wikipédia — Saurolophus", "https://fr.wikipedia.org/wiki/Saurolophus"]},
 {"id": "NEM-14", "site": "NEM", "diff": "moyen", "q": "Quelle arme portait Tarchia, l'ankylosaure de Nemegt ?", "choix": ["Une massue osseuse au bout de la queue", "Une corne nasale", "Des griffes rétractiles", "Des épines caudales empoisonnées"], "r": "Une massue osseuse au bout de la queue", "exp": "Formée d'ostéodermes soudés et portée par des vertèbres caudales rigidifiées en manche. Elle servait vraisemblablement autant contre les rivaux de la même espèce que contre les prédateurs.", "src": ["Wikipédia — Tarchia", "https://fr.wikipedia.org/wiki/Tarchia"]},
 {"id": "NEM-15", "site": "NEM", "diff": "facile", "q": "À quoi ressemblait Gallimimus bullatus ?", "choix": ["À une grande autruche à longue queue et bec édenté", "À un crocodile terrestre", "À un rhinocéros cuirassé", "À un lézard volant"], "r": "À une grande autruche à longue queue et bec édenté", "exp": "C'est un ornithomimosaure — littéralement « imitateur d'oiseau ». Il mesurait environ six mètres, ce qui en faisait le plus grand du groupe avant que Deinocheirus ne soit compris.", "src": ["Wikipédia — Gallimimus", "https://fr.wikipedia.org/wiki/Gallimimus"]},
 {"id": "NEM-16", "site": "NEM", "diff": "difficile", "q": "Qui a décrit Gallimimus, en 1972 ?", "choix": ["Halszka Osmólska, Ewa Roniewicz et Rinchen Barsbold", "Othniel Marsh", "Richard Owen", "John Ostrom"], "r": "Halszka Osmólska, Ewa Roniewicz et Rinchen Barsbold", "exp": "Les expéditions polono-mongoles des années 1960 et 1970, largement menées par des femmes paléontologues, ont fondé la connaissance des dinosaures du Gobi. Rinchen Barsbold est la figure majeure de la paléontologie mongole.", "src": ["Wikipédia — Gallimimus", "https://fr.wikipedia.org/wiki/Gallimimus"]},
 {"id": "NEM-17", "site": "NEM", "diff": "moyen", "q": "Quel est le point commun entre Deinocheirus et Therizinosaurus ?", "choix": ["Tous deux n'ont longtemps été connus que par leurs membres antérieurs, ce qui a faussé leur interprétation", "Tous deux étaient carnivores", "Tous deux vivaient dans l'eau", "Tous deux ont été découverts en 2014"], "r": "Tous deux n'ont longtemps été connus que par leurs membres antérieurs, ce qui a faussé leur interprétation", "exp": "Des bras pour l'un, des griffes pour l'autre. Dans les deux cas, on a imaginé de redoutables prédateurs, et dans les deux cas ce sont des herbivores ou des omnivores. Un fragment spectaculaire oriente le regard.", "src": ["Wikipédia — Deinocheirus", "https://fr.wikipedia.org/wiki/Deinocheirus"]},
 {"id": "NEM-18", "site": "NEM", "diff": "difficile", "q": "Pourquoi les crânes et les griffes sont-ils particulièrement visés par les pilleurs ?", "choix": ["Parce que ce sont les pièces les plus faciles à vendre", "Parce qu'ils sont les plus légers à transporter", "Parce qu'ils résistent mieux à l'érosion", "Parce qu'ils sont les seuls à se fossiliser"], "r": "Parce que ce sont les pièces les plus faciles à vendre", "exp": "Le reste du squelette est souvent abandonné ou saccagé sur place. Pour la science, la perte n'est pas seulement l'os manquant : c'est aussi le contexte géologique, définitivement détruit.", "src": ["Wikipédia — Deinocheirus", "https://fr.wikipedia.org/wiki/Deinocheirus"]},
 {"id": "NEM-19", "site": "NEM", "diff": "moyen", "q": "Quel milieu moderne sert souvent de comparaison au paysage de Nemegt ?", "choix": ["Le delta de l'Okavango, un delta intérieur", "La banquise arctique", "La forêt amazonienne", "Le récif de la Grande Barrière"], "r": "Le delta de l'Okavango, un delta intérieur", "exp": "Une rivière qui se déverse dans un bassin désertique et s'évapore au lieu d'atteindre la mer. Cela concentre la faune autour de zones marécageuses saisonnières, ce qui explique la richesse du gisement.", "src": ["Wikipédia — Formation de Nemegt", "https://fr.wikipedia.org/wiki/Formation_de_Nemegt"]},
 {"id": "NEM-20", "site": "NEM", "diff": "facile", "q": "À quelle période appartient la faune de Nemegt ?", "choix": ["À la fin du Crétacé, il y a environ 70 millions d'années", "Au Jurassique inférieur", "Au Trias", "Au Paléogène"], "r": "À la fin du Crétacé, il y a environ 70 millions d'années", "exp": "Soit quelques millions d'années seulement avant l'extinction de la limite Crétacé-Paléogène. Ces animaux comptent parmi les derniers grands dinosaures d'Asie.", "src": ["Wikipédia — Formation de Nemegt", "https://fr.wikipedia.org/wiki/Formation_de_Nemegt"]},
 {"id": "NWE-01", "site": "NWE", "diff": "facile", "q": "Dans quel pays furent découverts les célèbres iguanodons de Bernissart ?", "choix": ["Au Mexique", "En Inde", "En Belgique", "En Espagne"], "r": "En Belgique", "exp": "Les squelettes furent trouvés dans une mine de charbon du Hainaut.", "src": ["Institut des Sciences naturelles — Bernissart", "https://www.naturalsciences.be/en/discover-join/discover/the-bernissart-iguanodons-at-a-glance"]},
 {"id": "NWE-02", "site": "NWE", "diff": "facile", "q": "Combien de squelettes d’iguanodons relativement complets furent découverts à Bernissart ?", "choix": ["Aucun squelette, seulement des dents", "Plus de dix mille", "Environ trente", "Deux"], "r": "Environ trente", "exp": "La découverte de près de trente squelettes articulés fut exceptionnelle.", "src": ["Institut des Sciences naturelles — Bernissart", "https://www.naturalsciences.be/en/discover-join/discover/the-bernissart-iguanodons-at-a-glance"]},
 {"id": "NWE-03", "site": "NWE", "diff": "intermédiaire", "q": "À quelle profondeur approximative furent trouvés les iguanodons de Bernissart ?", "choix": ["À 3 mètres", "À la surface", "À 2 kilomètres", "À 322 mètres"], "r": "À 322 mètres", "exp": "Les mineurs les découvrirent profondément sous terre dans la fosse Sainte-Barbe.", "src": ["Institut des Sciences naturelles — Bernissart", "https://www.naturalsciences.be/en/discover-join/discover/the-bernissart-iguanodons-at-a-glance"]},
 {"id": "NWE-04", "site": "NWE", "diff": "facile", "q": "Quel trait rend Iguanodon bernissartensis immédiatement reconnaissable ?", "choix": ["Trois cornes faciales", "Une massue caudale", "Une grande pointe au pouce", "Une voile dorsale"], "r": "Une grande pointe au pouce", "exp": "La phalange du pouce formait une pointe robuste.", "src": ["Iguanodon — Collections IRSNB", "https://collections.naturalsciences.be/ssh-paleontology/masterpieces/bernissart"]},
 {"id": "NWE-05", "site": "NWE", "diff": "intermédiaire", "q": "Iguanodon se déplaçait-il uniquement sur deux pattes ?", "choix": ["Non, il nageait uniquement", "Oui, car ses bras étaient des ailes", "Oui, il ne pouvait jamais poser les mains", "Non, il pouvait probablement alterner bipédie et quadrupédie"], "r": "Non, il pouvait probablement alterner bipédie et quadrupédie", "exp": "Ses membres antérieurs robustes et ses mains adaptées soutiennent une locomotion facultativement quadrupède.", "src": ["Iguanodon — Collections IRSNB", "https://collections.naturalsciences.be/ssh-paleontology/masterpieces/bernissart"]},
 {"id": "NWE-06", "site": "NWE", "diff": "facile", "q": "Quel dinosaure du pack était un spinosauridé au long museau et à grande griffe du pouce ?", "choix": ["Hypsilophodon foxii", "Vectipelta barretti", "Baryonyx walkeri", "Iguanodon bernissartensis"], "r": "Baryonyx walkeri", "exp": "Baryonyx est connu par un squelette relativement complet découvert dans le Surrey.", "src": ["Natural History Museum — Baryonyx", "https://www.nhm.ac.uk/discover/how-did-baryonyx-change-what-we-knew-about-spinosaurs.html"]},
 {"id": "NWE-07", "site": "NWE", "diff": "intermédiaire", "q": "Quel contenu fossile soutient le régime piscivore de Baryonyx ?", "choix": ["Des feuilles intactes dans un jabot", "Des fanons", "Des noix fossilisées dans ses joues", "Des écailles de poisson dans la région abdominale"], "r": "Des écailles de poisson dans la région abdominale", "exp": "Le spécimen type contenait des restes de poisson, ainsi que des os d’un jeune iguanodontien.", "src": ["Natural History Museum — Baryonyx", "https://www.nhm.ac.uk/discover/how-did-baryonyx-change-what-we-knew-about-spinosaurs.html"]},
 {"id": "NWE-08", "site": "NWE", "diff": "facile", "q": "Quel petit herbivore bipède de l’île de Wight était léger et rapide ?", "choix": ["Iguanodon bernissartensis", "Prognathodon saturator", "Hypsilophodon foxii", "Vectipelta barretti"], "r": "Hypsilophodon foxii", "exp": "Hypsilophodon était un petit ornithopode gracile.", "src": ["Natural History Museum — Hypsilophodon", "https://www.nhm.ac.uk/discover/dino-directory/hypsilophodon.html"]},
 {"id": "NWE-09", "site": "NWE", "diff": "intermédiaire", "q": "Quelle ancienne idée sur Hypsilophodon est aujourd’hui abandonnée ?", "choix": ["Qu’il était bipède", "Qu’il vivait au Crétacé", "Qu’il était herbivore", "Qu’il vivait principalement dans les arbres"], "r": "Qu’il vivait principalement dans les arbres", "exp": "Ses pieds n’étaient pas adaptés à une vie arboricole spécialisée.", "src": ["Natural History Museum — Hypsilophodon", "https://www.nhm.ac.uk/discover/dino-directory/hypsilophodon.html"]},
 {"id": "NWE-10", "site": "NWE", "diff": "facile", "q": "Quel dinosaure cuirassé de l’île de Wight a été nommé en 2023 ?", "choix": ["Iguanodon bernissartensis", "Vectipelta barretti", "Baryonyx walkeri", "Hypsilophodon foxii"], "r": "Vectipelta barretti", "exp": "Vectipelta est un ankylosaure distinct de Polacanthus.", "src": ["Natural History Museum — Vectipelta", "https://www.nhm.ac.uk/press-office/new-dinosaur-named-for-natural-history-museum-professor-.html"]},
 {"id": "NWE-11", "site": "NWE", "diff": "intermédiaire", "q": "Quel type de défense possédait Vectipelta ?", "choix": ["Une voile de peau", "Une armure d’ostéodermes et des épines", "Des bois de cervidé", "Des tentacules venimeux"], "r": "Une armure d’ostéodermes et des épines", "exp": "Comme les autres ankylosaures, il portait une armure dermique.", "src": ["Natural History Museum — Vectipelta", "https://www.nhm.ac.uk/press-office/new-dinosaur-named-for-natural-history-museum-professor-.html"]},
 {"id": "NWE-12", "site": "NWE", "diff": "facile", "q": "Prognathodon saturator et Plioplatecarpus marshi étaient-ils des dinosaures ?", "choix": ["Oui, des théropodes", "Oui, des sauropodes", "Non, c’étaient des lézards marins mosasaures", "Non, des mammifères"], "r": "Non, c’étaient des lézards marins mosasaures", "exp": "Les mosasaures sont des squamates marins, parents éloignés des lézards et serpents.", "src": ["Mosasaur — Wikipedia", "https://en.wikipedia.org/wiki/Mosasaur"]},
 {"id": "NWE-13", "site": "NWE", "diff": "facile", "q": "Quel mosasaure du pack avait un crâne très robuste adapté à de fortes morsures ?", "choix": ["Prognathodon saturator", "Hypsilophodon foxii", "Baryonyx walkeri", "Plioplatecarpus marshi"], "r": "Prognathodon saturator", "exp": "Prognathodon saturator se distingue par un crâne massif et de grandes dents.", "src": ["Prognathodon saturator — Netherlands Journal of Geosciences", "https://njgjournal.nl/index.php/njg/article/view/11353"]},
 {"id": "NWE-14", "site": "NWE", "diff": "intermédiaire", "q": "Quel mosasaure du pack était plus gracile, avec un crâne relativement étroit ?", "choix": ["Prognathodon saturator", "Iguanodon bernissartensis", "Vectipelta barretti", "Plioplatecarpus marshi"], "r": "Plioplatecarpus marshi", "exp": "Plioplatecarpus offre un contraste de silhouette et probablement de niche avec Prognathodon.", "src": ["Plioplatecarpus — Wikipedia", "https://en.wikipedia.org/wiki/Plioplatecarpus"]},
 {"id": "NWE-15", "site": "NWE", "diff": "intermédiaire", "q": "Quel est le principal écart temporel du pack ?", "choix": ["Les mosasaures sont du Cambrien", "Tous sont exactement contemporains", "Les dinosaures sont surtout du Crétacé inférieur, les mosasaures de la fin du Crétacé supérieur", "Les dinosaures sont du Cénozoïque"], "r": "Les dinosaures sont surtout du Crétacé inférieur, les mosasaures de la fin du Crétacé supérieur", "exp": "Bernissart et l’île de Wight précèdent Maastricht d’environ soixante millions d’années.", "src": ["Institut des Sciences naturelles — Bernissart", "https://www.naturalsciences.be/en/discover-join/discover/the-bernissart-iguanodons-at-a-glance"]},
 {"id": "NWE-16", "site": "NWE", "diff": "avancé", "q": "Pourquoi le pack ne représente-t-il pas un seul écosystème ?", "choix": ["Toutes les espèces sont modernes", "Les animaux viennent de six planètes", "Il ne contient aucun fossile régional", "Il suit une région à travers une longue partie du Crétacé"], "r": "Il suit une région à travers une longue partie du Crétacé", "exp": "Le fil conducteur est géographique, pas la coexistence immédiate.", "src": ["Institut des Sciences naturelles — Bernissart", "https://www.naturalsciences.be/en/discover-join/discover/the-bernissart-iguanodons-at-a-glance"]},
 {"id": "NWE-17", "site": "NWE", "diff": "intermédiaire", "q": "Quel duo offre le plus grand contraste entre un herbivore terrestre massif et un prédateur marin robuste ?", "choix": ["Iguanodon et Prognathodon", "Plioplatecarpus et Prognathodon", "Hypsilophodon et Vectipelta", "Baryonyx et Hypsilophodon"], "r": "Iguanodon et Prognathodon", "exp": "Ils occupaient des milieux et époques distincts mais incarnent les deux pôles du pack.", "src": ["Institut des Sciences naturelles — Bernissart", "https://www.naturalsciences.be/en/discover-join/discover/the-bernissart-iguanodons-at-a-glance"]},
 {"id": "NWE-18", "site": "NWE", "diff": "avancé", "q": "Pourquoi les mosasaures possédaient-ils une queue efficace pour la nage ?", "choix": ["La partie terminale portait une nageoire caudale soutenue par une flexion des vertèbres", "Ils possédaient des hélices", "Ils utilisaient uniquement leurs dents pour avancer", "Ils avaient une queue de castor osseuse"], "r": "La partie terminale portait une nageoire caudale soutenue par une flexion des vertèbres", "exp": "Les fossiles de tissus mous et l’anatomie vertébrale indiquent une nageoire caudale en croissant asymétrique.", "src": ["Mosasaur — Wikipedia", "https://en.wikipedia.org/wiki/Mosasaur"]},
 {"id": "NWE-19", "site": "NWE", "diff": "intermédiaire", "q": "Quel animal avait la plus grande griffe manuelle du pack ?", "choix": ["Baryonyx walkeri", "Prognathodon saturator", "Hypsilophodon foxii", "Plioplatecarpus marshi"], "r": "Baryonyx walkeri", "exp": "Son nom signifie « griffe lourde » et fait référence à la grande griffe du premier doigt.", "src": ["Natural History Museum — Baryonyx", "https://www.nhm.ac.uk/discover/how-did-baryonyx-change-what-we-knew-about-spinosaurs.html"]},
 {"id": "NWE-20", "site": "NWE", "diff": "avancé", "q": "Quelle affirmation est la plus rigoureuse sur la posture historique des iguanodons de Bernissart ?", "choix": ["Ils étaient des quadrupèdes à sabots", "Les montages anciens ont été corrigés car la posture verticale en kangourou était exagérée", "Ils ont toujours été montés exactement comme aujourd’hui", "Ils marchaient avec la queue traînant au sol"], "r": "Les montages anciens ont été corrigés car la posture verticale en kangourou était exagérée", "exp": "La compréhension biomécanique moderne place le tronc et la queue plus horizontalement.", "src": ["Institut des Sciences naturelles — Bernissart", "https://www.naturalsciences.be/en/discover-join/discover/the-bernissart-iguanodons-at-a-glance"]},
 {"id": "YIX-01", "site": "YIX", "diff": "facile", "q": "Dans quel pays se trouve la Formation de Yixian ?", "choix": ["Au Canada", "En Argentine", "Au Maroc", "En Chine"], "r": "En Chine", "exp": "La Formation de Yixian affleure notamment dans la province du Liaoning, au nord-est de la Chine.", "src": ["Yixian Formation — Wikipedia", "https://en.wikipedia.org/wiki/Yixian_Formation"]},
 {"id": "YIX-02", "site": "YIX", "diff": "facile", "q": "À quelle grande période appartient la Formation de Yixian ?", "choix": ["Au Cambrien", "Au Crétacé inférieur", "Au Permien supérieur", "Au Miocène"], "r": "Au Crétacé inférieur", "exp": "Les dépôts de Yixian datent du Crétacé inférieur, autour de 125 millions d’années.", "src": ["Yixian Formation — Wikipedia", "https://en.wikipedia.org/wiki/Yixian_Formation"]},
 {"id": "YIX-03", "site": "YIX", "diff": "intermédiaire", "q": "Quel contexte a favorisé la conservation exceptionnelle des fossiles de Yixian ?", "choix": ["Des dunes désertiques sans eau", "Des dépôts fins associés à des lacs et à une activité volcanique", "Des grottes calcaires récentes", "Des glaciers continentaux uniquement"], "r": "Des dépôts fins associés à des lacs et à une activité volcanique", "exp": "Cendres volcaniques et sédiments lacustres fins ont permis de préserver plumes, poils et contenus stomacaux.", "src": ["Yixian Formation — Wikipedia", "https://en.wikipedia.org/wiki/Yixian_Formation"]},
 {"id": "YIX-04", "site": "YIX", "diff": "facile", "q": "Quel grand tyrannosauroïde de Yixian portait un plumage filamentaire ?", "choix": ["Yutyrannus huali", "Confuciusornis sanctus", "Psittacosaurus lujiatunensis", "Repenomamus robustus"], "r": "Yutyrannus huali", "exp": "Yutyrannus est l’un des plus grands dinosaures connus avec une couverture de filaments préservée.", "src": ["Yutyrannus — Nature", "https://www.nature.com/articles/nature10906"]},
 {"id": "YIX-05", "site": "YIX", "diff": "intermédiaire", "q": "Que montre Yutyrannus au sujet du plumage chez les grands théropodes ?", "choix": ["Tous les grands théropodes étaient entièrement nus", "Les plumes n’existaient que chez les oiseaux modernes", "Une grande taille n’excluait pas une couverture filamentaire importante", "Les tyrannosauroïdes étaient des herbivores"], "r": "Une grande taille n’excluait pas une couverture filamentaire importante", "exp": "Les fossiles de Yutyrannus démontrent qu’un grand théropode pouvait porter un plumage étendu.", "src": ["Yutyrannus — Nature", "https://www.nature.com/articles/nature10906"]},
 {"id": "YIX-06", "site": "YIX", "diff": "facile", "q": "Quelle petite espèce fut l’un des premiers dinosaures non aviens découverts avec des filaments corporels ?", "choix": ["Repenomamus robustus", "Psittacosaurus lujiatunensis", "Sinosauropteryx prima", "Yutyrannus huali"], "r": "Sinosauropteryx prima", "exp": "Sinosauropteryx a joué un rôle majeur dans la reconnaissance des dinosaures à plumes.", "src": ["Australian Museum — Sinosauropteryx", "https://australian.museum/learn/dinosaurs/fact-sheets/sinosauropteryx-prima/"]},
 {"id": "YIX-07", "site": "YIX", "diff": "intermédiaire", "q": "Quel détail de coloration a été proposé pour la queue de Sinosauropteryx ?", "choix": ["Une couleur métallique bleue uniforme prouvée", "Des ocelles de paon", "Une absence totale de pigment", "Des bandes claires et foncées alternées"], "r": "Des bandes claires et foncées alternées", "exp": "L’étude des mélanosomes a conduit à une reconstruction avec une queue annelée.", "src": ["Sinosauropteryx — Wikipedia", "https://en.wikipedia.org/wiki/Sinosauropteryx"]},
 {"id": "YIX-08", "site": "YIX", "diff": "facile", "q": "Quel dinosaure possédait un bec, une collerette courte et des soies sur la queue ?", "choix": ["Yutyrannus huali", "Psittacosaurus lujiatunensis", "Confuciusornis sanctus", "Sinosauropteryx prima"], "r": "Psittacosaurus lujiatunensis", "exp": "Psittacosaurus était un cératopsien basal et certains spécimens conservent de longues structures caudales.", "src": ["Psittacosaurus — Senckenberg", "https://museumfrankfurt.senckenberg.de/en/exhibition/permanent-exhibitions/dinosaurs/psittacosaurus/"]},
 {"id": "YIX-09", "site": "YIX", "diff": "intermédiaire", "q": "À quel grand groupe appartient Psittacosaurus ?", "choix": ["Aux ichthyosaures", "Aux sauropodes", "Aux mosasaures", "Aux cératopsiens"], "r": "Aux cératopsiens", "exp": "Psittacosaurus est un membre basal de la lignée qui comprend plus tard Triceratops.", "src": ["Psittacosaurus — Britannica", "https://www.britannica.com/animal/Psittacosaurus"]},
 {"id": "YIX-10", "site": "YIX", "diff": "facile", "q": "Quelle créature du pack est un mammifère ayant mangé de petits dinosaures ?", "choix": ["Yutyrannus huali", "Confuciusornis sanctus", "Psittacosaurus lujiatunensis", "Repenomamus robustus"], "r": "Repenomamus robustus", "exp": "Un spécimen de Repenomamus conserve les restes d’un jeune Psittacosaurus dans la région abdominale.", "src": ["Repenomamus — Nature", "https://www.nature.com/articles/433149a"]},
 {"id": "YIX-11", "site": "YIX", "diff": "intermédiaire", "q": "Pourquoi Repenomamus a-t-il modifié l’image traditionnelle des mammifères mésozoïques ?", "choix": ["Il possédait des ailes", "Il était plus grand qu’un sauropode", "Il montre que certains étaient assez grands et prédateurs pour consommer des dinosaures", "Il prouve que tous les mammifères étaient marins"], "r": "Il montre que certains étaient assez grands et prédateurs pour consommer des dinosaures", "exp": "Les mammifères du Mésozoïque n’étaient pas tous de minuscules insectivores nocturnes.", "src": ["Repenomamus — Nature", "https://www.nature.com/articles/433149a"]},
 {"id": "YIX-12", "site": "YIX", "diff": "facile", "q": "Quelle créature du pack est un oiseau à bec sans dents et à longues plumes caudales chez certains individus ?", "choix": ["Sinosauropteryx prima", "Psittacosaurus lujiatunensis", "Repenomamus robustus", "Confuciusornis sanctus"], "r": "Confuciusornis sanctus", "exp": "Confuciusornis est un oiseau basal connu par de très nombreux fossiles du biote de Jehol.", "src": ["Confuciusornis — Britannica", "https://www.britannica.com/animal/Confuciusornis"]},
 {"id": "YIX-13", "site": "YIX", "diff": "intermédiaire", "q": "Quel trait de Confuciusornis contraste avec plusieurs oiseaux mésozoïques plus primitifs ?", "choix": ["Un bec dépourvu de dents", "Des cornes frontales", "Quatre ailes complètes", "Une carapace osseuse"], "r": "Un bec dépourvu de dents", "exp": "Confuciusornis possédait un bec édenté, bien que d’autres caractères restent primitifs.", "src": ["Confuciusornis — Britannica", "https://www.britannica.com/animal/Confuciusornis"]},
 {"id": "YIX-14", "site": "YIX", "diff": "intermédiaire", "q": "Quelle affirmation sur les plumes est la plus rigoureuse ?", "choix": ["Aucune plume n’est conservée à Yixian", "Elles sont apparues uniquement pour permettre le vol", "Tous les dinosaures en avaient exactement le même type", "Elles ont évolué avant le vol battu moderne et remplissaient plusieurs fonctions"], "r": "Elles ont évolué avant le vol battu moderne et remplissaient plusieurs fonctions", "exp": "Isolation, affichage et incubation ont probablement précédé ou accompagné leur rôle aérodynamique.", "src": ["Natural History Museum — Feathered dinosaurs", "https://www.nhm.ac.uk/discover/feathered-dinosaurs.html"]},
 {"id": "YIX-15", "site": "YIX", "diff": "avancé", "q": "Pourquoi la présence de plumes ne transforme-t-elle pas automatiquement un dinosaure en oiseau ?", "choix": ["Les oiseaux sont une branche particulière de dinosaures théropodes, et les plumes sont plus largement réparties", "Parce que seuls les mammifères peuvent avoir des plumes", "Parce que les plumes fossiles sont toujours des plantes", "Parce que les oiseaux ne sont pas des animaux"], "r": "Les oiseaux sont une branche particulière de dinosaures théropodes, et les plumes sont plus largement réparties", "exp": "De nombreux dinosaures non aviens portaient des structures plumeuses.", "src": ["Natural History Museum — Feathered dinosaurs", "https://www.nhm.ac.uk/discover/feathered-dinosaurs.html"]},
 {"id": "YIX-16", "site": "YIX", "diff": "intermédiaire", "q": "Quel duo illustre le mieux une interaction trophique directe documentée par un contenu stomacal ?", "choix": ["Sinosauropteryx et Yutyrannus", "Yutyrannus et Confuciusornis", "Confuciusornis et Yutyrannus", "Repenomamus et Psittacosaurus"], "r": "Repenomamus et Psittacosaurus", "exp": "Les restes d’un jeune Psittacosaurus ont été trouvés dans un Repenomamus.", "src": ["Repenomamus — Nature", "https://www.nature.com/articles/433149a"]},
 {"id": "YIX-17", "site": "YIX", "diff": "avancé", "q": "Quelle précaution faut-il prendre avec les couleurs reconstituées à partir de mélanosomes ?", "choix": ["Elles ne fournissent aucune information", "Elles déterminent le comportement social avec certitude", "Elles permettent toujours de connaître chaque nuance exacte", "Elles sont mieux contraintes pour certaines zones et certains pigments que pour l’apparence complète"], "r": "Elles sont mieux contraintes pour certaines zones et certains pigments que pour l’apparence complète", "exp": "Les mélanosomes peuvent informer sur des teintes et motifs, mais la reconstruction complète garde des incertitudes.", "src": ["Sinosauropteryx — Wikipedia", "https://en.wikipedia.org/wiki/Sinosauropteryx"]},
 {"id": "YIX-18", "site": "YIX", "diff": "intermédiaire", "q": "Le biote de Jehol comprend-il uniquement des dinosaures ?", "choix": ["Oui, aucun autre groupe n’y est connu", "Non, mais seulement des trilobites", "Oui, sauf un unique mollusque marin", "Non, il comprend aussi oiseaux, mammifères, poissons, insectes et plantes"], "r": "Non, il comprend aussi oiseaux, mammifères, poissons, insectes et plantes", "exp": "Les gisements de Jehol préservent un écosystème continental et lacustre très riche.", "src": ["Jehol Biota — Wikipedia", "https://en.wikipedia.org/wiki/Jehol_Biota"]},
 {"id": "YIX-19", "site": "YIX", "diff": "avancé", "q": "Pourquoi les six espèces du pack ne doivent-elles pas être représentées comme une « famille » ?", "choix": ["Elles sont toutes les ancêtres directes les unes des autres", "Elles appartiennent à des branches très différentes et partagent surtout un contexte géologique régional", "Elles sont toutes des tyrannosaures", "Elles sont toutes des mammifères"], "r": "Elles appartiennent à des branches très différentes et partagent surtout un contexte géologique régional", "exp": "Le pack est géographique et écologique, non généalogique.", "src": ["Yixian Formation — Wikipedia", "https://en.wikipedia.org/wiki/Yixian_Formation"]},
 {"id": "YIX-20", "site": "YIX", "diff": "intermédiaire", "q": "Quel duo montre le plus clairement que le biote de Yixian comprenait aussi bien des oiseaux que des dinosaures non aviens ?", "choix": ["Repenomamus et Psittacosaurus", "Psittacosaurus et Yutyrannus", "Confuciusornis et Sinosauropteryx", "Yutyrannus et Sinosauropteryx"], "r": "Confuciusornis et Sinosauropteryx", "exp": "Confuciusornis est un oiseau basal, tandis que Sinosauropteryx est un dinosaure non avien à filaments.", "src": ["Jehol Biota — Wikipedia", "https://en.wikipedia.org/wiki/Jehol_Biota"]},
 {"id": "HC-01", "site": "HC", "diff": "facile", "q": "Que représente la Formation de Hell Creek ?", "choix": ["Les tout derniers millions d'années du Crétacé, juste avant l'extinction", "Le début du Jurassique", "Le milieu du Trias", "Les premiers temps du Cénozoïque"], "r": "Les tout derniers millions d'années du Crétacé, juste avant l'extinction", "exp": "Elle affleure dans le Montana, le Wyoming et les deux Dakotas, et se termine à la limite Crétacé-Paléogène, il y a 66 millions d'années. C'est notre meilleure fenêtre sur la veille de la crise.", "src": ["Wikipédia — Formation de Hell Creek", "https://fr.wikipedia.org/wiki/Formation_de_Hell_Creek"]},
 {"id": "HC-02", "site": "HC", "diff": "moyen", "q": "Quel indice géologique marque la limite Crétacé-Paléogène au sommet de Hell Creek ?", "choix": ["Une fine couche d'argile anormalement riche en iridium", "Une coulée de basalte", "Une couche de charbon épaisse", "Un banc de sel"], "r": "Une fine couche d'argile anormalement riche en iridium", "exp": "L'iridium est rare dans la croûte terrestre mais fréquent dans les météorites. C'est cette anomalie qui a mis les Alvarez sur la piste d'un impact, en 1980.", "src": ["Wikipédia — Extinction Crétacé-Paléogène", "https://fr.wikipedia.org/wiki/Extinction_Cr%C3%A9tac%C3%A9-Pal%C3%A9og%C3%A8ne"]},
 {"id": "HC-03", "site": "HC", "diff": "moyen", "q": "Comment poussait Tyrannosaurus rex, d'après le comptage des lignes de croissance de ses os ?", "choix": ["Très vite à l'adolescence, puis la croissance ralentissait fortement", "À vitesse constante toute sa vie", "Lentement d'abord, puis très vite après trente ans", "Il atteignait sa taille adulte en deux ans"], "r": "Très vite à l'adolescence, puis la croissance ralentissait fortement", "exp": "Les os portent des marques annuelles comparables aux cernes d'un arbre. Elles montrent une poussée d'environ quatre ans, entre quatorze et dix-huit ans, où l'animal gagnait plusieurs centaines de kilos par an.", "src": ["Wikipédia — Tyrannosaurus", "https://fr.wikipedia.org/wiki/Tyrannosaurus"]},
 {"id": "HC-04", "site": "HC", "diff": "difficile", "q": "Qu'est-ce que « Sue », spécimen FMNH PR 2081 ?", "choix": ["L'un des Tyrannosaurus les plus complets, vendu aux enchères en 1997", "Le premier Triceratops décrit", "Une momie d'Edmontosaurus", "Le nom du site de la limite K-Pg"], "r": "L'un des Tyrannosaurus les plus complets, vendu aux enchères en 1997", "exp": "Découvert en 1990 par Sue Hendrickson dans le Dakota du Sud, il a été adjugé plus de huit millions de dollars au Field Museum de Chicago, après un long conflit de propriété. Les prix atteints depuis pèsent sur l'accès des musées aux fossiles.", "src": ["Field Museum — Sue the T. rex", "https://www.fieldmuseum.org/exhibitions/sue-t-rex"]},
 {"id": "HC-05", "site": "HC", "diff": "facile", "q": "Combien de cornes portait Triceratops ?", "choix": ["Trois : deux au-dessus des yeux, une sur le nez", "Une seule, sur le nez", "Cinq", "Aucune : c'étaient des bosses de peau"], "r": "Trois : deux au-dessus des yeux, une sur le nez", "exp": "Le nom signifie « face à trois cornes ». La collerette osseuse, contrairement à celle de la plupart de ses parents, est pleine et ne présente pas de larges ouvertures.", "src": ["Wikipédia — Triceratops", "https://fr.wikipedia.org/wiki/Triceratops"]},
 {"id": "HC-06", "site": "HC", "diff": "difficile", "q": "Qu'a montré l'étude de plus de cinquante crânes de Triceratops replacés dans la stratigraphie de Hell Creek ?", "choix": ["Triceratops horridus occupe le bas de la formation, T. prorsus le tiers supérieur", "Les deux espèces vivaient exactement au même moment", "Il n'existe en réalité qu'une seule espèce", "Les deux formes sont mâle et femelle"], "r": "Triceratops horridus occupe le bas de la formation, T. prorsus le tiers supérieur", "exp": "Avec des formes intermédiaires au milieu. Cette séquence suggère une anagenèse : une lignée qui se transforme sur place, plutôt qu'un embranchement. Il fallait une position stratigraphique précise pour chaque crâne.", "src": ["PNAS — Evolutionary trends in Triceratops from the Hell Creek Formation", "https://www.pnas.org/doi/10.1073/pnas.1313334111"]},
 {"id": "HC-07", "site": "HC", "diff": "moyen", "q": "Que signifie qu'une lignée évolue par anagenèse ?", "choix": ["Elle se transforme progressivement sans se diviser en deux branches", "Elle se divise en plusieurs espèces filles", "Elle disparaît sans descendance", "Elle revient à une forme ancestrale"], "r": "Elle se transforme progressivement sans se diviser en deux branches", "exp": "L'espèce ancestrale n'existe plus une fois transformée : il n'y a jamais deux espèces en même temps. Le cas opposé, la cladogenèse, produit un branchement — et c'est lui que représentent les arbres phylogénétiques habituels.", "src": ["PNAS — Evolutionary trends in Triceratops from the Hell Creek Formation", "https://www.pnas.org/doi/10.1073/pnas.1313334111"]},
 {"id": "HC-08", "site": "HC", "diff": "facile", "q": "Quelle est la particularité d'Ankylosaurus magniventris ?", "choix": ["Un corps couvert d'ostéodermes et une massue caudale", "Un long cou", "Des ailes membraneuses", "Une crête creuse sur le crâne"], "r": "Un corps couvert d'ostéodermes et une massue caudale", "exp": "C'est le plus grand ankylosaure connu, décrit par Barnum Brown en 1908. Même ses paupières étaient ossifiées. Il reste pourtant connu par assez peu de matériel.", "src": ["Wikipédia — Ankylosaurus", "https://fr.wikipedia.org/wiki/Ankylosaurus"]},
 {"id": "HC-09", "site": "HC", "diff": "moyen", "q": "Que sont les « momies » d'Edmontosaurus ?", "choix": ["Des squelettes accompagnés d'empreintes étendues de peau", "Des corps momifiés par le sel", "Des fossiles enrobés d'ambre", "Des animaux congelés dans le pergélisol"], "r": "Des squelettes accompagnés d'empreintes étendues de peau", "exp": "Le terme est trompeur : il n'y a ni chair ni peau conservée, mais un moulage de la surface du corps dans le sédiment. Ces spécimens documentent l'écaillure et le contour réel de l'animal.", "src": ["Wikipédia — Edmontosaurus", "https://fr.wikipedia.org/wiki/Edmontosaurus"]},
 {"id": "HC-10", "site": "HC", "diff": "moyen", "q": "Comment Edmontosaurus broutait-il une végétation coriace ?", "choix": ["Avec des batteries de centaines de dents formant une surface de broyage continue", "En avalant ses aliments sans les mâcher", "Avec deux longues défenses", "Grâce à un gésier musculeux uniquement"], "r": "Avec des batteries de centaines de dents formant une surface de broyage continue", "exp": "Les dents, empilées en colonnes, se remplaçaient en continu à mesure de l'usure. Cette « batterie dentaire » est l'une des solutions les plus efficaces jamais apparues chez un herbivore terrestre.", "src": ["Wikipédia — Edmontosaurus", "https://fr.wikipedia.org/wiki/Edmontosaurus"]},
 {"id": "HC-11", "site": "HC", "diff": "facile", "q": "Qu'est-ce qui caractérise le crâne de Pachycephalosaurus ?", "choix": ["Un dôme osseux très épais sur le sommet de la tête", "Une crête creuse en tube", "Trois cornes frontales", "Un bec édenté et sans ornement"], "r": "Un dôme osseux très épais sur le sommet de la tête", "exp": "Le dôme peut atteindre une vingtaine de centimètres d'épaisseur, bordé de petites protubérances. Son usage exact reste débattu.", "src": ["Wikipédia — Pachycephalosaurus", "https://fr.wikipedia.org/wiki/Pachycephalosaurus"]},
 {"id": "HC-12", "site": "HC", "diff": "difficile", "q": "Où en est le débat sur l'usage du dôme de Pachycephalosaurus ?", "choix": ["Combat frontal, coups portés au flanc ou simple signal visuel : les trois hypothèses restent en lice", "Il est établi qu'il servait à creuser", "Il est établi qu'il servait à nager", "On sait qu'il ne servait à rien"], "r": "Combat frontal, coups portés au flanc ou simple signal visuel : les trois hypothèses restent en lice", "exp": "Certains dômes portent des lésions compatibles avec des chocs, d'autres non ; la géométrie arrondie rend le choc frontal glissant. Les os disent la structure, rarement le comportement.", "src": ["Wikipédia — Pachycephalosaurus", "https://fr.wikipedia.org/wiki/Pachycephalosaurus"]},
 {"id": "HC-13", "site": "HC", "diff": "moyen", "q": "Quelle hypothèse a été avancée à propos des genres Dracorex et Stygimoloch ?", "choix": ["Qu'ils seraient de jeunes Pachycephalosaurus, à différents stades de croissance", "Qu'ils seraient des faux", "Qu'ils seraient des cératopsiens", "Qu'ils viendraient de Mongolie"], "r": "Qu'ils seraient de jeunes Pachycephalosaurus, à différents stades de croissance", "exp": "Le dôme se serait épaissi et les cornes résorbées avec l'âge. L'hypothèse, proposée par Jack Horner et Mark Goodwin, reste discutée — mais elle rappelle qu'un juvénile peut être décrit comme une espèce à part.", "src": ["Wikipédia — Pachycephalosaurus", "https://fr.wikipedia.org/wiki/Pachycephalosaurus"]},
 {"id": "HC-14", "site": "HC", "diff": "moyen", "q": "Quel surnom a été donné à Anzu wyliei lors de sa description en 2014 ?", "choix": ["« Le poulet de l'enfer »", "« Le dragon du Dakota »", "« L'autruche cuirassée »", "« Le voleur d'œufs »"], "r": "« Le poulet de l'enfer »", "exp": "Le surnom joue sur son allure d'oiseau géant et sur la Formation de Hell Creek dont il provient. Anzu est par ailleurs un démon ailé de la mythologie mésopotamienne.", "src": ["Carnegie Museum of Natural History — Anzu wyliei", "https://carnegiemnh.org/anzu-wyliei/"]},
 {"id": "HC-15", "site": "HC", "diff": "difficile", "q": "Pourquoi la description d'Anzu wyliei a-t-elle compté ?", "choix": ["Elle a donné le premier bon aperçu des cænagnathidés, connus jusque-là par des restes très fragmentaires", "C'était le premier dinosaure à plumes", "C'était le plus grand théropode d'Amérique du Nord", "C'était le dernier dinosaure avant l'extinction"], "r": "Elle a donné le premier bon aperçu des cænagnathidés, connus jusque-là par des restes très fragmentaires", "exp": "Trois squelettes partiels couvrent ensemble presque tout le corps. Un groupe entier, resté obscur pendant près d'un siècle, est devenu lisible d'un coup.", "src": ["Carnegie Museum of Natural History — Anzu wyliei", "https://carnegiemnh.org/anzu-wyliei/"]},
 {"id": "HC-16", "site": "HC", "diff": "moyen", "q": "À quel grand groupe appartient Anzu wyliei ?", "choix": ["Aux oviraptorosaures, théropodes à bec édenté proches des oiseaux", "Aux hadrosaures", "Aux ankylosaures", "Aux sauropodes"], "r": "Aux oviraptorosaures, théropodes à bec édenté proches des oiseaux", "exp": "Crâne crêté, bec sans dents, longues pattes, bras à griffes crochues. Le régime était probablement généraliste : végétaux, petits animaux, peut-être des œufs.", "src": ["Carnegie Museum of Natural History — Anzu wyliei", "https://carnegiemnh.org/anzu-wyliei/"]},
 {"id": "HC-17", "site": "HC", "diff": "difficile", "q": "Pourquoi Hell Creek est-elle si importante pour comprendre l'extinction de la fin du Crétacé ?", "choix": ["Elle offre un enregistrement continu et très échantillonné jusqu'à la limite elle-même", "C'est le site de l'impact de l'astéroïde", "C'est le seul endroit où l'on trouve des dinosaures maastrichtiens", "Elle contient les fossiles les plus anciens du monde"], "r": "Elle offre un enregistrement continu et très échantillonné jusqu'à la limite elle-même", "exp": "On peut y suivre les faunes couche par couche et tester si les dinosaures déclinaient déjà avant l'impact, ou s'ils ont disparu brutalement. Le débat n'est pas clos, mais c'est ici qu'il se joue.", "src": ["Wikipédia — Formation de Hell Creek", "https://fr.wikipedia.org/wiki/Formation_de_Hell_Creek"]},
 {"id": "HC-18", "site": "HC", "diff": "moyen", "q": "À quoi ressemblait le paysage de Hell Creek il y a 67 millions d'années ?", "choix": ["Une plaine côtière chaude et humide, parcourue de rivières et de marécages", "Un désert de dunes", "Une toundra glacée", "Une chaîne de montagnes volcaniques"], "r": "Une plaine côtière chaude et humide, parcourue de rivières et de marécages", "exp": "La voie maritime intérieure d'Amérique du Nord se retirait alors vers le sud-est. Ce milieu subtropical explique l'abondance des plantes à fleurs, des tortues et des crocodiliens dans le gisement.", "src": ["Wikipédia — Formation de Hell Creek", "https://fr.wikipedia.org/wiki/Formation_de_Hell_Creek"]},
 {"id": "HC-19", "site": "HC", "diff": "facile", "q": "Quel groupe de dinosaures a survécu à l'extinction de la fin du Crétacé ?", "choix": ["Les oiseaux", "Les cératopsiens", "Les hadrosaures", "Les ankylosaures"], "r": "Les oiseaux", "exp": "Les oiseaux sont des dinosaures théropodes. Sur les six créatures de ce chantier, aucune lignée ne passe la limite ; mais une branche voisine, elle, la franchit et compte aujourd'hui plus de dix mille espèces.", "src": ["Wikipédia — Extinction Crétacé-Paléogène", "https://fr.wikipedia.org/wiki/Extinction_Cr%C3%A9tac%C3%A9-Pal%C3%A9og%C3%A8ne"]},
 {"id": "HC-20", "site": "HC", "diff": "difficile", "q": "Pourquoi la question « les dinosaures déclinaient-ils déjà avant l'impact ? » est-elle difficile à trancher ?", "choix": ["Parce qu'un déclin apparent peut refléter un défaut d'échantillonnage plutôt qu'une baisse réelle", "Parce qu'il n'existe aucun fossile de cette époque", "Parce que la datation est impossible au Crétacé", "Parce que tous les fossiles ont été détruits par l'impact"], "r": "Parce qu'un déclin apparent peut refléter un défaut d'échantillonnage plutôt qu'une baisse réelle", "exp": "Moins de roches fossilifères, ou moins de terrain prospecté, produisent mécaniquement moins d'espèces recensées. Distinguer un signal biologique d'un artefact d'échantillonnage est le problème central de la paléontologie quantitative.", "src": ["Wikipédia — Extinction Crétacé-Paléogène", "https://fr.wikipedia.org/wiki/Extinction_Cr%C3%A9tac%C3%A9-Pal%C3%A9og%C3%A8ne"]},
 {"id": "WHA-01", "site": "WHA", "diff": "facile", "q": "Les baleines sont-elles des poissons ?", "choix": ["Oui, des poissons osseux", "Oui, des poissons cartilagineux", "Non, ce sont des mammifères", "Non, ce sont des reptiles"], "r": "Non, ce sont des mammifères", "exp": "Elles respirent de l’air, allaitent et descendent de mammifères terrestres.", "src": ["Understanding Evolution — Whale evolution", "https://evolution.berkeley.edu/what-are-evograms/the-evolution-of-whales/"]},
 {"id": "WHA-02", "site": "WHA", "diff": "intermédiaire", "q": "Quel groupe vivant est le plus proche parent des cétacés ?", "choix": ["Les requins", "Les hippopotames au sein des cétartiodactyles", "Les phoques", "Les manchots"], "r": "Les hippopotames au sein des cétartiodactyles", "exp": "Les données moléculaires et fossiles placent baleines et hippopotames dans un même grand clade d’ongulés.", "src": ["Understanding Evolution — Whale evolution", "https://evolution.berkeley.edu/what-are-evograms/the-evolution-of-whales/"]},
 {"id": "WHA-03", "site": "WHA", "diff": "facile", "q": "Quel petit animal du pack ressemblait extérieurement à un chevrotain et était proche de l’origine des baleines ?", "choix": ["Aetiocetus cotylalveus", "Ambulocetus natans", "Basilosaurus isis", "Indohyus indirae"], "r": "Indohyus indirae", "exp": "Indohyus est un raoellidé semi-aquatique, proche parent des cétacés mais pas une baleine véritable.", "src": ["Indohyus — Nature", "https://www.nature.com/articles/nature06343"]},
 {"id": "WHA-04", "site": "WHA", "diff": "intermédiaire", "q": "Quel trait osseux d’Indohyus suggère une adaptation à l’eau ?", "choix": ["Des os épaissis servant de ballast", "Une carapace", "Des vertèbres pneumatisées", "Des ailes creuses"], "r": "Des os épaissis servant de ballast", "exp": "La pachyostose augmente la densité et aide un animal à rester immergé.", "src": ["Indohyus — Nature", "https://www.nature.com/articles/nature06343"]},
 {"id": "WHA-05", "site": "WHA", "diff": "facile", "q": "Quel cétacé basal était encore surtout terrestre et possédait de longues pattes ?", "choix": ["Maiacetus inuus", "Aetiocetus cotylalveus", "Basilosaurus isis", "Pakicetus attocki"], "r": "Pakicetus attocki", "exp": "Pakicetus avait une silhouette terrestre; son identité de cétacé se lit notamment dans l’oreille.", "src": ["Smithsonian — Evolution of Whales", "https://naturalhistory.si.edu/education/teaching-resources/life-science/evolution-whales-animation"]},
 {"id": "WHA-06", "site": "WHA", "diff": "intermédiaire", "q": "Quel caractère anatomique permet d’identifier Pakicetus comme cétacé malgré son allure terrestre ?", "choix": ["Une nageoire dorsale fossilisée", "Des fanons", "Une queue en croissant complète", "La structure spécialisée de l’os de l’oreille"], "r": "La structure spécialisée de l’os de l’oreille", "exp": "L’involucrum du périotique est un caractère diagnostique des cétacés.", "src": ["Smithsonian — Evolution of Whales", "https://naturalhistory.si.edu/education/teaching-resources/life-science/evolution-whales-animation"]},
 {"id": "WHA-07", "site": "WHA", "diff": "facile", "q": "Quel animal était une baleine amphibie capable de nager avec de grands pieds ?", "choix": ["Indohyus indirae", "Basilosaurus isis", "Ambulocetus natans", "Aetiocetus cotylalveus"], "r": "Ambulocetus natans", "exp": "Ambulocetus signifie « baleine qui marche et nage ».", "src": ["Understanding Evolution — Ambulocetus", "https://evolution.berkeley.edu/what-are-evograms/the-evolution-of-whales/"]},
 {"id": "WHA-08", "site": "WHA", "diff": "intermédiaire", "q": "Quel milieu est associé aux fossiles d’Ambulocetus ?", "choix": ["Un estuaire ou milieu côtier peu profond", "Un océan abyssal uniquement", "Un désert hyperaride", "Une forêt alpine"], "r": "Un estuaire ou milieu côtier peu profond", "exp": "Sédiments et isotopes indiquent un mode de vie amphibie.", "src": ["Understanding Evolution — Whale evolution", "https://evolution.berkeley.edu/what-are-evograms/the-evolution-of-whales/"]},
 {"id": "WHA-09", "site": "WHA", "diff": "facile", "q": "Quel protocétidé du pack pouvait encore se déplacer sur terre mais nageait déjà efficacement ?", "choix": ["Indohyus indirae", "Maiacetus inuus", "Pakicetus attocki", "Basilosaurus isis"], "r": "Maiacetus inuus", "exp": "Maiacetus conservait quatre membres porteurs tout en étant fortement adapté au milieu marin.", "src": ["Maiacetus — PLOS ONE", "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0004366"]},
 {"id": "WHA-10", "site": "WHA", "diff": "avancé", "q": "Quelle interprétation célèbre de Maiacetus reste discutée ?", "choix": ["Une carapace de tortue", "L’identification d’un petit squelette comme fœtus orienté pour une naissance terrestre", "La présence de plumes", "L’existence de branchies"], "r": "L’identification d’un petit squelette comme fœtus orienté pour une naissance terrestre", "exp": "Le matériel a été décrit comme une femelle gravide, mais cette interprétation a été contestée.", "src": ["Maiacetus — PLOS ONE", "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0004366"]},
 {"id": "WHA-11", "site": "WHA", "diff": "facile", "q": "Quel cétacé entièrement marin avait un corps extrêmement allongé ?", "choix": ["Indohyus indirae", "Basilosaurus isis", "Maiacetus inuus", "Pakicetus attocki"], "r": "Basilosaurus isis", "exp": "Basilosaurus avait une silhouette serpentiforme et de minuscules membres postérieurs.", "src": ["NCSE — Origin of Whales", "https://ncse.ngo/origin-whales-and-power-independent-evidence"]},
 {"id": "WHA-12", "site": "WHA", "diff": "intermédiaire", "q": "Pourquoi le nom Basilosaurus est-il trompeur ?", "choix": ["Il signifie « petite baleine »", "Il s’agit réellement d’un dinosaure", "Il désigne un requin", "Il signifie « lézard roi », mais l’animal est une baleine"], "r": "Il signifie « lézard roi », mais l’animal est une baleine", "exp": "Les premiers restes furent pris à tort pour ceux d’un reptile marin.", "src": ["NCSE — Origin of Whales", "https://ncse.ngo/origin-whales-and-power-independent-evidence"]},
 {"id": "WHA-13", "site": "WHA", "diff": "intermédiaire", "q": "À quoi servaient probablement les minuscules membres postérieurs de Basilosaurus ?", "choix": ["À broyer des coquillages", "À voler", "À porter des sabots fonctionnels", "À l’accouplement plutôt qu’à la marche"], "r": "À l’accouplement plutôt qu’à la marche", "exp": "Ils ne pouvaient plus soutenir le poids du corps sur terre.", "src": ["Basilosaurus — Britannica", "https://www.britannica.com/animal/Basilosaurus"]},
 {"id": "WHA-14", "site": "WHA", "diff": "facile", "q": "Quel animal du pack représente un mysticète basal encore pourvu de dents ?", "choix": ["Pakicetus attocki", "Aetiocetus cotylalveus", "Ambulocetus natans", "Indohyus indirae"], "r": "Aetiocetus cotylalveus", "exp": "Aetiocetus appartient à la lignée des baleines à fanons mais conserve une dentition adulte.", "src": ["Aetiocetus — Wikipedia", "https://en.wikipedia.org/wiki/Aetiocetus"]},
 {"id": "WHA-15", "site": "WHA", "diff": "avancé", "q": "Quelle question scientifique Aetiocetus aide-t-il à étudier ?", "choix": ["La sortie des vertébrés sur terre", "L’origine des plumes", "La transition de l’alimentation avec dents vers la filtration par fanons", "La formation des carapaces"], "r": "La transition de l’alimentation avec dents vers la filtration par fanons", "exp": "Des structures du palais ont été interprétées en lien avec l’apparition des fanons, mais le détail reste débattu.", "src": ["Aetiocetus — Systematic Biology", "https://academic.oup.com/sysbio/article/57/1/15/1698976"]},
 {"id": "WHA-16", "site": "WHA", "diff": "intermédiaire", "q": "Quelle tendance générale affecte les narines au cours de l’évolution des cétacés ?", "choix": ["Elles se déplacent vers les pieds", "Elles migrent progressivement vers le sommet du crâne", "Elles deviennent des branchies", "Elles disparaissent complètement"], "r": "Elles migrent progressivement vers le sommet du crâne", "exp": "Le déplacement accompagne la spécialisation à la respiration en surface.", "src": ["Smithsonian — Evolution of Whales", "https://naturalhistory.si.edu/education/teaching-resources/life-science/evolution-whales-animation"]},
 {"id": "WHA-17", "site": "WHA", "diff": "intermédiaire", "q": "Quelle tendance générale affecte les membres postérieurs ?", "choix": ["Ils portent des griffes géantes chez les baleines modernes", "Ils se réduisent puis perdent leur rôle locomoteur externe", "Ils se transforment en ailes", "Ils deviennent plus longs que le corps"], "r": "Ils se réduisent puis perdent leur rôle locomoteur externe", "exp": "Les cétacés actuels gardent des vestiges pelviens internes.", "src": ["Understanding Evolution — Whale evolution", "https://evolution.berkeley.edu/what-are-evograms/the-evolution-of-whales/"]},
 {"id": "WHA-18", "site": "WHA", "diff": "avancé", "q": "Pourquoi le pack ne doit-il pas être présenté comme une chaîne d’ancêtres directs ?", "choix": ["Parce que l’évolution ne produit jamais de parentés", "Parce que les fossiles sont artificiels", "Parce que toutes les espèces vivaient ensemble", "Les fossiles représentent des branches et grades proches, pas nécessairement chaque ancêtre exact"], "r": "Les fossiles représentent des branches et grades proches, pas nécessairement chaque ancêtre exact", "exp": "L’évolution est un arbre ramifié; une succession pédagogique ne signifie pas filiation directe.", "src": ["Understanding Evolution — Whale evolution", "https://evolution.berkeley.edu/what-are-evograms/the-evolution-of-whales/"]},
 {"id": "WHA-19", "site": "WHA", "diff": "intermédiaire", "q": "Quelle adaptation remplace les pattes comme principal moteur chez les cétacés pleinement marins ?", "choix": ["Le battement horizontal d’une queue de poisson", "Les oscillations verticales de la queue et de la nageoire caudale", "Le vol avec les nageoires pectorales", "La marche sur le fond"], "r": "Les oscillations verticales de la queue et de la nageoire caudale", "exp": "Les cétacés déplacent leur colonne dans un plan vertical, héritage de mammifères coureurs.", "src": ["Smithsonian — Evolution of Whales", "https://naturalhistory.si.edu/education/teaching-resources/life-science/evolution-whales-animation"]},
 {"id": "WHA-20", "site": "WHA", "diff": "avancé", "q": "Quel ensemble de preuves soutient l’évolution terrestre des baleines ?", "choix": ["La ressemblance avec les requins", "Uniquement des légendes marines", "Fossiles transitionnels, anatomie comparée, embryologie et ADN", "Une seule dent isolée"], "r": "Fossiles transitionnels, anatomie comparée, embryologie et ADN", "exp": "Plusieurs lignes de preuve indépendantes convergent vers la même histoire évolutive.", "src": ["NCSE — Origin of Whales", "https://ncse.ngo/origin-whales-and-power-independent-evidence"]},
];

/* ================================================================
   Bloc 2 : sites de fouille, économie, contenus d'entraînement.

   SITES est classé du plus ancien au plus récent : c'est l'ordre dans
   lequel la collection s'affiche, et il vaut mieux qu'il raconte le temps
   plutôt que le prix. Les coûts d'ouverture ne suivent donc pas cet ordre.

   x / y sont en pixels de monde.jpg (1535 × 1024). La carte est une image
   générée, sans projection rigoureuse : les positions sont calées par
   ajustement local sur des amers relevés dans l'image (mers intérieures,
   îles isolées), puis vérifiées à l'œil. Voir tools/pins.py et
   tools/AJOUT_PACK.md § 6. tools/qc.js revérifie qu'aucune n'est en mer.
   ================================================================ */

const SITES=[

 {id:'EDI', nom:'Côte d’Hiver, mer Blanche', court:'Mer Blanche', region:'Zimnie Gory, oblast d’Arkhangelsk',
  pays:'Russie', ere:'Édiacarien', age:'≈ 558–550 Ma', x:913, y:193,
  fond:'sites/EDI.webp', cout:600,
  accroche:"Avant les plans corporels modernes",
  intro:[
   "Des falaises rousses tombant dans la mer Blanche, à quelques centaines de kilomètres du cercle polaire. Il y a 555 millions d'années, ce fond marin peu profond était entièrement tapissé de tapis microbiens — un feutrage vivant, continu, sur lequel reposaient des organismes plats dont aucun ne portait de coquille, de dent ni de squelette.",
   "La faune de l'Édiacarien tire son nom des collines d'Ediacara, en Australie, où Reg Sprigg la signale en 1946. Les gisements de la mer Blanche sont travaillés depuis les années 1970 par des équipes soviétiques puis russes, autour de Mikhail Fedonkine. Ils livrent des spécimens en très grand nombre et, surtout, des traces de déplacement : on y voit non seulement des corps, mais des comportements.",
   "La conservation passe par ce qu'on appelle des masques mortuaires. Sous le tapis microbien, la décomposition précipite un film de pyrite qui moule le corps avant qu'il ne disparaisse. Ce que tu extrais n'est donc pas l'animal mais son empreinte. L'épaisseur réelle, l'orientation haut-bas, l'anatomie interne : presque tout cela est déduit, pas observé.",
   "D'où un long désaccord. Adolf Seilacher a proposé d'en faire un règne à part, les vendobiontes, sans lien avec les animaux actuels. En 2018, l'extraction de molécules dérivées du cholestérol dans un Dickinsonia de la mer Blanche a fait pencher la balance vers l'animal, au moins pour celui-là. Kimberella, elle, laisse des stries de broutage qui évoquent une bouche râpeuse de type mollusque. Pour plusieurs autres, la question reste entière.",
   "Ton chantier ouvre juste avant le Cambrien. Ce qui s'y trouve n'est pas une version primitive de ce qui suivra : combien de ces organismes ont laissé une descendance, personne ne le sait, et plusieurs n'en ont probablement laissé aucune."
  ]},

 {id:'TRI', nom:'Anti-Atlas marocain', court:'Anti-Atlas', region:'Alnif et Jbel Issoumour',
  pays:'Maroc', ere:'Cambrien → Dévonien', age:'≈ 509–393 Ma', x:712, y:418,
  fond:'sites/TRI.webp', cout:280,
  accroche:"Trois cents millions d’années de patience",
  intro:[
   "Sud du Maroc, entre Alnif et Erfoud, sur les contreforts de l'Anti-Atlas. Des calcaires dévoniens affleurent sur des dizaines de kilomètres, et toute une économie locale s'est bâtie autour de leur extraction : creuseurs, préparateurs, ateliers de dégagement à l'aiguille pneumatique. Une part considérable des trilobites visibles dans les musées et les collections du monde sort d'ici.",
   "Le groupe justifie l'attention. Les trilobites apparaissent au Cambrien inférieur et disparaissent à la fin du Permien : deux cent soixante-dix millions d'années d'existence, plus de vingt mille espèces décrites. Leur carapace est minéralisée en calcite, donc elle fossilise bien, et leurs formes changent vite. C'est la combinaison qui fait un bon fossile stratigraphique : on date une couche par les trilobites qu'elle contient.",
   "Leur particularité la plus remarquable tient aux yeux. Les cristallins sont en calcite — les seuls yeux minéraux connus chez un animal. Chez les phacopidés, chaque lentille est isolée dans sa propre alvéole, et sa structure en doublet corrige l'aberration sphérique. Une optique de ce raffinement, dans un animal du Dévonien, a été établie en analysant la géométrie des cristaux.",
   "Un avertissement sur le marché marocain. Le dégagement complet d'un trilobite épineux demande des semaines ; la tentation d'améliorer est forte. Composites assemblés à partir de plusieurs individus, épines rapportées, spécimens entièrement modelés au plâtre et repeints : la fraude est courante et parfois excellente. Devant un spécimen d'une perfection remarquable, la première question à se poser est de savoir combien il en reste d'origine.",
   "Un mot sur ce chantier : il suit un groupe, pas un gisement. Trois des six créatures viennent bien de l'Anti-Atlas, mais Paradoxides vient du pays de Galles, Trinucleus de Grande-Bretagne, et Olenoides du Schiste de Burgess — le même gisement qu'un autre de tes chantiers. Le point d'ancrage est ici parce que le Maroc fournit le gros du matériel, pas parce que tout s'y trouve."
  ]},

 {id:'BURG', nom:'Schiste de Burgess', court:'Burgess', region:'Yoho, Colombie-Britannique',
  pays:'Canada', ere:'Cambrien moyen', age:'≈ 508–505 Ma', x:204, y:266,
  fond:'sites/BURG.webp', cout:80,
  accroche:"La mer des formes impossibles",
  intro:[
   "Colombie-Britannique, 2 300 mètres d'altitude, sur la crête qui sépare le mont Field du mont Wapta. Une bande de schiste noir, épaisse de quelques mètres, conserve la faune d'une mer tropicale vieille de 508 millions d'années. À l'époque, ce fond marin se trouvait au pied d'un escarpement calcaire, sous une centaine de mètres d'eau, près de l'équateur.",
   "Le gisement est repéré en 1909 par Charles Doolittle Walcott, secrétaire de la Smithsonian Institution. Il y retourne chaque été jusqu'en 1924 et en extrait plus de soixante-cinq mille spécimens. Sa lecture est classique : il range ces animaux dans les grands groupes déjà connus. Personne ne conteste sérieusement pendant un demi-siècle.",
   "Ce qui rend Burgess irremplaçable tient à la taphonomie. Des coulées de boue ont enseveli les organismes vivants et les ont scellés dans un milieu pauvre en oxygène, sans charognards ni bactéries pour les défaire. Résultat : on lit les yeux, les branchies, le tube digestif, les appendices mous. Or les tissus mous représentent l'essentiel d'un animal, et l'essentiel de ce que la fossilisation ordinaire détruit.",
   "À partir des années 1970, Harry Whittington, Derek Briggs et Simon Conway Morris redécoupent chaque spécimen à la fraise et le redessinent en trois dimensions. Plusieurs animaux changent complètement de forme, et certains de règne. Stephen Jay Gould en tire en 1989 « La vie est belle », qui présente Burgess comme la preuve d'une expérimentation évolutive avortée. La discipline a depuis largement rangé ces bêtes dans des groupes existants — le débat sur ce que Burgess démontre reste ouvert.",
   "Ton chantier : six organismes dont les plans corporels ne ressemblent presque à rien de vivant. Attends-toi à des silhouettes qui semblent fausses. Elles ne le sont pas — mais plusieurs ont déjà été redessinées à l'envers, tête en bas ou pattes en l'air, par des chercheurs sérieux."
  ]},

 {id:'CEP', nom:'Groupe de Yezo, Hokkaidō', court:'Hokkaidō', region:'Hokkaidō, bassin de Yezo',
  pays:'Japon', ere:'Ordovicien → Crétacé', age:'≈ 470–66 Ma', x:1467, y:288,
  fond:'sites/CEP.webp', cout:680,
  accroche:"Ce que la coquille a osé",
  intro:[
   "Nord du Japon, île de Hokkaidō. Les sédiments marins crétacés du groupe de Yezo livrent des ammonites enfermées dans des concrétions, souvent avec la nacre intacte. C'est de là que provient Nipponites mirabilis, décrit par Hisakatsu Yabe en 1904 : une coquille qui ne s'enroule pas en spirale mais forme une série de coudes emmêlés, sans aucun axe apparent.",
   "Pour comprendre pourquoi c'est troublant, il faut voir à quoi sert une coquille de céphalopode. Ce n'est pas d'abord une armure, c'est un flotteur. La partie enroulée est cloisonnée en loges remplies de gaz, reliées par un siphon qui règle la quantité de liquide qu'elles contiennent. L'animal ajuste sa flottabilité comme un sous-marin. Une géométrie régulière garantit que le centre de gravité reste sous le centre de poussée, donc que l'animal reste droit.",
   "Nipponites et Diplomoceras rompent cette règle. On les a longtemps lus comme des formes dégénérées, des lignées en fin de course juste avant l'extinction. Les modélisations hydrodynamiques récentes racontent autre chose : une bête stable dans une position donnée, dérivant lentement et tournant sur elle-même, adaptée à la vie dans le plancton plutôt qu'à la nage. Ce n'était pas une erreur, c'était un autre métier.",
   "Le reste de la collection concerne les céphalopodes sans coquille externe, connus seulement par quelques gisements exceptionnels : La Voulte-sur-Rhône en Ardèche, où Vampyronassa conserve ses bras et ses ventouses ; les plattenkalks du Liban, où des poulpes crétacés gardent leur poche à encre ; l'Oxford Clay anglais, d'où sortent des bélemnites avec leurs crochets. Sans ces trois ou quatre sites, la moitié de l'histoire du groupe serait invisible.",
   "Un mot sur ce chantier : il suit un groupe sur quatre cents millions d'années et cinq continents, pas un gisement. Hokkaidō sert d'ancrage parce que Nipponites, l'emblème du lot, en provient. Les autres viennent de France, du Liban, d'Angleterre, d'Amérique du Nord et de l'Antarctique."
  ]},

 {id:'CHO', nom:'Calcaire de Bear Gulch', court:'Bear Gulch', region:'comté de Fergus, Montana',
  pays:'États-Unis', ere:'Dévonien → Permien', age:'≈ 410–272 Ma', x:238, y:294,
  fond:'sites/CHO.webp', cout:720,
  accroche:"Ce que le cartilage a essayé",
  intro:[
   "Une baie marine peu profonde du Carbonifère, dans ce qui est aujourd'hui le centre du Montana. Le calcaire de Bear Gulch s'y est déposé en lamines très fines, il y a environ 318 millions d'années, au fond d'un bassin mal oxygéné. Richard Lund et ses équipes l'exploitent depuis 1968 : plus de cent espèces de poissons, souvent avec le contour du corps, parfois avec de quoi distinguer les mâles des femelles.",
   "Un gisement pareil est une anomalie statistique pour les poissons cartilagineux. Le cartilage ne se minéralise presque pas : d'ordinaire, d'un requin fossile, il ne reste que les dents et les denticules de la peau. Des milliers d'espèces paléozoïques ne sont connues que par des dents isolées. Ici, on a le corps entier.",
   "Ce que ce corps entier révèle est déconcertant. Stethacanthus porte sur le dos une structure aplatie en brosse, couverte de denticules agrandis, sans équivalent moderne et sans fonction établie. Les inioptérygiens portent leurs nageoires pectorales très haut sur le corps, presque au-dessus de la tête. Belantsea a la silhouette compacte et le bec broyeur d'un poisson de récif — et n'est ni l'un ni l'autre.",
   "Le cas d'Helicoprion résume le problème du groupe. On connaît depuis la fin du XIXᵉ siècle une spirale de dents parfaitement conservée, et personne ne savait où la placer : sur le museau, sur la nageoire dorsale, dans la gorge. Il a fallu attendre 2013 et une tomographie menée au musée d'histoire naturelle de l'Idaho pour établir qu'elle occupait la mâchoire inférieure. Un siècle de reconstructions sûres d'elles, toutes fausses.",
   "Un mot sur ce chantier : il ne suit pas un lieu mais un clade. Bear Gulch sert de point d'ancrage parce que trois des six créatures en proviennent — Belantsea, Stethacanthus et les inioptérygiens. Les autres viennent d'ailleurs : Doliodus du Nouveau-Brunswick, Helicoprion de l'Idaho et des régions boréales, Edestus de plusieurs bassins nord-américains. Elles ne se sont jamais côtoyées."
  ]},

 {id:'HUN', nom:'Schistes du Hunsrück', court:'Hunsrück', region:'Bundenbach, Rhénanie-Palatinat',
  pays:'Allemagne', ere:'Dévonien inférieur', age:'≈ 408–400 Ma', x:759, y:301,
  fond:'sites/HUN.webp', cout:520,
  accroche:"La mer de pyrite",
  intro:[
   "Rhénanie-Palatinat, autour du village de Bundenbach. On y extrait depuis le Moyen Âge une ardoise de toiture fine et régulière, issue de boues marines déposées il y a environ quatre cents millions d'années. Les fossiles n'ont pas été cherchés : ils sont apparus dans les carrières, entre les mains des fendeurs d'ardoise, qui les mettaient de côté.",
   "Ce gisement conserve d'une manière qu'on ne retrouve presque nulle part ailleurs. Les tissus mous n'ont pas été moulés ni carbonisés : ils ont été remplacés par de la pyrite, très tôt, avant que la compaction n'écrase quoi que ce soit. Les branchies, les intestins, les appendices sont donc en sulfure de fer, en trois dimensions, à l'intérieur d'une roche noire.",
   "D'où une méthode d'observation inhabituelle. La pyrite est opaque à la lumière mais dense aux rayons X. À partir des années 1960, Wilhelm Stürmer, physicien chez Siemens, a radiographié systématiquement les dalles de Bundenbach — au laboratoire puis avec un appareil portable, directement en carrière. Il lisait les appendices sans ouvrir la roche.",
   "Cette avance technique a eu son revers. Stürmer voyait beaucoup, et parfois plus que ce que l'image contenait : certaines de ses restitutions de tissus mous ont dû être corrigées par la suite, une partie des structures relevant d'artefacts de la radiographie. La technique était juste, la prudence n'a pas toujours suivi. C'est un cas d'école : un instrument nouveau produit d'abord des découvertes, ensuite des malentendus.",
   "Ton chantier est ici parfaitement homogène — les six créatures sortent de la même ardoise, du même bras de mer dévonien. Tu y trouveras un pycnogonide géant, des poissons cuirassés parmi les premiers à mordre, et un radiodonte apparu cent millions d'années après la disparition supposée de son groupe."
  ]},

 {id:'DEV', nom:'Falaise de Miguasha', court:'Miguasha', region:'baie des Chaleurs, Gaspésie',
  pays:'Canada', ere:'Dévonien supérieur', age:'≈ 385–360 Ma', x:443, y:290,
  fond:'sites/DEV.webp', cout:480,
  accroche:"Inventer les jambes",
  intro:[
   "Une falaise de grès et de schiste au bord de la baie des Chaleurs, en Gaspésie. La Formation d'Escuminac s'y expose sur huit kilomètres et conserve la faune d'un estuaire du Dévonien supérieur, il y a environ 380 millions d'années. Le site est inscrit au patrimoine mondial depuis 1999, précisément pour ce qu'il documente : le passage de l'eau à la terre ferme.",
   "L'expression est trompeuse et il faut la corriger tout de suite. Les membres — humérus, radius, cubitus, doigts — n'ont pas été inventés pour marcher. Ils apparaissent chez des animaux entièrement aquatiques, qui s'en servent probablement à ramper au fond, à se caler dans la végétation, à se hisser dans des eaux peu profondes et encombrées. La marche est un usage tardif d'un outil construit pour autre chose.",
   "Eusthenopteron, décrit à Miguasha dès la fin du XIXᵉ siècle, en est la démonstration. C'est un poisson : nageoires à rayons, branchies, corps fusiforme. Mais dans sa nageoire pectorale on reconnaît un humérus, puis deux os, puis une série de petits éléments — l'architecture du membre des vertébrés terrestres, déjà en place, à l'intérieur d'une nageoire. Elpistostege, du même gisement, va plus loin encore : un spécimen complet décrit en 2020 montre de véritables phalanges dans la nageoire.",
   "Le reste de la séquence vient d'ailleurs, et son étoile a été trouvée sur commande. En 2004, Neil Shubin et son équipe cherchaient délibérément une forme intermédiaire ; ils ont daté les couches, choisi l'île d'Ellesmere dans l'Arctique canadien pour son âge et son milieu, et cherché quatre étés. Tiktaalik en est sorti : un cou mobile, des côtes solides, une nageoire capable de supporter le poids. Une prédiction qui se vérifie sur le terrain, c'est rare.",
   "Un mot sur ce chantier : Miguasha sert d'ancrage parce que deux des six créatures en proviennent et que le site est consacré à cette transition. Panderichthys vient de Lettonie, Tiktaalik du Nunavut, Acanthostega et Ichthyostega du Groenland oriental — où ils ont d'abord été reconstruits avec cinq doigts par habitude, avant qu'un réexamen des années 1990 ne montre qu'ils en avaient huit et sept."
  ]},

 {id:'CAR', nom:'Carrière d’East Kirkton', court:'East Kirkton', region:'Bathgate, West Lothian',
  pays:'Écosse', ere:'Carbonifère', age:'≈ 340–299 Ma', x:721, y:255,
  fond:'sites/CAR.webp', cout:400,
  accroche:"L’air des géants",
  intro:[
   "Une ancienne carrière près de Bathgate, à l'ouest d'Édimbourg. Il y a environ 331 millions d'années, l'endroit est un petit lac alimenté par des sources chaudes, dans un paysage volcanique. Les calcaires qui s'y déposent conservent des arthropodes terrestres et quelques-uns des premiers tétrapodes entièrement adaptés à la terre ferme, dans un état rare pour cette époque.",
   "Le fait marquant du Carbonifère est ailleurs, dans l'atmosphère. Les forêts de lycopodes produisent d'énormes quantités de matière ligneuse qui s'enfouit au lieu de se décomposer — c'est le charbon que nous brûlons encore. Ce carbone soustrait à l'air laisse derrière lui un excédent d'oxygène : les modèles géochimiques placent la teneur atmosphérique autour de trente à trente-cinq pour cent, contre vingt et un aujourd'hui.",
   "Cela compte pour les arthropodes, parce qu'ils ne possèdent pas de poumons. L'oxygène atteint leurs tissus par diffusion dans un réseau de trachées, et la diffusion impose un plafond de taille qui dépend directement de la concentration ambiante. Relever la concentration relève le plafond. D'où ce que tu vas déterrer : un mille-pattes de plus de deux mètres, une libellule de soixante-dix centimètres d'envergure, un scorpion terrestre de la taille d'un chat.",
   "La corrélation est réelle, l'explication n'est pas close. D'autres facteurs jouent : il n'existe encore aucun vertébré volant pour prélever ces insectes, et un gros insecte volant est contraint par la charge alaire autant que par l'oxygène. Le fait que les géants disparaissent au Permien, quand l'oxygène retombe, reste l'argument le plus fort — mais une corrélation entre deux courbes n'est pas un mécanisme démontré.",
   "Un mot sur ce chantier : East Kirkton sert d'ancrage parce que le scorpion Pulmonoscorpius en provient et que les eurypterides écossais y sont bien représentés. Les autres viennent d'ailleurs — Meganeura du bassin houiller de Commentry en France, Mazothairos et Euphoberia de Mazon Creek, un gisement que tu connais peut-être déjà."
  ]},

 {id:'MAZ', nom:'Mazon Creek', court:'Mazon Creek', region:'comté de Grundy, Illinois',
  pays:'États-Unis', ere:'Carbonifère, Pennsylvanien', age:'≈ 310–307 Ma', x:332, y:331,
  fond:'sites/MAZ.webp', cout:320,
  accroche:"Le delta des aberrations",
  intro:[
   "Nord de l'Illinois, il y a environ 309 millions d'années : un delta chargé de boue se déverse dans une mer tropicale peu profonde, en bordure d'une immense forêt de lycopodes. Les crues enfouissent les organismes en quelques heures, et un carbonate de fer précipite autour des cadavres en quelques jours. Chaque fossile se retrouve enfermé dans sa propre concrétion, comme dans un moule.",
   "Le gisement n'a pas été révélé par une expédition mais par l'extraction du charbon. Les terrils des mines à ciel ouvert, en particulier la fosse 11 près de Braidwood, ont livré des quantités énormes de concrétions ramassées à la main. Ce sont très largement des amateurs qui ont fait ce site. En 1958, Francis Tully, collectionneur du dimanche, rapporte au Field Museum une bête que personne n'arrive à identifier.",
   "La technique de terrain est restée artisanale : on laisse les concrétions geler et dégeler tout un hiver, et elles s'ouvrent d'elles-mêmes selon le plan du fossile. Deux faunes complètement différentes sortent du même gisement — l'assemblage de Braidwood, d'eau douce et terrestre, et celui d'Essex, franchement marin — parce que le delta enregistrait les deux milieux côte à côte.",
   "La bête de Francis Tully s'appelle Tullimonstrum gregarium. Elle est fossile officiel de l'État de l'Illinois, elle est connue par des milliers de spécimens, et on ne sait toujours pas à quel embranchement elle appartient. Une étude de 2016 en faisait un vertébré proche des lamproies ; d'autres travaux, dont un balayage tridimensionnel publié en 2023, contestent cette lecture. Essexella, longtemps tenue pour une méduse, a elle aussi été relue récemment comme une anémone fouisseuse.",
   "Ton chantier a donc cette particularité : la conservation y est excellente, le nombre de spécimens énorme, les collecteurs bénévoles — et la créature vedette reste sans domicile taxinomique. Abondance et clarté sont deux choses différentes."
  ]},

 {id:'KAR2', nom:'Bassin du Karoo', court:'Karoo', region:'Grand Karoo, province du Cap',
  pays:'Afrique du Sud', ere:'Permien moyen → Trias inférieur', age:'≈ 265–247 Ma', x:747, y:831,
  fond:'sites/KAR2.webp', cout:160,
  accroche:"Survivre à la fin du monde",
  intro:[
   "Une plaine semi-désertique d'Afrique du Sud, entaillée par des ravines et des collines à sommet plat. Sous tes pieds, plusieurs kilomètres de sédiments empilés presque sans interruption depuis le Carbonifère. Le Groupe de Beaufort, qui t'intéresse ici, couvre à lui seul une trentaine de millions d'années de vie continentale.",
   "C'est ce caractère continu qui fait la valeur du Karoo. Ailleurs, on dispose d'instantanés séparés par des lacunes. Ici, on peut suivre une faune couche après couche et voir qui disparaît, quand, et dans quel ordre. Aucun autre bassin au monde n'offre un enregistrement terrestre comparable de la plus grande extinction connue.",
   "Les premiers fossiles sont signalés dans les années 1830 par Andrew Geddes Bain, ingénieur des routes, qui les baptise « têtes de bélier ». Richard Owen les décrit à Londres. Robert Broom, puis Lieuwe Boonstra et James Kitching, en font au XXᵉ siècle l'une des collections de synapsides les plus riches du monde. Les Kitching ont fouillé le Karoo sur trois générations.",
   "L'événement central se situe il y a environ 252 millions d'années. Les trapps de Sibérie déversent des volumes de lave considérables pendant des centaines de milliers d'années ; le carbone libéré acidifie les océans et réchauffe le climat. Environ quatre espèces marines sur cinq disparaissent. Sur terre, les grands herbivores permiens s'effacent, et la faune du Trias inférieur se retrouve dominée par un très petit nombre de formes.",
   "Ton chantier raconte donc une séquence, pas une scène : un avant, une crise, une reconstruction. Les six créatures de ce site ne se sont jamais croisées toutes ensemble, et c'est exactement le point — chacune occupe sa place dans la colonne, et c'est cette place, autant que l'animal, qui porte l'information."
  ]},

 {id:'LUO', nom:'Biote de Luoping', court:'Luoping', region:'Luoping, Yunnan',
  pays:'Chine', ere:'Trias moyen, Anisien', age:'≈ 247–242 Ma', x:1210, y:440,
  fond:'sites/LUO.webp', cout:640,
  accroche:"La mer d’après l’apocalypse",
  intro:[
   "Sud-ouest de la Chine, province du Yunnan. Il y a environ 244 millions d'années, l'endroit est un bassin marin semi-fermé sur la marge orientale de la Téthys. Le calcaire s'y dépose en lamines millimétriques, dans une eau de fond pauvre en oxygène qui écarte les charognards. Le gisement est repéré en 2007 lors d'un levé géologique régional, et décrit à partir de 2008.",
   "Il faut le situer par rapport au Karoo. L'extinction de la fin du Permien s'est produite huit à dix millions d'années plus tôt. Or ce qu'on trouve ici n'est pas une faune convalescente : c'est un écosystème marin complet, avec des chaînes alimentaires à plusieurs niveaux et de grands prédateurs au sommet. Luoping sert donc à chiffrer une durée — le temps qu'il faut à une mer pour se reconstruire.",
   "La faune est dominée par des reptiles marins : nothosaures, ichtyosauriformes, saurosphargidés. S'y ajoutent des arthropodes, des poissons, des restes de plantes flottées. Ce sont pour la plupart des lignées apparues après la crise : la mer s'est reconstituée, mais avec d'autres acteurs. Ce n'est pas une restauration, c'est autre chose.",
   "Atopodentatus offre un bon avertissement méthodologique. Décrit en 2014 à partir de matériel abîmé, il est d'abord reconstitué avec un museau fendu verticalement, en fermeture éclair — une bête invraisemblable qui fait le tour du monde. Deux crânes mieux conservés, publiés en 2016, montrent en réalité une tête en marteau à bord tranchant, celle d'un herbivore qui raclait les algues du fond. La première reconstruction n'était pas malhonnête, elle était sous-informée.",
   "Ton chantier est donc une mesure autant qu'une collection : ce que tu en sors documente la vitesse à laquelle la vie marine reprend, après un effondrement qui avait emporté la grande majorité des espèces."
  ]},

 {id:'JUR', nom:'Faune de Zhenghe', court:'Zhenghe', region:'comté de Zhenghe, Fujian',
  pays:'Chine', ere:'Jurassique', age:'≈ 186–150 Ma', x:1308, y:402,
  fond:'sites/JUR.webp', cout:560,
  accroche:"Ce que l’on croyait savoir",
  intro:[
   "Sud-est de la Chine, province du Fujian. En 2023, une équipe y décrit un gisement jusque-là inconnu et lui donne un nom : la faune de Zhenghe. Plus de cent vertébrés, surtout aquatiques — poissons, tortues, choristodères — dans un milieu marécageux daté par radioisotopes entre 150 et 148 millions d'années. Un Lagerstätte jurassique entier, apparu sur les cartes en une publication.",
   "Ce chantier ne suit ni un lieu ni un groupe, mais une opération : la révision. Chacune de ses six créatures a modifié ce qu'on croyait établi, soit parce qu'elle était nouvelle, soit parce qu'on l'a relue. C'est le mécanisme ordinaire de la discipline, rarement mis en scène — on présente d'habitude les résultats, pas les corrections.",
   "Trois cas de découverte. Fujianvenator, l'hôte de Zhenghe, porte un tibia deux fois plus long que son fémur : un avialien coureur ou échassier, là où l'on attendait des grimpeurs. Alpkarakush comble une région entière laissée vide — aucun grand prédateur jurassique n'était connu entre l'Europe et la Chine. Spicomellus, d'abord établi sur une seule côte marocaine en 2021, s'est révélé en 2025 couvert d'épines dont certaines atteignent un mètre.",
   "Trois cas de relecture. Le cou de Mamenchisaurus, reconstitué en 2023 à quinze mètres à partir de trois vertèbres et de parents mieux conservés. Dilophosaurus, tenu pour un prédateur aux mâchoires fragiles jusqu'à ce qu'on comprenne que la faiblesse venait du plâtre de restauration, pas de l'os. Yi qi, dont l'aile membraneuse a d'abord évoqué un chaînon du vol des oiseaux avant que l'aérodynamique ne la range parmi les tentatives sans lendemain.",
   "Un mot sur ce chantier : il couvre trente-six millions d'années et cinq pays — Maroc, Kirghizistan, Chine, États-Unis. Zhenghe sert d'ancrage parce que Fujianvenator en provient et que ce gisement est lui-même la découverte la plus récente du lot. Aucune de ces six bêtes n'a croisé les autres."
  ]},

 {id:'MOR', nom:'Formation de Morrison', court:'Morrison', region:'Dinosaur National Monument, Utah',
  pays:'États-Unis', ere:'Jurassique supérieur', age:'≈ 157–148 Ma', x:244, y:340,
  fond:'sites/MOR.webp', cout:200,
  accroche:"Le mur d’os",
  intro:[
   "Une bande de sédiments qui court du Nouveau-Mexique au Montana, sur plus d'un million de kilomètres carrés. La Formation de Morrison s'est déposée entre 157 et 148 millions d'années, dans une plaine d'inondation saisonnièrement sèche, parcourue de rivières en tresses. C'est de très loin la source la plus riche de dinosaures du Jurassique supérieur, et la matrice de l'image populaire du dinosaure.",
   "Le chantier d'ancrage est la carrière Carnegie, dans l'Utah. Earl Douglass y trouve en 1909 une file de vertèbres affleurant dans le grès. L'extraction dure treize ans. En 1915, le site devient monument national ; en 1958, plutôt que de tout emporter, on construit un bâtiment autour de la paroi et on dégage les os sans les détacher. Quinze cents ossements restent en place dans la roche, visibles tels qu'ils ont été enfouis.",
   "Ce que la Formation de Morrison a surtout produit, c'est une querelle. Entre 1877 et 1892, Othniel Marsh et Edward Cope s'y affrontent par équipes interposées — sites saccagés, télégrammes interceptés, descriptions bâclées pour publier en premier. Ils nomment à eux deux plus de cent trente espèces, dont une bonne partie sont des doublons ou des chimères. Une part du travail taxinomique du XXᵉ siècle a consisté à démêler ce qu'ils avaient noué.",
   "Le cas d'Apatosaurus le montre bien. Marsh décrit Apatosaurus en 1877, puis Brontosaurus en 1879 : deux noms pour ce qui s'avérera, en 1903, un même genre. Le premier nom l'emporte, et « brontosaure » disparaît des publications tout en restant dans le langage courant pendant un siècle. Une étude de 2015 a rouvert le dossier et proposé de rendre au genre son autonomie ; la question n'est pas close.",
   "Un mot sur ce chantier : il couvre une formation entière, pas un point. Dinosaur National Monument sert d'ancrage parce que la paroi Carnegie est l'affleurement le plus documenté du lot. Trois créatures de l'index — Camarasaurus, Apatosaurus et Dryosaurus — attendent encore leur illustration et ne sont pas dans le tirage."
  ]},

 {id:'NWE', nom:'De Bernissart à Maastricht', court:'Bernissart', region:'Hainaut, Limbourg, sud de l’Angleterre',
  pays:'Belgique', ere:'Crétacé', age:'≈ 130–66 Ma', x:743, y:296,
  fond:'sites/NWE.webp', cout:120,
  accroche:"Trente iguanodons à trois cent vingt mètres",
  intro:[
   "Avril 1878, charbonnage de Bernissart, dans le Hainaut. À trois cent vingt-deux mètres sous terre, une galerie traverse une poche d'argile qui coupe la veine de houille. Les mineurs y trouvent des os. La poche est en réalité un cran, une cavité d'effondrement remplie de sédiments crétacés, et elle contient une trentaine de squelettes d'iguanodons presque complets. C'est, à ce jour, l'une des plus grosses découvertes de dinosaures jamais faites d'un seul tenant.",
   "Le Musée royal d'Histoire naturelle de Bruxelles y consacre des décennies. Louis Dollo passe sa carrière sur ce matériel et monte les squelettes debout, appuyés sur la queue comme des kangourous. Cette silhouette a occupé les salles de musée et les livres d'images pendant près d'un siècle avant d'être corrigée : on sait aujourd'hui que l'animal tenait le corps à l'horizontale, la queue raidie au-dessus du sol, et marchait volontiers à quatre pattes.",
   "Bernissart a aussi réglé une vieille erreur. Iguanodon était connu depuis les années 1820 par des dents isolées trouvées en Angleterre, et l'on avait retrouvé avec elles un os conique pointu. Faute de squelette articulé, on l'avait placé sur le museau, en corne de rhinocéros. Les squelettes belges, complets et en connexion, ont montré qu'il s'agissait du pouce.",
   "La seconde moitié de ce chantier se joue soixante millions d'années plus tard, dans la craie de Maastricht, à la toute fin du Crétacé. Des carrières de la Montagne Saint-Pierre sortent les mosasaures — de grands lézards marins. Le crâne trouvé là à la fin du XVIIIᵉ siècle, emporté à Paris par les troupes révolutionnaires, a servi à Georges Cuvier pour démontrer qu'une espèce peut réellement disparaître. L'étage géologique du Maastrichtien porte le nom de la ville.",
   "Ce chantier couvre donc une région et non un point : le Hainaut, le Limbourg néerlandais, l'île de Wight et le Surrey anglais. Bernissart sert d'ancrage parce que les iguanodons en viennent et que la collection est à Bruxelles. Les dinosaures de Wight et du Surrey, eux, appartiennent au Wealden, la même grande plaine deltaïque du Crétacé inférieur qui s'étendait alors sur toute la région."
  ]},

 {id:'YIX', nom:'Formation de Yixian', court:'Yixian', region:'Liaoning occidental',
  pays:'Chine', ere:'Crétacé inférieur', age:'≈ 126–120 Ma', x:1311, y:311,
  fond:'sites/YIX.webp', cout:360,
  accroche:"Le monde des plumes et des cendres",
  intro:[
   "Nord-est de la Chine, province du Liaoning. Il y a 125 millions d'années, la région est un plateau de lacs d'eau douce bordés de forêts et de volcans actifs. Les éruptions y déposent régulièrement des cendres fines qui asphyxient et ensevelissent des écosystèmes entiers en quelques heures, puis se déposent au fond des lacs anoxiques.",
   "L'ensemble forme le biote de Jehol, connu des paysans locaux bien avant les paléontologues. La révélation scientifique date de 1996, avec Sinosauropteryx : un petit dinosaure théropode entouré d'un halo de filaments. La question de l'origine des oiseaux, ouverte depuis l'Archaeopteryx de 1861, bascule en quelques années.",
   "La qualité de conservation est ici presque anormale. On lit les plumes structure par structure, les contenus stomacaux, parfois les organes. Depuis 2010, l'analyse des mélanosomes — les organites qui portent le pigment — permet de restituer une partie des motifs de coloration, ce qui était considéré comme définitivement perdu.",
   "Le revers existe. La valeur marchande de ces fossiles a nourri un marché parallèle et des faux : en 1999, l'« Archaeoraptor » présenté comme chaînon manquant s'avère un collage de deux animaux différents. Beaucoup de spécimens du Liaoning arrivent au laboratoire sans données de terrain fiables, ce qui complique leur datation et leur interprétation.",
   "Ton chantier : exploiter une conservation hors norme sans confondre ce qui est observé et ce qui est extrapolé. Le piège est symétrique du Karoo. Là-bas, on manque d'information ; ici, on risque d'en croire trop."
  ]},

 {id:'NEM', nom:'Bassin de Nemegt', court:'Nemegt', region:'désert de Gobi, Ömnögovi',
  pays:'Mongolie', ere:'Crétacé supérieur', age:'≈ 70–68 Ma', x:1200, y:315,
  fond:'sites/NEM.webp', cout:440,
  accroche:"Le Gobi vert",
  intro:[
   "Sud du désert de Gobi, falaises et canyons taillés dans des grès clairs. Il y a soixante-dix millions d'années, l'endroit n'était pas un désert : la Formation de Nemegt enregistre des rivières, des plaines inondables et des marécages. On y trouve des poissons, des tortues, des crocodiliens, des mollusques d'eau douce. Le contraste avec les formations sous-jacentes, faites de dunes fossiles, est net — c'est le Gobi vert.",
   "Un delta intérieur, sans doute : une rivière qui se déverse dans une cuvette désertique et s'y évapore au lieu d'atteindre la mer, comme l'Okavango aujourd'hui. Ce genre de milieu concentre la faune autour de zones humides saisonnières, ce qui explique la densité exceptionnelle du gisement.",
   "La connaissance de ces animaux vient largement des expéditions polono-mongoles des années 1960 et 1970, conduites notamment par Zofia Kielan-Jaworowska et Halszka Osmólska, puis du travail de Rinchen Barsbold. Deux de leurs trouvailles sont restées longtemps illisibles : une paire de bras de deux mètres quarante en 1965, des griffes géantes en 1954. Dans les deux cas on a imaginé de terribles prédateurs ; dans les deux cas il s'agit d'herbivores ou d'omnivores.",
   "Deinocheirus n'a été compris qu'en 2014 — cinquante ans après ses bras. Et son histoire dit l'autre face de ce gisement. Les carrières avaient été pillées ; crâne, mains et pieds manquaient. Ils ont été repérés dans une collection privée européenne et restitués à la Mongolie. Un orteil laissé sur place s'ajustait exactement au pied récupéré : c'est ce détail qui a prouvé qu'il s'agissait du même individu.",
   "La loi mongole est claire : les fossiles appartiennent à l'État et ne peuvent être ni vendus ni exportés. En 2012, un squelette de Tarbosaurus adjugé plus d'un million de dollars à New York a été saisi puis rendu. Ce que le pillage détruit n'est pas seulement l'os emporté — c'est le contexte géologique, qui ne se reconstitue jamais."
  ]},

 {id:'HC', nom:'Hell Creek', court:'Hell Creek', region:'Jordan, Montana',
  pays:'États-Unis', ere:'Crétacé terminal', age:'≈ 68–66 Ma', x:268, y:292,
  fond:'sites/HC.webp', cout:240,
  accroche:"Les deux derniers millions d’années",
  intro:[
   "Des badlands gris et ocre au bord du réservoir de Fort Peck, dans l'est du Montana. La Formation de Hell Creek s'étend sur quatre États et enregistre les tout derniers millions d'années du Crétacé. Au-dessus d'elle, une fine couche d'argile marque la limite avec le Paléogène. En dessous, une plaine côtière chaude et humide, bordant une voie maritime intérieure en train de se retirer.",
   "C'est le dernier chantier de ton atlas, et ce n'est pas un hasard : il ferme la séquence commencée à la mer Blanche, cinq cents millions d'années plus tôt. Les six créatures ici sont les plus célèbres du monde — Tyrannosaurus, Triceratops, Ankylosaurus — et elles ont toutes vécu dans les deux derniers millions d'années avant la crise.",
   "La fine couche d'argile qui coiffe la formation contient une quantité anormale d'iridium, métal rare dans la croûte terrestre et abondant dans les météorites. C'est cette anomalie qui a mis Luis et Walter Alvarez sur la piste d'un impact, en 1980. Le cratère de Chicxulub, au Yucatán, a été rattaché à l'événement une décennie plus tard.",
   "Ce que Hell Creek permet, plus que tout autre gisement, c'est de poser une question quantitative : les dinosaures déclinaient-ils déjà, ou ont-ils disparu d'un coup ? Le nombre de couches, la densité de prospection et la précision stratigraphique y rendent la question testable. Elle n'est pas tranchée, parce qu'un déclin apparent peut n'être qu'un défaut d'échantillonnage — moins de roches, moins d'espèces recensées, sans qu'aucune n'ait disparu.",
   "Le même terrain a livré un résultat plus discret et plus solide. Plus de cinquante crânes de Triceratops replacés couche par couche montrent Triceratops horridus dans la partie basse, Triceratops prorsus dans le tiers supérieur, et des formes intermédiaires entre les deux. Une lignée qui se transforme sur place, sans se diviser. C'est ta créature de ce chantier — celle du haut, la dernière."
  ]},

 {id:'WHA', nom:'Ouadi al-Hitan', court:'Ouadi al-Hitan', region:'dépression du Fayoum',
  pays:'Égypte', ere:'Éocène → Oligocène', age:'≈ 51–24 Ma', x:882, y:448,
  fond:'sites/WHA.webp', cout:760,
  accroche:"La vallée des baleines",
  intro:[
   "À une centaine de kilomètres au sud-ouest du Caire, un désert de grès sculpté par le vent. Il y a quarante millions d'années, c'était le fond d'un bras de la Téthys. Le site s'appelle Ouadi al-Hitan, la vallée des baleines : on y compte des centaines de squelettes d'archéocètes affleurant à même le sable. Il est inscrit au patrimoine mondial depuis 2005.",
   "Ce qui s'y trouve a réglé une vieille question. Darwin lui-même admettait ne pas savoir comment un mammifère terrestre avait pu devenir baleine. À Ouadi al-Hitan, plusieurs squelettes de Basilosaurus isis, un animal marin de seize mètres, conservent des membres postérieurs complets — minuscules, inutiles à la nage, mais avec fémur, tibia, pied et orteils. Les équipes de Philip Gingerich les documentent à partir de la fin des années 1980.",
   "Le reste de la séquence vient d'ailleurs, principalement du Pakistan et du Cachemire. Indohyus est un petit artiodactyle aux os anormalement denses, qui se réfugiait sans doute dans l'eau. Pakicetus vit à terre mais possède déjà l'oreille caractéristique des cétacés. Ambulocetus est amphibie. Maiacetus a été trouvé avec un fœtus en place, orienté tête la première comme chez les mammifères terrestres — indice, discuté, d'une mise bas hors de l'eau.",
   "L'argument décisif est venu d'un petit os de la cheville. En 2001, l'astragale de plusieurs archéocètes s'est révélée porter la double poulie caractéristique des artiodactyles, ces mammifères à doigts pairs. Les données moléculaires plaçaient déjà les cétacés à côté des hippopotames, contre l'avis d'une partie des anatomistes. Les deux approches se sont rejointes sur une cheville.",
   "Un mot sur ce chantier : il suit une lignée sur vingt-cinq millions d'années et trois continents, pas un gisement. Ouadi al-Hitan sert d'ancrage parce que Basilosaurus isis en provient et que le site tout entier est consacré à cette histoire. Les cinq autres créatures viennent d'Inde, du Pakistan et de l'Oregon."
  ]},
];

/* ---- Carte ----
   Bernissart et Bundenbach sont à quatre cents kilomètres l'un de l'autre, ce qui
   fait dix-sept pixels sur cette carte. Aucune position ne les séparera : les
   épingles trop proches à l'écran sont donc regroupées, et se séparent au zoom.
   qc.js vérifie qu'au zoom maximal, sur l'écran le plus étroit envisagé, chaque
   paire finit par se séparer. */
/* Messel et Bundenbach sont distants de cent kilomètres, soit sept pixels sur une
   carte du monde : deux chantiers réels que la géographie place presque au même
   point. Pour que leur grappe puisse s'ouvrir, il faut pouvoir zoomer jusqu'à un
   viewBox de 40 px. Ce n'était pas envisageable tant que monde.jpg mesurait
   1 535 px de large — on aurait grossi la source huit fois et demie. Avec la carte
   en 6 140 px, un viewBox de 40 px ne demande qu'un grossissement de 2,1 : c'est
   la haute résolution qui rend ce niveau de zoom lisible. */
/* Créature de l'écran d'accueil. Helicoprion : cinq à huit mètres, et une scie
   de dents enroulée en spirale dans la mâchoire inférieure — on a mis un siècle
   à comprendre où cet organe se plaçait. Changer cette constante suffit à changer
   l'accueil ; toute créature de l'atlas fait l'affaire. */
const CREATURE_ACCUEIL='CHO-05';

const CARTE_ZOOM_MIN=40;      // largeur minimale du viewBox, en px de carte
const CARTE_GROUPE=56;        // en deçà de cette distance à l'écran, deux épingles fusionnent
const CARTE_LARGEUR_MIN=340;  // largeur d'affichage la plus étroite envisagée


/* ---- Économie ----
   Deux dépenses : ouvrir un site (une fois), puis chaque coup de pioche.
   Deux sources : les missions d'entraînement, plus rémunératrices, et les
   missions d'histoire, plus abordables. L'écart est volontaire.
   Les coûts d'ouverture ne suivent pas l'ordre chronologique d'affichage :
   ils dessinent un parcours, du site le mieux documenté au plus dispersé. */
const CREDITS_DEPART=260;       // Burgess plus six coups de pioche
const COUT_FOUILLE=30;
const GAIN_MISSION=12;
const NB_MISSION=6;             // questions par mission
const BONUS_PART=0.6;           // part du coût d'ouverture rendue quand le site est complété
const BONUS_SITE=200;           // plancher, pour les sites les moins chers
const SEUILS_DOC=[0,2,5];       // fragments requis pour les niveaux 1, 2, 3
const FOUILLE_VIDE=false;       // true = une fouille réussie peut ne rien donner

/* Barème identique pour les deux filières.
   La version précédente payait l'entraînement 64 % de plus que l'histoire, au
   motif qu'il coûte plus d'effort. Le raisonnement tient pour quelqu'un qui
   arbitre entre deux matières également accessibles. Il se retourne contre une
   joueuse pour qui les mathématiques sont une angoisse : l'app la payait
   davantage pour affronter ce qu'elle redoute, et moins pour ce qui la porte.
   Chaque session devenait un arbitrage entre son plaisir et son avancement.
   Le choix du pack est désormais gratuit — il ne coûte que du temps. */
/* Les trois familles rapportent la même chose. L'égalisation date de la refonte
   bienveillante : faire de l'évitement un mauvais calcul revenait à punir la
   personne d'avoir contourné ce qui lui coûtait. `base` est conservé comme
   valeur de repli pour toute catégorie non prévue. */
const BAREME={
  base:     {juste:10, aide:7, mission:12},
  ecole:    {juste:10, aide:7, mission:12},
  histoire: {juste:10, aide:7, mission:12}
};

/* ---- Conjugaison : moteur ---- */


const PERS=['je','tu','il','nous','vous','ils'];
const PERS_LBL=['1re pers. du singulier','2e pers. du singulier','3e pers. du singulier',
                '1re pers. du pluriel','2e pers. du pluriel','3e pers. du pluriel'];
const TEMPS=[
 {id:'present',    nom:'présent de l’indicatif',      niv:1},
 {id:'imparfait',  nom:'imparfait de l’indicatif',    niv:1},
 {id:'futur',      nom:'futur simple',                niv:1},
 {id:'conditionnel',nom:'conditionnel présent',       niv:2},
 {id:'subjonctif', nom:'subjonctif présent',          niv:3},
 {id:'passecompose',nom:'passé composé',              niv:2}
];

/* Réguliers : dérivés mécaniquement, aucune irrégularité orthographique dans la liste
   (ni -ger, ni -cer, ni -eler, ni -érer, qui demanderaient des règles supplémentaires). */
const VER_ER=['aimer','chanter','marcher','penser','trouver','regarder','donner','parler',
              'travailler','rester','jouer','écouter','montrer','arriver'];
const VER_IR=['finir','choisir','réussir','grandir','remplir','obéir','réfléchir','bâtir',
              'applaudir','ralentir','avertir','nourrir'];
const AUX_ETRE=new Set(['arriver','rester','aller','venir','partir']);

/* Irréguliers : paradigmes complets, saisis explicitement. */
const VER_IRR={
 'être':{pp:'été',t:{
   present:['suis','es','est','sommes','êtes','sont'],
   imparfait:['étais','étais','était','étions','étiez','étaient'],
   futur:['serai','seras','sera','serons','serez','seront'],
   conditionnel:['serais','serais','serait','serions','seriez','seraient'],
   subjonctif:['sois','sois','soit','soyons','soyez','soient']}},
 'avoir':{pp:'eu',t:{
   present:['ai','as','a','avons','avez','ont'],
   imparfait:['avais','avais','avait','avions','aviez','avaient'],
   futur:['aurai','auras','aura','aurons','aurez','auront'],
   conditionnel:['aurais','aurais','aurait','aurions','auriez','auraient'],
   subjonctif:['aie','aies','ait','ayons','ayez','aient']}},
 'aller':{pp:'allé',t:{
   present:['vais','vas','va','allons','allez','vont'],
   imparfait:['allais','allais','allait','allions','alliez','allaient'],
   futur:['irai','iras','ira','irons','irez','iront'],
   conditionnel:['irais','irais','irait','irions','iriez','iraient'],
   subjonctif:['aille','ailles','aille','allions','alliez','aillent']}},
 'faire':{pp:'fait',t:{
   present:['fais','fais','fait','faisons','faites','font'],
   imparfait:['faisais','faisais','faisait','faisions','faisiez','faisaient'],
   futur:['ferai','feras','fera','ferons','ferez','feront'],
   conditionnel:['ferais','ferais','ferait','ferions','feriez','feraient'],
   subjonctif:['fasse','fasses','fasse','fassions','fassiez','fassent']}},
 'dire':{pp:'dit',t:{
   present:['dis','dis','dit','disons','dites','disent'],
   imparfait:['disais','disais','disait','disions','disiez','disaient'],
   futur:['dirai','diras','dira','dirons','direz','diront'],
   conditionnel:['dirais','dirais','dirait','dirions','diriez','diraient'],
   subjonctif:['dise','dises','dise','disions','disiez','disent']}},
 'prendre':{pp:'pris',t:{
   present:['prends','prends','prend','prenons','prenez','prennent'],
   imparfait:['prenais','prenais','prenait','prenions','preniez','prenaient'],
   futur:['prendrai','prendras','prendra','prendrons','prendrez','prendront'],
   conditionnel:['prendrais','prendrais','prendrait','prendrions','prendriez','prendraient'],
   subjonctif:['prenne','prennes','prenne','prenions','preniez','prennent']}},
 'venir':{pp:'venu',t:{
   present:['viens','viens','vient','venons','venez','viennent'],
   imparfait:['venais','venais','venait','venions','veniez','venaient'],
   futur:['viendrai','viendras','viendra','viendrons','viendrez','viendront'],
   conditionnel:['viendrais','viendrais','viendrait','viendrions','viendriez','viendraient'],
   subjonctif:['vienne','viennes','vienne','venions','veniez','viennent']}},
 'voir':{pp:'vu',t:{
   present:['vois','vois','voit','voyons','voyez','voient'],
   imparfait:['voyais','voyais','voyait','voyions','voyiez','voyaient'],
   futur:['verrai','verras','verra','verrons','verrez','verront'],
   conditionnel:['verrais','verrais','verrait','verrions','verriez','verraient'],
   subjonctif:['voie','voies','voie','voyions','voyiez','voient']}},
 'pouvoir':{pp:'pu',t:{
   present:['peux','peux','peut','pouvons','pouvez','peuvent'],
   imparfait:['pouvais','pouvais','pouvait','pouvions','pouviez','pouvaient'],
   futur:['pourrai','pourras','pourra','pourrons','pourrez','pourront'],
   conditionnel:['pourrais','pourrais','pourrait','pourrions','pourriez','pourraient'],
   subjonctif:['puisse','puisses','puisse','puissions','puissiez','puissent']}},
 'vouloir':{pp:'voulu',t:{
   present:['veux','veux','veut','voulons','voulez','veulent'],
   imparfait:['voulais','voulais','voulait','voulions','vouliez','voulaient'],
   futur:['voudrai','voudras','voudra','voudrons','voudrez','voudront'],
   conditionnel:['voudrais','voudrais','voudrait','voudrions','voudriez','voudraient'],
   subjonctif:['veuille','veuilles','veuille','voulions','vouliez','veuillent']}},
 'devoir':{pp:'dû',t:{
   present:['dois','dois','doit','devons','devez','doivent'],
   imparfait:['devais','devais','devait','devions','deviez','devaient'],
   futur:['devrai','devras','devra','devrons','devrez','devront'],
   conditionnel:['devrais','devrais','devrait','devrions','devriez','devraient'],
   subjonctif:['doive','doives','doive','devions','deviez','doivent']}},
 'savoir':{pp:'su',t:{
   present:['sais','sais','sait','savons','savez','savent'],
   imparfait:['savais','savais','savait','savions','saviez','savaient'],
   futur:['saurai','sauras','saura','saurons','saurez','sauront'],
   conditionnel:['saurais','saurais','saurait','saurions','sauriez','sauraient'],
   subjonctif:['sache','saches','sache','sachions','sachiez','sachent']}},
 'mettre':{pp:'mis',t:{
   present:['mets','mets','met','mettons','mettez','mettent'],
   imparfait:['mettais','mettais','mettait','mettions','mettiez','mettaient'],
   futur:['mettrai','mettras','mettra','mettrons','mettrez','mettront'],
   conditionnel:['mettrais','mettrais','mettrait','mettrions','mettriez','mettraient'],
   subjonctif:['mette','mettes','mette','mettions','mettiez','mettent']}},
 'partir':{pp:'parti',t:{
   present:['pars','pars','part','partons','partez','partent'],
   imparfait:['partais','partais','partait','partions','partiez','partaient'],
   futur:['partirai','partiras','partira','partirons','partirez','partiront'],
   conditionnel:['partirais','partirais','partirait','partirions','partiriez','partiraient'],
   subjonctif:['parte','partes','parte','partions','partiez','partent']}},
 'écrire':{pp:'écrit',t:{
   present:['écris','écris','écrit','écrivons','écrivez','écrivent'],
   imparfait:['écrivais','écrivais','écrivait','écrivions','écriviez','écrivaient'],
   futur:['écrirai','écriras','écrira','écrirons','écrirez','écriront'],
   conditionnel:['écrirais','écrirais','écrirait','écririons','écririez','écriraient'],
   subjonctif:['écrive','écrives','écrive','écrivions','écriviez','écrivent']}},
 'lire':{pp:'lu',t:{
   present:['lis','lis','lit','lisons','lisez','lisent'],
   imparfait:['lisais','lisais','lisait','lisions','lisiez','lisaient'],
   futur:['lirai','liras','lira','lirons','lirez','liront'],
   conditionnel:['lirais','lirais','lirait','lirions','liriez','liraient'],
   subjonctif:['lise','lises','lise','lisions','lisiez','lisent']}},
 'boire':{pp:'bu',t:{
   present:['bois','bois','boit','buvons','buvez','boivent'],
   imparfait:['buvais','buvais','buvait','buvions','buviez','buvaient'],
   futur:['boirai','boiras','boira','boirons','boirez','boiront'],
   conditionnel:['boirais','boirais','boirait','boirions','boiriez','boiraient'],
   subjonctif:['boive','boives','boive','buvions','buviez','boivent']}},
 'connaître':{pp:'connu',t:{
   present:['connais','connais','connaît','connaissons','connaissez','connaissent'],
   imparfait:['connaissais','connaissais','connaissait','connaissions','connaissiez','connaissaient'],
   futur:['connaîtrai','connaîtras','connaîtra','connaîtrons','connaîtrez','connaîtront'],
   conditionnel:['connaîtrais','connaîtrais','connaîtrait','connaîtrions','connaîtriez','connaîtraient'],
   subjonctif:['connaisse','connaisses','connaisse','connaissions','connaissiez','connaissent']}}
};

/* conjuguer(verbe, temps, personne 0..5) -> forme verbale seule */
function conjuguer(v,t,p){
  const irr=VER_IRR[v];
  if(t==='passecompose'){
    const aux=AUX_ETRE.has(v)?'être':'avoir';
    const pp=participe(v);
    const acc=(aux==='être'&&p>=3)?pp+'s':pp;
    return conjuguer(aux,'present',p)+' '+acc;
  }
  if(irr) return irr.t[t][p];
  if(v.endsWith('ir')&&VER_IR.includes(v)){
    const r=v.slice(0,-2);
    if(t==='present')     return r+['is','is','it','issons','issez','issent'][p];
    if(t==='imparfait')   return r+['issais','issais','issait','issions','issiez','issaient'][p];
    if(t==='futur')       return v+['ai','as','a','ons','ez','ont'][p];
    if(t==='conditionnel')return v+['ais','ais','ait','ions','iez','aient'][p];
    if(t==='subjonctif')  return r+['isse','isses','isse','issions','issiez','issent'][p];
  }
  const r=v.slice(0,-2);
  if(t==='present')      return r+['e','es','e','ons','ez','ent'][p];
  if(t==='imparfait')    return r+['ais','ais','ait','ions','iez','aient'][p];
  if(t==='futur')        return v+['ai','as','a','ons','ez','ont'][p];
  if(t==='conditionnel') return v+['ais','ais','ait','ions','iez','aient'][p];
  if(t==='subjonctif')   return r+['e','es','e','ions','iez','ent'][p];
  return '';
}
function participe(v){
  if(VER_IRR[v]) return VER_IRR[v].pp;
  if(VER_IR.includes(v)) return v.slice(0,-2)+'i';
  return v.slice(0,-2)+'é';
}
/* Sujet correct devant la forme : élision de « je », « ils » au pluriel. */
function sujetPour(p,forme){
  const s=PERS[p];
  if(p===0&&/^[aâeéèêiîoôuûh]/i.test(forme)) return "j’";
  return s+' ';
}
function verbesNiv(n){
  let L=VER_ER.concat(VER_IR);
  if(n>=2) L=L.concat(['être','avoir','aller','faire','dire','prendre','venir','voir']);
  if(n>=3) L=L.concat(['pouvoir','vouloir','devoir','savoir','mettre','partir','écrire','lire','boire','connaître']);
  return L;
}

/* ---- Orthographe : banque d'items adultes ----
   Format : {q: phrase avec ___, r: forme correcte, autres:[distracteurs], exp, niv} */
const ORTHO=[
 {niv:1,q:"Elle ___ décidé de reprendre ses études ___ trente-huit ans.",r:"a … à",autres:["à … a","a … a","à … à"],exp:"« a » est le verbe avoir (on peut dire « avait »), « à » est la préposition."},
 {niv:1,q:"Je ne sais pas ___ il est parti, ni s’il reviendra.",r:"où",autres:["ou","oux","ouh"],exp:"« où » avec accent marque le lieu ou le temps ; « ou » sans accent équivaut à « ou bien »."},
 {niv:1,q:"Les résultats ___ meilleurs que prévu.",r:"sont",autres:["son","sonts","s’ont"],exp:"« sont » = verbe être (on peut dire « étaient ») ; « son » est un déterminant possessif."},
 {niv:1,q:"___ dit qu’ils ___ terminé le rapport.",r:"On … ont",autres:["Ont … on","On … on","Ont … ont"],exp:"« on » est un pronom sujet (remplaçable par « il ») ; « ont » est le verbe avoir."},
 {niv:1,q:"Cette hypothèse ___ solide, ___ elle demande une vérification.",r:"est … et",autres:["et … est","est … est","et … et"],exp:"« est » = verbe être (« était ») ; « et » relie deux éléments (« et puis »)."},
 {niv:2,q:"___ échantillons ___ ont été prélevés hier.",r:"Ces … qu’il",autres:["Ses … qu’il","C’est … qu’il","Ces … qui’l"],exp:"« ces » est un démonstratif pluriel (ceux-là) ; « ses » marque la possession."},
 {niv:2,q:"Il ___ trompé de couche stratigraphique.",r:"s’est",autres:["c’est","ces","ses"],exp:"« s’est » précède un participe passé dans un verbe pronominal ; « c’est » = « cela est »."},
 {niv:2,q:"___ que tu me demandes est difficile à obtenir.",r:"Ce",autres:["Se","Ceux","C’"],exp:"« ce » est démonstratif ; « se » est un pronom réfléchi qui accompagne un verbe."},
 {niv:2,q:"Elle ___ vu partir sans rien dire, ___ vers midi.",r:"l’a … là",autres:["la … la","l’a … la","la … là"],exp:"« l’a » = pronom + verbe avoir ; « là » avec accent indique le lieu ou le moment."},
 {niv:2,q:"Les chercheurs ont présenté ___ conclusions à ___ directeur.",r:"leurs … leur",autres:["leur … leurs","leurs … leurs","leur … leur"],exp:"« leur » déterminant s’accorde en nombre avec le nom : leurs conclusions, leur directeur."},
 {niv:2,q:"___ à la datation, elle reste discutée.",r:"Quant",autres:["Quand","Qu’en","Camp"],exp:"« quant à » = en ce qui concerne ; « quand » est temporel ; « qu’en » = que + en."},
 {niv:2,q:"Le laboratoire est ___ à publier ; les résultats sont ___ d’être définitifs.",r:"prêt … près",autres:["près … prêt","prêt … prêt","près … près"],exp:"« prêt » = disposé à (adjectif, s’accorde) ; « près de » = proche de."},
 {niv:2,q:"Il aurait fallu s’en occuper ___.",r:"plus tôt",autres:["plutôt","plus tot","plûtot"],exp:"« plus tôt » s’oppose à « plus tard » ; « plutôt » exprime une préférence."},
 {niv:3,q:"___ soient les conclusions, il faudra les publier.",r:"Quelles que",autres:["Quelque","Quelles-que","Quel que"],exp:"Devant le verbe être, on écrit « quel que » en deux mots, accordé avec le sujet : quelles que soient."},
 {niv:3,q:"Ce résultat n’est pas ___ prouver l’hypothèse.",r:"censé",autres:["sensé","sensée","censée"],exp:"« censé » = supposé, réputé ; « sensé » = qui a du bon sens."},
 {niv:3,q:"Un ___ subsiste entre les deux équipes sur la datation.",r:"différend",autres:["différent","différant","diférend"],exp:"« un différend » est un désaccord (nom) ; « différent » est un adjectif."},
 {niv:3,q:"L’argument ne tient pas ; il ne fait que ___.",r:"résonner",autres:["raisonner","résoner","raisoner"],exp:"« résonner » = produire un son ; « raisonner » = mener un raisonnement. Ici le contexte sonore impose « résonner »."},
 {niv:3,q:"L’étude est longue, ___ trop longue pour un article.",r:"voire",autres:["voir","voir e","voirre"],exp:"« voire » signifie « et même » ; « voir » est le verbe."},
 {niv:3,q:"___ tu en penses, la méthode reste valable.",r:"Quoi que",autres:["Quoique","Quoi-que","Quoi qu’"],exp:"« quoi que » = quelle que soit la chose que ; « quoique » = bien que."},
 {niv:2,q:"Les fossiles ___ nous avons parlé viennent du Karoo.",r:"dont",autres:["que","dont que","desquels que"],exp:"« parler de » impose le relatif « dont »."},
 {niv:1,q:"Elles se sont ___ toute la matinée.",r:"parlé",autres:["parlées","parlés","parlée"],exp:"« se parler » = parler à soi : le pronom est complément d’objet indirect, donc pas d’accord."},
 {niv:2,q:"La couche que nous avons ___ est très fine.",r:"observée",autres:["observé","observés","observées"],exp:"Avec avoir, le participe s’accorde avec le COD placé avant : « la couche » est féminin singulier."},
 {niv:2,q:"Les échantillons que j’ai ___ hier sont au frigo.",r:"rapportés",autres:["rapporté","rapportée","rapportées"],exp:"COD « les échantillons » placé avant, masculin pluriel : accord en -és."},
 {niv:3,q:"Les efforts qu’il a ___ pour terminer sont considérables.",r:"fallu",autres:["fallus","fallues","fallue"],exp:"« falloir » est impersonnel : son participe reste toujours invariable."},
 {niv:3,q:"Elle s’est ___ les mains avant la manipulation.",r:"lavé",autres:["lavée","lavés","lavées"],exp:"Le COD « les mains » est placé après le verbe : pas d’accord du participe."},
 {niv:1,q:"Il y a ___ de dix ans que le site a été rouvert.",r:"plus",autres:["plu","plut","plust"],exp:"« plus de » exprime la quantité ; « plu » est le participe de plaire ou pleuvoir."},
 {niv:2,q:"Ils ont ___ de discuter avant la réunion.",r:"convenu",autres:["convenus","convenue","convenues"],exp:"Avec avoir, sans COD placé avant, le participe reste invariable."},
 {niv:1,q:"Nous avons trouvé ___ fragments dans la même strate.",r:"quelques",autres:["quelque","quel que","quelqu’"],exp:"Devant un nom pluriel dénombrable, « quelques » prend un s."},
 {niv:2,q:"Le rapport a été ___ à la direction lundi.",r:"transmis",autres:["transmit","transmi","transmit s"],exp:"Participe passé de transmettre : transmis (comme mis)."},
 {niv:2,q:"Les données ont été ___ par deux équipes indépendantes.",r:"recueillies",autres:["recueillis","recueilli","recueillie"],exp:"Avec être, le participe s’accorde avec le sujet : « les données », féminin pluriel."},
 {niv:1,q:"Il n’y a ___ un seul spécimen complet.",r:"qu’",autres:["que","qu","k’"],exp:"Devant une voyelle, « que » s’élide en « qu’ »."},
 {niv:3,q:"___ des deux hypothèses, aucune n’est démontrée.",r:"Aucune",autres:["Aucun","Aucunes","Aucuns"],exp:"« aucune » s’accorde avec « hypothèses », féminin."},
 {niv:2,q:"Ces mesures sont ___ précises que les précédentes.",r:"plus",autres:["plu","davantage de","plutôt"],exp:"Devant un adjectif, on emploie « plus » ; « davantage » ne se construit pas avec un adjectif."},
 {niv:3,q:"Je m’attends à ce qu’il ___ en retard.",r:"soit",autres:["est","sera","serait"],exp:"« s’attendre à ce que » entraîne le subjonctif : qu’il soit."},
 {niv:3,q:"Bien qu’elle ___ raison, personne ne l’a écoutée.",r:"ait",autres:["a","aurait","avait"],exp:"« bien que » entraîne le subjonctif : qu’elle ait."},
 {niv:2,q:"Après qu’il ___ terminé, nous avons relu le texte.",r:"a",autres:["ait","aurait","eut été"],exp:"« après que » exprime un fait réel et se construit avec l’indicatif, contrairement à « avant que »."},
 {niv:1,q:"Elle travaille ___ le laboratoire depuis six mois.",r:"dans",autres:["d’en","dan","dents"],exp:"« dans » est la préposition de lieu ; « d’en » = de + en."},
 {niv:2,q:"Il ___ être là, mais rien n’est certain.",r:"peut",autres:["peux","peu","peus"],exp:"3e personne du singulier : « il peut » ; « peu » est un adverbe de quantité."},
 {niv:3,q:"Ils sont partis ___ prévenir personne.",r:"sans",autres:["s’en","sang","cent"],exp:"« sans » marque l’absence ; « s’en » = se + en."},
 {niv:2,q:"___ les échantillons ont été catalogués.",r:"Tous",autres:["Tout","Toute","Toutes"],exp:"Devant un nom masculin pluriel, « tous » s’accorde."}
];

/* ---- Classements de la collection ----
   Trois façons de ranger les mêmes créatures, et chacune enseigne autre chose.
   Par chantier : où l'on a creusé. Par période : ce qui a vécu en même temps —
   c'est le classement qui fait sentir la profondeur du temps. Par grand groupe :
   qui est parent de qui, indépendamment de l'âge et du lieu.

   Le champ `groupe` des fiches est trop fin pour servir de rubrique : il compte
   plus de cent valeurs distinctes pour cent dix créatures. On le ramène donc à
   une douzaine d'ensembles par mots-clés, dans un ordre qui compte — « reptile
   marin » doit être testé avant « reptile », « cétacé » avant « mammifère ». */

const PERIODES=[
  {nom:'Édiacarien',  ere:'Précambrien', de:635,   a:538.8},
  {nom:'Cambrien',    ere:'Paléozoïque', de:538.8, a:485.4},
  {nom:'Ordovicien',  ere:'Paléozoïque', de:485.4, a:443.8},
  {nom:'Silurien',    ere:'Paléozoïque', de:443.8, a:419.2},
  {nom:'Dévonien',    ere:'Paléozoïque', de:419.2, a:358.9},
  {nom:'Carbonifère', ere:'Paléozoïque', de:358.9, a:298.9},
  {nom:'Permien',     ere:'Paléozoïque', de:298.9, a:251.9},
  {nom:'Trias',       ere:'Mésozoïque',  de:251.9, a:201.4},
  {nom:'Jurassique',  ere:'Mésozoïque',  de:201.4, a:143.1},
  {nom:'Crétacé',     ere:'Mésozoïque',  de:143.1, a:66},
  {nom:'Paléogène',   ere:'Cénozoïque',  de:66,    a:23.03},
  {nom:'Néogène',     ere:'Cénozoïque',  de:23.03, a:2.58},
  {nom:'Quaternaire', ere:'Cénozoïque',  de:2.58,  a:0}
];
function periodeDe(c){
  const m=(c.ageMin+c.ageMax)/2;
  return PERIODES.find(p=>m<=p.de && m>p.a) || PERIODES[PERIODES.length-1];
}

const GRANDS_GROUPES=[
  ['Plantes',                           /plante|lycophyte|végétal|vasculaire primitive|rhyniophyte|bryophyte|cladoxylopside|progymnosperme|trimérophyte|angiosperme|gymnosperme|gnétale|eudicotylédone|fougère|conifère/i],
  ['Organismes édiacariens',            /édiacarien|dickinsonio|trilobozoaire|proarticulé/i],
  ['Trilobites',                        /trilobite/i],
  ['Céphalopodes et mollusques',        /nautilo|ammonite|bélemn|vampyromorphe|octopode|céphalopode|mollusque/i],
  ['Échinodermes',                      /échinoderme|holothur|crinoïde|crinoide|oursin|astéride|ophiur|blastoïde|blastozoaire|échinide|étoile de mer|étoile fragile|cystoïde|homalozoaire/i],
  ['Poissons cartilagineux',            /chondrichthyen|holocéphale|holocephale|symmoriiforme|eugeneodont|eugénéodonte|petalodonte|pétalodonte|iniopt|requin|élasmobranche/i],
  ['Poissons cuirassés et agnathes',    /placoderme|arthrodire|hétérostracé|heterostrac|agnathe|ostracoderme|rhénanide|renanide|arandaspide|conodonte|agnathe|sans mâchoires/i],
  ['Poissons osseux et tétrapodomorphes', /sarcoptérygien|actinoptérygien|tétrapodomorphe|elpistostég|ostéichthyen|poisson/i],
  ['Premiers tétrapodes',               /tétrapode|amphibien|temnospondyle|lepospondyle|stégocéphale|recumbirostr/i],
  ['Reptiles marins',                   /ichtyosaur|ichthyosaur|nothosaur|sauroptérygien|mosasaur|saurosphargid|placodonte|plésiosaur|pachypleurosaur|thalattosaur|protorosaur|tanystrophéid|tanystropheid|archosauromorphe/i],
  ['Dinosaures et oiseaux',             /dinosaur|théropode|sauropode|ornithopode|cératopsien|ankylosaur|stégosaur|tyrannosaur|oviraptor|thérizinosaur|ornithomimosaur|hadrosaur|pachycéphalosaur|dromæosaur|dromaeosaur|troodont|avialien|oiseau|scansorioptérygid|cænagnath|caenagnath|coelurosaur|carnosaur|phorusrhacid|métriacanthosaur|allosauroïde|diplodocoïde|macronaire|iguanodont|thyréophore|marginocéphale|paravien|noasaurid|cératosaur|spinosaur|nodosaur|titanosaur|mamenchisaurid|hétérodontosaurid|ornithomimid|compsognathid|cératopsid|ceratopsid|chasmosaurin/i],
  ['Synapsides et mammifères',          /synapside|thérapside|dicynodonte|dinocephale|dinocéphale|gorgonopsien|cynodonte|pélycosaure|mammifère|eutriconodonte|artiodactyle|cétacé|archéocète|mysticète|basilosaurid|protocétidé|pakicétidé|raoellidé|xénarthre|paresseux terrestre|cingulé|équoïde|périssodactyle|chiroptère|chauve-souris|primate|adapiforme|pholidote|pangolin|artiodactyle|litopterne|macrauchéniidé|notongulé|toxodontidé|sparassodonte|métathérien|marsupial/i],
  ['Autres reptiles',                   /parareptile|pareiasaure|reptile|diapside|archosaure|lépidosaure|ptérosaure/i],
  ['Arthropodes',                       /arthropode|radiodonte|lobopodien|marrellomorphe|chélicérate|myriapode|euryptéride|insecte|pycnogonide|scorpion|crustacé|limule|xiphosure|arachnide|hexapode|diplopode|palæodictyoptère|paleodictyoptere|odonatoptère|thylacocéphale|mille-pattes|méganeurid|meganeurid|griffinfly|paléodictyoptère|paleodictyoptere/i],
  ['Invertébrés et chordés énigmatiques', /chordé|lophotrochozoaire|cnidaire|méduse|anémone|annélide|wiwaxiidé|problematica|énigmatique|incertain/i]
];
function grandGroupe(c){
  const t=(c.groupe||'')+' '+(c.nom||'');
  const r=GRANDS_GROUPES.find(g=>g[1].test(t));
  return r ? r[0] : 'Non classé';
}

/* ================================================================
   Bloc 4 : pack HISTOIRE.
   Culture générale du temps profond : échelle des temps, extinctions,
   histoire de la discipline, méthodes, grands groupes. Écrit à la main,
   sans source formelle attachée — à relire si un chiffre paraît douteux.
   ================================================================ */
const HISTOIRE=[

 /* --- Échelle des temps --- */
 {niv:1,q:"Quel âge donne-t-on à la Terre ?",r:"Environ 4,54 milliards d'années",
  autres:["Environ 4,54 millions d'années","Environ 540 millions d'années","Environ 13,8 milliards d'années"],
  exp:"4,54 milliards d'années, mesurés sur des météorites et les plus vieux minéraux terrestres. 13,8 milliards, c'est l'âge de l'univers."},
 {niv:1,q:"Dans quel ordre se succèdent les trois ères du Phanérozoïque ?",r:"Paléozoïque, Mésozoïque, Cénozoïque",
  autres:["Mésozoïque, Paléozoïque, Cénozoïque","Cénozoïque, Mésozoïque, Paléozoïque","Paléozoïque, Cénozoïque, Mésozoïque"],
  exp:"Vie ancienne, vie moyenne, vie récente : les noms disent l'ordre."},
 {niv:1,q:"Que signifie l'abréviation « Ma » en géologie ?",r:"Millions d'années",
  autres:["Milliards d'années","Milliers d'années","Millions d'années avant notre ère seulement"],
  exp:"« Ma » vaut 10⁶ ans. Pour les milliards, on écrit « Ga »."},
 {niv:1,q:"Quelles périodes composent le Mésozoïque ?",r:"Trias, Jurassique, Crétacé",
  autres:["Permien, Trias, Jurassique","Jurassique, Crétacé, Paléogène","Trias, Crétacé, Paléogène"],
  exp:"Le Permien clôt le Paléozoïque, le Paléogène ouvre le Cénozoïque."},
 {niv:1,q:"Vers quand situe-t-on le début du Cambrien ?",r:"Environ 539 Ma",
  autres:["Environ 252 Ma","Environ 66 Ma","Environ 1 000 Ma"],
  exp:"539 Ma marque la base du Cambrien, donc du Phanérozoïque."},
 {niv:2,q:"Quelle période suit immédiatement le Cambrien ?",r:"L'Ordovicien",
  autres:["Le Silurien","Le Dévonien","Le Précambrien"],
  exp:"Ordre du Paléozoïque : Cambrien, Ordovicien, Silurien, Dévonien, Carbonifère, Permien."},
 {niv:2,q:"Entre quelles dates s'étend approximativement le Jurassique ?",r:"201 à 145 Ma",
  autres:["252 à 201 Ma","145 à 66 Ma","66 à 23 Ma"],
  exp:"252–201 correspond au Trias, 145–66 au Crétacé, 66–23 au Paléogène."},
 {niv:2,q:"Quelle proportion de l'histoire de la Terre le Précambrien représente-t-il ?",r:"Environ 88 %",
  autres:["Environ 50 %","Environ 25 %","Environ 12 %"],
  exp:"4 000 des 4 540 millions d'années précèdent le Cambrien. Le Phanérozoïque, celui des fossiles visibles, est une mince tranche finale."},
 {niv:2,q:"Dans quel éon vivons-nous ?",r:"Le Phanérozoïque",
  autres:["Le Protérozoïque","L'Archéen","L'Hadéen"],
  exp:"Phanérozoïque signifie « vie visible » : l'éon des organismes à squelette fossilisable."},
 {niv:3,q:"Que datent les zircons de Jack Hills, en Australie ?",r:"Environ 4,4 milliards d'années",
  autres:["Environ 3,5 milliards d'années","Environ 2,5 milliards d'années","Environ 540 millions d'années"],
  exp:"Ce sont les plus anciens minéraux terrestres connus, presque contemporains de la formation de la planète."},
 {niv:3,q:"À quelle époque géologique appartient l'essentiel de l'histoire humaine récente ?",r:"L'Holocène",
  autres:["Le Pléistocène","Le Pliocène","Le Miocène"],
  exp:"L'Holocène commence il y a environ 11 700 ans, à la fin de la dernière glaciation."},

 /* --- Extinctions --- */
 {niv:1,q:"Combien d'extinctions de masse majeures les géologues reconnaissent-ils dans le Phanérozoïque ?",r:"Cinq",
  autres:["Trois","Sept","Douze"],
  exp:"Fin Ordovicien, Dévonien supérieur, fin Permien, fin Trias, fin Crétacé. Certains ajoutent une crise en cours."},
 {niv:1,q:"Quelle est la plus sévère des extinctions de masse connues ?",r:"Celle de la fin du Permien",
  autres:["Celle de la fin du Crétacé","Celle de la fin du Trias","Celle de la fin de l'Ordovicien"],
  exp:"Il y a environ 252 Ma, autour de 80 % des espèces marines disparaissent. Elle est parfois surnommée « la Grande Mourante »."},
 {niv:1,q:"Il y a combien de temps s'est produite l'extinction de la fin du Crétacé ?",r:"66 millions d'années",
  autres:["252 millions d'années","166 millions d'années","6,6 millions d'années"],
  exp:"C'est la limite Crétacé-Paléogène, notée K-Pg."},
 {niv:2,q:"Quelle cause principale est aujourd'hui admise pour l'extinction de la fin du Crétacé ?",r:"L'impact d'un astéroïde",
  autres:["Une glaciation généralisée","L'assèchement des océans","Une inversion du champ magnétique"],
  exp:"L'impact de Chicxulub, associé à une activité volcanique intense au Deccan qui a probablement aggravé la crise."},
 {niv:2,q:"Où se trouve le cratère de Chicxulub ?",r:"Dans la péninsule du Yucatán, au Mexique",
  autres:["En Sibérie orientale","Dans le désert d'Arizona","Au large de Madagascar"],
  exp:"Ce cratère d'environ 180 km de diamètre a été identifié dans les années 1990, à partir de relevés pétroliers."},
 {niv:2,q:"Qui a proposé, en 1980, l'hypothèse d'un impact d'astéroïde à la fin du Crétacé ?",r:"Luis et Walter Alvarez",
  autres:["Stephen Jay Gould et Niles Eldredge","Richard Owen et Gideon Mantell","Charles Walcott et Simon Conway Morris"],
  exp:"Un physicien et son fils géologue, à partir d'une anomalie en iridium dans l'argile de la limite K-Pg."},
 {niv:2,q:"À quelle extinction associe-t-on les trapps de Sibérie ?",r:"Celle de la fin du Permien",
  autres:["Celle de la fin du Crétacé","Celle de la fin de l'Ordovicien","Celle de la fin du Trias"],
  exp:"Un épanchement volcanique gigantesque, il y a environ 252 Ma, qui a libéré assez de carbone pour réchauffer et acidifier les océans."},
 {niv:3,q:"Quel élément chimique, anormalement abondant à la limite K-Pg, a mis les Alvarez sur la piste d'un impact ?",r:"L'iridium",
  autres:["Le plomb","Le potassium","Le soufre"],
  exp:"L'iridium est rare dans la croûte terrestre mais fréquent dans les météorites."},
 {niv:3,q:"Que désigne un « taxon de crise » comme Lystrosaurus ?",r:"Une forme qui prolifère juste après une extinction, dans des écosystèmes appauvris",
  autres:["Une espèce disparue au tout début d'une extinction","Un fossile utilisé pour dater précisément une couche","Une espèce dont la classification reste indécise"],
  exp:"Au Trias inférieur, Lystrosaurus représente une part énorme des vertébrés terrestres retrouvés : peu de concurrents, peu de prédateurs."},
 {niv:3,q:"Quel groupe emblématique disparaît définitivement à la fin du Permien ?",r:"Les trilobites",
  autres:["Les ammonites","Les brachiopodes","Les crinoïdes"],
  exp:"Les ammonites franchissent la crise permienne et ne s'éteignent qu'à la limite K-Pg."},

 /* --- Histoire de la discipline --- */
 {niv:1,q:"Qui forge le mot « dinosaure » en 1842 ?",r:"Richard Owen",
  autres:["Charles Darwin","Georges Cuvier","Gideon Mantell"],
  exp:"« Deinos sauros » : lézard terrible. Owen voulait souligner qu'il s'agissait d'un groupe distinct des reptiles connus."},
 {niv:1,q:"En quelle année Darwin publie-t-il « L'Origine des espèces » ?",r:"1859",
  autres:["1809","1871","1900"],
  exp:"1809 est son année de naissance, 1871 celle de « La Filiation de l'homme »."},
 {niv:1,q:"Pour quoi Mary Anning est-elle connue ?",r:"Ses découvertes de reptiles marins fossiles à Lyme Regis",
  autres:["La première classification des dinosaures","La datation au carbone 14","La théorie de la dérive des continents"],
  exp:"Ichtyosaures, plésiosaures, ptérosaure : ses trouvailles ont nourri la science de son époque, qui l'a peu créditée."},
 {niv:2,q:"Quel naturaliste établit au début du XIXᵉ siècle que des espèces ont réellement disparu ?",r:"Georges Cuvier",
  autres:["Jean-Baptiste de Lamarck","Charles Lyell","Alfred Wegener"],
  exp:"En comparant l'éléphant actuel et le mammouth, Cuvier démontre l'extinction, alors contestée."},
 {niv:2,q:"Qui découvre le Schiste de Burgess, et en quelle année ?",r:"Charles Doolittle Walcott, en 1909",
  autres:["Simon Conway Morris, en 1972","Harry Whittington, en 1966","Stephen Jay Gould, en 1989"],
  exp:"Les trois autres ont travaillé sur le gisement, mais bien après sa découverte."},
 {niv:2,q:"Qui a formulé le principe de superposition des couches géologiques ?",r:"Nicolas Sténon",
  autres:["William Smith","James Hutton","Charles Lyell"],
  exp:"Au XVIIᵉ siècle : dans une série non perturbée, une couche est plus ancienne que celles qui la recouvrent."},
 {niv:2,q:"Quel ouvrage de Stephen Jay Gould, paru en 1989, a rendu le Schiste de Burgess célèbre ?",r:"« La vie est belle »",
  autres:["« Le Gène égoïste »","« Le Hasard et la Nécessité »","« De l'origine des continents »"],
  exp:"« Wonderful Life » en anglais. Gould y défendait l'idée d'une diversité cambrienne beaucoup plus large qu'aujourd'hui — thèse depuis largement révisée."},
 {niv:3,q:"Qui dresse en 1815 la première carte géologique détaillée d'un pays entier ?",r:"William Smith, pour l'Angleterre",
  autres:["Charles Lyell, pour l'Écosse","Georges Cuvier, pour la France","Alexander von Humboldt, pour l'Allemagne"],
  exp:"Smith, ingénieur des canaux, avait compris que les couches se reconnaissent à leurs fossiles caractéristiques."},
 {niv:3,q:"Où et quand a été trouvé le premier squelette d'Archaeopteryx ?",r:"À Solnhofen, en Bavière, en 1861",
  autres:["Dans le Liaoning, en Chine, en 1996","À Lyme Regis, en Angleterre, en 1823","Dans le Wyoming, aux États-Unis, en 1877"],
  exp:"Deux ans après « L'Origine des espèces », un animal à plumes et à dents : l'argument tombait à point."},
 {niv:3,q:"Que désigne la « Guerre des os » de la fin du XIXᵉ siècle ?",r:"La rivalité entre les paléontologues Cope et Marsh dans l'Ouest américain",
  autres:["Un conflit sur la propriété des fossiles chinois","Le débat sur l'extinction des dinosaures","La querelle entre Cuvier et Lamarck"],
  exp:"Othniel Marsh et Edward Cope ont décrit à eux deux plus de cent trente espèces, en se sabotant mutuellement."},
 {niv:3,q:"Quelle idée James Hutton et Charles Lyell ont-ils imposée en géologie ?",r:"Que les mêmes processus lents agissent aujourd'hui comme autrefois",
  autres:["Que la Terre a été façonnée par une série de catastrophes brutales","Que les continents dérivent","Que les fossiles sont des jeux de la nature"],
  exp:"L'actualisme. Il a rendu pensable le temps profond, en montrant que l'érosion ordinaire suffit si on lui laisse assez de temps."},

 /* --- Méthodes --- */
 {niv:1,q:"Que désigne un « Lagerstätte » ?",r:"Un gisement à conservation exceptionnelle",
  autres:["Une couche de cendre volcanique datable","Un musée d'histoire naturelle allemand","Une méthode de moulage des fossiles"],
  exp:"Burgess, Solnhofen, Yixian, Messel : des sites où les tissus mous ont survécu."},
 {niv:1,q:"Qu'étudie la taphonomie ?",r:"Ce qui arrive à un organisme entre sa mort et sa découverte",
  autres:["La classification des espèces disparues","La datation des roches sédimentaires","La reconstitution des climats anciens"],
  exp:"Décomposition, transport, enfouissement, minéralisation, déformation. Elle explique pourquoi ce qu'on trouve n'est pas ce qui a vécu."},
 {niv:2,q:"Jusqu'à quel âge la datation au carbone 14 reste-t-elle utilisable ?",r:"Environ 50 000 ans",
  autres:["Environ 500 000 ans","Environ 5 millions d'années","Environ 50 millions d'années"],
  exp:"Sa demi-vie est de 5 730 ans. Au-delà, il n'en reste plus assez à mesurer : les fossiles anciens se datent autrement."},
 {niv:2,q:"Quelle méthode date le mieux une couche de cendre volcanique vieille de 250 millions d'années ?",r:"L'uranium-plomb sur les cristaux de zircon",
  autres:["Le carbone 14","La dendrochronologie","La thermoluminescence"],
  exp:"Le zircon incorpore de l'uranium à sa formation et rejette le plomb : le plomb présent aujourd'hui vient donc entièrement de la désintégration."},
 {niv:2,q:"Qu'est-ce qu'un fossile stratigraphique, dit aussi fossile index ?",r:"Une espèce très répandue mais ayant vécu peu de temps",
  autres:["Le fossile le plus complet d'un gisement","Le premier fossile décrit pour une espèce","Un fossile conservé avec ses tissus mous"],
  exp:"Ces deux propriétés permettent de corréler des couches éloignées et de les dater relativement."},
 {niv:3,q:"Que permettent d'inférer les mélanosomes conservés dans certains fossiles ?",r:"Une partie des motifs de coloration de l'animal",
  autres:["Sa température corporelle","Son âge au moment de la mort","Sa position dans l'arbre phylogénétique"],
  exp:"Ce sont les organites qui portent le pigment. Leur forme est corrélée à la couleur chez les oiseaux actuels ; l'inférence reste indirecte."},
 {niv:3,q:"Qu'appelle-t-on un « spécimen type » ?",r:"Le spécimen de référence auquel un nom d'espèce est officiellement rattaché",
  autres:["Le plus grand spécimen connu de l'espèce","Un moulage utilisé pour l'exposition","Le premier fossile trouvé sur un site"],
  exp:"L'holotype. Si la description change, c'est à lui qu'on revient trancher."},
 {niv:3,q:"En 1999, l'« Archaeoraptor » présenté comme chaînon manquant s'est révélé être quoi ?",r:"Un assemblage de fossiles appartenant à deux animaux différents",
  autres:["Un moulage en plâtre entièrement fabriqué","Un spécimen authentique mais mal daté","Un fossile de ptérosaure mal identifié"],
  exp:"L'affaire a marqué les esprits sur les risques du marché parallèle des fossiles du Liaoning."},

 /* --- Grands groupes --- */
 {niv:1,q:"Vers quel groupe actuel la lignée des synapsides conduit-elle ?",r:"Les mammifères",
  autres:["Les oiseaux","Les crocodiles","Les tortues"],
  exp:"Les synapsides se distinguent dès le Carbonifère par une ouverture unique derrière l'œil. Les autres groupes cités sont des sauropsides."},
 {niv:1,q:"Que sont les oiseaux, du point de vue de la classification ?",r:"Des dinosaures théropodes",
  autres:["Les descendants des ptérosaures","Un groupe issu des crocodiles","Un groupe sans lien avec les dinosaures"],
  exp:"Les dinosaures ne se sont donc pas complètement éteints il y a 66 Ma."},
 {niv:1,q:"Les ptérosaures sont-ils des dinosaures ?",r:"Non, ce sont des reptiles volants d'un groupe distinct",
  autres:["Oui, ce sont des dinosaures volants","Oui, ce sont les ancêtres des oiseaux","Non, ce sont des mammifères primitifs"],
  exp:"Ptérosaures et dinosaures sont proches parents au sein des archosaures, mais le vol y est apparu deux fois indépendamment."},
 {niv:2,q:"Que désigne l'expression « explosion cambrienne » ?",r:"L'apparition rapide, dans le registre fossile, de la plupart des grands plans corporels animaux",
  autres:["Une série d'éruptions volcaniques du Cambrien","La première extinction de masse connue","L'apparition soudaine des premiers vertébrés terrestres"],
  exp:"« Rapide » se lit à l'échelle géologique : une vingtaine de millions d'années. Le débat porte sur la part réelle du phénomène et la part d'un simple biais de fossilisation."},
 {niv:2,q:"À quel grand groupe rattache-t-on aujourd'hui Anomalocaris ?",r:"Aux arthropodes, au sens large",
  autres:["Aux mollusques","Aux vertébrés primitifs","Aux cnidaires"],
  exp:"C'est un panarthropode : longtemps considéré comme inclassable, il occupe une position basale dans la lignée qui mène aux arthropodes actuels."},
 {niv:2,q:"Pourquoi Pikaia intéresse-t-elle particulièrement les chercheurs ?",r:"Parce qu'elle présente des caractères de chordé, le groupe dont nous faisons partie",
  autres:["Parce que c'est le plus grand animal du Cambrien","Parce qu'elle est le premier arthropode connu","Parce qu'elle possède la première coquille minéralisée"],
  exp:"Sa position exacte reste discutée, et d'autres candidats chinois plus anciens la concurrencent."},
 {niv:2,q:"Qu'est-ce qu'un dicynodonte comme Diictodon ?",r:"Un thérapside, donc un synapside proche de la lignée mammalienne",
  autres:["Un dinosaure herbivore primitif","Un reptile marin du Permien","Un amphibien géant du Trias"],
  exp:"Les dicynodontes dominaient les faunes herbivores du Permien supérieur, souvent avec une simple paire de défenses et un bec corné."},
 {niv:3,q:"Quand apparaissent les premiers tétrapodes, ces vertébrés à quatre membres ?",r:"Au Dévonien",
  autres:["Au Cambrien","Au Permien","Au Trias"],
  exp:"Ichthyostega, Acanthostega : autour de 370 Ma. Leurs membres sont apparus en milieu aquatique avant de servir à marcher."},
 {niv:3,q:"Quand le supercontinent Pangée est-il assemblé ?",r:"Vers la fin du Paléozoïque, autour du Permien",
  autres:["Au début du Cambrien","À la fin du Crétacé","Au Miocène"],
  exp:"Il commence à se fragmenter au Jurassique. Cette configuration explique la répartition très large de certaines faunes du Trias."},
 {niv:3,q:"Qu'est-ce qui rend la découverte du cœlacanthe en 1938 remarquable ?",r:"On croyait le groupe éteint depuis la fin du Crétacé",
  autres:["C'était le plus grand poisson jamais capturé","Il s'agissait du premier vertébré marin fossile décrit","Il possédait des poumons fonctionnels"],
  exp:"Un « taxon Lazare » : absent du registre fossile pendant 66 millions d'années, puis retrouvé vivant au large des Comores."},
 {niv:3,q:"Que sont les stromatolithes ?",r:"Des structures construites par des tapis de micro-organismes, parmi les plus anciennes traces de vie",
  autres:["Des œufs de dinosaures fossilisés","Des concrétions formées par l'impact de météorites","Des empreintes de pas de tétrapodes"],
  exp:"Certains dépassent 3,4 milliards d'années. On en observe encore aujourd'hui, notamment à Shark Bay en Australie."},
 {niv:3,q:"Que désigne la faune de l'Édiacarien ?",r:"Des organismes à corps mou antérieurs au Cambrien",
  autres:["Les premiers vertébrés du Silurien","La faune du Trias inférieur après l'extinction permienne","Les premiers insectes du Carbonifère"],
  exp:"Entre 575 et 539 Ma. Leur affiliation aux animaux actuels reste très discutée : plusieurs pourraient n'avoir laissé aucune descendance."}
];

/* ================================================================
   Bloc 5 : pack BIOLOGIE.

   Quatre lignées marines choisies pour ce qu'elles enseignent ensemble :
   ce qui se fossilise et ce qui ne se fossilise pas, ce qu'un squelette
   contraint, et ce que l'évolution refait plusieurs fois. Trilobites et
   requins ont des chantiers dans l'atlas ; les baleines aussi ; les
   holothuries n'en ont pas, et c'est précisément l'intérêt — un groupe
   abondant, ancien, et presque invisible dans le registre fossile.

   Rédigé à la main. Chaque item porte un lien de lecture.
   ================================================================ */

const BIOLOGIE=[

/* ---- Trilobites ---- */
{niv:1,q:"De quoi est faite la carapace d'un trilobite ?",r:"De chitine renforcée de calcite",
 autres:["D'os","De cartilage","De kératine"],
 exp:"C'est cette minéralisation par la calcite qui explique l'abondance des trilobites dans les roches : la plupart des arthropodes marins actuels n'ont qu'une cuticule organique, qui disparaît presque toujours.",
 lien:["Wikipédia — Trilobite","https://fr.wikipedia.org/wiki/Trilobite"]},

{niv:2,q:"La plupart des fossiles de trilobites ne sont pas des cadavres. Que sont-ils ?",r:"Des mues abandonnées",
 autres:["Des œufs","Des empreintes de déplacement","Des coprolithes"],
 exp:"Un arthropode grandit en changeant de carapace. Un même individu laisse donc des dizaines d'exuvies au cours de sa vie, et une seule dépouille. Compter les fossiles ne revient pas à compter les animaux.",
 lien:["Wikipédia — Mue (biologie)","https://fr.wikipedia.org/wiki/Mue"]},

{niv:3,q:"Qu'ont de tout à fait exceptionnel les yeux des trilobites ?",r:"Leurs cristallins sont en calcite, un minéral",
 autres:["Ils voyaient dans l'infrarouge","Ils étaient mobiles sur pédoncules","Ils repoussaient après blessure"],
 exp:"Ce sont les seuls yeux minéraux connus chez un animal. Chez les phacopidés, chaque lentille est isolée et sa structure en doublet corrige l'aberration sphérique — une optique établie en analysant la géométrie des cristaux.",
 lien:["Wikipédia — Trilobite","https://fr.wikipedia.org/wiki/Trilobite"]},

{niv:2,q:"Que fait un trilobite qui s'enroule sur lui-même ?",r:"Il se protège, en ne laissant que sa carapace à l'extérieur",
 autres:["Il se reproduit","Il mue","Il nage plus vite"],
 exp:"L'enroulement est une défense, comme chez le cloporte ou le tatou. De nombreux fossiles sont trouvés enroulés, ce qui indique souvent un enfouissement soudain — l'animal s'est protégé au mauvais moment.",
 lien:["Wikipédia — Trilobite","https://fr.wikipedia.org/wiki/Trilobite"]},

{niv:1,q:"Combien de temps le groupe des trilobites a-t-il existé ?",r:"Environ 270 millions d'années",
 autres:["Environ 30 millions d'années","Environ 800 millions d'années","Environ 5 millions d'années"],
 exp:"Du Cambrien inférieur à l'extinction de la fin du Permien. À titre de comparaison, le genre Homo existe depuis moins de trois millions d'années : les trilobites ont duré cent fois plus longtemps.",
 lien:["Wikipédia — Trilobite","https://fr.wikipedia.org/wiki/Trilobite"]},

/* ---- Holothuries ---- */
{niv:1,q:"À quel embranchement appartient un concombre de mer ?",r:"Aux échinodermes",
 autres:["Aux mollusques","Aux annélides","Aux arthropodes"],
 exp:"Ses parents les plus proches sont les oursins, malgré l'absence totale de ressemblance. Étoiles de mer, oursins, ophiures, crinoïdes et holothuries forment un même embranchement.",
 lien:["Wikipédia — Holothurie","https://fr.wikipedia.org/wiki/Holothurie"]},

{niv:3,q:"Où retrouve-t-on la symétrie à cinq branches, typique des échinodermes, chez une holothurie ?",r:"Dans les cinq rangées longitudinales de podia le long du corps",
 autres:["Dans ses cinq tentacules buccaux","Dans la forme de sa bouche","Nulle part : elle l'a perdue"],
 exp:"La symétrie pentaradiale est là, mais étirée dans la longueur au lieu d'être disposée en étoile. Comme tous les échinodermes, l'holothurie naît d'une larve à symétrie bilatérale et acquiert la symétrie à cinq branches ensuite.",
 lien:["Wikipédia — Holothurie","https://fr.wikipedia.org/wiki/Holothurie"]},

{niv:2,q:"Que fait une holothurie menacée par un prédateur ?",r:"Elle expulse une partie de ses organes internes",
 autres:["Elle change de couleur","Elle libère un nuage d'encre","Elle se gonfle d'eau et flotte"],
 exp:"On appelle cela l'éviscération. L'animal expulse son tube digestif — vers l'avant ou vers l'arrière selon les groupes — puis le régénère entièrement. Chez certaines espèces, l'intestin retrouve sa fonction en une quinzaine de jours.",
 lien:["Revue sur la régénération intestinale des holothuries","https://pmc.ncbi.nlm.nih.gov/articles/PMC9332576/"]},

{niv:3,q:"Qu'est-ce que le tissu conjonctif mutable des échinodermes ?",r:"Un tissu dont la rigidité change en quelques secondes, sous contrôle nerveux",
 autres:["Un muscle capable de repousser","Un tissu qui produit du venin","Une couche de graisse isolante"],
 exp:"C'est ce qui permet à une holothurie de passer de molle à ferme, et de rompre volontairement certaines attaches lors de l'éviscération. Ce ne sont pas des muscles : la matrice de collagène elle-même se raidit ou se relâche.",
 lien:["Byrne 2023 — Mutable collagenous tissues","https://doi.org/10.3390/md21030134"]},

{niv:2,q:"Pourquoi les holothuries sont-elles presque absentes du registre fossile ?",r:"Leur squelette se réduit à des spicules calcaires microscopiques dispersés",
 autres:["Elles sont apparues très récemment","Elles vivent uniquement en eau douce","Elles se décomposent en quelques minutes"],
 exp:"Le corps mou ne laisse rien, et les spicules se dispersent au lieu de former une pièce reconnaissable. Un groupe peut être abondant, ancien et écologiquement majeur tout en étant quasiment invisible dans les roches.",
 lien:["Wikipédia — Holothurie","https://fr.wikipedia.org/wiki/Holothurie"]},

/* ---- Requins ---- */
{niv:1,q:"De quoi est fait le squelette d'un requin ?",r:"De cartilage, parfois renforcé de sels de calcium",
 autres:["D'os compact","De chitine","De kératine"],
 exp:"C'est ce qui rend le groupe si difficile à lire dans les roches : d'un requin fossile, il ne reste d'ordinaire que les dents et les denticules de la peau. Les gisements à corps entiers, comme Bear Gulch, sont des exceptions.",
 lien:["Wikipédia — Requin","https://fr.wikipedia.org/wiki/Requin"]},

{niv:3,q:"Quel est le rapport entre les dents d'un requin et les écailles de sa peau ?",r:"Ce sont les mêmes structures : les dents dérivent des denticules cutanés",
 autres:["Aucun : elles ont des origines différentes","Les écailles sont des dents usées et rejetées","Les dents sont des écailles minéralisées après la mort"],
 exp:"Denticules et dents partagent la même architecture — un noyau de dentine sous un émail. La peau d'un requin est râpeuse parce qu'elle est couverte de dents miniatures orientées vers l'arrière.",
 lien:["Wikipédia — Requin","https://fr.wikipedia.org/wiki/Requin"]},

{niv:2,q:"Comment un requin remplace-t-il ses dents ?",r:"En continu, par des rangées qui avancent depuis l'intérieur de la mâchoire",
 autres:["Une seule fois, au passage à l'âge adulte","Jamais : il conserve les mêmes toute sa vie","Chaque année, à la saison de reproduction"],
 exp:"C'est pour cette raison qu'un seul individu sème des milliers de dents au cours de sa vie, et que les dents fossiles de requins sont si communes alors que les squelettes sont introuvables.",
 lien:["Wikipédia — Requin","https://fr.wikipedia.org/wiki/Requin"]},

{niv:3,q:"À quoi servent les ampoules de Lorenzini, sur le museau d'un requin ?",r:"À détecter les champs électriques produits par les muscles des proies",
 autres:["À détecter les odeurs à grande distance","À mesurer la profondeur","À produire de la lumière"],
 exp:"Ce sont des pores emplis de gel, sensibles à des différences de potentiel très faibles. Un requin peut ainsi repérer un poisson enfoui dans le sable, sans le voir ni le sentir.",
 lien:["Wikipédia — Ampoule de Lorenzini","https://fr.wikipedia.org/wiki/Ampoule_de_Lorenzini"]},

{niv:2,q:"Comment un requin compense-t-il l'absence de vessie natatoire ?",r:"Par un foie très volumineux, riche en huile peu dense",
 autres:["Par des poumons","En avalant de l'air en surface","Par des cavités d'air dans son cartilage"],
 exp:"Le foie peut représenter le quart de la masse de l'animal. La flottabilité reste néanmoins légèrement négative chez beaucoup d'espèces, ce qui les oblige à nager pour ne pas couler.",
 lien:["Wikipédia — Requin","https://fr.wikipedia.org/wiki/Requin"]},

/* ---- Cétacés ---- */
{niv:1,q:"De quel groupe de mammifères terrestres les cétacés sont-ils issus ?",r:"Des artiodactyles, les mammifères à doigts pairs",
 autres:["Des carnivores","Des périssodactyles","Des insectivores"],
 exp:"Les données moléculaires les placent à côté des hippopotames. L'anatomie l'a confirmée en 2001 : l'astragale des archéocètes porte la double poulie caractéristique des artiodactyles.",
 lien:["Wikipédia — Cétacé","https://fr.wikipedia.org/wiki/C%C3%A9tac%C3%A9"]},

{niv:2,q:"De quoi sont faits les fanons d'une baleine ?",r:"De kératine, comme les ongles et les cheveux",
 autres:["D'os","D'émail dentaire","De cartilage"],
 exp:"Ce ne sont pas des dents. Les mysticètes ont perdu leur denture fonctionnelle et filtrent l'eau à travers ces lames cornées ; les embryons développent pourtant encore des ébauches de dents, qui régressent avant la naissance.",
 lien:["Wikipédia — Fanon (baleine)","https://fr.wikipedia.org/wiki/Fanon_(baleine)"]},

{niv:3,q:"Qu'est-ce que l'écholocation chez les cétacés à dents ?",r:"L'émission de clics et l'analyse de leur écho pour localiser des objets",
 autres:["La communication par chants sur de longues distances","L'orientation grâce au champ magnétique terrestre","La détection des courants par la peau"],
 exp:"Les clics sont produits dans les voies nasales, focalisés par le melon — une masse grasse du front — et l'écho revient par la mâchoire inférieure jusqu'à l'oreille interne. Les baleines à fanons, elles, ne pratiquent pas l'écholocation.",
 lien:["Wikipédia — Écholocation","https://fr.wikipedia.org/wiki/%C3%89cholocation"]},

{niv:2,q:"Pourquoi une baleine ne peut-elle pas respirer par la bouche ?",r:"Ses voies respiratoires sont séparées de son tube digestif et débouchent à l'évent",
 autres:["Elle n'a pas de poumons","Sa bouche reste fermée sous l'eau","Elle respire par la peau"],
 exp:"Les narines ont migré au sommet du crâne au cours de l'évolution, et le larynx s'est réorganisé pour isoler complètement l'air de la nourriture. Un cétacé ne peut donc pas s'étouffer en avalant.",
 lien:["Wikipédia — Cétacé","https://fr.wikipedia.org/wiki/C%C3%A9tac%C3%A9"]},

{niv:3,q:"Requins, ichtyosaures et dauphins ont des silhouettes très voisines. Comment appelle-t-on ce phénomène ?",r:"Une convergence évolutive",
 autres:["Une homologie","Une hérédité commune récente","Un atavisme"],
 exp:"Trois lignées sans lien proche — un poisson cartilagineux, un reptile, un mammifère — ont abouti au même profil parce que l'eau impose les mêmes contraintes. La ressemblance de forme ne dit rien de la parenté.",
 lien:["Wikipédia — Convergence évolutive","https://fr.wikipedia.org/wiki/%C3%89volution_convergente"]}

];

/* ================================================================
   Bloc 6 : pack PHILOSOPHIE.

   Philosophie des sciences prise par le bout que l'atlas manipule déjà :
   qu'est-ce qu'un fossile prouve, comment on nomme, ce que vaut une
   absence, pourquoi une reconstitution change sans que l'animal bouge.
   Chaque question a un ancrage concret dans le jeu — Helicoprion,
   Atopodentatus, Tullimonstrum, les trois niveaux documentaires.

   Écrit à la main. Chaque item porte un lien de lecture.
   ================================================================ */

const PHILO=[

{niv:1,q:"Qu'est-ce qu'un énoncé scientifique doit pouvoir supporter, selon Karl Popper ?",
 r:"Une tentative de réfutation",
 autres:["Une démonstration mathématique","Un vote de la communauté","Une confirmation par l'expérience"],
 exp:"Pour Popper, ce qui distingue une théorie scientifique n'est pas d'être prouvée mais de pouvoir être mise en défaut. « Tous les cygnes sont blancs » est scientifique parce qu'un cygne noir suffirait à l'abattre.",
 lien:["Wikipédia — Réfutabilité","https://fr.wikipedia.org/wiki/R%C3%A9futabilit%C3%A9"]},

{niv:2,q:"Pendant un siècle, on a placé la spirale dentaire d'Helicoprion sur le museau, sur la nageoire, dans la gorge. Que montre cet épisode ?",
 r:"Qu'une donnée peut être solide et son interprétation entièrement ouverte",
 autres:["Que les paléontologues du passé travaillaient mal","Que le fossile était un faux","Que la science finit toujours par se tromper"],
 exp:"La spirale était parfaitement conservée et correctement décrite. Ce qui manquait, c'était le contexte anatomique — livré par une tomographie en 2013. Observer et interpréter sont deux opérations distinctes.",
 lien:["Wikipédia — Helicoprion","https://fr.wikipedia.org/wiki/Helicoprion"]},

{niv:2,q:"Que signifie l'adage « l'absence de preuve n'est pas la preuve de l'absence » pour un paléontologue ?",
 r:"Ne pas trouver un fossile ne démontre pas que l'animal n'existait pas",
 autres:["Toute hypothèse se vaut tant qu'on n'a rien trouvé","Un fossile absent doit être supposé présent","Les lacunes du registre sont sans importance"],
 exp:"Un groupe peut manquer parce qu'il n'a jamais existé, parce qu'il ne se fossilisait pas, ou parce que personne n'a encore creusé au bon endroit. Alpkarakush a comblé un vide de plusieurs milliers de kilomètres qui n'était qu'un vide de prospection.",
 lien:["Wikipédia — Argument d'ignorance","https://fr.wikipedia.org/wiki/Argument_d%27ignorance"]},

{niv:3,q:"En quoi consiste le problème de l'induction, posé par David Hume ?",
 r:"Rien ne garantit logiquement que ce qui s'est toujours produit se reproduira",
 autres:["Les sens nous trompent systématiquement","Les mathématiques ne s'appliquent pas au réel","On ne peut rien connaître du passé"],
 exp:"D'un très grand nombre d'observations concordantes, on ne peut pas déduire une loi avec certitude logique. Toute science du passé travaille avec cette limite, et l'assume au lieu de la nier.",
 lien:["Wikipédia — Problème de l'induction","https://fr.wikipedia.org/wiki/Probl%C3%A8me_de_l%27induction"]},

{niv:1,q:"Que dit le rasoir d'Ockham ?",
 r:"À pouvoir explicatif égal, l'hypothèse la plus simple est préférable",
 autres:["Les explications simples sont toujours vraies","Il faut rejeter toute hypothèse invérifiable","La nature ne fait rien d'inutile"],
 exp:"C'est un principe de choix, pas de vérité. Il ne dit pas que le monde est simple : il dit que multiplier les entités sans nécessité rend une explication moins testable, donc moins utile.",
 lien:["Wikipédia — Rasoir d'Ockham","https://fr.wikipedia.org/wiki/Rasoir_d%27Ockham"]},

{niv:2,q:"Atopodentatus a d'abord été reconstitué avec un museau fendu verticalement, avant d'être corrigé en tête en marteau. Comment qualifier la première version ?",
 r:"Une inférence honnête faite à partir d'un matériel abîmé",
 autres:["Une fraude scientifique","Une erreur de calcul","Une invention destinée à faire parler"],
 exp:"Elle a été publiée, discutée, puis révisée à la lumière de deux crânes mieux conservés. Ce n'est pas un dysfonctionnement de la science : c'est son fonctionnement normal, rendu visible.",
 lien:["Wikipédia — Atopodentatus","https://fr.wikipedia.org/wiki/Atopodentatus"]},

{niv:3,q:"Le jeu affiche pour chaque créature un degré de confiance graphique. Pourquoi est-ce plus honnête qu'une image sans mention ?",
 r:"Parce que l'image montre au même titre ce qui est observé et ce qui est extrapolé",
 autres:["Parce que les illustrations sont toutes fausses","Parce que la loi l'impose","Parce que cela rend l'image plus belle"],
 exp:"Un squelette contraint la silhouette ; la couleur, la texture, la posture au repos ne le sont presque jamais. Une reconstitution donne le même degré de netteté aux deux, et c'est là qu'elle induit en erreur.",
 lien:["Wikipédia — Paléoart","https://fr.wikipedia.org/wiki/Pal%C3%A9oart"]},

{niv:2,q:"Tullimonstrum est connu par des milliers de spécimens, et son embranchement reste indéterminé. Que faut-il en conclure ?",
 r:"Que la quantité de données ne suffit pas à trancher une question de classification",
 autres:["Que les spécimens sont mal conservés","Que l'animal n'a jamais existé","Qu'il s'agit forcément d'un vertébré"],
 exp:"Le désaccord ne porte pas sur ce qu'on voit mais sur ce que les structures visibles signifient. Accumuler des exemplaires n'aide pas si le point litigieux est un critère d'interprétation.",
 lien:["Wikipédia — Tullimonstrum","https://fr.wikipedia.org/wiki/Tullimonstrum"]},

{niv:3,q:"Qu'appelle-t-on une espèce, si l'on ne peut pas tester la reproduction chez les fossiles ?",
 r:"Un regroupement fondé sur des critères anatomiques, révisable",
 autres:["Un fait de nature indiscutable","Une convention purement arbitraire","Un groupe défini par son génome"],
 exp:"Le critère d'interfécondité est inapplicable au passé. Les espèces fossiles sont délimitées par la morphologie, donc par un jugement — ce qui explique que Marsh et Cope aient pu nommer autant d'espèces qui n'en étaient pas.",
 lien:["Wikipédia — Espèce","https://fr.wikipedia.org/wiki/Esp%C3%A8ce"]},

{niv:2,q:"Les crânes de Triceratops replacés couche par couche montrent une transformation graduelle. Pourquoi la stratigraphie était-elle indispensable ?",
 r:"Parce que sans position dans le temps, une différence de forme reste ininterprétable",
 autres:["Parce qu'elle permet de dater au carbone 14","Parce qu'elle prouve l'existence de l'évolution","Parce qu'elle mesure la taille des populations"],
 exp:"Les mêmes crânes, sans leur niveau d'origine, auraient pu se lire comme deux espèces contemporaines, ou comme mâles et femelles. C'est l'ordre qui fait l'argument, pas la morphologie seule.",
 lien:["PNAS — Evolutionary trends in Triceratops","https://www.pnas.org/doi/10.1073/pnas.1313334111"]},

{niv:1,q:"Qu'est-ce qu'un biais d'échantillonnage, dans le registre fossile ?",
 r:"Une distorsion due à ce qui se conserve et à ce qui est prospecté",
 autres:["Une erreur de datation","Un défaut du microscope","Un désaccord entre chercheurs"],
 exp:"Les organismes minéralisés, marins et abondants sont surreprésentés. Compter les espèces fossiles revient d'abord à compter les conditions favorables à la fossilisation.",
 lien:["Wikipédia — Registre fossile","https://fr.wikipedia.org/wiki/Fossile"]},

{niv:3,q:"Requin, ichtyosaure et dauphin ont des formes voisines sans être proches parents. Quelle leçon épistémologique en tirer ?",
 r:"La ressemblance n'établit pas la parenté ; il faut d'autres critères",
 autres:["Les apparences sont toujours trompeuses","Ces trois animaux ont un ancêtre commun récent","La classification est arbitraire"],
 exp:"C'est pourquoi la systématique ne se fonde pas sur la ressemblance globale mais sur des caractères dérivés partagés. Un raisonnement par analogie doit toujours être contrôlé par une autre source.",
 lien:["Wikipédia — Évolution convergente","https://fr.wikipedia.org/wiki/%C3%89volution_convergente"]},

{niv:2,q:"Que reproche-t-on à une explication qui peut rendre compte de n'importe quel résultat ?",
 r:"Elle ne peut être mise en défaut par aucune observation, donc elle n'apprend rien",
 autres:["Elle est trop compliquée à comprendre","Elle n'est pas assez générale","Elle contredit les mathématiques"],
 exp:"Une hypothèse qui prédit tout ne prédit rien. C'est la raison pour laquelle « les grandes crises ont plusieurs causes » doit être précisé : lesquelles, dans quel ordre, avec quelle contribution.",
 lien:["Wikipédia — Réfutabilité","https://fr.wikipedia.org/wiki/R%C3%A9futabilit%C3%A9"]},

{niv:3,q:"Le principe d'actualisme suppose que les lois physiques d'aujourd'hui valaient dans le passé. Est-ce démontrable ?",
 r:"Non : c'est un postulat de travail, mais il est sans cesse mis à l'épreuve",
 autres:["Oui, par l'expérience directe","Non, et c'est pourquoi la géologie n'est pas une science","Oui, c'est une conséquence des mathématiques"],
 exp:"On ne peut pas retourner observer le Dévonien. Mais si les lois avaient changé, on s'attendrait à des incohérences entre méthodes indépendantes — datations, sédimentologie, astronomie. On n'en trouve pas.",
 lien:["Wikipédia — Actualisme","https://fr.wikipedia.org/wiki/Actualisme_(g%C3%A9ologie)"]},

{niv:2,q:"Pourquoi un fossile se date-t-il presque toujours par la couche qui le contient, et non directement ?",
 r:"Parce que la datation radiométrique s'applique aux minéraux, pas à l'os fossilisé",
 autres:["Parce que les os sont trop fragiles","Parce que le carbone 14 est trop coûteux","Parce que les fossiles n'ont pas d'âge propre"],
 exp:"On date les cendres volcaniques ou les cristaux encadrant le niveau, puis on encadre le fossile. La connaissance passe donc par un intermédiaire — la couche — et non par l'objet qui intéresse.",
 lien:["Wikipédia — Datation radiométrique","https://fr.wikipedia.org/wiki/Datation_radiom%C3%A9trique"]},

{niv:1,q:"Que veut dire qu'une reconstitution est « provisoire » ?",
 r:"Qu'elle représente le meilleur état actuel des données, appelé à changer",
 autres:["Qu'elle est probablement fausse","Qu'elle n'a aucune valeur","Qu'elle sera confirmée un jour"],
 exp:"Provisoire ne veut pas dire douteux. Une reconstitution provisoire est ce qu'on a de plus solide aujourd'hui — et ce qui devra céder devant un fossile mieux conservé.",
 lien:["Wikipédia — Paléoart","https://fr.wikipedia.org/wiki/Pal%C3%A9oart"]},

{niv:3,q:"Stephen Jay Gould voyait dans Burgess la preuve d'expérimentations évolutives avortées ; d'autres ont rangé ces animaux dans des groupes existants. De quoi porte ce désaccord ?",
 r:"De ce que les fossiles autorisent à conclure, pas de ce qu'ils montrent",
 autres:["De la datation du gisement","De l'authenticité des spécimens","De la qualité des dessins"],
 exp:"Les deux camps voient les mêmes animaux. Ils divergent sur la portée : Burgess raconte-t-il une explosion de plans corporels perdus, ou la diversification ordinaire d'embranchements toujours vivants ? La question reste ouverte.",
 lien:["Wikipédia — Schistes de Burgess","https://fr.wikipedia.org/wiki/Schistes_de_Burgess"]},

{niv:2,q:"Pourquoi la mention d'un degré de confiance sur une fiche n'est-elle pas un aveu de faiblesse ?",
 r:"Parce qu'elle rend l'affirmation vérifiable et permet de la contester",
 autres:["Parce qu'elle protège juridiquement l'auteur","Parce qu'elle rend le texte plus court","Parce qu'elle décourage les questions"],
 exp:"Une affirmation sans qualification ne peut être ni évaluée ni corrigée : on ne sait pas sur quoi elle repose. Dire ce qu'on sait, et à quel point, est plus exigeant que d'affirmer.",
 lien:["Wikipédia — Incertitude","https://fr.wikipedia.org/wiki/Incertitude"]},

{niv:3,q:"Les trilobites ont duré 270 millions d'années, le genre Homo moins de trois. Qu'est-ce que cette échelle devrait tempérer ?",
 r:"L'idée que l'évolution tendrait vers nous",
 autres:["L'idée que les trilobites étaient primitifs","La fiabilité des datations","L'importance de l'extinction permienne"],
 exp:"Lire l'histoire du vivant comme une marche vers l'espèce humaine s'appelle une lecture téléologique. Rien dans les données ne l'appuie : les lignées durables ne sont pas celles qui mènent quelque part.",
 lien:["Wikipédia — Téléologie","https://fr.wikipedia.org/wiki/T%C3%A9l%C3%A9ologie"]},

{niv:2,q:"Que fait un chercheur qui, devant deux hypothèses également compatibles avec les données, ne tranche pas ?",
 r:"Il décrit correctement l'état de la question",
 autres:["Il manque de rigueur","Il refuse de faire son travail","Il choisit implicitement la plus simple"],
 exp:"Trancher sans motif reviendrait à présenter une préférence comme un résultat. Suspendre le jugement est une position argumentée, à condition de dire précisément ce qui manquerait pour décider.",
 lien:["Wikipédia — Scepticisme scientifique","https://fr.wikipedia.org/wiki/Scepticisme_scientifique"]}

];

/* ================================================================
   Bloc 7 : packs HISTOIRE DE L'ART.

   Deux banques symétriques. La première suit le cursus tel qu'il
   s'enseigne chez nous ; la seconde prend le reste du monde — non
   comme un supplément exotique, mais comme des traditions qui ont
   résolu les mêmes problèmes autrement, souvent plus tôt.

   Le fil qui les relie est celui de la conversation sur l'histoire
   de la philosophie : le cursus n'est pas neutre, il a été construit,
   et il vaut la peine de savoir par qui.

   Chaque item porte un lien. Le champ `img` est facultatif : il
   pointe vers une image du domaine public à rapatrier localement
   avec tools/telecharger_art.py. Sans elle, la question fonctionne.
   ================================================================ */

const ART_EU=[

{niv:2,q:"Qui formalise la perspective linéaire à un point de fuite, au début du XVᵉ siècle à Florence ?",
 r:"Filippo Brunelleschi, puis Leon Battista Alberti par écrit",
 autres:["Léonard de Vinci","Giotto di Bondone","Albrecht Dürer"],
 exp:"Brunelleschi en fait la démonstration vers 1415 avec deux panneaux peints et un dispositif à miroir. Alberti en donne la théorie écrite dans le De pictura en 1435. C'est une construction géométrique, pas une découverte de la manière dont on voit.",
 lien:["Wikipédia — Perspective linéaire","https://fr.wikipedia.org/wiki/Perspective_lin%C3%A9aire"]},

{niv:1,q:"Qu'est-ce que le contrapposto, apparu dans la sculpture grecque vers 480 av. J.-C. ?",
 r:"Une posture où le poids repose sur une jambe, déséquilibrant hanches et épaules",
 autres:["Une technique de polissage du marbre","Un type de socle","Un canon de proportions du corps"],
 exp:"L'axe du corps cesse d'être rigide et symétrique. C'est le passage du kouros archaïque, frontal et figé, à une figure qui semble pouvoir bouger. Le Doryphore de Polyclète en est l'exemple canonique.",
 lien:["Wikipédia — Contrapposto","https://fr.wikipedia.org/wiki/Contrapposto"]},

{niv:2,q:"Pourquoi Giotto fait-il figure de rupture au début du XIVᵉ siècle ?",
 r:"Il donne à ses figures un volume et un poids, dans un espace qui a de la profondeur",
 autres:["Il invente la peinture à l'huile","Il abandonne les sujets religieux","Il signe le premier ses œuvres"],
 exp:"Les fonds d'or byzantins situaient les figures hors du monde. Giotto les pose dans un lieu, leur donne des corps qui occupent de la place et des visages qui réagissent. La chapelle Scrovegni de Padoue, vers 1305, en est la démonstration.",
 lien:["Wikipédia — Giotto di Bondone","https://fr.wikipedia.org/wiki/Giotto_di_Bondone"]},

{niv:3,q:"Qu'apporte techniquement la peinture à l'huile, généralisée dans les Flandres au XVᵉ siècle ?",
 r:"Un séchage lent qui permet les glacis, les fondus et les retouches",
 autres:["Des couleurs plus vives que la fresque","Un coût de production plus faible","Une meilleure résistance au feu"],
 exp:"La détrempe à l'œuf sèche vite et impose de travailler par hachures. L'huile autorise des couches transparentes superposées, d'où la profondeur des noirs et le rendu des matières chez Van Eyck. Il ne l'a pas inventée, il l'a portée à un point de maîtrise nouveau.",
 lien:["Wikipédia — Peinture à l'huile","https://fr.wikipedia.org/wiki/Peinture_%C3%A0_l%27huile"],
 img:"art/annonciation.webp"},

{niv:3,q:"À qui doit-on le récit de l'art comme progrès continu, de Cimabue à Michel-Ange ?",
 r:"À Giorgio Vasari, dans ses Vies publiées en 1550",
 autres:["À Winckelmann au XVIIIᵉ siècle","À Diderot","À Vitruve"],
 exp:"Vasari écrit une histoire orientée : l'art déchoit après l'Antiquité, renaît avec Giotto, culmine avec Michel-Ange — son contemporain et son ami. C'est de lui que viennent le mot « Renaissance » et l'usage de « gothique » comme insulte. Le plan de nos manuels est encore largement le sien.",
 lien:["Wikipédia — Giorgio Vasari","https://fr.wikipedia.org/wiki/Giorgio_Vasari"]},

{niv:2,q:"Qu'est-ce que le sfumato ?",
 r:"Un passage insensible d'un ton à l'autre, sans contour tracé",
 autres:["Un contraste violent entre ombre et lumière","Une technique de dessin préparatoire","Un vernis final teinté"],
 exp:"Léonard décrit des contours qui se perdent « comme la fumée ». L'effet supprime la ligne, que la tradition florentine tenait pour le fondement du dessin. C'est une position théorique autant qu'un procédé.",
 lien:["Wikipédia — Sfumato","https://fr.wikipedia.org/wiki/Sfumato"],
 img:"art/ginevra.webp"},

{niv:2,q:"Qu'appelle-t-on ténébrisme, associé au Caravage ?",
 r:"Un éclairage violent et dirigé, laissant le reste dans une ombre profonde",
 autres:["L'emploi exclusif de pigments sombres","La peinture de scènes nocturnes","Un fond noir sans modelé"],
 exp:"La lumière ne baigne plus la scène, elle la découpe. Chez Caravage, elle vient souvent d'une source hors champ et frappe des personnages pris dans la rue — ce qui a autant choqué que la technique elle-même.",
 lien:["Wikipédia — Ténébrisme","https://fr.wikipedia.org/wiki/T%C3%A9n%C3%A9brisme"]},

{niv:3,q:"Pourquoi « La Ronde de nuit » de Rembrandt porte-t-elle un titre inexact ?",
 r:"La scène se passe de jour : le tableau avait noirci sous les vernis",
 autres:["Rembrandt l'avait intitulée ainsi par ironie","Elle représente une ronde militaire nocturne","Le titre vient d'une erreur de traduction"],
 exp:"Le nettoyage a rendu la lumière du jour. Le titre, apparu bien après, a survécu à sa réfutation — un cas ordinaire : ce qu'on croit savoir d'une œuvre est souvent une couche déposée par sa réception.",
 lien:["Wikipédia — La Ronde de nuit","https://fr.wikipedia.org/wiki/La_Ronde_de_nuit"]},

{niv:3,q:"Que classait la hiérarchie des genres de l'Académie royale, au sommet et en bas ?",
 r:"La peinture d'histoire au sommet, la nature morte en bas",
 autres:["Le portrait au sommet, le paysage en bas","Le paysage au sommet, le portrait en bas","La nature morte au sommet, la peinture d'histoire en bas"],
 exp:"L'ordre : histoire, portrait, scène de genre, paysage, nature morte. Il ne classe pas la qualité mais le sujet, et détermine les commandes, les prix et les carrières. Une bonne part de l'art du XIXᵉ siècle consiste à le renverser.",
 lien:["Wikipédia — Hiérarchie des genres","https://fr.wikipedia.org/wiki/Hi%C3%A9rarchie_des_genres"]},

{niv:2,q:"Qu'est-ce que le néoclassicisme cherche dans l'Antiquité, à la fin du XVIIIᵉ siècle ?",
 r:"Un modèle de rigueur morale et formelle, contre la légèreté rococo",
 autres:["Des sujets exotiques inédits","Une liberté de couleur nouvelle","Un retour à la peinture religieuse"],
 exp:"Les fouilles d'Herculanum et Pompéi, puis les écrits de Winckelmann, fournissent un répertoire. David en tire une peinture de la vertu civique — Le Serment des Horaces, 1784 — qui sera aussitôt lue politiquement.",
 lien:["Wikipédia — Néoclassicisme","https://fr.wikipedia.org/wiki/N%C3%A9oclassicisme"]},

{niv:3,q:"Que représente « Le Radeau de la Méduse » de Géricault, exposé en 1819 ?",
 r:"Un naufrage récent devenu scandale politique",
 autres:["Une scène mythologique","Une bataille napoléonienne","Une allégorie de la Révolution"],
 exp:"La frégate française Méduse s'échoue en 1816 par l'incompétence d'un capitaine nommé par faveur ; cent quarante-sept personnes sont abandonnées sur un radeau. Géricault traite un fait divers accusateur au format monumental réservé à l'histoire — c'est cette transgression qui fait l'œuvre.",
 lien:["Wikipédia — Le Radeau de la Méduse","https://fr.wikipedia.org/wiki/Le_Radeau_de_La_M%C3%A9duse"]},

{niv:2,q:"Que revendique Gustave Courbet en peignant « Un enterrement à Ornans » en 1850 ?",
 r:"Que des villageois anonymes méritent le format de la peinture d'histoire",
 autres:["Que la peinture doit être abstraite","Que l'art doit servir la religion","Que le paysage prime sur la figure"],
 exp:"Une toile de plus de six mètres, sans héros, sans leçon, sans ciel ouvert. Le scandale ne porte pas sur la technique mais sur ce que l'échelle prétend honorer. Le réalisme est d'abord une décision sur ce qui mérite d'être peint.",
 lien:["Wikipédia — Un enterrement à Ornans","https://fr.wikipedia.org/wiki/Un_enterrement_%C3%A0_Ornans"]},

{niv:2,q:"D'où vient le mot « impressionnisme » ?",
 r:"D'une moquerie de critique, reprise par les peintres eux-mêmes",
 autres:["D'un manifeste écrit par Monet","Du nom de la galerie qui les exposait","D'un terme technique de la peinture à l'huile"],
 exp:"En 1874, le critique Louis Leroy raille « Impression, soleil levant » de Monet dans Le Charivari. Le groupe adopte le sobriquet. Plusieurs noms de mouvements — gothique, baroque, fauvisme, cubisme — sont d'abord des insultes retournées.",
 lien:["Wikipédia — Impressionnisme","https://fr.wikipedia.org/wiki/Impressionnisme"]},

{niv:3,q:"Que cherche Cézanne quand il dit vouloir « faire du Poussin sur nature » ?",
 r:"Retrouver une construction solide sans renoncer à la sensation devant le motif",
 autres:["Copier littéralement les tableaux de Poussin","Peindre uniquement en atelier","Revenir aux sujets mythologiques"],
 exp:"Il tient ensemble deux exigences que l'impressionnisme avait dissociées : la structure et l'instant. Les plans colorés qui en résultent ouvrent directement sur le cubisme, d'où la formule de « père de l'art moderne ».",
 lien:["Wikipédia — Paul Cézanne","https://fr.wikipedia.org/wiki/Paul_C%C3%A9zanne"],
 img:"art/cezanne_eau.webp"},

{niv:2,q:"Que fait le cubisme analytique à l'objet, vers 1909-1912 ?",
 r:"Il le montre sous plusieurs angles simultanément, en fragments",
 autres:["Il le réduit à des couleurs pures","Il le supprime au profit de l'abstraction","Il l'agrandit jusqu'à l'illisible"],
 exp:"Cinq siècles après Brunelleschi, le point de vue unique est abandonné. Braque et Picasso travaillent alors si près l'un de l'autre que leurs toiles sont parfois difficiles à départager.",
 lien:["Wikipédia — Cubisme","https://fr.wikipedia.org/wiki/Cubisme"]},

{niv:3,q:"Quelle source Picasso a-t-il mobilisée pour les visages de droite des « Demoiselles d'Avignon » en 1907 ?",
 r:"Des masques africains et océaniens vus au musée d'ethnographie du Trocadéro",
 autres:["Des fresques romaines de Pompéi","Des icônes byzantines","Des gravures japonaises"],
 exp:"L'emprunt est massif et reconnu. Il a longtemps été qualifié d'« influence primitive », formule qui range les sources du côté de la matière brute et le peintre du côté de l'invention. Les objets en question venaient de traditions savantes, souvent rapportés par la conquête coloniale.",
 lien:["Wikipédia — Les Demoiselles d'Avignon","https://fr.wikipedia.org/wiki/Les_Demoiselles_d%27Avignon"]},

{niv:2,q:"Qu'est-ce qu'un ready-made, au sens que lui donne Marcel Duchamp en 1917 ?",
 r:"Un objet manufacturé désigné comme œuvre par le seul choix de l'artiste",
 autres:["Une sculpture moulée en série","Une œuvre réalisée sans esquisse","Un tableau peint d'après photographie"],
 exp:"« Fontaine », un urinoir signé d'un pseudonyme, est refusé par une exposition pourtant sans jury. Le geste déplace la question : non plus comment c'est fait, mais qui a le pouvoir de dire que c'en est.",
 lien:["Wikipédia — Ready-made","https://fr.wikipedia.org/wiki/Ready-made"]},

{niv:3,q:"Pourquoi trouve-t-on si peu de femmes dans le cursus classique d'histoire de l'art ?",
 r:"Elles étaient exclues des académies et de l'étude du nu, donc des grands genres",
 autres:["Elles n'ont commencé à peindre qu'au XIXᵉ siècle","Leurs œuvres se sont moins bien conservées","Elles préféraient les arts décoratifs"],
 exp:"Sans accès au modèle vivant, la peinture d'histoire — sommet de la hiérarchie — leur était fermée. Plusieurs ont percé malgré tout : Sofonisba Anguissola, Artemisia Gentileschi, Élisabeth Vigée Le Brun. D'autres ont été effacées par réattribution : des toiles de Judith Leyster ont longtemps été vendues comme des Frans Hals.",
 lien:["Wikipédia — Judith Leyster","https://fr.wikipedia.org/wiki/Judith_Leyster"]},

{niv:1,q:"Qu'est-ce qu'une fresque, au sens technique strict ?",
 r:"Une peinture appliquée sur un enduit encore frais, qui l'incorpore en séchant",
 autres:["Toute peinture murale de grande dimension","Une peinture sur bois enduit","Une peinture à la cire chauffée"],
 exp:"Le pigment se lie chimiquement au carbonate de calcium et devient partie du mur. D'où la contrainte : il faut travailler vite, par surfaces quotidiennes, et l'on ne retouche pas. Ce qui est repris à sec vieillit beaucoup moins bien.",
 lien:["Wikipédia — Fresque","https://fr.wikipedia.org/wiki/Fresque"]},

{niv:3,q:"Qu'est-ce qui change dans la peinture avec l'invention du tube d'étain, en 1841 ?",
 r:"On peut peindre dehors, en une séance, avec une couleur prête à l'emploi",
 autres:["Les pigments deviennent moins toxiques","La toile remplace le bois","Les vernis sèchent plus vite"],
 exp:"Auparavant, on broyait et conservait la couleur en vessie de porc, mal, et brièvement. Renoir disait que sans le tube, il n'y aurait eu ni Cézanne, ni Monet, ni impressionnisme. Une histoire des formes est aussi une histoire des outils.",
 lien:["Wikipédia — Tube de peinture","https://fr.wikipedia.org/wiki/Tube_de_peinture"],
 img:"art/falaises_pourville.webp"}

];


const ART_MONDE=[

{niv:2,q:"Devant les têtes d'Ifé découvertes en 1910, quelle explication l'ethnologue Leo Frobenius a-t-il avancée ?",
 r:"Qu'elles venaient de l'Atlantide ou d'une colonie grecque",
 autres:["Qu'elles étaient des faux modernes","Qu'elles avaient été importées d'Égypte","Qu'elles dataient du XIXᵉ siècle"],
 exp:"Frobenius admirait leur naturalisme mais ne pouvait admettre une origine africaine. Les têtes sont l'œuvre de fondeurs yoruba d'Ifé, entre le XIIᵉ et le XVᵉ siècle. Une hypothèse peut être savante dans sa forme et raciste dans sa prémisse.",
 lien:["National Geographic — Les têtes d'Ifé","https://www.nationalgeographic.com/history/history-magazine/article/nigerian-treasures-ife-heads-bronze"]},

{niv:3,q:"Quelle technique les fondeurs d'Ifé et du Bénin maîtrisaient-ils ?",
 r:"La fonte à la cire perdue",
 autres:["Le martelage à froid sur noyau de bois","Le moulage en sable à deux coquilles","Le soudage de plaques découpées"],
 exp:"Un modèle en cire est enrobé d'argile, la cire est fondue et évacuée, le métal la remplace. La finesse obtenue sur les têtes d'Ifé — paupières, scarifications, lèvres — est comparable à ce que produisaient au même moment les meilleurs ateliers européens.",
 lien:["Wikipédia — Fonte à la cire perdue","https://fr.wikipedia.org/wiki/Fonte_%C3%A0_la_cire_perdue"]},

{niv:2,q:"Comment les bronzes du Bénin sont-ils arrivés dans les musées européens ?",
 r:"Par le pillage de Benin City par une expédition punitive britannique en 1897",
 autres:["Par des achats réguliers auprès de la cour du Bénin","Par des fouilles archéologiques du XXᵉ siècle","Par des dons de missionnaires"],
 exp:"Le palais royal est saccagé, l'oba exilé, et les milliers de plaques et de têtes dispersés dans plus de cent trente musées. Ces objets n'étaient pas des curiosités mais les archives dynastiques du royaume, fixées dans le métal.",
 lien:["Wikipédia — Bronzes du Bénin","https://fr.wikipedia.org/wiki/Bronzes_du_B%C3%A9nin"]},

{niv:3,q:"Où en sont les restitutions des bronzes du Bénin ?",
 r:"Engagées : l'Allemagne a transféré la propriété de plus de 1 100 pièces, les Pays-Bas en ont rendu 119 en 2025",
 autres:["Aucune restitution n'a eu lieu à ce jour","Toutes les pièces ont été rendues","Seule la France a restitué des objets"],
 exp:"L'accord germano-nigérian de juillet 2022 porte sur 1 130 objets ; la remise néerlandaise de juin 2025 est la plus importante en une fois. Le British Museum en conserve plus de neuf cents et ne les a pas rendus.",
 lien:["Euronews — Les Pays-Bas restituent 119 bronzes","https://euronews.com/culture/2025/06/19/netherlands-returns-more-than-100-benin-bronzes-looted-from-nigeria"]},

{niv:2,q:"À quand remontent les terres cuites Nok, au Nigeria ?",
 r:"Autour du milieu du premier millénaire avant notre ère",
 autres:["Au XVᵉ siècle de notre ère","Au IIᵉ siècle avant notre ère seulement","Au XIXᵉ siècle"],
 exp:"La culture Nok produit des figures humaines en terre cuite, aux yeux triangulaires caractéristiques, à peu près à l'époque où la Grèce entre dans sa période classique. Le pillage massif des sites depuis les années 1990 a détruit l'essentiel du contexte archéologique.",
 lien:["Wikipédia — Culture Nok","https://fr.wikipedia.org/wiki/Culture_Nok"]},

{niv:3,q:"Qu'ont soutenu les archéologues officiels de Rhodésie à propos du Grand Zimbabwe ?",
 r:"Que des bâtisseurs non africains en étaient les auteurs",
 autres:["Qu'il datait du XIXᵉ siècle","Qu'il s'agissait d'une formation naturelle","Qu'il avait été construit par les Portugais"],
 exp:"Phéniciens, Arabes, reine de Saba : toutes les hypothèses ont été essayées sauf la bonne. Les archéologues qui concluaient à une origine shona locale ont été censurés sous le régime rhodésien. Le site date du XIᵉ au XVᵉ siècle et donne son nom au pays.",
 lien:["Wikipédia — Grand Zimbabwe","https://fr.wikipedia.org/wiki/Grand_Zimbabwe"]},

{niv:2,q:"Comment ont été bâties les églises de Lalibela, en Éthiopie ?",
 r:"Taillées d'un seul bloc dans la roche, de haut en bas",
 autres:["Assemblées en pierres de taille","Creusées dans des grottes naturelles","Construites en brique crue"],
 exp:"On dégage la masse depuis la surface, puis on évide l'intérieur — l'inverse d'une construction. Onze édifices du XIIᵉ ou XIIIᵉ siècle, encore en usage liturgique aujourd'hui.",
 lien:["Wikipédia — Églises de Lalibela","https://fr.wikipedia.org/wiki/%C3%89glises_de_Lalibela"]},

{niv:3,q:"Comment se regarde un rouleau de paysage chinois de l'époque Song ?",
 r:"Progressivement, en le déroulant, le regard se déplaçant dans la scène",
 autres:["D'un seul coup d'œil, comme un tableau accroché","De droite à gauche, à distance fixe","À travers une ouverture ménagée dans un cadre"],
 exp:"Il n'y a pas de point de fuite unique, parce qu'il n'y a pas d'observateur immobile. La peinture Song n'ignore pas la perspective européenne : elle répond à une autre question, celle du parcours plutôt que de la fenêtre.",
 lien:["Wikipédia — Peinture chinoise","https://fr.wikipedia.org/wiki/Peinture_chinoise"]},

{niv:2,q:"Qu'est-ce qui distingue les soldats de l'armée de terre cuite de Xi'an ?",
 r:"Les visages sont individualisés, sur des corps produits en série",
 autres:["Chaque statue est entièrement unique","Toutes les statues sont identiques","Ce sont des moulages sur des soldats vivants"],
 exp:"Têtes, mains et torses viennent de moules combinables, puis les traits sont retravaillés un par un. Environ huit mille figures, enfouies vers 210 av. J.-C. : une industrie de la singularité, à l'échelle d'un empire.",
 lien:["Wikipédia — Armée de terre cuite","https://fr.wikipedia.org/wiki/Arm%C3%A9e_de_terre_cuite"]},

{niv:2,q:"Que signifie « ukiyo-e », le nom de l'estampe japonaise ?",
 r:"« Images du monde flottant »",
 autres:["« Gravures sur bois »","« Art des marchands »","« Peinture de l'eau »"],
 exp:"Le terme désigne les plaisirs éphémères de la ville d'Edo : théâtre, quartiers de divertissement, voyages. C'est un art de série, imprimé, bon marché, produit par une équipe — dessinateur, graveur, imprimeur, éditeur — et non par un auteur solitaire.",
 lien:["Wikipédia — Ukiyo-e","https://fr.wikipedia.org/wiki/Ukiyo-e"],
 img:"art/hiroshige_ara.webp"},

{niv:3,q:"Qu'est-ce que le japonisme, dans la peinture européenne des années 1870-1890 ?",
 r:"L'assimilation de la composition et des aplats de l'estampe japonaise",
 autres:["Un goût pour les sujets japonais chez les peintres académiques","Le voyage des impressionnistes au Japon","Une technique d'impression importée"],
 exp:"Cadrages décentrés, plans coupés par le bord, couleurs en aplat, renoncement au modelé : Degas, Manet, Van Gogh y puisent directement. Le canon européen s'est nourri d'ailleurs bien avant de le reconnaître.",
 lien:["Wikipédia — Japonisme","https://fr.wikipedia.org/wiki/Japonisme"],
 img:"art/pont_japonais.webp"},

{niv:3,q:"Que représente un bronze Chola figurant Shiva Nataraja, en Inde du Sud ?",
 r:"Shiva dansant dans un cercle de flammes, création et destruction ensemble",
 autres:["Shiva en méditation sur le mont Kailash","Un roi Chola divinisé","Une scène de bataille"],
 exp:"Chaque élément est codé : le tambour marque le rythme de la création, la flamme la destruction, le pied levé la délivrance. Ces bronzes des Xᵉ-XIIᵉ siècles sont coulés à la cire perdue et conçus pour être portés en procession, pas pour un socle de musée.",
 lien:["Wikipédia — Nataraja","https://fr.wikipedia.org/wiki/Nataraja"]},

{niv:3,q:"Pourquoi la calligraphie occupe-t-elle le premier rang dans les arts de l'Islam ?",
 r:"Parce qu'elle transcrit une parole tenue pour révélée",
 autres:["Parce que la peinture y est partout interdite","Parce qu'elle est plus facile à transporter","Parce qu'elle sert de signature aux souverains"],
 exp:"L'interdit de la figure ne vaut pas partout ni toujours : les manuscrits persans, moghols et ottomans regorgent de figures peintes. Il s'applique surtout au domaine religieux, et il a poussé l'écriture et la géométrie à un raffinement sans équivalent.",
 lien:["Wikipédia — Calligraphie arabe","https://fr.wikipedia.org/wiki/Calligraphie_arabe"]},

{niv:2,q:"Qu'est-ce qu'un muqarnas, dans l'architecture islamique ?",
 r:"Un décor en alvéoles qui assure le passage d'un plan carré à une coupole",
 autres:["Une fontaine de cour intérieure","Un type de carreau de faïence","Une porte monumentale"],
 exp:"C'est une solution structurelle devenue ornement : la transition géométrique se subdivise en cellules qui semblent des stalactites. L'Alhambra de Grenade en donne les exemples les plus vertigineux, au XIVᵉ siècle.",
 lien:["Wikipédia — Muqarnas","https://fr.wikipedia.org/wiki/Muqarnas"]},

{niv:3,q:"Que fait la miniature persane de la perspective ?",
 r:"Elle l'ignore délibérément, empilant les plans pour tout rendre visible",
 autres:["Elle l'applique rigoureusement dès le XIVᵉ siècle","Elle la découvre au contact des Portugais","Elle la remplace par un flou d'éloignement"],
 exp:"Les murs s'ouvrent, les toits basculent, le lointain monte au lieu de rétrécir. Le but n'est pas de simuler ce qu'un œil verrait d'un point donné, mais de donner accès à toute la scène. Behzad, à Hérat vers 1500, en est le maître reconnu.",
 lien:["Wikipédia — Miniature persane","https://fr.wikipedia.org/wiki/Miniature_persane"]},

{niv:2,q:"Que sont les têtes colossales olmèques, au Mexique ?",
 r:"Des portraits de dirigeants sculptés dans des blocs de basalte de plusieurs tonnes",
 autres:["Des représentations de divinités","Des bornes frontalières","Des couvercles de tombes"],
 exp:"Dix-sept sont connues, hautes jusqu'à trois mètres, taillées entre 1200 et 400 av. J.-C. Le basalte vient de carrières situées à des dizaines de kilomètres, sans roue ni animal de trait. Chaque visage est distinct.",
 lien:["Wikipédia — Têtes colossales olmèques","https://fr.wikipedia.org/wiki/T%C3%AAtes_colossales_olm%C3%A8ques"]},

{niv:3,q:"Pourquoi ne reste-t-il presque rien de l'art plumassier aztèque ?",
 r:"Les plumes se dégradent, et la conquête a détruit ou fondu le reste",
 autres:["Les Aztèques n'en produisaient que très peu","La technique n'a jamais été documentée","Tout est conservé à Mexico"],
 exp:"Les amanteca étaient des artisans de très haut rang. Il subsiste une poignée de pièces, dont une coiffe conservée à Vienne. Ce qui manque dans un musée n'est pas toujours ce qui n'a pas existé.",
 lien:["Wikipédia — Art plumaire mexicain","https://fr.wikipedia.org/wiki/Art_plumaire_mexicain"]},

{niv:2,q:"Qu'ont de particulier les vases-portraits de la culture Moche, au Pérou ?",
 r:"Ce sont des portraits individuels, reconnaissables d'un vase à l'autre",
 autres:["Ils représentent uniquement des divinités","Ils sont tous identiques","Ils portent une écriture déchiffrée"],
 exp:"Certains personnages sont suivis à plusieurs âges de leur vie. Cette pratique du portrait ressemblant, entre le IIᵉ et le VIIIᵉ siècle, est rare hors de la Méditerranée antique — et elle a été très longtemps qualifiée d'« artisanat ».",
 lien:["Wikipédia — Moche (culture)","https://fr.wikipedia.org/wiki/Moche_(culture)"]},

{niv:3,q:"Que dit-on de la tradition artistique des Aborigènes d'Australie ?",
 r:"Qu'elle est la plus longue tradition artistique continue connue",
 autres:["Qu'elle a commencé au XVIIIᵉ siècle","Qu'elle n'a produit que de la peinture sur écorce","Qu'elle est sans lien avec les récits d'origine"],
 exp:"Les plus anciennes peintures rupestres datées se comptent en dizaines de milliers d'années, et les motifs restent liés à des récits et à des territoires encore vivants. Le mouvement de peinture acrylique de Papunya, dans les années 1970, est la continuation d'une pratique, pas sa naissance.",
 lien:["Wikipédia — Art aborigène australien","https://fr.wikipedia.org/wiki/Art_aborig%C3%A8ne_australien"]},

{niv:3,q:"Que fait le terme « art primitif », longtemps employé dans les musées ?",
 r:"Il range des traditions savantes du côté de la spontanéité et de l'origine",
 autres:["Il désigne précisément l'art préhistorique","Il qualifie les œuvres inachevées","Il vient du vocabulaire des artistes eux-mêmes"],
 exp:"Le mot suppose un stade antérieur au nôtre, alors qu'il s'agit d'arts contemporains des cathédrales ou de la Renaissance, avec leurs écoles, leurs commandes et leurs maîtres. Les musées ont peu à peu abandonné le terme ; la difficulté qu'il masquait, elle, demande davantage que de le remplacer.",
 lien:["Wikipédia — Primitivisme","https://fr.wikipedia.org/wiki/Primitivisme"]}

];

/* ================================================================
   Bloc 12 : PHILO_MONDE — philosophie hors d'Europe.

   Pendant du pack ART_MONDE, et même méthode : on n'aligne pas des
   curiosités exotiques à côté du canon, on regarde comment le canon
   s'est constitué et qui en a été tenu dehors.

   Trois fils se répondent :

   1. Des textes qui posent, ailleurs et souvent plus tôt, des questions
      qu'on présente comme européennes. L'homme volant d'Avicenne précède
      le cogito de six siècles ; la critique de la causalité par al-Ghazali
      précède Hume de sept.

   2. L'exclusion explicite. Kant et Hegel n'ont pas oublié l'Afrique et
      l'Asie : ils les ont écartées par écrit, avec des arguments. La
      frontière du canon a été tracée, elle ne s'est pas trouvée là.

   3. Le même préjugé que dans le pack d'art. Frobenius attribuait les
      bronzes d'Ifé à l'Atlantide parce qu'ils lui paraissaient trop beaux
      pour être africains ; Conti Rossini a déclaré le Hatata éthiopien
      apocryphe en partie parce que de telles idées ne lui semblaient pas
      attendues en Éthiopie. Deux disciplines, un seul réflexe.

   Ce pack est classé en 'histoire' : il rapporte des positions et des
   débats, il ne tranche pas. Là où la recherche est divisée — le Hatata
   l'est encore en 2024 — les questions le disent.
   ================================================================ */

const PHILO_MONDE=[
{n:1,q:"Qu’est-ce que le Hatata, attribué à Zera Yacob ?",
 r:"Un traité philosophique éthiopien du XVIIᵉ siècle",
 autres:["Un recueil de prières copte","Une chronique dynastique","Un traité de médecine arabe"],
 exp:"Écrit en guèze et attribué à un penseur éthiopien de 1599-1692, il raconte une crise personnelle puis construit une critique de l’autorité religieuse fondée sur la seule raison.",
 lien:["Zera Yacob — Wikipédia","https://en.wikipedia.org/wiki/Zera_Yacob_(philosopher)"]},

{n:2,q:"On compare souvent Zera Yacob à quel philosophe européen, et pourquoi ?",
 r:"À Descartes, pour avoir fondé sa réflexion sur le doute méthodique",
 autres:["À Platon, pour sa théorie des Idées","À Aristote, pour sa classification du vivant","À Marx, pour sa critique de l’économie"],
 exp:"Les deux partent d’une mise en doute des autorités reçues pour ne garder que ce que la raison peut établir. La comparaison est éclairante, mais elle porte aussi un piège : elle fait de Descartes l’étalon.",
 lien:["Zera Yacob — Wikipédia","https://en.wikipedia.org/wiki/Zera_Yacob_(philosopher)"]},

{n:3,q:"Le Hatata fait l’objet d’une controverse depuis 1920. Laquelle ?",
 r:"Un orientaliste a soutenu qu’il avait été fabriqué par le moine qui l’avait fait connaître",
 autres:["On ignore dans quelle langue il a été écrit","Le manuscrit a été détruit","Deux traductions se contredisent entièrement"],
 exp:"Carlo Conti Rossini attribue le texte à Giusto da Urbino, capucin italien qui envoya les manuscrits en France vers 1852. La question n’est pas tranchée : un volume collectif de 2024 lui est entièrement consacré.",
 lien:["In Search of Zera Yacob — Centre for Intellectual History, Oxford","https://intellectualhistory.web.ox.ac.uk/article/in-search-of-zera-yacob-philosophy-in-early-modern-ethiopia"]},

{n:4,q:"Quel argument, chez Conti Rossini, ressemble à celui de Frobenius sur les bronzes d’Ifé ?",
 r:"Que de telles idées n’étaient pas à attendre en Éthiopie",
 autres:["Que le manuscrit était trop récent","Que la langue était mal orthographiée","Que l’auteur était inconnu par ailleurs"],
 exp:"Sa démonstration mêlait une vraie rigueur philologique et une supposition culturelle. Frobenius attribuait Ifé à l’Atlantide pour la même raison de fond : l’œuvre lui semblait trop accomplie pour son lieu.",
 lien:["In Search of Zera Yacob — Centre for Intellectual History, Oxford","https://intellectualhistory.web.ox.ac.uk/article/in-search-of-zera-yacob-philosophy-in-early-modern-ethiopia"]},

{n:5,q:"Sur quoi Claude Sumner s’est-il appuyé pour défendre l’authenticité du Hatata ?",
 r:"Une analyse statistique du style et la comparaison avec les autres écrits d’Urbino",
 autres:["Un témoignage oral recueilli en Éthiopie","La datation au carbone 14 du parchemin","Un second manuscrit retrouvé au Caire"],
 exp:"Il montre que les idées du Hatata s’écartent de la théologie connue d’Urbino et dépassent sa maîtrise du guèze. Il rattache aussi le texte à la tradition du qéné, école éthiopienne qui valorise la contestation intellectuelle.",
 lien:["A Forgotten Enlightenment — sur Zera Yacob et Claude Sumner","https://whenithinktoomuch.substack.com/p/a-forgotten-enlightenment-zera-yacob"]},

{n:6,q:"Comment se répartissent aujourd’hui les positions sur cette authenticité ?",
 r:"Des chercheurs éthiopiens et occidentaux se trouvent des deux côtés",
 autres:["Les Éthiopiens y croient, les Occidentaux non","La question est réglée depuis 1976","Plus personne ne travaille dessus"],
 exp:"Daniel Kibret et Fasil Merawi contestent l’attribution, Alemayehu Moges et Amsalu Aklilu la défendent. Le désaccord ne suit pas la ligne qu’on imagine : c’est une controverse savante, pas un affrontement d’appartenances.",
 lien:["Conférence In Search of Zera Yacob — actes","https://zerayacobconference.weebly.com/conference-materials.html"]},

{n:7,q:"Qui sont les tlamatinime, dans le monde nahua ?",
 r:"Les « connaisseurs des choses », lettrés du Mexique préhispanique",
 autres:["Les prêtres chargés des sacrifices","Les gouverneurs de province","Les scribes du tribut"],
 exp:"Le terme désigne ceux qui enseignent, interrogent et composent. Miguel León-Portilla a montré à partir des sources en nahuatl qu’on y traite de la vérité, de la mort et de la valeur de l’existence.",
 lien:["Tlamatini — Wikipédia","https://en.wikipedia.org/wiki/Tlamatini"]},

{n:8,q:"Que désigne l’expression nahua « in xochitl in cuicatl », la fleur et le chant ?",
 r:"La poésie, tenue pour le seul moyen de dire quelque chose de vrai",
 autres:["Un rite funéraire","Le calendrier agricole","Un impôt en nature"],
 exp:"Les poèmes nahuas posent que la terre n’est peut-être pas « vraie », qu’on n’y vient que de passage. La fleur et le chant sont ce qui reste quand on doute que le reste tienne.",
 lien:["Philosophie aztèque — Wikipédia","https://en.wikipedia.org/wiki/Aztec_philosophy"]},

{n:9,q:"Qu’est-ce que l’asabiyya, chez Ibn Khaldoun ?",
 r:"La cohésion d’un groupe, moteur de la montée puis de la chute des dynasties",
 autres:["Un impôt foncier","Une école de droit","Un genre littéraire"],
 exp:"Dans la Muqaddima (1377), il en tire un modèle cyclique : un groupe soudé conquiert, s’installe, s’amollit, et se fait renverser par un groupe plus soudé. On y voit souvent une des premières sociologies historiques.",
 lien:["Ibn Khaldoun — Wikipédia","https://fr.wikipedia.org/wiki/Ibn_Khaldoun"]},

{n:10,q:"Qu’est-ce que « l’homme volant » d’Avicenne ?",
 r:"Une expérience de pensée : un homme privé de toute sensation saurait encore qu’il existe",
 autres:["Un traité d’astronomie","Une méthode de calcul","Un poème mystique"],
 exp:"Suspendu dans le vide, sans contact ni vue ni ouïe, il ne percevrait rien — et pourtant il affirmerait son existence. L’argument est du XIᵉ siècle : il précède le cogito de Descartes d’environ six cents ans.",
 lien:["Avicenne — Wikipédia","https://fr.wikipedia.org/wiki/Avicenne"]},

{n:11,q:"Qu’a soutenu al-Ghazali sur le rapport entre le feu et le coton qui brûle ?",
 r:"Que nous observons une succession constante, jamais une nécessité",
 autres:["Que le feu ne brûle pas réellement","Que la combustion est une illusion des sens","Que seul le prophète peut l’expliquer"],
 exp:"Rien dans l’expérience ne montre que le feu DOIT brûler : on voit l’un puis l’autre, et l’on suppose le lien. David Hume formulera la même critique de la causalité vers 1740, quelque six cent cinquante ans plus tard.",
 lien:["Al-Ghazali — Wikipedia","https://en.wikipedia.org/wiki/Al-Ghazali"]},

{n:12,q:"Par quel chemin l’Europe latine a-t-elle retrouvé l’essentiel d’Aristote ?",
 r:"Par des traductions arabes, retraduites en latin à partir du XIIᵉ siècle",
 autres:["Par des copies conservées à Rome","Par la découverte de papyrus en Égypte","Il n’a jamais été perdu"],
 exp:"Grec, puis syriaque, puis arabe, puis latin — souvent à Tolède. Les commentaires d’Ibn Rushd ont tellement compté que la scolastique le désignait simplement comme « le Commentateur ».",
 lien:["École de traducteurs de Tolède — Wikipédia","https://fr.wikipedia.org/wiki/%C3%89cole_de_traducteurs_de_Tol%C3%A8de"]},

{n:13,q:"Qu’est-ce que le tétralemme, ou catuskoti, employé par Nagarjuna ?",
 r:"Un schéma à quatre branches : ni vrai, ni faux, ni les deux, ni aucun des deux",
 autres:["Une méthode de méditation en quatre étapes","Un recueil de quatre sutras","Une règle monastique"],
 exp:"Là où la logique grecque pose qu’une proposition est vraie ou fausse, Nagarjuna, au IIᵉ siècle, examine quatre positions pour les écarter toutes. Ce n’est pas une logique confuse : c’est une autre logique.",
 lien:["Nagarjuna — Wikipedia","https://en.wikipedia.org/wiki/Nagarjuna"]},

{n:14,q:"Le Cārvāka, école matérialiste et athée de l’Inde ancienne, nous est connu comment ?",
 r:"Presque uniquement par les citations de ses adversaires",
 autres:["Par ses traités complets conservés","Par des inscriptions royales","Par des récits de voyageurs chinois"],
 exp:"Ses textes propres ont disparu : on le lit à travers ceux qui le réfutent. C’est le même problème qu’un fossile connu par un seul spécimen — on ignore ce que l’on ne voit pas, et l’on ne sait pas si le portrait est fidèle.",
 lien:["Charvaka — Wikipedia","https://en.wikipedia.org/wiki/Charvaka"]},

{n:15,q:"Sur quoi portait le désaccord entre Mencius et Xunzi ?",
 r:"Sur la question de savoir si la nature humaine est bonne ou mauvaise au départ",
 autres:["Sur la date de naissance de Confucius","Sur l’existence du ciel","Sur la légitimité de la guerre"],
 exp:"Mencius soutient que la bonté est innée et demande à être cultivée ; Xunzi, qu’elle est acquise par l’éducation et le rite contre un fond d’appétit. Deux confucéens, deux anthropologies opposées.",
 lien:["Xunzi — Wikipedia","https://en.wikipedia.org/wiki/Xunzi"]},

{n:16,q:"Que met en cause le rêve du papillon, chez Zhuangzi ?",
 r:"La possibilité de distinguer avec certitude la veille du rêve",
 autres:["L’existence des animaux","La valeur du travail","L’autorité de l’empereur"],
 exp:"Il rêve qu’il est un papillon, puis se réveille — et ne sait plus s’il est un homme ayant rêvé d’un papillon, ou un papillon rêvant qu’il est un homme. Le doute sur le rêve figure ici quelque dix-neuf siècles avant les Méditations.",
 lien:["Zhuangzi — Wikipedia","https://en.wikipedia.org/wiki/Zhuangzi"]},

{n:17,q:"Qu’est-ce que Kant et Hegel ont écrit à propos de la philosophie africaine ?",
 r:"Ils l’ont explicitement exclue, par des arguments écrits",
 autres:["Ils n’en ont jamais entendu parler","Ils l’ont étudiée avec intérêt","Ils l’ont jugée équivalente à la grecque"],
 exp:"Hegel écarte l’Afrique de l’histoire universelle dans ses leçons ; Kant tient des propos explicites sur la hiérarchie des peuples. La frontière du canon a été tracée, avec des raisons énoncées — elle ne s’est pas trouvée là par hasard.",
 lien:["African philosophy — Wikipedia","https://en.wikipedia.org/wiki/African_philosophy"]},

{n:18,q:"Qu’a reproché Paulin Hountondji au livre « La philosophie bantoue » de Placide Tempels ?",
 r:"De prêter à un peuple entier une vision du monde unique, sans auteurs ni débats",
 autres:["D’avoir été écrit en français","De trop citer Aristote","D’être trop court"],
 exp:"Tempels, missionnaire belge, publie en 1945 un ouvrage bienveillant sur une « philosophie bantoue ». Hountondji objecte que la philosophie suppose des penseurs identifiables qui se contredisent — sinon on décrit une culture, pas une pensée.",
 lien:["Paulin Hountondji — Wikipedia","https://en.wikipedia.org/wiki/Paulin_Hountondji"]},

{n:19,q:"Que dit la formule associée à l’ubuntu, « une personne est une personne par les autres personnes » ?",
 r:"Que l’identité individuelle se constitue dans la relation, non avant elle",
 autres:["Que l’individu n’a aucune valeur","Que la solitude est interdite","Qu’il faut obéir aux anciens"],
 exp:"C’est une thèse sur la personne, pas une règle de politesse : elle inverse l’ordre habituel qui place un sujet déjà constitué avant ses liens. La formule a été popularisée par John Mbiti et par Desmond Tutu.",
 lien:["Ubuntu philosophy — Wikipedia","https://en.wikipedia.org/wiki/Ubuntu_philosophy"]},

{n:20,q:"Quel problème pose la catégorie même de « philosophie non européenne » ?",
 r:"Elle définit des traditions très diverses par ce qu’elles ne sont pas",
 autres:["Elle est trop récente","Elle mélange science et religion","Elle exclut la Grèce"],
 exp:"Elle range dans un même tiroir Nagarjuna, Ibn Khaldoun et les tlamatinime, qui n’ont en commun que de ne pas être grecs. Utile pour signaler un manque, la catégorie reproduit le centre qu’elle voudrait déplacer.",
 lien:["Comparative philosophy — Wikipedia","https://en.wikipedia.org/wiki/Comparative_philosophy"]}
];

/* ================================================================
   Bloc 16 : trois packs d'accompagnement scolaire.

   Objectif déclaré : pouvoir suivre un élève de secondaire inférieur
   (12-15 ans) sans être larguée. Ce n'est pas le même objectif que
   les packs d'histoire de l'art ou de philosophie, qui relèvent de
   l'intérêt personnel et se situent délibérément plus haut.

   CALIBRAGE. Ces soixante questions portent sur ce qu'un élève de
   première à troisième secondaire rencontre réellement : notions de
   lecture, repères géographiques et cartographiques, repères
   historiques et critique de source. Elles ne sont pas plus faciles
   que le programme — elles sont AU programme. Une adulte attentive y
   répond ; c'est exactement le niveau visé.

   CE QUI EST GARDÉ DE L'ESPRIT DE L'APPLICATION. On ne fait pas
   semblant qu'une convention soit un fait. La périodisation de
   l'histoire est décidée, pas trouvée ; la projection de Mercator
   déforme les surfaces ; « Moyen Âge » porte un jugement de valeur.
   Ces questions-là sont dans le pack parce qu'elles sont au
   programme, et parce qu'elles sont les plus utiles à connaître pour
   aider quelqu'un à réfléchir plutôt qu'à réciter.
   ================================================================ */

const FR_LECTURE=[
{n:1,q:"Un texte qui raconte une suite d’événements dans le temps est un texte…",
 r:"narratif", autres:["descriptif","argumentatif","injonctif"],
 exp:"Narratif : il raconte. Descriptif : il montre. Argumentatif : il défend une thèse. Injonctif : il donne des consignes. Un même texte peut mêler plusieurs types ; on identifie celui qui domine.",
 lien:["Typologie textuelle — Wikipédia","https://fr.wikipedia.org/wiki/Typologie_textuelle"]},

{n:2,q:"Dans le schéma narratif, qu’est-ce que l’élément déclencheur ?",
 r:"Ce qui rompt l’équilibre de la situation initiale",
 autres:["La fin de l’histoire","Le portrait du héros","Le lieu où se déroule l’action"],
 exp:"Situation initiale, élément déclencheur, péripéties, dénouement, situation finale. Sans rupture d’équilibre, il n’y a pas de récit : seulement une description.",
 lien:["Schéma narratif — Wikipédia","https://fr.wikipedia.org/wiki/Sch%C3%A9ma_narratif"]},

{n:3,q:"Un narrateur qui dit « je » et participe à l’histoire est un narrateur…",
 r:"interne", autres:["externe","omniscient","absent"],
 exp:"Le narrateur interne ne sait que ce que sait son personnage. C’est une contrainte, et souvent l’intérêt du texte : ce qu’il ignore, le lecteur l’ignore aussi.",
 lien:["Narrateur — Wikipédia","https://fr.wikipedia.org/wiki/Narrateur"]},

{n:4,q:"« La Belgique compte environ onze millions et demi d’habitants. » Est-ce un fait ou une opinion ?",
 r:"Un fait : c’est vérifiable",
 autres:["Une opinion : c’est un point de vue","Ni l’un ni l’autre","Une opinion déguisée en fait"],
 exp:"Un fait peut être vrai ou faux, mais il se vérifie. Une opinion s’argumente et se discute. Le critère n’est pas la certitude, c’est la vérifiabilité.",
 lien:["Fait — Wikipédia","https://fr.wikipedia.org/wiki/Fait"]},

{n:5,q:"Dans un texte argumentatif, qu’est-ce que la thèse ?",
 r:"L’idée principale que l’auteur veut faire admettre",
 autres:["Le premier paragraphe","Le titre du texte","L’avis du lecteur"],
 exp:"Elle n’est pas toujours écrite noir sur blanc. La repérer, c’est se demander : de quoi ce texte veut-il me convaincre ? Le reste s’organise autour de cette réponse.",
 lien:["Argumentation — Wikipédia","https://fr.wikipedia.org/wiki/Argumentation"]},

{n:6,q:"Quelle est la différence entre un argument et un exemple ?",
 r:"L’argument est une raison, l’exemple est un cas qui l’illustre",
 autres:["Il n’y en a aucune","L’argument est plus long","L’exemple vient toujours en premier"],
 exp:"« Le vélo est bon pour la ville parce qu’il ne pollue pas » est un argument. « À Copenhague, la moitié des trajets se font à vélo » est un exemple. Un exemple seul ne démontre rien.",
 lien:["Argumentation — Wikipédia","https://fr.wikipedia.org/wiki/Argumentation"]},

{n:7,q:"Quel connecteur exprime la CAUSE ?",
 r:"parce que", autres:["donc","cependant","ensuite"],
 exp:"Cause : parce que, car, puisque, grâce à, à cause de. Conséquence : donc, par conséquent, si bien que. Confondre les deux inverse le raisonnement — c’est la faute de lecture la plus coûteuse.",
 lien:["Connecteur logique — Wikipédia","https://fr.wikipedia.org/wiki/Connecteur_logique"]},

{n:8,q:"Que marque le connecteur « bien que » ?",
 r:"La concession : on admet un point avant de maintenir le sien",
 autres:["La cause","La conséquence","L’addition"],
 exp:"« Bien qu’il pleuve, je sors. » On reconnaît l’objection sans y céder. C’est le signe d’un texte argumentatif construit : il anticipe ce qu’on pourrait lui opposer.",
 lien:["Connecteur logique — Wikipédia","https://fr.wikipedia.org/wiki/Connecteur_logique"]},

{n:9,q:"Qu’est-ce qu’un champ lexical ?",
 r:"L’ensemble des mots d’un texte se rapportant à un même thème",
 autres:["La liste des mots difficiles","Les mots d’une même famille grammaticale","Le vocabulaire d’un métier"],
 exp:"Voile, mât, houle, cap, équipage : champ lexical de la navigation. Le repérer révèle souvent l’atmosphère d’un texte avant même qu’on l’ait analysée.",
 lien:["Champ lexical — Wikipédia","https://fr.wikipedia.org/wiki/Champ_lexical"]},

{n:10,q:"« Cet homme est un lion. » De quelle figure s’agit-il ?",
 r:"D’une métaphore", autres:["D’une comparaison","D’une hyperbole","D’une litote"],
 exp:"La comparaison garde l’outil : « comme un lion », « tel un lion ». La métaphore le supprime et pose l’identité. C’est le seul critère, et il est mécanique : cherche le mot de comparaison.",
 lien:["Métaphore — Wikipédia","https://fr.wikipedia.org/wiki/M%C3%A9taphore"]},

{n:11,q:"« Le vent hurlait dans les arbres. » De quelle figure s’agit-il ?",
 r:"D’une personnification", autres:["D’une métonymie","D’un oxymore","D’une antithèse"],
 exp:"On prête à une chose un comportement d’être vivant. Très fréquente dans les descriptions de paysage, où elle sert à installer une menace sans la nommer.",
 lien:["Personnification — Wikipédia","https://fr.wikipedia.org/wiki/Personnification"]},

{n:12,q:"Comment reconnaît-on l’ironie dans un texte écrit ?",
 r:"Par le décalage entre ce qui est dit et ce que le contexte impose",
 autres:["Par les points d’exclamation","Par les guillemets uniquement","Elle est impossible à reconnaître à l’écrit"],
 exp:"« Quelle merveilleuse idée » après un désastre. C’est l’une des difficultés les plus réelles pour un élève : le mot à mot le trahit, et il faut lire ce qui entoure la phrase.",
 lien:["Ironie — Wikipédia","https://fr.wikipedia.org/wiki/Ironie"]},

{n:13,q:"« Ce type est vachement sympa » relève de quel registre ?",
 r:"Du registre familier", autres:["Du registre courant","Du registre soutenu","Du registre littéraire"],
 exp:"Familier, courant, soutenu. Aucun n’est meilleur : ils sont adaptés ou non à la situation. Ce qu’on demande à un élève, c’est de savoir en changer, pas d’en bannir un.",
 lien:["Registre de langue — Wikipédia","https://fr.wikipedia.org/wiki/Registre_de_langue"]},

{n:14,q:"Transposons « Il dit : “Je viendrai demain.” » au discours indirect. Que devient « demain » ?",
 r:"le lendemain", autres:["demain","hier","aujourd’hui"],
 exp:"Le passage au discours indirect déplace les repères de temps, de lieu et de personne : « je » devient « il », « demain » devient « le lendemain », « ici » devient « là ». C’est mécanique et c’est ce qu’on évalue.",
 lien:["Discours rapporté — Wikipédia","https://fr.wikipedia.org/wiki/Discours_rapport%C3%A9"]},

{n:15,q:"« Tu as encore oublié tes clés. » Que présuppose cette phrase ?",
 r:"Que la personne les a déjà oubliées auparavant",
 autres:["Qu’elle a perdu ses clés","Qu’elle est en retard","Rien du tout"],
 exp:"Le mot « encore » fait passer une information sans la dire. Le présupposé résiste même à la négation : « tu n’as pas encore oublié tes clés » suppose toujours un précédent.",
 lien:["Présupposé — Wikipédia","https://fr.wikipedia.org/wiki/Pr%C3%A9suppos%C3%A9"]},

{n:16,q:"Que doit-on garder en priorité dans un résumé ?",
 r:"Le fil de l’argumentation ou de l’action",
 autres:["Les phrases les plus belles","Les exemples","Les chiffres cités"],
 exp:"Un résumé n’est pas un florilège de phrases recopiées. On garde ce qui fait avancer, on supprime ce qui illustre — et l’on reformule, sinon ce n’est pas un résumé mais un montage.",
 lien:["Résumé — Wikipédia","https://fr.wikipedia.org/wiki/R%C3%A9sum%C3%A9"]},

{n:17,q:"Qu’appelle-t-on le paratexte ?",
 r:"Tout ce qui entoure le texte : titre, sous-titre, source, date, images",
 autres:["Le texte lui-même","Les notes de bas de page uniquement","Le brouillon de l’auteur"],
 exp:"Lire le paratexte avant le texte fait gagner du temps et évite des contresens : qui écrit, quand, où cela paraît-il, à qui cela s’adresse-t-il.",
 lien:["Paratexte — Wikipédia","https://fr.wikipedia.org/wiki/Paratexte"]},

{n:18,q:"Un narrateur qui connaît les pensées de tous les personnages est dit…",
 r:"omniscient", autres:["interne","externe","neutre"],
 exp:"Externe : il ne rapporte que ce qui se voit, comme une caméra. Omniscient : il entre dans toutes les têtes. Le choix du point de vue n’est jamais neutre — il décide de ce que le lecteur a le droit de savoir.",
 lien:["Focalisation — Wikipédia","https://fr.wikipedia.org/wiki/Focalisation_(narratologie)"]},

{n:19,q:"Dans un texte informatif, à quoi sert de repérer la source d’un chiffre ?",
 r:"À savoir qui l’a produit et s’il est vérifiable",
 autres:["À allonger le texte","À montrer que l’auteur a lu","Cela ne sert à rien en secondaire"],
 exp:"« Une étude montre que… » sans nom d’étude n’est pas une source. Exiger la source est la compétence la plus transférable de tout le programme de français.",
 lien:["Esprit critique — Wikipédia","https://fr.wikipedia.org/wiki/Esprit_critique"]},

{n:20,q:"Un article qui vante longuement un produit sans le présenter comme une publicité, c’est…",
 r:"un texte argumentatif déguisé en texte informatif",
 autres:["un texte narratif","un texte descriptif neutre","une erreur d’impression"],
 exp:"L’enjeu n’est pas de deviner l’intention mais de repérer les marques : vocabulaire valorisant, absence de contre-arguments, source unique. On juge le texte, pas l’auteur.",
 lien:["Publicité rédactionnelle — Wikipédia","https://fr.wikipedia.org/wiki/Publireportage"]}
];

const GEOGRAPHIE=[
{n:1,q:"Que mesure la latitude ?",
 r:"La distance angulaire au nord ou au sud de l’équateur",
 autres:["La distance à Greenwich","L’altitude","La distance au pôle Nord seulement"],
 exp:"De 0° à l’équateur à 90° aux pôles. La longitude, elle, se compte à l’est ou à l’ouest du méridien de Greenwich. Latitude d’abord, longitude ensuite : c’est la convention d’écriture.",
 lien:["Latitude — Wikipédia","https://fr.wikipedia.org/wiki/Latitude"]},

{n:2,q:"Sur une carte au 1:50 000, un centimètre représente…",
 r:"500 mètres", autres:["50 mètres","5 kilomètres","50 kilomètres"],
 exp:"50 000 cm = 500 m. Plus le dénominateur est grand, plus l’échelle est PETITE et moins la carte est détaillée : une carte au 1:1 000 000 montre un pays, une carte au 1:10 000 montre un quartier.",
 lien:["Échelle cartographique — Wikipédia","https://fr.wikipedia.org/wiki/%C3%89chelle_(cartographie)"]},

{n:3,q:"Que représentent les courbes de niveau sur une carte topographique ?",
 r:"Des lignes joignant les points de même altitude",
 autres:["Les frontières administratives","Les cours d’eau souterrains","Les routes principales"],
 exp:"Des courbes serrées signalent une pente raide, des courbes espacées un terrain plat. C’est le seul moyen de lire le relief sur une carte plane, et cela s’apprend en quelques minutes.",
 lien:["Courbe de niveau — Wikipédia","https://fr.wikipedia.org/wiki/Courbe_de_niveau"]},

{n:4,q:"Que déforme la projection de Mercator, utilisée par la plupart des cartes en ligne ?",
 r:"Les surfaces, d’autant plus qu’on s’éloigne de l’équateur",
 autres:["Les angles","Les distances est-ouest uniquement","Rien : elle est exacte"],
 exp:"Elle conserve les angles, ce qui servait à la navigation, mais gonfle les hautes latitudes : le Groenland y paraît aussi grand que l’Afrique alors qu’il est quatorze fois plus petit. Aucune carte plane ne peut tout conserver.",
 lien:["Projection de Mercator — Wikipédia","https://fr.wikipedia.org/wiki/Projection_de_Mercator"]},

{n:5,q:"Combien la Belgique compte-t-elle de Régions ?",
 r:"Trois", autres:["Deux","Quatre","Dix"],
 exp:"Région flamande, Région wallonne, Région de Bruxelles-Capitale. À ne pas confondre avec les trois Communautés (française, flamande, germanophone) ni avec les dix provinces : trois découpages différents qui ne se superposent pas.",
 lien:["Régions de Belgique — Wikipédia","https://fr.wikipedia.org/wiki/R%C3%A9gions_de_Belgique"]},

{n:6,q:"Quel est le point culminant de la Belgique ?",
 r:"Le Signal de Botrange, 694 m",
 autres:["La Baraque de Fraiture, 652 m","Le Mont Saint-Aubert, 149 m","Le Kemmelberg, 156 m"],
 exp:"Dans les Hautes Fagnes, en Ardenne. Le relief belge monte du nord-ouest au sud-est : polders, plaine, plateaux du Brabant et de Hesbaye, Condroz, puis Ardenne.",
 lien:["Signal de Botrange — Wikipédia","https://fr.wikipedia.org/wiki/Signal_de_Botrange"]},

{n:7,q:"Quels sont les deux principaux fleuves de Belgique ?",
 r:"La Meuse et l’Escaut", autres:["La Meuse et la Sambre","L’Escaut et la Lys","Le Rhin et la Meuse"],
 exp:"La Sambre et la Lys sont des affluents, pas des fleuves : un fleuve se jette dans la mer. La Meuse traverse Liège, l’Escaut passe à Anvers.",
 lien:["Meuse — Wikipédia","https://fr.wikipedia.org/wiki/Meuse_(fleuve)"]},

{n:8,q:"Qu’est-ce qu’un bassin versant ?",
 r:"Le territoire dont toutes les eaux s’écoulent vers un même cours d’eau",
 autres:["Le lit d’une rivière en crue","Un lac artificiel","La zone inondable d’une ville"],
 exp:"Ses limites sont les lignes de crête. C’est la bonne unité pour penser une inondation ou une pollution : ce qui tombe en amont finit en aval, quelles que soient les frontières administratives.",
 lien:["Bassin versant — Wikipédia","https://fr.wikipedia.org/wiki/Bassin_versant"]},

{n:9,q:"Quelle est la différence entre un delta et un estuaire ?",
 r:"Le delta ramifie le fleuve en bras, l’estuaire l’ouvre en un large chenal",
 autres:["Le delta est en mer, l’estuaire en rivière","L’estuaire est toujours plus grand","Ce sont deux mots pour la même chose"],
 exp:"Le delta se forme quand le fleuve dépose plus que la mer n’emporte ; l’estuaire quand les marées l’emportent. Le Nil a un delta, l’Escaut un estuaire.",
 lien:["Delta — Wikipédia","https://fr.wikipedia.org/wiki/Delta_(hydrologie)"]},

{n:10,q:"Quels sont les principaux facteurs qui déterminent le climat d’un lieu ?",
 r:"La latitude, l’altitude, la distance à la mer et les courants marins",
 autres:["La latitude uniquement","La densité de population","La nature du sol"],
 exp:"C’est pourquoi Bruxelles et Québec, presque à la même latitude, n’ont pas du tout le même hiver : la dérive nord-atlantique réchauffe l’Europe de l’Ouest.",
 lien:["Climat — Wikipédia","https://fr.wikipedia.org/wiki/Climat"]},

{n:11,q:"Comment appelle-t-on le climat de la Belgique ?",
 r:"Tempéré océanique", autres:["Tempéré continental","Méditerranéen","Subarctique"],
 exp:"Hivers doux, étés frais, précipitations réparties toute l’année, faible amplitude thermique. La mer amortit les écarts : plus on va vers l’est, plus le climat devient continental.",
 lien:["Climat océanique — Wikipédia","https://fr.wikipedia.org/wiki/Climat_oc%C3%A9anique"]},

{n:12,q:"Que montre un diagramme ombrothermique ?",
 r:"Les températures et les précipitations mois par mois",
 autres:["L’altitude d’un relief","La densité de population","Les vents dominants"],
 exp:"Courbe pour les températures, barres pour les précipitations. L’exercice classique consiste à en déduire le type de climat : c’est de la lecture de graphique autant que de la géographie.",
 lien:["Diagramme ombrothermique — Wikipédia","https://fr.wikipedia.org/wiki/Diagramme_ombrothermique"]},

{n:13,q:"Comment calcule-t-on la densité de population ?",
 r:"En divisant le nombre d’habitants par la superficie",
 autres:["En divisant la superficie par le nombre d’habitants","En comptant les habitants d’une ville","En additionnant les naissances"],
 exp:"Elle s’exprime en habitants par kilomètre carré. C’est une moyenne, donc elle masque les écarts : la densité moyenne d’un pays ne dit rien de ses déserts ni de ses métropoles.",
 lien:["Densité de population — Wikipédia","https://fr.wikipedia.org/wiki/Densit%C3%A9_de_population"]},

{n:14,q:"Combien la Terre compte-t-elle d’océans, selon le découpage le plus courant aujourd’hui ?",
 r:"Cinq", autres:["Trois","Quatre","Sept"],
 exp:"Pacifique, Atlantique, Indien, Arctique et Austral. Le nombre a varié : l’océan Austral n’est reconnu comme tel que depuis 2000, et il ne l’est pas partout. Un découpage est une décision, pas une observation.",
 lien:["Océan — Wikipédia","https://fr.wikipedia.org/wiki/Oc%C3%A9an"]},

{n:15,q:"Qu’est-ce que la tectonique des plaques explique ?",
 r:"Les séismes, les volcans et la formation des montagnes",
 autres:["Les marées","Les saisons","Les courants marins"],
 exp:"La lithosphère est découpée en plaques mobiles. Là où elles s’écartent, la croûte se crée ; là où elles se rencontrent, elle plonge ou se plisse. C’est aussi ce qui a séparé les continents que tu explores dans l’atlas.",
 lien:["Tectonique des plaques — Wikipédia","https://fr.wikipedia.org/wiki/Tectonique_des_plaques"]},

{n:16,q:"Que marquent les tropiques du Cancer et du Capricorne ?",
 r:"Les latitudes extrêmes où le Soleil peut passer à la verticale",
 autres:["Les limites des zones habitées","L’équateur magnétique","Les limites des océans chauds"],
 exp:"À 23,4° nord et sud, ce qui correspond à l’inclinaison de l’axe terrestre. C’est la même inclinaison qui produit les saisons — et les cercles polaires, à 66,6°.",
 lien:["Tropique — Wikipédia","https://fr.wikipedia.org/wiki/Tropique"]},

{n:17,q:"Pourquoi existe-t-il des fuseaux horaires ?",
 r:"Parce que la Terre tourne : il n’est pas midi partout en même temps",
 autres:["Pour faciliter le commerce","À cause des saisons","Pour séparer les pays"],
 exp:"Vingt-quatre fuseaux d’environ quinze degrés. Mais leurs limites suivent souvent les frontières plutôt que les méridiens : la géographie physique propose, la politique dispose.",
 lien:["Fuseau horaire — Wikipédia","https://fr.wikipedia.org/wiki/Fuseau_horaire"]},

{n:18,q:"Qu’appelle-t-on l’exode rural ?",
 r:"Le départ des habitants des campagnes vers les villes",
 autres:["Le retour des citadins à la campagne","L’émigration vers l’étranger","La désertification des sols"],
 exp:"Massif en Europe au XIXᵉ siècle avec l’industrialisation, il se poursuit aujourd’hui ailleurs. Plus de la moitié de l’humanité vit en ville depuis la fin des années 2000.",
 lien:["Exode rural — Wikipédia","https://fr.wikipedia.org/wiki/Exode_rural"]},

{n:19,q:"À quoi sert la légende d’une carte ?",
 r:"À donner le sens des couleurs, symboles et figurés employés",
 autres:["À indiquer l’auteur","À donner l’échelle uniquement","À signaler les erreurs"],
 exp:"Une carte sans légende n’est pas lisible, seulement décorative. Premier réflexe devant une carte inconnue : légende, échelle, orientation, date. Dans cet ordre.",
 lien:["Carte géographique — Wikipédia","https://fr.wikipedia.org/wiki/Carte_g%C3%A9ographique"]},

{n:20,q:"Deux cartes du même territoire donnent des impressions très différentes. Pourquoi ?",
 r:"Le choix de la projection, des couleurs et du découpage oriente la lecture",
 autres:["L’une des deux est forcément fausse","Cela vient de l’imprimeur","Les cartes ne varient jamais"],
 exp:"Centrer une carte sur l’Europe ou sur le Pacifique, colorer un écart en rouge ou en dégradé : chaque choix est un argument. Une carte est un discours, et cela s’enseigne dès le secondaire.",
 lien:["Sémiologie graphique — Wikipédia","https://fr.wikipedia.org/wiki/S%C3%A9miologie_graphique"]}
];

const HIST_SCOLAIRE=[
{n:1,q:"Quelles sont les cinq grandes périodes de l’histoire, dans la découpe scolaire habituelle ?",
 r:"Préhistoire, Antiquité, Moyen Âge, Temps modernes, Époque contemporaine",
 autres:["Antiquité, Moyen Âge, Renaissance, Révolution, Modernité","Préhistoire, Antiquité, Modernité","Ancien, Médiéval, Moderne"],
 exp:"C’est une convention européenne, commode et discutée. Elle décrit mal l’histoire de la Chine ou de l’Afrique, où ces ruptures n’ont pas de sens.",
 lien:["Périodisation — Wikipédia","https://fr.wikipedia.org/wiki/P%C3%A9riodisation"]},

{n:2,q:"Pourquoi fait-on souvent commencer le Moyen Âge en 476 ?",
 r:"C’est la déposition du dernier empereur romain d’Occident, choisie comme repère",
 autres:["C’est la naissance de Charlemagne","C’est la chute de Rome, détruite cette année-là","C’est la date du premier roi de France"],
 exp:"Rome n’a pas été détruite et rien n’a changé pour ses habitants ce jour-là. La date est un repère commode fixé longtemps après coup : les bornes des périodes sont décidées, pas trouvées.",
 lien:["Chute de l’Empire romain d’Occident — Wikipédia","https://fr.wikipedia.org/wiki/Chute_de_l%27Empire_romain_d%27Occident"]},

{n:3,q:"Qu’est-ce qu’une source primaire ?",
 r:"Un document produit à l’époque étudiée",
 autres:["Le livre d’un historien reconnu","Un manuel scolaire","Une encyclopédie"],
 exp:"Lettre, registre, outil, tableau, photographie. La source secondaire, elle, commente les primaires. Un historien travaille sur les premières et dialogue avec les secondes.",
 lien:["Source primaire — Wikipédia","https://fr.wikipedia.org/wiki/Source_primaire"]},

{n:4,q:"En quoi consiste la critique d’une source historique ?",
 r:"À se demander qui l’a produite, quand, pour qui et pourquoi",
 autres:["À vérifier son orthographe","À juger si l’auteur avait raison","À la comparer au manuel"],
 exp:"Un document n’est pas neutre parce qu’il est ancien. Le chroniqueur d’un roi écrit pour son roi. C’est la compétence centrale du cours d’histoire, bien avant la mémorisation des dates.",
 lien:["Critique historique — Wikipédia","https://fr.wikipedia.org/wiki/Critique_historique"]},

{n:5,q:"Où et quand apparaît la première écriture connue ?",
 r:"En Mésopotamie, vers 3300 avant notre ère",
 autres:["En Égypte, vers 5000 avant notre ère","En Grèce, vers 800 avant notre ère","En Chine, vers 3000 avant notre ère"],
 exp:"Des tablettes d’argile, et d’abord pour compter des sacs de grain : l’écriture naît de la comptabilité, pas de la littérature. C’est cette invention qui sert de borne entre Préhistoire et Antiquité.",
 lien:["Écriture cunéiforme — Wikipédia","https://fr.wikipedia.org/wiki/Cun%C3%A9iforme"]},

{n:6,q:"Qui pouvait voter dans la démocratie athénienne ?",
 r:"Seuls les hommes citoyens, soit une minorité de la population",
 autres:["Tous les habitants adultes","Les hommes et les femmes libres","Tous sauf les esclaves"],
 exp:"Femmes, esclaves et métèques en étaient exclus : peut-être un habitant sur dix votait. Le mot « démocratie » nous vient de là, la chose que nous désignons par ce mot n’en vient pas.",
 lien:["Démocratie athénienne — Wikipédia","https://fr.wikipedia.org/wiki/D%C3%A9mocratie_ath%C3%A9nienne"]},

{n:7,q:"Qu’est-ce que la féodalité ?",
 r:"Un système de liens personnels entre seigneurs et vassaux, fondé sur la terre",
 autres:["Un régime dirigé par l’Église","Une forme de monarchie absolue","Un système de villes libres"],
 exp:"Le vassal reçoit un fief et doit conseil et service armé. Le pouvoir y est fragmenté : il n’y a pas d’État au sens moderne, mais un enchevêtrement de fidélités.",
 lien:["Féodalité — Wikipédia","https://fr.wikipedia.org/wiki/F%C3%A9odalit%C3%A9"]},

{n:8,q:"L’expression « Moyen Âge » a été forgée par qui, et dans quel esprit ?",
 r:"Par des lettrés de la Renaissance, comme un entre-deux méprisé",
 autres:["Par les gens de l’époque elle-même","Par les historiens du XXᵉ siècle","Par l’Église médiévale"],
 exp:"Un âge « du milieu » entre l’Antiquité admirée et leur propre temps. Le nom porte donc un jugement, et les historiens passent depuis un siècle à défaire l’image de siècles obscurs qu’il véhicule.",
 lien:["Moyen Âge — Wikipédia","https://fr.wikipedia.org/wiki/Moyen_%C3%82ge"]},

{n:9,q:"Qu’a changé l’imprimerie à caractères mobiles de Gutenberg, vers 1450 ?",
 r:"Elle a rendu possible la diffusion rapide et à bas coût des textes",
 autres:["Elle a inventé le papier","Elle a créé l’alphabet latin","Elle a supprimé les copistes du jour au lendemain"],
 exp:"Des procédés d’impression existaient déjà en Chine et en Corée. Ce qui bascule en Europe, c’est l’échelle : quelques décennies suffisent pour que les idées circulent plus vite que les autorités ne les contrôlent.",
 lien:["Imprimerie — Wikipédia","https://fr.wikipedia.org/wiki/Imprimerie"]},

{n:10,q:"Qu’est-ce que l’humanisme de la Renaissance ?",
 r:"Un mouvement qui replace l’étude des textes antiques et de l’homme au centre",
 autres:["Le rejet de toute religion","Une doctrine politique républicaine","Un courant artistique uniquement"],
 exp:"Érasme, Thomas More, Montaigne. Ce n’est pas un athéisme : la plupart des humanistes sont croyants. C’est un déplacement de la méthode — retourner aux textes originaux plutôt qu’aux commentaires.",
 lien:["Humanisme — Wikipédia","https://fr.wikipedia.org/wiki/Humanisme_de_la_Renaissance"]},

{n:11,q:"Parler de « découverte de l’Amérique » en 1492 pose quel problème ?",
 r:"Le continent était peuplé depuis des millénaires : c’est un point de vue européen",
 autres:["La date est fausse de deux ans","Christophe Colomb n’y est jamais allé","Aucun problème, c’est exact"],
 exp:"On dit plutôt « rencontre » ou « contact ». Le vocabulaire d’un manuel désigne toujours quelqu’un comme le sujet de l’histoire et quelqu’un d’autre comme son décor.",
 lien:["Découverte de l’Amérique — Wikipédia","https://fr.wikipedia.org/wiki/D%C3%A9couverte_de_l%27Am%C3%A9rique"]},

{n:12,q:"Qu’est-ce que la Réforme protestante du XVIᵉ siècle ?",
 r:"Une rupture avec l’autorité de Rome, partie des critiques de Luther",
 autres:["Une réforme interne de l’Église catholique","Un mouvement politique français","Une révolte paysanne"],
 exp:"Luther en 1517, puis Calvin. L’Église catholique répond par le concile de Trente. L’Europe s’en trouve durablement divisée, et nos régions en portent encore la trace.",
 lien:["Réforme protestante — Wikipédia","https://fr.wikipedia.org/wiki/R%C3%A9forme_protestante"]},

{n:13,q:"Qu’est-ce que la monarchie absolue ?",
 r:"Un régime où le roi concentre tous les pouvoirs sans contre-pouvoir institué",
 autres:["Un régime sans lois","Une monarchie élue","Un régime où le roi partage avec un parlement"],
 exp:"Louis XIV en est la figure. « Absolu » ne veut pas dire arbitraire sans limite : le roi reste tenu par les lois fondamentales du royaume et par la coutume — mais nul ne peut le contraindre.",
 lien:["Monarchie absolue — Wikipédia","https://fr.wikipedia.org/wiki/Monarchie_absolue"]},

{n:14,q:"Que proclame la Déclaration des droits de l’homme et du citoyen de 1789 ?",
 r:"Que les hommes naissent libres et égaux en droits",
 autres:["L’abolition de l’esclavage","Le droit de vote des femmes","La séparation de l’Église et de l’État"],
 exp:"Aucune des trois autres n’y figure : l’esclavage colonial est aboli en 1794, rétabli en 1802, aboli définitivement en 1848. Un texte fondateur n’applique pas d’emblée ce qu’il énonce.",
 lien:["Déclaration des droits de l’homme et du citoyen de 1789 — Wikipédia","https://fr.wikipedia.org/wiki/D%C3%A9claration_des_droits_de_l%27homme_et_du_citoyen_de_1789"]},

{n:15,q:"Où et quand commence la révolution industrielle ?",
 r:"En Grande-Bretagne, à partir de la seconde moitié du XVIIIᵉ siècle",
 autres:["En France, après 1789","En Allemagne, vers 1850","Aux États-Unis, vers 1800"],
 exp:"Charbon, machine à vapeur, textile, chemin de fer. La Belgique est le deuxième pays industrialisé du continent, autour de Liège et du Hainaut — d’où viennent les paysages miniers d’ici.",
 lien:["Révolution industrielle — Wikipédia","https://fr.wikipedia.org/wiki/R%C3%A9volution_industrielle"]},

{n:16,q:"En quelle année la Belgique devient-elle indépendante ?",
 r:"En 1830", autres:["En 1789","En 1815","En 1848"],
 exp:"Après la révolution d’août-septembre contre le royaume uni des Pays-Bas. Le Congrès national choisit une monarchie constitutionnelle et parlementaire ; Léopold Iᵉʳ prête serment en juillet 1831.",
 lien:["Révolution belge — Wikipédia","https://fr.wikipedia.org/wiki/R%C3%A9volution_belge"]},

{n:17,q:"Qui pouvait voter en Belgique en 1830 ?",
 r:"Seuls les hommes payant un impôt suffisant : le suffrage était censitaire",
 autres:["Tous les hommes adultes","Tous les adultes","Les hommes sachant lire"],
 exp:"Environ un pour cent de la population. Le suffrage universel masculin arrive en 1893 sous une forme plurale, l’égalité stricte en 1919, et le vote des femmes aux législatives en 1948.",
 lien:["Histoire du droit de vote en Belgique — Wikipédia","https://fr.wikipedia.org/wiki/Suffrage_universel"]},

{n:18,q:"Quel événement déclenche la Première Guerre mondiale en 1914 ?",
 r:"L’attentat de Sarajevo, dans un système d’alliances déjà tendu",
 autres:["L’invasion de la Pologne","La révolution russe","Le krach boursier"],
 exp:"L’attentat est le déclencheur, non la cause : rivalités coloniales, course aux armements et alliances croisées étaient en place depuis des décennies. Distinguer déclencheur et causes est un exercice classique.",
 lien:["Première Guerre mondiale — Wikipédia","https://fr.wikipedia.org/wiki/Premi%C3%A8re_Guerre_mondiale"]},

{n:19,q:"Quelle est la différence entre un fait historique et son interprétation ?",
 r:"Le fait s’établit par les sources, l’interprétation lui donne un sens et se discute",
 autres:["Il n’y en a pas","L’interprétation est toujours fausse","Le fait est ancien, l’interprétation récente"],
 exp:"Que la Bastille ait été prise le 14 juillet 1789 est un fait. Que ce soit le début de la Révolution est une interprétation — solide, mais construite. Les manuels mêlent les deux sans toujours le signaler.",
 lien:["Historiographie — Wikipédia","https://fr.wikipedia.org/wiki/Historiographie"]},

{n:20,q:"Pourquoi les manuels scolaires d’histoire changent-ils d’une génération à l’autre ?",
 r:"Parce que les sources disponibles et les questions posées évoluent",
 autres:["Parce qu’on découvre que les précédents mentaient","Pour vendre de nouveaux livres","Parce que les dates changent"],
 exp:"Des archives s’ouvrent, des méthodes apparaissent, et chaque époque interroge le passé à partir de ses propres préoccupations. Ce n’est pas un aveu de faiblesse : c’est le fonctionnement normal d’une discipline.",
 lien:["Historiographie — Wikipédia","https://fr.wikipedia.org/wiki/Historiographie"]}
];

/* ================================================================
   Bloc 8 : extension du site HUN — les échinodermes du Hunsrück.

   Six créatures et vingt questions ajoutées au gisement de Bundenbach,
   qui passe de six à douze fiches et de vingt à quarante questions.

   Pourquoi ce site plutôt qu'un autre : le Hunsrück est LE gisement à
   échinodermes fossiles à tissus mous. La pyritisation y a remplacé
   des podia — les pieds ambulacraires — qui ne se conservent nulle
   part ailleurs. Le pack Biologie explique pourquoi les holothuries
   sont invisibles dans les roches ; Bundenbach est l'exception qui
   rend la règle lisible.

   Tous les taxons ont été vérifiés. Lotusoblastus medusa est un genre
   érigé en 2024 seulement, absent des listes de faune antérieures :
   son espèce-type est le Pentremitidea medusa décrit par Jaekel en 1895.
   ================================================================ */

const HUN_ECHINO=[
{id:"HUN-07",site:"HUN",nom:"Euzonosoma tischbeiniana",groupe:"Ophiuride, étoile fragile",
 periode:"Dévonien inférieur",age:"≈ 408–400 Ma",ageMin:400,ageMax:408,
 lieu:"Bundenbach, Rhénanie-Palatinat, Allemagne",milieu:"Marin, fonds vaseux",
 regime:"Détritivore et prédateur de petites proies",taille:"≈ 10–15 cm de diamètre",
 masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Élevée",confN:4,
 desc:"Ophiuride à cinq bras étroits, dont certains spécimens conservent la membrane de tissu mou tendue entre les bras — une structure qui ne fossilise pratiquement jamais.",
 prudence:"La coloration est conjecturale. La membrane inter-bras est attestée sur certains spécimens seulement, pas sur tous.",
 src:[["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"],
      ["Fossils of the Hunsrück Slate — Cambridge University Press","https://www.cambridge.org/9780521418928"]],
 pack:"Hunsrück — La mer de pyrite",img:"cartes/HUN-07.webp"},

{id:"HUN-08",site:"HUN",nom:"Codiacrinus schultzei",groupe:"Crinoïde cyathocrinide",
 periode:"Dévonien inférieur",age:"≈ 408–400 Ma",ageMin:400,ageMax:408,
 lieu:"Bundenbach, Rhénanie-Palatinat, Allemagne",milieu:"Marin, fixé au fond",
 regime:"Filtreur",taille:"≈ 20 cm avec la tige",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Élevée",confN:4,
 desc:"Lis de mer fixé par une tige, décrit par Follmann en 1887. Des spécimens conservent des podia pyritisés — la première fois qu'on observe ces organes mous chez un crinoïde fossile.",
 prudence:"Presque tous les crinoïdes du gisement sont des formes fixées ; ne pas les représenter en nage libre.",
 src:[["Tube foot preservation in Codiacrinus — Lethaia (2013)","https://www.scup.com/doi/10.1111/let.12023"],
      ["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]],
 pack:"Hunsrück — La mer de pyrite",img:"cartes/HUN-08.webp"},

{id:"HUN-09",site:"HUN",nom:"Bundenbachia beneckei",groupe:"Ophiuride",
 periode:"Dévonien inférieur",age:"≈ 408–400 Ma",ageMin:400,ageMax:408,
 lieu:"Bundenbach, Rhénanie-Palatinat, Allemagne",milieu:"Marin, fonds vaseux",
 regime:"Détritivore",taille:"≈ 10 cm de diamètre",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Élevée",confN:4,
 desc:"Ophiuride décrit par Stürtz, sur lequel six spécimens ont livré des podia pyritisés : la première observation de pieds ambulacraires fossiles chez une ophiure, publiée en 2004.",
 prudence:"Cette découverte a été rendue possible par des techniques d'abrasion mises au point par des collectionneurs allemands ; les podia ne sont pas visibles sur un spécimen brut.",
 src:[["Glass & Blake (2004) — Preservation of tube feet in an ophiuroid","https://link.springer.com/article/10.1007/BF03009882"],
      ["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]],
 pack:"Hunsrück — La mer de pyrite",img:"cartes/HUN-09.webp"},

{id:"HUN-10",site:"HUN",nom:"Rhenechinus hopstaetteri",groupe:"Échinide, oursin primitif",
 periode:"Dévonien inférieur",age:"≈ 408–400 Ma",ageMin:400,ageMax:408,
 lieu:"Bundenbach, Rhénanie-Palatinat, Allemagne",milieu:"Marin peu profond, remanié en eau plus profonde",
 regime:"Brouteur",taille:"≈ 3 cm",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Oursin primitif d'une rareté extrême : après des décennies d'exploitation du gisement, seuls deux spécimens certains sont connus, sur une dizaine d'échinides tous confondus.",
 prudence:"Cette rareté suggère que les oursins ne vivaient pas sur place : ils auraient été emportés depuis des hauts-fonds voisins. Le milieu de vie figuré est donc une déduction.",
 src:[["Smith et al. — Echinoid specimens from the Hunsrück Slate","https://www.researchgate.net/figure/Echinoid-specimens-from-the-Lower-Devonian-Hunsrueck-Slate_tbl1_258877857"],
      ["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]],
 pack:"Hunsrück — La mer de pyrite",img:"cartes/HUN-10.webp"},

{id:"HUN-11",site:"HUN",nom:"Palaeocucumaria hunsrueckiana",groupe:"Holothurie, concombre de mer",
 periode:"Dévonien inférieur",age:"≈ 408–400 Ma",ageMin:400,ageMax:408,
 lieu:"Bundenbach, Rhénanie-Palatinat, Allemagne",milieu:"Marin, fonds vaseux",
 regime:"Suspensivore",taille:"≈ 5–8 cm",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"L'une des rares holothuries fossiles connues par un corps entier plutôt que par des spicules épars. Le corps mou est conservé par pyritisation, avec la couronne de tentacules buccaux.",
 prudence:"Les holothuries n'ont qu'un squelette de spicules microscopiques : sans la pyritisation de Bundenbach, il n'en resterait rien. Ce fossile est une exception, pas la norme.",
 src:[["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"],
      ["Wikipédia — Holothurie","https://fr.wikipedia.org/wiki/Holothurie"]],
 pack:"Hunsrück — La mer de pyrite",img:"cartes/HUN-11.webp"},

{id:"HUN-12",site:"HUN",nom:"Lotusoblastus medusa",groupe:"Blastoïde",
 periode:"Dévonien inférieur",age:"≈ 408–400 Ma",ageMin:400,ageMax:408,
 lieu:"Bundenbach et Kaub, Rhénanie-Palatinat, Allemagne",milieu:"Marin, fixé au fond",
 regime:"Filtreur",taille:"≈ 2 cm de calice",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Blastoïde à calice en bouton, décrit par Jaekel en 1895 et reclassé dans un genre nouveau en 2024. Ses brachioles sont conservées raides et droites, ce qui trahit l'état rigide de son tissu conjonctif au moment de l'enfouissement.",
 prudence:"L'ordre et la famille du genre restent indéterminés. Les blastoïdes forment une classe entièrement éteinte, sans équivalent actuel à qui emprunter des tissus mous.",
 src:[["Bohatý et al. (2024) — Papers in Palaeontology","https://onlinelibrary.wiley.com/doi/full/10.1002/spp2.1584"],
      ["Feeding postures and mutable collagenous tissue — PMC","https://pmc.ncbi.nlm.nih.gov/articles/PMC11568118/"]],
 pack:"Hunsrück — La mer de pyrite",img:"cartes/HUN-12.webp"}
];


/* Vingt questions supplémentaires pour le chantier de Bundenbach.
   Le site en compte désormais quarante, pour douze créatures. */

const HUN_ECHINO_Q=[
{id:"HUN-21",site:"HUN",diff:"facile",
 q:"À quel embranchement appartiennent les étoiles de mer, les oursins et les concombres de mer ?",
 choix:["Aux échinodermes","Aux mollusques","Aux arthropodes","Aux cnidaires"],r:"Aux échinodermes",
 exp:"Étoiles, ophiures, oursins, crinoïdes et holothuries forment un même embranchement, reconnaissable à sa symétrie à cinq branches chez l’adulte.",
 src:["Wikipédia — Échinodermes","https://fr.wikipedia.org/wiki/Echinodermata"]},

{id:"HUN-22",site:"HUN",diff:"facile",
 q:"Quel minéral a remplacé les tissus mous des fossiles du Hunsrück ?",
 choix:["La pyrite","Le quartz","La calcite","Le gypse"],r:"La pyrite",
 exp:"Le sulfure de fer s’est substitué aux tissus avant leur décomposition. C’est ce qui donne aux fossiles de Bundenbach leur éclat métallique et leur célébrité.",
 src:["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]},

{id:"HUN-23",site:"HUN",diff:"moyen",
 q:"Qu’est-ce qu’un podion, chez un échinoderme ?",
 choix:["Un pied ambulacraire mû par de l’eau sous pression","Une plaque du squelette","Une pièce buccale","Un organe reproducteur"],
 r:"Un pied ambulacraire mû par de l’eau sous pression",
 exp:"Les podia sont des tubes extensibles reliés au système aquifère. Ils servent au déplacement, à la capture de nourriture et aux échanges gazeux — et ce sont des tissus mous, donc normalement invisibles dans les roches.",
 src:["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]},

{id:"HUN-24",site:"HUN",diff:"difficile",
 q:"Sur quelle espèce du Hunsrück a-t-on observé pour la première fois des podia fossiles d’ophiure ?",
 choix:["Bundenbachia beneckei","Euzonosoma tischbeiniana","Codiacrinus schultzei","Rhenechinus hopstaetteri"],
 r:"Bundenbachia beneckei",
 exp:"Six spécimens ont livré ces pieds ambulacraires pyritisés, décrits en 2004. C’était le premier signalement de podia fossilisés chez une ophiure.",
 src:["Glass & Blake (2004) — Preservation of tube feet in an ophiuroid","https://link.springer.com/article/10.1007/BF03009882"]},

{id:"HUN-25",site:"HUN",diff:"moyen",
 q:"Qu’ont permis d’observer les techniques d’abrasion mises au point par les collectionneurs allemands ?",
 choix:["Des structures trop fines pour être visibles sur un spécimen brut","La couleur d’origine des animaux","L’âge exact des couches","Le contenu stomacal des poissons"],
 r:"Des structures trop fines pour être visibles sur un spécimen brut",
 exp:"Les podia pyritisés ne se voient qu’après un dégagement d’une extrême délicatesse. Une partie de ce qu’on sait de Bundenbach tient à des amateurs qui ont perfectionné la préparation.",
 src:["Glass & Blake (2004) — Preservation of tube feet in an ophiuroid","https://link.springer.com/article/10.1007/BF03009882"]},

{id:"HUN-26",site:"HUN",diff:"difficile",
 q:"Chez quel crinoïde du Hunsrück a-t-on signalé des podia pyritisés en 2013 ?",
 choix:["Codiacrinus schultzei","Bundenbachia beneckei","Palaeocucumaria hunsrueckiana","Lotusoblastus medusa"],
 r:"Codiacrinus schultzei",
 exp:"La conservation de tissus mous chez un échinoderme fossile est si rare que la plupart des signalements antérieurs ont été contestés ou réfutés. Celui-ci ne l’a pas été.",
 src:["Tube foot preservation in Codiacrinus — Lethaia (2013)","https://www.scup.com/doi/10.1111/let.12023"]},

{id:"HUN-27",site:"HUN",diff:"moyen",
 q:"Que conservent certains spécimens d’Euzonosoma tischbeiniana, entre les bras ?",
 choix:["Une membrane de tissu mou","Des œufs","Des restes de proies","Des cristaux de sel"],
 r:"Une membrane de tissu mou",
 exp:"Cette membrane tendue entre les bras ne se fossilise pratiquement jamais. Sa présence à Bundenbach indique un enfouissement très rapide, avant toute décomposition.",
 src:["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]},

{id:"HUN-28",site:"HUN",diff:"difficile",
 q:"Combien de spécimens certains de l’oursin Rhenechinus hopstaetteri connaît-on ?",
 choix:["Deux","Deux cents","Une cinquantaine","Plusieurs milliers"],r:"Deux",
 exp:"Sur une dizaine d’échinides tous confondus, après des décennies d’exploitation du gisement. Les oursins y sont l’exception, alors que les crinoïdes s’y comptent par dizaines d’espèces.",
 src:["Smith et al. — Echinoid specimens from the Hunsrück Slate","https://www.researchgate.net/figure/Echinoid-specimens-from-the-Lower-Devonian-Hunsrueck-Slate_tbl1_258877857"]},

{id:"HUN-29",site:"HUN",diff:"difficile",
 q:"Que déduit-on de l’extrême rareté des oursins à Bundenbach ?",
 choix:["Qu’ils ne vivaient probablement pas sur place","Qu’ils venaient d’apparaître","Qu’ils étaient trop fragiles pour fossiliser","Qu’ils étaient microscopiques"],
 r:"Qu’ils ne vivaient probablement pas sur place",
 exp:"On les suppose allochtones : emportés depuis des hauts-fonds voisins jusqu’au bassin où ils se sont déposés. Une espèce rare dans une couche n’y était pas forcément rare de son vivant — elle y était peut-être seulement de passage.",
 src:["Smith et al. — Echinoid specimens from the Hunsrück Slate","https://www.researchgate.net/figure/Echinoid-specimens-from-the-Lower-Devonian-Hunsrueck-Slate_tbl1_258877857"]},

{id:"HUN-30",site:"HUN",diff:"moyen",
 q:"Pourquoi les holothuries fossiles sont-elles presque introuvables, hors gisements exceptionnels ?",
 choix:["Leur squelette se réduit à des spicules microscopiques dispersés","Elles sont apparues très récemment","Elles vivaient en eau douce","Elles étaient trop grandes pour être enfouies"],
 r:"Leur squelette se réduit à des spicules microscopiques dispersés",
 exp:"Le corps mou ne laisse rien et les spicules se dispersent au lieu de former une pièce reconnaissable. Palaeocucumaria, à Bundenbach, est l’exception qui rend la règle lisible.",
 src:["Wikipédia — Holothurie","https://fr.wikipedia.org/wiki/Holothurie"]},

{id:"HUN-31",site:"HUN",diff:"moyen",
 q:"Qu’est-ce qu’un blastoïde, comme Lotusoblastus medusa ?",
 choix:["Un échinoderme fixé d’une classe entièrement éteinte","Un mollusque bivalve","Un corail solitaire","Une éponge siliceuse"],
 r:"Un échinoderme fixé d’une classe entièrement éteinte",
 exp:"Les blastoïdes vivaient fixés par une tige, avec un calice en bouton. La classe s’étend du Silurien au Permien et disparaît avec la crise de la fin du Permien : aucun représentant actuel.",
 src:["Bohatý et al. (2024) — Papers in Palaeontology","https://onlinelibrary.wiley.com/doi/full/10.1002/spp2.1584"]},

{id:"HUN-32",site:"HUN",diff:"difficile",
 q:"L’espèce Lotusoblastus medusa a été décrite en 1895, mais son genre actuel date de quand ?",
 choix:["De 2024","De 1895 également","De 1950","De 1998"],r:"De 2024",
 exp:"Jaekel l’avait rangée dans le genre Pentremitidea. Une révision de 2024 l’a placée dans un genre nouveau, dont l’ordre et la famille restent indéterminés. Une espèce peut être connue depuis cent trente ans sans que sa place soit fixée.",
 src:["Bohatý et al. (2024) — Papers in Palaeontology","https://onlinelibrary.wiley.com/doi/full/10.1002/spp2.1584"]},

{id:"HUN-33",site:"HUN",diff:"difficile",
 q:"Les brachioles de Lotusoblastus sont conservées raides et droites. Qu’en déduit-on ?",
 choix:["Que son tissu conjonctif était en position rigide au moment de l’enfouissement","Qu’elles étaient minéralisées de son vivant","Qu’il s’agissait d’épines défensives","Que l’animal était mort depuis longtemps"],
 r:"Que son tissu conjonctif était en position rigide au moment de l’enfouissement",
 exp:"Les échinodermes disposent d’un tissu conjonctif mutable, qui passe de souple à rigide en quelques secondes. Une seconde espèce du gisement, Pentremitella osoleae, montre l’état inverse : des brachioles molles, couchées par le courant.",
 src:["Feeding postures and mutable collagenous tissue — PMC","https://pmc.ncbi.nlm.nih.gov/articles/PMC11568118/"]},

{id:"HUN-34",site:"HUN",diff:"moyen",
 q:"Qu’est-ce que le tissu conjonctif mutable des échinodermes ?",
 choix:["Un tissu dont la rigidité change en quelques secondes","Un muscle capable de repousser","Une couche de graisse isolante","Une membrane productrice de venin"],
 r:"Un tissu dont la rigidité change en quelques secondes",
 exp:"Ce n’est pas du muscle : c’est la matrice de collagène elle-même qui se raidit ou se relâche, sous contrôle nerveux. C’est ce qui permet à une étoile de mer de tenir une posture sans se fatiguer.",
 src:["Feeding postures and mutable collagenous tissue — PMC","https://pmc.ncbi.nlm.nih.gov/articles/PMC11568118/"]},

{id:"HUN-35",site:"HUN",diff:"moyen",
 q:"Les crinoïdes du Hunsrück comptent une soixantaine d’espèces. Comment vivaient-elles presque toutes ?",
 choix:["Fixées au fond par une tige","En nage libre","Enfouies dans le sédiment","Accrochées à des algues flottantes"],
 r:"Fixées au fond par une tige",
 exp:"Les formes libres, qui dominent chez les crinoïdes actuels, sont quasi absentes du gisement. Un lis de mer dévonien se représente ancré, pas en train de nager.",
 src:["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]},

{id:"HUN-36",site:"HUN",diff:"difficile",
 q:"Sur certaines dalles, les cinq bras des ophiures pointent tous dans la même direction. Qu’indique cette disposition ?",
 choix:["Le sens du courant juste avant l’enfouissement","Un comportement de reproduction","Une attaque de prédateur","Un artefact de préparation"],
 r:"Le sens du courant juste avant l’enfouissement",
 exp:"Les animaux ont été couchés par le flux qui les a ensevelis. Une posture fossile peut ainsi renseigner sur les conditions physiques du dépôt, pas seulement sur l’anatomie.",
 src:["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]},

{id:"HUN-37",site:"HUN",diff:"facile",
 q:"Pourquoi les fossiles du Hunsrück ont-ils été découverts en si grand nombre ?",
 choix:["Le schiste était exploité en carrière pour couvrir les toits","Un programme de fouilles universitaires les a cherchés","Une rivière les a mis au jour","Ils affleurent naturellement en surface"],
 r:"Le schiste était exploité en carrière pour couvrir les toits",
 exp:"L’ardoise de Bundenbach a été extraite pendant des siècles ; la dernière exploitation a fermé en 2000. Sans cette industrie, la faune serait restée sous terre.",
 src:["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]},

{id:"HUN-38",site:"HUN",diff:"moyen",
 q:"À quel moment de la vie d’un échinoderme apparaît la symétrie à cinq branches ?",
 choix:["Chez l’adulte : la larve est à symétrie bilatérale","Dès l’œuf","Elle n’existe que chez les oursins","Elle apparaît après la reproduction"],
 r:"Chez l’adulte : la larve est à symétrie bilatérale",
 exp:"La pentaradialité est acquise au cours du développement, pas originelle. C’est l’un des arguments qui rattachent les échinodermes aux animaux bilatériens, malgré les apparences.",
 src:["Wikipédia — Échinodermes","https://fr.wikipedia.org/wiki/Echinodermata"]},

{id:"HUN-39",site:"HUN",diff:"difficile",
 q:"Pourquoi étudie-t-on souvent les fossiles du Hunsrück par radiographie aux rayons X ?",
 choix:["La pyrite est opaque aux rayons X et se détache du schiste","Le schiste est trop dur à fendre","Les fossiles sont radioactifs","Pour dater les couches"],
 r:"La pyrite est opaque aux rayons X et se détache du schiste",
 exp:"On voit ainsi ce qui reste enfoui dans la roche, sans dégager la pièce et sans risquer de la détruire. La méthode a révélé des structures que la préparation mécanique aurait effacées.",
 src:["The Hunsrück Slate Konservat-Lagerstätte — Geology Today","https://onlinelibrary.wiley.com/doi/full/10.1111/gto.12426"]},

{id:"HUN-40",site:"HUN",diff:"difficile",
 q:"Tous les fossiles du Hunsrück ne sont pas pyritisés au même degré. Que faut-il en conclure ?",
 choix:["Que les conditions de fossilisation variaient d’un endroit et d’un organisme à l’autre","Que certains sont des faux","Que les moins pyritisés sont plus récents","Que la pyrite s’est formée après l’extraction"],
 r:"Que les conditions de fossilisation variaient d’un endroit et d’un organisme à l’autre",
 exp:"La chimie du sédiment, la vitesse d’enfouissement et la composition du corps entrent toutes en jeu. Ce qu’un gisement livre n’est jamais un échantillon neutre de ce qui y vivait.",
 src:["The Geologic History and Paleoenvironmental Setting of the Hunsrück Slate","https://www.researchgate.net/publication/324628192_The_Geologic_History_and_Paleoenvironmental_Setting_of_the_Hunsruck_Slate_A_Review"]}
];

CREATURES.push(...HUN_ECHINO);
QUIZ_PALEO.push(...HUN_ECHINO_Q);

/* ================================================================
   Bloc 9 : site SAM — la vallée de Luján, Argentine.

   Dix-neuvième chantier. Il comble le Néogène et le Quaternaire, tous
   deux vides jusqu'ici, et ouvre un continent absent de l'atlas.

   Deux fils courent dans les questions. Le premier est biologique :
   trente millions d'années d'isolement produisent des lignées sans
   équivalent ailleurs, puis l'isthme de Panamá se ferme et la plupart
   disparaissent. Le second est épistémologique : c'est ici que naît la
   science de l'extinction, avec le Megatherium décrit par Cuvier en
   1796 ; et c'est ici que la morphologie a échoué pendant cent quatre-
   vingts ans avant que les protéines fossiles ne tranchent en 2015.

   Épingle calée à x=412 y=842 : côté atlantique, contrôlée contre
   masque_terre.json.
   ================================================================ */

const SAM_SITE={
 id:"SAM",
 nom:"Vallée de Luján",
 court:"Luján",
 region:"province de Buenos Aires",
 pays:"Argentine",
 ere:"Miocène → Pléistocène",
 age:"≈ 17 Ma – 11 000 ans",
 x:412, y:842,
 fond:"sites/SAM.webp",
 cout:800,
 accroche:"Le continent qui a vécu seul",
 intro:[
  "À soixante kilomètres à l'ouest de Buenos Aires, une rivière lente entaille la pampa et met à nu des couches de limon. En 1787, sur cette berge, Manuel Torres dégage un squelette qu'il ne reconnaît pas. Les caisses partent pour Madrid, où l'on assemble tant bien que mal un animal de six mètres, dressé sur ses pattes arrière.",

  "Un jeune anatomiste parisien en reçoit les dessins. Il n'a jamais vu l'os, il ne verra jamais le site, et il conclut en 1796 qu'il s'agit d'un paresseux géant, apparenté aux petits animaux arboricoles d'Amérique tropicale, et qu'aucune espèce semblable ne vit plus nulle part. Georges Cuvier vient de fonder l'idée d'extinction sur une pièce à conviction. Il l'appelle Megatherium americanum.",

  "Ce qui rend ce continent si étrange tient à sa géographie. Pendant une trentaine de millions d'années, l'Amérique du Sud est une île. Des ordres entiers de mammifères y évoluent sans contact avec le reste du monde : les litopternes, les notongulés — des herbivores qui ne sont ni des chevaux, ni des ruminants, ni rien de ce qu'on connaît. En l'absence de grands carnivores placentaires, les places de prédateurs reviennent à des marsupiaux et à des oiseaux incapables de voler.",

  "En 1834, un naturaliste de vingt-cinq ans ramasse des os dans ces mêmes couches et achète un crâne à Montevideo pour quelques shillings. Ce que Darwin rapporte de Macrauchenia et de Toxodon restera inclassable pendant cent quatre-vingts ans : selon les auteurs, ces bêtes sont proches des éléphants, des chameaux, des rhinocéros ou des tatous. La question a été tranchée en 2015, non par un os mieux conservé, mais par le collagène extrait de ces os — deux équipes indépendantes, même résultat : ce sont des cousins des chevaux, des tapirs et des rhinocéros.",

  "Un mot sur ce chantier. Il couvre dix-sept millions d'années et plusieurs provinces argentines, pas une seule carrière : Luján lui sert d'ancrage parce que Megatherium et Glyptodon en proviennent, et parce que c'est là que cette science a commencé. Il y a trois millions d'années, l'isthme de Panamá se ferme. Les faunes du nord descendent, celles du sud remontent, et la plupart des lignées que tu vas déterrer ici ne passent pas l'échange."
 ]
};

const SAM_CREATURES=[
{id:"SAM-01",site:"SAM",nom:"Megatherium americanum",groupe:"Xénarthre, paresseux terrestre",
 periode:"Pléistocène",age:"≈ 0,4–0,011 Ma",ageMin:0.011,ageMax:0.4,
 lieu:"Luján et pampa argentine",milieu:"Terrestre, plaines et bois clairs",
 regime:"Herbivore",taille:"≈ 6 m",masse:"≈ 4 t",
 longevite:"Inconnue ; estimée par comparaison avec de grands mammifères actuels, sans mesure directe",
 confLong:"Très faible",conf:"Élevée",confN:4,
 desc:"Paresseux terrestre géant, capable de se dresser sur ses pattes arrière en s'appuyant sur sa queue. C'est sur son squelette que Cuvier démontre en 1796 qu'une espèce peut avoir disparu.",
 prudence:"La posture dressée est déduite du bassin et des vertèbres caudales, non observée. Le régime exact et l'usage des griffes restent discutés.",
 src:[["Wikipédia — Megatherium","https://fr.wikipedia.org/wiki/Megatherium"],
      ["Wikipédia — Georges Cuvier","https://fr.wikipedia.org/wiki/Georges_Cuvier"]],
 pack:"Luján — Le continent séparé",img:"cartes/SAM-01.webp"},

{id:"SAM-02",site:"SAM",nom:"Glyptodon reticulatus",groupe:"Xénarthre cingulé",
 periode:"Pléistocène",age:"≈ 0,8–0,011 Ma",ageMin:0.011,ageMax:0.8,
 lieu:"Pampa argentine et Uruguay",milieu:"Terrestre, prairies et bords de cours d'eau",
 regime:"Herbivore brouteur",taille:"≈ 3 m",masse:"≈ 1 t",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Élevée",confN:4,
 desc:"Parent géant des tatous, protégé par une carapace faite de centaines d'ostéodermes soudés en une coupole rigide, et par un anneau osseux autour de la queue.",
 prudence:"Les espèces du genre Glyptodon ont été très souvent redécrites et réattribuées : la limite entre plusieurs d'entre elles reste débattue. Les carapaces sont fréquentes en collection, les crânes et les membres beaucoup moins.",
 src:[["Wikipédia — Glyptodon","https://fr.wikipedia.org/wiki/Glyptodon"],
      ["Wikipédia — Cingulata","https://fr.wikipedia.org/wiki/Cingulata"]],
 pack:"Luján — Le continent séparé",img:"cartes/SAM-02.webp"},

{id:"SAM-03",site:"SAM",nom:"Macrauchenia patachonica",groupe:"Litopterne macrauchéniidé",
 periode:"Pléistocène",age:"≈ 0,7–0,011 Ma",ageMin:0.011,ageMax:0.7,
 lieu:"Patagonie et pampa, Argentine",milieu:"Terrestre, steppes ouvertes",
 regime:"Herbivore",taille:"≈ 3 m",masse:"≈ 1 t",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Herbivore d'un ordre aujourd'hui éteint, aux narines placées haut sur le crâne, entre les yeux. Récolté par Darwin en 1834, il n'a été rattaché à aucun groupe connu avant l'analyse de son collagène en 2015.",
 prudence:"La trompe qu'on lui prête souvent est une déduction contestée tirée de la position des narines. Aucun tissu mou n'est conservé : ni trompe, ni absence de trompe ne sont attestées.",
 src:[["Welker et al. (2015) — Ancient proteins resolve Darwin's South American ungulates","https://www.nature.com/articles/nature14249"],
      ["Wikipédia — Macrauchenia","https://fr.wikipedia.org/wiki/Macrauchenia"]],
 pack:"Luján — Le continent séparé",img:"cartes/SAM-03.webp"},

{id:"SAM-04",site:"SAM",nom:"Toxodon platensis",groupe:"Notongulé toxodontidé",
 periode:"Pliocène → Pléistocène",age:"≈ 2,6–0,011 Ma",ageMin:0.011,ageMax:2.6,
 lieu:"Argentine, Uruguay et Brésil",milieu:"Terrestre, milieux ouverts et humides",
 regime:"Herbivore",taille:"≈ 2,7 m",masse:"≈ 1,4 t",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Grand herbivore massif d'un ordre éteint, décrit par Owen à partir d'un crâne que Darwin avait acheté quelques shillings à Montevideo.",
 prudence:"Sa silhouette évoque un rhinocéros ou un hippopotame, sans aucune parenté proche avec l'un ou l'autre. La posture et l'usage des incisives restent discutés.",
 src:[["Buckley (2015) — Ancient collagen reveals evolutionary history","https://royalsocietypublishing.org/doi/10.1098/rspb.2014.2671"],
      ["Wikipédia — Toxodon","https://fr.wikipedia.org/wiki/Toxodon"]],
 pack:"Luján — Le continent séparé",img:"cartes/SAM-04.webp"},

{id:"SAM-05",site:"SAM",nom:"Phorusrhacos longissimus",groupe:"Oiseau phorusrhacidé",
 periode:"Miocène",age:"≈ 17–15 Ma",ageMin:15,ageMax:17,
 lieu:"Formation de Santa Cruz, Patagonie, Argentine",milieu:"Terrestre, prairies ouvertes",
 regime:"Carnivore",taille:"≈ 2,5 m",masse:"≈ 130 kg",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Oiseau terrestre incapable de voler, au crâne massif terminé par un bec crochu, prédateur de premier rang sur un continent dépourvu de grands carnivores placentaires.",
 prudence:"Le plumage et la coloration sont entièrement conjecturaux. La vitesse de course qu'on lui prête souvent n'est pas établie.",
 src:[["Wikipédia — Phorusrhacos","https://fr.wikipedia.org/wiki/Phorusrhacos"],
      ["Wikipédia — Phorusrhacidae","https://fr.wikipedia.org/wiki/Phorusrhacidae"]],
 pack:"Luján — Le continent séparé",img:"cartes/SAM-05.webp"},

{id:"SAM-06",site:"SAM",nom:"Thylacosmilus atrox",groupe:"Sparassodonte, métathérien",
 periode:"Miocène → Pliocène",age:"≈ 9–3 Ma",ageMin:3,ageMax:9,
 lieu:"Catamarca et nord-ouest argentin",milieu:"Terrestre",
 regime:"Carnivore",taille:"≈ 1,2 m",masse:"≈ 100 kg",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Prédateur aux canines à croissance continue, protégées par deux longues brides osseuses de la mâchoire inférieure. Il ressemble à un tigre à dents de sabre sans avoir de lien de parenté proche avec les félins.",
 prudence:"Ce n'est pas un félin et ce n'est pas un marsupial au sens strict, mais un métathérien d'une lignée éteinte. Ses orbites orientées vers l'avant nourrissent un débat sur son mode de chasse.",
 src:[["Wikipédia — Thylacosmilus","https://fr.wikipedia.org/wiki/Thylacosmilus"],
      ["Wikipédia — Sparassodonta","https://fr.wikipedia.org/wiki/Sparassodonta"]],
 pack:"Luján — Le continent séparé",img:"cartes/SAM-06.webp"}
];

const SAM_Q=[
{id:"SAM-Q01",site:"SAM",diff:"facile",
 q:"Dans quel pays se trouve la vallée de Luján ?",
 choix:["En Argentine","Au Pérou","Au Mexique","En Australie"],r:"En Argentine",
 exp:"À une soixantaine de kilomètres à l’ouest de Buenos Aires, dans la pampa.",
 src:["Wikipédia — Luján","https://fr.wikipedia.org/wiki/Luj%C3%A1n"]},

{id:"SAM-Q02",site:"SAM",diff:"facile",
 q:"Qu’est-ce que Megatherium americanum ?",
 choix:["Un paresseux terrestre géant","Un éléphant primitif","Un grand félin","Un dinosaure tardif"],
 r:"Un paresseux terrestre géant",
 exp:"Six mètres, quatre tonnes, et une parenté avec les petits paresseux arboricoles d’Amérique tropicale — c’est Cuvier qui l’a établie, sur les seuls dessins du squelette.",
 src:["Wikipédia — Megatherium","https://fr.wikipedia.org/wiki/Megatherium"]},

{id:"SAM-Q03",site:"SAM",diff:"moyen",
 q:"Que démontre Georges Cuvier en 1796 à partir du squelette de Luján ?",
 choix:["Qu’une espèce peut avoir totalement disparu","Que les espèces se transforment avec le temps","Que la Terre est très ancienne","Que les fossiles se datent par leur couche"],
 r:"Qu’une espèce peut avoir totalement disparu",
 exp:"L’idée n’allait pas de soi : on supposait volontiers que l’animal vivait encore dans une région inexplorée. Cuvier fonde l’extinction comme fait établi, sur une pièce à conviction.",
 src:["Wikipédia — Georges Cuvier","https://fr.wikipedia.org/wiki/Georges_Cuvier"]},

{id:"SAM-Q04",site:"SAM",diff:"moyen",
 q:"Pendant combien de temps, environ, l’Amérique du Sud est-elle restée un continent isolé ?",
 choix:["Une trentaine de millions d’années","Un million d’années","Trois cents millions d’années","Cinquante mille ans"],
 r:"Une trentaine de millions d’années",
 exp:"Séparée de l’Antarctique par l’ouverture du passage de Drake, et de l’Amérique du Nord jusqu’à la fermeture de l’isthme de Panamá. Cet isolement est la cause directe de l’étrangeté de sa faune.",
 src:["Buckley (2015) — Ancient collagen reveals evolutionary history","https://royalsocietypublishing.org/doi/10.1098/rspb.2014.2671"]},

{id:"SAM-Q05",site:"SAM",diff:"facile",
 q:"De quel animal actuel le Glyptodon est-il un parent géant ?",
 choix:["Du tatou","De la tortue","Du rhinocéros","Du pangolin"],r:"Du tatou",
 exp:"Comme lui, c’est un xénarthre cingulé. La ressemblance avec une tortue est une convergence : la carapace d’un glyptodon est faite d’ostéodermes de peau, pas de côtes soudées.",
 src:["Wikipédia — Glyptodon","https://fr.wikipedia.org/wiki/Glyptodon"]},

{id:"SAM-Q06",site:"SAM",diff:"moyen",
 q:"De quoi est faite la carapace d’un glyptodon ?",
 choix:["De centaines d’ostéodermes soudés en une coupole rigide","De kératine, comme une corne","De côtes élargies et fusionnées","D’écailles mobiles superposées"],
 r:"De centaines d’ostéodermes soudés en une coupole rigide",
 exp:"Les ostéodermes se forment dans la peau. Chez le tatou, ils restent en bandes mobiles ; chez le glyptodon, ils fusionnent, et l’animal ne peut plus se rouler en boule.",
 src:["Wikipédia — Glyptodon","https://fr.wikipedia.org/wiki/Glyptodon"]},

{id:"SAM-Q07",site:"SAM",diff:"moyen",
 q:"Quel naturaliste a récolté des ossements de Macrauchenia et acheté un crâne de Toxodon en Amérique du Sud ?",
 choix:["Charles Darwin","Georges Cuvier","Alfred Wallace","Alexander von Humboldt"],r:"Charles Darwin",
 exp:"Pendant le voyage du Beagle, en 1833-1834. Le crâne de Toxodon lui a coûté quelques shillings à Montevideo ; Richard Owen l’a décrit à son retour.",
 src:["Wikipédia — Toxodon","https://fr.wikipedia.org/wiki/Toxodon"]},

{id:"SAM-Q08",site:"SAM",diff:"difficile",
 q:"En 2015, qu’est-ce qui a permis de trancher la parenté de Macrauchenia et de Toxodon ?",
 choix:["Le collagène extrait de leurs os","Un crâne mieux conservé","Une nouvelle datation des couches","La découverte de leurs empreintes"],
 r:"Le collagène extrait de leurs os",
 exp:"Deux équipes indépendantes ont séquencé cette protéine par spectrométrie de masse et abouti au même arbre. Cent quatre-vingts ans de désaccord tranchés sans le moindre fossile nouveau.",
 src:["Welker et al. (2015) — Nature","https://www.nature.com/articles/nature14249"]},

{id:"SAM-Q09",site:"SAM",diff:"difficile",
 q:"De quel groupe actuel Macrauchenia et Toxodon se sont-ils révélés proches ?",
 choix:["Des chevaux, tapirs et rhinocéros","Des éléphants","Des chameaux et ruminants","Des tatous et paresseux"],
 r:"Des chevaux, tapirs et rhinocéros",
 exp:"Ce sont des cousins des périssodactyles, les ongulés à doigts impairs. Le regroupement a reçu le nom de Panperissodactyla, et un travail sur l’ADN mitochondrial l’a confirmé deux ans plus tard.",
 src:["Welker et al. (2015) — Nature","https://www.nature.com/articles/nature14249"]},

{id:"SAM-Q10",site:"SAM",diff:"difficile",
 q:"Pourquoi avoir séquencé du collagène plutôt que de l’ADN sur ces fossiles ?",
 choix:["L’ADN se dégrade vite sous les climats chauds","Le collagène est plus informatif que l’ADN","L’ADN de ces espèces avait déjà été lu","Le collagène est plus facile à dater"],
 r:"L’ADN se dégrade vite sous les climats chauds",
 exp:"Les protéines résistent bien plus longtemps que les acides nucléiques. Le collagène porte moins d’information, mais il en porte encore là où l’ADN a disparu.",
 src:["Buckley (2015) — Proceedings B","https://royalsocietypublishing.org/doi/10.1098/rspb.2014.2671"]},

{id:"SAM-Q11",site:"SAM",diff:"moyen",
 q:"Que sont les litopternes et les notongulés ?",
 choix:["Deux ordres de mammifères entièrement éteints, propres à l’Amérique du Sud","Deux familles de marsupiaux australiens","Deux groupes de reptiles du Crétacé","Deux lignées d’oiseaux coureurs"],
 r:"Deux ordres de mammifères entièrement éteints, propres à l’Amérique du Sud",
 exp:"Ils n’ont aucun représentant vivant. C’est pourquoi leur place dans l’arbre a résisté si longtemps : il n’existait aucune espèce actuelle à qui les comparer directement.",
 src:["Buckley (2015) — Proceedings B","https://royalsocietypublishing.org/doi/10.1098/rspb.2014.2671"]},

{id:"SAM-Q12",site:"SAM",diff:"moyen",
 q:"Qu’a de particulier le crâne de Macrauchenia ?",
 choix:["Ses narines s’ouvrent haut, entre les yeux","Il n’a aucune dent","Ses orbites sont tournées vers l’arrière","Il porte une corne osseuse"],
 r:"Ses narines s’ouvrent haut, entre les yeux",
 exp:"On en a souvent déduit une trompe, comme chez le tapir. La déduction est contestée : la position des narines autorise plusieurs interprétations, et aucun tissu mou n’est conservé.",
 src:["Wikipédia — Macrauchenia","https://fr.wikipedia.org/wiki/Macrauchenia"]},

{id:"SAM-Q13",site:"SAM",diff:"facile",
 q:"Qu’était Phorusrhacos longissimus ?",
 choix:["Un oiseau incapable de voler, prédateur de premier rang","Un dinosaure ayant survécu à la crise","Un grand reptile terrestre","Un mammifère coureur"],
 r:"Un oiseau incapable de voler, prédateur de premier rang",
 exp:"Deux mètres cinquante, un bec crochu haut comme une tête de cheval, des ailes réduites. C’est un oiseau moderne, pas un dinosaure attardé — même si les oiseaux sont bien des dinosaures.",
 src:["Wikipédia — Phorusrhacos","https://fr.wikipedia.org/wiki/Phorusrhacos"]},

{id:"SAM-Q14",site:"SAM",diff:"difficile",
 q:"Pourquoi des oiseaux ont-ils pu occuper le sommet de la chaîne alimentaire en Amérique du Sud ?",
 choix:["Le continent était dépourvu de grands carnivores placentaires","Les mammifères y étaient tous herbivores","Le climat empêchait les félins d’y vivre","Ils étaient venus d’Antarctique avec cet avantage"],
 r:"Le continent était dépourvu de grands carnivores placentaires",
 exp:"Une place vacante finit par être occupée. Ici, elle l’a été par des oiseaux et par des métathériens — deux groupes qui, ailleurs, n’ont jamais tenu ce rôle à cette taille.",
 src:["Wikipédia — Phorusrhacidae","https://fr.wikipedia.org/wiki/Phorusrhacidae"]},

{id:"SAM-Q15",site:"SAM",diff:"moyen",
 q:"Thylacosmilus ressemble beaucoup à un tigre à dents de sabre. Quel est son lien de parenté avec les félins ?",
 choix:["Aucun lien proche : c’est un métathérien","C’est un félin primitif","C’est l’ancêtre direct de Smilodon","C’est un félin nain d’Amérique du Sud"],
 r:"Aucun lien proche : c’est un métathérien",
 exp:"Il appartient aux sparassodontes, une lignée éteinte plus proche des marsupiaux que des chats. La ressemblance est une convergence : deux solutions séparées au même problème.",
 src:["Wikipédia — Thylacosmilus","https://fr.wikipedia.org/wiki/Thylacosmilus"]},

{id:"SAM-Q16",site:"SAM",diff:"difficile",
 q:"Quel détail anatomique distingue nettement Thylacosmilus d’un vrai félin à dents de sabre ?",
 choix:["Deux longues brides osseuses de la mâchoire inférieure protègent ses canines","Ses canines sont plus courtes","Il n’a pas de griffes rétractiles","Sa queue est plus longue"],
 r:"Deux longues brides osseuses de la mâchoire inférieure protègent ses canines",
 exp:"Smilodon n’a rien de tel. Regarder les différences est aussi instructif que regarder les ressemblances : c’est ce qui permet de dire qu’il s’agit de convergence et non de parenté.",
 src:["Wikipédia — Thylacosmilus","https://fr.wikipedia.org/wiki/Thylacosmilus"]},

{id:"SAM-Q17",site:"SAM",diff:"moyen",
 q:"Quel événement géographique met fin à l’isolement de l’Amérique du Sud ?",
 choix:["La fermeture de l’isthme de Panamá","L’ouverture du passage de Drake","La montée des Andes","L’assèchement de la Méditerranée"],
 r:"La fermeture de l’isthme de Panamá",
 exp:"Les faunes des deux Amériques se mélangent alors. Les espèces du nord descendent plus efficacement que l’inverse, et la plupart des lignées endémiques du sud ne passent pas l’échange.",
 src:["Wikipédia — Isthme de Panama","https://fr.wikipedia.org/wiki/Isthme_de_Panama"]},

{id:"SAM-Q18",site:"SAM",diff:"moyen",
 q:"Comment Megatherium atteignait-il les feuilles hautes, selon la reconstitution admise ?",
 choix:["En se dressant sur ses pattes arrière, en appui sur sa queue","En grimpant aux arbres","En allongeant un cou très long","En abattant les arbres d’un coup d’épaule"],
 r:"En se dressant sur ses pattes arrière, en appui sur sa queue",
 exp:"Le bassin massif et les vertèbres caudales soutiennent cette lecture. C’est une déduction anatomique solide, mais une déduction : personne n’a vu l’animal debout.",
 src:["Wikipédia — Megatherium","https://fr.wikipedia.org/wiki/Megatherium"]},

{id:"SAM-Q19",site:"SAM",diff:"facile",
 q:"Quand la grande faune de la pampa disparaît-elle ?",
 choix:["Il y a environ onze mille ans","Il y a soixante-six millions d’années","Il y a un million d’années","Au Moyen Âge"],
 r:"Il y a environ onze mille ans",
 exp:"À la fin du Pléistocène, en même temps que les grands mammifères d’autres continents. Les causes — climat, arrivée de l’homme, ou les deux — restent débattues.",
 src:["Wikipédia — Mégafaune","https://fr.wikipedia.org/wiki/M%C3%A9gafaune"]},

{id:"SAM-Q20",site:"SAM",diff:"difficile",
 q:"Toxodon a longtemps été rapproché des rhinocéros et des hippopotames. Que retenir de cette erreur ?",
 choix:["Une silhouette semblable n’établit aucune parenté","Les anciens naturalistes travaillaient mal","Les fossiles étaient mal préparés","La classification est arbitraire"],
 r:"Une silhouette semblable n’établit aucune parenté",
 exp:"Un corps massif sur des pattes courtes est une réponse à des contraintes mécaniques, pas une signature de famille. Il a fallu une autre source d’information — les protéines — pour départager.",
 src:["Welker et al. (2015) — Nature","https://www.nature.com/articles/nature14249"]}
];

SITES.push(SAM_SITE);
CREATURES.push(...SAM_CREATURES);
QUIZ_PALEO.push(...SAM_Q);

/* ================================================================
   Bloc 10 : site SIL — les Welsh Borderlands, autour de Ludlow.

   Vingtième chantier, et dernier trou comblé : le Silurien était la
   seule période vide de l'atlas entre l'Édiacarien et aujourd'hui.

   Ancrage à Ludlow plutôt qu'à Stonehaven, pour deux raisons. La
   bonne : c'est la région où Murchison a défini le système silurien
   en 1835, et d'où vient Cooksonia. La prosaïque : Stonehaven tombait
   à huit pixels du chantier carbonifère écossais, trop près pour que
   la grappe d'épingles s'ouvre même au zoom maximal.

   Deux créatures sur six sont des plantes. C'est délibéré : la sortie
   des eaux est d'abord végétale, et l'atlas n'avait aucun végétal.

   Épingle x=725 y=271, contrôlée contre masque_terre.json.
   ================================================================ */

const SIL_SITE={
 id:"SIL",
 nom:"Les marches galloises",
 court:"Ludlow",
 region:"Welsh Borderlands, Shropshire",
 pays:"Royaume-Uni",
 ere:"Silurien",
 age:"≈ 430–412 Ma",
 x:725, y:271,
 fond:"sites/SIL.webp",
 cout:840,
 accroche:"Le rivage franchi",
 intro:[
  "Une campagne vallonnée à la frontière du pays de Galles, des haies, des moutons. Dans les années 1830, un géologue écossais y passe des étés entiers à relever des couches que personne n'avait ordonnées. Roderick Murchison finit par y définir un système entier de l'histoire de la Terre, et lui donne le nom des Silures, le peuple qui habitait ces collines quand les Romains sont arrivés.",

  "Ce qu'on déterre ici couvre une vingtaine de millions d'années, et c'est probablement la période la plus sautée des récits sur les fossiles. Pas de dinosaures, pas de trilobites spectaculaires, pas de crise majeure. Juste le moment où la vie sort de l'eau — et elle en sort par les plantes.",

  "Cooksonia mesure trois centimètres. Pas de feuilles, pas de racines, une tige nue qui se divise en deux et porte un sporange à son extrémité. Rien qui attire l'œil. Mais cette tige contient des cellules conductrices rigidifiées, capables de faire monter l'eau contre la pesanteur et de tenir debout hors de l'eau. Tout ce qui pousse aujourd'hui sur les continents descend de ce dispositif.",

  "Les animaux suivent. Un mille-pattes d'un centimètre, trouvé par un amateur près de Stonehaven, porte sur ses flancs des stigmates trachéens : des orifices qui ne servent qu'à respirer de l'air. Pneumodesmus newmani a été annoncé en 2004 comme le plus ancien animal terrestre respirant l'air. Puis une datation aux zircons l'a rajeuni de quatorze millions d'années et lui a retiré le titre. Puis une troisième étude le lui a rendu. Tu liras cette histoire en détail sur sa fiche : elle dit quelque chose d'utile sur la façon dont une date se fabrique.",

  "Pendant que la vie s'installe sur les berges, la mer reste occupée. Les euryptérides — que l'on appelle scorpions de mer sans qu'ils soient des scorpions — y atteignent des tailles que plus aucun arthropode n'égalera. Et de petits poissons sans mâchoires, couverts d'écailles allongées, filtrent la vase des estuaires. Ce chantier n'a pas de vedette. Il a un basculement."
 ]
};

const SIL_CREATURES=[
{id:"SIL-01",site:"SIL",nom:"Cooksonia pertoni",groupe:"Plante vasculaire primitive",
 periode:"Silurien",age:"≈ 427–423 Ma",ageMin:423,ageMax:427,
 lieu:"Shropshire, Angleterre",milieu:"Terrestre, vasières et berges",
 regime:"Photosynthèse",taille:"≈ 3 cm",masse:"Non estimable",
 longevite:"Inconnue ; sans objet pour une plante de cette taille et de cette organisation",
 confLong:"Sans objet",conf:"Moyenne",confN:3,
 desc:"Tige nue qui se divise en deux et porte un sporange à son extrémité. Ni feuille, ni racine, mais des cellules conductrices rigidifiées : de quoi faire monter l'eau et tenir debout hors de l'eau.",
 prudence:"Ne pas la représenter comme une plante moderne miniature : l'absence de feuilles et de racines est établie. Certains spécimens de très petite taille auraient eu du mal à subvenir à leurs besoins par la seule photosynthèse de la tige, ce qui reste discuté.",
 src:[["Wikipédia — Cooksonia","https://fr.wikipedia.org/wiki/Cooksonia"],
      ["Natural History Museum — Les premières plantes terrestres","https://www.nhm.ac.uk/discover/first-plants-on-land.html"]],
 pack:"Ludlow — Le rivage franchi",img:"cartes/SIL-01.webp"},

{id:"SIL-02",site:"SIL",nom:"Pneumodesmus newmani",groupe:"Myriapode diplopode",
 periode:"Silurien (datation débattue)",age:"≈ 430–414 Ma",ageMin:414,ageMax:430,
 lieu:"Cowie, Stonehaven, Aberdeenshire, Écosse",milieu:"Terrestre, berges humides",
 regime:"Détritivore",taille:"≈ 1 cm",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Mille-pattes connu par un seul fragment, dont les flancs portent des stigmates trachéens : des orifices qui ne servent qu'à respirer de l'air. C'est le plus ancien animal terrestre respirant l'air dont on ait le corps.",
 prudence:"Son âge a changé trois fois. Décrit en 2004 comme silurien (≈ 428 Ma) d'après des spores prélevées sur des affleurements voisins mais tectoniquement isolés ; rajeuni en 2017 à ≈ 414 Ma par datation uranium-plomb sur zircons, ce qui le faisait basculer dans le Dévonien et lui retirait son titre ; puis ramené au Silurien par une étude de 2024 combinant palynologie et zircons. La fourchette affichée couvre l'ensemble du débat.",
 src:[["Suarez et al. (2017) — U-Pb zircon age constraint, PLOS ONE","https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0179262"],
      ["Journal of the Geological Society (2024) — Stonehaven Group is Silurian","https://doi.org/10.1144/jgs2023-138"]],
 pack:"Ludlow — Le rivage franchi",img:"cartes/SIL-02.webp"},

{id:"SIL-03",site:"SIL",nom:"Pterygotus anglicus",groupe:"Euryptéride ptérygotidé",
 periode:"Dévonien inférieur",age:"≈ 419–412 Ma",ageMin:412,ageMax:419,
 lieu:"Angus et Forfarshire, Écosse",milieu:"Marin et saumâtre côtier",
 regime:"Prédateur",taille:"≈ 1,6 m",masse:"≈ 10–20 kg",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Bonne",confN:4,
 desc:"Grand euryptéride à chélicères en pinces dentelées et à vastes yeux composés, prédateur des eaux côtières peu profondes.",
 prudence:"Cette espèce est dévonienne, non silurienne : c'est le genre qui traverse la limite. La masse est une estimation volumétrique, pas une mesure, et la coloration est entièrement conjecturale.",
 src:[["Wikipédia — Pterygotus","https://fr.wikipedia.org/wiki/Pterygotus"],
      ["Wikipédia — Euryptérides","https://fr.wikipedia.org/wiki/Eurypterida"]],
 pack:"Ludlow — Le rivage franchi",img:"cartes/SIL-03.webp"},

{id:"SIL-04",site:"SIL",nom:"Eurypterus remipes",groupe:"Euryptéride euryptéridé",
 periode:"Silurien",age:"≈ 432–418 Ma",ageMin:418,ageMax:432,
 lieu:"État de New York, États-Unis",milieu:"Marin peu profond, lagunes hypersalines",
 regime:"Prédateur et charognard",taille:"≈ 20 cm",masse:"≈ 0,3 kg",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Bonne",confN:4,
 desc:"L'euryptéride le mieux connu au monde, par des milliers de spécimens tirés des lagunes siluriennes de l'État de New York, dont il est le fossile officiel depuis 1984.",
 prudence:"L'immense majorité des spécimens sont des mues abandonnées, non des cadavres : leur abondance ne mesure pas une population.",
 src:[["Wikipédia — Eurypterus","https://fr.wikipedia.org/wiki/Eurypterus"],
      ["Wikipédia — Euryptérides","https://fr.wikipedia.org/wiki/Eurypterida"]],
 pack:"Ludlow — Le rivage franchi",img:"cartes/SIL-04.webp"},

{id:"SIL-05",site:"SIL",nom:"Birkenia elegans",groupe:"Agnathe anaspide",
 periode:"Silurien",age:"≈ 428–423 Ma",ageMin:423,ageMax:428,
 lieu:"Lanarkshire, Écosse",milieu:"Marin côtier et estuarien",
 regime:"Filtreur ou détritivore",taille:"≈ 10 cm",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Petit poisson dépourvu de mâchoires, au corps couvert d'écailles allongées et à la nageoire caudale inclinée vers le bas.",
 prudence:"L'absence de mâchoires est établie ; le régime alimentaire est déduit de la forme de la bouche et reste discuté.",
 src:[["Wikipédia — Birkenia","https://fr.wikipedia.org/wiki/Birkenia"],
      ["Wikipédia — Anaspida","https://en.wikipedia.org/wiki/Anaspida"]],
 pack:"Ludlow — Le rivage franchi",img:"cartes/SIL-05.webp"},

{id:"SIL-06",site:"SIL",nom:"Baragwanathia longifolia",groupe:"Lycophyte",
 periode:"Silurien → Dévonien (datation débattue)",age:"≈ 425–410 Ma",ageMin:410,ageMax:425,
 lieu:"Victoria, Australie",milieu:"Terrestre humide",
 regime:"Photosynthèse",taille:"≈ 40 cm",masse:"Non estimable",
 longevite:"Inconnue ; sans objet pour une plante de cette organisation",
 confLong:"Sans objet",conf:"Moyenne",confN:3,
 desc:"Lycophyte aux tiges densément couvertes de petites feuilles en aiguille, d'une complexité surprenante pour son âge : elle possède déjà de vraies feuilles là où Cooksonia n'en a aucune.",
 prudence:"L'âge silurien des gisements australiens a été longuement débattu, précisément parce que cette complexité paraissait trop précoce. La fourchette affichée couvre le désaccord.",
 src:[["Wikipédia — Baragwanathia","https://fr.wikipedia.org/wiki/Baragwanathia"],
      ["Wikipédia — Lycopodiopsida","https://fr.wikipedia.org/wiki/Lycopodiopsida"]],
 pack:"Ludlow — Le rivage franchi",img:"cartes/SIL-06.webp"}
];

const SIL_Q=[
{id:"SIL-Q01",site:"SIL",diff:"facile",
 q:"D’où vient le nom de la période silurienne ?",
 choix:["D’un peuple qui habitait les collines galloises","D’un géologue du XIXᵉ siècle","D’une ville d’Écosse","D’un mot grec signifiant « ancien »"],
 r:"D’un peuple qui habitait les collines galloises",
 exp:"Murchison définit le système dans les années 1830 sur les couches des marches galloises, et le nomme d’après les Silures, que les Romains y avaient rencontrés.",
 src:["Wikipédia — Silurien","https://fr.wikipedia.org/wiki/Silurien"]},

{id:"SIL-Q02",site:"SIL",diff:"facile",
 q:"Quel événement majeur se joue au Silurien ?",
 choix:["La colonisation des terres émergées","L’apparition des premiers dinosaures","La plus grande extinction de tous les temps","L’apparition des premiers animaux"],
 r:"La colonisation des terres émergées",
 exp:"Les plantes vasculaires s’installent sur les berges, et les premiers arthropodes respirant l’air les suivent. Le continent cesse d’être une roche nue.",
 src:["Wikipédia — Silurien","https://fr.wikipedia.org/wiki/Silurien"]},

{id:"SIL-Q03",site:"SIL",diff:"moyen",
 q:"Qu’est-ce qui manque à Cooksonia, par rapport à une plante d’aujourd’hui ?",
 choix:["Les feuilles et les racines","La photosynthèse","La reproduction","Les cellules conductrices"],
 r:"Les feuilles et les racines",
 exp:"Une tige nue de trois centimètres, qui se divise en deux et porte un sporange au sommet. Elle a en revanche déjà des cellules conductrices rigidifiées, ce qui est le point décisif.",
 src:["Wikipédia — Cooksonia","https://fr.wikipedia.org/wiki/Cooksonia"]},

{id:"SIL-Q04",site:"SIL",diff:"difficile",
 q:"Pourquoi les cellules conductrices rigidifiées sont-elles la vraie invention des plantes vasculaires ?",
 choix:["Elles permettent de faire monter l’eau et de tenir debout hors de l’eau","Elles stockent les réserves de sucre","Elles protègent des ultraviolets","Elles servent à la reproduction"],
 r:"Elles permettent de faire monter l’eau et de tenir debout hors de l’eau",
 exp:"Sans elles, une plante terrestre reste plaquée au sol et dépendante de l’humidité de surface. Avec elles, la hauteur devient possible — et avec la hauteur, la concurrence pour la lumière.",
 src:["Natural History Museum — Les premières plantes terrestres","https://www.nhm.ac.uk/discover/first-plants-on-land.html"]},

{id:"SIL-Q05",site:"SIL",diff:"moyen",
 q:"Qu’est-ce qui, sur le fossile de Pneumodesmus, prouve qu’il respirait de l’air ?",
 choix:["Des stigmates trachéens sur ses flancs","Des poumons conservés","Sa position hors de l’eau dans la roche","La forme de ses pattes"],
 r:"Des stigmates trachéens sur ses flancs",
 exp:"Ce sont des orifices reliés à un réseau de trachées, qui ne fonctionne que dans l’air. Contrairement à une posture ou à un lieu de découverte, c’est un caractère anatomique, donc un argument.",
 src:["Suarez et al. (2017) — PLOS ONE","https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0179262"]},

{id:"SIL-Q06",site:"SIL",diff:"difficile",
 q:"L’âge de Pneumodesmus newmani a changé plusieurs fois. Que s’est-il passé ?",
 choix:["Daté du Silurien en 2004, rajeuni au Dévonien en 2017, ramené au Silurien en 2024","Il a été daté une seule fois, avec certitude","Le fossile s’est révélé être un faux","Sa datation dépend du laboratoire qui l’analyse"],
 r:"Daté du Silurien en 2004, rajeuni au Dévonien en 2017, ramené au Silurien en 2024",
 exp:"Chaque étape reposait sur une méthode différente : d’abord des spores prélevées sur des affleurements voisins, puis des zircons datés à l’uranium-plomb, puis les deux combinés. Le fossile n’a pas bougé ; ce qui a changé, c’est ce à quoi on l’a comparé.",
 src:["Journal of the Geological Society (2024)","https://doi.org/10.1144/jgs2023-138"]},

{id:"SIL-Q07",site:"SIL",diff:"difficile",
 q:"Pourquoi la datation d’origine de Pneumodesmus était-elle fragile ?",
 choix:["Elle reposait sur des spores venues d’affleurements voisins mais isolés tectoniquement","Le fossile était trop petit pour être daté","Personne n’avait relevé sa position dans la couche","La méthode au carbone 14 était inadaptée"],
 r:"Elle reposait sur des spores venues d’affleurements voisins mais isolés tectoniquement",
 exp:"On datait la couche du fossile par corrélation avec d’autres couches supposées équivalentes. Rien ne garantissait cette équivalence — et la couche du fossile elle-même n’a livré aucune spore.",
 src:["Suarez et al. (2017) — PLOS ONE","https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0179262"]},

{id:"SIL-Q08",site:"SIL",diff:"moyen",
 q:"Sur quoi porte une datation à l’uranium-plomb comme celle appliquée à Stonehaven ?",
 choix:["Sur des cristaux de zircon des cendres volcaniques encadrant le fossile","Sur l’os fossilisé lui-même","Sur la matière organique conservée","Sur la profondeur d’enfouissement"],
 r:"Sur des cristaux de zircon des cendres volcaniques encadrant le fossile",
 exp:"On date les couches au-dessus et au-dessous, et le fossile se trouve encadré. La connaissance passe par un intermédiaire — la roche — et non par l’objet qui intéresse.",
 src:["Suarez et al. (2017) — PLOS ONE","https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0179262"]},

{id:"SIL-Q09",site:"SIL",diff:"facile",
 q:"Qu’est-ce qu’un euryptéride, comme Pterygotus ou Eurypterus ?",
 choix:["Un arthropode marin, parent éloigné des limules et des arachnides","Un vrai scorpion terrestre","Un crustacé proche du homard","Un mollusque à carapace"],
 r:"Un arthropode marin, parent éloigné des limules et des arachnides",
 exp:"On les appelle scorpions de mer, mais ce ne sont pas des scorpions. Ce sont des chélicérates, comme les limules et les araignées.",
 src:["Wikipédia — Euryptérides","https://fr.wikipedia.org/wiki/Eurypterida"]},

{id:"SIL-Q10",site:"SIL",diff:"moyen",
 q:"Qu’ont d’exceptionnel les euryptérides parmi les arthropodes ?",
 choix:["Ils comptent les plus grands arthropodes ayant jamais existé","Ils étaient les seuls à respirer l’air","Ils ne muaient jamais","Ils vivaient uniquement en eau douce"],
 r:"Ils comptent les plus grands arthropodes ayant jamais existé",
 exp:"Certains dépassent deux mètres. Aucun arthropode n’a atteint cette taille depuis — la contrainte n’est pas seulement l’oxygène, mais aussi le coût de la mue à grande échelle.",
 src:["Wikipédia — Euryptérides","https://fr.wikipedia.org/wiki/Eurypterida"]},

{id:"SIL-Q11",site:"SIL",diff:"moyen",
 q:"Eurypterus remipes est connu par des milliers de spécimens. Que sont-ils, pour la plupart ?",
 choix:["Des mues abandonnées","Des cadavres d’individus adultes","Des œufs fossilisés","Des empreintes de déplacement"],
 r:"Des mues abandonnées",
 exp:"Un arthropode change de carapace pour grandir : un seul individu en laisse des dizaines. L’abondance d’un fossile ne mesure pas une population.",
 src:["Wikipédia — Eurypterus","https://fr.wikipedia.org/wiki/Eurypterus"]},

{id:"SIL-Q12",site:"SIL",diff:"difficile",
 q:"Dans quel type de milieu se sont déposés les gisements à Eurypterus de l’État de New York ?",
 choix:["Des lagunes peu profondes et très salées","Des rivières de montagne","Des grands fonds océaniques","Des lacs d’eau douce glaciaires"],
 r:"Des lagunes peu profondes et très salées",
 exp:"Une salinité élevée éloigne les fouisseurs et les charognards, ce qui favorise la conservation. Ce que livre un gisement dépend d’abord des conditions du dépôt.",
 src:["Wikipédia — Eurypterus","https://fr.wikipedia.org/wiki/Eurypterus"]},

{id:"SIL-Q13",site:"SIL",diff:"facile",
 q:"Qu’est-ce qui manque à Birkenia elegans, comme à tous les agnathes ?",
 choix:["Les mâchoires","La colonne vertébrale","Les nageoires","Les yeux"],
 r:"Les mâchoires",
 exp:"Les premiers vertébrés n’ont pas de mâchoires. Elles apparaîtront au Silurien également, mais chez d’autres lignées — et changeront durablement ce qu’un vertébré peut manger.",
 src:["Wikipédia — Birkenia","https://fr.wikipedia.org/wiki/Birkenia"]},

{id:"SIL-Q14",site:"SIL",diff:"difficile",
 q:"Qu’est-ce qui rend Baragwanathia surprenante pour son âge ?",
 choix:["Elle porte déjà de vraies feuilles, là où Cooksonia n’en a aucune","Elle mesurait plusieurs mètres","Elle produisait des graines","Elle poussait en eau salée"],
 r:"Elle porte déjà de vraies feuilles, là où Cooksonia n’en a aucune",
 exp:"Cette complexité précoce est précisément ce qui a fait douter de son âge : l’âge silurien des gisements australiens a été longuement débattu, en partie parce que le résultat paraissait trop beau.",
 src:["Wikipédia — Baragwanathia","https://fr.wikipedia.org/wiki/Baragwanathia"]},

{id:"SIL-Q15",site:"SIL",diff:"moyen",
 q:"Pourquoi la colonisation des terres commence-t-elle par les plantes plutôt que par les animaux ?",
 choix:["Les plantes produisent la nourriture et l’abri dont dépendent les animaux","Les animaux ne supportaient pas l’air","Les plantes se déplacent plus facilement","Les animaux n’existaient pas encore"],
 r:"Les plantes produisent la nourriture et l’abri dont dépendent les animaux",
 exp:"Un détritivore d’un centimètre a besoin de débris végétaux et d’un sol humide pour survivre. L’ordre n’est pas un hasard : il est imposé par la chaîne alimentaire.",
 src:["Natural History Museum — Les premières plantes terrestres","https://www.nhm.ac.uk/discover/first-plants-on-land.html"]},

{id:"SIL-Q16",site:"SIL",diff:"difficile",
 q:"Que veut dire, pour un animal, être « le plus ancien connu » d’une catégorie ?",
 choix:["Qu’il est le plus ancien trouvé à ce jour, ce qui peut changer demain","Qu’aucun animal plus ancien n’a existé","Que sa datation est définitivement établie","Qu’il est l’ancêtre de tous les suivants"],
 r:"Qu’il est le plus ancien trouvé à ce jour, ce qui peut changer demain",
 exp:"Le titre dépend de deux choses fragiles : ce qui a été trouvé, et comment on l’a daté. Pneumodesmus l’a perdu puis retrouvé sans jamais bouger de sa vitrine.",
 src:["Journal of the Geological Society (2024)","https://doi.org/10.1144/jgs2023-138"]},

{id:"SIL-Q17",site:"SIL",diff:"moyen",
 q:"Combien de temps dure le Silurien, à peu près ?",
 choix:["Environ 25 millions d’années","Environ 2 millions d’années","Environ 100 millions d’années","Environ 500 millions d’années"],
 r:"Environ 25 millions d’années",
 exp:"De 443,8 à 419,2 Ma. C’est l’une des périodes les plus courtes du Paléozoïque, ce qui explique en partie qu’on la saute si souvent.",
 src:["Wikipédia — Silurien","https://fr.wikipedia.org/wiki/Silurien"]},

{id:"SIL-Q18",site:"SIL",diff:"facile",
 q:"Où se trouve la région qui a donné son nom au Silurien ?",
 choix:["À la frontière entre l’Angleterre et le pays de Galles","En Écosse","En Sibérie","Dans les Appalaches"],
 r:"À la frontière entre l’Angleterre et le pays de Galles",
 exp:"Les Welsh Borderlands, autour de Ludlow. Plusieurs systèmes géologiques portent des noms venus de cette région : le Cambrien et l’Ordovicien aussi.",
 src:["Wikipédia — Silurien","https://fr.wikipedia.org/wiki/Silurien"]},

{id:"SIL-Q19",site:"SIL",diff:"moyen",
 q:"Que fait un sporange, au sommet d’une tige de Cooksonia ?",
 choix:["Il produit et libère des spores","Il absorbe l’eau du sol","Il capte la lumière","Il fixe la plante au substrat"],
 r:"Il produit et libère des spores",
 exp:"La reproduction par spores précède de loin celle par graines. Ce sont d’ailleurs des spores fossiles qui servent à dater beaucoup de couches continentales — y compris, initialement, celle de Pneumodesmus.",
 src:["Wikipédia — Cooksonia","https://fr.wikipedia.org/wiki/Cooksonia"]},

{id:"SIL-Q20",site:"SIL",diff:"difficile",
 q:"Le Silurien est souvent absent des livres grand public. Pourquoi, le plus probablement ?",
 choix:["Il n’offre ni grande crise ni animal spectaculaire","Ses roches sont trop rares","Il n’a livré aucun fossile","Il est trop récent pour intéresser"],
 r:"Il n’offre ni grande crise ni animal spectaculaire",
 exp:"Il y manque ce qui fait un bon récit : une catastrophe ou une vedette. Il n’y manque pas ce qui fait une bascule — c’est là que la vie sort de l’eau pour de bon.",
 src:["Wikipédia — Silurien","https://fr.wikipedia.org/wiki/Silurien"]}
];

/* Les chantiers s'affichent du plus ancien au plus récent : le Silurien
   s'intercale, il ne s'ajoute pas à la fin. On repère le premier site plus
   jeune plutôt que de coder un indice en dur, qui casserait au prochain ajout. */
(function insererChronologiquement(s){
  const debut=x=>parseFloat(String(x.age).replace(',','.').match(/[\d.]+/)[0]);
  const i=SITES.findIndex(x=>debut(x)<debut(s));
  SITES.splice(i<0?SITES.length:i, 0, s);
})(SIL_SITE);
CREATURES.push(...SIL_CREATURES);
QUIZ_PALEO.push(...SIL_Q);

/* ================================================================
   Bloc 11 : site MES — la fosse de Messel, Hesse, Allemagne.

   Vingt-et-unième chantier. Il n'ouvre aucune période neuve : il
   étoffe le Paléogène, qui ne tenait que sur les six archéocètes
   d'Ouadi al-Hitan et n'offrait donc aucun animal terrestre.

   Le fil du chantier est la CONSERVATION. Messel est un lac de cratère
   à fond anoxique : rien n'y remue le sédiment, rien n'y respire. On y
   trouve des contenus stomacaux, des silhouettes de corps, des poils,
   des plumes, un utérus. C'est le contrepoint exact du Hunsrück, où
   c'est la pyrite qui conserve, et de Luján, où l'on n'a que des os.

   Deuxième fil, plus rare et plus précieux : Darwinius masillae, le
   fossile le plus surexposé de l'histoire récente de la paléontologie.
   Une conférence de presse, un documentaire, un livre, un site web, et
   une revendication — le chaînon manquant — que la communauté a réfutée
   en dix-huit mois. Cinq questions du pack portent là-dessus.

   Épingle x=766 y=301, à sept pixels du Hunsrück : la grappe ne s'ouvre
   qu'au zoom le plus profond, ce que la carte 6 140 px permet désormais.
   ================================================================ */

const MES_SITE={
 id:"MES",
 nom:"La fosse de Messel",
 court:"Messel",
 region:"Hesse, près de Darmstadt",
 pays:"Allemagne",
 ere:"Éocène",
 age:"≈ 48–47 Ma",
 x:766, y:301,
 fond:"sites/MES.webp",
 cout:880,
 accroche:"Le lac qui n'oubliait rien",
 intro:[
  "Une cuvette ovale d'un kilomètre de large, au sud-est de Francfort. On y a extrait du schiste bitumineux jusqu'en 1971, puis la commune a voulu en faire une décharge d'ordures. Des bénévoles ont passé quinze ans à s'y opposer. Le site a été racheté par le Land de Hesse en 1991 et classé au patrimoine mondial en 1995 — le premier site allemand inscrit pour des raisons purement paléontologiques.",

  "Ce qui s'y est passé il y a quarante-sept millions d'années tient à la forme du trou. Un maar : un cratère creusé par une explosion de vapeur au contact du magma et d'une nappe d'eau. Le cratère se remplit, et il est profond, étroit, abrité du vent. L'eau du fond ne se mélange jamais à celle de la surface. Elle est privée d'oxygène. Rien n'y vit, donc rien n'y fouille et rien n'y dévore.",

  "Le résultat n'a presque pas d'équivalent. On ne récolte pas ici des os épars mais des animaux entiers, aplatis mais complets, avec la silhouette de leur corps dessinée autour du squelette. Cette silhouette n'est d'ailleurs pas la peau : ce sont des tapis de bactéries, qui ont consommé les tissus mous et se sont minéralisées dans leur forme. On lit un contour de chauve-souris dans les cadavres des bactéries qui l'ont mangée.",

  "On y trouve donc ce qu'un gisement ordinaire ne livre jamais. Le dernier repas d'une chauve-souris, papillons de nuit identifiables. Une jument grosse, son fœtus en position de fin de gestation, et les restes de son utérus — le plus ancien connu chez un mammifère placentaire. Le contenu de l'estomac d'un pangolin. Des reflets métalliques encore visibles sur des élytres de scarabées.",

  "Un dernier animal mérite une mise en garde, et tu la trouveras sur sa fiche. En 2009, un primate de Messel a été présenté au monde comme le chaînon manquant de notre lignée, avec conférence de presse, documentaire et livre coordonnés. La revendication était fausse et la communauté l'a établi en moins de deux ans. Le fossile, lui, reste superbe. Il n'a jamais menti : ce sont ses présentateurs qui ont parlé trop fort."
 ]
};

const MES_CREATURES=[
{id:"MES-01",site:"MES",nom:"Eurohippus messelensis",groupe:"Équoïde, parent des chevaux",
 periode:"Éocène",age:"≈ 48–47 Ma",ageMin:47,ageMax:48,
 lieu:"Fosse de Messel, Hesse, Allemagne",milieu:"Terrestre, forêt humide subtropicale",
 regime:"Herbivore, feuilles et fruits",taille:"≈ 60 cm de long, 30 cm au garrot",masse:"≈ 10 kg",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Élevée",confN:5,
 desc:"Petit herbivore de la taille d'un fox-terrier, à quatre doigts aux mains et trois aux pieds. Plusieurs juments grosses ont été trouvées à Messel, dont une avec son fœtus presque complet et des restes d'utérus : le plus ancien connu chez un mammifère placentaire.",
 prudence:"Ce n'est pas un cheval : le genre tombe juste en dehors de la famille des équidés actuels. Il en est le parent le plus proche parmi les animaux de Messel, ce qui n'est pas la même chose qu'un ancêtre.",
 src:[["Franzen et al. (2015) — Fetus of Eurohippus messelensis, PLOS ONE","https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0137985"],
      ["Science — Stunning fossil shows pregnant mare and fetus","https://www.science.org/content/article/stunning-fossil-shows-pregnant-mare-and-fetus"]],
 pack:"Messel — Le lac qui n'oubliait rien",img:"cartes/MES-01.webp"},

{id:"MES-02",site:"MES",nom:"Palaeochiropteryx tupaiodon",groupe:"Chiroptère, chauve-souris",
 periode:"Éocène",age:"≈ 48–47 Ma",ageMin:47,ageMax:48,
 lieu:"Fosse de Messel, Hesse, Allemagne",milieu:"Aérien, forêt et bordure de lac",
 regime:"Insectivore",taille:"≈ 25 cm d'envergure",masse:"≈ 10 g",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Élevée",confN:5,
 desc:"Chauve-souris conservée avec la membrane de ses ailes et, chez plusieurs individus, le contenu de son estomac : des papillons de nuit encore identifiables.",
 prudence:"L'écholocation est déduite de la forme de la cochlée et du contenu stomacal, non observée. Les ailes courtes et larges suggèrent un vol lent sous couvert, ce qui reste une inférence.",
 src:[["Wikipédia — Palaeochiropteryx","https://fr.wikipedia.org/wiki/Palaeochiropteryx"],
      ["UNESCO — Fosse de Messel","https://whc.unesco.org/fr/list/720/"]],
 pack:"Messel — Le lac qui n'oubliait rien",img:"cartes/MES-02.webp"},

{id:"MES-03",site:"MES",nom:"Darwinius masillae",groupe:"Primate adapiforme",
 periode:"Éocène",age:"≈ 47 Ma",ageMin:47,ageMax:47,
 lieu:"Fosse de Messel, Hesse, Allemagne",milieu:"Terrestre et arboricole, forêt humide",
 regime:"Frugivore et folivore",taille:"≈ 58 cm avec la queue",masse:"≈ 700 g",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Élevée",confN:5,
 desc:"Jeune primate conservé à quatre-vingt-quinze pour cent, avec silhouette du corps et contenu stomacal. L'un des fossiles de primates les plus complets jamais trouvés.",
 prudence:"Présenté en 2009 comme un chaînon entre les primates primitifs et notre propre lignée, sous le surnom d'« Ida », avec une campagne médiatique coordonnée. Cette interprétation a été réfutée dès 2009-2010 : c'est un adapiforme, plus proche des lémuriens que des singes et des humains. Le fossile est exceptionnel ; la revendication ne l'était pas.",
 src:[["Wikipédia — Darwinius","https://fr.wikipedia.org/wiki/Darwinius"],
      ["Wikipédia — Adapiformes","https://fr.wikipedia.org/wiki/Adapiformes"]],
 pack:"Messel — Le lac qui n'oubliait rien",img:"cartes/MES-03.webp"},

{id:"MES-04",site:"MES",nom:"Titanomyrma giganteum",groupe:"Insecte hyménoptère, fourmi",
 periode:"Éocène",age:"≈ 48–47 Ma",ageMin:47,ageMax:48,
 lieu:"Fosse de Messel, Hesse, Allemagne",milieu:"Terrestre, forêt humide",
 regime:"Régime incertain",taille:"Reine ≈ 5 cm de corps, ailes ≈ 15 cm d'envergure",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Bonne",confN:4,
 desc:"La plus grande fourmi connue : une reine ailée de la taille d'un colibri. Le genre est également connu en Amérique du Nord, ce qui implique un passage entre les continents à la faveur d'un épisode chaud.",
 prudence:"Les spécimens connus sont presque tous des reines ailées, plus grandes et plus susceptibles de tomber dans un lac que les ouvrières. Le régime alimentaire n'est pas établi.",
 src:[["Wikipédia — Titanomyrma","https://fr.wikipedia.org/wiki/Titanomyrma"],
      ["Smithsonian — The Evolutionary Secrets Within the Messel Pit","https://www.smithsonianmag.com/travel/evolutionary-secrets-within-messel-pit-180948004/"]],
 pack:"Messel — Le lac qui n'oubliait rien",img:"cartes/MES-04.webp"},

{id:"MES-05",site:"MES",nom:"Messelobunodon schaeferi",groupe:"Artiodactyle primitif",
 periode:"Éocène",age:"≈ 48–47 Ma",ageMin:47,ageMax:48,
 lieu:"Fosse de Messel, Hesse, Allemagne",milieu:"Terrestre, sous-bois",
 regime:"Omnivore",taille:"≈ 50 cm",masse:"≈ 5 kg",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Bonne",confN:4,
 desc:"Petit ongulé à doigts pairs, au corps souple et à la longue queue, conservé entier avec sa silhouette. Il appartient au groupe dont sortiront les porcs, les ruminants — et les baleines.",
 prudence:"Sa parenté avec les cétacés passe par les artiodactyles dans leur ensemble, pas par cette espèce en particulier : ce n'est pas un ancêtre des baleines.",
 src:[["Wikipédia — Messelobunodon","https://en.wikipedia.org/wiki/Messelobunodon"],
      ["UNESCO — Fosse de Messel","https://whc.unesco.org/fr/list/720/"]],
 pack:"Messel — Le lac qui n'oubliait rien",img:"cartes/MES-05.webp"},

{id:"MES-06",site:"MES",nom:"Eomanis waldi",groupe:"Pholidote, pangolin",
 periode:"Éocène",age:"≈ 48–47 Ma",ageMin:47,ageMax:48,
 lieu:"Fosse de Messel, Hesse, Allemagne",milieu:"Terrestre, sol forestier",
 regime:"Insectivore",taille:"≈ 50 cm",masse:"≈ 2 kg",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Bonne",confN:4,
 desc:"Pangolin de quarante-sept millions d'années, conservé avec ses écailles et le contenu de son estomac. Le groupe existe donc déjà, sous une forme très proche de celle d'aujourd'hui.",
 prudence:"Le contenu stomacal mêle restes d'insectes et débris végétaux ; on discute si les végétaux ont été avalés volontairement ou avec les proies. Les écailles sont conservées sur le corps mais pas sur la queue, ce qui reste discuté.",
 src:[["Wikipédia — Eomanis","https://en.wikipedia.org/wiki/Eomanis"],
      ["Wikipédia — Pholidota","https://fr.wikipedia.org/wiki/Pholidota_(mammif%C3%A8re)"]],
 pack:"Messel — Le lac qui n'oubliait rien",img:"cartes/MES-06.webp"}
];

const MES_Q=[
{id:"MES-Q01",site:"MES",diff:"facile",
 q:"Dans quel pays se trouve la fosse de Messel ?",
 choix:["En Allemagne","En Autriche","En Pologne","Au Danemark"],r:"En Allemagne",
 exp:"En Hesse, au sud-est de Francfort, près de Darmstadt.",
 src:["UNESCO — Fosse de Messel","https://whc.unesco.org/fr/list/720/"]},

{id:"MES-Q02",site:"MES",diff:"moyen",
 q:"Qu’est-ce qu’un maar, comme celui qui a formé le lac de Messel ?",
 choix:["Un cratère creusé par une explosion de vapeur","Un lac de barrage glaciaire","Un cratère d’impact météoritique","Un effondrement de grotte calcaire"],
 r:"Un cratère creusé par une explosion de vapeur",
 exp:"Le magma rencontre une nappe d’eau souterraine ; l’eau se vaporise brutalement et creuse un trou. Le trou se remplit, et sa forme — profond, étroit, abrité — décide de tout le reste.",
 src:["UNESCO — Fosse de Messel","https://whc.unesco.org/fr/list/720/"]},

{id:"MES-Q03",site:"MES",diff:"moyen",
 q:"Pourquoi les fossiles de Messel sont-ils si complets ?",
 choix:["L’eau du fond était privée d’oxygène, donc sans fouisseurs ni charognards","Le lac gelait chaque hiver","Les animaux y étaient enterrés vivants","Le sédiment était très acide"],
 r:"L’eau du fond était privée d’oxygène, donc sans fouisseurs ni charognards",
 exp:"Un lac profond et abrité du vent ne mélange jamais ses eaux. Au fond, rien ne vit — donc rien ne remue le sédiment et rien ne dévore ce qui s’y dépose.",
 src:["UNESCO — Fosse de Messel","https://whc.unesco.org/fr/list/720/"]},

{id:"MES-Q04",site:"MES",diff:"difficile",
 q:"Les silhouettes de corps visibles autour des squelettes de Messel : de quoi sont-elles faites ?",
 choix:["De tapis de bactéries minéralisées","De la peau conservée telle quelle","D’une empreinte laissée dans la vase","De poils fossilisés"],
 r:"De tapis de bactéries minéralisées",
 exp:"Les bactéries ont consommé les tissus mous et se sont minéralisées dans leur forme. On lit donc un contour de chauve-souris dans les cadavres des bactéries qui l’ont mangée — ce qui est conservé n’est pas toujours ce qu’on croit regarder.",
 src:["Franzen et al. (2015) — PLOS ONE","https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0137985"]},

{id:"MES-Q05",site:"MES",diff:"moyen",
 q:"Qu’a-t-on trouvé dans l’estomac de plusieurs Palaeochiropteryx ?",
 choix:["Des papillons de nuit encore identifiables","Des graines","De petits poissons","Rien du tout"],
 r:"Des papillons de nuit encore identifiables",
 exp:"Un dernier repas identifiable à l’espèce près. C’est une information sur le comportement, pas seulement sur l’anatomie — et elle ne se conserve presque nulle part ailleurs.",
 src:["Wikipédia — Palaeochiropteryx","https://fr.wikipedia.org/wiki/Palaeochiropteryx"]},

{id:"MES-Q06",site:"MES",diff:"difficile",
 q:"Qu’a de remarquable la jument d’Eurohippus trouvée à Messel ?",
 choix:["Son fœtus et des restes de son utérus sont conservés","Elle mesurait deux mètres au garrot","Elle portait des jumeaux","Elle avait des sabots à un seul doigt"],
 r:"Son fœtus et des restes de son utérus sont conservés",
 exp:"C’est le plus ancien utérus connu chez un mammifère placentaire, et sa forme correspond à celle des juments actuelles. Le fœtus est en position de fin de gestation.",
 src:["Franzen et al. (2015) — PLOS ONE","https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0137985"]},

{id:"MES-Q07",site:"MES",diff:"moyen",
 q:"Quelle était la taille d’Eurohippus messelensis ?",
 choix:["Celle d’un fox-terrier, environ 30 cm au garrot","Celle d’un poney","Celle d’un cheval de trait","Celle d’un chat"],
 r:"Celle d’un fox-terrier, environ 30 cm au garrot",
 exp:"Les premiers parents des chevaux sont de petits animaux de sous-bois. La grande taille et la course sur un seul doigt viendront bien plus tard, avec l’ouverture des milieux.",
 src:["Science — Stunning fossil shows pregnant mare and fetus","https://www.science.org/content/article/stunning-fossil-shows-pregnant-mare-and-fetus"]},

{id:"MES-Q08",site:"MES",diff:"difficile",
 q:"Peut-on dire qu’Eurohippus est un cheval ?",
 choix:["Non : le genre tombe juste en dehors de la famille des chevaux actuels","Oui, c’est un cheval nain","Oui, c’est l’ancêtre direct du cheval","Non, c’est un parent des tapirs uniquement"],
 r:"Non : le genre tombe juste en dehors de la famille des chevaux actuels",
 exp:"Il en est le parent le plus proche parmi les animaux de Messel, ce qui n’est pas la même chose qu’un ancêtre. La différence entre « cousin » et « ancêtre » est l’une des plus souvent perdues dans les récits d’évolution.",
 src:["Franzen et al. (2015) — PLOS ONE","https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0137985"]},

{id:"MES-Q09",site:"MES",diff:"facile",
 q:"Qu’est-ce que Titanomyrma giganteum ?",
 choix:["La plus grande fourmi connue","Un scarabée géant","Une guêpe fossile","Une termite"],
 r:"La plus grande fourmi connue",
 exp:"Une reine ailée de la taille d’un colibri : cinq centimètres de corps, quinze d’envergure.",
 src:["Smithsonian — The Evolutionary Secrets Within the Messel Pit","https://www.smithsonianmag.com/travel/evolutionary-secrets-within-messel-pit-180948004/"]},

{id:"MES-Q10",site:"MES",diff:"difficile",
 q:"Presque tous les spécimens de Titanomyrma sont des reines ailées. Pourquoi, le plus probablement ?",
 choix:["Elles volent, donc elles tombent dans le lac plus souvent que les ouvrières","Les ouvrières n’existaient pas","Les ouvrières étaient trop petites pour fossiliser","Les reines vivaient plus longtemps"],
 r:"Elles volent, donc elles tombent dans le lac plus souvent que les ouvrières",
 exp:"Ce qu’un gisement récolte dépend de la façon dont on y arrive. Un lac attrape ce qui vole ou ce qui flotte, pas ce qui court au sol — la collection est biaisée avant même d’être étudiée.",
 src:["Wikipédia — Titanomyrma","https://fr.wikipedia.org/wiki/Titanomyrma"]},

{id:"MES-Q11",site:"MES",diff:"moyen",
 q:"Qu’est-ce qu’Eomanis waldi ?",
 choix:["Un pangolin de 47 millions d’années","Un tatou primitif","Un fourmilier","Un hérisson géant"],
 r:"Un pangolin de 47 millions d’années",
 exp:"Conservé avec ses écailles et le contenu de son estomac. Le groupe existe donc déjà, sous une forme déjà très proche de celle d’aujourd’hui.",
 src:["Wikipédia — Eomanis","https://en.wikipedia.org/wiki/Eomanis"]},

{id:"MES-Q12",site:"MES",diff:"difficile",
 q:"Le pangolin, le tatou et le fourmilier se ressemblent beaucoup. Que faut-il en conclure ?",
 choix:["Rien : manger des fourmis impose la même forme à des lignées sans parenté","Qu’ils forment une même famille","Que l’un descend des deux autres","Qu’ils vivaient sur le même continent"],
 r:"Rien : manger des fourmis impose la même forme à des lignées sans parenté",
 exp:"Museau allongé, longue langue, griffes fouisseuses, dents réduites ou absentes : c’est le régime qui sculpte, pas l’ascendance. Les pangolins sont d’ailleurs plus proches des carnivores que des tatous.",
 src:["Wikipédia — Pholidota","https://fr.wikipedia.org/wiki/Pholidota_(mammif%C3%A8re)"]},

{id:"MES-Q13",site:"MES",diff:"moyen",
 q:"À quel grand groupe appartient Messelobunodon ?",
 choix:["Aux artiodactyles, les ongulés à doigts pairs","Aux rongeurs","Aux primates","Aux carnivores"],
 r:"Aux artiodactyles, les ongulés à doigts pairs",
 exp:"C’est le groupe des porcs, des ruminants — et des baleines, comme l’a établi l’astragale à double poulie des archéocètes que tu as déterrés à Ouadi al-Hitan.",
 src:["Wikipédia — Messelobunodon","https://en.wikipedia.org/wiki/Messelobunodon"]},

{id:"MES-Q14",site:"MES",diff:"facile",
 q:"Qu’est-ce que Darwinius masillae ?",
 choix:["Un primate fossile conservé à 95 %","Un poisson d’eau douce","Un oiseau primitif","Un insecte"],
 r:"Un primate fossile conservé à 95 %",
 exp:"Un jeune animal d’environ soixante centimètres avec la queue, l’un des fossiles de primates les plus complets jamais trouvés — silhouette du corps et contenu stomacal compris.",
 src:["Wikipédia — Darwinius","https://fr.wikipedia.org/wiki/Darwinius"]},

{id:"MES-Q15",site:"MES",diff:"moyen",
 q:"Comment Darwinius a-t-il été présenté au public en 2009 ?",
 choix:["Comme le « chaînon manquant » de la lignée humaine","Comme un simple fossile de plus","Comme un faux probable","Comme un ancêtre des lémuriens"],
 r:"Comme le « chaînon manquant » de la lignée humaine",
 exp:"Avec conférence de presse, documentaire, livre et site web coordonnés le même jour — une campagne d’un niveau inhabituel pour une publication scientifique.",
 src:["Wikipédia — Darwinius","https://fr.wikipedia.org/wiki/Darwinius"]},

{id:"MES-Q16",site:"MES",diff:"difficile",
 q:"Qu’est-il advenu de cette revendication ?",
 choix:["Elle a été réfutée en moins de deux ans : c’est un adapiforme","Elle a été confirmée","Elle est encore ouverte aujourd’hui","Le fossile s’est révélé être un assemblage"],
 r:"Elle a été réfutée en moins de deux ans : c’est un adapiforme",
 exp:"Darwinius se place du côté des lémuriens, pas de celui des singes et des humains. Le fossile reste superbe : ce sont ses présentateurs qui avaient parlé trop fort.",
 src:["Wikipédia — Adapiformes","https://fr.wikipedia.org/wiki/Adapiformes"]},

{id:"MES-Q17",site:"MES",diff:"difficile",
 q:"Que retenir de l’épisode Darwinius, du point de vue de la méthode ?",
 choix:["La qualité d’un fossile ne garantit pas la justesse de ce qu’on en dit","Il ne faut pas faire confiance aux fossiles","Les médias comprennent mal la science","Les primates sont mal classés"],
 r:"La qualité d’un fossile ne garantit pas la justesse de ce qu’on en dit",
 exp:"Conservation et interprétation sont deux choses séparées. Un spécimen à quatre-vingt-quinze pour cent complet ne rend pas plus vraie l’hypothèse qu’on lui accroche — et l’ampleur de l’annonce n’y change rien non plus.",
 src:["Wikipédia — Darwinius","https://fr.wikipedia.org/wiki/Darwinius"]},

{id:"MES-Q18",site:"MES",diff:"moyen",
 q:"À quoi la fosse de Messel a-t-elle échappé de justesse ?",
 choix:["À devenir une décharge d’ordures","À être ennoyée par un barrage","À une autoroute","À un lotissement"],
 r:"À devenir une décharge d’ordures",
 exp:"Après la fin de l’exploitation en 1971, le projet a été combattu quinze ans par des bénévoles. Le Land de Hesse a racheté le site en 1991 ; il est classé au patrimoine mondial depuis 1995.",
 src:["UNESCO — Fosse de Messel","https://whc.unesco.org/fr/list/720/"]},

{id:"MES-Q19",site:"MES",diff:"difficile",
 q:"Titanomyrma est connue en Allemagne et en Amérique du Nord. Qu’implique cette répartition ?",
 choix:["Un passage entre continents à la faveur d’un épisode climatique chaud","Que les fourmis traversaient l’océan à la nage","Que les deux continents étaient encore soudés","Que ce sont deux espèces sans lien"],
 r:"Un passage entre continents à la faveur d’un épisode climatique chaud",
 exp:"Les grandes fourmis d’aujourd’hui vivent sous les tropiques. Pour qu’elles franchissent les hautes latitudes, il faut que celles-ci aient été chaudes — la répartition d’un fossile renseigne sur le climat.",
 src:["Wikipédia — Titanomyrma","https://fr.wikipedia.org/wiki/Titanomyrma"]},

{id:"MES-Q20",site:"MES",diff:"moyen",
 q:"Qu’est-ce que Messel apporte que le Hunsrück ne peut pas donner ?",
 choix:["Des comportements : repas, gestation, régime alimentaire","Des animaux plus anciens","Des fossiles plus nombreux","Des squelettes en trois dimensions"],
 r:"Des comportements : repas, gestation, régime alimentaire",
 exp:"Le Hunsrück conserve des formes par la pyrite ; Messel conserve des contenus par l’absence d’oxygène. Deux mécanismes différents, deux types de savoir — et aucun des deux ne remplace l’autre.",
 src:["UNESCO — Fosse de Messel","https://whc.unesco.org/fr/list/720/"]}
];

/* Insertion chronologique, comme pour le Silurien : Messel s'intercale entre
   Ouadi al-Hitan (51 Ma) et Luján (17 Ma). */
(function insererChronologiquement(s){
  const debut=x=>parseFloat(String(x.age).replace(',','.').match(/[\d.]+/)[0]);
  const i=SITES.findIndex(x=>debut(x)<debut(s));
  SITES.splice(i<0?SITES.length:i, 0, s);
})(MES_SITE);
CREATURES.push(...MES_CREATURES);
QUIZ_PALEO.push(...MES_Q);

/* ================================================================
   Bloc 13 : site ORD — les schistes de Fezouata, Anti-Atlas marocain.

   Vingt-deuxième chantier. Il muscle l'Ordovicien, qui ne tenait
   jusqu'ici que sur deux créatures et restait la période la plus
   maigre de l'atlas après le Silurien.

   Comme le Silurien, c'est un panorama mondial ancré sur un gisement :
   Fezouata fournit la tête d'affiche, mais les six bêtes viennent du
   Maroc, de l'Iowa, de Bolivie, d'Afrique du Sud, du Manitoba et de
   Bretagne. L'intro le dit au cinquième volet.

   Épingle x=703 y=423, à dix pixels du chantier à trilobites de
   l'Anti-Atlas — les deux gisements sont réellement voisins, et le
   zoom profond de la v17 permet à leur grappe de s'ouvrir.

   VUE SATELLITE PROVISOIRE : sites/ORD.webp est une copie de TRI.webp
   en attendant l'image définitive. Le globe est celui du Maroc, donc
   correct. À remplacer.
   ================================================================ */

const ORD_SITE={
 id:"ORD",
 nom:"Les schistes de Fezouata",
 court:"Fezouata",
 region:"Zagora, Anti-Atlas",
 pays:"Maroc",
 ere:"Ordovicien",
 age:"≈ 485–444 Ma",
 x:703, y:423,
 fond:"sites/ORD.webp",
 fondProvisoire:true,
 cout:920,
 accroche:"L'océan se complique",
 intro:[
  "Des collines pierreuses au sud de Zagora, à la lisière du Sahara. Les schistes qu'on y fend sont plus jeunes d'une trentaine de millions d'années que ceux du chantier à trilobites voisin, et ils ont longtemps passé pour banals. Ils ne le sont pas : ils conservent des tissus mous, et ils datent du moment où l'océan cesse d'être un brouillon.",

  "On raconte volontiers le Cambrien comme le grand moment de l'histoire animale. Ce qui suit est plus discret et plus décisif. Pendant l'Ordovicien, le nombre de familles marines triple. Les récifs se construisent, les niches se spécialisent, les tailles s'écartent — et la mer commence à ressembler à un écosystème plutôt qu'à un catalogue de formes.",

  "La tête d'affiche de ce chantier illustre exactement ça. Les radiodontes sont connus pour Anomalocaris, le prédateur emblématique du Cambrien. Or Aegirocassis, deux mètres de long, a converti ses appendices de chasse en peignes filtreurs et se nourrit de plancton. Le même plan corporel, deux métiers opposés, quarante millions d'années d'écart. Ce n'est pas un groupe qui décline : c'est un groupe qui essaie autre chose.",

  "Tu croiseras aussi des animaux dont on ne savait presque rien il y a peu. Les conodontes n'ont été que des dents pendant plus d'un siècle — des milliers de petites pièces dentelées, excellentes pour dater les roches, sans aucun corps pour les porter. Le corps a fini par apparaître, et il change tout : ce sont des vertébrés.",

  "Un mot sur ce chantier. Il couvre quarante millions d'années et six pays — Fezouata lui sert d'ancrage parce que Aegirocassis en provient et que c'est le meilleur gisement ordovicien à tissus mous. Et il finit mal : l'Ordovicien se termine par la deuxième extinction de masse la plus sévère de toute l'histoire de la vie. Presque tout ce que tu vas déterrer ici disparaît en quelques centaines de milliers d'années."
 ]
};

const ORD_CREATURES=[
{id:"ORD-01",site:"ORD",nom:"Aegirocassis benmoulai",groupe:"Radiodonte hurdiidé",
 periode:"Ordovicien inférieur",age:"≈ 480 Ma",ageMin:478,ageMax:482,
 lieu:"Formation de Fezouata, Zagora, Maroc",milieu:"Marin, pleine eau",
 regime:"Suspensivore",taille:"≈ 2 m",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Bonne",confN:4,
 desc:"Parent tardif des radiodontes, dont les appendices frontaux de chasse sont devenus des peignes filtreurs. Deux rangées de palettes natatoires le long du corps en font l'un des premiers grands filtreurs de l'histoire.",
 prudence:"L'espèce est nommée d'après Mohamed Ben Moula, le collecteur marocain qui a mis au jour l'essentiel du gisement. La coloration est conjecturale.",
 src:[["Van Roy, Daley & Briggs (2015) — Nature","https://www.nature.com/articles/nature14256"],
      ["Aegirocassis — Wikipedia","https://en.wikipedia.org/wiki/Aegirocassis"]],
 pack:"Fezouata — L'océan se complique",img:"cartes/ORD-01.webp"},

{id:"ORD-02",site:"ORD",nom:"Pentecopterus decorahensis",groupe:"Euryptéride mégalograptide",
 periode:"Ordovicien moyen",age:"≈ 467 Ma",ageMin:465,ageMax:469,
 lieu:"Cratère de Decorah, Iowa, États-Unis",milieu:"Marin peu profond, bassin restreint",
 regime:"Prédateur",taille:"≈ 1,7 m",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Bonne",confN:4,
 desc:"Le plus ancien euryptéride connu en détail. Corps allongé, membres antérieurs hérissés d'épines servant de nasse plutôt que de pinces — une architecture très différente de celle des scorpions de mer siluriens.",
 prudence:"Son nom vient de la pentécontère, navire de guerre grec, pour la silhouette du corps. Le mode de chasse exact reste déduit de la forme des appendices.",
 src:[["Lamsdell et al. (2015) — BMC Evolutionary Biology","https://bmcecolevol.biomedcentral.com/articles/10.1186/s12862-015-0443-9"],
      ["Pentecopterus — Wikipedia","https://en.wikipedia.org/wiki/Pentecopterus"]],
 pack:"Fezouata — L'océan se complique",img:"cartes/ORD-02.webp"},

{id:"ORD-03",site:"ORD",nom:"Sacabambaspis janvieri",groupe:"Vertébré sans mâchoires, arandaspide",
 periode:"Ordovicien moyen à supérieur",age:"≈ 470–450 Ma",ageMin:450,ageMax:470,
 lieu:"Sacabamba, Bolivie",milieu:"Marin côtier peu profond",
 regime:"Microphage ou déposivore",taille:"≈ 25–35 cm",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"L'un des plus anciens vertébrés connus par un squelette dermique étendu. Tête large et aplatie, yeux frontaux très rapprochés, petite bouche sans mâchoires.",
 prudence:"Les reconstructions anciennes lui donnaient une queue simple et un air hébété ; des travaux récents montrent une nageoire caudale plus complexe et fonctionnelle. L'image qui circule le plus n'est pas la mieux fondée.",
 src:[["Sacabambaspis — Wikipedia","https://en.wikipedia.org/wiki/Sacabambaspis"],
      ["Arandaspida — Wikipedia","https://en.wikipedia.org/wiki/Arandaspida"]],
 pack:"Fezouata — L'océan se complique",img:"cartes/ORD-03.webp"},

{id:"ORD-04",site:"ORD",nom:"Promissum pulchrum",groupe:"Conodonte",
 periode:"Ordovicien terminal",age:"≈ 445 Ma",ageMin:443,ageMax:447,
 lieu:"Soom Shale, Cedarberg, Afrique du Sud",milieu:"Marin froid, bassin peu oxygéné",
 regime:"Prédateur de proies molles",taille:"≈ 40 cm",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Animal au corps allongé, connu avec ses yeux, ses muscles du tronc et l'appareil denticulé complexe qui occupait sa gorge. C'est l'un des rares conodontes dont on ait autre chose que les dents.",
 prudence:"Les éléments conodontes ne sont pas des dents au sens des nôtres : ils fonctionnaient dans la gorge, non dans une mâchoire. L'appartenance des conodontes aux vertébrés est aujourd'hui admise mais a été longuement discutée.",
 src:[["Promissum — Wikipedia","https://en.wikipedia.org/wiki/Promissum"],
      ["Conodonta — Wikipedia","https://en.wikipedia.org/wiki/Conodont"]],
 pack:"Fezouata — L'océan se complique",img:"cartes/ORD-04.webp"},

{id:"ORD-05",site:"ORD",nom:"Isotelus rex",groupe:"Trilobite asaphide",
 periode:"Ordovicien supérieur",age:"≈ 455–445 Ma",ageMin:445,ageMax:455,
 lieu:"Baie d'Hudson, Manitoba, Canada",milieu:"Marin peu profond, fonds carbonatés",
 regime:"Détritivore ou prédateur opportuniste",taille:"≈ 72 cm",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Élevée",confN:4,
 desc:"Le plus grand trilobite complet formellement décrit : plus de soixante-dix centimètres, large et aplati, d'une silhouette proche de celle d'un grand limule.",
 prudence:"Le régime alimentaire est déduit de la forme du corps et des traces associées, non observé. Des fragments suggèrent des individus plus grands encore, mais un fragment ne fait pas une mesure.",
 src:[["Isotelus — Wikipedia","https://en.wikipedia.org/wiki/Isotelus"],
      ["Rudkin et al. (2003) — The world's biggest trilobite","https://www.cambridge.org/core/journals/journal-of-paleontology/article/abs/worlds-biggest-trilobite-isotelus-rex-new-species-from-the-upper-ordovician-of-northern-manitoba-canada/E6E9F1A4D5F0D9FF1D9E4E3B7A5D4D64"]],
 pack:"Fezouata — L'océan se complique",img:"cartes/ORD-05.webp"},

{id:"ORD-06",site:"ORD",nom:"Scotiaecystis guilloui",groupe:"Échinoderme stylophore cornute",
 periode:"Ordovicien moyen à supérieur",age:"≈ 460–450 Ma",ageMin:450,ageMax:460,
 lieu:"Massif armoricain, Bretagne, France",milieu:"Marin, fonds vaseux",
 regime:"Suspensivore ou déposivore",taille:"Quelques centimètres",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Faible",conf:"Faible à moyenne",confN:2,
 desc:"Petit échinoderme au corps aplati, cuirassé et franchement asymétrique, prolongé par un appendice articulé unique. Il ne ressemble à rien de vivant.",
 prudence:"C'est la créature la moins bien comprise de ce chantier. La fonction de l'appendice — bras alimentaire ou queue locomotrice — et même la position des stylophores dans l'arbre du vivant ont été longuement débattues. La reconstitution est délibérément prudente.",
 src:[["Stylophora — Wikipedia","https://en.wikipedia.org/wiki/Stylophora_(echinoderm)"],
      ["Cornuta — Wikipedia","https://en.wikipedia.org/wiki/Cornuta"]],
 pack:"Fezouata — L'océan se complique",img:"cartes/ORD-06.webp"}
];

const ORD_Q=[
{id:"ORD-Q01",site:"ORD",diff:"facile",
 q:"Dans quel pays se trouvent les schistes de Fezouata ?",
 choix:["Au Maroc","En Égypte","En Espagne","En Turquie"],r:"Au Maroc",
 exp:"Au sud de Zagora, dans l’Anti-Atlas, à quelques dizaines de kilomètres du chantier à trilobites que tu connais déjà.",
 src:["Fezouata Formation — Wikipedia","https://en.wikipedia.org/wiki/Fezouata_Formation"]},

{id:"ORD-Q02",site:"ORD",diff:"moyen",
 q:"Que se passe-t-il de remarquable dans les mers, pendant l’Ordovicien ?",
 choix:["Le nombre de familles marines triple","La vie sort de l’eau","Les premiers dinosaures apparaissent","Les océans gèlent entièrement"],
 r:"Le nombre de familles marines triple",
 exp:"On appelle cet épisode la grande biodiversification ordovicienne. Le Cambrien avait inventé les plans corporels ; l’Ordovicien construit les écosystèmes.",
 src:["Ordovicien — Wikipédia","https://fr.wikipedia.org/wiki/Ordovicien"]},

{id:"ORD-Q03",site:"ORD",diff:"moyen",
 q:"De quoi se nourrissait Aegirocassis, ce radiodonte de deux mètres ?",
 choix:["De plancton, qu’il filtrait","De trilobites","D’algues arrachées au fond","De charognes"],
 r:"De plancton, qu’il filtrait",
 exp:"Ses appendices frontaux, qui servaient à saisir chez ses parents cambriens, sont devenus des peignes. Le grand filtreur n’est pas une invention des baleines.",
 src:["Van Roy, Daley & Briggs (2015) — Nature","https://www.nature.com/articles/nature14256"]},

{id:"ORD-Q04",site:"ORD",diff:"difficile",
 q:"Que montre Aegirocassis à propos des radiodontes, groupe d’Anomalocaris ?",
 choix:["Un même plan corporel peut servir à des métiers opposés","Qu’ils n’étaient jamais prédateurs","Qu’ils ont disparu au Cambrien","Qu’ils étaient tous minuscules"],
 r:"Un même plan corporel peut servir à des métiers opposés",
 exp:"Prédateur au Cambrien, filtreur à l’Ordovicien, avec la même architecture d’appendices. Un groupe ne se réduit pas au métier de son représentant le plus célèbre.",
 src:["Van Roy, Daley & Briggs (2015) — Nature","https://www.nature.com/articles/nature14256"]},

{id:"ORD-Q05",site:"ORD",diff:"moyen",
 q:"D’où vient le nom d’espèce d’Aegirocassis benmoulai ?",
 choix:["Du collecteur marocain qui a mis au jour le gisement","D’une ville d’Anti-Atlas","D’un mot arabe signifiant « filtre »","D’un géologue français du XIXᵉ siècle"],
 r:"Du collecteur marocain qui a mis au jour le gisement",
 exp:"Mohamed Ben Moula. Les grands gisements doivent souvent leur existence à des collecteurs locaux, dont le nom n’apparaît pas toujours dans les récits qu’on en fait.",
 src:["Aegirocassis — Wikipedia","https://en.wikipedia.org/wiki/Aegirocassis"]},

{id:"ORD-Q06",site:"ORD",diff:"moyen",
 q:"Qu’a de particulier Pentecopterus parmi les euryptérides ?",
 choix:["C’est le plus ancien connu en détail","C’est le plus petit","C’est le seul terrestre","C’est le seul sans yeux"],
 r:"C’est le plus ancien connu en détail",
 exp:"Environ 467 millions d’années, soit une quarantaine de millions d’années avant les scorpions de mer siluriens du chantier de Ludlow.",
 src:["Lamsdell et al. (2015) — BMC Evolutionary Biology","https://bmcecolevol.biomedcentral.com/articles/10.1186/s12862-015-0443-9"]},

{id:"ORD-Q07",site:"ORD",diff:"difficile",
 q:"À quoi servaient les longs membres antérieurs épineux de Pentecopterus ?",
 choix:["À former une nasse pour retenir les proies","À creuser le sédiment","À nager en surface","À se fixer aux rochers"],
 r:"À former une nasse pour retenir les proies",
 exp:"Ce n’est pas une pince : c’est un panier d’épines. Les euryptérides siluriens que tu as déjà déterrés ont des solutions toutes différentes — le groupe a essayé plusieurs manières d’attraper.",
 src:["Pentecopterus — Wikipedia","https://en.wikipedia.org/wiki/Pentecopterus"]},

{id:"ORD-Q08",site:"ORD",diff:"facile",
 q:"Qu’est-ce que Sacabambaspis janvieri ?",
 choix:["Un des plus anciens vertébrés connus","Un arthropode nageur","Un mollusque cuirassé","Une algue calcaire"],
 r:"Un des plus anciens vertébrés connus",
 exp:"Un poisson sans mâchoires, à tête large et plate, connu par un squelette dermique étendu — l’un des premiers vertébrés dont on ait une silhouette complète.",
 src:["Sacabambaspis — Wikipedia","https://en.wikipedia.org/wiki/Sacabambaspis"]},

{id:"ORD-Q09",site:"ORD",diff:"difficile",
 q:"Que reproche-t-on aux reconstructions anciennes de Sacabambaspis ?",
 choix:["Elles lui donnaient une queue trop simple","Elles lui ajoutaient des mâchoires","Elles le représentaient hors de l’eau","Elles le faisaient trop grand"],
 r:"Elles lui donnaient une queue trop simple",
 exp:"Des travaux récents montrent une nageoire caudale plus complexe. L’image la plus diffusée d’un fossile n’est pas forcément la mieux fondée : elle est souvent seulement la plus ancienne.",
 src:["Sacabambaspis — Wikipedia","https://en.wikipedia.org/wiki/Sacabambaspis"]},

{id:"ORD-Q10",site:"ORD",diff:"moyen",
 q:"Pendant plus d’un siècle, que connaissait-on des conodontes ?",
 choix:["Uniquement leurs éléments denticulés","Uniquement leur silhouette","Uniquement leurs traces de nage","Leurs œufs seulement"],
 r:"Uniquement leurs éléments denticulés",
 exp:"De minuscules pièces dentelées, très abondantes et excellentes pour dater les couches, sans le moindre corps pour les porter. On datait des roches entières avec les dents d’un animal inconnu.",
 src:["Conodont — Wikipedia","https://en.wikipedia.org/wiki/Conodont"]},

{id:"ORD-Q11",site:"ORD",diff:"difficile",
 q:"Qu’a changé la découverte de corps de conodontes comme Promissum ?",
 choix:["Elle a montré que ce sont des vertébrés","Elle a montré que ce sont des mollusques","Elle a invalidé leur usage pour dater","Elle a prouvé qu’ils vivaient en eau douce"],
 r:"Elle a montré que ce sont des vertébrés",
 exp:"Yeux, muscles du tronc, corde dorsale : le corps a tranché ce que les dents seules ne permettaient pas de décider. L’attribution a été discutée, elle est aujourd’hui admise.",
 src:["Promissum — Wikipedia","https://en.wikipedia.org/wiki/Promissum"]},

{id:"ORD-Q12",site:"ORD",diff:"difficile",
 q:"Où fonctionnaient les éléments denticulés d’un conodonte ?",
 choix:["Dans la gorge","Dans une mâchoire, comme nos dents","Sur la peau","À l’extrémité de la queue"],
 r:"Dans la gorge",
 exp:"Ce ne sont donc pas des dents au sens où nous l’entendons. Les appeler « dents » est commode et trompeur à la fois — un mot familier plaqué sur un organe qui ne l’est pas.",
 src:["Conodont — Wikipedia","https://en.wikipedia.org/wiki/Conodont"]},

{id:"ORD-Q13",site:"ORD",diff:"facile",
 q:"Quelle taille atteint Isotelus rex, le plus grand trilobite complet décrit ?",
 choix:["Plus de 70 cm","Environ 10 cm","Environ 2 m","Environ 5 cm"],
 r:"Plus de 70 cm",
 exp:"Large et aplati, d’une silhouette proche de celle d’un grand limule. La plupart des trilobites tiennent dans une main ; celui-ci ne tient pas sur une assiette.",
 src:["Isotelus — Wikipedia","https://en.wikipedia.org/wiki/Isotelus"]},

{id:"ORD-Q14",site:"ORD",diff:"difficile",
 q:"Des fragments suggèrent des Isotelus plus grands encore. Pourquoi ne pas retenir ce chiffre ?",
 choix:["Un fragment ne permet pas une mesure fiable","Les fragments sont trop récents","Ils viennent d’un autre genre","La mesure serait invérifiable par principe"],
 r:"Un fragment ne permet pas une mesure fiable",
 exp:"Extrapoler la taille totale d’un morceau suppose des proportions constantes, ce qui n’est pas acquis. Le record officiel porte sur un individu complet, et c’est une décision de méthode, pas de modestie.",
 src:["Isotelus — Wikipedia","https://en.wikipedia.org/wiki/Isotelus"]},

{id:"ORD-Q15",site:"ORD",diff:"difficile",
 q:"Qu’est-ce qu’un stylophore comme Scotiaecystis ?",
 choix:["Un échinoderme au corps asymétrique et à appendice unique","Un mollusque à coquille plate","Un arthropode cuirassé","Une éponge fossile"],
 r:"Un échinoderme au corps asymétrique et à appendice unique",
 exp:"Il ne montre aucune symétrie à cinq branches, alors qu’il appartient au groupe des étoiles et des oursins. Sa place dans l’arbre et la fonction de son appendice ont été longuement débattues.",
 src:["Stylophora — Wikipedia","https://en.wikipedia.org/wiki/Stylophora_(echinoderm)"]},

{id:"ORD-Q16",site:"ORD",diff:"moyen",
 q:"Comment se termine l’Ordovicien ?",
 choix:["Par la deuxième extinction de masse la plus sévère","Par une longue période de calme","Par la sortie des eaux","Par l’ouverture de l’Atlantique"],
 r:"Par la deuxième extinction de masse la plus sévère",
 exp:"Une glaciation sur le Gondwana, une chute du niveau marin, puis un réchauffement. Presque tout ce que porte ce chantier disparaît en quelques centaines de milliers d’années.",
 src:["Extinction de l’Ordovicien-Silurien — Wikipédia","https://fr.wikipedia.org/wiki/Extinction_Ordovicien-Silurien"]},

{id:"ORD-Q17",site:"ORD",diff:"moyen",
 q:"Ce chantier rassemble des créatures de six pays. Pourquoi l’ancrer à Fezouata ?",
 choix:["C’est le meilleur gisement ordovicien à tissus mous","C’est le plus grand des six","C’est le plus récemment découvert","C’est le seul accessible au public"],
 r:"C’est le meilleur gisement ordovicien à tissus mous",
 exp:"Et il fournit la tête d’affiche. Comme pour le Silurien, l’ancrage est une commodité de carte : la faune présentée est mondiale, et l’application le dit plutôt que de le masquer.",
 src:["Fezouata Formation — Wikipedia","https://en.wikipedia.org/wiki/Fezouata_Formation"]},

{id:"ORD-Q18",site:"ORD",diff:"difficile",
 q:"Qu’ont en commun les schistes de Fezouata et ceux de Burgess, que tu connais déjà ?",
 choix:["Tous deux conservent des tissus mous","Tous deux sont du même âge","Tous deux sont en Amérique du Nord","Tous deux ne livrent que des trilobites"],
 r:"Tous deux conservent des tissus mous",
 exp:"Fezouata a environ trente millions d’années de moins. Ce qu’il montre, c’est que les faunes de type Burgess n’ont pas disparu à la fin du Cambrien : on ne les voyait plus, faute de gisement pour les conserver.",
 src:["Fezouata Formation — Wikipedia","https://en.wikipedia.org/wiki/Fezouata_Formation"]},

{id:"ORD-Q19",site:"ORD",diff:"moyen",
 q:"Le Soom Shale, d’où vient Promissum, s’est déposé dans quelles conditions ?",
 choix:["Une eau froide et pauvre en oxygène","Un lagon tropical très salé","Une rivière de montagne","Un lac de cratère"],
 r:"Une eau froide et pauvre en oxygène",
 exp:"Juste après la glaciation de fin d’Ordovicien. Comme à Messel, c’est le manque d’oxygène qui conserve : aucun charognard ne descend là où l’on ne peut pas respirer.",
 src:["Soom Shale — Wikipedia","https://en.wikipedia.org/wiki/Soom_Shale"]},

{id:"ORD-Q20",site:"ORD",diff:"difficile",
 q:"Scotiaecystis est classé « confiance faible à moyenne ». Qu’est-ce que cela signale ?",
 choix:["Que la reconstitution repose sur peu d’éléments assurés","Que le fossile pourrait être un faux","Que sa datation est contestée","Qu’il n’a été trouvé qu’une fois"],
 r:"Que la reconstitution repose sur peu d’éléments assurés",
 exp:"La forme de la carapace est connue ; l’orientation en vie, l’usage de l’appendice et la parenté ne le sont pas. Afficher ce niveau de confiance vaut mieux que dessiner une bête assurée qui ne l’est pas.",
 src:["Cornuta — Wikipedia","https://en.wikipedia.org/wiki/Cornuta"]}
];

(function insererChronologiquement(s){
  const debut=x=>parseFloat(String(x.age).replace(',','.').match(/[\d.]+/)[0]);
  const i=SITES.findIndex(x=>debut(x)<debut(s));
  SITES.splice(i<0?SITES.length:i, 0, s);
})(ORD_SITE);
CREATURES.push(...ORD_CREATURES);
QUIZ_PALEO.push(...ORD_Q);

/* ================================================================
   Bloc 14 : site GIL — Gilboa et la plaine deltaïque des Catskills.

   Vingt-troisième chantier, et le premier entièrement végétal.

   L'atlas comptait deux plantes sur 134 créatures alors que la
   conquête des continents est d'abord une affaire de plantes. Ce
   chantier en ajoute six et raconte la bascule que le Silurien avait
   seulement amorcée : non plus des tiges de trois centimètres, mais
   des architectures de huit mètres, avec du bois et des racines
   profondes — et les conséquences planétaires qui vont avec.

   Le fil transversal est le même que pour Thylacosmilus et Smilodon :
   « arbre » n'est pas une lignée, c'est une architecture. Six plantes
   sans parenté proche y arrivent séparément.

   VUE SATELLITE PROVISOIRE : sites/GIL.webp est une copie de DEV.webp
   en attendant l'image définitive. Le globe est celui de l'Amérique du
   Nord, donc correct. À remplacer.
   ================================================================ */

const GIL_SITE={
 id:"GIL",
 nom:"Gilboa",
 court:"Gilboa",
 region:"plaine deltaïque des Catskills, État de New York",
 pays:"États-Unis",
 ere:"Dévonien",
 age:"≈ 390–370 Ma",
 x:406, y:316,
 fond:"sites/GIL.webp",
 fondProvisoire:true,
 cout:960,
 accroche:"Les premières forêts",
 intro:[
  "Une crue emporte un pont dans les Catskills en 1869, et met à nu des dizaines de souches pétrifiées dressées dans le grès. On les appelle les souches de Gilboa. Elles sont énormes, elles sont manifestement en place, et personne ne sait ce qui poussait dessus. La question va rester ouverte cent quarante ans.",

  "La réponse est arrivée en 2007, quand on a enfin rattaché une couronne à un tronc. Wattieza avait huit mètres, une base évasée, et au sommet une touffe de rameaux ramifiés — sans une seule feuille au sens moderne. Ce n'est pas un arbre ressemblant à ceux d'aujourd'hui : c'est une autre solution au même problème, tenir haut pour capter la lumière.",

  "Un autre végétal de ces couches est plus troublant encore. Archaeopteris a du bois véritable, des branches latérales disposées comme celles d'un conifère, et surtout des racines profondes et ramifiées. Vu de loin, on le prendrait pour un arbre ordinaire. Il n'a pourtant aucune parenté proche avec les arbres actuels : c'est une progymnosperme, une lignée qui s'éteindra.",

  "Ce sont ces racines qui font de ce chantier autre chose qu'une curiosité botanique. Une racine profonde fend la roche, retient l'eau, fabrique du sol. Multiplié à l'échelle des continents, cela accélère l'altération des silicates, consomme du dioxyde de carbone, refroidit la planète, et change jusqu'à la forme des rivières — qui cessent de divaguer en larges tresses pour creuser des méandres stables entre des berges tenues.",

  "Un mot sur ce chantier. Il ne présente pas un écosystème local comme Messel, mais une bascule à l'échelle du globe, ancrée sur Gilboa parce que c'est là qu'on l'a comprise. Et il porte une leçon qui vaut au-delà des plantes : ces six espèces atteignent la taille d'un arbre par des chemins séparés, sans descendre l'une de l'autre. « Arbre » n'est pas une famille. C'est un métier."
 ]
};

const GIL_CREATURES=[
{id:"GIL-01",site:"GIL",nom:"Wattieza",groupe:"Cladoxylopside",
 periode:"Dévonien moyen",age:"≈ 387–382 Ma",ageMin:382,ageMax:387,
 lieu:"Gilboa, État de New York, États-Unis",milieu:"Terrestre, plaine deltaïque humide",
 regime:"Photosynthèse",taille:"≈ 8 m",masse:"Non estimable",
 longevite:"Inconnue ; les troncs de cette organisation ne livrent pas de cernes lisibles",
 confLong:"Très faible",conf:"Bonne",confN:4,
 desc:"Tronc élancé à base évasée, couronné d'une touffe de rameaux ramifiés dépourvus de vraies feuilles. C'est la plante qui portait les souches de Gilboa, connues depuis 1869 et restées orphelines jusqu'en 2007.",
 prudence:"Ne pas lui dessiner de feuilles : les organes de la couronne sont des rameaux, pas des limbes. Le rattachement couronne-souche est solide, mais la hauteur exacte reste une estimation.",
 src:[["Stein et al. (2007) — Giant cladoxylopsid trees, Nature","https://www.nature.com/articles/nature05705"],
      ["Wattieza — Wikipedia","https://en.wikipedia.org/wiki/Wattieza"]],
 pack:"Gilboa — Les premières forêts",img:"cartes/GIL-01.webp"},

{id:"GIL-02",site:"GIL",nom:"Archaeopteris",groupe:"Progymnosperme archaeoptéridale",
 periode:"Dévonien supérieur",age:"≈ 385–359 Ma",ageMin:359,ageMax:385,
 lieu:"Amérique du Nord, Europe, Afrique du Nord",milieu:"Terrestre, bords d'eau et plaines",
 regime:"Photosynthèse",taille:"≈ 10–30 m",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Élevée",confN:5,
 desc:"Le premier végétal à réunir bois véritable, branches latérales et racines profondes ramifiées. Vu de loin, sa silhouette est déjà celle d'un arbre moderne, et ses forêts ont couvert une grande partie des continents de la fin du Dévonien.",
 prudence:"La ressemblance avec un conifère est trompeuse : c'est une progymnosperme, lignée éteinte sans descendance directe. Elle se reproduisait par spores, pas par graines.",
 src:[["Archaeopteris — Wikipedia","https://en.wikipedia.org/wiki/Archaeopteris"],
      ["Progymnospermophyta — Wikipedia","https://en.wikipedia.org/wiki/Progymnosperm"]],
 pack:"Gilboa — Les premières forêts",img:"cartes/GIL-02.webp"},

{id:"GIL-03",site:"GIL",nom:"Pseudosporochnus nodosus",groupe:"Cladoxylopside",
 periode:"Dévonien moyen",age:"≈ 391–383 Ma",ageMin:383,ageMax:391,
 lieu:"Bohême, République tchèque, et Europe occidentale",milieu:"Terrestre humide",
 regime:"Photosynthèse",taille:"≈ 3 m",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Tronc mince surmonté d'une couronne largement étalée en parasol, portée par des rameaux qui se divisent par trois. Une architecture d'arbre obtenue sans bois véritable.",
 prudence:"Sa base était probablement soutenue par un manchon de racines adventives plutôt que par un tronc rigide, comme chez certaines fougères arborescentes actuelles.",
 src:[["Pseudosporochnus — Wikipedia","https://en.wikipedia.org/wiki/Pseudosporochnus"],
      ["Cladoxylopsida — Wikipedia","https://en.wikipedia.org/wiki/Cladoxylopsida"]],
 pack:"Gilboa — Les premières forêts",img:"cartes/GIL-03.webp"},

{id:"GIL-04",site:"GIL",nom:"Pertica quadrifaria",groupe:"Trimérophyte",
 periode:"Dévonien inférieur",age:"≈ 400–390 Ma",ageMin:390,ageMax:400,
 lieu:"Maine, États-Unis",milieu:"Terrestre, sols humides",
 regime:"Photosynthèse",taille:"≈ 3 m",masse:"Non estimable",
 longevite:"Inconnue ; sans objet pour une plante de cette organisation",
 confLong:"Sans objet",conf:"Moyenne",confN:3,
 desc:"Axe principal droit portant des rameaux latéraux disposés en quatre rangs, dont certains terminés par des sporanges groupés. Une étape entre la tige nue du Silurien et l'architecture d'un arbre.",
 prudence:"Toujours pas de vraies feuilles ni de bois : c'est la ramification qui progresse, pas encore le tissu de soutien. Elle n'est l'ancêtre direct d'aucun des autres végétaux de ce chantier.",
 src:[["Pertica — Wikipedia","https://en.wikipedia.org/wiki/Pertica"],
      ["Trimerophytopsida — Wikipedia","https://en.wikipedia.org/wiki/Trimerophytopsida"]],
 pack:"Gilboa — Les premières forêts",img:"cartes/GIL-04.webp"},

{id:"GIL-05",site:"GIL",nom:"Cyclostigma kiltorkense",groupe:"Lycophyte arborescente",
 periode:"Dévonien supérieur",age:"≈ 372–359 Ma",ageMin:359,ageMax:372,
 lieu:"Kiltorcan, Irlande",milieu:"Terrestre, plaines inondables",
 regime:"Photosynthèse",taille:"≈ 8 m",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Tronc dressé en colonne, couvert de cicatrices foliaires régulières laissées par la chute des feuilles, couronné d'un bouquet terminal. Elle emprunte une troisième voie vers la taille d'un arbre.",
 prudence:"Le tronc d'une lycophyte n'est pas fait de bois mais d'une écorce épaissie autour d'un cylindre central étroit : une colonne creuse plutôt qu'une poutre pleine.",
 src:[["Cyclostigma — Wikipedia","https://en.wikipedia.org/wiki/Cyclostigma"],
      ["Lepidodendrales — Wikipedia","https://en.wikipedia.org/wiki/Lepidodendrales"]],
 pack:"Gilboa — Les premières forêts",img:"cartes/GIL-05.webp"},

{id:"GIL-06",site:"GIL",nom:"Aneurophyton",groupe:"Progymnosperme aneurophytale",
 periode:"Dévonien moyen",age:"≈ 391–383 Ma",ageMin:383,ageMax:391,
 lieu:"Gilboa, État de New York, et Europe",milieu:"Terrestre humide",
 regime:"Photosynthèse",taille:"≈ 2–3 m",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Moyenne",confN:3,
 desc:"Plante buissonnante à ramification dense, plus modeste que ses voisines, mais qui produit déjà du bois véritable. C'est l'un des plus anciens végétaux à en fabriquer.",
 prudence:"Sa silhouette est peu spectaculaire et sa reconstitution repose sur des fragments assemblés. Son intérêt est chronologique, non visuel : le bois précède l'arbre.",
 src:[["Aneurophyton — Wikipedia","https://en.wikipedia.org/wiki/Aneurophyton"],
      ["Aneurophytales — Wikipedia","https://en.wikipedia.org/wiki/Aneurophytales"]],
 pack:"Gilboa — Les premières forêts",img:"cartes/GIL-06.webp"}
];

const GIL_Q=[
{id:"GIL-Q01",site:"GIL",diff:"facile",
 q:"Dans quel État américain se trouve Gilboa ?",
 choix:["Dans l’État de New York","En Californie","Au Texas","Au Montana"],r:"Dans l’État de New York",
 exp:"Dans les Catskills, à quelque deux cents kilomètres au nord de la ville de New York.",
 src:["Gilboa Fossil Forest — Wikipedia","https://en.wikipedia.org/wiki/Gilboa_Fossil_Forest"]},

{id:"GIL-Q02",site:"GIL",diff:"moyen",
 q:"Comment les souches de Gilboa ont-elles été découvertes en 1869 ?",
 choix:["Une crue a emporté un pont et mis le grès à nu","Par un forage pétrolier","Lors du creusement d’un canal","Par une équipe universitaire en prospection"],
 r:"Une crue a emporté un pont et mis le grès à nu",
 exp:"Des dizaines de souches pétrifiées, manifestement en place. Beaucoup de grandes découvertes tiennent à un accident de terrain plutôt qu’à une recherche dirigée.",
 src:["Gilboa Fossil Forest — Wikipedia","https://en.wikipedia.org/wiki/Gilboa_Fossil_Forest"]},

{id:"GIL-Q03",site:"GIL",diff:"difficile",
 q:"Combien de temps a-t-il fallu pour savoir quelle plante portait les souches de Gilboa ?",
 choix:["Environ cent quarante ans","Deux ans","Une vingtaine d’années","On ne le sait toujours pas"],
 r:"Environ cent quarante ans",
 exp:"Découvertes en 1869, rattachées à Wattieza en 2007, quand on a enfin trouvé une couronne encore reliée à un tronc. On avait le pied de l’arbre sans savoir ce qui poussait dessus.",
 src:["Stein et al. (2007) — Nature","https://www.nature.com/articles/nature05705"]},

{id:"GIL-Q04",site:"GIL",diff:"moyen",
 q:"Qu’avait Wattieza au sommet de son tronc ?",
 choix:["Une touffe de rameaux ramifiés, sans vraies feuilles","Un bouquet de larges feuilles plates","Des cônes ligneux","Des fleurs"],
 r:"Une touffe de rameaux ramifiés, sans vraies feuilles",
 exp:"Le limbe des feuilles modernes n’existe pas encore. Un arbre de huit mètres, mais rien qui ressemble au feuillage qu’on lui prêterait spontanément.",
 src:["Wattieza — Wikipedia","https://en.wikipedia.org/wiki/Wattieza"]},

{id:"GIL-Q05",site:"GIL",diff:"moyen",
 q:"Qu’a Archaeopteris que Wattieza n’a pas ?",
 choix:["Du bois véritable et des racines profondes","Des fleurs","Des graines","Une écorce épaisse"],
 r:"Du bois véritable et des racines profondes",
 exp:"C’est la combinaison qui fait basculer la planète : le bois permet la hauteur durable, les racines profondes fabriquent du sol.",
 src:["Archaeopteris — Wikipedia","https://en.wikipedia.org/wiki/Archaeopteris"]},

{id:"GIL-Q06",site:"GIL",diff:"difficile",
 q:"Archaeopteris ressemble beaucoup à un conifère. Quel est son lien avec eux ?",
 choix:["Aucun lien direct : c’est une progymnosperme, lignée éteinte","C’est le premier conifère","C’est l’ancêtre de tous les arbres actuels","C’est une fougère géante"],
 r:"Aucun lien direct : c’est une progymnosperme, lignée éteinte",
 exp:"Elle se reproduit par spores, pas par graines. La silhouette est familière, la parenté ne l’est pas — comme Thylacosmilus qui ressemble à un félin sans en être un.",
 src:["Progymnosperm — Wikipedia","https://en.wikipedia.org/wiki/Progymnosperm"]},

{id:"GIL-Q07",site:"GIL",diff:"difficile",
 q:"Comment des racines profondes peuvent-elles refroidir la planète ?",
 choix:["Elles accélèrent l’altération des roches, qui consomme du CO₂","Elles réfléchissent la lumière du soleil","Elles libèrent de la vapeur d’eau","Elles enfouissent directement le carbone"],
 r:"Elles accélèrent l’altération des roches, qui consomme du CO₂",
 exp:"Une racine fend la roche et retient l’eau ; l’altération chimique des silicates qui s’ensuit piège du dioxyde de carbone. À l’échelle des continents, la végétation devient un levier climatique.",
 src:["Devonian — Wikipedia","https://en.wikipedia.org/wiki/Devonian"]},

{id:"GIL-Q08",site:"GIL",diff:"difficile",
 q:"Qu’ont changé les premières forêts à la forme des rivières ?",
 choix:["Elles ont permis des méandres stables entre des berges tenues","Elles les ont fait disparaître","Elles les ont rendues souterraines","Elles n’ont rien changé"],
 r:"Elles ont permis des méandres stables entre des berges tenues",
 exp:"Avant les racines, les rivières divaguaient en larges tresses de sable mouvant. Une berge tenue par des racines peut creuser au lieu de s’étaler — la végétation dessine le paysage.",
 src:["Devonian — Wikipedia","https://en.wikipedia.org/wiki/Devonian"]},

{id:"GIL-Q09",site:"GIL",diff:"moyen",
 q:"Quelle est la silhouette de Pseudosporochnus ?",
 choix:["Un tronc mince surmonté d’une couronne en parasol","Une colonne trapue sans branches","Un buisson rampant","Une liane grimpante"],
 r:"Un tronc mince surmonté d’une couronne en parasol",
 exp:"Une architecture d’arbre obtenue sans bois véritable, par des rameaux qui se divisent par trois. Il y avait plusieurs manières d’être grand.",
 src:["Pseudosporochnus — Wikipedia","https://en.wikipedia.org/wiki/Pseudosporochnus"]},

{id:"GIL-Q10",site:"GIL",diff:"difficile",
 q:"Comment un cladoxylopside comme Pseudosporochnus tenait-il debout sans bois ?",
 choix:["Par un manchon de racines adventives à la base","Par un tronc creux rempli d’eau","En s’appuyant sur ses voisins","Par des haubans souterrains"],
 r:"Par un manchon de racines adventives à la base",
 exp:"La même solution que certaines fougères arborescentes actuelles. La rigidité peut venir de l’extérieur plutôt que d’un cœur ligneux.",
 src:["Cladoxylopsida — Wikipedia","https://en.wikipedia.org/wiki/Cladoxylopsida"]},

{id:"GIL-Q11",site:"GIL",diff:"moyen",
 q:"Que représente Pertica quadrifaria dans cette histoire ?",
 choix:["Une étape entre la tige nue et l’architecture d’arbre","Le premier arbre à graines","La plus grande plante du Dévonien","Une plante aquatique"],
 r:"Une étape entre la tige nue et l’architecture d’arbre",
 exp:"Un axe droit portant des rameaux latéraux en quatre rangs. Toujours ni feuilles ni bois : ce qui progresse d’abord, c’est la ramification.",
 src:["Pertica — Wikipedia","https://en.wikipedia.org/wiki/Pertica"]},

{id:"GIL-Q12",site:"GIL",diff:"moyen",
 q:"Qu’est-ce qui couvre le tronc de Cyclostigma ?",
 choix:["Des cicatrices régulières laissées par la chute des feuilles","Une écorce lisse","Des épines","De la mousse fossilisée"],
 r:"Des cicatrices régulières laissées par la chute des feuilles",
 exp:"C’est la signature des lycophytes arborescentes, qu’on retrouvera en abondance dans les forêts du Carbonifère — celles qui donneront le charbon.",
 src:["Cyclostigma — Wikipedia","https://en.wikipedia.org/wiki/Cyclostigma"]},

{id:"GIL-Q13",site:"GIL",diff:"difficile",
 q:"De quoi est fait le tronc d’une lycophyte arborescente ?",
 choix:["D’une écorce épaissie autour d’un cylindre central étroit","De bois plein, comme un chêne","De fibres tressées","De tissu spongieux gorgé d’eau"],
 r:"D’une écorce épaissie autour d’un cylindre central étroit",
 exp:"Une colonne creuse plutôt qu’une poutre pleine. C’est pourquoi ces troncs se retrouvent souvent aplatis dans la roche, ou conservés comme des moules vides.",
 src:["Lepidodendrales — Wikipedia","https://en.wikipedia.org/wiki/Lepidodendrales"]},

{id:"GIL-Q14",site:"GIL",diff:"moyen",
 q:"Quel est l’intérêt principal d’Aneurophyton, plutôt discret ?",
 choix:["C’est l’un des plus anciens végétaux à fabriquer du bois","C’est le plus grand du chantier","C’est le seul à porter des fleurs","C’est le mieux conservé"],
 r:"C’est l’un des plus anciens végétaux à fabriquer du bois",
 exp:"Buissonnant, deux ou trois mètres, sans allure. Mais il montre que le bois apparaît avant l’arbre : l’invention précède l’usage spectaculaire qu’on en fera.",
 src:["Aneurophyton — Wikipedia","https://en.wikipedia.org/wiki/Aneurophyton"]},

{id:"GIL-Q15",site:"GIL",diff:"difficile",
 q:"Les six végétaux de ce chantier atteignent la taille d’un arbre. Que faut-il en conclure ?",
 choix:["« Arbre » est une architecture, pas une famille","Ils descendent tous d’un même ancêtre arborescent","Le plus ancien est l’ancêtre des autres","Ils appartiennent tous aux progymnospermes"],
 r:"« Arbre » est une architecture, pas une famille",
 exp:"Cladoxylopsides, progymnospermes, trimérophytes, lycophytes : quatre lignées séparées y arrivent par des chemins différents. C’est la convergence, appliquée aux plantes.",
 src:["Devonian — Wikipedia","https://en.wikipedia.org/wiki/Devonian"]},

{id:"GIL-Q16",site:"GIL",diff:"moyen",
 q:"Comment se reproduisaient les végétaux de ce chantier ?",
 choix:["Par spores","Par graines","Par boutures uniquement","Par fleurs pollinisées"],
 r:"Par spores",
 exp:"Les graines apparaissent à la toute fin du Dévonien, les fleurs bien plus tard encore — tu les trouveras au chantier de Yixian, cent trente millions d’années après.",
 src:["Devonian — Wikipedia","https://en.wikipedia.org/wiki/Devonian"]},

{id:"GIL-Q17",site:"GIL",diff:"facile",
 q:"À quelle période appartiennent les premières vraies forêts ?",
 choix:["Au Dévonien","Au Cambrien","Au Jurassique","Au Carbonifère"],r:"Au Dévonien",
 exp:"Entre 390 et 370 millions d’années environ. Les grandes forêts à charbon du Carbonifère viennent après, et leur doivent leurs sols.",
 src:["Devonian — Wikipedia","https://en.wikipedia.org/wiki/Devonian"]},

{id:"GIL-Q18",site:"GIL",diff:"difficile",
 q:"Ce chantier ne présente pas un écosystème local comme Messel. Que présente-t-il ?",
 choix:["Une bascule à l’échelle du globe, ancrée là où on l’a comprise","Une seule espèce sous six angles","Un assemblage sans cohérence","Une faune uniquement américaine"],
 r:"Une bascule à l’échelle du globe, ancrée là où on l’a comprise",
 exp:"Les six végétaux viennent de New York, de Bohême, du Maine et d’Irlande. Gilboa sert d’ancrage parce que c’est là que les souches ont posé la question.",
 src:["Gilboa Fossil Forest — Wikipedia","https://en.wikipedia.org/wiki/Gilboa_Fossil_Forest"]},

{id:"GIL-Q19",site:"GIL",diff:"moyen",
 q:"Pourquoi n’estime-t-on pas la longévité de ces arbres, alors qu’on compte les cernes des arbres actuels ?",
 choix:["Leurs troncs ne livrent pas de cernes lisibles","Ils vivaient moins d’un an","Les cernes n’existaient pas encore","Personne n’a essayé"],
 r:"Leurs troncs ne livrent pas de cernes lisibles",
 exp:"Les cernes annuels supposent une saisonnalité marquée et une croissance en épaisseur régulière. La fiche affiche donc « inconnue » plutôt qu’un chiffre plausible mais inventé.",
 src:["Archaeopteris — Wikipedia","https://en.wikipedia.org/wiki/Archaeopteris"]},

{id:"GIL-Q20",site:"GIL",diff:"difficile",
 q:"Qu’est-ce qui rend ce chantier important au-delà de la botanique ?",
 choix:["Les plantes y modifient le climat, les sols et les rivières","Elles y deviennent comestibles","Elles y produisent le premier oxygène","Elles y apparaissent pour la première fois"],
 r:"Les plantes y modifient le climat, les sols et les rivières",
 exp:"C’est l’un des rares moments où l’on voit un groupe d’êtres vivants transformer la planète elle-même. La vie ne fait pas que subir son décor : ici, elle le refait.",
 src:["Devonian — Wikipedia","https://en.wikipedia.org/wiki/Devonian"]}
];

(function insererChronologiquement(s){
  const debut=x=>parseFloat(String(x.age).replace(',','.').match(/[\d.]+/)[0]);
  const i=SITES.findIndex(x=>debut(x)<debut(s));
  SITES.splice(i<0?SITES.length:i, 0, s);
})(GIL_SITE);
CREATURES.push(...GIL_CREATURES);
QUIZ_PALEO.push(...GIL_Q);

/* ================================================================
   Bloc 15 : extension du site YIX — les premières fleurs.

   Les cinq plantes livrées viennent toutes de la formation de Yixian,
   qui est déjà un chantier de l'atlas. Elles l'étendent donc, comme
   les échinodermes ont étendu le Hunsrück : même gisement, même
   épingle, un second thème. Yixian passe de 8 à 13 créatures et de
   20 à 40 questions. Le champ `pack` les regroupe à part dans la
   collection.

   DEUX CORRECTIONS SUR LE LOT LIVRÉ, toutes deux vérifiées :

   1. « Sinocarpus decussatus » et « Hyrcantha decussata » sont la
      MÊME espèce. Leng & Friis l'ont décrite sous le premier nom en
      2003 ; Dilcher et coll. l'ont recombinée sous le second en 2007,
      après l'avoir rapprochée d'un fossile du Kazakhstan. Une seule
      fiche est retenue, sous le nom valide, et la synonymie devient
      une question. L'illustration en double n'est pas utilisée.

   2. « Chaoyangia beishanensis » n'existe pas. Chaoyangia beishanensis
      est un OISEAU (Hou & Zhang, 1993). La plante est Chaoyangia
      liangii (Duan, 1998), et l'épithète des deux avait été mélangée.
      Plus intéressant encore : cette plante avait été publiée comme le
      plus ancien fruit de plante à fleurs, puis réexaminée et
      reclassée parmi les gnétales — des gymnospermes. Ce n'est donc
      pas une fleur. Elle reste dans le pack pour cette raison même.
   ================================================================ */

const YIX_FLEURS=[
{id:"YIX-09",site:"YIX",nom:"Archaefructus liaoningensis",groupe:"Angiosperme basale",
 periode:"Crétacé inférieur",age:"≈ 125–122 Ma",ageMin:122,ageMax:125,
 lieu:"Formation de Yixian, Liaoning, Chine",milieu:"Aquatique, lacs peu profonds",
 regime:"Photosynthèse",taille:"≈ 50 cm",masse:"Non estimable",
 longevite:"Inconnue ; sans objet pour une plante herbacée de cette organisation",
 confLong:"Sans objet",conf:"Bonne",confN:4,
 desc:"L'une des plus anciennes plantes à fleurs connues par un individu entier, racines comprises. Ses organes reproducteurs sont portés le long d'un axe allongé, sans pétales ni sépales.",
 prudence:"L'absence de périanthe est une caractéristique de la plante, pas un défaut de conservation — mais on discute si elle est primitive ou secondairement perdue. Le mode de vie aquatique est déduit des feuilles finement découpées.",
 src:[["Archaefructus — Wikipedia","https://en.wikipedia.org/wiki/Archaefructus"],
      ["Sun et al. (2002) — Archaefructaceae, Science","https://www.science.org/doi/10.1126/science.1069439"]],
 pack:"Yixian — Les premières fleurs",img:"cartes/YIX-09.webp"},

{id:"YIX-10",site:"YIX",nom:"Archaefructus sinensis",groupe:"Angiosperme basale",
 periode:"Crétacé inférieur",age:"≈ 125–122 Ma",ageMin:122,ageMax:125,
 lieu:"Formation de Yixian, Liaoning, Chine",milieu:"Aquatique, lacs peu profonds",
 regime:"Photosynthèse",taille:"≈ 50 cm",masse:"Non estimable",
 longevite:"Inconnue ; sans objet pour une plante herbacée de cette organisation",
 confLong:"Sans objet",conf:"Bonne",confN:4,
 desc:"Seconde espèce du genre, connue par des plantes complètes de la racine à l'extrémité fertile. C'est sur ce matériel qu'a été proposée une famille nouvelle, les Archaefructacées.",
 prudence:"Le genre a été un temps présenté comme « la plus ancienne fleur », formule que les auteurs eux-mêmes n'employaient pas. D'autres angiospermes du même âge ou plus anciennes sont connues par des pollens.",
 src:[["Sun et al. (2002) — Archaefructaceae, Science","https://www.science.org/doi/10.1126/science.1069439"],
      ["Archaefructus — Wikipedia","https://en.wikipedia.org/wiki/Archaefructus"]],
 pack:"Yixian — Les premières fleurs",img:"cartes/YIX-10.webp"},

{id:"YIX-11",site:"YIX",nom:"Hyrcantha decussata",groupe:"Angiosperme eudicotylédone basale",
 periode:"Crétacé inférieur",age:"≈ 125–122 Ma",ageMin:122,ageMax:125,
 lieu:"Formation de Yixian, Liaoning et Mongolie-Intérieure, Chine",milieu:"Probablement aquatique ou de bord d'eau",
 regime:"Photosynthèse",taille:"≈ 30 cm",masse:"Non estimable",
 longevite:"Inconnue ; sans objet pour une plante herbacée de cette organisation",
 confLong:"Sans objet",conf:"Moyenne",confN:3,
 desc:"Plante dressée à tiges grêles issues d'une racine courte, portant des fruits disposés par paires croisées. Elle est connue entière, racines comprises.",
 prudence:"Elle a d'abord été décrite en 2003 sous le nom de Sinocarpus decussatus, puis recombinée en 2007 dans le genre Hyrcantha, après rapprochement avec un fossile du Kazakhstan. Les deux noms désignent la même plante ; le second est le nom valide.",
 src:[["Dilcher et al. (2007) — Hyrcantha decussata, PNAS","https://www.pnas.org/content/104/22/9370"],
      ["Leng & Friis (2003) — Sinocarpus decussatus","https://www.plantfossilnames.org/reference/1036/"]],
 pack:"Yixian — Les premières fleurs",img:"cartes/YIX-11.webp"},

{id:"YIX-12",site:"YIX",nom:"Leefructus mirus",groupe:"Angiosperme eudicotylédone",
 periode:"Crétacé inférieur",age:"≈ 123 Ma",ageMin:122,ageMax:124,
 lieu:"Dawangzhangzi, Liaoning, Chine",milieu:"Terrestre humide ou bord d'eau",
 regime:"Photosynthèse",taille:"≈ 16 cm",masse:"Non estimable",
 longevite:"Inconnue ; sans objet pour une plante herbacée de cette organisation",
 confLong:"Sans objet",conf:"Moyenne",confN:3,
 desc:"Petite plante conservée avec sa tige, ses feuilles lobées à cinq divisions et son organe fructifère terminal. Sa morphologie évoque déjà les eudicotylédones, groupe qui rassemble aujourd'hui la majorité des plantes à fleurs.",
 prudence:"Le rattachement aux eudicotylédones repose sur la forme des feuilles et du fruit ; le pollen, qui trancherait, n'est pas conservé sur le spécimen.",
 src:[["Sun et al. (2011) — Leefructus, Nature","https://www.nature.com/articles/nature09811"],
      ["Leefructus — Wikipedia","https://en.wikipedia.org/wiki/Leefructus"]],
 pack:"Yixian — Les premières fleurs",img:"cartes/YIX-12.webp"},

{id:"YIX-13",site:"YIX",nom:"Chaoyangia liangii",groupe:"Gnétale, gymnosperme",
 periode:"Crétacé inférieur",age:"≈ 125–122 Ma",ageMin:122,ageMax:125,
 lieu:"Chaoyang, Liaoning, Chine",milieu:"Terrestre, milieux ouverts",
 regime:"Photosynthèse",taille:"≈ 20 cm de rameau conservé",masse:"Non estimable",
 longevite:"Inconnue ; non estimable de façon robuste à partir des fossiles disponibles",
 confLong:"Très faible",conf:"Faible à moyenne",confN:2,
 desc:"Rameau fin à nœuds réguliers portant des organes reproducteurs groupés. Publié en 1998 comme le plus ancien fruit de plante à fleurs connu, il a depuis été réexaminé.",
 prudence:"Ce n'est pas une plante à fleurs. Les réexamens de 2000 et 2006 la rangent parmi les gnétales, des gymnospermes apparentées à l'éphédra. Elle figure dans ce pack précisément pour cela. À ne pas confondre avec Chaoyangia beishanensis, qui est un oiseau du même bassin.",
 src:[["Rydin et al. — Gnetalean megafossils, réexamen","https://www.researchgate.net/publication/268263607_A_Review_on_Gnetalean_Megafossils_Problems_and_Perspectives"],
      ["Early angiosperms of northeastern China — review","https://www.sciencedirect.com/science/article/abs/pii/S1871174X08000383"]],
 pack:"Yixian — Les premières fleurs",img:"cartes/YIX-13.webp"}
];

const YIX_FLEURS_Q=[
{id:"YIX-Q21",site:"YIX",diff:"facile",
 q:"Qu’apporte la formation de Yixian, en plus de ses dinosaures à plumes ?",
 choix:["Certaines des plus anciennes plantes à fleurs connues","Les premiers mammifères","Les premiers récifs coralliens","Les premières fourmis"],
 r:"Certaines des plus anciennes plantes à fleurs connues",
 exp:"Le même gisement, les mêmes lacs, les mêmes cendres volcaniques. Un chantier ne livre pas un thème mais tout ce qui est tombé dans l’eau.",
 src:["Archaefructus — Wikipedia","https://en.wikipedia.org/wiki/Archaefructus"]},

{id:"YIX-Q22",site:"YIX",diff:"moyen",
 q:"Qu’a de remarquable la conservation d’Archaefructus ?",
 choix:["On a la plante entière, racines comprises","On n’a que son pollen","On a seulement ses graines","On a son empreinte dans l’ambre"],
 r:"On a la plante entière, racines comprises",
 exp:"C’est rare pour un végétal fossile : on récolte le plus souvent des feuilles isolées, des fruits détachés, des fragments de tige. Ici la plante tient sur une dalle.",
 src:["Sun et al. (2002) — Science","https://www.science.org/doi/10.1126/science.1069439"]},

{id:"YIX-Q23",site:"YIX",diff:"moyen",
 q:"Que manque-t-il aux fleurs d’Archaefructus ?",
 choix:["Les pétales et les sépales","Les étamines","Les graines","Les racines"],
 r:"Les pétales et les sépales",
 exp:"Les organes reproducteurs sont portés le long d’un axe allongé, sans enveloppe colorée. Une plante à fleurs n’a pas besoin de ressembler à une fleur de jardin.",
 src:["Archaefructus — Wikipedia","https://en.wikipedia.org/wiki/Archaefructus"]},

{id:"YIX-Q24",site:"YIX",diff:"difficile",
 q:"Pourquoi pense-t-on qu’Archaefructus vivait dans l’eau ?",
 choix:["Ses feuilles sont finement découpées, comme celles des plantes aquatiques","On l’a trouvée avec des poissons","Ses racines sont absentes","Ses graines flottent"],
 r:"Ses feuilles sont finement découpées, comme celles des plantes aquatiques",
 exp:"C’est une déduction par comparaison avec des plantes actuelles, pas une observation. La fiche l’indique : le milieu de vie est le point le moins assuré.",
 src:["Archaefructus — Wikipedia","https://en.wikipedia.org/wiki/Archaefructus"]},

{id:"YIX-Q25",site:"YIX",diff:"difficile",
 q:"On a présenté Archaefructus comme « la plus ancienne fleur ». Que vaut cette formule ?",
 choix:["Elle est excessive : des angiospermes plus anciennes sont connues par leur pollen","Elle est exacte et admise","Elle est fausse, c’est une gymnosperme","Elle vient des auteurs de l’étude"],
 r:"Elle est excessive : des angiospermes plus anciennes sont connues par leur pollen",
 exp:"Le pollen fossile recule l’apparition des plantes à fleurs bien avant ces spécimens. Archaefructus est l’une des plus anciennes connues par une plante entière — ce qui n’est pas la même chose.",
 src:["Sun et al. (2002) — Science","https://www.science.org/doi/10.1126/science.1069439"]},

{id:"YIX-Q26",site:"YIX",diff:"difficile",
 q:"Hyrcantha decussata a d’abord été nommée Sinocarpus decussatus. Que s’est-il passé ?",
 choix:["Elle a été rapprochée d’un fossile du Kazakhstan et rattachée à son genre","Le premier nom était mal orthographié","Deux plantes différentes ont été confondues","Le premier auteur s’est rétracté"],
 r:"Elle a été rapprochée d’un fossile du Kazakhstan et rattachée à son genre",
 exp:"Décrite en 2003, recombinée en 2007. Un nom d’espèce n’est pas une étiquette définitive : il enregistre l’état d’une comparaison, et il change quand la comparaison change.",
 src:["Dilcher et al. (2007) — PNAS","https://www.pnas.org/content/104/22/9370"]},

{id:"YIX-Q27",site:"YIX",diff:"moyen",
 q:"Que faut-il faire quand une espèce est connue sous deux noms ?",
 choix:["Employer le nom valide, en signalant l’ancien","Employer les deux indifféremment","Choisir le plus ancien toujours","Attendre un troisième nom"],
 r:"Employer le nom valide, en signalant l’ancien",
 exp:"Sinon on croit avoir affaire à deux plantes là où il n’y en a qu’une. Beaucoup de listes de fossiles comptent en double pour cette raison exacte.",
 src:["Dilcher et al. (2007) — PNAS","https://www.pnas.org/content/104/22/9370"]},

{id:"YIX-Q28",site:"YIX",diff:"moyen",
 q:"Qu’est-ce qui rattache Leefructus mirus aux eudicotylédones ?",
 choix:["La forme lobée de ses feuilles et son organe fructifère","Son pollen conservé","Ses racines","Sa taille"],
 r:"La forme lobée de ses feuilles et son organe fructifère",
 exp:"Les eudicotylédones rassemblent aujourd’hui la majorité des plantes à fleurs. Le pollen trancherait mieux, mais il n’est pas conservé sur ce spécimen — la fiche le dit.",
 src:["Sun et al. (2011) — Nature","https://www.nature.com/articles/nature09811"]},

{id:"YIX-Q29",site:"YIX",diff:"difficile",
 q:"Chaoyangia liangii a été publiée en 1998 comme quoi ?",
 choix:["Le plus ancien fruit de plante à fleurs connu","Un nouveau conifère","Une algue d’eau douce","Une fougère aquatique"],
 r:"Le plus ancien fruit de plante à fleurs connu",
 exp:"Le titre était considérable, et il n’a pas tenu. Des réexamens en 2000 puis 2006 la rangent parmi les gnétales — des gymnospermes, apparentées à l’éphédra.",
 src:["Early angiosperms of northeastern China — review","https://www.sciencedirect.com/science/article/abs/pii/S1871174X08000383"]},

{id:"YIX-Q30",site:"YIX",diff:"difficile",
 q:"Pourquoi garder Chaoyangia dans un pack consacré aux premières fleurs ?",
 choix:["Parce qu’une revendication démentie fait partie de l’histoire","Par erreur de classement","Parce qu’elle est jolie","Parce qu’elle redeviendra peut-être une fleur"],
 r:"Parce qu’une revendication démentie fait partie de l’histoire",
 exp:"Comme Darwinius à Messel. Retirer discrètement ce qui s’est révélé faux donnerait l’image d’une science qui ne se trompe jamais, ce qui est la plus trompeuse des images.",
 src:["Early angiosperms of northeastern China — review","https://www.sciencedirect.com/science/article/abs/pii/S1871174X08000383"]},

{id:"YIX-Q31",site:"YIX",diff:"moyen",
 q:"Que sont les gnétales, auxquelles Chaoyangia est aujourd’hui rattachée ?",
 choix:["Des gymnospermes, apparentées à l’éphédra","Des fougères","Des mousses","Des algues vertes"],
 r:"Des gymnospermes, apparentées à l’éphédra",
 exp:"Elles portent des organes reproducteurs groupés qui ressemblent superficiellement à des fleurs. C’est cette ressemblance qui a causé la méprise initiale.",
 src:["Rydin et al. — Gnetalean megafossils","https://www.researchgate.net/publication/268263607_A_Review_on_Gnetalean_Megafossils_Problems_and_Perspectives"]},

{id:"YIX-Q32",site:"YIX",diff:"difficile",
 q:"Il existe aussi un Chaoyangia beishanensis. De quoi s’agit-il ?",
 choix:["D’un oiseau du même bassin","D’une seconde espèce de la même plante","D’un poisson","D’un nom invalide"],
 r:"D’un oiseau du même bassin",
 exp:"Les plantes et les animaux relèvent de codes de nomenclature séparés : un même nom de genre peut donc exister deux fois, sans lien. C’est une source d’erreurs classique.",
 src:["Chaoyangia — Wikipedia","https://en.wikipedia.org/wiki/Chaoyangia"]},

{id:"YIX-Q33",site:"YIX",diff:"moyen",
 q:"À quelle époque apparaissent les plantes à fleurs, d’après ce chantier ?",
 choix:["Au Crétacé inférieur, il y a environ 125 millions d’années","Au Dévonien","Au Jurassique supérieur","Au Paléogène"],
 r:"Au Crétacé inférieur, il y a environ 125 millions d’années",
 exp:"Soit très tard dans l’histoire des plantes : deux cent cinquante millions d’années après les premières forêts de Gilboa. Les fleurs sont une invention récente.",
 src:["Archaefructus — Wikipedia","https://en.wikipedia.org/wiki/Archaefructus"]},

{id:"YIX-Q34",site:"YIX",diff:"difficile",
 q:"Ces plantes ont vécu en même temps que les dinosaures à plumes du même chantier. Qu’est-ce que cela permet ?",
 choix:["Reconstituer un écosystème entier, faune et flore","Dater les dinosaures par les fleurs","Prouver que les dinosaures mangeaient des fleurs","Rien de particulier"],
 r:"Reconstituer un écosystème entier, faune et flore",
 exp:"C’est la valeur d’un gisement à conservation exceptionnelle : non pas des espèces isolées, mais un décor complet. Yutyrannus et Archaefructus se sont côtoyés.",
 src:["Archaefructus — Wikipedia","https://en.wikipedia.org/wiki/Archaefructus"]},

{id:"YIX-Q35",site:"YIX",diff:"moyen",
 q:"Qu’est-ce qui distingue une gymnosperme d’une angiosperme ?",
 choix:["L’ovule est nu chez l’une, enfermé dans un carpelle chez l’autre","La taille","La couleur des feuilles","La présence de racines"],
 r:"L’ovule est nu chez l’une, enfermé dans un carpelle chez l’autre",
 exp:"Gymnosperme signifie « graine nue ». C’est ce critère, et non l’allure générale, qui a fait sortir Chaoyangia du groupe des plantes à fleurs.",
 src:["Rydin et al. — Gnetalean megafossils","https://www.researchgate.net/publication/268263607_A_Review_on_Gnetalean_Megafossils_Problems_and_Perspectives"]},

{id:"YIX-Q36",site:"YIX",diff:"difficile",
 q:"Pourquoi le pollen est-il si utile pour dater l’apparition des plantes à fleurs ?",
 choix:["Il est minuscule, très résistant et produit en quantités énormes","Il est plus gros que les graines","Il ne se conserve que dans l’ambre","Il permet une datation au carbone 14"],
 r:"Il est minuscule, très résistant et produit en quantités énormes",
 exp:"Une plante entière fossilisée est un accident ; son pollen est partout. Ce qu’on sait de l’apparition des fleurs vient plus de grains microscopiques que de spécimens spectaculaires.",
 src:["Sun et al. (2002) — Science","https://www.science.org/doi/10.1126/science.1069439"]},

{id:"YIX-Q37",site:"YIX",diff:"moyen",
 q:"Combien de temps sépare les premières forêts de Gilboa des premières fleurs de Yixian ?",
 choix:["Environ 250 millions d’années","Environ 20 millions d’années","Environ 500 millions d’années","Environ 50 millions d’années"],
 r:"Environ 250 millions d’années",
 exp:"De 375 à 125 millions d’années. L’essentiel de l’histoire des plantes terrestres se déroule avant qu’une seule fleur n’existe.",
 src:["Devonian — Wikipedia","https://en.wikipedia.org/wiki/Devonian"]},

{id:"YIX-Q38",site:"YIX",diff:"difficile",
 q:"Ces cinq plantes viennent du même gisement que les dinosaures à plumes. Pourquoi ne pas en faire un chantier séparé ?",
 choix:["Ce serait deux épingles pour un seul lieu","Elles sont trop peu nombreuses","Elles sont moins intéressantes","Le nom du site l’interdit"],
 r:"Ce serait deux épingles pour un seul lieu",
 exp:"Un chantier de l’atlas correspond à un gisement, pas à un thème. Les échinodermes du Hunsrück ont été traités de la même façon : même épingle, second groupe dans la collection.",
 src:["Archaefructus — Wikipedia","https://en.wikipedia.org/wiki/Archaefructus"]},

{id:"YIX-Q39",site:"YIX",diff:"moyen",
 q:"Que signifie « eudicotylédone » ?",
 choix:["Un grand groupe qui rassemble la majorité des plantes à fleurs actuelles","Une plante sans feuilles","Une plante aquatique","Une plante à graine unique"],
 r:"Un grand groupe qui rassemble la majorité des plantes à fleurs actuelles",
 exp:"Chênes, roses, tournesols, haricots en font partie. Trouver des eudicotylédones dès 123 millions d’années montre que la diversification a été rapide.",
 src:["Sun et al. (2011) — Nature","https://www.nature.com/articles/nature09811"]},

{id:"YIX-Q40",site:"YIX",diff:"difficile",
 q:"Quel enseignement commun tirer de Chaoyangia et de Darwinius, à Messel ?",
 choix:["Une annonce spectaculaire n’est pas une démonstration","Les fossiles chinois sont peu fiables","Les revues scientifiques se trompent souvent","Il faut se méfier des plantes fossiles"],
 r:"Une annonce spectaculaire n’est pas une démonstration",
 exp:"Le plus ancien fruit de plante à fleurs, le chaînon manquant : deux titres considérables, deux réfutations en quelques années. Les fossiles n’avaient rien promis.",
 src:["Early angiosperms of northeastern China — review","https://www.sciencedirect.com/science/article/abs/pii/S1871174X08000383"]}
];

CREATURES.push(...YIX_FLEURS);
QUIZ_PALEO.push(...YIX_FLEURS_Q);

/* ================================================================
   Bloc 3 : générateurs de questions et déclaration des packs.
   Un générateur reçoit un niveau (1..3) et renvoie
   {q, r, choix?, exp, indice?}. Sans « choix », la réponse est saisie.
   ================================================================ */

const rndA=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick=a=>a[rndA(0,a.length-1)];
function melangeA(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=rndA(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
/* Distracteurs numériques plausibles autour de la bonne réponse. */
function distNum(r){
  const e=Math.max(2,Math.round(Math.abs(r)*0.15)+2);const s=new Set([r]);let g=0;
  while(s.size<4&&g<80){let d=r+rndA(-e,e);if(Math.abs(d-r)<1e-9)continue;s.add(Math.round(d*100)/100);g++;}
  let k=1;while(s.size<4){s.add(r+k);k++;}
  return [...s].filter(x=>Math.abs(x-r)>1e-9).slice(0,3);
}
function qcmNum(q,r,exp,indice){
  const rr=Math.round(r*100)/100;
  return {q,r:String(rr),choix:melangeA([String(rr),...distNum(rr).map(String)]),exp,indice};
}
function pgcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a;}

/* ---- Mathématiques fondamentales ---- */
const GEN_MATHS=[
 {nom:'Priorités opératoires',niv:1,gen:n=>{
   const a=rndA(2,9),b=rndA(2,9),c=rndA(2,9);
   if(n>=2){const d=rndA(2,6);const r=a+b*c-d;
     return qcmNum(`Calcule : ${a} + ${b} × ${c} − ${d}`,r,"La multiplication se fait avant l’addition et la soustraction.","Commence par ce qui est multiplié.");}
   const r=a+b*c;
   return qcmNum(`Calcule : ${a} + ${b} × ${c}`,r,`On multiplie d’abord : ${b} × ${c} = ${b*c}, puis on ajoute ${a}.`,"Le × passe avant le +.");}},
 {nom:'Parenthèses',niv:2,gen:n=>{
   const a=rndA(3,12),b=rndA(2,9),c=rndA(2,9);const r=(a+b)*c;
   return qcmNum(`Calcule : (${a} + ${b}) × ${c}`,r,`Les parenthèses d’abord : ${a}+${b}=${a+b}, puis ×${c}.`);}},
 {nom:'Pourcentage d’un nombre',niv:1,gen:n=>{
   const p=pick(n>=2?[7,12,15,18,23,35,45]:[10,20,25,50,75]);const v=pick([80,120,150,200,240,360,450,600]);
   const r=Math.round(p*v)/100;
   return qcmNum(`Combien font ${p} % de ${v} ?`,r,`${p} % de ${v} = ${v} × ${p}/100 = ${r}.`,"Un pourcentage, c’est une division par 100.");}},
 {nom:'Augmentation en pourcentage',niv:2,gen:n=>{
   const p=pick([5,8,12,15,20,25]);const v=pick([40,80,120,160,240,320]);
   const r=Math.round(v*(1+p/100)*100)/100;
   return qcmNum(`Un prix de ${v} € augmente de ${p} %. Quel est le nouveau prix ?`,r,
     `Augmenter de ${p} %, c’est multiplier par ${(1+p/100).toFixed(2)}. ${v} × ${(1+p/100).toFixed(2)} = ${r} €.`,
     "Multiplier par 1 + p/100 évite de calculer la hausse séparément.");}},
 {nom:'Réduction en pourcentage',niv:2,gen:n=>{
   const p=pick([10,15,20,25,30,40]);const v=pick([60,80,140,200,250,300]);
   const r=Math.round(v*(1-p/100)*100)/100;
   return qcmNum(`Un article à ${v} € est soldé à −${p} %. Combien coûte-t-il ?`,r,
     `Réduire de ${p} %, c’est multiplier par ${(1-p/100).toFixed(2)}. Résultat : ${r} €.`);}},
 {nom:'Retrouver le pourcentage',niv:3,gen:n=>{
   const v=pick([200,250,400,500,800]);const p=pick([6,12,18,24,36]);const part=Math.round(v*p/100);
   return qcmNum(`Sur ${v} spécimens, ${part} sont complets. Quel pourcentage cela représente-t-il ?`,p,
     `${part} / ${v} = ${(part/v).toFixed(2)}, soit ${p} %.`,"Divise la partie par le total, puis multiplie par 100.");}},
 {nom:'Règle de trois',niv:1,gen:n=>{
   const u=rndA(3,9),prix=rndA(4,15)*u,k=rndA(2,7);
   const r=prix/u*k;
   return qcmNum(`${u} carottes de sédiment coûtent ${prix} €. Combien coûtent ${k} carottes ?`,r,
     `Une carotte coûte ${prix}/${u} = ${prix/u} €. Pour ${k} : ${r} €.`,"Passe d’abord par le prix d’une seule unité.");}},
 {nom:'Échelle et proportion',niv:2,gen:n=>{
   const ech=pick([25000,50000,100000]);const cm=pick([2,3.5,4,4.6,6,7.2]);
   const r=Math.round(cm*ech/100000*1000)/1000;
   return qcmNum(`Sur une carte au 1:${ech.toLocaleString('fr-FR').replace(/\u202f|\s/g,' ')}, deux points sont distants de ${String(cm).replace('.',',')} cm. Quelle distance réelle, en kilomètres ?`,r,
     `1 cm représente ${ech/100000} km. ${String(cm).replace('.',',')} × ${ech/100000} = ${String(r).replace('.',',')} km.`,
     "Commence par déterminer ce que représente 1 cm.");}},
 {nom:'Fraction d’une quantité',niv:1,gen:n=>{
   const d=pick([3,4,5,6,8]);const num=rndA(1,d-1);const q=d*rndA(4,20);
   const r=q*num/d;
   return qcmNum(`Combien font ${num}/${d} de ${q} ?`,r,`${q} ÷ ${d} = ${q/d}, puis × ${num} = ${r}.`);}},
 {nom:'Somme de fractions',niv:2,gen:n=>{
   const a=rndA(1,5),b=pick([2,3,4,6]),c=rndA(1,5),d=pick([2,3,4,6]);
   const num=a*d+c*b, den=b*d, g=pgcd(num,den);
   return {q:`Calcule ${a}/${b} + ${c}/${d} et donne le résultat sous forme de fraction irréductible.`,
     r:(num/g)+'/'+(den/g),
     exp:`Dénominateur commun ${den} : ${a*d}/${den} + ${c*b}/${den} = ${num}/${den}, simplifié en ${num/g}/${den/g}.`,
     indice:"Mets les deux fractions au même dénominateur avant d’additionner."};}},
 {nom:'Simplifier une fraction',niv:2,gen:n=>{
   const g=pick([3,4,6,7,8,9,12]);const a=rndA(2,9)*g,b=rndA(2,9)*g;
   const k=pgcd(a,b);
   return {q:`Simplifie la fraction ${a}/${b}.`,r:(a/k)+'/'+(b/k),
     exp:`Le PGCD de ${a} et ${b} est ${k}. On divise les deux termes par ${k}.`,
     indice:"Cherche le plus grand nombre qui divise les deux termes."};}},
 {nom:'Conversions',niv:1,gen:n=>{
   const T=[['km','m',1000],['m','cm',100],['cm','mm',10],['kg','g',1000],['L','mL',1000],['h','min',60],['t','kg',1000]];
   const [a,b,f]=pick(T);const v=pick([1.5,2,2.5,3,4.2,7,12,25]);
   const r=Math.round(v*f*100)/100;
   return qcmNum(`Convertis ${String(v).replace('.',',')} ${a} en ${b}.`,r,`1 ${a} = ${f} ${b}, donc ${String(v).replace('.',',')} × ${f} = ${r} ${b}.`);}},
 {nom:'Conversion d’aires',niv:3,gen:n=>{
   const v=pick([2,3,5,7,12]);
   return qcmNum(`Combien de cm² y a-t-il dans ${v} m² ?`,v*10000,
     "1 m = 100 cm, donc 1 m² = 100 × 100 = 10 000 cm². Les aires suivent le carré du rapport de longueurs.",
     "Attention : le facteur n’est pas 100.");}},
 {nom:'Équation simple',niv:2,gen:n=>{
   const a=rndA(2,9),x=rndA(2,15),b=rndA(1,20);const c=a*x+b;
   return qcmNum(`Résous : ${a}x + ${b} = ${c}. Que vaut x ?`,x,
     `On retire ${b} des deux côtés : ${a}x = ${c-b}. Puis on divise par ${a} : x = ${x}.`,
     "Isole d’abord le terme en x.");}},
 {nom:'Équation à deux membres',niv:3,gen:n=>{
   const a=rndA(3,9),c=rndA(1,a-1),x=rndA(2,12),b=rndA(1,15);
   const d=(a-c)*x+b;
   return qcmNum(`Résous : ${a}x + ${b} = ${c}x + ${d}. Que vaut x ?`,x,
     `On regroupe les x : ${a-c}x = ${d-b}, donc x = ${x}.`,
     "Ramène tous les x du même côté.");}},
 {nom:'Moyenne',niv:1,gen:n=>{
   const k=pick([4,5]);const v=[];let s=0;for(let i=0;i<k;i++){const x=rndA(4,40);v.push(x);s+=x;}
   const r=Math.round(s/k*100)/100;
   return qcmNum(`Quelle est la moyenne de ${v.join(', ')} ?`,r,`Somme = ${s}, divisée par ${k} valeurs = ${r}.`);}},
 {nom:'Notation scientifique',niv:3,gen:n=>{
   const m=pick([1.2,2.5,3.4,5,6.8,9.1]);const e=rndA(5,9);
   const dev=(m*Math.pow(10,e)).toLocaleString('fr-FR',{useGrouping:true}).replace(/\u202f|\u00a0/g,' ');
   return {q:`Écris ${dev} en notation scientifique.`,
     r:String(m).replace('.',',')+' × 10^'+e,
     choix:melangeA([String(m).replace('.',',')+' × 10^'+e,String(m).replace('.',',')+' × 10^'+(e+1),
       String(m*10).replace('.',',')+' × 10^'+e,String(m).replace('.',',')+' × 10^'+(e-1)]),
     exp:`La mantisse doit être comprise entre 1 et 10 : ${String(m).replace('.',',')} × 10^${e}.`,
     indice:"Compte les déplacements de la virgule."};}},
 {nom:'Ordre de grandeur géologique',niv:2,gen:n=>{
   /* Les créatures du Quaternaire sont datées en fractions de million
      d'années : arrondies, elles donnaient « il y a environ 0 millions
      d'années » et quatre distracteurs tous égaux à zéro. On ne tire donc
      que parmi celles dont l'âge s'exprime en millions d'années entiers. */
   const pool=CREATURES.filter(x=>(x.ageMin+x.ageMax)/2>=2);
   const c=pick(pool);const ma=Math.round((c.ageMin+c.ageMax)/2);
   const r=ma*1000000;
   return {q:`${c.nom} vit il y a environ ${ma} millions d’années. Combien d’années cela fait-il ?`,
     r:String(r),
     choix:melangeA([String(r),String(ma*1000),String(ma*100000),String(ma*1000000000)]),
     exp:`Un million vaut 10⁶, donc ${ma} Ma = ${ma} × 1 000 000 = ${r.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g,' ')} ans.`,
     indice:"« Ma » se lit « millions d’années »."};}},
 {nom:'Durée entre deux âges',niv:2,gen:n=>{
   /* Même précaution : deux créatures pléistocènes donneraient un écart nul. */
   const pool=CREATURES.filter(x=>x.ageMax>=2);
   let a=pick(pool),b=pick(pool);let g=0;
   while(Math.abs(a.ageMax-b.ageMax)<5&&g<30){b=pick(pool);g++;}
   const r=Math.round(Math.abs(a.ageMax-b.ageMax));
   return qcmNum(`${a.nom} est daté de ${a.ageMax} Ma, ${b.nom} de ${b.ageMax} Ma. Combien de millions d’années les séparent ?`,r,
     `|${a.ageMax} − ${b.ageMax}| = ${r} millions d’années.`);}}
];

/* ---- Déclaration des packs ----
   La Bourse ne contient QUE des packs d'entraînement et d'histoire.
   Les questions paléontologiques par site ne sont plus un pack : elles
   servent de droit d'entrée à chaque coup de pioche, dans l'onglet Fouille.
   type 'gen'  : questions générées à l'infini, niveau croissant.
   type 'bank' : banque finie, maîtrise par répétition espacée. */
const PACKS=[
/* Deux familles, deux objectifs distincts.
   'histoire' : intérêt personnel, délibérément au-dessus du programme scolaire.
   'ecole'    : accompagner un élève de secondaire inférieur (12-15 ans), au niveau
                du programme et pas en dessous. Chaque pack scolaire le dit dans son
                objectif, pour qu'on sache ce qu'on ouvre.
   L'ordre place l'intérêt personnel devant : voir la philosophie en tête plutôt
   qu'un exercice de conjugaison change ce que l'application a l'air d'être. */
 {id:'philomonde',nom:'Philosophie hors d’Europe',ico:'🌐',type:'bank',cat:'histoire',
  sous:'Ce que le canon a laissé dehors',
  objectif:"Lire quelques traditions philosophiques non européennes, et voir comment la frontière du canon a été tracée.",
  bank:()=>PHILO_MONDE,
  theorie:"CE PACK NE FAIT PAS L'INVENTAIRE D'UN EXOTISME. Il pose deux questions à la fois : que dit-on ailleurs, et pourquoi ne l'apprend-on pas ?\n\nDES ANTÉRIORITÉS QUI DÉRANGENT LE RÉCIT. L'homme volant d'Avicenne, au XIᵉ siècle, montre qu'un être privé de toute sensation saurait encore qu'il existe : le cogito viendra six siècles plus tard. Al-Ghazali soutient vers 1095 que nous n'observons jamais la nécessité entre le feu et le coton qui brûle, seulement leur succession — Hume écrira cela vers 1740. Zhuangzi doute de pouvoir distinguer la veille du rêve dix-neuf siècles avant les Méditations. Ces textes ne sont pas des ébauches de la pensée européenne : ce sont des réponses complètes, formulées ailleurs, à des problèmes qu'on présente comme européens.\n\nUNE EXCLUSION ÉCRITE. Kant et Hegel n'ont pas ignoré l'Afrique et l'Asie ; ils les ont écartées avec des arguments, noir sur blanc. La frontière du canon est un acte, pas un constat.\n\nLE MÊME RÉFLEXE QUE DANS L'ART. Frobenius attribuait les bronzes d'Ifé à l'Atlantide parce qu'ils lui paraissaient trop accomplis pour être africains. Conti Rossini a déclaré le Hatata éthiopien apocryphe en partie parce que de telles idées ne lui semblaient pas attendues en Éthiopie. Deux disciplines, un seul préjugé — et dans les deux cas, une vraie érudition au service d'une supposition non examinée.\n\nCE QUI RESTE OUVERT. L'authenticité du Hatata n'est pas tranchée : un volume collectif de 2024 lui est consacré, et le désaccord traverse les chercheurs éthiopiens comme les occidentaux. Ce pack le dit plutôt que de choisir.\n\nET LA CATÉGORIE ELLE-MÊME. « Philosophie non européenne » range ensemble Nagarjuna, Ibn Khaldoun et les tlamatinime, qui n'ont en commun que de ne pas être grecs. La catégorie signale un manque réel, et reproduit en même temps le centre qu'elle voudrait déplacer."},
 {id:'philosophie',nom:'Philosophie des sciences',ico:'🧭',type:'bank',cat:'histoire',
  sous:'Preuve, doute, classification, révision',
  objectif:"Distinguer ce qu'un fossile montre de ce qu'on en conclut, et savoir pourquoi une science se corrige.",
  bank:()=>PHILO,
  theorie:"OBSERVER N'EST PAS INTERPRÉTER. La spirale dentaire d'Helicoprion a été parfaitement décrite dès 1899. Sa place sur l'animal a mis plus d'un siècle à se fixer. La donnée était solide, l'interprétation ouverte : ce sont deux opérations distinctes, et les confondre est la source d'erreur la plus commune.\n\nRÉFUTABILITÉ. Pour Karl Popper, une théorie est scientifique si l'on peut dire ce qui la mettrait en défaut. Une explication compatible avec n'importe quel résultat n'apprend rien. « Il y a plusieurs causes » n'est un énoncé sérieux que si l'on précise lesquelles, dans quel ordre, et pour quelle part.\n\nL'ABSENCE DE PREUVE. Ne pas trouver un fossile n'établit pas que l'animal n'existait pas. Il peut n'avoir jamais existé, n'avoir pas laissé de restes, ou n'avoir pas encore été cherché au bon endroit. Le registre fossile mesure d'abord les conditions de fossilisation.\n\nRASOIR D'OCKHAM. À pouvoir explicatif égal, préférer l'hypothèse la plus économique. C'est un principe de choix, pas une affirmation sur le monde : il ne dit pas que la nature est simple.\n\nCE QU'EST UNE ESPÈCE FOSSILE. On ne peut pas tester l'interfécondité chez des animaux morts depuis cent millions d'années. Les espèces fossiles se délimitent sur la morphologie, donc par un jugement révisable. D'où les cent trente espèces nommées par Marsh et Cope, dont une bonne part étaient des doublons.\n\nSUSPENDRE LE JUGEMENT. Devant deux hypothèses également compatibles avec les données, ne pas trancher est une position argumentée — à condition de dire ce qui manquerait pour décider. Trancher sans motif présenterait une préférence comme un résultat."},
 {id:'artmonde',nom:"Histoire de l'art — hors d'Europe",ico:'🌏',type:'bank',cat:'histoire',
  sous:'Ifé, Bénin, Song, Chola, Moche, Edo',
  objectif:"Aborder des traditions qui ont résolu les mêmes problèmes autrement, souvent plus tôt.",
  bank:()=>ART_MONDE,
  theorie:"PRINCIPE DE CE PACK. Il ne s'agit pas d'ajouter un supplément exotique au cursus, mais de constater que d'autres traditions ont traité les mêmes questions — représenter un visage, occuper l'espace, honorer un mort, figurer le divin — avec d'autres réponses, parfois des siècles plus tôt.\n\nCE QUE LE REGARD EUROPÉEN A FAIT DE CES ŒUVRES. Devant les têtes d'Ifé, en 1910, Frobenius conclut à l'Atlantide : le naturalisme lui paraissait incompatible avec une origine africaine. Devant le Grand Zimbabwe, l'archéologie officielle rhodésienne a cherché des bâtisseurs phéniciens, arabes, n'importe lesquels sauf shona. Ces hypothèses étaient savantes dans la forme et racistes dans la prémisse.\n\nCOMMENT CES OBJETS SONT ARRIVÉS ICI. Les bronzes du Bénin viennent du sac de Benin City par une expédition punitive britannique en 1897. Les restitutions ont commencé : l'Allemagne a transféré la propriété de 1 130 pièces en 2022, les Pays-Bas en ont rendu 119 en juin 2025. Le British Museum en conserve plus de neuf cents.\n\nDES SOLUTIONS TECHNIQUES AUTONOMES. Fonte à la cire perdue à Ifé et chez les Chola. Rouleaux Song sans point de fuite unique, parce qu'il n'y a pas d'observateur immobile. Miniature persane qui ouvre les murs pour tout rendre visible. Aucune n'ignore la perspective européenne : elles répondent à d'autres questions.\n\nLE MOT « PRIMITIF » suppose un stade antérieur au nôtre. Il désigne en fait des arts contemporains des cathédrales, avec leurs écoles, leurs commandes et leurs maîtres."},
 {id:'arteu',nom:"Histoire de l'art — Europe",ico:'🖼️',type:'bank',cat:'histoire',
  sous:'Le cursus tel qu’on l’enseigne ici',
  objectif:"Parcourir le canon européen, et savoir accessoirement qui l'a construit et selon quel récit.",
  bank:()=>ART_EU,
  theorie:"LE PLAN QUE TU CONNAIS N'EST PAS NEUTRE. Il vient de Giorgio Vasari, qui publie ses « Vies » en 1550 : l'art atteint un sommet antique, déchoit, renaît avec Giotto et culmine avec Michel-Ange — son ami. De lui viennent le mot « Renaissance » et l'usage de « gothique » comme insulte. Cinq siècles plus tard, nos manuels suivent encore ce fil.\n\nQUELQUES CHARNIÈRES TECHNIQUES. La perspective linéaire, démontrée par Brunelleschi vers 1415 et théorisée par Alberti en 1435 : une construction géométrique, pas une découverte sur la vision. La peinture à l'huile, portée à maturité par Van Eyck : séchage lent, donc glacis, fondus, reprises. Le tube d'étain en 1841 : la couleur devient transportable, et l'on peut peindre dehors en une séance.\n\nLA HIÉRARCHIE DES GENRES, fixée par l'Académie : histoire, portrait, scène de genre, paysage, nature morte. Elle ne classe pas la qualité mais le sujet, et commande les prix et les carrières. Une bonne part du XIXᵉ siècle consiste à la renverser — Courbet peignant des villageois au format réservé aux batailles.\n\nLES NOMS SONT SOUVENT DES INSULTES RETOURNÉES : gothique, baroque, impressionnisme, fauvisme, cubisme. Aucun n'a été choisi par ceux qu'il désigne.\n\nCE QUE LE CANON A LAISSÉ DEHORS. Les femmes, exclues des académies et de l'étude du nu, donc des grands genres — et parfois effacées par réattribution, comme Judith Leyster vendue en Frans Hals. Et les sources non européennes, massivement mobilisées puis rangées sous le mot « influence primitive »."},
 {id:'histoire',nom:'Histoire du temps profond',ico:'🏛️',type:'bank',cat:'histoire',
  sous:'Échelle des temps, extinctions, découvertes',
  objectif:"Situer les époques, les crises et les gens qui ont construit la discipline.",
  bank:()=>HISTOIRE,
  theorie:"L'ÉCHELLE. Éons, ères, périodes, époques : du plus large au plus fin. Nous sommes dans l'éon Phanérozoïque, l'ère Cénozoïque, la période Quaternaire. Les trois ères du Phanérozoïque, dans l'ordre : Paléozoïque (539–252 Ma), Mésozoïque (252–66 Ma), Cénozoïque (66 Ma à aujourd'hui).\n\nTROIS DATES SUFFISENT À S'ORIENTER : 539 Ma, base du Cambrien et début des fossiles abondants. 252 Ma, extinction de la fin du Permien, la plus sévère. 66 Ma, limite K-Pg, fin des dinosaures non-aviens.\n\nCE QU'IL FAUT RETENIR DU RYTHME. Le Précambrien couvre à lui seul près de 88 % de l'histoire de la Terre. Tout ce dont on parle habituellement tient dans les 12 % restants.\n\nLES MÉTHODES. Le carbone 14 plafonne vers 50 000 ans : au-delà, on date les cendres volcaniques par l'uranium-plomb sur zircon. Les fossiles, eux, se datent presque toujours par la couche qui les contient, pas directement.\n\nLA DISCIPLINE. Sténon pose la superposition au XVIIᵉ siècle, Cuvier démontre l'extinction vers 1800, Smith cartographie par les fossiles en 1815, Owen invente « dinosaure » en 1842, Darwin publie en 1859, Walcott trouve Burgess en 1909, les Alvarez proposent l'impact en 1980."},
 {id:'biologie',nom:'Biologie des lignées',ico:'🧬',type:'bank',cat:'histoire',
  sous:'Trilobites, holothuries, requins, cétacés',
  objectif:"Comprendre quatre lignées marines par ce que leur corps impose, et par ce qu'elles laissent — ou non — dans les roches.",
  bank:()=>BIOLOGIE,
  theorie:"CE QUI SE FOSSILISE COMMANDE CE QU'ON SAIT. Un trilobite minéralise sa carapace avec de la calcite : il est partout dans les roches. Un requin n'a que du cartilage : il ne reste que les dents. Une holothurie n'a que des spicules microscopiques : elle est presque invisible. Les trois groupes ont pu être également abondants — le registre fossile mesure d'abord la minéralisation, pas le succès.\n\nMUE ET COMPTAGE. Un arthropode change de carapace pour grandir. Un seul trilobite laisse donc des dizaines d'exuvies et un seul cadavre. Compter les fossiles n'est jamais compter les individus.\n\nÉCHINODERMES. Étoiles de mer, oursins, ophiures, crinoïdes et holothuries. Symétrie à cinq branches chez l'adulte, symétrie bilatérale chez la larve : la pentaradialité est acquise, pas originelle. Leur tissu conjonctif mutable change de rigidité en quelques secondes, sous contrôle nerveux — ce n'est pas du muscle.\n\nCHONDRICHTHYENS. Squelette cartilagineux, denticules cutanés de même structure que les dents, remplacement dentaire continu, pas de vessie natatoire mais un foie huileux, et les ampoules de Lorenzini pour détecter les champs électriques.\n\nCÉTACÉS. Des artiodactyles retournés à la mer. Narines migrées au sommet du crâne, voies respiratoires isolées du tube digestif, fanons de kératine chez les mysticètes, écholocation chez les odontocètes seulement.\n\nCONVERGENCE. Requin, ichtyosaure, dauphin : un poisson, un reptile, un mammifère, trois silhouettes presque identiques. L'eau impose sa forme. Se ressembler ne prouve aucune parenté."},
 {id:'lecture',nom:'Français — lecture',ico:'📖',type:'bank',cat:'ecole',
  sous:'Secondaire inférieur · comprendre un texte',
  objectif:"Accompagnement scolaire (12-15 ans) : repérer ce qu'un texte dit, ce qu'il veut, et ce qu'il fait passer sans le dire.",
  bank:()=>FR_LECTURE,
  theorie:"CE PACK NE PORTE PAS SUR L'ORTHOGRAPHE mais sur la lecture : comprendre, analyser, résumer. C'est la compétence que le secondaire évalue le plus souvent sans jamais l'appeler par son nom.\n\nQUATRE TYPES DE TEXTES. Narratif (il raconte), descriptif (il montre), argumentatif (il défend une thèse), informatif (il expose). Un texte réel les mêle ; on cherche celui qui domine.\n\nLE SCHÉMA NARRATIF. Situation initiale, élément déclencheur, péripéties, dénouement, situation finale. Sans rupture d'équilibre, il n'y a pas de récit.\n\nQUI RACONTE. Narrateur interne (« je », il ne sait que ce que sait son personnage), externe (il ne rapporte que le visible), omniscient (il entre dans toutes les têtes). Le point de vue décide de ce que le lecteur a le droit de savoir.\n\nFAIT ET OPINION. Un fait se vérifie, une opinion s'argumente. Le critère n'est pas la certitude mais la vérifiabilité.\n\nTHÈSE, ARGUMENT, EXEMPLE. La thèse est ce dont on veut vous convaincre ; l'argument est une raison ; l'exemple illustre l'argument. Un exemple seul ne démontre rien — c'est l'erreur la plus fréquente dans les copies.\n\nLES CONNECTEURS. Cause : parce que, car, puisque. Conséquence : donc, par conséquent. Opposition : mais, or, en revanche. Concession : bien que, quoique, certes… mais. Confondre cause et conséquence inverse tout le raisonnement.\n\nQUELQUES FIGURES. Comparaison (avec un outil : comme, tel) contre métaphore (sans outil). Personnification (une chose agit comme un vivant). Hyperbole (exagération). Litote (on dit moins pour suggérer plus). Ironie (on dit le contraire de ce qu'on pense — la plus difficile à repérer à l'écrit).\n\nL'IMPLICITE. Le présupposé est porté par la phrase elle-même et résiste à la négation : « tu as ENCORE oublié tes clés » suppose un précédent. Le sous-entendu dépend du contexte.\n\nLE RÉFLEXE UTILE. Devant un texte inconnu : lire d'abord le paratexte — titre, auteur, source, date. Puis chercher la thèse. Puis demander d'où viennent les chiffres. « Une étude montre que… » sans nom d'étude n'est pas une source."},
 {id:'histscol',nom:'Histoire',ico:'📜',type:'bank',cat:'ecole',
  sous:'Secondaire inférieur · repères et critique de source',
  objectif:"Accompagnement scolaire (12-15 ans) : tenir les grands repères, et distinguer un fait d'une interprétation.",
  bank:()=>HIST_SCOLAIRE,
  theorie:"LES CINQ PÉRIODES. Préhistoire, Antiquité, Moyen Âge, Temps modernes, Époque contemporaine. Bornes usuelles : l'écriture vers 3300 avant notre ère, 476, 1492, 1789.\n\nCES BORNES SONT DÉCIDÉES, PAS TROUVÉES. Rien n'a changé pour les habitants de Rome en 476, et la découpe décrit mal l'histoire de la Chine ou de l'Afrique. Une périodisation est un outil de travail, pas une propriété du passé.\n\nLES SOURCES. Primaire : produite à l'époque étudiée (lettre, registre, outil, image). Secondaire : elle commente les primaires. La critique consiste à demander qui a produit le document, quand, pour qui et pourquoi. C'est le cœur du cours d'histoire, bien avant les dates.\n\nQUELQUES REPÈRES. Écriture en Mésopotamie vers 3300 av. n. è. Démocratie athénienne, où votait peut-être un habitant sur dix. Féodalité : des liens personnels fondés sur la terre, sans État au sens moderne. Imprimerie vers 1450. Réforme à partir de 1517. Monarchie absolue au XVIIᵉ. 1789 et la Déclaration des droits. Révolution industrielle depuis la Grande-Bretagne, la Belgique deuxième pays industrialisé du continent. Indépendance belge en 1830.\n\nLES MOTS PORTENT DES JUGEMENTS. « Moyen Âge » a été forgé par des lettrés de la Renaissance pour désigner un entre-deux méprisé. « Découverte de l'Amérique » fait des habitants du continent un décor. Repérer ces mots-là est un exercice scolaire, pas une opinion politique.\n\nFAIT ET INTERPRÉTATION. Que la Bastille ait été prise le 14 juillet 1789 est un fait. Que ce soit le début de la Révolution est une interprétation — solide, mais construite. Les manuels mêlent les deux sans toujours le signaler, et c'est pour cela qu'ils changent d'une génération à l'autre."},
 {id:'geographie',nom:'Géographie',ico:'🗺️',type:'bank',cat:'ecole',
  sous:'Secondaire inférieur · cartes, climats, Belgique',
  objectif:"Accompagnement scolaire (12-15 ans) : lire une carte, situer, et comprendre ce qu'une représentation choisit de montrer.",
  bank:()=>GEOGRAPHIE,
  theorie:"LIRE UNE CARTE, DANS L'ORDRE. Légende, échelle, orientation, date. Une carte sans légende est décorative, pas informative.\n\nL'ÉCHELLE. Au 1:50 000, un centimètre vaut 500 mètres. Plus le dénominateur est grand, plus l'échelle est PETITE et moins la carte détaille. Les aires suivent le CARRÉ du rapport.\n\nSE SITUER. La latitude se compte de 0° à l'équateur à 90° aux pôles ; la longitude à l'est ou à l'ouest de Greenwich. On écrit toujours la latitude d'abord.\n\nLE RELIEF. Les courbes de niveau joignent les points de même altitude. Serrées : pente raide. Espacées : terrain plat.\n\nAUCUNE CARTE PLANE N'EST EXACTE. La projection de Mercator conserve les angles — c'est pourquoi elle servait à naviguer — mais gonfle les surfaces vers les pôles : le Groenland y paraît grand comme l'Afrique alors qu'il est quatorze fois plus petit. Toute projection sacrifie quelque chose ; le choix est un argument.\n\nLE CLIMAT. Quatre facteurs : latitude, altitude, distance à la mer, courants marins. La Belgique a un climat tempéré océanique — hivers doux, étés frais, pluies toute l'année — parce que la mer amortit les écarts.\n\nLA BELGIQUE. Trois Régions (flamande, wallonne, Bruxelles-Capitale), trois Communautés (française, flamande, germanophone), dix provinces : trois découpages qui ne se superposent pas. Le relief monte du nord-ouest au sud-est, des polders à l'Ardenne, jusqu'au Signal de Botrange (694 m). Deux fleuves : la Meuse et l'Escaut — la Sambre et la Lys sont des affluents.\n\nL'EAU. Un bassin versant est le territoire dont toutes les eaux rejoignent un même cours d'eau ; ses limites sont les lignes de crête. Un delta ramifie le fleuve, un estuaire l'ouvre en un large chenal.\n\nLA POPULATION. La densité est un rapport habitants/km² — donc une moyenne, qui masque les écarts."},
 {id:'conjugaison',nom:'Conjugaison',ico:'🕰️',type:'gen',cat:'ecole',
  sous:'Secondaire inférieur · temps, modes, personnes',
  objectif:"Accompagnement scolaire (12-15 ans) : employer les temps et les modes avec précision, y compris sur les verbes irréguliers.",
  theorie:"Un temps se choisit pour ce qu'il fait, pas pour ce qu'il décore.\n\n• PRÉSENT : le fait est en cours, habituel, ou énoncé comme une vérité.\n• IMPARFAIT : arrière-plan, durée, habitude passée. « Il pleuvait quand elle est arrivée. »\n• PASSÉ COMPOSÉ : événement achevé, rattaché au moment où l'on parle.\n• FUTUR SIMPLE : ce qui est présenté comme certain.\n• CONDITIONNEL PRÉSENT : hypothèse, politesse, information non confirmée.\n• SUBJONCTIF PRÉSENT : après un verbe de volonté, de doute ou d'émotion, et après « bien que », « avant que », « pour que ».\n\nDeux pièges classiques : « après que » se construit avec l'INDICATIF (le fait est réel), alors que « avant que » demande le subjonctif. Et le conditionnel en -rais ne se confond avec le futur en -rai que si l'on oublie de vérifier la personne."},
 {id:'orthographe',nom:'Orthographe',ico:'✍️',type:'bank',cat:'ecole',
  sous:'Secondaire inférieur · homophones, accords, relecture',
  objectif:"Accompagnement scolaire (12-15 ans) : sécuriser l'écriture courante et la relecture raisonnée.",
  bank:()=>ORTHO,
  theorie:"La plupart des fautes d'adulte ne sont pas des fautes de vocabulaire : ce sont des confusions entre mots qui se prononcent pareil.\n\nLa méthode qui marche presque toujours : REMPLACER.\n• a / à → remplace par « avait ». Si ça passe, c'est « a ».\n• ou / où → remplace par « ou bien ». Si ça passe, pas d'accent.\n• son / sont → remplace par « étaient ». Si ça passe, c'est « sont ».\n• ce / se → remplace par « cela ». Si ça passe, c'est « ce ».\n• ces / ses → remplace par « ceux-là » ou « les siens ».\n• leur / leurs → « leur » devant un nom s'accorde avec ce nom.\n\nACCORD DU PARTICIPE PASSÉ :\n• avec ÊTRE : accord avec le sujet.\n• avec AVOIR : accord avec le complément d'objet direct seulement s'il est placé AVANT le verbe.\n• verbes pronominaux : accord si le pronom est COD ; pas d'accord s'il est COI (« elles se sont parlé »)."},
 {id:'maths',nom:'Mathématiques',ico:'📐',type:'gen',cat:'ecole',
  sous:'Secondaire inférieur · proportions, pourcentages, équations',
  objectif:"Accompagnement scolaire (12-15 ans) : proportions, pourcentages, conversions, ordres de grandeur.",
  gens:GEN_MATHS,
  theorie:"POURCENTAGES. Un pourcentage est une fraction sur 100. Augmenter de p %, c'est multiplier par (1 + p/100) ; réduire de p %, c'est multiplier par (1 − p/100). Une hausse de 20 % suivie d'une baisse de 20 % ne ramène pas au point de départ : 1,2 × 0,8 = 0,96.\n\nPROPORTIONS. La règle de trois consiste à passer par la valeur d'une unité. C'est plus lent que les produits croisés, mais on se trompe beaucoup moins.\n\nÉCHELLES. Une échelle 1:50 000 signifie que 1 cm sur la carte vaut 50 000 cm en réalité, soit 500 m. Les aires, elles, suivent le CARRÉ du rapport : 1 m² = 10 000 cm², pas 100.\n\nORDRES DE GRANDEUR. En géologie, « Ma » signifie million d'années. 500 Ma = 5 × 10⁸ ans. La notation scientifique impose une mantisse entre 1 et 10."}
];

/* ================================================================
   Bloc 17 : les rappels théoriques, réécrits en prose.

   Ils étaient bâtis en rubriques à titre capitalisé — un catalogue
   qu'on parcourt sans le lire. Le contenu était bon, la forme
   décourageait d'y entrer.

   Chacun est désormais un texte suivi qui va quelque part : il part
   d'un cas concret, déroule ce qu'il faut savoir, et se referme sur ce
   qui reste ouvert. Aucun fait n'a été retiré ; quelques-uns ont
   gagné le détail qui les rend racontables.

   Là où une liste reste la bonne forme — les tests de substitution en
   orthographe, l'emploi des temps — elle est amenée par une phrase et
   énoncée en phrases, plutôt que jetée en puces.

   Les textes sont assignés après la déclaration de PACKS, pour rester
   tous ensemble et lisibles d'un seul tenant.
   ================================================================ */

const RAPPELS={

philomonde:
`Au XIᵉ siècle, Avicenne demande à son lecteur d'imaginer un homme créé à l'instant, suspendu dans le vide, les yeux bandés, les membres écartés pour qu'aucun n'en touche un autre. Privé de toute sensation, cet homme saurait pourtant qu'il existe. Six siècles plus tard, Descartes écrira le cogito. Vers 1095, al-Ghazali remarque que nous n'observons jamais la nécessité entre le feu et le coton qui brûle, seulement leur succession — Hume écrira la même chose vers 1740. Et dix-neuf siècles avant les Méditations, Zhuangzi se réveille sans pouvoir décider s'il a rêvé qu'il était un papillon, ou s'il est un papillon en train de rêver.

Ces textes ne sont pas des ébauches maladroites de la pensée européenne. Ce sont des réponses entières, formulées ailleurs, à des problèmes qu'on nous présente comme européens. D'où la seconde question de ce pack, inséparable de la première : si c'était là, pourquoi ne l'apprend-on pas ?

La réponse n'est pas l'oubli. Kant et Hegel n'ont pas ignoré l'Afrique et l'Asie : ils les ont écartées avec des arguments, noir sur blanc. La frontière du canon est un acte, pas un constat.

Le même réflexe traverse l'histoire de l'art. Devant les têtes d'Ifé, Frobenius conclut à l'Atlantide, parce qu'un tel naturalisme lui paraissait incompatible avec une origine africaine. Conti Rossini déclare le Hatata éthiopien apocryphe, en partie parce que de telles idées ne lui semblaient pas attendues en Éthiopie. Deux disciplines, un seul préjugé — et dans les deux cas une érudition réelle mise au service d'une supposition jamais examinée.

L'affaire du Hatata n'est d'ailleurs pas close : un volume collectif lui a été consacré en 2024, et le désaccord traverse les chercheurs éthiopiens autant que les occidentaux. Ce pack te le dit plutôt que de trancher à ta place.

Reste une gêne qu'il vaut mieux nommer. « Philosophie non européenne » range ensemble Nagarjuna, Ibn Khaldoun et les tlamatinime, qui n'ont en commun que de ne pas être grecs. La catégorie signale un manque réel et reconduit en même temps le centre qu'elle voudrait déplacer.`,

philosophie:
`En 1899, un paléontologue décrit une spirale de dents magnifiquement conservée. Sa description est exacte ; elle n'a jamais été corrigée. Ce qui a mis plus d'un siècle à se fixer, c'est l'endroit où cet organe se trouvait sur l'animal — dans la gueule, sur le museau, enroulé dans la gorge, on a tout proposé. La donnée était solide, l'interprétation restait ouverte. Ce sont deux opérations distinctes, et les confondre est l'erreur la plus commune de toute la démarche scientifique.

Pour savoir si une explication vaut quelque chose, Karl Popper propose un test d'une simplicité désarmante : peux-tu dire ce qui la mettrait en défaut ? Une théorie compatible avec n'importe quel résultat n'apprend rien, parce qu'elle n'interdit rien. « Il y a plusieurs causes » ne devient un énoncé sérieux qu'à partir du moment où l'on précise lesquelles, dans quel ordre, et pour quelle part.

Un piège plus discret tient à ce qu'on ne trouve pas. Ne pas trouver un fossile n'établit pas que l'animal n'a pas existé : il peut n'avoir jamais existé, n'avoir laissé aucun reste, ou n'avoir pas encore été cherché au bon endroit. Le registre fossile mesure d'abord les conditions de fossilisation, et seulement ensuite ce qui vivait.

Quand plusieurs explications tiennent debout, on préfère la plus économique — c'est le rasoir d'Ockham. Il faut l'entendre pour ce qu'il est : une règle de choix entre des hypothèses, pas une affirmation sur le monde. Il ne dit nulle part que la nature est simple.

Cette prudence prend un tour très concret quand il s'agit de nommer une espèce. On ne peut pas vérifier l'interfécondité d'animaux morts depuis cent millions d'années ; les espèces fossiles se délimitent donc sur la forme, c'est-à-dire par un jugement révisable. Marsh et Cope en ont nommé cent trente à eux deux, dans une rivalité féroce, et une bonne part n'étaient que des doublons.

Il arrive enfin que deux hypothèses restent également compatibles avec tout ce qu'on sait. Ne pas trancher est alors une position argumentée, à condition de dire ce qui manquerait pour décider. Trancher sans motif reviendrait à présenter une préférence comme un résultat.`,

artmonde:
`Représenter un visage, occuper l'espace, honorer un mort, figurer le divin : ces questions ne sont d'aucune région du monde en particulier. Ce pack ne cherche donc pas à ajouter un supplément exotique au cursus, mais à constater que d'autres traditions les ont traitées, avec d'autres réponses, parfois des siècles plus tôt.

Ces réponses sont techniquement autonomes. La fonte à la cire perdue est maîtrisée à Ifé comme chez les Chola. Les rouleaux peints de la dynastie Song se passent d'un point de fuite unique, parce qu'ils supposent un regard qui se déplace et non un observateur immobile. La miniature persane ouvre les murs pour rendre tout visible à la fois. Aucune de ces solutions n'ignore la perspective européenne : elles répondent simplement à d'autres questions.

Le regard européen, lui, a longtemps refusé de le voir. Devant les têtes d'Ifé, en 1910, Frobenius conclut à l'Atlantide : un tel naturalisme lui semblait incompatible avec une origine africaine. Devant le Grand Zimbabwe, l'archéologie officielle rhodésienne a cherché des bâtisseurs phéniciens, arabes, n'importe lesquels sauf shona. Ces hypothèses étaient savantes dans la forme et racistes dans la prémisse.

Il faut aussi savoir comment ces objets sont arrivés jusqu'à nos musées. Les bronzes du Bénin proviennent du sac de Benin City par une expédition punitive britannique en 1897. Les restitutions ont commencé : l'Allemagne a transféré la propriété de 1 130 pièces en 2022, les Pays-Bas en ont rendu 119 en juin 2025. Le British Museum en conserve plus de neuf cents.

Un dernier mot sur un mot. « Primitif » suppose un stade antérieur au nôtre. Il désigne en réalité des arts contemporains des cathédrales, avec leurs écoles, leurs commandes et leurs maîtres.`,

arteu:
`Le plan que tu as appris à l'école a un auteur. En 1550, Giorgio Vasari publie ses Vies des meilleurs peintres : l'art atteint un sommet dans l'Antiquité, déchoit, renaît avec Giotto, et culmine avec Michel-Ange — qui se trouve être son ami. De lui viennent le mot « Renaissance » et l'usage de « gothique » comme insulte. Cinq siècles plus tard, nos manuels suivent encore ce fil, y compris quand ils croient le contester.

Sur ce fil se greffent quelques bascules qui, elles, sont techniques. La perspective linéaire est démontrée par Brunelleschi vers 1415 et mise en règles par Alberti en 1435 : c'est une construction géométrique, pas une découverte sur la vision. La peinture à l'huile, portée à maturité par Van Eyck, sèche lentement — d'où les glacis, les fondus, les reprises, et une profondeur que la détrempe ne permettait pas. Et en 1841, le tube d'étain rend la couleur transportable : on peut enfin peindre dehors, en une séance, devant le motif.

Entre-temps, l'Académie a fixé une hiérarchie des genres : peinture d'histoire d'abord, puis portrait, scène de genre, paysage, nature morte. Elle ne classe pas la qualité mais le sujet, et elle commande les prix comme les carrières. Une bonne part du XIXᵉ siècle consiste à la renverser — Courbet peignant des villageois au format réservé aux batailles.

Les noms de mouvements, eux, sont presque tous des insultes retournées : gothique, baroque, impressionnisme, fauvisme, cubisme. Aucun n'a été choisi par ceux qu'il désigne.

Reste à demander qui ce récit laisse dehors. Les femmes, exclues des académies et de l'étude du nu, donc des grands genres — et parfois effacées après coup par réattribution, comme Judith Leyster vendue sous le nom de Frans Hals. Et les sources non européennes, massivement mobilisées puis rangées sous le mot commode d'« influence primitive ».`,

histoire:
`Le temps géologique se lit à quatre échelles emboîtées : éons, ères, périodes, époques, du plus large au plus fin. Nous sommes dans l'éon Phanérozoïque, l'ère Cénozoïque, la période Quaternaire. Le Phanérozoïque compte trois ères, et les retenir dans l'ordre suffit déjà à ne plus jamais être perdue : Paléozoïque de 539 à 252 millions d'années, Mésozoïque de 252 à 66, Cénozoïque de 66 à aujourd'hui.

Trois dates portent tout le reste. 539 marque la base du Cambrien, à partir de laquelle les fossiles deviennent abondants. 252 est l'extinction de la fin du Permien, la plus sévère qu'ait connue la vie. 66 est la limite entre Crétacé et Paléogène, celle des dinosaures non-aviens.

Ce découpage cache pourtant une disproportion qu'il faut avoir en tête. Le Précambrien couvre à lui seul près de 88 % de l'histoire de la Terre. Tout ce dont on parle d'habitude — les trilobites, les forêts, les dinosaures, nous — tient dans les 12 % restants.

Comment sait-on tout cela ? Rarement en datant le fossile lui-même. Le carbone 14 plafonne vers cinquante mille ans, ce qui ne mène nulle part à cette échelle ; au-delà, on date les cendres volcaniques par la méthode uranium-plomb sur zircon. Un fossile se date donc presque toujours par la couche qui le contient, encadrée entre deux niveaux datables.

Cette discipline s'est construite par étapes, et chacune a coûté une bataille. Sténon pose le principe de superposition au XVIIᵉ siècle. Cuvier démontre vers 1800 que des espèces ont réellement disparu, ce qui n'allait pas de soi. Smith cartographie l'Angleterre par ses fossiles en 1815. Owen forge le mot « dinosaure » en 1842, Darwin publie en 1859, Walcott découvre Burgess en 1909, et les Alvarez proposent l'hypothèse de l'impact en 1980.`,

biologie:
`Un trilobite renforce sa carapace de calcite : on le trouve partout dans les roches. Un requin n'a que du cartilage : il n'en reste que les dents. Une holothurie ne possède que des spicules microscopiques : elle est presque invisible. Ces trois groupes ont très bien pu être également abondants — le registre fossile mesure d'abord la minéralisation, et seulement ensuite le succès.

Le comptage réserve un second piège. Un arthropode change de carapace pour grandir, si bien qu'un unique trilobite laisse derrière lui des dizaines de mues et un seul cadavre. Compter des fossiles n'est jamais compter des individus.

Les échinodermes rassemblent les étoiles de mer, les oursins, les ophiures, les crinoïdes et les holothuries. Leur symétrie à cinq branches est célèbre, mais elle n'apparaît que chez l'adulte : la larve, elle, est bilatérale comme nous. La pentaradialité est donc acquise, pas originelle. Ils disposent en outre d'un tissu conjonctif mutable qui change de rigidité en quelques secondes sous contrôle nerveux — ce n'est pas du muscle, et rien chez nous n'y ressemble.

Les chondrichthyens — requins, raies, chimères — ont un squelette de cartilage, une peau couverte de denticules qui ont exactement la structure de leurs dents, un remplacement dentaire continu, et pas de vessie natatoire : leur flottabilité vient d'un foie très huileux. Leurs ampoules de Lorenzini détectent les champs électriques des proies.

Les cétacés, eux, sont des artiodactyles retournés à la mer. Leurs narines ont migré au sommet du crâne, leurs voies respiratoires se sont isolées du tube digestif, les mysticètes ont troqué leurs dents contre des fanons de kératine, et seuls les odontocètes pratiquent l'écholocation.

Une dernière chose, qui vaut pour tout ce pack. Un requin, un ichtyosaure et un dauphin — un poisson, un reptile, un mammifère — ont presque la même silhouette. L'eau impose sa forme à qui veut y aller vite. Se ressembler ne prouve donc aucune parenté, et c'est une des leçons les plus utiles de toute la biologie.`,

lecture:
`Ce pack ne porte pas sur l'orthographe mais sur la lecture : comprendre, analyser, résumer. C'est la compétence que le secondaire évalue le plus souvent sans jamais l'appeler par son nom, et celle qui sert le plus longtemps ensuite.

On classe les textes en quatre familles selon ce qu'ils font : le narratif raconte, le descriptif montre, l'argumentatif défend une thèse, l'informatif expose. Un texte réel les mêle presque toujours ; la question utile n'est pas de choisir mais de repérer lequel domine.

Quand un texte raconte, il suit d'ordinaire le même mouvement : une situation initiale, un élément qui vient en rompre l'équilibre, des péripéties, un dénouement, une situation finale. Sans rupture d'équilibre, il n'y a pas de récit — seulement une description qui dure. Et il faut toujours se demander qui raconte. Un narrateur interne dit « je » et ne sait que ce que sait son personnage ; un narrateur externe ne rapporte que le visible, comme une caméra ; un narrateur omniscient entre dans toutes les têtes. Ce choix n'est jamais neutre : il décide de ce que le lecteur a le droit de savoir.

Quand un texte argumente, trois niveaux se distinguent. La thèse est ce dont on veut te convaincre. L'argument est une raison de l'admettre. L'exemple illustre l'argument, et ne démontre rien à lui seul — c'est l'erreur la plus fréquente dans les copies. Les connecteurs signalent l'articulation, à condition de ne pas les confondre : « parce que », « car », « puisque » introduisent une cause ; « donc », « par conséquent » une conséquence ; « mais », « or », « en revanche » une opposition ; « bien que », « quoique », « certes… mais » une concession, c'est-à-dire un point qu'on accorde avant de maintenir le sien.

Quelques figures reviennent sans cesse. La comparaison garde son outil — comme, tel — là où la métaphore le supprime. La personnification fait agir une chose comme un vivant. L'hyperbole exagère, la litote dit moins pour suggérer plus, et l'ironie affirme le contraire de ce qu'elle pense : c'est la plus difficile à repérer à l'écrit, parce que le mot à mot y trompe et qu'il faut lire ce qui entoure la phrase.

Le plus intéressant est souvent ce qui n'est pas dit. Le présupposé est porté par la phrase elle-même et résiste même à la négation : « tu as encore oublié tes clés » suppose un précédent, et « tu n'as pas encore oublié tes clés » aussi. Le sous-entendu, lui, dépend entièrement du contexte.

Il en découle un réflexe qui vaut pour tout texte inconnu. Lire d'abord le paratexte — titre, auteur, source, date. Chercher ensuite la thèse. Demander enfin d'où viennent les chiffres : « une étude montre que… », sans nom d'étude, n'est pas une source.`,

histscol:
`L'histoire scolaire se découpe en cinq périodes : Préhistoire, Antiquité, Moyen Âge, Temps modernes, Époque contemporaine. Les bornes usuelles sont l'apparition de l'écriture vers 3300 avant notre ère, puis 476, 1492 et 1789.

Il faut savoir d'emblée ce que valent ces bornes. Rien n'a changé pour les habitants de Rome en 476, année où l'on dépose un empereur d'Occident déjà sans pouvoir. Et la découpe décrit très mal l'histoire de la Chine ou de l'Afrique, où ces ruptures n'ont pas de sens. Une périodisation est un outil de travail, pas une propriété du passé.

Le vrai cœur du cours n'est d'ailleurs pas la date, c'est la source. Une source primaire a été produite à l'époque étudiée : lettre, registre, outil, image. Une source secondaire commente les primaires. La critique consiste à demander qui a produit le document, quand, pour qui et pourquoi — parce qu'un texte n'est pas neutre du seul fait d'être ancien, et que le chroniqueur d'un roi écrit pour son roi.

Restent les repères, qu'il faut bien tenir. L'écriture naît en Mésopotamie de la comptabilité, pour compter des sacs de grain. La démocratie athénienne fait voter peut-être un habitant sur dix, femmes, esclaves et métèques exclus. La féodalité tisse des liens personnels fondés sur la terre, sans État au sens moderne. L'imprimerie arrive vers 1450, la Réforme s'ouvre en 1517, la monarchie absolue domine le XVIIᵉ siècle, 1789 proclame que les hommes naissent libres et égaux en droits. La révolution industrielle part de Grande-Bretagne, et la Belgique devient le deuxième pays industrialisé du continent avant même d'être indépendante, en 1830.

Un dernier point mérite qu'on y prête l'oreille : les mots portent des jugements. « Moyen Âge » a été forgé par des lettrés de la Renaissance pour désigner un entre-deux qu'ils méprisaient. « Découverte de l'Amérique » fait des habitants du continent un décor. Les repérer est un exercice scolaire, pas une opinion politique.

Tout cela se ramène à une distinction. Que la Bastille ait été prise le 14 juillet 1789 est un fait, établi par les sources. Que ce soit le début de la Révolution est une interprétation — solide, mais construite. Les manuels mêlent les deux sans toujours le signaler, et c'est précisément pour cela qu'ils changent d'une génération à l'autre.`,

geographie:
`Devant une carte inconnue, quatre réflexes dans l'ordre : la légende, l'échelle, l'orientation, la date. Une carte sans légende n'est pas lisible, seulement décorative.

L'échelle se lit comme un rapport. Au 1:50 000, un centimètre sur le papier vaut cinquante mille centimètres sur le terrain, soit cinq cents mètres. Plus le dénominateur grandit, plus l'échelle est petite et moins la carte détaille : une carte au millionième montre un pays, une carte au dix-millième montre un quartier. Attention aux surfaces, qui suivent le carré du rapport et non le rapport lui-même.

Pour se situer, la latitude se compte de 0° à l'équateur jusqu'à 90° aux pôles, la longitude à l'est ou à l'ouest du méridien de Greenwich — et l'usage veut qu'on écrive toujours la latitude d'abord. Le relief, lui, se lit par les courbes de niveau, qui joignent les points de même altitude : serrées, la pente est raide ; espacées, le terrain est plat.

Il faut savoir qu'aucune carte plane n'est exacte, et que ce n'est pas un défaut de fabrication. La projection de Mercator conserve les angles, ce qui la rendait précieuse pour naviguer, mais elle gonfle les surfaces à mesure qu'on s'éloigne de l'équateur : le Groenland y paraît grand comme l'Afrique alors qu'il est quatorze fois plus petit. Toute projection sacrifie quelque chose, et le choix de ce qu'on sacrifie est un argument.

Le climat d'un lieu dépend de quatre facteurs : sa latitude, son altitude, sa distance à la mer et les courants marins qui la longent. C'est pourquoi la Belgique, à la latitude de Québec, connaît des hivers doux : la mer amortit les écarts et la dérive nord-atlantique réchauffe toute l'Europe de l'Ouest. On parle de climat tempéré océanique — étés frais, pluies réparties sur l'année, faible amplitude.

La Belgique elle-même se découpe de trois façons qui ne se superposent pas : trois Régions, trois Communautés, dix provinces. Son relief monte régulièrement du nord-ouest au sud-est, des polders jusqu'à l'Ardenne et au Signal de Botrange, à 694 mètres. Deux fleuves la traversent, la Meuse et l'Escaut — la Sambre et la Lys ne sont que des affluents, puisqu'un fleuve se jette dans la mer.

L'eau se pense par bassins versants : le territoire dont toutes les eaux rejoignent un même cours d'eau, délimité par les lignes de crête. C'est la bonne unité pour comprendre une inondation, qui ignore les frontières administratives. À l'arrivée, le fleuve se ramifie en delta quand il dépose plus que la mer n'emporte, ou s'ouvre en estuaire quand les marées l'emportent.

Un dernier chiffre, à manier avec prudence : la densité de population est un rapport entre des habitants et des kilomètres carrés. C'est donc une moyenne, et une moyenne masque toujours ses écarts.`,

conjugaison:
`Un temps se choisit pour ce qu'il fait, jamais pour ce qu'il décore. C'est la seule idée à retenir, et tout le reste en découle.

Le présent installe un fait en cours, une habitude, ou une vérité qu'on énonce sans la dater. L'imparfait pose un arrière-plan qui dure, une habitude passée, un décor : « il pleuvait quand elle est arrivée » — l'imparfait tient la toile de fond, le passé composé y découpe l'événement. Ce dernier rattache d'ailleurs toujours son fait au moment où l'on parle, ce qui le distingue du passé simple des récits littéraires.

Le futur simple présente ce qui est donné pour certain. Le conditionnel présent fait exactement l'inverse : il marque l'hypothèse, la politesse, ou l'information qu'on ne confirme pas — c'est le temps des journalistes prudents. Quant au subjonctif présent, il apparaît après les verbes de volonté, de doute ou d'émotion, et derrière « bien que », « avant que », « pour que ».

Deux pièges reviennent sans cesse. « Après que » se construit avec l'indicatif, parce que le fait qui suit est réel, alors que « avant que » demande le subjonctif, parce qu'il ne l'est pas encore — c'est la faute la plus répandue, y compris chez les bons rédacteurs. Et le conditionnel en -rais ne se confond avec le futur en -rai que si l'on oublie de regarder la personne : à la première du singulier, « je serai » annonce, « je serais » suppose.`,

orthographe:
`La plupart des fautes d'adulte ne viennent pas d'un vocabulaire mal connu. Ce sont des confusions entre mots qui se prononcent de la même façon, et elles se règlent presque toutes par un seul geste : remplacer.

Pour « a » et « à », remplace par « avait » : si la phrase tient debout, c'est « a » sans accent. Pour « ou » et « où », remplace par « ou bien » : si ça passe, pas d'accent. Pour « son » et « sont », remplace par « étaient ». Pour « ce » et « se », remplace par « cela ». Pour « ces » et « ses », essaie « ceux-là », puis « les siens ». Et « leur » devant un nom s'accorde avec ce nom : leur maison, leurs maisons.

L'accord du participe passé se ramène, lui aussi, à peu de chose. Avec l'auxiliaire être, il s'accorde avec le sujet, sans exception à retenir. Avec avoir, il ne s'accorde avec le complément d'objet direct que si celui-ci est placé avant le verbe — « les lettres qu'elle a écrites », mais « elle a écrit les lettres ». Les verbes pronominaux suivent la même logique une fois qu'on a identifié la fonction du pronom : accord s'il est complément d'objet direct, pas d'accord s'il est indirect. « Elles se sont lavées », mais « elles se sont parlé », parce qu'on parle à quelqu'un.

Une relecture qui cherche tout à la fois ne trouve rien. Mieux vaut relire une fois pour les accords de participe, une fois pour les homophones, une fois pour les accords sujet-verbe.`,

maths:
`Un pourcentage n'est rien d'autre qu'une fraction dont le dénominateur est cent. Augmenter de p %, c'est multiplier par 1 + p/100 ; réduire de p %, c'est multiplier par 1 − p/100. Cette écriture révèle immédiatement un piège célèbre : une hausse de 20 % suivie d'une baisse de 20 % ne ramène pas au point de départ, puisque 1,2 × 0,8 fait 0,96. On a perdu 4 %.

Pour les proportions, la règle de trois consiste à passer par la valeur d'une seule unité avant de remonter. C'est plus lent que les produits croisés et l'on s'y trompe beaucoup moins, parce que chaque étape reste interprétable.

Les échelles fonctionnent sur le même principe de rapport. Au 1:50 000, un centimètre sur la carte vaut cinquante mille centimètres sur le terrain, soit cinq cents mètres. Les longueurs suivent le rapport, mais les aires suivent son carré : un mètre carré vaut dix mille centimètres carrés, et non cent. C'est l'erreur qui coûte le plus de points.

Reste la question des ordres de grandeur, indispensable dès qu'on parle de temps profond. « Ma » signifie million d'années, si bien que 500 Ma s'écrit 5 × 10⁸ ans. La notation scientifique n'est utile qu'à une condition : garder la mantisse entre 1 et 10, faute de quoi on ne compare plus rien.`

};

Object.keys(RAPPELS).forEach(id=>{
  const p=PACKS.find(x=>x.id===id);
  if(p) p.theorie=RAPPELS[id].trim();
});

/* ================================================================
   Bloc 18 : rééquilibrage des options de QCM.

   DIAGNOSTIC. Sur les 752 questions à choix de l'atlas, la bonne
   réponse était la plus longue des quatre dans 67 % des cas, contre
   25 % attendus au hasard, et 1,76 fois plus longue que la moyenne
   des leurres. Autrement dit : on pouvait répondre juste deux fois
   sur trois en choisissant la ligne la plus longue, sans rien
   connaître au sujet. Pour une application qui prétend apprendre
   quelque chose, c'est un défaut de fond — elle entraînait à deviner.

   CAUSE. Une dissymétrie de forme, pas de contenu. La bonne réponse
   était rédigée comme une proposition complète, portant la nuance et
   les réserves ; les leurres étaient de courts groupes nominaux,
   souvent invraisemblables. Deux signaux s'ajoutaient : les leurres
   contenaient des absolus (« jamais », « aucun », « toujours ») qui
   trahissent le faux, et quelques-uns étaient si grossiers qu'ils ne
   leurraient personne.

   CORRECTION. Trois règles appliquées à chaque question reprise :
     1. la clé est ramenée à une réponse, la nuance passant dans
        l'explication, qui est faite pour ça ;
     2. les leurres deviennent des énoncés parallèles à la clé —
        même nature grammaticale, longueur du même ordre, contenu
        plausible pour qui a mal révisé plutôt qu'absurde ;
     3. aucun absolu dans un leurre s'il n'y en a pas dans la clé.

   PORTÉE. Ce bloc traite les deux banques les plus atteintes,
   `philomonde` (ratio 2,50) et `biologie` (2,33). Les autres restent
   à reprendre ; `tools/qcm.js` mesure l'écart banque par banque et
   `qc.js` refuse toute aggravation.
   ================================================================ */

/* Les items de `biologie` avaient été écrits sans champ `n`, si bien que
   l'interface affichait « undefined » partout où le numéro est repris. */
(function numeroterBiologie(){
  const p=PACKS.find(x=>x.id==='biologie');
  if(p) p.bank().forEach((it,i)=>{ if(it.n===undefined) it.n=i+1; });
})();

const OPTIONS_REVUES={

philomonde:[
[1,"Un traité philosophique éthiopien du XVIIᵉ siècle",
 ["Un recueil de prières de l’Église copte","Une chronique des rois du Gondar","Un traité de médecine traduit de l’arabe au XVIᵉ siècle"]],
[2,"À Descartes, pour avoir fondé sa réflexion sur le doute",
 ["À Platon, pour sa théorie des Idées séparées du sensible","À Aristote, pour sa classification des vivants","À Marx, pour sa critique de l’économie politique"]],
[3,"Un orientaliste l’a jugé fabriqué par le moine qui l’a fait connaître",
 ["Deux versions du texte se contrediraient entièrement","Le manuscrit original aurait brûlé avant tout examen","Sa datation oscillerait entre le XVᵉ siècle et l’époque coloniale"]],
[4,"Que de telles idées n’étaient pas à attendre en Éthiopie",
 ["Que le manuscrit était trop récent pour être tenu pour original","Que la langue employée trahissait un copiste tardif","Que l’auteur n’est cité par aucune autre source"]],
[5,"Une analyse statistique du style, comparée aux écrits d’Urbino",
 ["Un témoignage oral recueilli auprès des moines du monastère du Gondar","La datation au carbone 14 du parchemin du manuscrit","Un second manuscrit du même texte retrouvé au Caire"]],
[6,"Des chercheurs éthiopiens et occidentaux se trouvent des deux côtés",
 ["Les chercheurs éthiopiens y croient, les occidentaux non","La question est tenue pour réglée depuis les années 1970","Le sujet n’est plus travaillé par personne depuis une trentaine d’années"]],
[7,"Les « connaisseurs des choses », lettrés du Mexique préhispanique",
 ["Les prêtres chargés du calendrier et des sacrifices","Les gouverneurs des provinces soumises au pouvoir de Tenochtitlan","Les scribes qui tenaient les registres du tribut"]],
[8,"La poésie, tenue pour le seul moyen de dire quelque chose de vrai",
 ["Le rite funéraire réservé aux guerriers tombés au combat au loin","Le cycle agricole qui règle les semailles et la récolte","L’impôt en nature versé par les cités vassales"]],
[9,"La cohésion d’un groupe, moteur de la montée des dynasties",
 ["L’impôt foncier prélevé sur les terres conquises","L’école de droit dominante dans le Maghreb de son époque","Le genre littéraire des chroniques de cour"]],
[10,"Une expérience de pensée sur la conscience de soi",
 ["Un traité d’astronomie sur le mouvement des sphères","Une méthode de calcul héritée des mathématiciens indiens","Un poème mystique sur l’ascension de l’âme"]],
[11,"Que nous observons une succession constante, jamais une nécessité",
 ["Que la combustion est une illusion produite par les sens","Que le feu agit par une qualité cachée de sa substance","Que la cause véritable échappe par principe à l’entendement humain"]],
[12,"Par des traductions arabes, retraduites en latin dès le XIIᵉ siècle",
 ["Par des copies grecques conservées sans interruption à Rome","Par des papyrus exhumés en Égypte à l’époque moderne","Par la transmission jamais interrompue des écoles monastiques d’Irlande"]],
[13,"Un schéma à quatre branches : vrai, faux, les deux, ni l’un ni l’autre",
 ["Une méthode de méditation progressant en quatre étapes","Un recueil de quatre sutras que la tradition attribue au Bouddha","Une règle monastique fixant quatre interdits fondamentaux"]],
[14,"Presque uniquement par les citations de ses adversaires",
 ["Par ses traités complets, conservés dans des copies tardives","Par des inscriptions royales gravées sur des piliers","Par les récits des voyageurs chinois passés en Inde"]],
[15,"Sur le caractère bon ou mauvais de la nature humaine au départ",
 ["Sur la date de naissance et la biographie exacte de Confucius","Sur l’existence d’un ciel doté d’une volonté propre","Sur la légitimité de la guerre menée par un souverain"]],
[16,"La possibilité de distinguer avec certitude la veille du rêve",
 ["La réalité des animaux et leur place dans la nature","La valeur du travail manuel dans la conduite d’une vie juste","L’autorité que l’empereur tient du mandat du ciel"]],
[17,"Ils l’ont explicitement exclue, par des arguments écrits",
 ["Ils n’en ont jamais eu connaissance de leur vivant","Ils l’ont étudiée avec intérêt sans jamais la citer nommément","Ils l’ont tenue pour l’égale de la tradition grecque"]],
[18,"De prêter à un peuple entier une vision du monde unique",
 ["D’avoir été écrit en français plutôt qu’en langue locale","De s’appuyer trop lourdement sur les catégories d’Aristote","D’être trop bref pour un sujet d’une telle ampleur"]],
[19,"Que l’identité se constitue dans la relation, non avant elle",
 ["Que l’individu n’a aucune valeur propre en dehors du groupe","Que la solitude est une faute contre la communauté","Que l’autorité des anciens ne se discute jamais"]],
[20,"Elle définit des traditions diverses par ce qu’elles ne sont pas",
 ["Elle repose sur une découpe géographique trop récente","Elle confond les traditions religieuses et les traditions philosophiques","Elle laisse la Grèce antique hors de son propre champ"]]
],

biologie:[
[1,"De chitine renforcée de calcite",
 ["D’os dermique, comme les poissons cuirassés","De cartilage souple, comme les requins","De kératine épaisse, comme une corne"]],
[2,"Des mues abandonnées au cours de la croissance",
 ["Des œufs fossilisés en position de ponte","Des empreintes laissées par leur déplacement","Des rejets digestifs conservés dans le sédiment"]],
[3,"Leurs cristallins sont en calcite, un minéral",
 ["Leur vision s’étendait jusque dans l’infrarouge","Ils étaient portés par des pédoncules mobiles","Ils se reconstituaient après une blessure"]],
[4,"Il se protège en ne laissant dehors que sa carapace",
 ["Il se reproduit en enfermant sa ponte au centre","Il facilite la sortie de son ancienne carapace","Il augmente sa vitesse de nage en pleine eau"]],
[5,"Environ 270 millions d’années",
 ["Environ 30 millions d’années","Environ 800 millions d’années","Environ 5 millions d’années"]],
[6,"Aux échinodermes",
 ["Aux mollusques","Aux annélides","Aux arthropodes"]],
[7,"Dans les cinq rangées longitudinales de podia",
 ["Dans la couronne de tentacules qui entoure sa bouche","Dans la forme pentagonale de son ouverture buccale","Nulle part : elle a entièrement perdu ce caractère"]],
[8,"Elle expulse une partie de ses organes internes",
 ["Elle change de couleur pour se confondre au fond","Elle libère un nuage d’encre avant de s’enfuir","Elle se gonfle d’eau et se laisse emporter"]],
[9,"Un tissu dont la rigidité change en quelques secondes",
 ["Un muscle capable de repousser après amputation","Un tissu glandulaire qui sécrète un venin paralysant","Une couche de graisse qui isole des eaux froides"]],
[10,"Leur squelette se réduit à des spicules microscopiques",
 ["Le groupe n’est apparu qu’au cours du Cénozoïque","Elles ne vivent que dans des milieux d’eau douce","Leurs tissus se décomposent en quelques minutes"]],
[11,"De cartilage, parfois renforcé de sels de calcium",
 ["D’os compact, comme chez les poissons osseux","De chitine, comme chez les grands arthropodes","De kératine souple, sans minéralisation aucune"]],
[12,"Ce sont les mêmes structures : les dents dérivent des denticules",
 ["Ce sont des formations d’origines entièrement distinctes","Les écailles sont des dents usées puis rejetées vers l’arrière","Les dents sont des écailles qui se minéralisent après la mort"]],
[13,"En continu, par des rangées qui avancent vers l’avant",
 ["Une seule fois, au moment du passage à l’âge adulte","Jamais : la denture initiale le suit toute sa vie","Chaque année, à l’approche de la saison de reproduction"]],
[14,"À détecter les champs électriques des proies",
 ["À percevoir les odeurs à très grande distance","À mesurer la pression et donc la profondeur","À produire de la lumière dans les eaux sombres"]],
[15,"Par un foie volumineux, riche en huile peu dense",
 ["Par des poumons hérités d’ancêtres d’eau douce","En avalant de l’air à la surface avant de plonger","Par des cavités remplies de gaz dans son cartilage"]],
[16,"Des artiodactyles, les mammifères à doigts pairs",
 ["Des carnivores, proches des phoques et des otaries","Des périssodactyles, à nombre de doigts impair","Des insectivores, proches des taupes et des musaraignes"]],
[17,"De kératine, comme les ongles et les cheveux",
 ["D’os spongieux issu des mâchoires","D’émail dentaire étiré en longues lames","De cartilage souple recouvert de muqueuse"]],
[18,"L’émission de clics et l’analyse de leur écho",
 ["L’émission de chants portant sur des centaines de kilomètres","L’orientation d’après le champ magnétique terrestre","La détection des courants par les récepteurs de la peau"]],
[19,"Ses voies respiratoires sont séparées du tube digestif",
 ["Ses poumons ont disparu au profit d’échanges cutanés","Sa bouche reste hermétiquement close sous l’eau","Elle absorbe l’oxygène dissous par la paroi de la gorge"]],
[20,"Une convergence évolutive",
 ["Une homologie","Une hérédité commune récente","Un atavisme"]]
]

};

(function appliquerOptionsRevues(){
  Object.keys(OPTIONS_REVUES).forEach(id=>{
    const p=PACKS.find(x=>x.id===id); if(!p) return;
    const banque=p.bank();
    OPTIONS_REVUES[id].forEach(([n,r,autres])=>{
      const it=banque.find(x=>x.n===n);
      if(!it) return;
      it.r=r; it.autres=autres;
    });
  });
})();
