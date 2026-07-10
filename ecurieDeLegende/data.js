/* ================= DONNÉES DU JEU (extrait de app.js, ordre d'origine préservé) =================
   Contenu : cartes, raretés, familles, royaumes, banques de questions, packs, fiches, mythes,
   aventure (étapes, mondes, mascottes), tutoriel. Chargé AVANT app.js. ================= */

const IMG={
metier_vendange:"cartes/metier_vendange.jpg",
equit_dressage:"cartes/equit_dressage.jpg",
robot_coruscant:"cartes/robot_coruscant.jpg",
robot_boston:"cartes/robot_boston.jpg",
robot_replicant:"cartes/robot_replicant.jpg",
robot_termicheval:"cartes/robot_termicheval.jpg",
robot_cheval_e:"cartes/robot_cheval_e.jpg",
robot_galli:"cartes/robot_galli.jpg",
metier_tram:"cartes/metier_tram.jpg",
metier_brasseur:"cartes/metier_brasseur.jpg",
metier_debardeur:"cartes/metier_debardeur.jpg",
antique_grece:"cartes/antique_grece.jpg",
antique_celte:"cartes/antique_celte.jpg",
antique_egyptien:"cartes/antique_egyptien.jpg",
antique_perse:"cartes/antique_perse.jpg",
antique_mogol_imperial:"cartes/antique_mogol_imperial.jpg",
route_epices:"cartes/route_epices.jpg",
route_transsahara:"cartes/route_transsahara.jpg",
route_sel:"cartes/route_sel.jpg",
route_soie:"cartes/route_soie.jpg",
route_ambre:"cartes/route_ambre.jpg",
equit_polo:"cartes/equit_polo.jpg",
equit_enduro:"cartes/equit_enduro.jpg",
equit_attelage:"cartes/equit_attelage.jpg",
robot_helico:"cartes/robot_helico.jpg",
robot_amphibie:"cartes/robot_amphibie.jpg",
robot_lowtech:"cartes/robot_lowtech.jpg",
robot_maximilian:"cartes/robot_maximilian.jpg",
mythique_xanthos:"cartes/mythique_xanthos.jpg",
mythique_balios:"cartes/mythique_balios.jpg",
mythique_enbarr:"cartes/mythique_enbarr.jpg",
mythique_grani:"cartes/mythique_grani.jpg",
mythique_gringolet:"cartes/mythique_gringolet.jpg",
mythique_kanthaka:"cartes/mythique_kanthaka.jpg",
mythique_rakhsh:"cartes/mythique_rakhsh.jpg",
mythique_veillantif:"cartes/mythique_veillantif.jpg",
plantes_lierre:"cartes/plantes_lierre.jpg",
plantes_cactus:"cartes/plantes_cactus.jpg",
plantes_chene:"cartes/plantes_chene.jpg",
plantes_roses:"cartes/plantes_roses.jpg",
plantes_nenuphar:"cartes/plantes_nenuphar.jpg",
robot_cryo:"cartes/robot_cryo.jpg",
robot_eclaireur:"cartes/robot_eclaireur.jpg",
robot_prototype:"cartes/robot_prototype.jpg",
robot_solaire:"cartes/robot_solaire.jpg",
course_frankel:"cartes/course_frankel.jpg",
course_manowar:"cartes/course_manowar.jpg",
course_pharlap:"cartes/course_pharlap.jpg",
course_seabiscuit:"cartes/course_seabiscuit.jpg",
course_zenyatta:"cartes/course_zenyatta.jpg",
gourmand_mangeur_de_pommes:"cartes/gourmand_mangeur_de_pommes.jpg",
gourmand_mangeur_de_carottes:"cartes/gourmand_mangeur_de_carottes.jpg",
gourmand_mangeur_de_citrouilles:"cartes/gourmand_mangeur_de_citrouilles.jpg",
gourmand_mangeur_de_grain:"cartes/gourmand_mangeur_de_grain.jpg",
gourmand_mangeur_de_trefle:"cartes/gourmand_mangeur_de_trefle.jpg",
licorne_antique_orientale:"cartes/licorne_antique_orientale.jpg",
licorne_apothicaire:"cartes/licorne_apothicaire.jpg",
licorne_contemporaine_pride:"cartes/licorne_contemporaine_pride.jpg",
licorne_bestiaire_medieval:"cartes/licorne_bestiaire_medieval.jpg",
licorne_heraldique_ecossaise:"cartes/licorne_heraldique_ecossaise.jpg",
band_pink_pop_queen:"cartes/band_pink_pop_queen.jpg",
band_starfire_diva:"cartes/band_starfire_diva.jpg",
band_golden_ace:"cartes/band_golden_ace.jpg",
band_moon_prince:"cartes/band_moon_prince.jpg",
band_crystal_princess:"cartes/band_crystal_princess.jpg",
band_purple_rebel:"cartes/band_purple_rebel.jpg",
band_electric_shadow:"cartes/band_electric_shadow.jpg",
band_steel_phantom:"cartes/band_steel_phantom.jpg",
band_midnight_lead:"cartes/band_midnight_lead.jpg",
band_pastel_dream:"cartes/band_pastel_dream.jpg",
beasts_qirin:"cartes/beasts_qirin.jpg",
beasts_longma:"cartes/beasts_longma.jpg",
beasts_alicorne:"cartes/beasts_alicorne.jpg",
beasts_hippogriffe:"cartes/beasts_hippogriffe.jpg",
beasts_hypalectryon:"cartes/beasts_hypalectryon.jpg",
mustang_indien:"cartes/mustang_indien.jpg",
maman_cheval:"cartes/maman_cheval.jpg",
roi_montagnes:"cartes/roi_montagnes.jpg",
poney_heureux:"cartes/poney_heureux.jpg",
licorne:"cartes/licorne.jpg",
hippocampe:"cartes/hippocampe.jpg",
cheval_enfers:"cartes/cheval_enfers.jpg",
cheval_tournoi:"cartes/cheval_tournoi.jpg",
cheval_cirque:"cartes/cheval_cirque.jpg",
cheval_charbonnier:"cartes/cheval_charbonnier.jpg",
belle_champs:"cartes/belle_champs.jpg",
cheval_neptune:"cartes/cheval_neptune.jpg",
cheval_laboureur:"cartes/cheval_laboureur.jpg",
ane_tetu:"cartes/ane_tetu.jpg",
cheval_troie:"cartes/cheval_troie.jpg",
cheval_romain:"cartes/cheval_romain.jpg",
cheval_chinois:"cartes/cheval_chinois.jpg",
centaure:"cartes/centaure.jpg",
uchchaihshravas:"cartes/uchchaihshravas.jpg",
sleipnir:"cartes/sleipnir.jpg",
licorne_girly:"cartes/licorne_girly.jpg",
cheval_diligence:"cartes/cheval_diligence.jpg",
al_bouraq:"cartes/al_bouraq.jpg",
poulain:"cartes/poulain.jpg",
matsukaze:"cartes/matsukaze.jpg",
cheval_fourrure:"cartes/cheval_fourrure.jpg",
ane_egyptien:"cartes/ane_egyptien.jpg",
cheval_champignon:"cartes/cheval_champignon.jpg",
kelpie:"cartes/kelpie.jpg",
cheval_cyberpunk:"cartes/cheval_cyberpunk.jpg",
secretariat:"cartes/secretariat.jpg",
bayard:"cartes/bayard.jpg",
cheval_rose:"cartes/cheval_rose.jpg",
bucephale:"cartes/bucephale.jpg",
cheval_carrosse:"cartes/cheval_carrosse.jpg",
zebre:"cartes/zebre.jpg",
cheval_obstacle:"cartes/cheval_obstacle.jpg",
cheval_desert:"cartes/cheval_desert.jpg",
cheval_armure:"cartes/cheval_armure.jpg",
cheval_eclair:"cartes/cheval_eclair.jpg",
cheval_police:"cartes/cheval_police.jpg",
cheval_boucle:"cartes/cheval_boucle.jpg",
cheval_punk:"cartes/cheval_punk.jpg",
cheval_gourmand:"cartes/cheval_gourmand.jpg",
cheval_cowboy:"cartes/cheval_cowboy.jpg",
cheval_fantome:"cartes/cheval_fantome.jpg",
pegase:"cartes/pegase.jpg",
etalon:"cartes/etalon.jpg",
bebe_poney:"cartes/bebe_poney.jpg",
cheval_royal:"cartes/cheval_royal.jpg",
poney_shetland:"cartes/poney_shetland.jpg",
cheval_pompier:"cartes/cheval_pompier.jpg",
cheval_constellation:"cartes/cheval_constellation.jpg",
cheval_porcelaine:"cartes/cheval_porcelaine.jpg",
cheval_facteur:"cartes/cheval_facteur.jpg",
cheval_teutonique:"cartes/cheval_teutonique.jpg",
cheval_albinos:"cartes/cheval_albinos.jpg",
cheval_viking:"cartes/cheval_viking.jpg",
cheval_cosaque:"cartes/cheval_cosaque.jpg",
cheval_conquistador:"cartes/cheval_conquistador.jpg",
cheval_halage:"cartes/cheval_halage.jpg",
cheval_samurai:"cartes/cheval_samurai.jpg",
akhal_teke:"cartes/akhal_teke.jpg",
frison:"cartes/frison.jpg",
shire:"cartes/shire.jpg",
appaloosa:"cartes/appaloosa.jpg",
marwari:"cartes/marwari.jpg",
andalou:"cartes/andalou.jpg",
arabe:"cartes/arabe.jpg",
fjord:"cartes/fjord.jpg",
gypsy_cob:"cartes/gypsy_cob.jpg",
brabancon:"cartes/brabancon.jpg",
murgese:"cartes/murgese.jpg",
kaltblut:"cartes/kaltblut.jpg",
dulmener:"cartes/dulmener.jpg",
lusitanien:"cartes/lusitanien.jpg",
boulonnais:"cartes/boulonnais.jpg",
haflinger:"cartes/haflinger.jpg",
camargue:"cartes/camargue.jpg",
ardennais:"cartes/ardennais.jpg",
franches_montagnes:"cartes/franches_montagnes.jpg",
cheval_rivieres:"cartes/cheval_rivieres.jpg",
cheval_abysses:"cartes/cheval_abysses.jpg",
cheval_corail:"cartes/cheval_corail.jpg",
cheval_nuages:"cartes/cheval_nuages.jpg",
cheval_glace:"cartes/cheval_glace.jpg",
pieter_jan:"cartes/pieter_jan.jpg",
francois_camargue:"cartes/francois_camargue.jpg",
big_ben:"cartes/big_ben.jpg",
inge:"cartes/inge.jpg",
rocio:"cartes/rocio.jpg",
yakutian:"cartes/yakutian.jpg",
curly:"cartes/curly.jpg",
falabella:"cartes/falabella.jpg",
finnhorse:"cartes/finnhorse.jpg",
islandais:"cartes/islandais.jpg",
kladruber:"cartes/kladruber.jpg",
knabstrupper:"cartes/knabstrupper.jpg",
konik:"cartes/konik.jpg",
lipizzan:"cartes/lipizzan.jpg",
mangalarga_marchador:"cartes/mangalarga_marchador.jpg",
nonius:"cartes/nonius.jpg",
orlov:"cartes/orlov.jpg",
welsh_pony:"cartes/welsh_pony.jpg",
basotho:"cartes/basotho.jpg",
caspien:"cartes/caspien.jpg",
connemara:"cartes/connemara.jpg",
eriskay:"cartes/eriskay.jpg",
exmoor:"cartes/exmoor.jpg",
fell:"cartes/fell.jpg",
highland:"cartes/highland.jpg",
hutsul:"cartes/hutsul.jpg",
merens:"cartes/merens.jpg",
cheval_pale_mort:"cartes/cheval_pale_mort.jpg",
cheval_rouge_guerre:"cartes/cheval_rouge_guerre.jpg",
helhest:"cartes/helhest.jpg",
dullahan:"cartes/dullahan.jpg",
mari_lwyd:"cartes/mari_lwyd.jpg",
metal_or:"cartes/metal_or.jpg",
metal_argent:"cartes/metal_argent.jpg",
metal_acier:"cartes/metal_acier.jpg",
metal_fer:"cartes/metal_fer.jpg",
metal_aluminium:"cartes/metal_aluminium.jpg",
metal_zinc:"cartes/metal_zinc.jpg",
metal_etain:"cartes/metal_etain.jpg",
ET_aetheris:"cartes/ET_aetheris.jpg",
ET_crysalune:"cartes/ET_crysalune.jpg",
ET_octalyre:"cartes/ET_octalyre.jpg",
ET_nerethys:"cartes/ET_nerethys.jpg",
ET_solkaris:"cartes/ET_solkaris.jpg",
ET_mycelion:"cartes/ET_mycelion.jpg",
ET_phalenora:"cartes/ET_phalenora.jpg",
ET_mantheor:"cartes/ET_mantheor.jpg",
ET_scarabeon:"cartes/ET_scarabeon.jpg",
ET_lumea:"cartes/ET_lumea.jpg",
metal_bronze:"cartes/metal_bronze.jpg",
precieux_diamant:"cartes/precieux_diamant.jpg",
precieux_rubis:"cartes/precieux_rubis.jpg",
precieux_emeraude:"cartes/precieux_emeraude.jpg",
precieux_sapphire:"cartes/precieux_sapphire.jpg",
precieux_jade:"cartes/precieux_jade.jpg",
precieux_amethyste:"cartes/precieux_amethyste.jpg",
precieux_obsidienne:"cartes/precieux_obsidienne.jpg",
precieux_email:"cartes/precieux_email.jpg",
precieux_vitrail:"cartes/precieux_vitrail.jpg",
planet_jupiter:"cartes/planet_jupiter.jpg",
planet_saturne:"cartes/planet_saturne.jpg",
planet_terre:"cartes/planet_terre.jpg",
planet_mars:"cartes/planet_mars.jpg",
planet_neptune:"cartes/planet_neptune.jpg",
planet_uranus:"cartes/planet_uranus.jpg",
planet_venus:"cartes/planet_venus.jpg",
planet_mercure:"cartes/planet_mercure.jpg",
  mythe_tulpar:"cartes/mythe_tulpar.jpg",
  mythe_morvarch:"cartes/mythe_morvarch.jpg",
  mythe_lou_drape:"cartes/mythe_lou_drape.jpg",
  mythe_caballo_marino:"cartes/mythe_caballo_marino.jpg",
  mythe_each_uisge:"cartes/mythe_each_uisge.jpg",
  mythe_cabbyl_ushtey:"cartes/mythe_cabbyl_ushtey.jpg",
  mythe_puca:"cartes/mythe_puca.jpg",
  mythe_ceffyl_dwr:"cartes/mythe_ceffyl_dwr.jpg",
  mythe_ak_kula:"cartes/mythe_ak_kula.jpg",
  mythe_shabdiz:"cartes/mythe_shabdiz.jpg",
  mythe_ama_no_fuchigoma:"cartes/mythe_ama_no_fuchigoma.jpg",
  mythe_liath_macha:"cartes/mythe_liath_macha.jpg",
  mythe_hrimfaxi:"cartes/mythe_hrimfaxi.jpg",
  mythe_svadilfari:"cartes/mythe_svadilfari.jpg",
  mythe_gullfaxi:"cartes/mythe_gullfaxi.jpg",
  mythe_areion:"cartes/mythe_areion.jpg",
  mythe_akbuzat:"cartes/mythe_akbuzat.jpg",
  mythe_chollima:"cartes/mythe_chollima.jpg",
  mythe_skinfaxi:"cartes/mythe_skinfaxi.jpg",
  mythe_sleipnir_rainbow:"cartes/mythe_sleipnir_rainbow.jpg",
  idol_blue_laser:"cartes/idol_blue_laser.jpg",
  idol_max_maximum:"cartes/idol_max_maximum.jpg",
  idol_candy_crushy:"cartes/idol_candy_crushy.jpg",
  idol_princess_glitter:"cartes/idol_princess_glitter.jpg",
  ecurie_timide:"cartes/ecurie_timide.jpg",
  ecurie_peureux:"cartes/ecurie_peureux.jpg",
  ecurie_simplet:"cartes/ecurie_simplet.jpg",
  ecurie_jeune_fou:"cartes/ecurie_jeune_fou.jpg",
  ecurie_original:"cartes/ecurie_original.jpg",
  ecurie_rigide:"cartes/ecurie_rigide.jpg",
  ecurie_costaud:"cartes/ecurie_costaud.jpg",
  ecurie_marginal:"cartes/ecurie_marginal.jpg",
  ecurie_jument_appliquee:"cartes/ecurie_jument_appliquee.jpg",
  ecurie_vieux_ronchon:"cartes/ecurie_vieux_ronchon.jpg",
  ecurie_artiste:"cartes/ecurie_artiste.jpg",
  ecurie_intello:"cartes/ecurie_intello.jpg",
  ecurie_play_boy:"cartes/ecurie_play_boy.jpg",
  ecurie_bad_boy:"cartes/ecurie_bad_boy.jpg",
  ecurie_prom_queen:"cartes/ecurie_prom_queen.jpg",
  ecurie_vieux_sage:"cartes/ecurie_vieux_sage.jpg",
};
const CARTES = [
  {id:"mustang_indien",nom:"Mustang indien",rarete:"commune",emoji:"🐎",image:IMG.mustang_indien,desc:"Cheval sauvage des grandes plaines, fidèle compagnon des peuples amérindiens.",aff:["vitesse","endurance"],familles:["sauvages","bataille"],royaume:"amerique"},
  {id:"maman_cheval",nom:"Maman cheval",rarete:"commune",emoji:"🐴",image:IMG.maman_cheval,desc:"Une maman pleine de douceur veille sur son petit poulain.",aff:["beaute","endurance"],familles:["pres"],royaume:"belgique"},
  {id:"roi_montagnes",nom:"Le roi des montagnes",rarete:"commune",emoji:"🐴",image:IMG.roi_montagnes,desc:"Fier et puissant, il règne sur les sommets balayés par le vent.",aff:["force","endurance"],familles:["sauvages"],royaume:"norvege"},
  {id:"poney_heureux",nom:"Le poney heureux",rarete:"commune",emoji:"🐴",image:IMG.poney_heureux,desc:"Petit, ébouriffé et toujours de bonne humeur dans les prés fleuris.",aff:["beaute"],familles:["pres"],royaume:"belgique"},
  {id:"licorne",nom:"La licorne",rarete:"legendaire",emoji:"🦄",image:IMG.licorne,desc:"Créature magique à la corne d'or, elle n'apparaît qu'aux cœurs purs.",aff:["beaute","magie"],familles:["legende"],royaume:"avalon"},
  {id:"hippocampe",nom:"L'hippocampe",rarete:"epique",emoji:"🐴",image:IMG.hippocampe,desc:"Mi-cheval, mi-poisson, il file entre les vagues et les coraux.",aff:["vitesse","magie"],familles:["elementaires","legende"],royaume:"grece"},
  {id:"cheval_enfers",nom:"Le cheval des enfers",rarete:"epique",emoji:"🐴",image:IMG.cheval_enfers,desc:"Né du feu et de la lave, son galop fait trembler la terre.",aff:["force","bataille"],familles:["elementaires","legende"],royaume:"avalon"},
  {id:"cheval_tournoi",nom:"Le cheval de tournoi",rarete:"rare",emoji:"🐎",image:IMG.cheval_tournoi,desc:"Paré de fleurs de lys, il porte les couleurs de son chevalier.",aff:["bataille","beaute"],familles:["bataille"],royaume:"france"},
  {id:"cheval_cirque",nom:"Le cheval de cirque",rarete:"commune",emoji:"🐎",image:IMG.cheval_cirque,desc:"Sous les lumières et les plumes, il danse pour émerveiller la foule.",aff:["beaute","vitesse"],familles:["race"],royaume:"france"},
  {id:"cheval_charbonnier",nom:"Le cheval du charbonnier",rarete:"commune",emoji:"🐴",image:IMG.cheval_charbonnier,desc:"Vaillant cheval de trait, il tire la lourde charrette de charbon.",aff:["force","endurance"],familles:["travail"],royaume:"angleterre"},
  {id:"belle_champs",nom:"La belle des champs",rarete:"commune",emoji:"🐴",image:IMG.belle_champs,desc:"Sa crinière dorée brille au soleil couchant des prairies.",aff:["beaute"],familles:["pres"],royaume:"belgique"},
  {id:"cheval_neptune",nom:"Le cheval de Neptune",rarete:"legendaire",emoji:"🦄",image:IMG.cheval_neptune,desc:"Monture du dieu des mers, il galope au fond des océans.",aff:["magie","vitesse"],familles:["elementaires","legende"],royaume:"grece"},
  {id:"cheval_laboureur",nom:"Le cheval laboureur",rarete:"commune",emoji:"🐴",image:IMG.cheval_laboureur,desc:"Robuste et patient, il retourne la terre aux côtés du fermier.",aff:["force","endurance"],familles:["travail"],royaume:"belgique"},
  {id:"ane_tetu",nom:"L'âne têtu",rarete:"commune",emoji:"🐴",image:IMG.ane_tetu,desc:"Petit mais courageux… et parfois un peu entêté !",aff:["endurance"],familles:["sauvages"],royaume:"belgique"},
  {id:"cheval_troie",nom:"Le cheval de Troie",rarete:"legendaire",emoji:"🐴",image:IMG.cheval_troie,desc:"Le célèbre cheval de bois qui cachait les guerriers grecs.",aff:["bataille","force"],familles:["bataille","legende"],royaume:"grece"},
  {id:"cheval_romain",nom:"Le cheval romain",rarete:"rare",emoji:"🐎",image:IMG.cheval_romain,desc:"Fidèle destrier des légions, il portait les cavaliers de Rome.",aff:["bataille","endurance"],familles:["bataille"],royaume:"rome"},
  {id:"cheval_chinois",nom:"Le cheval chinois antique",rarete:"rare",emoji:"🐎",image:IMG.cheval_chinois,desc:"Paré de soie et d'or, il défilait dans les palais impériaux.",aff:["beaute","magie"],familles:["race","bataille"],royaume:"chine"},
  {id:"centaure",nom:"Le centaure",rarete:"legendaire",emoji:"🦄",image:IMG.centaure,desc:"Moitié homme, moitié cheval, gardien sage des forêts anciennes.",aff:["bataille","force"],familles:["legende","bataille"],royaume:"grece"},
  {id:"uchchaihshravas",nom:"Uchchaihshravas",rarete:"mythique",emoji:"🐉",image:IMG.uchchaihshravas,desc:"Le cheval blanc à sept têtes, né du barattage de l'océan de lait.",aff:["magie","vitesse","beaute"],familles:["legende"],royaume:"inde"},
  {id:"sleipnir",nom:"Sleipnir",rarete:"celeste",emoji:"🐉",image:IMG.sleipnir,desc:"Le destrier à huit jambes d'Odin, plus rapide que le vent.",aff:["vitesse","endurance","magie"],familles:["legende"],royaume:"norvege"},
  {id:"licorne_girly",nom:"La licorne girly",rarete:"rare",emoji:"🦄",image:IMG.licorne_girly,desc:"Une licorne de conte de fées, crinière arc-en-ciel et cœurs scintillants.",aff:["beaute","magie"],familles:["legende","pres"],royaume:"avalon"},
  {id:"cheval_diligence",nom:"Le cheval de diligence",rarete:"commune",emoji:"🐎",image:IMG.cheval_diligence,desc:"Fidèle cheval de poste, il tire la diligence sur les routes de France.",aff:["endurance","vitesse"],familles:["travail","bataille"],royaume:"france"},
  {id:"al_bouraq",nom:"Al-Bouraq",rarete:"mythique",emoji:"🕊️",image:IMG.al_bouraq,desc:"La monture ailée au visage humain, plus rapide que l'éclair entre ciel et terre.",aff:["vitesse","magie","beaute"],familles:["legende"],royaume:"arabie"},
  {id:"poulain",nom:"Poulain",rarete:"commune",emoji:"🐴",image:IMG.poulain,desc:"Un tout jeune poulain qui gambade pour la première fois dans le pré.",aff:["beaute"],familles:["pres"],royaume:"belgique"},
  {id:"matsukaze",nom:"Matsukaze",rarete:"mythique",emoji:"🐎",image:IMG.matsukaze,desc:"« Vent dans les pins » : le destrier noir des samouraïs, rapide et fier.",aff:["bataille","force","vitesse"],familles:["bataille","legende"],royaume:"japon"},
  {id:"cheval_fourrure",nom:"Le cheval à fourrure",rarete:"commune",emoji:"🐴",image:IMG.cheval_fourrure,desc:"Sa crinière dorée sans fin ondule comme une rivière au vent des montagnes.",aff:["beaute","endurance"],familles:["sauvages","race"],royaume:"norvege"},
  {id:"ane_egyptien",nom:"L'âne égyptien",rarete:"commune",emoji:"🫏",image:IMG.ane_egyptien,desc:"Vaillant âne des bâtisseurs, il tire les blocs des grandes pyramides.",aff:["force","endurance"],familles:["sauvages","travail"],royaume:"egypte"},
  {id:"cheval_champignon",nom:"Le cheval champignon",rarete:"epique",emoji:"🍄",image:IMG.cheval_champignon,desc:"Esprit de la forêt enchantée, couvert de mousses et de champignons.",aff:["magie","endurance"],familles:["legende","elementaires","plantes"],royaume:"avalon"},
  {id:"kelpie",nom:"Le Kelpie",rarete:"epique",emoji:"🌊",image:IMG.kelpie,desc:"Cheval des lochs d'Écosse, il surgit de l'eau au crépuscule.",aff:["vitesse","magie"],familles:["elementaires","legende"],royaume:"ecosse"},
  {id:"cheval_cyberpunk",nom:"Le cheval cyberpunk",rarete:"rare",emoji:"🤖",image:IMG.cheval_cyberpunk,desc:"Destrier de néon et d'acier, il galope dans la cité du futur.",aff:["vitesse","bataille"],familles:["course","robot"],royaume:"amerique"},
  {id:"secretariat",nom:"Secrétariat",rarete:"legendaire",emoji:"🏇",image:IMG.secretariat,desc:"Le plus grand champion de course : ses records de vitesse tiennent encore aujourd'hui.",aff:["vitesse","endurance"],familles:["course"],royaume:"amerique"},
  {id:"bayard",nom:"Le cheval Bayard",rarete:"mythique",emoji:"🐎",image:IMG.bayard,desc:"Le cheval-fée qui grandissait pour porter les quatre fils Aymon.",aff:["force","magie"],familles:["legende","bataille"],royaume:"france"},
  {id:"cheval_rose",nom:"Le cheval rose",rarete:"commune",emoji:"🌸",image:IMG.cheval_rose,desc:"Un cheval tout rose et scintillant, sorti d'un rêve de printemps.",aff:["beaute"],familles:["pres","legende"],royaume:"avalon"},
  {id:"bucephale",nom:"Bucéphale",rarete:"mythique",emoji:"⚔️",image:IMG.bucephale,desc:"L'indomptable destrier d'Alexandre le Grand, brave au cœur de la bataille.",aff:["bataille","force"],familles:["bataille","legende"],royaume:"grece"},
  {id:"cheval_carrosse",nom:"Cheval de carrosse",rarete:"rare",emoji:"🎠",image:IMG.cheval_carrosse,desc:"Fier cheval d'attelage, il mène le carrosse doré des grandes occasions.",aff:["force","beaute"],familles:["travail","race"],royaume:"france"},
  {id:"zebre",nom:"Zèbre",rarete:"commune",emoji:"🦓",image:IMG.zebre,desc:"Cousin sauvage du cheval, il file dans la savane, zébré de noir et de blanc.",aff:["vitesse","endurance"],familles:["sauvages"],royaume:"afrique"},
  {id:"cheval_obstacle",nom:"Cheval d'obstacle",rarete:"rare",emoji:"🏇",image:IMG.cheval_obstacle,desc:"Champion de saut, il franchit les plus hautes barres sous les acclamations.",aff:["vitesse","force"],familles:["equitation"],royaume:"angleterre"},
  {id:"cheval_desert",nom:"Cheval du désert",rarete:"rare",emoji:"🏜️",image:IMG.cheval_desert,desc:"Pur-sang arabe des sables, infatigable sous le soleil du désert.",aff:["endurance","vitesse"],familles:["race","course"],royaume:"arabie"},
  {id:"cheval_armure",nom:"Cheval en armure",rarete:"epique",emoji:"🛡️",image:IMG.cheval_armure,desc:"Destrier bardé d'acier, il porte le chevalier au cœur de la mêlée.",aff:["bataille","endurance"],familles:["bataille"],royaume:"camelot"},
  {id:"cheval_eclair",nom:"Cheval éclair",rarete:"legendaire",emoji:"⚡",image:IMG.cheval_eclair,desc:"Spectre d'orage, il surgit dans les éclairs et disparaît dans la nuit.",aff:["magie","vitesse"],familles:["elementaires","legende"],royaume:"avalon"},
  {id:"cheval_police",nom:"Cheval de police",rarete:"rare",emoji:"🐴",image:IMG.cheval_police,desc:"Monture calme et courageuse de la police montée, rien ne l'effraie dans la foule.",aff:["bataille","endurance"],familles:["travail","bataille"],royaume:"angleterre"},
  {id:"cheval_boucle",nom:"Cheval bouclé",rarete:"commune",emoji:"🐴",image:IMG.cheval_boucle,desc:"Sa robe et sa crinière tout en boucles le rendent unique, tout droit sorti d'un rêve.",aff:["beaute","endurance"],familles:["pres"],royaume:"amerique"},
  {id:"cheval_punk",nom:"Cheval punk",rarete:"rare",emoji:"🎸",image:IMG.cheval_punk,desc:"Crête colorée et cuir clouté : le rebelle des rues de la ville.",aff:["bataille","vitesse"],familles:["course"],royaume:"amerique"},
  {id:"cheval_gourmand",nom:"Cheval gourmand",rarete:"commune",emoji:"🍎",image:IMG.cheval_gourmand,desc:"Toujours à croquer une pomme — le plus gourmand de toute l'écurie !",aff:["endurance","beaute"],familles:["pres"],royaume:"belgique"},
  {id:"cheval_cowboy",nom:"Cheval cow-boy",rarete:"rare",emoji:"🤠",image:IMG.cheval_cowboy,desc:"Fidèle monture du cow-boy, il connaît chaque piste du Far West.",aff:["vitesse","endurance"],familles:["course","sauvages"],royaume:"amerique"},
  {id:"cheval_fantome",nom:"Cheval fantôme",rarete:"rare",emoji:"👻",image:IMG.cheval_fantome,desc:"Un cheval translucide qui traverse la nuit sans bruit, entre les mondes.",aff:["magie","endurance"],familles:["legende"],royaume:"avalon"},
  {id:"pegase",nom:"Pégase",rarete:"celeste",emoji:"🕊️",image:IMG.pegase,desc:"Le cheval ailé de la mythologie grecque : il s'envole jusqu'à l'Olympe.",aff:["vitesse","magie"],familles:["legende"],royaume:"grece"},
  {id:"etalon",nom:"Étalon",rarete:"commune",emoji:"🐎",image:IMG.etalon,desc:"Un étalon fier et robuste, roi de la prairie.",aff:["force","beaute"],familles:["pres","race"],royaume:"belgique"},
  {id:"bebe_poney",nom:"Bébé poney",rarete:"commune",emoji:"🐴",image:IMG.bebe_poney,desc:"Un adorable petit poney qui découvre le monde à petits pas.",aff:["beaute","vitesse"],familles:["pres"],royaume:"belgique"},
  {id:"cheval_royal",nom:"Cheval royal",rarete:"epique",emoji:"👑",image:IMG.cheval_royal,desc:"Paré des armes du roi, il porte fièrement les couleurs du royaume.",aff:["beaute","bataille"],familles:["bataille","race"],royaume:"france"},
  {id:"poney_shetland",nom:"Poney Shetland",rarete:"commune",emoji:"🐴",image:IMG.poney_shetland,desc:"Petit mais costaud : le poney shetland tire plus lourd que lui, têtu et rustique.",aff:["force","endurance"],familles:["pres","sauvages"],royaume:"ecosse"},
  {id:"cheval_pompier",nom:"Cheval pompier",rarete:"commune",emoji:"🚒",image:IMG.cheval_pompier,desc:"Vaillant cheval des pompiers, il fonce dans la ville en flammes.",aff:["force","vitesse"],familles:["travail","bataille"],royaume:"angleterre"},
  {id:"cheval_constellation",nom:"Cheval constellation",rarete:"legendaire",emoji:"🌌",image:IMG.cheval_constellation,desc:"Sa robe est un ciel étoilé ; il galope parmi les constellations.",aff:["magie","vitesse"],familles:["legende","elementaires"],royaume:"avalon"},
  {id:"cheval_porcelaine",nom:"Cheval de porcelaine",rarete:"rare",emoji:"🏺",image:IMG.cheval_porcelaine,desc:"Sculpté dans la porcelaine bleue et blanche, précieux et délicat.",aff:["beaute","magie"],familles:["race","legende"],royaume:"chine"},
  {id:"cheval_facteur",nom:"Cheval facteur",rarete:"commune",emoji:"📮",image:IMG.cheval_facteur,desc:"Il porte le courrier de village en village, par tous les temps.",aff:["vitesse","endurance"],familles:["travail","bataille"],royaume:"angleterre"},
  {id:"cheval_teutonique",nom:"Cheval teutonique",rarete:"epique",emoji:"✝️",image:IMG.cheval_teutonique,desc:"Destrier des chevaliers teutoniques, à la croix noire, dans la neige.",aff:["bataille","force"],familles:["bataille"],royaume:"allemagne"},
  {id:"cheval_albinos",nom:"Cheval albinos",rarete:"commune",emoji:"🤍",image:IMG.cheval_albinos,desc:"Blanc immaculé aux yeux clairs, d'une beauté rare et pure.",aff:["beaute"],familles:["race"],royaume:"amerique"},
  {id:"cheval_viking",nom:"Cheval viking",rarete:"rare",emoji:"🛡️",image:IMG.cheval_viking,desc:"Robuste monture des Vikings, débarquée des drakkars du Nord.",aff:["force","endurance"],familles:["sauvages","bataille"],royaume:"norvege"},
  {id:"cheval_cosaque",nom:"Cheval cosaque",rarete:"commune",emoji:"🐎",image:IMG.cheval_cosaque,desc:"Monture infatigable des cavaliers des steppes.",aff:["vitesse","bataille"],familles:["course","bataille"],royaume:"steppe"},
  {id:"cheval_conquistador",nom:"Cheval conquistador",rarete:"epique",emoji:"⚔️",image:IMG.cheval_conquistador,desc:"Il porta les conquistadors à travers jungles et cités anciennes.",aff:["bataille","endurance"],familles:["bataille"],royaume:"espagne"},
  {id:"cheval_halage",nom:"Cheval de halage",rarete:"commune",emoji:"⚓",image:IMG.cheval_halage,desc:"Attelé à la corde, il tire les péniches le long des canaux.",aff:["force","endurance"],familles:["travail","elementaires"],royaume:"belgique"},
  {id:"cheval_samurai",nom:"Cheval samouraï",rarete:"epique",emoji:"🎌",image:IMG.cheval_samurai,desc:"Destrier bardé d'un samouraï, fidèle jusqu'au dernier combat.",aff:["bataille","vitesse"],familles:["bataille"],royaume:"japon"},
  {id:"akhal_teke",nom:"Akhal-Téké",rarete:"epique",emoji:"🥇",image:IMG.akhal_teke,desc:"Le cheval d'or du désert, à la robe métallique, rapide et endurant.",aff:["vitesse","beaute"],familles:["race","course"],royaume:"steppe"},
  {id:"frison",nom:"Frison",rarete:"epique",emoji:"🐴",image:IMG.frison,desc:"Élégant cheval noir de Frise, crinière et fanons soyeux.",aff:["beaute","force"],familles:["race","bataille"],royaume:"pays_bas"},
  {id:"shire",nom:"Shire",rarete:"epique",emoji:"🐴",image:IMG.shire,desc:"L'un des plus grands chevaux du monde, un géant tout en douceur.",aff:["force","endurance"],familles:["race","travail"],royaume:"angleterre"},
  {id:"appaloosa",nom:"Appaloosa",rarete:"rare",emoji:"🐴",image:IMG.appaloosa,desc:"Cheval tacheté des plaines, monture des peuples amérindiens.",aff:["vitesse","endurance"],familles:["race","sauvages"],royaume:"amerique"},
  {id:"marwari",nom:"Marwari",rarete:"epique",emoji:"🐴",image:IMG.marwari,desc:"Cheval indien aux oreilles recourbées qui se touchent, fier et vif.",aff:["bataille","vitesse"],familles:["race","bataille"],royaume:"inde"},
  {id:"andalou",nom:"Andalou",rarete:"epique",emoji:"🐴",image:IMG.andalou,desc:"Noble cheval d'Espagne, danseur né des plus belles écoles.",aff:["beaute","bataille"],familles:["race","bataille"],royaume:"espagne"},
  {id:"arabe",nom:"Cheval arabe",rarete:"epique",emoji:"🐴",image:IMG.arabe,desc:"L'ancêtre de tous les chevaux rapides, né des sables d'Arabie.",aff:["vitesse","beaute"],familles:["race","course"],royaume:"arabie"},
  {id:"fjord",nom:"Fjord",rarete:"rare",emoji:"🐴",image:IMG.fjord,desc:"Petit cheval norvégien à la crinière bicolore taillée en brosse.",aff:["force","endurance"],familles:["race","travail","sauvages"],royaume:"norvege"},
  {id:"gypsy_cob",nom:"Gypsy Cob",rarete:"rare",emoji:"🐴",image:IMG.gypsy_cob,desc:"Cheval pie des gens du voyage, aux fanons blancs abondants.",aff:["beaute","force"],familles:["race","travail"],royaume:"irlande"},
  {id:"brabancon",nom:"Le Brabançon",rarete:"epique",emoji:"🇧🇪",image:IMG.brabancon,desc:"La fierté de la Belgique : le géant de trait, doux et puissant.",aff:["force","endurance"],familles:["race","travail"],royaume:"belgique"},
  {id:"murgese",nom:"Murgese",rarete:"epique",emoji:"🐴",image:IMG.murgese,desc:"Élégant cheval noir d'Italie, jadis monture des chevaliers des Pouilles.",aff:["beaute","bataille"],familles:["race","bataille"],royaume:"italie"},
  {id:"kaltblut",nom:"Kaltblut",rarete:"rare",emoji:"🐴",image:IMG.kaltblut,desc:"Puissant cheval de trait allemand, un colosse au grand cœur.",aff:["force","endurance"],familles:["race","travail"],royaume:"allemagne"},
  {id:"dulmener",nom:"Dülmener",rarete:"commune",emoji:"🐴",image:IMG.dulmener,desc:"Poney sauvage d'Allemagne, libre dans les landes depuis des siècles.",aff:["endurance","vitesse"],familles:["race","sauvages"],royaume:"allemagne"},
  {id:"lusitanien",nom:"Lusitanien",rarete:"epique",emoji:"🐴",image:IMG.lusitanien,desc:"Noble cheval du Portugal, danseur et compagnon des cavaliers de cape.",aff:["beaute","bataille"],familles:["race","bataille"],royaume:"portugal"},
  {id:"boulonnais",nom:"Boulonnais",rarete:"rare",emoji:"🐴",image:IMG.boulonnais,desc:"Le « pur-sang » des chevaux de trait, blanc et racé, du nord de la France.",aff:["force","beaute"],familles:["race","travail"],royaume:"france"},
  {id:"haflinger",nom:"Haflinger",rarete:"commune",emoji:"🐴",image:IMG.haflinger,desc:"Petit cheval doré des montagnes d'Autriche, robuste et gentil.",aff:["endurance","beaute"],familles:["race","pres"],royaume:"autriche"},
  {id:"camargue",nom:"Camargue",rarete:"epique",emoji:"🐴",image:IMG.camargue,desc:"Cheval blanc des marais de Camargue, né les pieds dans l'eau.",aff:["endurance","vitesse"],familles:["race","elementaires","sauvages"],royaume:"france"},
  {id:"ardennais",nom:"Ardennais",rarete:"rare",emoji:"🐴",image:IMG.ardennais,desc:"Cheval de trait des Ardennes, force tranquille du Luxembourg.",aff:["force","endurance"],familles:["race","travail"],royaume:"luxembourg"},
  {id:"franches_montagnes",nom:"Franches-Montagnes",rarete:"rare",emoji:"🐴",image:IMG.franches_montagnes,desc:"La fierté de la Suisse, dernier cheval de trait léger d'Europe.",aff:["force","endurance"],familles:["race","travail"],royaume:"suisse"},
  {id:"cheval_rivieres",nom:"Cheval des rivières",rarete:"rare",emoji:"🏞️",image:IMG.cheval_rivieres,desc:"Esprit des rivières claires, il court sur l'eau sans jamais s'enfoncer.",aff:["magie","vitesse"],familles:["elementaires","legende"],royaume:"avalon"},
  {id:"cheval_abysses",nom:"Cheval des abysses",rarete:"legendaire",emoji:"🌌",image:IMG.cheval_abysses,desc:"Créature des grands fonds, illuminée de lueurs bleues dans la nuit des abysses.",aff:["magie","force"],familles:["elementaires","legende"],royaume:"avalon"},
  {id:"cheval_corail",nom:"Cheval corail",rarete:"rare",emoji:"🪸",image:IMG.cheval_corail,desc:"Né dans les récifs, sa crinière est un jardin de corail vivant.",aff:["beaute","magie"],familles:["elementaires","legende"],royaume:"avalon"},
  {id:"cheval_nuages",nom:"Cheval des nuages",rarete:"epique",emoji:"☁️",image:IMG.cheval_nuages,desc:"Cheval de brume et de nuages, il galope dans le ciel entre deux averses.",aff:["magie","vitesse"],familles:["elementaires","legende"],royaume:"avalon"},
  {id:"cheval_glace",nom:"Cheval de glace",rarete:"rare",emoji:"❄️",image:IMG.cheval_glace,desc:"Sculpté dans la glace éternelle, il souffle le froid des banquises.",aff:["magie","beaute"],familles:["elementaires","legende"],royaume:"avalon"},
  {id:"pieter_jan",nom:"Pieter-Jan le Cheval",rarete:"legendaire",emoji:"🏆",image:IMG.pieter_jan,desc:"Le fier étalon pommelé de Belgique, mascotte du royaume et champion de tous les chevaux de trait.",aff:["force","endurance"],familles:["mascotte","travail","legende"],royaume:"belgique"},
{id:"francois_camargue",nom:"François de Camargue",rarete:"legendaire",emoji:"🤍",image:IMG.francois_camargue,desc:"Le fier étalon blanc de Camargue, mascotte de France. Né bai foncé, le soleil du Sud l'a blanchi année après année, jusqu'à devenir aussi clair que l'écume des étangs.",aff:["endurance","beaute"],familles:["mascotte","sauvages","legende"],royaume:"france"},
{id:"big_ben",nom:"Big Ben le Shire",rarete:"legendaire",emoji:"🐴",image:IMG.big_ben,desc:"Le plus grand cheval du monde, doux géant d'Angleterre. Il descend du « grand cheval » qui portait les chevaliers en armure — et ses ancêtres venaient de Flandre, comme Pieter-Jan !",aff:["force","endurance"],familles:["mascotte","travail","legende"],royaume:"angleterre"},
{id:"inge",nom:"Inge la Frisonne",rarete:"legendaire",emoji:"🖤",image:IMG.inge,desc:"La perle noire des Pays-Bas, mascotte du Rhin. Élégante danseuse au long crin ondulé, elle a influencé le Shire — cousine de Big Ben et de Pieter-Jan !",aff:["beaute","endurance"],familles:["mascotte","legende"],royaume:"pays_bas"},
{id:"rocio",nom:"Rocío l'Andalouse",rarete:"legendaire",emoji:"🤍",image:IMG.rocio,desc:"Le cheval royal d'Espagne, de Pure Race Espagnole. Grise virant au blanc, au long crin ondulé, elle sait danser. Ses cousins sont partis sur les bateaux devenir les premiers chevaux d'Amérique !",aff:["beaute","vitesse"],familles:["mascotte","legende"],royaume:"espagne"},
  {id:"band_pink_pop_queen",nom:"Pink Pop Queen",rarete:"epique",emoji:"👑",image:IMG.band_pink_pop_queen,desc:"La reine de la pop : sous les projecteurs roses, elle fait chavirer les foules.",aff:["beaute","magie"],familles:["band"],royaume:"scene"},
  {id:"band_starfire_diva",nom:"Starfire Diva",rarete:"epique",emoji:"🌟",image:IMG.band_starfire_diva,desc:"Diva étoilée, elle enflamme la scène d'un galop scintillant.",aff:["beaute","vitesse"],familles:["band"],royaume:"scene"},
  {id:"band_golden_ace",nom:"Golden Ace",rarete:"epique",emoji:"⭐",image:IMG.band_golden_ace,desc:"L'as doré du show : crinière de feu et pas de danse endiablés.",aff:["vitesse","beaute"],familles:["band"],royaume:"scene"},
  {id:"band_moon_prince",nom:"Moon Prince",rarete:"epique",emoji:"🌙",image:IMG.band_moon_prince,desc:"Prince de la nuit, il brille d'un éclat argenté au clair de lune.",aff:["beaute","magie"],familles:["band"],royaume:"scene"},
  {id:"band_crystal_princess",nom:"Crystal Princess",rarete:"epique",emoji:"💎",image:IMG.band_crystal_princess,desc:"Princesse de cristal, chaque pas fait tinter mille éclats scintillants.",aff:["beaute","magie"],familles:["band"],royaume:"scene"},
  {id:"band_purple_rebel",nom:"Purple Rebel",rarete:"rare",emoji:"🎸",image:IMG.band_purple_rebel,desc:"Rebelle à la crinière violette, elle bouscule les codes de la scène.",aff:["bataille","beaute"],familles:["band"],royaume:"scene"},
  {id:"band_electric_shadow",nom:"Electric Shadow",rarete:"rare",emoji:"⚡",image:IMG.band_electric_shadow,desc:"Ombre électrique, il surgit dans un éclair bleu sur le dancefloor.",aff:["vitesse","bataille"],familles:["band"],royaume:"scene"},
  {id:"band_steel_phantom",nom:"Steel Phantom",rarete:"rare",emoji:"🖤",image:IMG.band_steel_phantom,desc:"Fantôme d'acier, silhouette froide sous les néons de la ville.",aff:["force","vitesse"],familles:["band"],royaume:"scene"},
  {id:"band_midnight_lead",nom:"Midnight Lead",rarete:"rare",emoji:"🎤",image:IMG.band_midnight_lead,desc:"Leader de minuit, sa voix noire hypnotise la salle entière.",aff:["bataille","force"],familles:["band"],royaume:"scene"},
  {id:"band_pastel_dream",nom:"Pastel Dream",rarete:"rare",emoji:"🎀",image:IMG.band_pastel_dream,desc:"Rêve pastel tout en douceur, rubans et cœurs à l'infini.",aff:["beaute"],familles:["band"],royaume:"scene"},
  {id:"beasts_qirin",nom:"Le Qilin",rarete:"celeste",emoji:"🐉",image:IMG.beasts_qirin,desc:"Chimère bienveillante des légendes chinoises, il annonce les temps heureux.",aff:["magie","beaute"],familles:["legende"],royaume:"chine"},
  {id:"beasts_longma",nom:"Le Longma",rarete:"mythique",emoji:"🐲",image:IMG.beasts_longma,desc:"Cheval-dragon surgi du fleuve, il porte les sages sur son dos ailé.",aff:["magie","vitesse"],familles:["legende"],royaume:"chine"},
  {id:"beasts_alicorne",nom:"L'Alicorne",rarete:"celeste",emoji:"🦄",image:IMG.beasts_alicorne,desc:"Elle unit la corne de la licorne et les ailes du pégase, reine des cieux.",aff:["magie","beaute"],familles:["legende"],royaume:"avalon"},
  {id:"beasts_hippogriffe",nom:"L'Hippogriffe",rarete:"mythique",emoji:"🦅",image:IMG.beasts_hippogriffe,desc:"Moitié aigle moitié cheval, il franchit les montagnes d'un seul bond.",aff:["vitesse","bataille"],familles:["legende"],royaume:"grece"},
  {id:"beasts_hypalectryon",nom:"L'Hippalectryon",rarete:"mythique",emoji:"🐓",image:IMG.beasts_hypalectryon,desc:"Cheval à l'arrière de coq, il gardait les vases de la Grèce antique.",aff:["force","magie"],familles:["legende"],royaume:"grece"},
  {id:"course_frankel",nom:"Frankel",rarete:"legendaire",emoji:"🏇",image:IMG.course_frankel,desc:"Invaincu en quatorze courses, le plus grand galopeur anglais de l'ère moderne.",aff:["vitesse","endurance"],familles:["course"],royaume:"angleterre"},
  {id:"course_manowar",nom:"Man o' War",rarete:"legendaire",emoji:"🏇",image:IMG.course_manowar,desc:"Champion américain des années 1920, il écrasait ses rivaux de vingt longueurs.",aff:["vitesse","force"],familles:["course"],royaume:"amerique"},
  {id:"course_pharlap",nom:"Phar Lap",rarete:"legendaire",emoji:"🏇",image:IMG.course_pharlap,desc:"Le cheval géant qui redonna espoir à l'Australie de la Grande Dépression.",aff:["vitesse","endurance"],familles:["course"],royaume:"australie"},
  {id:"course_seabiscuit",nom:"Seabiscuit",rarete:"legendaire",emoji:"🏇",image:IMG.course_seabiscuit,desc:"Petit cheval mal aimé devenu le héros de toute l'Amérique.",aff:["vitesse","endurance"],familles:["course"],royaume:"amerique"},
  {id:"course_zenyatta",nom:"Zenyatta",rarete:"legendaire",emoji:"🏇",image:IMG.course_zenyatta,desc:"Reine de la piste, célèbre pour son finish foudroyant et sa danse d'avant-course.",aff:["vitesse","beaute"],familles:["course"],royaume:"amerique"},
  {id:"gourmand_mangeur_de_pommes",nom:"Le mangeur de pommes",rarete:"commune",emoji:"🍎",image:IMG.gourmand_mangeur_de_pommes,desc:"Rien ne le rend plus heureux qu'un verger croulant de pommes bien mûres.",aff:["endurance","force"],familles:["pres"],royaume:"belgique"},
  {id:"gourmand_mangeur_de_carottes",nom:"Le mangeur de carottes",rarete:"commune",emoji:"🥕",image:IMG.gourmand_mangeur_de_carottes,desc:"Il croque les carottes du potager à longueur de journée.",aff:["endurance","vitesse"],familles:["pres"],royaume:"belgique"},
  {id:"gourmand_mangeur_de_citrouilles",nom:"Le mangeur de citrouilles",rarete:"commune",emoji:"🎃",image:IMG.gourmand_mangeur_de_citrouilles,desc:"À l'automne, il fait la fête parmi les citrouilles orange.",aff:["force","endurance"],familles:["pres"],royaume:"belgique"},
  {id:"gourmand_mangeur_de_grain",nom:"Le mangeur de grain",rarete:"commune",emoji:"🌾",image:IMG.gourmand_mangeur_de_grain,desc:"Bien au chaud dans l'écurie, il plonge le nez dans le grain doré.",aff:["force","endurance"],familles:["pres"],royaume:"belgique"},
  {id:"gourmand_mangeur_de_trefle",nom:"Le mangeur de trèfle",rarete:"commune",emoji:"🍀",image:IMG.gourmand_mangeur_de_trefle,desc:"Allongé dans le trèfle, il savoure les fleurs sucrées du pré.",aff:["beaute","endurance"],familles:["pres"],royaume:"belgique"},
  {id:"licorne_antique_orientale",nom:"Licorne antique orientale",rarete:"epique",emoji:"🦄",image:IMG.licorne_antique_orientale,desc:"Monture précieuse des palais d'Orient, parée d'or et de turquoise.",aff:["beaute","magie"],familles:["licorne"],royaume:"arabie"},
  {id:"licorne_apothicaire",nom:"Licorne d'apothicaire",rarete:"epique",emoji:"🦄",image:IMG.licorne_apothicaire,desc:"Sa corne, dit-on, purifiait les poisons dans les cabinets de curiosités.",aff:["magie","beaute"],familles:["licorne"],royaume:"france"},
  {id:"licorne_contemporaine_pride",nom:"Licorne contemporaine Pride",rarete:"epique",emoji:"🦄",image:IMG.licorne_contemporaine_pride,desc:"Crinière arc-en-ciel, elle défile fièrement au cœur de la ville en fête.",aff:["beaute","magie"],familles:["licorne"],royaume:"amerique"},
  {id:"licorne_bestiaire_medieval",nom:"Licorne de bestiaire médiéval",rarete:"legendaire",emoji:"🦄",image:IMG.licorne_bestiaire_medieval,desc:"Tout droit sortie des tapisseries et des bestiaires du Moyen Âge.",aff:["beaute","magie"],familles:["licorne"],royaume:"france"},
  {id:"licorne_heraldique_ecossaise",nom:"Licorne héraldique écossaise",rarete:"legendaire",emoji:"🦄",image:IMG.licorne_heraldique_ecossaise,desc:"Emblème couronné du royaume d'Écosse, enchaînée mais indomptée.",aff:["magie","bataille"],familles:["licorne"],royaume:"ecosse"},
  {id:"mythique_xanthos",nom:"Xanthos",rarete:"mythique",emoji:"🐎",image:IMG.mythique_xanthos,desc:"Cheval immortel d'Achille, doué de parole et de prophétie.",aff:["vitesse","magie"],familles:["legende","bataille"],royaume:"grece"},
  {id:"mythique_balios",nom:"Balios",rarete:"mythique",emoji:"🐎",image:IMG.mythique_balios,desc:"Frère immortel de Xanthos, né du vent, monture d'Achille à Troie.",aff:["vitesse","force"],familles:["legende","bataille"],royaume:"grece"},
  {id:"mythique_enbarr",nom:"Enbarr",rarete:"mythique",emoji:"🌊",image:IMG.mythique_enbarr,desc:"Cheval de Manannán, il galope aussi bien sur la mer que sur la terre.",aff:["vitesse","magie"],familles:["legende","elementaires"],royaume:"irlande"},
  {id:"mythique_grani",nom:"Grani",rarete:"mythique",emoji:"🐎",image:IMG.mythique_grani,desc:"Descendant de Sleipnir, fidèle destrier du héros Sigurd.",aff:["force","bataille"],familles:["legende","bataille"],royaume:"norvege"},
  {id:"mythique_gringolet",nom:"Gringolet",rarete:"mythique",emoji:"🐎",image:IMG.mythique_gringolet,desc:"Le puissant destrier de messire Gauvain, chevalier de la Table ronde.",aff:["bataille","endurance"],familles:["legende","bataille"],royaume:"camelot"},
  {id:"mythique_kanthaka",nom:"Kanthaka",rarete:"mythique",emoji:"🤍",image:IMG.mythique_kanthaka,desc:"Le cheval blanc qui porta le prince Siddhârta vers l'éveil.",aff:["beaute","endurance"],familles:["legende"],royaume:"inde"},
  {id:"mythique_rakhsh",nom:"Rakhsh",rarete:"mythique",emoji:"🐎",image:IMG.mythique_rakhsh,desc:"Le fougueux étalon du héros Rostam, seul à supporter son poids.",aff:["force","bataille"],familles:["legende","bataille"],royaume:"perse"},
  {id:"mythique_veillantif",nom:"Veillantif",rarete:"mythique",emoji:"⚔️",image:IMG.mythique_veillantif,desc:"Le destrier de Roland, compagnon des batailles de Roncevaux.",aff:["bataille","vitesse"],familles:["legende","bataille"],royaume:"france"},
  {id:"plantes_lierre",nom:"Cheval de lierre",rarete:"rare",emoji:"🌿",image:IMG.plantes_lierre,desc:"Tout de lierre vêtu, il veille sur les forêts anciennes.",aff:["magie","endurance"],familles:["plantes"],royaume:"avalon"},
  {id:"plantes_cactus",nom:"Cheval cactus",rarete:"rare",emoji:"🌵",image:IMG.plantes_cactus,desc:"Hérissé d'épines et de fleurs, il traverse le désert sans jamais avoir soif.",aff:["force","endurance"],familles:["plantes"],royaume:"amerique"},
  {id:"plantes_chene",nom:"Cheval de chêne",rarete:"rare",emoji:"🌳",image:IMG.plantes_chene,desc:"Fait de bois et de feuilles d'automne, robuste comme un vieux chêne.",aff:["force","endurance"],familles:["plantes"],royaume:"avalon"},
  {id:"plantes_roses",nom:"Cheval des roses",rarete:"rare",emoji:"🌹",image:IMG.plantes_roses,desc:"Paré de roses grimpantes, il embaume les jardins enchantés.",aff:["beaute","magie"],familles:["plantes"],royaume:"avalon"},
  {id:"plantes_nenuphar",nom:"Cheval nénuphar",rarete:"rare",emoji:"🪷",image:IMG.plantes_nenuphar,desc:"Né des étangs, il danse parmi les nénuphars au lever du soleil.",aff:["beaute","magie"],familles:["plantes"],royaume:"avalon"},
  {id:"robot_cryo",nom:"Cheval cryo",rarete:"rare",emoji:"❄️",image:IMG.robot_cryo,desc:"Blindé de glace et de circuits, il patrouille les banquises polaires.",aff:["force","endurance"],familles:["robot"],royaume:"futur"},
  {id:"robot_eclaireur",nom:"Éclaireur des forêts",rarete:"rare",emoji:"🛰️",image:IMG.robot_eclaireur,desc:"Robot d'exploration furtif, il cartographie les forêts sans un bruit.",aff:["vitesse","endurance"],familles:["robot"],royaume:"futur"},
  {id:"robot_prototype",nom:"Prototype moderne",rarete:"rare",emoji:"⚙️",image:IMG.robot_prototype,desc:"Dernier prototype rutilant, tout en chrome et articulations parfaites.",aff:["vitesse","force"],familles:["robot"],royaume:"futur"},
  {id:"robot_solaire",nom:"Cheval solaire",rarete:"rare",emoji:"☀️",image:IMG.robot_solaire,desc:"Alimenté par ses panneaux solaires, il galope à l'infini sous le soleil.",aff:["endurance","vitesse"],familles:["robot"],royaume:"futur"},
  {id:"yakutian",nom:"Cheval yakoute",rarete:"epique",emoji:"🐴",image:IMG.yakutian,desc:"Ce petit cheval de Sibérie survit aux hivers les plus glacés grâce à son épaisse fourrure.",aff:["endurance","force"],familles:["race","sauvages"],royaume:"russie"},
  {id:"curly",nom:"Curly",rarete:"epique",emoji:"🐴",image:IMG.curly,desc:"Sa robe et sa crinière tout en boucles le rendent doux et unique parmi les chevaux.",aff:["beaute","endurance"],familles:["race"],royaume:"amerique"},
  {id:"falabella",nom:"Falabella",rarete:"epique",emoji:"🐴",image:IMG.falabella,desc:"Le plus petit cheval du monde, minuscule mais élégant, venu des plaines d'Argentine.",aff:["beaute","endurance"],familles:["race"],royaume:"argentine"},
  {id:"finnhorse",nom:"Finnhorse",rarete:"epique",emoji:"🐴",image:IMG.finnhorse,desc:"Fier cheval de Finlande, à la fois travailleur robuste et coureur agile.",aff:["force","endurance"],familles:["race","travail"],royaume:"finlande"},
  {id:"islandais",nom:"Cheval islandais",rarete:"epique",emoji:"🐴",image:IMG.islandais,desc:"Petit cheval d'Islande à la crinière abondante, célèbre pour son allure spéciale, le tölt.",aff:["endurance","vitesse"],familles:["race"],royaume:"islande"},
  {id:"kladruber",nom:"Kladruber",rarete:"epique",emoji:"🐴",image:IMG.kladruber,desc:"Majestueux cheval blanc de la cour impériale, né pour tirer les carrosses de gala.",aff:["beaute","force"],familles:["race","bataille"],royaume:"autriche"},
  {id:"knabstrupper",nom:"Knabstrupper",rarete:"epique",emoji:"🐴",image:IMG.knabstrupper,desc:"Cheval danois à la robe léopard, tacheté comme un manteau d'étoiles.",aff:["beaute","endurance"],familles:["race"],royaume:"danemark"},
  {id:"konik",nom:"Konik",rarete:"epique",emoji:"🐴",image:IMG.konik,desc:"Petit cheval de Pologne, robuste descendant des chevaux sauvages des forêts.",aff:["endurance","force"],familles:["race","sauvages"],royaume:"pologne"},
  {id:"lipizzan",nom:"Lipizzan",rarete:"epique",emoji:"🐴",image:IMG.lipizzan,desc:"L'étoile blanche de l'École espagnole de Vienne, danseur des plus belles figures.",aff:["beaute","endurance"],familles:["race","bataille"],royaume:"autriche"},
  {id:"mangalarga_marchador",nom:"Mangalarga Marchador",rarete:"epique",emoji:"🐴",image:IMG.mangalarga_marchador,desc:"Cheval brésilien à l'allure douce et glissée, infatigable sur les longues distances.",aff:["endurance","vitesse"],familles:["race"],royaume:"bresil"},
  {id:"nonius",nom:"Nonius",rarete:"epique",emoji:"🐴",image:IMG.nonius,desc:"Puissant cheval noir de Hongrie, élégant meneur d'attelage et fidèle au travail.",aff:["force","beaute"],familles:["race","travail"],royaume:"hongrie"},
  {id:"orlov",nom:"Trotteur Orlov",rarete:"epique",emoji:"🐴",image:IMG.orlov,desc:"Célèbre trotteur de Russie à la robe gris pommelé, taillé pour la vitesse et l'endurance.",aff:["vitesse","endurance"],familles:["race","course"],royaume:"russie"},
  {id:"welsh_pony",nom:"Poney Welsh",rarete:"rare",emoji:"🐴",image:IMG.welsh_pony,desc:"Petit poney des collines galloises, vif et élégant sous sa crinière dorée.",aff:["beaute","vitesse"],familles:["race","pres"],royaume:"galles"},
  {id:"basotho",nom:"Poney Basotho",rarete:"rare",emoji:"🐴",image:IMG.basotho,desc:"Poney robuste des hauts plateaux d'Afrique australe, sûr sur les sentiers de montagne.",aff:["endurance","force"],familles:["race","sauvages"],royaume:"afrique"},
  {id:"caspien",nom:"Caspian",rarete:"rare",emoji:"🐴",image:IMG.caspien,desc:"Minuscule cheval ancien de Perse, fin et rapide comme aux temps des rois.",aff:["vitesse","beaute"],familles:["race","course"],royaume:"perse"},
  {id:"connemara",nom:"Poney Connemara",rarete:"rare",emoji:"🐴",image:IMG.connemara,desc:"Poney irlandais gris pommelé, sauteur né des landes battues par le vent.",aff:["vitesse","endurance"],familles:["race","course"],royaume:"irlande"},
  {id:"eriskay",nom:"Poney d'Eriskay",rarete:"rare",emoji:"🐴",image:IMG.eriskay,desc:"Rare poney gris des îles écossaises, doux et courageux face aux tempêtes.",aff:["endurance","beaute"],familles:["race","sauvages"],royaume:"ecosse"},
  {id:"exmoor",nom:"Poney d'Exmoor",rarete:"rare",emoji:"🐴",image:IMG.exmoor,desc:"Poney primitif des landes anglaises, au museau clair et à la fourrure épaisse.",aff:["endurance","force"],familles:["race","sauvages"],royaume:"angleterre"},
  {id:"fell",nom:"Poney Fell",rarete:"rare",emoji:"🐴",image:IMG.fell,desc:"Poney noir des collines du Nord, aux longs fanons soyeux et au pas sûr.",aff:["force","endurance"],familles:["race","travail"],royaume:"angleterre"},
  {id:"highland",nom:"Poney Highland",rarete:"rare",emoji:"🐴",image:IMG.highland,desc:"Solide poney des Highlands d'Écosse, tout-terrain infatigable des montagnes.",aff:["force","endurance"],familles:["race","travail"],royaume:"ecosse"},
  {id:"hutsul",nom:"Poney Hutsul",rarete:"rare",emoji:"🐴",image:IMG.hutsul,desc:"Poney des Carpates, agile et rustique sur les sentiers forestiers escarpés.",aff:["endurance","force"],familles:["race","sauvages"],royaume:"ukraine"},
  {id:"merens",nom:"Mérens",rarete:"rare",emoji:"🐴",image:IMG.merens,desc:"Petit cheval noir des Pyrénées, sûr et robuste sur les chemins de montagne.",aff:["endurance","beaute"],familles:["race","sauvages"],royaume:"france"},
  {id:"cheval_pale_mort",nom:"Le cheval pâle de la Mort",rarete:"celeste",emoji:"💀",image:IMG.cheval_pale_mort,desc:"Monture spectrale du dernier des cavaliers, elle avance là où tout s'éteint.",aff:["magie","bataille"],familles:["sombres","legende"],royaume:"outremonde"},
  {id:"cheval_rouge_guerre",nom:"Le cheval rouge de la Guerre",rarete:"celeste",emoji:"🔥",image:IMG.cheval_rouge_guerre,desc:"Étalon de flammes du cavalier de la Guerre, il enflamme les champs de bataille.",aff:["bataille","force"],familles:["sombres","bataille"],royaume:"outremonde"},
  {id:"helhest",nom:"Helhest",rarete:"mythique",emoji:"👻",image:IMG.helhest,desc:"Le cheval à trois jambes de la déesse Hel, dont le passage annonce la mort dans les brumes du Nord.",aff:["magie","endurance"],familles:["sombres","legende"],royaume:"danemark"},
  {id:"dullahan",nom:"Dullahan",rarete:"legendaire",emoji:"⚔️",image:IMG.dullahan,desc:"La monture noire aux yeux de feu du cavalier sans tête des légendes d'Irlande.",aff:["bataille","vitesse"],familles:["sombres","legende"],royaume:"irlande"},
  {id:"mari_lwyd",nom:"Mari Lwyd",rarete:"legendaire",emoji:"🎭",image:IMG.mari_lwyd,desc:"Crâne de jument enrubanné du Pays de Galles, qui frappe aux portes en chantant au cœur de l'hiver.",aff:["magie","beaute"],familles:["sombres"],royaume:"galles"},
  {id:"metier_tram",nom:"Le cheval de tramway",rarete:"commune",emoji:"🚋",image:IMG.metier_tram,desc:"Dans les rues pavées d'autrefois, il tirait le tram et tout son monde.",aff:["force","endurance"],familles:["travail"],royaume:"belgique"},
  {id:"metier_brasseur",nom:"Le cheval de brasseur",rarete:"rare",emoji:"🍺",image:IMG.metier_brasseur,desc:"Fier colosse des brasseries, il livre les tonneaux de porte en porte.",aff:["force"],familles:["travail"],royaume:"belgique"},
  {id:"metier_debardeur",nom:"Le cheval débardeur",rarete:"commune",emoji:"🪵",image:IMG.metier_debardeur,desc:"En forêt, il tire les troncs là où aucune machine ne passe.",aff:["force","endurance"],familles:["travail"],royaume:"france"},
  {id:"antique_grece",nom:"Le cheval de la Grèce antique",rarete:"rare",emoji:"🏛️",image:IMG.antique_grece,desc:"Paré d'or et d'olivier, il défilait aux grandes fêtes d'Athènes.",aff:["beaute"],familles:["bataille","race"],royaume:"grece"},
  {id:"antique_celte",nom:"Le cheval des Celtes",rarete:"rare",emoji:"🌀",image:IMG.antique_celte,desc:"Compagnon des druides, entre pierres levées et forêts sacrées.",aff:["magie","endurance"],familles:["bataille","legende"],royaume:"irlande"},
  {id:"antique_egyptien",nom:"Le cheval des pharaons",rarete:"epique",emoji:"🛞",image:IMG.antique_egyptien,desc:"Attelé au char du pharaon, il volait sur les rives du Nil.",aff:["vitesse"],familles:["bataille"],royaume:"egypte"},
  {id:"antique_perse",nom:"Le cheval des rois de Perse",rarete:"epique",emoji:"👑",image:IMG.antique_perse,desc:"Couvert d'or et de pourpre, il paradait devant les palais de Persépolis.",aff:["beaute"],familles:["bataille"],royaume:"perse"},
  {id:"antique_mogol_imperial",nom:"Le cheval de l'Empire mongol",rarete:"legendaire",emoji:"🏹",image:IMG.antique_mogol_imperial,desc:"Petit, infatigable, invincible : il porta l'étendard du plus grand empire des steppes.",aff:["endurance"],familles:["bataille","sauvages"],royaume:"steppe"},
  {id:"route_epices",nom:"Le cheval de la route des épices",rarete:"rare",emoji:"🌶️",image:IMG.route_epices,desc:"Des quais parfumés aux bazars dorés, il porte safran et cannelle.",aff:["endurance"],familles:["travail"],royaume:"arabie"},
  {id:"route_transsahara",nom:"Le cheval des caravanes du Sahara",rarete:"rare",emoji:"🏜️",image:IMG.route_transsahara,desc:"D'oasis en oasis, il traverse les dunes avec la grande caravane.",aff:["endurance"],familles:["travail"],royaume:"afrique"},
  {id:"route_sel",nom:"Le cheval de la route du sel",rarete:"commune",emoji:"🧂",image:IMG.route_sel,desc:"Sur les sentiers de montagne, il porte l'or blanc : le sel.",aff:["force","endurance"],familles:["travail"],royaume:"suisse"},
  {id:"route_soie",nom:"Le cheval de la route de la soie",rarete:"epique",emoji:"🧵",image:IMG.route_soie,desc:"Chargé de soieries précieuses, il relie la Chine aux portes de l'Occident.",aff:["beaute","endurance"],familles:["travail"],royaume:"chine"},
  {id:"route_ambre",nom:"Le cheval de la route de l'ambre",rarete:"rare",emoji:"🟠",image:IMG.route_ambre,desc:"Des rives de la Baltique, il apporte l'ambre doré, les larmes du soleil.",aff:["endurance"],familles:["travail"],royaume:"pologne"},
  {id:"equit_polo",nom:"Le poney de polo",rarete:"rare",emoji:"🥍",image:IMG.equit_polo,desc:"Vif comme l'éclair, il pivote et sprinte au son du maillet.",aff:["vitesse"],familles:["equitation"],royaume:"argentine"},
  {id:"equit_enduro",nom:"Le cheval d'endurance",rarete:"rare",emoji:"🏁",image:IMG.equit_enduro,desc:"Cent kilomètres sous le soleil : rien n'arrête ce marathonien.",aff:["endurance"],familles:["equitation"],royaume:"arabie"},
  {id:"equit_attelage",nom:"Le cheval d'attelage sportif",rarete:"rare",emoji:"🛞",image:IMG.equit_attelage,desc:"Entre les cônes, au galop : la précision d'un athlète attelé.",aff:["force","vitesse"],familles:["equitation"],royaume:"hongrie"},
  {id:"robot_helico",nom:"Le cheval hélicoptère",rarete:"epique",emoji:"🚁",image:IMG.robot_helico,desc:"Ses pales rugissent : ce pur-sang mécanique décolle des sommets.",aff:["vitesse"],familles:["robot"],royaume:"futur"},
  {id:"robot_amphibie",nom:"Le cheval amphibie",rarete:"rare",emoji:"🌊",image:IMG.robot_amphibie,desc:"Palmes d'acier et hublots : il galope sous la mer comme sur terre.",aff:["endurance"],familles:["robot"],royaume:"futur"},
  {id:"robot_lowtech",nom:"Le cheval bricolé",rarete:"commune",emoji:"🔩",image:IMG.robot_lowtech,desc:"Assemblé de bric et de broc dans une grange — mais il tient la route !",aff:["force"],familles:["robot"],royaume:"futur"},
  {id:"robot_maximilian",nom:"Maximilian",rarete:"legendaire",emoji:"🔴",image:IMG.robot_maximilian,desc:"Le sombre étalon rouge et noir des confins de l'espace. Son œil ne cligne jamais.",aff:["bataille"],familles:["robot","sombres"],royaume:"futur"},
  {id:"metier_vendange",nom:"Le cheval des vendanges",rarete:"commune",emoji:"🍇",image:IMG.metier_vendange,desc:"Dans les vignes en terrasses, il rapporte les paniers de raisin doré.",aff:["force","endurance"],familles:["travail"],royaume:"france"},
  {id:"equit_dressage",nom:"Le cheval de dressage",rarete:"epique",emoji:"🎩",image:IMG.equit_dressage,desc:"Un danseur : chaque pas est une figure, sous les ors du manège.",aff:["beaute"],familles:["equitation"],royaume:"autriche"},
  {id:"robot_coruscant",nom:"Le cheval doré des cités",rarete:"legendaire",emoji:"✨",image:IMG.robot_coruscant,desc:"Tout d'or poli, il parade sur les places des mégapoles célestes.",aff:["beaute"],familles:["robot"],royaume:"futur"},
  {id:"robot_boston",nom:"Roston Tymatics",rarete:"rare",emoji:"🏗️",image:IMG.robot_boston,desc:"Robuste et jaune vif, il trotte sur les chantiers sans jamais se fatiguer.",aff:["endurance"],familles:["robot"],royaume:"futur"},
  {id:"robot_replicant",nom:"Le cheval réplica",rarete:"epique",emoji:"🏭",image:IMG.robot_replicant,desc:"Fabriqué en série par milliers, tous identiques, prêts à l'ouvrage.",aff:["endurance","force"],familles:["robot"],royaume:"futur"},
  {id:"robot_termicheval",nom:"Terminacheval",rarete:"legendaire",emoji:"🔴",image:IMG.robot_termicheval,desc:"Un crâne de métal, deux yeux écarlates : rien ne l'arrête, jamais.",aff:["bataille"],familles:["robot","sombres"],royaume:"futur"},
  {id:"robot_cheval_e",nom:"Le cheval jardinier",rarete:"rare",emoji:"🌼",image:IMG.robot_cheval_e,desc:"Un vieux robot rouillé aux grands yeux doux, qui prend soin des fleurs.",aff:["beaute","endurance"],familles:["robot","plantes"],royaume:"futur"},
  {id:"robot_galli",nom:"Gallihorse",rarete:"epique",emoji:"🌆",image:IMG.robot_galli,desc:"Chromé et racé, il cabre au-dessus de la ville qui s'endort.",aff:["vitesse","beaute"],familles:["robot"],royaume:"futur"},
  {id:"metal_or",nom:"Cheval d'or",rarete:"mythique",emoji:"👑",image:IMG.metal_or,desc:"Entièrement forgé dans l'or le plus pur, il resplendit comme un trésor des mille et une nuits.",aff:["beaute","force","magie"],familles:["metaux","mascotte"],royaume:"arabie"},
  {id:"metal_argent",nom:"Cheval d'argent",rarete:"legendaire",emoji:"🌙",image:IMG.metal_argent,desc:"Ciselé d'arabesques d'argent, il brille d'un éclat lunaire dans les palais de marbre.",aff:["beaute","magie"],familles:["metaux","race"],royaume:"grece"},
  {id:"metal_acier",nom:"Cheval d'acier",rarete:"epique",emoji:"⚙️",image:IMG.metal_acier,desc:"Né des hauts-fourneaux, l'acier le rend puissant et vif à la fois : l'alliage du fer et du feu.",aff:["force","vitesse"],familles:["metaux","bataille"],royaume:"luxembourg"},
  {id:"metal_fer",nom:"Cheval de fer",rarete:"epique",emoji:"🛡️",image:IMG.metal_fer,desc:"Bardé de plaques de fer noirci, il sort de la forge dans une pluie d'étincelles, l'œil rougeoyant.",aff:["bataille","force"],familles:["metaux","sombres"],royaume:"allemagne"},
  {id:"metal_aluminium",nom:"Cheval d'aluminium",rarete:"rare",emoji:"🤖",image:IMG.metal_aluminium,desc:"Léger comme une plume et brillant comme un miroir, ce métal moderne file dans la cité de demain.",aff:["vitesse","beaute"],familles:["metaux","robot"],royaume:"futur"},
  {id:"metal_zinc",nom:"Cheval de zinc",rarete:"rare",emoji:"🔩",image:IMG.metal_zinc,desc:"Couvert de zinc galvanisé aux reflets étoilés, il ne rouille jamais — fierté des toits de nos villes.",aff:["force","endurance"],familles:["metaux","travail"],royaume:"belgique"},
  {id:"metal_etain",nom:"Cheval d'étain",rarete:"commune",emoji:"🔔",image:IMG.metal_etain,desc:"Façonné dans l'étain doux par la main du ferblantier, il veille sur l'étal du marché médiéval.",aff:["beaute"],familles:["metaux","travail"],royaume:"angleterre"},
  {id:"ET_aetheris",nom:"Aetheris",rarete:"mythique",emoji:"🌈",image:IMG.ET_aetheris,desc:"Gardien des îles flottantes, ses ailes d'arc-en-ciel irisé le portent d'un ciel à l'autre.",aff:["beaute","magie","vitesse"],familles:["aliens","legende"],royaume:"outremonde"},
  {id:"ET_crysalune",nom:"Crysalune",rarete:"legendaire",emoji:"💎",image:IMG.ET_crysalune,desc:"Un cheval de cristal vivant, parcouru de constellations lumineuses, né entre deux lunes lointaines.",aff:["magie","beaute"],familles:["aliens","elementaires"],royaume:"outremonde"},
  {id:"ET_octalyre",nom:"Octalyre",rarete:"legendaire",emoji:"🐙",image:IMG.ET_octalyre,desc:"Sa crinière et sa queue de tentacules ondulent comme dans un océan d'étoiles.",aff:["magie","endurance"],familles:["aliens","elementaires"],royaume:"outremonde"},
  {id:"ET_nerethys",nom:"Nérethys",rarete:"epique",emoji:"🌊",image:IMG.ET_nerethys,desc:"Esprit des eaux d'un monde sans soleil, il surgit des grottes lunaires dans une gerbe de lumière bleue.",aff:["magie","vitesse"],familles:["aliens","elementaires"],royaume:"outremonde"},
  {id:"ET_solkaris",nom:"Solkaris",rarete:"epique",emoji:"☀️",image:IMG.ET_solkaris,desc:"Sous les deux soleils d'une planète rouge, ce galopeur écaillé traverse le désert sans jamais faiblir.",aff:["vitesse","endurance"],familles:["aliens","sauvages"],royaume:"outremonde"},
  {id:"ET_mycelion",nom:"Mycélion",rarete:"epique",emoji:"🍄",image:IMG.ET_mycelion,desc:"Couvert de champignons luminescents, il fait partie de la grande forêt-réseau qui respire dans le noir.",aff:["magie","endurance"],familles:["aliens","plantes"],royaume:"outremonde"},
  {id:"ET_phalenora",nom:"Phalénora",rarete:"epique",emoji:"🦋",image:IMG.ET_phalenora,desc:"Ses ailes de phalène, poudrées de motifs, s'ouvrent parmi les fleurs géantes d'une jungle enchantée.",aff:["beaute","magie"],familles:["aliens","pres"],royaume:"outremonde"},
  {id:"ET_mantheor",nom:"Manthéor",rarete:"rare",emoji:"🦗",image:IMG.ET_mantheor,desc:"Mi-cheval, mi-mante religieuse, ses grands bras dentelés se replient, prêts à jaillir en un éclair.",aff:["bataille","vitesse"],familles:["aliens","bataille"],royaume:"outremonde"},
  {id:"ET_scarabeon",nom:"Scarabéon",rarete:"rare",emoji:"🪲",image:IMG.ET_scarabeon,desc:"Sa carapace de scarabée aux reflets d'émeraude et d'améthyste est une armure aussi belle que solide.",aff:["bataille","beaute"],familles:["aliens","bataille"],royaume:"outremonde"},
  {id:"ET_lumea",nom:"Luméa",rarete:"rare",emoji:"✨",image:IMG.ET_lumea,desc:"Douce créature de lumière verte, elle éclaire de mille reflets les marais d'un monde endormi.",aff:["magie","beaute"],familles:["aliens","elementaires"],royaume:"outremonde"},
  {id:"metal_bronze",nom:"Cheval de bronze",rarete:"epique",emoji:"🥉",image:IMG.metal_bronze,desc:"Statue de bronze verdie par les siècles, fière et triomphale comme les chevaux de Saint-Marc.",aff:["force","beaute"],familles:["metaux","race"],royaume:"italie"},
  {id:"precieux_diamant",nom:"Cheval de diamant",rarete:"mythique",emoji:"💎",image:IMG.precieux_diamant,desc:"Taillé dans le diamant, la pierre la plus dure et la plus pure : il scintille de mille feux irisés.",aff:["beaute","magie","force"],familles:["precieux","race"],royaume:"afrique"},
  {id:"precieux_rubis",nom:"Cheval de rubis",rarete:"legendaire",emoji:"❤️",image:IMG.precieux_rubis,desc:"Rouge ardent comme la braise, le rubis lui donne un cœur de feu et une fougue de champion.",aff:["bataille","beaute"],familles:["precieux","bataille"],royaume:"inde"},
  {id:"precieux_emeraude",nom:"Cheval d'émeraude",rarete:"legendaire",emoji:"💚",image:IMG.precieux_emeraude,desc:"Vert profond des forêts, l'émeraude passe pour porter sagesse et longue vie à qui la possède.",aff:["beaute","magie"],familles:["precieux","plantes"],royaume:"bresil"},
  {id:"precieux_sapphire",nom:"Cheval de saphir",rarete:"epique",emoji:"💙",image:IMG.precieux_sapphire,desc:"Bleu nuit piqueté d'étoiles, le saphir est la pierre des rois et des ciels d'été.",aff:["beaute","magie"],familles:["precieux","race"],royaume:"inde"},
  {id:"precieux_jade",nom:"Cheval de jade",rarete:"epique",emoji:"🟢",image:IMG.precieux_jade,desc:"Sculpté dans le jade impérial, il incarne l'harmonie et la longévité chères à la Chine ancienne.",aff:["beaute","endurance"],familles:["precieux","race"],royaume:"chine"},
  {id:"precieux_amethyste",nom:"Cheval d'améthyste",rarete:"rare",emoji:"💜",image:IMG.precieux_amethyste,desc:"Cristal violet des grottes profondes, l'améthyste apaise l'esprit et invite à la rêverie.",aff:["magie","beaute"],familles:["precieux","elementaires"],royaume:"bresil"},
  {id:"precieux_obsidienne",nom:"Cheval d'obsidienne",rarete:"rare",emoji:"🖤",image:IMG.precieux_obsidienne,desc:"Verre noir né des volcans, tranchant comme une lame : les anciens en faisaient leurs armes.",aff:["bataille","magie"],familles:["precieux","sombres"],royaume:"amerique"},
  {id:"precieux_email",nom:"Cheval d'émail",rarete:"rare",emoji:"🎨",image:IMG.precieux_email,desc:"Habillé d'émaux cloisonnés aux mille couleurs, chaque motif est serti d'un fil d'or minutieux.",aff:["beaute","magie"],familles:["precieux","race"],royaume:"arabie"},
  {id:"precieux_vitrail",nom:"Cheval de vitrail",rarete:"epique",emoji:"🪟",image:IMG.precieux_vitrail,desc:"Assemblé de verres colorés comme une rosace de cathédrale, il s'illumine dès que le soleil le traverse.",aff:["beaute","magie"],familles:["precieux","legende"],royaume:"france"},
  {id:"planet_jupiter",nom:"Jupiter",rarete:"mythique",emoji:"🟠",image:IMG.planet_jupiter,desc:"La plus grande planète, roi du système solaire : sa Grande Tache rouge est une tempête plus vaste que la Terre.",aff:["force","magie","bataille"],familles:["planetes","bataille"],royaume:"outremonde"},
  {id:"planet_saturne",nom:"Saturne",rarete:"legendaire",emoji:"🪐",image:IMG.planet_saturne,desc:"Ceinte de ses anneaux de glace et de roche, Saturne est la gardienne patiente du temps qui passe.",aff:["magie","endurance"],familles:["planetes","legende"],royaume:"outremonde"},
  {id:"planet_terre",nom:"La Terre",rarete:"legendaire",emoji:"🌍",image:IMG.planet_terre,desc:"Notre planète bleue : océans, forêts et montagnes vivent sur son dos, la seule à abriter la vie.",aff:["beaute","endurance"],familles:["planetes","plantes"],royaume:"outremonde"},
  {id:"planet_mars",nom:"Mars",rarete:"epique",emoji:"🔴",image:IMG.planet_mars,desc:"La planète rouge, nommée d'après le dieu de la guerre : un désert de fer rouillé sous un ciel orangé.",aff:["bataille","force"],familles:["planetes","bataille"],royaume:"outremonde"},
  {id:"planet_neptune",nom:"Neptune",rarete:"epique",emoji:"🔵",image:IMG.planet_neptune,desc:"La planète des tempêtes bleues et des vents les plus violents, nommée d'après le dieu des mers.",aff:["magie","vitesse"],familles:["planetes","elementaires"],royaume:"outremonde"},
  {id:"planet_uranus",nom:"Uranus",rarete:"rare",emoji:"🔷",image:IMG.planet_uranus,desc:"Géante de glace couchée sur le côté, d'un bleu-vert pâle et glacial aux confins du système solaire.",aff:["magie","endurance"],familles:["planetes","elementaires"],royaume:"outremonde"},
  {id:"planet_venus",nom:"Vénus",rarete:"rare",emoji:"🟡",image:IMG.planet_venus,desc:"L'étoile du berger, la plus brillante du ciel, nommée d'après la déesse de la beauté — mais brûlante sous ses nuages.",aff:["beaute","magie"],familles:["planetes","race"],royaume:"outremonde"},
  {id:"planet_mercure",nom:"Mercure",rarete:"rare",emoji:"☄️",image:IMG.planet_mercure,desc:"La planète la plus proche du Soleil et la plus rapide, messagère filante nommée d'après le dieu aux pieds ailés.",aff:["vitesse","magie"],familles:["planetes","course"],royaume:"outremonde"},
  {id:"mythe_tulpar",nom:"Tulpar",rarete:"epique",emoji:"🕊️",image:IMG.mythe_tulpar,desc:"Le cheval ailé des steppes turques, qui bondit d'un sommet à l'autre.",aff:["magie","vitesse"],familles:["legende"],royaume:"steppe"},
  {id:"mythe_morvarch",nom:"Morvarc'h",rarete:"epique",emoji:"🌊",image:IMG.mythe_morvarch,desc:"Le cheval-marin noir du roi breton Gradlon, qui galope sur les vagues.",aff:["magie","vitesse"],familles:["legende"],royaume:"france"},
  {id:"mythe_lou_drape",nom:"Lou Drapé",rarete:"epique",emoji:"🌙",image:IMG.mythe_lou_drape,desc:"Cheval fantôme de Provence qui apparaît près de l'eau au clair de lune.",aff:["magie","beaute"],familles:["legende"],royaume:"france"},
  {id:"mythe_caballo_marino",nom:"Caballo Marino",rarete:"epique",emoji:"🐟",image:IMG.mythe_caballo_marino,desc:"Cheval des mers de l'île de Chiloé, au Chili, à la nageoire dorée.",aff:["magie","endurance"],familles:["legende"],royaume:"chili"},
  {id:"mythe_each_uisge",nom:"Each-Uisge",rarete:"epique",emoji:"💀",image:IMG.mythe_each_uisge,desc:"Le redoutable cheval des lochs d'Écosse, qui entraîne les imprudents sous l'eau.",aff:["magie","bataille"],familles:["legende"],royaume:"ecosse"},
  {id:"mythe_cabbyl_ushtey",nom:"Cabyll-Ushtey",rarete:"epique",emoji:"🌊",image:IMG.mythe_cabbyl_ushtey,desc:"Le cheval d'eau de l'île de Man, surgi de la mer les soirs de tempête.",aff:["magie","bataille"],familles:["legende"],royaume:"angleterre"},
  {id:"mythe_puca",nom:"Púca",rarete:"epique",emoji:"🍂",image:IMG.mythe_puca,desc:"Esprit farceur d'Irlande en forme de cheval noir aux yeux d'or.",aff:["magie","vitesse"],familles:["legende"],royaume:"irlande"},
  {id:"mythe_ceffyl_dwr",nom:"Ceffyl Dŵr",rarete:"epique",emoji:"💧",image:IMG.mythe_ceffyl_dwr,desc:"Le cheval d'eau du pays de Galles, né de la brume des cascades.",aff:["magie","endurance"],familles:["legende"],royaume:"galles"},
  {id:"mythe_ak_kula",nom:"Ak-Kula",rarete:"legendaire",emoji:"⚔️",image:IMG.mythe_ak_kula,desc:"Le fidèle cheval de guerre du héros Manas, dans l'épopée kirghize.",aff:["magie","bataille"],familles:["legende"],royaume:"steppe"},
  {id:"mythe_shabdiz",nom:"Shabdiz",rarete:"legendaire",emoji:"🌙",image:IMG.mythe_shabdiz,desc:"« Minuit », le cheval noir du roi perse Khosro, le plus rapide qui fut.",aff:["magie","vitesse"],familles:["legende"],royaume:"perse"},
  {id:"mythe_ama_no_fuchigoma",nom:"Ame-no-Fuchikoma",rarete:"legendaire",emoji:"⛩️",image:IMG.mythe_ama_no_fuchigoma,desc:"Le cheval céleste à la robe pie du dieu japonais Susanoo.",aff:["magie","bataille"],familles:["legende"],royaume:"japon"},
  {id:"mythe_liath_macha",nom:"Liath Macha",rarete:"legendaire",emoji:"⚔️",image:IMG.mythe_liath_macha,desc:"« Le Gris de Macha », le grand cheval de guerre du héros Cúchulainn.",aff:["magie","bataille"],familles:["legende"],royaume:"irlande"},
  {id:"mythe_hrimfaxi",nom:"Hrímfaxi",rarete:"legendaire",emoji:"❄️",image:IMG.mythe_hrimfaxi,desc:"« Crinière de givre », le cheval de la Nuit dont la bave forme la rosée.",aff:["magie","endurance"],familles:["legende"],royaume:"norvege"},
  {id:"mythe_svadilfari",nom:"Svaðilfari",rarete:"legendaire",emoji:"⛓️",image:IMG.mythe_svadilfari,desc:"L'étalon prodigieux qui bâtit les murs d'Asgard, père de Sleipnir.",aff:["magie","force"],familles:["legende"],royaume:"norvege"},
  {id:"mythe_gullfaxi",nom:"Gullfaxi",rarete:"legendaire",emoji:"🔥",image:IMG.mythe_gullfaxi,desc:"« Crinière d'or », le puissant cheval d'un géant de la mythologie nordique.",aff:["magie","force"],familles:["legende"],royaume:"norvege"},
  {id:"mythe_areion",nom:"Areion",rarete:"mythique",emoji:"🌊",image:IMG.mythe_areion,desc:"Cheval noir immortel né de Poséidon, si rapide qu'aucun mortel ne peut l'attraper.",aff:["magie","vitesse","endurance"],familles:["legende"],royaume:"grece"},
  {id:"mythe_akbuzat",nom:"Akbuzat",rarete:"mythique",emoji:"☁️",image:IMG.mythe_akbuzat,desc:"Destrier céleste de la mythologie bachkire, descendu du ciel pour un grand héros.",aff:["magie","vitesse","bataille"],familles:["legende"],royaume:"steppe"},
  {id:"mythe_chollima",nom:"Chollima",rarete:"mythique",emoji:"🌥️",image:IMG.mythe_chollima,desc:"Le cheval ailé qui parcourt mille lis en un jour, dans les légendes d'Extrême-Orient.",aff:["magie","vitesse","endurance"],familles:["legende"],royaume:"chine"},
  {id:"mythe_skinfaxi",nom:"Skinfaxi",rarete:"mythique",emoji:"☀️",image:IMG.mythe_skinfaxi,desc:"« Crinière brillante », le cheval du Jour dont la crinière éclaire le monde.",aff:["magie","beaute","vitesse"],familles:["legende"],royaume:"norvege"},
  {id:"mythe_sleipnir_rainbow",nom:"Sleipnir Arc-en-ciel",rarete:"celeste",emoji:"🌈",image:IMG.mythe_sleipnir_rainbow,desc:"Sleipnir galopant sur le Bifröst, le pont arc-en-ciel des dieux nordiques.",aff:["magie","vitesse","endurance"],familles:["legende"],royaume:"norvege"},
  {id:"idol_blue_laser",nom:"Blue Laser",rarete:"epique",emoji:"🌟",image:IMG.idol_blue_laser,desc:"Sous les lasers bleus, cette idole électrise la scène à chaque concert.",aff:["beaute","magie"],familles:["band"],royaume:"scene"},
  {id:"idol_max_maximum",nom:"Max Maximum",rarete:"epique",emoji:"🤘",image:IMG.idol_max_maximum,desc:"Le roi du rock à crinière arc-en-ciel : toujours à fond, toujours à 100 !",aff:["vitesse","bataille"],familles:["band"],royaume:"scene"},
  {id:"idol_candy_crushy",nom:"Candy Crushy",rarete:"rare",emoji:"🍬",image:IMG.idol_candy_crushy,desc:"Une pop-star toute sucrée qui fait fondre le public de bonbons roses.",aff:["beaute","magie"],familles:["band"],royaume:"scene"},
  {id:"idol_princess_glitter",nom:"Princess Glitter",rarete:"rare",emoji:"💖",image:IMG.idol_princess_glitter,desc:"La princesse des paillettes, entourée de papillons et d'étoiles.",aff:["beaute","magie"],familles:["band"],royaume:"scene"},
  {id:"ecurie_timide",nom:"Le Timide",rarete:"commune",emoji:"🙈",image:IMG.ecurie_timide,desc:"Il se cache derrière la porte dès qu'un visiteur arrive.",aff:["endurance"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_peureux",nom:"Le Peureux",rarete:"commune",emoji:"😱",image:IMG.ecurie_peureux,desc:"Un pigeon ? Une feuille ? Tout le fait sursauter !",aff:["vitesse"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_simplet",nom:"Le Simplet",rarete:"commune",emoji:"😅",image:IMG.ecurie_simplet,desc:"Pas le plus malin, mais sûrement le plus gentil de la bande.",aff:["endurance"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_jeune_fou",nom:"Le Jeune Fou",rarete:"commune",emoji:"🤠",image:IMG.ecurie_jeune_fou,desc:"Plein d'énergie, il ne tient pas en place et adore faire des bêtises.",aff:["vitesse","force"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_original",nom:"L'Original",rarete:"commune",emoji:"🤪",image:IMG.ecurie_original,desc:"Il fait tout à l'envers, et c'est ça qu'on adore chez lui.",aff:["magie"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_rigide",nom:"Le Rigide",rarete:"commune",emoji:"📏",image:IMG.ecurie_rigide,desc:"Droit dans ses sabots, il aime que tout soit à sa place.",aff:["endurance"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_costaud",nom:"Le Costaud",rarete:"commune",emoji:"💪",image:IMG.ecurie_costaud,desc:"Grand cœur et gros muscles, il porte les autres sur son dos.",aff:["force","endurance"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_marginal",nom:"Le Marginal",rarete:"commune",emoji:"🧢",image:IMG.ecurie_marginal,desc:"Un peu à l'écart, il observe le troupeau à sa façon.",aff:["bataille"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_jument_appliquee",nom:"La Jument Appliquée",rarete:"commune",emoji:"📝",image:IMG.ecurie_jument_appliquee,desc:"Sérieuse et travailleuse, elle fait toujours de son mieux.",aff:["endurance","beaute"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_vieux_ronchon",nom:"Le Vieux Ronchon",rarete:"commune",emoji:"😤",image:IMG.ecurie_vieux_ronchon,desc:"Il ronchonne pour la forme, mais au fond c'est un tendre.",aff:["endurance"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_artiste",nom:"L'Artiste",rarete:"commune",emoji:"🎨",image:IMG.ecurie_artiste,desc:"Rêveuse et créative, elle voit de la poésie partout dans l'écurie.",aff:["beaute","magie"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_intello",nom:"L'Intello",rarete:"rare",emoji:"🤓",image:IMG.ecurie_intello,desc:"Toujours le nez dans un livre, il connaît la réponse à tout... ou presque.",aff:["magie","endurance"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_play_boy",nom:"Le Play-boy",rarete:"rare",emoji:"😎",image:IMG.ecurie_play_boy,desc:"Charmeur né, il fait tourner les têtes d'un coup de crinière.",aff:["beaute","vitesse"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_bad_boy",nom:"Le Bad Boy",rarete:"rare",emoji:"🖤",image:IMG.ecurie_bad_boy,desc:"Ténébreux et rebelle, il joue les durs... mais fond pour une pomme.",aff:["bataille","force"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_prom_queen",nom:"La Prom Queen",rarete:"rare",emoji:"👑",image:IMG.ecurie_prom_queen,desc:"La star de l'écurie, toujours pomponnée et adorée de tous.",aff:["beaute","magie"],familles:["caractere"],royaume:"belgique"},
  {id:"ecurie_vieux_sage",nom:"Le Vieux Sage",rarete:"rare",emoji:"🧙",image:IMG.ecurie_vieux_sage,desc:"Il a tout vu, tout vécu, et donne les meilleurs conseils de l'écurie.",aff:["magie","endurance"],familles:["caractere"],royaume:"belgique"},
];
const RARETES={commune:{nom:'Commune',poids:55,overflow:15,couleur:'#c4cdd8'},rare:{nom:'Rare',poids:27,overflow:30,couleur:'#7ec2ff'},epique:{nom:'Épique',poids:13,overflow:60,couleur:'#c99bff'},legendaire:{nom:'Légendaire',poids:4.5,overflow:120,couleur:'#ffcf6b'},mythique:{nom:'Mythique',poids:0.5,overflow:250,couleur:'#ff9ac0'},celeste:{nom:'Céleste',poids:0,overflow:300,couleur:'#ffe9a8'}};
const SEUILS=[1,4,9,17,28];
const TITRES=['—','Éveil','Aguerri','Radieux','Astral','Mythe'];
const ROYAUMES={belgique:{ico:'🇧🇪',nom:'Belgique'},pays_bas:{ico:'🇳🇱',nom:'Pays-Bas'},france:{ico:'🇫🇷',nom:'France'},allemagne:{ico:'🇩🇪',nom:'Allemagne'},angleterre:{ico:'🏴',nom:'Angleterre'},irlande:{ico:'🇮🇪',nom:'Irlande'},ecosse:{ico:'🏴',nom:'Écosse'},espagne:{ico:'🇪🇸',nom:'Espagne'},rome:{ico:'🏛️',nom:'Rome'},italie:{ico:'🇮🇹',nom:'Italie'},portugal:{ico:'🇵🇹',nom:'Portugal'},autriche:{ico:'🇦🇹',nom:'Autriche'},luxembourg:{ico:'🇱🇺',nom:'Luxembourg'},suisse:{ico:'🇨🇭',nom:'Suisse'},grece:{ico:'🇬🇷',nom:'Grèce'},norvege:{ico:'🇳🇴',nom:'Norvège'},steppe:{ico:'🐎',nom:'Steppe'},chine:{ico:'🇨🇳',nom:'Chine'},japon:{ico:'🇯🇵',nom:'Japon'},inde:{ico:'🇮🇳',nom:'Inde'},arabie:{ico:'🏜️',nom:'Arabie'},egypte:{ico:'🇪🇬',nom:'Égypte'},amerique:{ico:'🇺🇸',nom:'Amérique'},afrique:{ico:'🦓',nom:'Afrique'},camelot:{ico:'🏰',nom:'Camelot'},avalon:{ico:'🦄',nom:'Avalon'},scene:{ico:'🎤',nom:'Scène'},australie:{ico:'🇦🇺',nom:'Australie'},perse:{ico:'🏹',nom:'Perse'},futur:{ico:'🤖',nom:'Futur'},russie:{ico:'🇷🇺',nom:'Russie'},argentine:{ico:'🇦🇷',nom:'Argentine'},finlande:{ico:'🇫🇮',nom:'Finlande'},islande:{ico:'🇮🇸',nom:'Islande'},danemark:{ico:'🇩🇰',nom:'Danemark'},pologne:{ico:'🇵🇱',nom:'Pologne'},bresil:{ico:'🇧🇷',nom:'Brésil'},hongrie:{ico:'🇭🇺',nom:'Hongrie'},galles:{ico:'🏴',nom:'Pays de Galles'},ukraine:{ico:'🇺🇦',nom:'Ukraine'},chili:{ico:'🇨🇱',nom:'Chili'},outremonde:{ico:'🌑',nom:'Outre-monde'}};
const FAMILLES={travail:{ico:'🛠️',nom:'Travail'},race:{ico:'🏅',nom:'Cheval de race'},mascotte:{ico:'👑',nom:'Mascotte'},bataille:{ico:'⚔️',nom:'Bataille'},legende:{ico:'✨',nom:'Légende'},elementaires:{ico:'🔥',nom:'Élémentaires'},sauvages:{ico:'🐎',nom:'Sauvages'},course:{ico:'🏇',nom:'Course'},equitation:{ico:'🏇',nom:'Équitation'},pres:{ico:'🌸',nom:'Prés'},band:{ico:'🎸',nom:'Pop'},licorne:{ico:'🦄',nom:'Licornes'},plantes:{ico:'🌿',nom:'Plantes'},robot:{ico:'🤖',nom:'Robots'},sombres:{ico:'💀',nom:'Sombres'},metaux:{ico:'🔩',nom:'Métaux'},aliens:{ico:'👽',nom:'Extraterrestres'},precieux:{ico:'💎',nom:'Précieux'},planetes:{ico:'🪐',nom:'Planètes'},caractere:{ico:'🎭',nom:'Caractères'}};
/* ===== Équilibrage aventure (Lot 5) ===== */
const AMB_COMPO=1.2;                 /* +20% d'ambition sur les seuils de compo */
const PAYS_MULT={belgique:1.0,france:1.05,iles:1.10,rhin:1.15,iberie:1.20};  /* +5% de difficulté par pays */
/* Capacité exigée par étape (au lieu de toujours Puissance). Étape absente = force par défaut. */
const AV_CAP={
  /* Belgique */ anvers:'endurance',gand:'beaute',bruges:'magie',limbourg:'force',louvain:'vitesse',wavre:'beaute',mons:'bataille',namur:'bataille',liege:'force',arlon:'endurance',bruxelles:'force',
  /* France */ lille:'force',rouen:'beaute',montsaintmichel:'magie',broceliande:'endurance',pilat:'endurance',pau:'bataille',camargue:'vitesse',chamonix:'force',lyon:'beaute',strasbourg:'magie',paris:'force',
  /* Îles Britanniques */ douvres:'endurance',stonehenge:'magie',dartmoor:'vitesse',snowdonia:'force',newmarket:'vitesse',york:'bataille',edimbourg:'bataille',lochness:'magie',shetland:'force',connemara:'endurance',londres:'beaute',
  /* Rhin & Pays-Bas */ cologne:'beaute',lorelei:'magie',foretnoire:'magie',munich:'force',hambourg:'endurance',dulmen:'vitesse',amsterdam:'endurance',kinderdijk:'force',friesland:'beaute',rotterdam:'vitesse',berlin:'bataille',
  /* Ibérie */ seville:'beaute',grenade:'magie',tolede:'bataille',valence:'vitesse',barcelone:'magie',compostelle:'endurance',bilbao:'force',porto:'endurance',sintra:'beaute',lisbonne:'vitesse',madrid:'force'
};
const CAPS=[
  {id:'beaute',nom:'Beauté',ico:'🌸',couleur:'#ff9ac0',epreuve:'Concours de beauté',img:'concours/beaute.jpg'},
  {id:'force',nom:'Puissance',ico:'💪',couleur:'#e0864a',epreuve:'Concours de trait',img:'concours/force.jpg'},
  {id:'bataille',nom:'Combat',ico:'⚔️',couleur:'#d95f5f',epreuve:'Joute',img:'concours/bataille.jpg'},
  {id:'vitesse',nom:'Vitesse',ico:'⚡',couleur:'#f2c14e',epreuve:'Course',img:'concours/vitesse.jpg'},
  {id:'endurance',nom:'Agilité',ico:'🤸',couleur:'#5ec4a8',epreuve:"Parcours d'obstacles",img:'concours/endurance.jpg'},
  {id:'magie',nom:'Magie',ico:'✨',couleur:'#a672e0',epreuve:'Concours de magie',img:'concours/magie.jpg'},
];
const BASE_RAR={commune:8,rare:20,epique:34,legendaire:50,mythique:66,celeste:80};
const DIVISIONS=[
  {rarete:'commune',   nom:'Commune',        ico:'🥉',inscription:2, crins:[20,10,5],     renom:[3,2,1]},
  {rarete:'rare',      nom:'Rare',     ico:'🥈',inscription:5, crins:[40,20,10],    renom:[5,3,1]},
  {rarete:'epique',    nom:'Épique',     ico:'🥇',inscription:15,crins:[70,35,15],    renom:[8,5,2]},
  {rarete:'legendaire',nom:'Légendaire', ico:'🏅',inscription:25,crins:[110,55,25],   renom:[12,7,3]},
  {rarete:'mythique',  nom:'Mythique',   ico:'👑',inscription:40,crins:[180,90,40],   renom:[18,10,4]},
];
const FAM_CARAC={travail:'force',race:'beaute',bataille:'bataille',legende:'magie',elementaires:'magie',sauvages:'endurance',course:'vitesse',pres:'beaute',band:'vitesse',licorne:'magie',plantes:'endurance',robot:'vitesse',sombres:'bataille',equitation:'endurance',mascotte:'beaute',metaux:'force',aliens:'magie',precieux:'beaute',planetes:'magie',caractere:'endurance'};
const FAM_FAIBLESSE={travail:'vitesse',race:'magie',mascotte:'bataille',bataille:'magie',legende:'endurance',elementaires:'force',sauvages:'beaute',course:'force',equitation:'bataille',pres:'bataille',band:'bataille',licorne:'bataille',plantes:'vitesse',robot:'magie',sombres:'beaute',metaux:'magie',aliens:'force',precieux:'vitesse',planetes:'vitesse',caractere:'magie'};
const PONEYS=new Set(['welsh_pony','basotho','caspien','connemara','eriskay','exmoor','fell','highland','hutsul','merens','poney_shetland','poney_heureux','bebe_poney','falabella','fjord','haflinger','dulmener','islandais','konik','yakutian']);
const RANGS=[[0,'Débutante'],[15,'Régionale'],[45,'Réputée'],[100,'Prestigieuse'],[220,'Légendaire']];
const POIDS_MARCHAND={commune:40,rare:28,epique:19,legendaire:10,mythique:3};
const PRIX_MARCHAND={commune:3,rare:15,epique:55,legendaire:220,mythique:1000};
const CONV=[['m','cm',100],['km','m',1000],['kg','g',1000],['L','mL',1000],['h','min',60],['cm','mm',10]];
const PROB=[
  ()=>{const a=rnd(14,45),b=rnd(3,a-2);return {q:`Léa a ${a} bonbons. Elle en donne ${b}. Combien lui en reste-t-il ?`,r:a-b};},
  ()=>{const p=rnd(3,8),n=rnd(3,9);return {q:`${p} chevaux ont chacun ${n} pommes. Combien de pommes en tout ?`,r:p*n};},
  ()=>{const t=rnd(2,6),x=rnd(3,9);return {q:`Un ticket coûte ${x} €. Combien coûtent ${t} tickets ?`,r:t*x};},
  ()=>{const g=rnd(4,9),j=rnd(2,6);return {q:`On partage ${g*j} carottes entre ${j} poneys. Combien chacun ?`,r:g};},
];
const JALONS=[
  {carte:'sleipnir',            txt:'Posséder 50 chevaux différents',   cond:()=>nbUniques()>=50},
  {carte:'pegase',              txt:'Atteindre 150 de renommée totale', cond:()=>(etat.renommeeTotale||0)>=150},
  {carte:'beasts_qirin',        txt:'Terminer un pays en Aventure',     cond:()=>Object.values((etat.aventure&&etat.aventure.prov)||{}).some(p=>p&&p.fini)},
  {carte:'beasts_alicorne',     txt:'Compléter la famille Licornes',    cond:()=>familleComplete('licorne')},
  {carte:'cheval_pale_mort',    txt:'Compléter la famille Sombres',     cond:()=>familleComplete('sombres')},
  {carte:'cheval_rouge_guerre', txt:'Atteindre 300 bonnes réponses',    cond:()=>(etat.bonnes||0)>=300},
  {carte:'mythe_sleipnir_rainbow',txt:'Posséder 100 chevaux différents',  cond:()=>nbUniques()>=100},
];
const BRAVOS=["Bien joué, tu as réfléchi !","Belle stratégie !","Ça, c'est de la persévérance !","Ton entraînement paie !","Super raisonnement !","Tu maîtrises de mieux en mieux !"];
const ENCOURAGE=["Pas encore — mais chaque essai t'apprend !","L'erreur fait partie du chemin 💪","Presque ! Regarde l'astuce.","Tu progresses en essayant.","Bien tenté ! On retient et on continue."];
const NIV1='Niveau 1 · ~10 ans';
/* Pack "Trivial" — culture générale niveau début du secondaire (+200%) */
const BANK_TRIVIA=[
 {q:"Quelle est la capitale de l'Australie ?",r:"Canberra",choix:["Canberra","Sydney","Melbourne","Perth"],e:"Beaucoup pensent à Sydney, mais la capitale est Canberra."},
 {q:"Quel est le plus grand océan du monde ?",r:"l'océan Pacifique",choix:["l'océan Pacifique","l'océan Atlantique","l'océan Indien","l'océan Arctique"]},
 {q:"Sur quel continent se trouve l'Égypte ?",r:"l'Afrique",choix:["l'Afrique","l'Asie","l'Europe","l'Océanie"]},
 {q:"Quelle chaîne de montagnes sépare l'Europe de l'Asie ?",r:"l'Oural",choix:["l'Oural","les Alpes","l'Himalaya","les Andes"]},
 {q:"Quel pays a la forme d'une botte ?",r:"l'Italie",choix:["l'Italie","la Grèce","l'Espagne","le Portugal"]},
 {q:"Quel est le plus grand désert chaud du monde ?",r:"le Sahara",choix:["le Sahara","le Gobi","le Kalahari","l'Atacama"]},
 {q:"Qui fut le premier empereur des Français ?",r:"Napoléon Bonaparte",choix:["Napoléon Bonaparte","Louis XIV","Charlemagne","Jules César"]},
 {q:"Quel peuple a construit les grandes pyramides de Gizeh ?",r:"les Égyptiens",choix:["les Égyptiens","les Romains","les Grecs","les Mayas"]},
 {q:"En quelle année a commencé la Révolution française ?",r:"1789",choix:["1789","1515","1914","1492"],e:"1789 : la prise de la Bastille le 14 juillet."},
 {q:"Qui atteignit l'Amérique en 1492 pour les Européens ?",r:"Christophe Colomb",choix:["Christophe Colomb","Fernand de Magellan","Marco Polo","Vasco de Gama"]},
 {q:"Quel peuple de l'Antiquité a créé les premiers Jeux olympiques ?",r:"les Grecs",choix:["les Grecs","les Romains","les Égyptiens","les Perses"]},
 {q:"Quelle planète est la plus proche du Soleil ?",r:"Mercure",choix:["Mercure","Vénus","Mars","la Terre"]},
 {q:"Quel gaz les plantes absorbent-elles pour fabriquer leur énergie ?",r:"le dioxyde de carbone",choix:["le dioxyde de carbone","l'oxygène","l'hélium","l'hydrogène"],e:"Elles rejettent l'oxygène : c'est la photosynthèse."},
 {q:"Combien d'os possède le corps humain adulte ?",r:"206",choix:["206","106","306","512"]},
 {q:"Quel est l'animal terrestre le plus rapide ?",r:"le guépard",choix:["le guépard","le lion","le cheval","l'autruche"],e:"Il atteint près de 110 km/h en pointe."},
 {q:"Quel organe pompe le sang dans tout le corps ?",r:"le cœur",choix:["le cœur","le foie","le poumon","le cerveau"]},
 {q:"À quelle température l'eau bout-elle au niveau de la mer ?",r:"100 °C",choix:["100 °C","50 °C","200 °C","0 °C"],e:"À 0 °C elle gèle, à 100 °C elle bout."},
 {q:"Qui a peint la Joconde ?",r:"Léonard de Vinci",choix:["Léonard de Vinci","Pablo Picasso","Vincent van Gogh","Pierre Paul Rubens"]},
];
const BANK_TRIVIA_N2=[
 {q:"Quelle est la capitale du Canada ?",r:"Ottawa",choix:["Ottawa","Toronto","Montréal","Vancouver"]},
 {q:"Quel est le plus long fleuve d'Europe ?",r:"la Volga",choix:["la Volga","le Danube","le Rhin","la Loire"]},
 {q:"Dans quel pays se trouve le Machu Picchu ?",r:"le Pérou",choix:["le Pérou","le Mexique","le Chili","la Bolivie"]},
 {q:"Quel détroit sépare l'Europe de l'Afrique ?",r:"le détroit de Gibraltar",choix:["le détroit de Gibraltar","le Bosphore","la Manche","le détroit de Béring"]},
 {q:"Quelle est la plus haute montagne d'Afrique ?",r:"le Kilimandjaro",choix:["le Kilimandjaro","le mont Kenya","l'Atlas","la montagne de la Table"]},
 {q:"Quel savant a formulé la théorie de la relativité ?",r:"Albert Einstein",choix:["Albert Einstein","Isaac Newton","Charles Darwin","Galilée"]},
 {q:"Quelle guerre s'est déroulée de 1914 à 1918 ?",r:"la Première Guerre mondiale",choix:["la Première Guerre mondiale","la Seconde Guerre mondiale","la guerre de Cent Ans","la guerre froide"]},
 {q:"Qui a écrit la pièce « Roméo et Juliette » ?",r:"William Shakespeare",choix:["William Shakespeare","Molière","Victor Hugo","Jean Racine"]},
 {q:"Quelle cité romaine fut détruite par le Vésuve en l'an 79 ?",r:"Pompéi",choix:["Pompéi","Troie","Carthage","Athènes"]},
 {q:"Qui fut la première femme à recevoir un prix Nobel ?",r:"Marie Curie",choix:["Marie Curie","Rosa Parks","Jeanne d'Arc","Ada Lovelace"],e:"Elle en a même reçu deux : physique puis chimie."},
 {q:"Quel est le symbole chimique de l'or ?",r:"Au",choix:["Au","Or","Go","Ag"],e:"Du latin aurum. Ag, c'est l'argent."},
 {q:"Combien de cœurs possède une pieuvre ?",r:"trois",choix:["trois","un","deux","huit"]},
 {q:"Quelle est la vitesse approximative de la lumière ?",r:"environ 300 000 km/s",choix:["environ 300 000 km/s","environ 3 000 km/s","environ 300 km/s","environ 30 000 km/s"]},
 {q:"Quel scientifique a énoncé la loi de la gravitation universelle ?",r:"Isaac Newton",choix:["Isaac Newton","Albert Einstein","Nicolas Copernic","Louis Pasteur"]},
 {q:"Quel est le plus grand organe du corps humain ?",r:"la peau",choix:["la peau","le foie","l'intestin","le cerveau"]},
 {q:"Quel métal est liquide à température ambiante ?",r:"le mercure",choix:["le mercure","le fer","le plomb","le cuivre"]},
 {q:"De quelle langue vient le mot « algèbre » ?",r:"l'arabe",choix:["l'arabe","le latin","le grec","l'espagnol"]},
 {q:"Qui a composé l'opéra « La Flûte enchantée » ?",r:"Mozart",choix:["Mozart","Beethoven","Jean-Sébastien Bach","Frédéric Chopin"]},
];
const PACKS=[
 {id:'general',nom:'Général',ico:'📚',mult:1,niv:NIV1,sous:'Toutes tes matières',theorie:"Lis bien chaque question et prends ton temps. En cas d'erreur, une petite explication apparaît pour t'aider à comprendre."},
 {id:'general1',nom:'Général +1',ico:'🔥',mult:2,nivOffset:1,niv:'Niveau 2 · année +1',sous:'Plus dur · +150%',theorie:"Ici, c'est le niveau de l'année supérieure ! Réfléchis bien : les récompenses sont plus grandes."},
 {id:'races',nom:'Chevaux',ico:'🐴',mult:0.5,niv:NIV1,sous:'Races · robes · légendes · histoire',theorie:"🐴 LES RACES DE CHEVAUX\nUne « race », c'est une grande famille de chevaux qui se ressemblent : même allure, même taille, même caractère. On la reconnaît à sa silhouette !\n\n• LES GÉANTS DE TRAIT, tout en muscles, tiraient charrues et lourds chariots : le Brabançon et l'Ardennais (Belgique), le Boulonnais, le Shire anglais, le Nonius hongrois. Doux comme des agneaux malgré leur force.\n• LES CHEVAUX DU DÉSERT, fins et infatigables sous le soleil : l'Arabe, l'ancêtre de presque tous les chevaux rapides, et l'Akhal-Téké à la robe dorée qui brille comme du métal.\n• LES CHEVAUX BAROQUES, nobles danseurs des écoles royales : l'Andalou et le Lusitanien (Espagne, Portugal), le Lipizzan blanc de Vienne, le majestueux Kladruber des empereurs, le Frison tout noir des Pays-Bas.\n• LES TROTTEURS ET COUREURS, nés pour la vitesse : le pur-sang de course, le Trotteur Orlov de Russie, le Mangalarga du Brésil à l'allure si douce.\n• LES PONEYS, petits mais costauds (moins d'1,48 m au garrot) : le minuscule Shetland, le Welsh et le Connemara, le Fjord norvégien à la crinière taillée en brosse, le Haflinger, l'Exmoor, le Fell et le Highland des landes, et le Falabella, le plus petit cheval du monde !\n• LES TACHETÉS : l'Appaloosa des Amérindiens et le Knabstrupper danois, mouchetés comme un ciel étoilé.\n• LES RUSTIQUES DU GRAND FROID : le Konik, le Yakoute de Sibérie et l'Islandais, qui survivent aux hivers glacials sous leur épaisse fourrure.\n\n🎨 LES ROBES (les couleurs du cheval)\nLa « robe », c'est la couleur du poil. Les principales :\n• NOIR : tout le corps est noir (le Frison, le Mérens, le Fell).\n• BLANC / GRIS : du gris pommelé au blanc pur ; beaucoup naissent foncés et blanchissent en grandissant (le Camargue, le Lipizzan, l'Orlov).\n• ALEZAN : roux, du blond doré à l'acajou, souvent avec les crins clairs (le Haflinger, le Curly).\n• ISABELLE : crème doré très lumineux, crins et bas des pattes foncés (le Highland).\n• PIE : de grandes taches blanches et colorées mêlées (le Gypsy Cob, le Falabella).\n• TACHETÉE : plein de petites taches sur fond clair (l'Appaloosa, le Knabstrupper).\n• BAIE : corps brun, crins et bas des pattes noirs — la robe la plus répandue au monde.\n\n✨ LES CHEVAUX DE LÉGENDE\nDepuis toujours, les peuples ont imaginé des chevaux magiques :\n• GRÈCE : Pégase, le cheval ailé de Bellérophon ; Xanthos et Balios, les chevaux immortels d'Achille ; l'Hippocampe, mi-cheval mi-poisson, qui tire le char de Poséidon.\n• PAYS DU NORD : Sleipnir, le destrier à huit jambes du dieu Odin, et son descendant Grani, monture du héros Sigurd ; le Helhest, cheval à trois jambes de la déesse Hel.\n• MONDE CELTE : Enbarr, qui galope sur les vagues ; le Kelpie d'Écosse et le Dullahan sans tête d'Irlande, esprits des eaux et de la nuit.\n• ORIENT : Rakhsh, le coursier du héros perse Rostam ; Kanthaka, le cheval blanc qui emmena le futur Bouddha ; Uchchaihshravas, le cheval à sept têtes né de l'océan de lait.\n• CHINE : le Qilin et le Longma, chevaux-dragons porteurs de sagesse et de paix.\n• CHEZ NOUS : Bayard, le cheval-fée des quatre fils Aymon, et Veillantif, le fidèle destrier de Roland.\n\n🏛️ LES CHEVAUX DANS L'HISTOIRE\nLe cheval a accompagné les humains partout :\n• À LA GUERRE : les destriers bardés d'acier des chevaliers, les montures des Romains, des Vikings, des Cosaques des steppes et des samouraïs du Japon.\n• AU TRAVAIL : il tirait la charrue et les péniches (le halage sur les canaux), menait la diligence, descendait à la mine, portait le courrier du facteur et fonçait avec les pompiers.\n• À L'AVENTURE : les conquistadors l'emmenèrent en Amérique, où les Amérindiens en firent le Mustang sauvage des grandes plaines.\n• AU SPORT : aujourd'hui, des champions de course comme Secretariat, Frankel, Seabiscuit ou Phar Lap sont devenus de vraies vedettes.\n\n💡 LE SAVAIS-TU ?\nOn mesure un cheval au « garrot », le haut du dos entre les épaules. En dessous d'1,48 m, on parle d'un poney. Le plus grand cheval jamais mesuré, un Shire nommé Sampson, atteignait 2,19 m au garrot !"},
 {id:'origines',nom:'Origines',ico:'🌍',mult:1.2,niv:NIV1,sous:"D'où vient ce cheval ?",theorie:"Chaque cheval vient d'un pays : le Frison des Pays-Bas, le Brabançon de Belgique, l'Arabe du désert, le Fjord de Norvège… L'icône drapeau sur les cartes t'aide à retenir."},
 {id:'geek',nom:'Geek',ico:'🤖',mult:1.5,niv:NIV1,sous:'Robots · drones · code',theorie:"Programmer, c'est donner des instructions à une machine. Un robot a des capteurs (pour sentir), un moteur (pour bouger) et un processeur (son cerveau). Un drone vole grâce à ses hélices et à une batterie."},
 {id:'anglais',nom:'Anglais',ico:'🇬🇧',mult:1.5,niv:NIV1,sous:'English · débutant',theorie:"Les bases : hello (bonjour), goodbye (au revoir), yes (oui), no (non), thank you (merci), please (s'il te plaît).\nCouleurs : red (rouge), blue (bleu), green (vert), yellow (jaune).\nNombres : one, two, three, four, five (1 à 5)."},
 {id:'neerlandais',nom:'Néerlandais',ico:'🇳🇱',mult:1.5,niv:NIV1,sous:'Nederlands · débutant',theorie:"Le néerlandais est parlé en Flandre, au nord de la Belgique ! Les bases : hallo (bonjour), dank je (merci), ja (oui), nee (non). Des mots : paard (cheval), hond (chien), appel (pomme), water (eau), boom (arbre)."},
 {id:'art',nom:"Histoire de l'art",ico:'🎨',mult:1.5,niv:NIV1,sous:'Grands classiques',theorie:"Léonard de Vinci a peint la Joconde, Van Gogh « La Nuit étoilée », Monet était impressionniste, Picasso a inventé le cubisme, Michel-Ange a sculpté le David. Les couleurs primaires (rouge, jaune, bleu) se mélangent pour créer toutes les autres !"},
 {id:'ortho',nom:'Orthographe',ico:'✍️',mult:3,niv:NIV1,sous:'Écris les mots · +200%',theorie:"Pense aux accents (é, è, à, ê) et aux lettres muettes à la fin des mots. Relis-toi avant de valider !"},
 {id:'trivia',nom:'Trivial',ico:'🧠',mult:3,niv:'Début du secondaire',sous:'Culture générale ados · +200%',theorie:"Le grand défi de culture générale, niveau début du secondaire : géographie, histoire, sciences, arts… Réfléchis bien — chaque bonne réponse rapporte TRIPLE (+200 %) !"},
];
const ROBES={frison:'noir',murgese:'noir',cheval_albinos:'blanc',camargue:'blanc',appaloosa:'tachetée',gypsy_cob:'pie',akhal_teke:'isabelle',fjord:'isabelle',haflinger:'alezan',francois_camargue:'blanc',inge:'noir',rocio:'blanc',gourmand_mangeur_de_pommes:'alezan',gourmand_mangeur_de_carottes:'isabelle',gourmand_mangeur_de_grain:'alezan',gourmand_mangeur_de_trefle:'pie',mythique_balios:'noir',mythique_gringolet:'blanc',mythique_kanthaka:'blanc',mythique_veillantif:'alezan',curly:'alezan',finnhorse:'alezan',falabella:'pie',mangalarga_marchador:'pie',knabstrupper:'tachetée',nonius:'noir',kladruber:'blanc',lipizzan:'blanc',orlov:'blanc',welsh_pony:'alezan',caspien:'alezan',connemara:'blanc',eriskay:'blanc',fell:'noir',merens:'noir',highland:'isabelle',boulonnais:'blanc',konik:'isabelle',dulmener:'isabelle',exmoor:'bai',andalou:'blanc'};
const ROBES_DESC={noir:"Robe noire : tout le corps est noir.",gris:"Robe grise : du gris clair au presque blanc.",bai:"Robe baie : corps brun, crins et bas des pattes noirs.",alezan:"Robe alezane : rousse, du clair au foncé.",isabelle:"Robe isabelle : crème doré, très lumineuse.",pie:"Robe pie : de grandes taches blanches et colorées.",tachetée:"Robe tachetée : plein de petites taches, comme l'Appaloosa.",blanc:"Robe blanche : entièrement blanc."};
const ROBES_TOUS=['noir','gris','bai','alezan','isabelle','pie','tachetée','blanc'];
const MYTHES={
 licorne:{fait:"sa corne d'or n'apparaît qu'aux cœurs purs"},
 cheval_neptune:{perso:"Neptune, dieu des mers",fait:"il galope au fond des océans"},
 cheval_troie:{perso:"les Grecs (la ruse d'Ulysse)",fait:"un cheval de bois qui cachait des soldats pour prendre Troie"},
 centaure:{fait:"moitié homme, moitié cheval, gardien des forêts anciennes"},
 cheval_eclair:{fait:"un spectre d'orage qui surgit dans les éclairs"},
 cheval_constellation:{fait:"sa robe est un ciel étoilé"},
 cheval_abysses:{fait:"une créature des grands fonds, illuminée de bleu"},
 pieter_jan:{perso:"la Belgique",fait:"la mascotte du royaume, championne des chevaux de trait"},
 uchchaihshravas:{perso:"les dieux de l'Inde",fait:"le cheval blanc à sept têtes, né du barattage de l'océan de lait"},
 sleipnir:{perso:"Odin, le dieu viking",fait:"le destrier à huit jambes d'Odin"},
 al_bouraq:{perso:"les légendes d'Orient",fait:"une monture ailée au visage humain, entre ciel et terre"},
 matsukaze:{perso:"les samouraïs du Japon",fait:"« vent dans les pins », un destrier noir rapide et fier"},
 secretariat:{perso:"la course américaine",fait:"le plus grand champion de course, ses records tiennent encore"},
 bayard:{perso:"les quatre fils Aymon",fait:"un cheval-fée qui grandissait pour porter les quatre frères"},
 bucephale:{perso:"Alexandre le Grand",fait:"l'indomptable destrier que lui seul put dompter"},
 pegase:{perso:"Bellérophon (Grèce)",fait:"le cheval ailé qui s'envole jusqu'à l'Olympe"},
 mythique_xanthos:{perso:"Achille (Grèce)",fait:"un des chevaux immortels d'Achille, qui parla pour lui annoncer sa mort"},
 mythique_balios:{perso:"Achille (Grèce)",fait:"cheval immortel né du vent d'ouest, attelé au char d'Achille"},
 mythique_enbarr:{perso:"Manannán, dieu irlandais de la mer",fait:"il galope sur les vagues comme sur la terre ferme"},
 mythique_grani:{perso:"Sigurd, héros nordique",fait:"descendant de Sleipnir, il traversa un mur de flammes"},
 mythique_gringolet:{perso:"messire Gauvain (Table Ronde)",fait:"le fidèle destrier du neveu du roi Arthur"},
 mythique_kanthaka:{perso:"le prince Siddhartha (futur Bouddha)",fait:"le cheval blanc qui l'emporta vers l'éveil"},
 mythique_rakhsh:{perso:"Rostam, héros perse",fait:"il tua un lion pour protéger son maître endormi"},
 mythique_veillantif:{perso:"Roland, chevalier de Charlemagne",fait:"le destrier du preux Roland à Roncevaux"},
 beasts_qirin:{perso:"la Chine",fait:"le Qilin, créature de paix qui n'écrase aucun brin d'herbe"},
 beasts_longma:{perso:"la Chine",fait:"le Longma, cheval-dragon des eaux, présage de sagesse"},
 beasts_hippogriffe:{perso:"les légendes médiévales",fait:"mi-aigle mi-cheval, il vole plus vite que le vent"},
 beasts_hypalectryon:{perso:"la Grèce antique",fait:"mi-cheval mi-coq, une créature étrange peinte sur les vases grecs"},
 beasts_alicorne:{fait:"la licorne ailée, alliance de deux merveilles"},
 hippocampe:{perso:"Poséidon (Grèce)",fait:"mi-cheval mi-poisson, il tire le char des dieux des mers"},
 kelpie:{perso:"l'Écosse",fait:"un esprit des eaux qui prend la forme d'un cheval près des lochs"},
 helhest:{perso:"Hel, déesse nordique des morts",fait:"le cheval à trois jambes dont le passage annonce un malheur"},
 dullahan:{perso:"le folklore d'Irlande",fait:"la monture noire du cavalier sans tête"},
 mari_lwyd:{perso:"le Pays de Galles",fait:"un crâne de jument enrubanné qui chante aux portes en hiver"},
 cheval_pale_mort:{perso:"l'Apocalypse",fait:"le cheval blême du quatrième cavalier"},
 cheval_rouge_guerre:{perso:"l'Apocalypse",fait:"le cheval rouge du cavalier de la Guerre"},
 course_frankel:{perso:"la course anglaise",fait:"invaincu en 14 courses, l'un des plus grands galopeurs de l'histoire"},
 course_manowar:{perso:"la course américaine",fait:"surnommé « Big Red », il ne perdit qu'une seule course"},
 course_pharlap:{perso:"l'Australie",fait:"le champion adoré qui redonna le sourire à tout un pays"},
 course_seabiscuit:{perso:"l'Amérique",fait:"le petit cheval qui redonna espoir pendant la Grande Dépression"},
 course_zenyatta:{perso:"la course américaine",fait:"la jument qui remporta 19 de ses 20 courses"},
 francois_camargue:{perso:"la Camargue (France)",fait:"étalon blanc né foncé, blanchi par le soleil du Sud"},
 big_ben:{perso:"l'Angleterre",fait:"un Shire géant, descendant des chevaux des chevaliers"},
 inge:{perso:"les Pays-Bas",fait:"une Frisonne, perle noire des Pays-Bas qui sait danser"},
 rocio:{perso:"l'Espagne",fait:"une Andalouse de Pure Race Espagnole, danseuse née"},
 mythe_tulpar:{perso:"les peuples turcs des steppes",fait:"un cheval ailé qui bondit d'un sommet à l'autre"},
 mythe_morvarch:{perso:"la Bretagne",fait:"le cheval-marin du roi Gradlon, qui galope sur les vagues"},
 mythe_lou_drape:{perso:"les légendes de Provence",fait:"un cheval fantôme qui apparaît près de l'eau au clair de lune"},
 mythe_caballo_marino:{perso:"l'île de Chiloé au Chili",fait:"un cheval des mers à la nageoire dorée"},
 mythe_each_uisge:{perso:"les Highlands d'Écosse",fait:"le cheval des lochs qui entraîne les imprudents sous l'eau"},
 mythe_cabbyl_ushtey:{perso:"l'île de Man",fait:"un cheval d'eau surgi de la mer les soirs de tempête"},
 mythe_puca:{perso:"le folklore d'Irlande",fait:"un esprit farceur en forme de cheval noir aux yeux d'or"},
 mythe_ceffyl_dwr:{perso:"le pays de Galles",fait:"un cheval d'eau né de la brume des cascades"},
 mythe_ak_kula:{perso:"l'épopée kirghize de Manas",fait:"le fidèle cheval de guerre du héros Manas"},
 mythe_shabdiz:{perso:"la Perse ancienne",fait:"« Minuit », le cheval noir du roi Khosro, le plus rapide qui fut"},
 mythe_ama_no_fuchigoma:{perso:"le dieu japonais Susanoo",fait:"son cheval céleste à la robe pie"},
 mythe_liath_macha:{perso:"le héros irlandais Cúchulainn",fait:"« le Gris de Macha », son grand cheval de guerre"},
 mythe_hrimfaxi:{perso:"la mythologie nordique",fait:"« Crinière de givre », le cheval de la Nuit dont la bave forme la rosée"},
 mythe_svadilfari:{perso:"la mythologie nordique",fait:"l'étalon qui bâtit les murs d'Asgard, père de Sleipnir"},
 mythe_gullfaxi:{perso:"la mythologie nordique",fait:"« Crinière d'or », le puissant cheval d'un géant"},
 mythe_areion:{perso:"la mythologie grecque",fait:"le cheval noir immortel né de Poséidon, plus rapide que le vent"},
 mythe_akbuzat:{perso:"la mythologie bachkire",fait:"un destrier céleste descendu du ciel pour un grand héros"},
 mythe_chollima:{perso:"les légendes d'Extrême-Orient",fait:"un cheval ailé parcourant mille lis en un jour"},
 mythe_skinfaxi:{perso:"la mythologie nordique",fait:"« Crinière brillante », le cheval du Jour qui éclaire le monde"},
 mythe_sleipnir_rainbow:{perso:"Odin et le pont Bifröst",fait:"Sleipnir galopant sur l'arc-en-ciel des dieux du Nord"},
};
const BREEDS=['akhal_teke','frison','shire','appaloosa','marwari','andalou','arabe','fjord','gypsy_cob','brabancon','murgese','kaltblut','dulmener','lusitanien','boulonnais','haflinger','camargue','ardennais','franches_montagnes','cheval_desert','curly','falabella','finnhorse','islandais','kladruber','knabstrupper','konik','lipizzan','mangalarga_marchador','nonius','orlov','yakutian','welsh_pony','basotho','caspien','connemara','eriskay','exmoor','fell','highland','hutsul','merens'];
const HISTO={
 mustang_indien:{qui:"les Amérindiens",fait:"le cheval sauvage des grandes plaines"},
 cheval_tournoi:{qui:"un chevalier (tournoi)",fait:"il porte les couleurs de son seigneur, aux fleurs de lys"},
 cheval_romain:{qui:"les Romains",fait:"le fidèle destrier des légions romaines"},
 cheval_diligence:{qui:"la poste (diligence)",fait:"il tirait la diligence sur les routes"},
 cheval_armure:{qui:"un chevalier en armure",fait:"un destrier bardé d'acier"},
 cheval_pompier:{qui:"les pompiers",fait:"il fonçait dans la ville lors des incendies"},
 cheval_facteur:{qui:"le facteur",fait:"il portait le courrier de village en village"},
 cheval_teutonique:{qui:"les chevaliers teutoniques",fait:"à la croix noire, en Allemagne"},
 cheval_viking:{qui:"les Vikings",fait:"débarqué des drakkars"},
 cheval_cosaque:{qui:"les Cosaques",fait:"la monture des cavaliers des steppes"},
 cheval_conquistador:{qui:"les conquistadors",fait:"il porta les conquistadors à travers l'Amérique"},
 cheval_samurai:{qui:"les samouraïs",fait:"le destrier d'un guerrier japonais"},
 cheval_chinois:{qui:"la Chine impériale",fait:"il défilait dans les palais, paré de soie et d'or"},
 cheval_royal:{qui:"le roi de France",fait:"il porte fièrement les armes du roi"},
 cheval_halage:{qui:"les mariniers (halage)",fait:"il tirait les péniches le long des canaux"},
 cheval_laboureur:{qui:"les fermiers",fait:"il tirait la charrue dans les champs"},
 cheval_charbonnier:{qui:"les mineurs",fait:"il descendait dans la mine tirer le charbon"},
 cheval_police:{qui:"la police",fait:"monture des agents pour surveiller les foules"},
 cheval_cowboy:{qui:"les cow-boys",fait:"il menait les grands troupeaux dans l'Ouest américain"},
 metier_tram:{qui:"les villes d'autrefois (tramway)",fait:"il tirait le tram sur ses rails dans les rues pavées"},
 metier_brasseur:{qui:"les brasseurs",fait:"il livrait les tonneaux de bière de porte en porte"},
 metier_debardeur:{qui:"les bûcherons (débardage)",fait:"il sort les troncs de la forêt là où les machines ne passent pas"},
 antique_grece:{qui:"la Grèce antique",fait:"il défilait aux grandes fêtes et portait les cavaliers d'Athènes"},
 antique_celte:{qui:"les Celtes",fait:"peuple des druides, il accompagnait guerriers et légendes"},
 antique_egyptien:{qui:"l'Égypte des pharaons",fait:"il tirait les chars de guerre au temps des pyramides"},
 antique_perse:{qui:"l'Empire perse",fait:"il paradait couvert d'or devant les palais de Persépolis"},
 antique_mogol_imperial:{qui:"l'Empire mongol",fait:"petit et infatigable, il porta les cavaliers de Gengis Khan à travers les steppes"},
 route_epices:{qui:"les marchands d'épices",fait:"il portait safran et cannelle des ports d'Orient aux bazars"},
 route_transsahara:{qui:"les caravanes du Sahara",fait:"il traversait le désert d'oasis en oasis avec le sel et l'or"},
 route_sel:{qui:"les muletiers de la route du sel",fait:"il portait « l'or blanc » sur les sentiers de montagne"},
 route_soie:{qui:"les marchands de la route de la soie",fait:"il reliait la Chine à l'Occident, chargé de soieries précieuses"},
 route_ambre:{qui:"les marchands de la route de l'ambre",fait:"il apportait l'ambre de la Baltique jusqu'au sud de l'Europe"},
 equit_polo:{qui:"les joueurs de polo",fait:"sport d'équipe très ancien : on frappe une balle au maillet, au galop"},
 equit_enduro:{qui:"les cavaliers d'endurance",fait:"des courses de 100 km et plus, où compte la santé du cheval"},
 equit_attelage:{qui:"les meneurs d'attelage",fait:"sport où le cheval attelé slalome entre les cônes avec précision"},
 metier_vendange:{qui:"les vignerons (vendanges)",fait:"il rapporte les paniers de raisin depuis les vignes en terrasses"},
 equit_dressage:{qui:"les cavaliers de dressage",fait:"sport artistique où le cheval enchaîne des figures précises, comme une danse"},
};
const HISTORIQUES=new Set(['bucephale','secretariat','course_frankel','course_manowar','course_pharlap','course_seabiscuit','course_zenyatta']);
const FICHES_HISTO={
 bucephale:{titre:"Bucéphale, le cheval d'Alexandre le Grand",paras:["Il y a plus de 2300 ans, un jeune prince nommé Alexandre dompta un grand cheval noir que personne n'arrivait à monter. Il avait compris que le cheval avait simplement peur de sa propre ombre : il le tourna face au soleil, et le calma.","Devenu Alexandre le Grand, il conquit un immense empire sur le dos de Bucéphale, de la Grèce jusqu'en Inde. Le fidèle cheval le porta dans presque toutes ses batailles.","Quand Bucéphale mourut, Alexandre fut si triste qu'il fonda une ville en son honneur : Bucéphalie. C'est l'un des chevaux les plus célèbres de toute l'Histoire."]},
 secretariat:{titre:"Secretariat, « Big Red »",paras:["Secretariat était un cheval de course américain, immense et roux, né en 1970. On le surnommait affectueusement « Big Red ».","En 1973, il remporta les trois plus grandes courses américaines — la fameuse « Triple Couronne » — un exploit que plus personne n'avait réussi depuis 25 ans.","Lors de sa dernière victoire, il gagna avec 31 longueurs d'avance et un temps record qui n'a jamais été battu. Un véritable héros du sport."]},
 course_frankel:{titre:"Frankel, l'invaincu",paras:["Frankel est un cheval de course anglais né en 2008, considéré comme l'un des plus grands de tous les temps.","Il disputa 14 courses… et les gagna toutes ! Il ne perdit jamais une seule fois de toute sa carrière.","Après sa retraite des pistes, il devint le père de nombreux champions. En Angleterre, on l'admire encore aujourd'hui."]},
 course_manowar:{titre:"Man o' War, la légende américaine",paras:["Man o' War était un grand cheval roux flamboyant, star des courses américaines dans les années 1920.","Sur 21 courses, il en remporta 20 ! Sa seule défaite fut contre un cheval qui portait, ironie du sort, le nom d'« Upset » (la surprise).","On le cite souvent comme le meilleur cheval de course de toute l'histoire des États-Unis."]},
 course_pharlap:{titre:"Phar Lap, la fierté de l'Australie",paras:["Phar Lap était un immense cheval bai, champion des courses en Australie au début des années 1930.","Pendant la Grande Dépression, alors que la vie était dure, ses victoires redonnaient le sourire et l'espoir à tout un pays.","Il est devenu une véritable légende nationale : son cœur, deux fois plus gros que la normale, est encore exposé dans un musée."]},
 course_seabiscuit:{titre:"Seabiscuit, le petit qui devint grand",paras:["Seabiscuit était un petit cheval américain qu'on jugeait trop paresseux et pas assez élégant pour gagner.","Bien entraîné, il se mit pourtant à battre les plus grands champions. Dans l'Amérique de la Grande Dépression, il devint le héros des gens ordinaires.","En 1938, il battit en duel le grand favori War Admiral, écouté par des millions de personnes à la radio. Une belle histoire d'espoir, encore célèbre."]},
 course_zenyatta:{titre:"Zenyatta, la reine des pistes",paras:["Zenyatta était une jument de course américaine née en 2004, connue pour sa petite « danse » avant chaque départ.","Elle gagna 19 de ses 20 courses, souvent en partant dernière puis en doublant tout le monde dans la dernière ligne droite.","Immense (plus d'1,70 m au garrot), élégante et maligne, elle reste l'une des juments les plus aimées du sport."]}
};
const LEGENDES=new Set(['licorne','hippocampe','cheval_neptune','cheval_troie','centaure','uchchaihshravas','sleipnir','al_bouraq','matsukaze','bayard','kelpie','pegase','beasts_qirin','beasts_longma','beasts_alicorne','beasts_hippogriffe','beasts_hypalectryon','mythique_xanthos','mythique_balios','mythique_enbarr','mythique_grani','mythique_gringolet','mythique_kanthaka','mythique_rakhsh','mythique_veillantif','cheval_pale_mort','cheval_rouge_guerre','helhest','dullahan','mari_lwyd','mythe_tulpar','mythe_morvarch','mythe_lou_drape','mythe_caballo_marino','mythe_each_uisge','mythe_cabbyl_ushtey','mythe_puca','mythe_ceffyl_dwr','mythe_ak_kula','mythe_shabdiz','mythe_ama_no_fuchigoma','mythe_liath_macha','mythe_hrimfaxi','mythe_svadilfari','mythe_gullfaxi','mythe_areion','mythe_akbuzat','mythe_chollima','mythe_skinfaxi','mythe_sleipnir_rainbow']);
const FICHES_LEGENDE={
 pegase:{titre:"Pégase, le cheval ailé",paras:["Pégase est le célèbre cheval ailé de la mythologie grecque. Il naquit, dit la légende, du sang de la Gorgone Méduse.","Le héros Bellérophon réussit à l'apprivoiser et, sur son dos, combattit la Chimère, un monstre cracheur de feu.","À la fin, Pégase s'envola jusqu'au ciel et devint une constellation : on le voit encore parmi les étoiles !"]},
 sleipnir:{titre:"Sleipnir, le cheval à huit jambes",paras:["Sleipnir est le cheval du dieu Odin, dans la mythologie des Vikings du Nord.","Il a huit jambes, ce qui en fait le plus rapide des chevaux : il galope sur la terre, sur la mer et même dans les airs.","Fils du dieu farceur Loki, il pouvait voyager jusqu'au royaume des morts et en revenir."]},
 beasts_qirin:{titre:"Le Qilin, la licorne d'Orient",paras:["Le Qilin est une créature légendaire de Chine, souvent comparée à une licorne d'Orient.","Symbole de paix et de bonheur, il est si doux qu'il marche sans jamais écraser un brin d'herbe ni blesser un insecte.","On dit qu'il apparaît à la naissance ou à la mort d'un grand sage. C'est un porte-bonheur très respecté."]},
 beasts_hypalectryon:{titre:"L'Hippalectryon, mi-cheval mi-coq",paras:["L'Hippalectryon est une drôle de créature de la Grèce antique : mi-cheval à l'avant, mi-coq à l'arrière, avec des ailes et une queue de plumes !","On le trouve peint sur de très vieux vases grecs, il y a plus de 2500 ans.","Personne ne sait vraiment son rôle dans les histoires : c'était peut-être simplement une créature amusante et étrange, un clin d'œil des artistes d'autrefois."]},
 beasts_longma:{titre:"Le Longma, le cheval-dragon",paras:["Le Longma est un cheval-dragon de la mythologie chinoise, couvert d'écailles.","Il surgit des fleuves et des lacs, et son apparition annonce l'arrivée d'un sage ou d'un empereur juste.","Une légende raconte même qu'il révéla les tout premiers symboles de l'écriture chinoise."]},
 beasts_hippogriffe:{titre:"L'Hippogriffe, mi-aigle mi-cheval",paras:["L'Hippogriffe a la tête, les ailes et les serres d'un aigle à l'avant, et le corps d'un cheval à l'arrière.","Il apparaît dans un grand poème italien de la Renaissance, où un chevalier le chevauche pour voler à travers le monde.","Comme il vole plus vite que le vent, on disait qu'il pouvait faire le tour de la Terre en un clin d'œil."]},
 centaure:{titre:"Le Centaure, moitié homme moitié cheval",paras:["Le Centaure est une créature de la mythologie grecque : le haut du corps est humain, le bas est celui d'un cheval.","La plupart étaient sauvages et bagarreurs, mais l'un d'eux, Chiron, était très sage : il enseigna la médecine et le tir à l'arc à de grands héros.","On les imaginait vivant en troupeaux dans les montagnes et les forêts de la Grèce ancienne."]},
 licorne:{titre:"La licorne, la corne magique",paras:["La licorne est un cheval blanc portant une corne torsadée au milieu du front. On en parle depuis l'Antiquité, en Europe comme en Asie.","La légende dit que sa corne pouvait purifier l'eau empoisonnée, et que seul un cœur pur pouvait l'approcher.","Symbole de pureté et de magie, elle est devenue l'une des créatures imaginaires les plus aimées au monde."]},
 kelpie:{titre:"Le Kelpie, l'esprit des eaux",paras:["Le Kelpie est un esprit des eaux du folklore écossais, qui prend la forme d'un beau cheval près des lacs et des rivières.","Attention : si on monte sur son dos, il plonge au fond de l'eau ! C'est une légende pour rappeler de ne pas s'approcher des eaux profondes.","Aujourd'hui, deux immenses statues de Kelpies en acier veillent sur un canal d'Écosse."]},
 cheval_troie:{titre:"Le cheval de Troie, la grande ruse",paras:["Le cheval de Troie n'est pas un vrai cheval, mais un gigantesque cheval de bois de la mythologie grecque.","Pour entrer dans la ville de Troie, les Grecs se cachèrent à l'intérieur et l'offrirent en faux cadeau. La nuit venue, ils en sortirent !","Depuis, on parle de « cheval de Troie » pour désigner une ruse cachée dans un cadeau."]}
};
const BANK_GEEK_N2=[
 {q:"Que veut dire « bug » en informatique ?",r:"une erreur dans le programme",choix:["une erreur dans le programme","un vrai insecte","un jeu vidéo","un écran"],e:"Le mot vient d'un vrai insecte coincé dans une machine en 1947 !"},
 {q:"8 bits, ça fait…",r:"1 octet",choix:["1 octet","1 pixel","8 octets","1 écran"]},
 {q:"À quoi sert une boucle en programmation ?",r:"répéter des instructions",choix:["répéter des instructions","effacer le code","éteindre la machine","ranger les câbles"]},
 {q:"Un « pixel », c'est…",r:"un petit point de l'image",choix:["un petit point de l'image","un virus","un bouton","un câble"]},
 {q:"Que fait un capteur sur un robot ?",r:"il mesure son environnement",choix:["il mesure son environnement","il dessine","il chante","il dort"]},
 {q:"Sur le graphique, quel robot est le plus rapide ?",graph:{titre:"Vitesse (km/h)",labels:["R1","R2","R3"],valeurs:[12,7,20]},r:"R3",choix:["R3","R1","R2","aucun"]},
 {q:"Internet relie les ordinateurs du monde grâce à un…",r:"réseau",choix:["réseau","aquarium","volcan","tiroir"]},
 {q:"« Télécharger », ça veut dire…",r:"recevoir un fichier depuis Internet",choix:["recevoir un fichier depuis Internet","jeter un fichier","imprimer","débrancher"]},
 {q:"En binaire, on n'écrit qu'avec…",r:"des 0 et des 1",choix:["des 0 et des 1","des lettres","des couleurs","des dessins"]},
 {q:"À quoi sert la mémoire (RAM) ?",r:"garder ce sur quoi la machine travaille",choix:["garder ce sur quoi la machine travaille","faire du café","donner l'heure","refroidir"]},
 {q:"Un mot de passe sert à…",r:"protéger ton compte",choix:["protéger ton compte","accélérer l'écran","changer la couleur","imprimer"]},
 {q:"Le « cloud » (nuage), c'est…",r:"des ordinateurs qui stockent tes fichiers à distance",choix:["des ordinateurs qui stockent tes fichiers à distance","un vrai nuage","une imprimante","un clavier"]},
 {q:"Un robot suit un…",r:"programme",choix:["programme","rêve","hasard","dessin"]},
 {q:"Quelle machine imprime en relief, couche par couche ?",r:"l'imprimante 3D",choix:["l'imprimante 3D","le scanner","la souris","le micro"]},
  {q:"Avec quels chiffres compte un ordinateur ?",r:"0 et 1",choix:["0 et 1","1 à 10","Les lettres","Les couleurs"]},
  {q:"Comment s'appelle une erreur dans un programme ?",r:"Un bug",choix:["Un bug","Un chat","Une fleur","Un son"]},
  {q:"Internet relie…",r:"Des ordinateurs du monde entier",choix:["Des ordinateurs du monde entier","Deux crayons","Des voitures","Des étoiles"]},
  {q:"8 bits font…",r:"1 octet",choix:["1 octet","1 mètre","1 litre","1 kilo"]},
  {q:"Un dossier, sur l'ordinateur, sert à…",r:"Ranger des fichiers",choix:["Ranger des fichiers","Manger","Chauffer","Rouler"]},
  {q:"Le wifi sert à se connecter…",r:"Sans fil",choix:["Sans fil","Avec une corde","Avec de l'eau","Avec du feu"]},
  {q:"Un fichier peut être…",r:"Une photo ou un texte",choix:["Une photo ou un texte","Un vrai chien","Une chaise","Un nuage"]},
  {q:"Que fait un antivirus ?",r:"Il protège l'ordinateur",choix:["Il protège l'ordinateur","Il fait du bruit","Il dessine","Il cuisine"]},
  {q:"Une image est faite de plein de…",r:"Pixels",choix:["Pixels","Bonbons","Cailloux","Notes"]},
  {q:"Sauvegarder, ça veut dire…",r:"Garder son travail",choix:["Garder son travail","Tout effacer","Éteindre","Crier"]},
  {q:"Un lien sur internet, on peut…",r:"Cliquer dessus",choix:["Cliquer dessus","Le manger","Le planter","Le plier"]},
  {q:"Le code binaire n'utilise que…",r:"Deux chiffres",choix:["Deux chiffres","Dix chiffres","Des lettres","Des dessins"]},
  {q:"Un robot intelligent peut…",r:"Apprendre",choix:["Apprendre","Pleurer","Rêver","Dormir"]},
  {q:"Que fait un moteur de recherche ?",r:"Il trouve des infos",choix:["Il trouve des infos","Il roule","Il chante","Il cuit"]},
  {q:"Un email, c'est…",r:"Une lettre par ordinateur",choix:["Une lettre par ordinateur","Un gâteau","Un jouet","Un animal"]},
  {q:"La mémoire de l'ordinateur sert à…",r:"Retenir des choses",choix:["Retenir des choses","Chauffer","Éclairer","Rouler"]},
  {q:"Télécharger, c'est…",r:"Recevoir un fichier",choix:["Recevoir un fichier","Jeter","Casser","Peindre"]},
  {q:"Un écran fait les couleurs avec…",r:"Rouge, vert, bleu",choix:["Rouge, vert, bleu","Noir et blanc seulement","Une seule couleur","Des odeurs"]},
  {q:"Pour aller sur internet, il faut…",r:"Une connexion",choix:["Une connexion","Une échelle","Une clé","Un ballon"]},
  {q:"Un pixel, c'est…",r:"Un petit point de l'image",choix:["Un petit point de l'image","Un animal","Un son","Un légume"]},
];
const BANK_ANGLAIS_N2=[
 {q:"« un chien » se dit…",r:"a dog",choix:["a dog","a cat","a bird","a fish"]},
 {q:"« Merci beaucoup » se dit…",r:"thank you very much",choix:["thank you very much","good night","see you","i am sorry"]},
 {q:"« seven », c'est…",r:"7",choix:["7","5","9","6"]},
 {q:"Look: 🐎 is a…",r:"horse",choix:["horse","cow","sheep","dog"]},
 {q:"« Je m'appelle Léa » se dit…",r:"My name is Léa",choix:["My name is Léa","I am fine","Good morning","See you"]},
 {q:"What colour is the sky?",r:"blue",choix:["blue","red","green","brown"]},
 {q:"« un livre » se dit…",r:"a book",choix:["a book","a pen","a table","a door"]},
 {q:"On the graph, which animal has the most?",graph:{titre:"Animals",labels:["Dogs","Cats","Birds"],valeurs:[4,8,5]},r:"Cats",choix:["Cats","Dogs","Birds","none"]},
 {q:"« Quel âge as-tu ? » se dit…",r:"How old are you?",choix:["How old are you?","What is your name?","Where are you?","How are you?"]},
 {q:"« big » veut dire…",r:"grand",choix:["grand","petit","rouge","chaud"]},
 {q:"« a house » veut dire…",r:"une maison",choix:["une maison","un cheval","une école","un jardin"]},
 {q:"Monday, Tuesday, … what comes next?",r:"Wednesday",choix:["Wednesday","Sunday","Friday","April"]},
 {q:"« I like horses » veut dire…",r:"J'aime les chevaux",choix:["J'aime les chevaux","Je déteste courir","Je suis fatigué","Il fait froid"]},
 {q:"« water » veut dire…",r:"l'eau",choix:["l'eau","le feu","le pain","le lait"]},
];
const BANK_ART_N2=[
 {q:"Qui a peint « La Joconde » ?",r:"Léonard de Vinci",choix:["Léonard de Vinci","Picasso","Van Gogh","Monet"]},
 {q:"Qui a peint « La Nuit étoilée » ?",r:"Van Gogh",choix:["Van Gogh","Monet","Michel-Ange","Dalí"]},
 {q:"Les trois couleurs primaires sont…",r:"rouge, jaune, bleu",choix:["rouge, jaune, bleu","vert, orange, violet","noir, blanc, gris","rose, or, argent"]},
 {q:"Que donne 🔵 bleu + 🔴 rouge ?",schema:"🔵 + 🔴 = ❓",r:"du violet",choix:["du violet","du vert","de l'orange","du brun"]},
 {q:"Un artiste qui fait des statues est un…",r:"sculpteur",choix:["sculpteur","musicien","danseur","cuisinier"]},
 {q:"Picasso a inventé un art aux formes en cubes : le…",r:"cubisme",choix:["cubisme","réalisme","impressionnisme","romantisme"]},
 {q:"Monet peignait la lumière et les reflets : c'était un…",r:"impressionniste",choix:["impressionniste","cubiste","sculpteur","photographe"]},
 {q:"Une peinture faite sur un mur s'appelle une…",r:"fresque",choix:["fresque","aquarelle","statue","mosaïque"]},
 {q:"Michel-Ange a peint le plafond de la chapelle…",r:"Sixtine",choix:["Sixtine","Ronde","Bleue","du Nord"]},
 {q:"Une « nature morte » représente surtout…",r:"des objets (fruits, fleurs)",choix:["des objets (fruits, fleurs)","des batailles","des dragons","des voitures"]},
 {q:"Quel outil sert à étaler la peinture ?",r:"le pinceau",choix:["le pinceau","le marteau","la règle","la gomme"]},
 {q:"Un « autoportrait », c'est l'artiste qui peint…",r:"lui-même",choix:["lui-même","un paysage","un cheval","le ciel"]},
 {q:"Que donne 🔴 + 🔵 + 🟡 (toutes mélangées) ?",schema:"🔴+🔵+🟡 = ❓",r:"du brun foncé",choix:["du brun foncé","du blanc","du doré","du rose vif"]},
 {q:"Rodin est célèbre pour ses…",r:"sculptures",choix:["sculptures","chansons","romans","photos"]},
];
const BANK_NEERLANDAIS_N2=[
 {q:"« dank je wel » veut dire…",r:"merci",choix:["merci","bonjour","au revoir","oui"]},
 {q:"Kijk : 🐶 = hond. Wat is 🐱 ?",schema:"🐶 hond · 🐱 ❓",r:"kat",choix:["kat","paard","koe","vogel"]},
 {q:"« een huis » veut dire…",r:"une maison",choix:["une maison","un cheval","une école","un arbre"]},
 {q:"Compte : één, twee, …",r:"drie",choix:["drie","tien","zeven","vijf"]},
 {q:"« water » veut dire…",r:"l'eau",choix:["l'eau","le pain","le lait","le feu"]},
 {q:"« goedemorgen » veut dire…",r:"bonjour (le matin)",choix:["bonjour (le matin)","bonne nuit","merci","au revoir"]},
 {q:"Kijk : 🍎 = appel. Wat is 🌸 ?",schema:"🍎 appel · 🌸 ❓",r:"bloem",choix:["bloem","boom","boek","brood"]},
 {q:"« rood », c'est quelle couleur ?",r:"rouge",choix:["rouge","bleu","vert","jaune"]},
 {q:"« een boek » veut dire…",r:"un livre",choix:["un livre","une porte","une table","un stylo"]},
 {q:"Le néerlandais se parle au nord de la Belgique, en…",r:"Flandre",choix:["Flandre","Wallonie","France","Suisse"]},
 {q:"« ja » / « nee » veulent dire…",r:"oui / non",choix:["oui / non","non / oui","merci / pardon","grand / petit"]},
 {q:"Kijk : ☀️ zon · 🌙 maan · ⭐ ❓",schema:"☀️ zon · 🌙 maan · ⭐ ❓",r:"ster",choix:["ster","zon","boom","huis"]},
 {q:"« melk » veut dire…",r:"le lait",choix:["le lait","le pain","l'eau","le sucre"]},
 {q:"« tot ziens » veut dire…",r:"au revoir",choix:["au revoir","bonjour","merci","bravo"]},
];
const PACK_THEO_NIV={
 geek:["🤖 NIVEAU 1 — Les bases\nUn ORDINATEUR reçoit une info (clavier), la traite (processeur) et l'affiche (écran).\nUn ROBOT a des capteurs pour sentir, un moteur pour bouger et un programme qui lui dit quoi faire.\nUn ALGORITHME est une suite d'instructions, comme une recette de cuisine.\n👉 Pour réussir : lis bien les petits schémas et graphiques, la réponse s'y cache souvent.","🤖 NIVEAU 2 — Plus loin\nLes ordinateurs ne comptent qu'avec des 0 et des 1 : c'est le BINAIRE (8 bits = 1 octet).\nUn BUG est une erreur dans le programme ; une BOUCLE répète des instructions.\nLa MÉMOIRE (RAM) garde ce sur quoi la machine travaille ; le CLOUD stocke tes fichiers à distance.\nInternet relie les ordinateurs du monde par un RÉSEAU."],
 anglais:["🇬🇧 NIVEAU 1 — First words\nSalutations : hello, goodbye, please, thank you, yes, no.\nCouleurs : red, blue, green, yellow. Nombres : one, two, three, four, five.\n👉 Pour réussir : appuie-toi sur les symboles et les images pour deviner le mot.","🇬🇧 NIVEAU 2 — Sentences\nSe présenter : My name is… · How old are you? · How are you?\nAnimaux : dog, cat, bird, horse, cow. Objets : a book, a house.\nLes jours : Monday, Tuesday, Wednesday…\nPetites phrases : « I like horses » = j'aime les chevaux."],
 art:["🎨 NIVEAU 1 — Les couleurs\nLes 3 couleurs PRIMAIRES sont rouge, jaune, bleu : en les mélangeant, on fait toutes les autres.\nBleu + jaune = vert · rouge + jaune = orange · rouge + bleu = violet.\n👉 Pour réussir : regarde bien le petit schéma du mélange avant de répondre.","🎨 NIVEAU 2 — Les grands artistes\nLéonard de Vinci a peint la Joconde ; Van Gogh, la Nuit étoilée.\nMonet était impressionniste (la lumière) ; Picasso a inventé le cubisme (les formes en cubes).\nUn sculpteur fait des statues ; une fresque est peinte sur un mur.\nMichel-Ange a peint le plafond de la chapelle Sixtine."],
 neerlandais:["🇳🇱 NIVEAU 1 — Eerste woorden\nLe néerlandais se parle en Flandre, au nord de la Belgique.\nBases : hallo (bonjour), dank je (merci), ja (oui), nee (non).\nMots : paard (cheval), hond (chien), kat (chat), water (eau), boom (arbre).\n👉 Pour réussir : sers-toi des images pour retrouver le mot.","🇳🇱 NIVEAU 2 — Verder\nSaluer : goedemorgen (bonjour le matin), tot ziens (au revoir).\nCompter : één, twee, drie, vier, vijf.\nMots : huis (maison), boek (livre), bloem (fleur), melk (lait), ster (étoile).\nCouleur : rood (rouge)."],
 ortho:["✍️ NIVEAU 1 — Bien écrire\nÉcoute l'indice et écris le mot en entier.\nPense aux ACCENTS : é, è, à, ê, î.\nN'oublie pas les lettres MUETTES à la fin (le -e, le -s, le -t).\n👉 Pour réussir : relis-toi avant de valider !","✍️ NIVEAU 2 — Mots plus durs\nAttention aux DOUBLES lettres (pomme, cheval → chevaux au pluriel).\nLes sons difficiles : « ph » = f, « qu » = k, sans oublier « gn » et « eau ».\nCertains mots ont des lettres qu'on n'entend pas : accorde bien et relis-toi."]
};

/* ===== MINI-LEÇONS (Lot 6) : leçons dédiées, courtes et animées. Une par pack et par niveau. ===== */
const LECONS={
  geek:[
    {titre:'Les bases',slides:[
      {ico:'💻',t:"Un ordinateur reçoit une info, la traite, puis l'affiche à l'écran."},
      {ico:'🤖',t:"Un robot a des capteurs pour sentir et un moteur pour bouger."},
      {ico:'📝',t:"Un algorithme, c'est une suite d'étapes, comme une recette de cuisine."},
    ]},
    {titre:'Plus loin',slides:[
      {ico:'🔢',t:"Les ordinateurs ne comptent qu'avec des 0 et des 1 : c'est le binaire."},
      {ico:'🐛',t:"Un bug, c'est une petite erreur cachée dans un programme."},
      {ico:'🌐',t:"Internet relie des millions d'ordinateurs partout dans le monde."},
    ]},
  ],
  anglais:[
    {titre:'First words',slides:[
      {ico:'👋',t:"Hello = bonjour.  Goodbye = au revoir.  Thank you = merci."},
      {ico:'🎨',t:"Red = rouge.  Blue = bleu.  Green = vert.  Yellow = jaune."},
      {ico:'🔢',t:"One, two, three… c'est un, deux, trois en anglais !"},
    ]},
    {titre:'Sentences',slides:[
      {ico:'🙋',t:"« My name is… » veut dire « Je m'appelle… »."},
      {ico:'🐴',t:"Dog = chien.  Cat = chat.  Horse = cheval."},
      {ico:'❓',t:"« How are you? » veut dire « Comment vas-tu ? »."},
    ]},
  ],
  art:[
    {titre:'Les couleurs',slides:[
      {ico:'🔴',t:"Les 3 couleurs primaires sont le rouge, le jaune et le bleu."},
      {ico:'🟢',t:"Bleu + jaune = vert.  On mélange pour créer de nouvelles couleurs !"},
      {ico:'🟣',t:"Rouge + jaune = orange.  Rouge + bleu = violet."},
    ]},
    {titre:'Les grands artistes',slides:[
      {ico:'🖼️',t:"Léonard de Vinci a peint la Joconde, un tableau très célèbre."},
      {ico:'🌌',t:"Van Gogh a peint la Nuit étoilée, pleine de tourbillons."},
      {ico:'🌸',t:"Monet peignait la lumière et la nature : c'est l'impressionnisme."},
    ]},
  ],
  neerlandais:[
    {titre:'Eerste woorden',slides:[
      {ico:'🇳🇱',t:"Le néerlandais se parle en Flandre, au nord de la Belgique."},
      {ico:'👋',t:"Hallo = bonjour.  Dank je = merci.  Ja = oui, nee = non."},
      {ico:'🐴',t:"Paard = cheval.  Hond = chien.  Kat = chat."},
    ]},
    {titre:'Verder',slides:[
      {ico:'🌅',t:"Goedemorgen = bonjour le matin.  Tot ziens = au revoir."},
      {ico:'🔢',t:"Één, twee, drie = un, deux, trois."},
      {ico:'🏠',t:"Huis = maison.  School = école."},
    ]},
  ],
  ortho:[
    {titre:'Bien écrire',slides:[
      {ico:'👂',t:"Écoute bien l'indice, puis écris le mot en entier."},
      {ico:'✏️',t:"Pense aux accents : é, è, à, ê, î."},
      {ico:'🤫',t:"N'oublie pas les lettres muettes, comme le -d de « grand »."},
    ]},
    {titre:'Mots plus durs',slides:[
      {ico:'🔁',t:"Attention aux lettres doubles : pomme, cheval."},
      {ico:'🔤',t:"« ph » se lit « f » (photo).  « qu » se lit « k » (quatre)."},
      {ico:'📚',t:"Au pluriel, un cheval devient des chevaux !"},
    ]},
  ],
};

const BANK_FR=[
 {q:"D'après le sondage de la classe, quel livre est préféré ?",graph:{titre:"Livre préféré (votes)",labels:["BD","Roman","Docu"],valeurs:[8,5,3]},r:"la BD",choix:["la BD","le roman","le documentaire","aucun"]},
 {q:"Dans le schéma, quel mot est le contraire de « grand » ?",schema:"grand ↔️ ❓",r:"petit",choix:["petit","gros","haut","large"]},
 {q:"Quel est le contraire de « grand » ?",r:"petit",choix:["petit","gros","haut","long"]},
 {q:"Le pluriel de « cheval » ?",r:"chevaux",choix:["chevaux","chevals","chevaus","chevaes"]},
 {q:"Le contraire de « rapide » ?",r:"lent",choix:["lent","vite","pressé","fort"]},
 {q:"Un synonyme de « joyeux » ?",r:"content",choix:["content","triste","fâché","fatigué"]},
 {q:"« Elle ___ un poney. » (avoir)",r:"a",choix:["a","as","à","ah"]},
 {q:"La femelle du cheval, c'est la… ?",r:"jument",choix:["jument","vache","ânesse","brebis"]},
 {q:"Le contraire de « ouvert » ?",r:"fermé",choix:["fermé","cassé","vide","large"]},
 {q:"« Les enfants ___ contents. » (être)",r:"sont",choix:["sont","son","ont","font"]},
 {q:"Un synonyme de « beau » ?",r:"joli",choix:["joli","laid","vieux","petit"]},
 {q:"Quel mot est bien écrit ?",r:"toujours",choix:["toujours","toujour","tousjours","toujourre"]},
 {q:"Le contraire de « jour » ?",r:"nuit",choix:["nuit","soir","matin","midi"]},
 {q:"« Je ___ à cheval. » (monter)",r:"monte",choix:["monte","montes","montent","monté"]},
 {q:"Le contraire de « long » ?",r:"court",choix:["court","haut","gros","fin"]},
 {q:"Un synonyme de « rapide » ?",r:"vif",choix:["vif","lourd","calme","mou"]},
];
const BANK_HIST=[
 {q:"Sur la frise du temps, quelle période est la plus ancienne ?",schema:"🦣 Préhistoire → 🏛️ Antiquité → 🏰 Moyen Âge → 🗼 aujourd'hui",r:"la Préhistoire",choix:["la Préhistoire","le Moyen Âge","l'Antiquité","aujourd'hui"]},
 {q:"Sur la frise, quelle période vient juste après l'Antiquité ?",schema:"🏛️ Antiquité → ❓ → 🗼 aujourd'hui",r:"le Moyen Âge",choix:["le Moyen Âge","la Préhistoire","la Renaissance","le futur"]},
 {q:"En quelle année est née la Belgique ?",r:"1830",choix:["1830","1789","1914","2000"]},
 {q:"Qui vivait dans les châteaux forts au Moyen Âge ?",r:"les chevaliers",choix:["les chevaliers","les astronautes","les pirates","les cow-boys"]},
 {q:"Sur quel animal le chevalier partait-il au combat ?",r:"le cheval",choix:["le cheval","le chameau","l'éléphant","le lion"]},
 {q:"Qui a construit les grandes pyramides ?",r:"les Égyptiens",choix:["les Égyptiens","les Belges","les Vikings","les Chinois"]},
 {q:"Quelle langue parlaient les Romains ?",r:"le latin",choix:["le latin","l'anglais","le russe","le japonais"]},
 {q:"Le drapeau belge : noir, jaune et… ?",r:"rouge",choix:["rouge","vert","bleu","blanc"]},
 {q:"À quoi servait une armure ?",r:"à se protéger",choix:["à se protéger","à voler","à nager","à dormir"]},
 {q:"Les dinosaures ont vécu… ?",r:"il y a très longtemps",choix:["il y a très longtemps","l'an dernier","aujourd'hui","demain"]},
 {q:"Avant les voitures, on voyageait souvent… ?",r:"à cheval",choix:["à cheval","en avion","en fusée","en métro"]},
 {q:"Le roi des Belges aujourd'hui s'appelle… ?",r:"Philippe",choix:["Philippe","Albert","Arthur","Louis"]},
 {q:"Un château fort servait à… ?",r:"se défendre",choix:["se défendre","faire les courses","jouer au foot","nager"]},
 {q:"Au Moyen Âge, on écrivait sur… ?",r:"du parchemin",choix:["du parchemin","un ordinateur","un téléphone","une tablette"]},
];
const BANK_SCI=[
 {q:"Sur le graphique, quel animal court le plus vite ?",graph:{titre:"Vitesse (km/h)",labels:["Cheval","Chat","Tortue"],valeurs:[60,45,1]},r:"le cheval",choix:["le cheval","le chat","la tortue","aucun"]},
 {q:"Complète le cycle du papillon : 🥚 → 🐛 → 🛡️ chrysalide → ?",schema:"🥚 œuf → 🐛 chenille → 🛡️ chrysalide → ❓",r:"🦋 le papillon",choix:["🦋 le papillon","🐟 le poisson","🐍 le serpent","🐣 le poussin"]},
 {q:"Dans cette chaîne alimentaire, qui mange la chenille ?",schema:"🌱 plante → 🐛 chenille → ❓",r:"l'oiseau",choix:["l'oiseau","la plante","le soleil","la pierre"]},
 {q:"Regarde le graphique : quel jour a-t-il le plus plu ?",graph:{titre:"Pluie de la semaine (mm)",labels:["Lun","Mar","Mer","Jeu","Ven"],valeurs:[2,6,1,8,3]},r:"Jeudi",choix:["Jeudi","Mardi","Vendredi","Lundi"]},
 {q:"Complète le cycle de l'eau : que vient-il après le nuage ?",schema:"☀️ soleil → 💧 évaporation → ☁️ nuage → ❓",r:"🌧️ la pluie",choix:["🌧️ la pluie","🔥 le feu","🏔️ la montagne","🌙 la nuit"]},
 {q:"Un arbre qui garde ses aiguilles vertes toute l'année est un… ?",r:"conifère",choix:["conifère","feuillu","cactus","palmier"]},
 {q:"Un arbre qui perd ses feuilles en automne est un… ?",r:"feuillu",choix:["feuillu","conifère","champignon","buisson"]},
 {q:"Quel petit animal roux cache des noisettes dans la forêt ?",r:"l'écureuil",choix:["l'écureuil","le dauphin","le pingouin","le crocodile"]},
 {q:"En automne, sous un chêne, on ramasse des… ? (ils donnent de nouveaux chênes)",r:"glands",choix:["glands","bananes","cailloux","coquillages"]},
 {q:"L'ensemble des plantes et animaux d'un même milieu s'appelle un… ?",r:"écosystème",choix:["écosystème","aquarium","désert","volcan"]},
 {q:"Les racines d'un arbre servent surtout à… ?",r:"puiser l'eau du sol",choix:["puiser l'eau du sol","voler","faire du bruit","éclairer"]},
 {q:"Grâce aux arbres, l'air de la forêt est plus… ?",r:"pur",choix:["pur","sale","chaud","bruyant"]},
 {q:"Que ne faut-il jamais laisser derrière soi en forêt ?",r:"ses déchets",choix:["ses déchets","les arbres","les animaux","le silence"]},
 {q:"Combien de pattes a un cheval ?",r:"4",choix:["4","2","6","8"]},
 {q:"Que mange surtout le cheval ?",r:"de l'herbe",choix:["de l'herbe","de la viande","du poisson","des bonbons"]},
 {q:"Le bébé de la jument s'appelle… ?",r:"le poulain",choix:["le poulain","le veau","l'agneau","le chaton"]},
 {q:"Combien de pattes a une araignée ?",r:"8",choix:["8","6","4","10"]},
 {q:"L'eau très froide devient… ?",r:"de la glace",choix:["de la glace","de la vapeur","du sable","du feu"]},
 {q:"Les abeilles fabriquent… ?",r:"du miel",choix:["du miel","du lait","du pain","du jus"]},
 {q:"Le plus grand animal sur la terre ferme ?",r:"l'éléphant",choix:["l'éléphant","le cheval","le chien","la souris"]},
 {q:"Le soleil est une… ?",r:"étoile",choix:["étoile","planète","lune","comète"]},
 {q:"La chenille se transforme en… ?",r:"papillon",choix:["papillon","oiseau","abeille","fourmi"]},
 {q:"Combien de saisons dans une année ?",r:"4",choix:["4","2","3","12"]},
 {q:"Un grand bateau en métal, sur l'eau… ?",r:"il flotte",choix:["il flotte","il coule","il fond","il s'envole"]},
 {q:"Que respire-t-on pour vivre ?",r:"de l'air",choix:["de l'air","de l'eau","du sable","du feu"]},
 {q:"Combien de pattes a un insecte ?",r:"6",choix:["6","4","8","2"]},
 {q:"D'où vient la pluie ?",r:"des nuages",choix:["des nuages","du sol","des arbres","du feu"]},
];
const BANK_GEO=[
 {q:"Sur le graphique, quel pays a le plus d'habitants ?",graph:{titre:"Habitants (millions)",labels:["Belgique","France","Pays-Bas"],valeurs:[11,68,18]},r:"la France",choix:["la France","la Belgique","les Pays-Bas","aucun"]},
 {q:"Sur le graphique, quelle montagne est la plus haute ?",graph:{titre:"Hauteur (m)",labels:["Mont Blanc","Botrange","Kilimandjaro"],valeurs:[4808,694,5895]},r:"le Kilimandjaro",choix:["le Kilimandjaro","le Mont Blanc","le Botrange","aucune"]},
 {q:"Sur une boussole, la flèche du Nord pointe vers… ?",schema:"🧭 ⬆️ N",r:"le haut (le Nord)",choix:["le haut (le Nord)","le bas","la droite","la gauche"]},
 {q:"La capitale de la Belgique ?",r:"Bruxelles",choix:["Bruxelles","Anvers","Namur","Liège"]},
 {q:"Combien de provinces compte la Belgique ?",r:"10",choix:["10","5","12","8"]},
 {q:"Le fleuve qui traverse Anvers ?",r:"l'Escaut",choix:["l'Escaut","la Meuse","le Rhône","la Seine"]},
 {q:"La Belgique se trouve en… ?",r:"Europe",choix:["Europe","Afrique","Asie","Amérique"]},
 {q:"Quelle mer borde la Belgique ?",r:"la mer du Nord",choix:["la mer du Nord","la Méditerranée","la mer Rouge","l'océan Indien"]},
 {q:"Combien de langues officielles en Belgique ?",r:"3",choix:["3","1","2","5"]},
 {q:"Le chef-lieu de la province de Liège ?",r:"Liège",choix:["Liège","Namur","Mons","Arlon"]},
 {q:"Le chef-lieu de la province du Hainaut ?",r:"Mons",choix:["Mons","Charleroi","Tournai","Wavre"]},
 {q:"Le chef-lieu de la Flandre orientale ?",r:"Gand",choix:["Gand","Bruges","Anvers","Hasselt"]},
 {q:"La capitale de la France ?",r:"Paris",choix:["Paris","Londres","Berlin","Madrid"]},
 {q:"La capitale des Pays-Bas ?",r:"Amsterdam",choix:["Amsterdam","Bruxelles","Rome","Vienne"]},
 {q:"Bruxelles est une… ?",r:"Région",choix:["Région","province","commune","montagne"]},
 {q:"La plus haute montagne du monde ?",r:"l'Everest",choix:["l'Everest","le Mont Blanc","l'Etna","le Vésuve"]},
 {q:"Le chef-lieu de la Flandre occidentale ?",r:"Bruges",choix:["Bruges","Gand","Ostende","Courtrai"]},
 {q:"Namur est le chef-lieu de la province de… ?",r:"Namur",choix:["Namur","Liège","Luxembourg","Brabant wallon"]},
];
const BANK_GEEK=[
 {q:"Sur le graphique, quel jeu a le plus de joueurs ?",graph:{titre:"Joueurs (millions)",labels:["Jeu A","Jeu B","Jeu C"],valeurs:[30,50,20]},r:"Jeu B",choix:["Jeu B","Jeu A","Jeu C","aucun"]},
 {q:"Dans un ordinateur, l'info va du clavier au… puis à l'écran ?",schema:"⌨️ clavier → ❓ → 🖥️ écran",r:"processeur",choix:["processeur","frigo","stylo","nuage"]},
 {q:"Qu'est-ce qu'un algorithme ?",r:"une suite d'instructions",choix:["une suite d'instructions","un robot","un jeu vidéo","une pile"],e:"Une recette de cuisine est un algorithme !"},
 {q:"Dans un programme, une « boucle » sert à… ?",r:"répéter des actions",choix:["répéter des actions","effacer le code","éteindre l'écran","voler"],e:"La boucle répète sans tout réécrire."},
 {q:"Un « bug » informatique, c'est… ?",r:"une erreur",choix:["une erreur","un insecte utile","un jeu","une image"],e:"On « débogue » pour corriger les erreurs."},
 {q:"Un ordinateur calcule avec le langage… ?",r:"binaire (0 et 1)",choix:["binaire (0 et 1)","le français","les emojis","le morse"],e:"Tout est fait de 0 et de 1 !"},
 {q:"Une « variable » en programmation, c'est… ?",r:"une case qui garde une valeur",choix:["une case qui garde une valeur","un écran","un fil","une hélice"]},
 {q:"« SI il pleut ALORS je prends un parapluie » est une… ?",r:"condition",choix:["condition","boucle","image","batterie"]},
 {q:"Un robot « sent » son environnement grâce à des… ?",r:"capteurs",choix:["capteurs","hélices","autocollants","roues"],e:"Capteur de distance, de lumière, de température…"},
 {q:"Ce qui fait bouger un robot ?",r:"un moteur",choix:["un moteur","un capteur","un écran","un aimant"]},
 {q:"Le « cerveau » qui exécute le programme d'un robot ?",r:"le processeur",choix:["le processeur","la roue","l'antenne","la vis"]},
 {q:"Un drone vole grâce à ses… ?",r:"hélices",choix:["hélices","roues","ailes fixes","pattes"]},
 {q:"Combien d'hélices a un quadricoptère ?",r:"4",choix:["4","2","6","1"],e:"« Quadri » veut dire quatre."},
 {q:"Un drone se repère dans l'espace grâce au… ?",r:"GPS",choix:["GPS","clavier","haut-parleur","miroir"]},
 {q:"Ce qui donne de l'énergie à un drone ?",r:"une batterie",choix:["une batterie","le vent","l'eau","le papier"]},
 {q:"Piloter un drone à distance se fait avec… ?",r:"une télécommande",choix:["une télécommande","un crayon","une clé","un ballon"]},
 {q:"L'électricité circule dans un… ?",r:"circuit",choix:["circuit","livre","tissu","morceau de bois"],e:"Le circuit doit être fermé pour que ça marche."},
 {q:"Ce qui stocke l'énergie électrique ?",r:"une pile",choix:["une pile","une éponge","un aimant","une loupe"]},
 {q:"Une LED, c'est… ?",r:"une petite lumière",choix:["une petite lumière","un moteur","un son","un capteur"]},
 {q:"Un « pixel », c'est… ?",r:"un petit point de l'image",choix:["un petit point de l'image","un robot","un son","un fil"],e:"Une image = des milliers de pixels."},
 {q:"Le Wi-Fi sert à… ?",r:"se connecter sans fil",choix:["se connecter sans fil","faire du café","voler","dessiner"]},
 {q:"Pour ne pas se cogner aux murs, un robot utilise un capteur de… ?",r:"distance",choix:["distance","couleur","goût","odeur"]},
  {q:"À quoi sert un clavier ?",r:"À écrire",choix:["À écrire","À imprimer","À dessiner","À chanter"]},
  {q:"À quoi sert la souris d'ordinateur ?",r:"À déplacer le curseur",choix:["À déplacer le curseur","À manger","À écouter la musique","À imprimer"]},
  {q:"Où voit-on les images de l'ordinateur ?",r:"Sur l'écran",choix:["Sur l'écran","Dans le clavier","Dans la souris","Sous la table"]},
  {q:"Qu'est-ce qu'un robot sait faire ?",r:"Bouger tout seul",choix:["Bouger tout seul","Manger une pomme","Faire des rêves","Grandir"]},
  {q:"Comment s'appelle le cerveau de l'ordinateur ?",r:"Le processeur",choix:["Le processeur","L'écran","La souris","Le câble"]},
  {q:"Un algorithme, c'est comme…",r:"Une recette",choix:["Une recette","Une chanson","Un dessin","Un ballon"]},
  {q:"Que font les capteurs d'un robot ?",r:"Ils sentent le monde",choix:["Ils sentent le monde","Ils dorment","Ils mangent","Ils volent"]},
  {q:"Qu'est-ce qui donne l'électricité à l'ordinateur ?",r:"Le câble d'alimentation",choix:["Le câble d'alimentation","La souris","Le clavier","Le haut-parleur"]},
  {q:"Un ordinateur portable, on peut le…",r:"Emporter partout",choix:["Emporter partout","Manger","Planter dans le jardin","Faire voler"]},
  {q:"Que fait la touche « espace » ?",r:"Elle met un espace",choix:["Elle met un espace","Elle éteint","Elle imprime","Elle chante"]},
  {q:"Comment appelle-t-on un petit programme sur un téléphone ?",r:"Une application",choix:["Une application","Une pomme","Une chanson","Une photo"]},
  {q:"Que fait une imprimante ?",r:"Elle met sur du papier",choix:["Elle met sur du papier","Elle chante","Elle joue","Elle vole"]},
  {q:"Un écran tactile, on l'utilise avec…",r:"Le doigt",choix:["Le doigt","Un marteau","Une fourchette","Un crayon"]},
  {q:"Que veut dire « cliquer » ?",r:"Appuyer sur la souris",choix:["Appuyer sur la souris","Sauter","Crier","Manger"]},
  {q:"Un casque audio sert à…",r:"Écouter le son",choix:["Écouter le son","Voir mieux","Écrire","Imprimer"]},
  {q:"Comment éteint-on bien un ordinateur ?",r:"On l'arrête proprement",choix:["On l'arrête proprement","On le jette","On le mouille","On crie dessus"]},
  {q:"Une webcam sert à…",r:"Filmer",choix:["Filmer","Chauffer","Écrire","Rouler"]},
  {q:"Un robot suit…",r:"Un programme",choix:["Un programme","Ses rêves","La lune","Le vent"]},
  {q:"Qui écrit les programmes ?",r:"Les programmeurs",choix:["Les programmeurs","Les boulangers","Les facteurs","Les jardiniers"]},
  {q:"Sur quoi tape-t-on pour écrire un mot ?",r:"Le clavier",choix:["Le clavier","L'écran","La souris","La prise"]},
];
const BANK_ANGLAIS=[
 {q:"On the graph, which fruit is the favourite?",graph:{titre:"Favourite fruit (votes)",labels:["Apple","Banana","Cherry"],valeurs:[6,9,4]},r:"Banana",choix:["Banana","Apple","Cherry","none"]},
 {q:"Look at the symbols. What is 🌧️ in English?",schema:"☀️ = sun · 🌧️ = ❓",r:"rain",choix:["rain","snow","wind","sun"]},
 {q:"Comment dit-on « chien » en anglais ?",r:"dog",choix:["dog","cat","cow","fish"]},
 {q:"« Cat » veut dire… ?",r:"chat",choix:["chat","chien","cheval","vache"]},
 {q:"Comment dit-on « rouge » ?",r:"red",choix:["red","blue","green","black"]},
 {q:"« Blue » veut dire… ?",r:"bleu",choix:["bleu","rouge","vert","jaune"]},
 {q:"Comment dit-on « bonjour » ?",r:"hello",choix:["hello","goodbye","thanks","yes"]},
 {q:"« Thank you » veut dire… ?",r:"merci",choix:["merci","pardon","bonjour","oui"]},
 {q:"Comment dit-on « cheval » ?",r:"horse",choix:["horse","house","mouse","dog"]},
 {q:"« Yes » veut dire… ?",r:"oui",choix:["oui","non","merci","salut"]},
 {q:"« No » veut dire… ?",r:"non",choix:["non","oui","stop","peut-être"]},
 {q:"Comment dit-on « merci » ?",r:"thank you",choix:["thank you","please","sorry","hello"]},
 {q:"« Dog » veut dire… ?",r:"chien",choix:["chien","chat","cochon","canard"]},
 {q:"Comment dit-on « vert » ?",r:"green",choix:["green","red","grey","brown"]},
 {q:"« Yellow » veut dire… ?",r:"jaune",choix:["jaune","orange","bleu","blanc"]},
 {q:"Comment dit-on « maison » ?",r:"house",choix:["house","horse","mouse","home"]},
 {q:"« Water » veut dire… ?",r:"eau",choix:["eau","feu","air","lait"]},
 {q:"« Four » = quel nombre ?",r:"4",choix:["4","2","5","14"]},
 {q:"« Five » = quel nombre ?",r:"5",choix:["5","4","9","15"]},
 {q:"Comment dit-on « au revoir » ?",r:"goodbye",choix:["goodbye","hello","welcome","sorry"]},
 {q:"« Please » veut dire… ?",r:"s'il te plaît",choix:["s'il te plaît","merci","pardon","oui"]},
 {q:"« Sun » veut dire… ?",r:"soleil",choix:["soleil","lune","étoile","pluie"]},
 {q:"Comment dit-on « livre » ?",r:"book",choix:["book","look","door","ball"]},
 {q:"« Friend » veut dire… ?",r:"ami",choix:["ami","ennemi","frère","voisin"]},
 {q:"Comment dit-on « école » ?",r:"school",choix:["school","house","street","shop"]},
 {q:"« Big » veut dire… ?",r:"grand",choix:["grand","petit","gros","haut"]},
 {q:"« Small » veut dire… ?",r:"petit",choix:["petit","grand","court","vite"]},
 {q:"« Horse » veut dire… ?",r:"cheval",choix:["cheval","maison","souris","âne"]},
];
const ORTHO_T={mot:{i:'✏️',n:'Écris le mot'},pluriel:{i:'➕',n:'Le pluriel'},feminin:{i:'♀️',n:'Le féminin'},faute:{i:'🔧',n:'Corrige la faute'},accent:{i:'´',n:'Ajoute les accents'},homophone:{i:'🔀',n:'Le bon mot'}};
const ORTHO_ITEMS=[
 {t:'mot',q:"L'animal qu'on monte et qui galope",r:"cheval"},
 {t:'mot',q:"La maison des chevaux",r:"écurie"},
 {t:'mot',q:"Les longs poils sur le cou du cheval",r:"crinière"},
 {t:'mot',q:"Le pied dur et corné du cheval",r:"sabot"},
 {t:'mot',q:"Le cheval magique avec une corne",r:"licorne"},
 {t:'mot',q:"La femelle du cheval",r:"jument"},
 {t:'mot',q:"Le bébé du cheval",r:"poulain"},
 {t:'mot',q:"Un grand ensemble d'arbres",r:"forêt"},
 {t:'mot',q:"La saison de la neige et du froid",r:"hiver"},
 {t:'mot',q:"La saison où les feuilles tombent",r:"automne"},
 {t:'mot',q:"L'endroit où l'on apprend à lire",r:"école"},
 {t:'mot',q:"Le roi et la reine y habitent",r:"château"},
 {t:'mot',q:"De l'or et des bijoux cachés",r:"trésor"},
 {t:'mot',q:"Insecte aux belles ailes colorées",r:"papillon"},
 {t:'pluriel',q:"Le pluriel de « cheval »",r:"chevaux"},
 {t:'pluriel',q:"Le pluriel de « journal »",r:"journaux"},
 {t:'pluriel',q:"Le pluriel de « oiseau »",r:"oiseaux"},
 {t:'pluriel',q:"Le pluriel de « jeu »",r:"jeux"},
 {t:'pluriel',q:"Le pluriel de « œil »",r:"yeux"},
 {t:'pluriel',q:"Le pluriel de « genou »",r:"genoux"},
 {t:'pluriel',q:"Le pluriel de « caillou »",r:"cailloux"},
 {t:'pluriel',q:"Le pluriel de « bijou »",r:"bijoux"},
 {t:'pluriel',q:"Le pluriel de « hibou »",r:"hiboux"},
 {t:'pluriel',q:"Le pluriel de « travail »",r:"travaux"},
 {t:'pluriel',q:"Le pluriel de « animal »",r:"animaux"},
 {t:'feminin',q:"Le féminin de « petit »",r:"petite"},
 {t:'feminin',q:"Le féminin de « grand »",r:"grande"},
 {t:'feminin',q:"Le féminin de « beau »",r:"belle"},
 {t:'feminin',q:"Le féminin de « gentil »",r:"gentille"},
 {t:'feminin',q:"Le féminin de « heureux »",r:"heureuse"},
 {t:'feminin',q:"Le féminin de « premier »",r:"première"},
 {t:'feminin',q:"Le féminin de « chien »",r:"chienne"},
 {t:'feminin',q:"Le féminin de « lion »",r:"lionne"},
 {t:'feminin',q:"Le féminin de « acteur »",r:"actrice"},
 {t:'feminin',q:"Le féminin de « roi »",r:"reine"},
 {t:'faute',q:"Corrige la faute : « ortographe »",r:"orthographe"},
 {t:'faute',q:"Corrige la faute : « toujour »",r:"toujours"},
 {t:'faute',q:"Corrige la faute : « beacoup »",r:"beaucoup"},
 {t:'faute',q:"Corrige la faute : « maisson »",r:"maison"},
 {t:'faute',q:"Corrige la faute : « enfent »",r:"enfant"},
 {t:'faute',q:"Corrige la faute : « fammille »",r:"famille"},
 {t:'faute',q:"Corrige la faute : « oizeau »",r:"oiseau"},
 {t:'faute',q:"Corrige la faute : « cartabe »",r:"cartable"},
 {t:'accent',q:"Ajoute les accents : « eleve »",r:"élève"},
 {t:'accent',q:"Ajoute les accents : « fenetre »",r:"fenêtre"},
 {t:'accent',q:"Ajoute les accents : « tete »",r:"tête"},
 {t:'accent',q:"Ajoute les accents : « frere »",r:"frère"},
 {t:'accent',q:"Ajoute les accents : « pere »",r:"père"},
 {t:'accent',q:"Ajoute les accents : « etoile »",r:"étoile"},
 {t:'accent',q:"Ajoute les accents : « riviere »",r:"rivière"},
 {t:'accent',q:"Ajoute les accents : « ete »",r:"été"},
 {t:'accent',q:"Ajoute les accents : « reve »",r:"rêve"},
 {t:'accent',q:"Ajoute les accents : « garcon »",r:"garçon"},
 {t:'homophone',q:"« Il ___ mangé une pomme. » (a / à)",r:"a"},
 {t:'homophone',q:"« Je vais ___ l'école. » (a / à)",r:"à"},
 {t:'homophone',q:"« Papa ___ maman. » (et / est)",r:"et"},
 {t:'homophone',q:"« Il ___ très grand. » (et / est)",r:"est"},
 {t:'homophone',q:"« Les chevaux ___ dans le pré. » (son / sont)",r:"sont"},
 {t:'homophone',q:"« C'est ___ cheval préféré. » (son / sont)",r:"son"},
 {t:'homophone',q:"« ___ est ton livre ? » (ou / où)",r:"où"},
 {t:'homophone',q:"« Tu veux du rouge ___ du bleu ? » (ou / où)",r:"ou"},
 {t:'homophone',q:"« Regarde ___ , un poney ! » (la / là)",r:"là"},
 {t:'homophone',q:"« ___ jument est belle. » (la / là)",r:"la"},
];
const BANK_ART=[
 {q:"Mélange des couleurs : que donne 🔵 bleu + 🟡 jaune ?",schema:"🔵 + 🟡 = ❓",r:"du vert",choix:["du vert","du violet","de l'orange","du gris"]},
 {q:"Mélange des couleurs : que donne 🔴 rouge + 🟡 jaune ?",schema:"🔴 + 🟡 = ❓",r:"de l'orange",choix:["de l'orange","du vert","du bleu","du noir"]},
 {q:"Sur le graphique, quelle couleur domine dans le tableau ?",graph:{titre:"Couleurs utilisées",labels:["Bleu","Rouge","Vert"],valeurs:[7,4,2]},r:"le bleu",choix:["le bleu","le rouge","le vert","aucune"]},
 {q:"Qui a peint la Joconde (Mona Lisa) ?",r:"Léonard de Vinci",choix:["Léonard de Vinci","Picasso","Van Gogh","Monet"],e:"Léonard de Vinci était un génie italien, aussi inventeur."},
 {q:"Dans quel musée de Paris voit-on la Joconde ?",r:"le Louvre",choix:["le Louvre","le musée d'Orsay","le Centre Pompidou","Versailles"]},
 {q:"Qui a peint « La Nuit étoilée » ?",r:"Van Gogh",choix:["Van Gogh","Monet","Rodin","Michel-Ange"],e:"Van Gogh peignait avec de gros coups de pinceau tourbillonnants."},
 {q:"Van Gogh s'est coupé une partie de… ?",r:"l'oreille",choix:["l'oreille","la main","le nez","le pied"]},
 {q:"Picasso a inventé un art fait de formes géométriques : le… ?",r:"cubisme",choix:["cubisme","réalisme","romantisme","pop art"]},
 {q:"Qui a sculpté « Le Penseur » ?",r:"Rodin",choix:["Rodin","Picasso","Van Gogh","Vermeer"]},
 {q:"Qui a sculpté la statue de « David » ?",r:"Michel-Ange",choix:["Michel-Ange","Rodin","Monet","Dali"],e:"Michel-Ange a aussi peint le plafond de la chapelle Sixtine."},
 {q:"Claude Monet est un peintre… ?",r:"impressionniste",choix:["impressionniste","cubiste","surréaliste","préhistorique"]},
 {q:"Monet a peint énormément de… ?",r:"nénuphars",choix:["nénuphars","voitures","dragons","robots"]},
 {q:"Une peinture faite directement sur un mur s'appelle une… ?",r:"fresque",choix:["fresque","aquarelle","sculpture","photo"]},
 {q:"Les 3 couleurs primaires sont rouge, bleu et… ?",r:"jaune",choix:["jaune","vert","orange","violet"]},
 {q:"Rouge + jaune = quelle couleur ?",r:"orange",choix:["orange","vert","violet","marron"]},
 {q:"Bleu + jaune = quelle couleur ?",r:"vert",choix:["vert","orange","violet","gris"]},
 {q:"Rouge + bleu = quelle couleur ?",r:"violet",choix:["violet","vert","orange","rose"]},
 {q:"Un artiste qui fait des statues est un… ?",r:"sculpteur",choix:["sculpteur","peintre","musicien","danseur"]},
 {q:"Qui a peint « Guernica » ?",r:"Picasso",choix:["Picasso","Van Gogh","Léonard de Vinci","Rodin"]},
 {q:"Les hommes préhistoriques peignaient sur les murs des… ?",r:"grottes",choix:["grottes","écoles","châteaux","bateaux"]},
 {q:"Le musée du Louvre a une célèbre pyramide de… ?",r:"verre",choix:["verre","bois","pierre","sable"]},
 {q:"« La Grande Vague » est une œuvre venue du… ?",r:"Japon",choix:["Japon","Brésil","Canada","Égypte"]},
 {q:"Quel peintre est connu pour ses danseuses (ballerines) ?",r:"Degas",choix:["Degas","Picasso","Rodin","Warhol"]},
 {q:"Une œuvre en volume, qu'on peut regarder de tous les côtés ?",r:"une sculpture",choix:["une sculpture","un tableau","une photo","un dessin"]},
 {q:"De quel pays venait Léonard de Vinci ?",r:"l'Italie",choix:["l'Italie","la France","l'Espagne","la Belgique"]},
];
const BANK_NEERLANDAIS=[
 {q:"Kijk : 🐄 = koe. Wat is 🐴 ?",schema:"🐄 koe · 🐴 ❓",r:"paard",choix:["paard","hond","kat","vogel"]},
 {q:"Kijk : ☀️ = zon. Wat is 🌳 ?",schema:"☀️ zon · 🌳 ❓",r:"boom",choix:["boom","huis","water","bloem"]},
 {q:"En néerlandais, « bonjour » se dit… ?",r:"hallo",choix:["hallo","dag","dank je","ja"]},
 {q:"« Dank je wel » veut dire… ?",r:"merci",choix:["merci","bonjour","oui","au revoir"]},
 {q:"En néerlandais, « cheval » se dit… ?",r:"paard",choix:["paard","hond","kat","koe"]},
 {q:"« Appel » veut dire… ?",r:"pomme",choix:["pomme","arbre","eau","maison"]},
 {q:"En néerlandais, « chien » se dit… ?",r:"hond",choix:["hond","kat","paard","vogel"]},
 {q:"« Kat » veut dire… ?",r:"chat",choix:["chat","chien","cheval","vache"]},
 {q:"En néerlandais, « oui » se dit… ?",r:"ja",choix:["ja","nee","dag","melk"]},
 {q:"« Nee » veut dire… ?",r:"non",choix:["non","oui","merci","stop"]},
 {q:"En néerlandais, « eau » se dit… ?",r:"water",choix:["water","melk","zon","boom"]},
 {q:"« Boom » veut dire… ?",r:"arbre",choix:["arbre","fleur","maison","route"]},
 {q:"En néerlandais, « maison » se dit… ?",r:"huis",choix:["huis","school","boom","straat"]},
 {q:"« Melk » veut dire… ?",r:"lait",choix:["lait","eau","jus","miel"]},
 {q:"En néerlandais, « rouge » se dit… ?",r:"rood",choix:["rood","blauw","groen","geel"]},
 {q:"« Blauw » veut dire… ?",r:"bleu",choix:["bleu","rouge","vert","jaune"]},
 {q:"« School » veut dire… ?",r:"école",choix:["école","maison","rue","jardin"]},
 {q:"« Vriend » veut dire… ?",r:"ami",choix:["ami","ennemi","frère","voisin"]},
 {q:"En néerlandais, « au revoir » se dit… ?",r:"dag",choix:["dag","hallo","ja","huis"]},
 {q:"« Koe » veut dire… ?",r:"vache",choix:["vache","chèvre","poule","cochon"]},
 {q:"En néerlandais, « soleil » se dit… ?",r:"zon",choix:["zon","maan","ster","wolk"]},
 {q:"« Bloem » veut dire… ?",r:"fleur",choix:["fleur","arbre","herbe","feuille"]},
 {q:"En néerlandais, « un, deux, trois » se dit… ?",r:"een, twee, drie",choix:["een, twee, drie","ja, nee, dag","rood, blauw, geel","one, two, three"]},
 {q:"« Vogel » veut dire… ?",r:"oiseau",choix:["oiseau","poisson","chat","cheval"]},
];
const BANK_MATHS=[
 {q:"Sur le graphique, quelle classe a vendu le plus de gâteaux ?",graph:{titre:"Gâteaux vendus",labels:["CM1","CM2","6e"],valeurs:[12,20,15]},r:"CM2",choix:["CM2","CM1","6e","aucune"]},
 {q:"Sur le graphique, combien de buts de plus a l'équipe B que l'équipe A ?",graph:{titre:"Buts marqués",labels:["Équipe A","Équipe B"],valeurs:[5,9]},r:"4",choix:["4","3","9","14"]},
 {q:"Sur le graphique, combien de livres lus en tout sur les 3 mois ?",graph:{titre:"Livres lus",labels:["Jan","Fév","Mar"],valeurs:[4,6,5]},r:"15",choix:["15","10","14","11"]},
 {q:"Sur le graphique, combien d'arbres de plus a la forêt B ?",graph:{titre:"Arbres plantés",labels:["Forêt A","Forêt B"],valeurs:[4,7]},r:"3",choix:["3","2","11","7"]},
 {q:"6 + 7 = ?",r:"13",choix:["13","12","14","11"]},
 {q:"Le double de 8 ?",r:"16",choix:["16","18","14","10"]},
 {q:"La moitié de 10 ?",r:"5",choix:["5","4","6","2"]},
 {q:"Combien de pattes ont 3 chevaux ?",r:"12",choix:["12","9","6","15"]},
 {q:"15 − 6 = ?",r:"9",choix:["9","8","11","7"]},
 {q:"5 × 4 = ?",r:"20",choix:["20","9","25","15"]},
 {q:"4 fers par cheval : combien pour 2 chevaux ?",r:"8",choix:["8","6","4","10"]},
 {q:"20 ÷ 4 = ?",r:"5",choix:["5","4","6","2"]},
 {q:"Le triple de 5 ?",r:"15",choix:["15","10","20","8"]},
];
const ROYAUMES_FICTIFS=new Set(['avalon','camelot','scene','futur','outremonde']);
const MOTS_ORTHO=[
 {m:"cheval",i:"L'animal qu'on monte et qui galope"},{m:"poney",i:"Un tout petit cheval"},
 {m:"galop",i:"L'allure la plus rapide du cheval"},{m:"crinière",i:"Les longs poils sur le cou du cheval"},
 {m:"sabot",i:"Le pied dur et corné du cheval"},{m:"écurie",i:"La maison des chevaux"},
 {m:"selle",i:"On s'assoit dessus pour monter à cheval"},{m:"étrier",i:"On y pose le pied pour monter en selle"},
 {m:"licorne",i:"Le cheval magique avec une corne"},{m:"jument",i:"La femelle du cheval"},
 {m:"poulain",i:"Le bébé du cheval"},{m:"forêt",i:"Un grand ensemble d'arbres"},
 {m:"rivière",i:"Un cours d'eau qui coule"},{m:"montagne",i:"Très haut, on y fait du ski"},
 {m:"oiseau",i:"Il vole et construit un nid"},{m:"papillon",i:"Insecte aux belles ailes colorées"},
 {m:"abeille",i:"Elle butine et fabrique le miel"},{m:"feuille",i:"Elle tombe des arbres en automne"},
 {m:"aujourd'hui",i:"Le jour où l'on est en ce moment"},{m:"beaucoup",i:"Une très grande quantité"},
 {m:"toujours",i:"Tout le temps, sans jamais s'arrêter"},{m:"longtemps",i:"Pendant une longue durée"},
 {m:"monsieur",i:"On le dit poliment à un homme"},{m:"femme",i:"Une grande personne, une dame"},
 {m:"automne",i:"La saison où les feuilles tombent"},{m:"hiver",i:"La saison de la neige et du froid"},
 {m:"école",i:"L'endroit où l'on apprend à lire"},{m:"maîtresse",i:"Celle qui fait la classe"},
 {m:"nombre",i:"Une quantité, comme 5 ou 12"},{m:"couleur",i:"Le rouge et le bleu en sont"},
 {m:"heureux",i:"Très content, joyeux"},{m:"famille",i:"Papa, maman et les enfants"},
 {m:"château",i:"Le roi et la reine y habitent"},{m:"princesse",i:"La fille du roi"},
 {m:"dragon",i:"Créature légendaire qui crache du feu"},{m:"trésor",i:"De l'or et des bijoux cachés"},
 {m:"éléphant",i:"Gros animal gris avec une trompe"},{m:"dinosaure",i:"Animal géant disparu il y a longtemps"},
];
const TUTO_CADEAU=['cheval_rose','poney_heureux','gypsy_cob'];
const TUTO_ETAPES=[
 {t:"Bienvenue dans l'écurie ! 🐴 Je suis <b>Pieter-Jan</b>, ton cheval-guide. Je te montre comment jouer — c'est tout simple !",b:"C'est parti ! ›",act:'next'},
 {t:"D'abord, un <b>cadeau de bienvenue</b> : tes toutes premières cartes ! Ouvre-les 👇",b:"Ouvrir mes cartes ✨",act:'cadeau'},
 {t:"⭐ Bravo ! Pour gagner des 💎 <b>diamants</b>, réponds à de petits <b>Défis</b> (onglet 🎯).",b:"Suivant ›",act:'next'},
 {t:"Avec tes 💎, tu peux <b>tirer</b> de nouvelles cartes surprises (onglet ✨ <b>Tirage</b>) !",b:"Suivant ›",act:'next'},
 {t:"Puis direction l'<b>Aventure</b> 🗺️ : choisis ton équipe de chevaux et pars les retrouver, royaume par royaume. En route !",b:"Commencer l'aventure ! 🗺️",act:'fin'}
];
const EMOJIS_PROFIL=['🦄','🐴','🐎','🦓','🐉','🦅','🌟','🌈','🐬','🦋'];
const COULEURS_PROFIL=['#ff9ac0','#7ec2ff','#c99bff','#ffcf6b','#8dff8d','#ff8fb0'];
const AV_INTRO=[
  {img:'cartes/av_etable.jpg',txt:"Il était une fois une grande écurie qui débordait de chevaux légendaires…"},
  {img:'cartes/av_vent.jpg',txt:"Mais une nuit, un vent magique a surgi et les a tous emportés à travers le temps et l'espace !"},
  {img:'cartes/pieter_jan.jpg',txt:"Salut, moi c'est Pieter-Jan, ton cheval-guide ! Ensemble, on va les retrouver, de royaume en royaume. Pour bien démarrer, voici tes 3 premiers chevaux — en route ! 🐴✨"},
];
const MASCOTTES={
belgique:{img:'cartes/pieter_jan.jpg',ecrans:["Je suis Pieter-Jan, cheval de trait belge — un Brabançon, l'un des plus grands travailleurs du monde ! 🐴","Le savais-tu ? Je suis un colosse tout en muscles, mais doux comme un agneau, et je peux tirer des charges énormes. Mon cousin belge « Big Jake » fut l'un des plus grands chevaux jamais mesurés au monde !","Chez moi, en Brabant — d'où vient mon nom ! — mes ancêtres ont labouré les champs et tiré les tonneaux de bière pendant des siècles. La Belgique était si fière de nous qu'elle nous a envoyés partout dans le monde."]},
france:{img:'cartes/francois_camargue.jpg',ecrans:["Bonjour ! Moi c'est François, cheval blanc de Camargue — l'une des plus vieilles races du monde. 🤍","Le savais-tu ? Je nais tout foncé, et le soleil du Sud me blanchit année après année ! Petit mais increvable, je vis à moitié sauvage dans les marais salés.","Chez moi, dans le delta du Rhône, je vis depuis des milliers d'années. Je suis la monture des gardians, les cow-boys qui gardent les taureaux noirs de Camargue !"]},
iles:{img:'cartes/big_ben.jpg',ecrans:["Welcome ! Moi c'est Big Ben, un Shire — le plus grand cheval du monde ! 🐴","Le savais-tu ? Le plus grand cheval jamais mesuré était un Shire nommé Sampson : 2,19 m au garrot et plus d'une tonne et demie ! Et un attelage de Shire peut tirer plus de 25 tonnes.","Chez moi, dans les comtés (« shires ») d'Angleterre, je descends du grand cheval qui portait les chevaliers en armure ! Et devine quoi : mes ancêtres venaient en partie de Flandre, de chez Pieter-Jan — on est cousins ! 😄"]},
rhin:{img:'cartes/inge.jpg',ecrans:["Goedendag ! Moi c'est Inge, une Frisonne — la perle noire des Pays-Bas ! 🖤","Le savais-tu ? Je suis toute noire, avec une longue crinière ondulée, et je sais « danser » ! Ma race a failli disparaître deux fois, mais on nous a sauvées.","Je viens de Frise, aux Pays-Bas. Autrefois je portais les chevaliers, puis je tirais les plus belles calèches. Et devine : j'ai influencé le Shire — je suis la cousine de Big Ben et de Pieter-Jan ! 😊"]}
};
const M_ANE=c=>['ane_tetu','ane_egyptien'].includes(c.id);
const M_CHARBON=c=>c.id==='cheval_charbonnier';
const M_TRAIT=c=>(c.familles||[]).includes('travail');
const M_HALAGE=c=>c.id==='cheval_halage';
const M_ETALON=c=>c.id==='etalon';
const M_TOUS=c=>true;
const M_VITESSE=c=>(c.familles||[]).includes('course')||(c.aff||[]).includes('vitesse');
const M_ENDURANCE=c=>(c.aff||[]).includes('endurance');
const M_BATAILLE=c=>(c.familles||[]).includes('bataille');
const M_RARE=c=>c.rarete!=='commune';
const M_ROBE=c=>!!ROBES[c.id];
const M_BLANC=c=>ROBES[c.id]==='blanc';
const M_PRES=c=>(c.familles||[]).includes('pres');
const M_LEGENDE=c=>(c.familles||[]).includes('legende')||(c.aff||[]).includes('magie');
const M_ELEM=c=>(c.familles||[]).includes('elementaires')||(c.aff||[]).includes('magie');
const M_HISTORIQUES=c=>(c.familles||[]).includes('bataille');
const M_PIE=c=>ROBES[c.id]==='pie';
const M_NOIR=c=>ROBES[c.id]==='noir';
const M_DORE=c=>ROBES[c.id]==='alezan'||ROBES[c.id]==='isabelle';
const M_BEAUTE=c=>(c.aff||[]).includes('beaute');
const M_ARABE=c=>c.royaume==='arabie';
const RAPPEL_Q={annee:"Rappelle-moi : en quelle année la Belgique est-elle née ?",capitale:"Rappelle-moi : quelle est la capitale ?",langues:"Rappelle-moi : combien de langues officielles ?",fleuve:"Rappelle-moi : au bord de quel fleuve se trouve Anvers ?"};
const RAPPEL_CHOIX={annee:['1789','1830','1914','1958'],capitale:['Anvers','Bruxelles','Namur','Liège'],langues:['1','2','3','4'],fleuve:['la Meuse',"l'Escaut",'la Sambre','le Rhin']};
const ETAPE_ANVERS={key:"anvers",pays:"Belgique",drapeau:"🇧🇪",numero:1,region:"Anvers",fond:"aventure/fond_anvers.jpg",province:"province d'Anvers",theme:"⚓ Le grand port",enjeu:"sauver son grand port",reveal:"Pieter-Jan t'attend sur la Grand-Place d'Anvers (la Grote Markt), devant l'immense cathédrale gothique Notre-Dame, tout près du grand port sur l'Escaut.",nom:"Anvers, le grand port",sousEtapes:[
 {titre:"Fonder la Belgique",narr:"Bienvenue en Belgique ! Avant de partir sauver les chevaux à travers le monde, aide-moi à bien connaître notre pays. Puis, direction le port d'Anvers !",activites:[
   {type:'decision',q:"En quelle année la Belgique est-elle née ?",choix:['1789','1830','1914','1958'],r:'1830',fait:['annee','1830']},
   {type:'decision',q:"Quelle est la capitale de la Belgique ?",choix:['Anvers','Bruxelles','Namur','Liège'],r:'Bruxelles',fait:['capitale','Bruxelles']},
   {type:'decision',q:"Combien y a-t-il de langues officielles ?",choix:['1','2','3','4'],r:'3',fait:['langues','3']},
   {type:'decision',q:"Au bord de quel fleuve se trouve Anvers ?",choix:['la Meuse',"l'Escaut",'la Sambre','le Rhin'],r:"l'Escaut",fait:['fleuve',"l'Escaut"]},
   {type:'compo',consigne:"Réunis l'attelage fondateur pour bâtir la jeune nation.",slots:[{label:'1 Âne',m:M_ANE,buy:'ane_tetu'},{label:'1 Charbonnier',m:M_CHARBON,buy:'cheval_charbonnier'},{label:'1 Cheval de trait',m:M_TRAIT,buy:'cheval_laboureur'}]},
 ],crins:38,renom:2,cartes:["cheval_halage","etalon"]},
 {titre:"Charger le port",rappel:true,narr:"Les péniches attendent ! Il faut de gros chevaux pour tirer les charges le long des quais. Compose une équipe puissante.",activites:[
   {type:'compo',consigne:"Une équipe de 3 chevaux de Travail, bien costaude.",slots:[{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_charbonnier'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_laboureur'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_pompier'}],puissanceMin:[85,100]},
   {type:'calcul',q:["Le quai mesure 8 m sur 3 m. Quelle est son aire, en m² ?","Le quai fait 12 m sur 9 m. Quelle est son aire, en m² ?"],choix:[['21','24','11','32'],['96','108','120','21']],r:['24','108']},
 ],crins:30,renom:2},
 {titre:"Gagner le contrat",rappel:true,narr:"Une écurie rivale veut le contrat du port ! Bats-la — mais le contremaître impose une règle pour rester juste.",activites:[
   {type:'compo',consigne:["Compose une équipe dont la Puissance s'approche le plus possible de 85.","Compose une équipe dont la Puissance s'approche le plus possible de 100."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[85,100]},
 ],crins:38,renom:3},
 {titre:"Faire flotter les péniches",rappel:true,narr:"Les péniches doivent flotter, même chargées ! Attelle les bons chevaux et aide les mariniers à comprendre l'eau.",activites:[
   {type:'compo',consigne:"Un cheval de halage et un étalon pour ouvrir la voie.",slots:[{label:'Cheval de halage',m:M_HALAGE,buy:'cheval_halage'},{label:'1 Étalon',m:M_ETALON,buy:'etalon'}]},
   {type:'quiz',q:"Un grand bateau tout en métal, posé sur l'eau : que fait-il ?",choix:['il coule','il flotte','il fond','il s\'envole'],r:'il flotte'},
 ],crins:30,renom:2},
 {titre:"L'histoire d'Anvers",rappel:true,narr:"Assieds-toi une minute : je vais te raconter la légende d'Anvers.",activites:[
   {type:'lecture',texte:"Anvers est une grande ville au bord de l'Escaut. Son port est l'un des plus grands d'Europe : chaque jour, d'immenses bateaux y apportent des marchandises du monde entier. Une vieille légende raconte qu'un géant, Antigoon, coupait la main des marins qui refusaient de payer. Un héros nommé Brabo vainquit le géant et jeta sa main dans le fleuve. On dit que le nom « Antwerpen » viendrait de là : « jeter la main » !",questions:[
     {q:"Au bord de quel fleuve se trouve Anvers ?",choix:['la Meuse',"l'Escaut",'le Rhône'],r:"l'Escaut"},
     {q:"Qui a vaincu le géant Antigoon ?",choix:['Rubens','Brabo','le Roi'],r:'Brabo'},
   ]},
 ],crins:28,renom:2},
 {titre:"Le Contremaître du port",rappel:true,narr:"Le Contremaître d'Anvers, fier et exigeant, te défie une dernière fois avant de te confier le grand port !",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux — le contremaître est coriace !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[95,105]},
 ],crins:50,renom:4},
 {titre:"Anvers te remercie",narr:"Bravo ! Grâce à toi, le port d'Anvers rayonne. Les Anversois t'offrent un cheval en remerciement !",activites:[{type:'bonus'}],crins:60,renom:3},
]};
const M_DILIGENCE=c=>c.id==='cheval_diligence';
const ETAPE_GAND={key:"gand",pays:"Belgique",drapeau:"🇧🇪",numero:2,region:"Gand",fond:"aventure/fond_gand.jpg",province:"Flandre orientale",theme:"🧵 La cité du drap",enjeu:"réussir la grande foire aux draps et défendre sa liberté",reveal:"Pieter-Jan pose devant le Gravensteen, le château fort des comtes de Flandre, au cœur de Gand.",nom:"Gand, la cité des drapiers",finText:"Gand a gardé sa liberté ! La prochaine province t'attend bientôt… 🐴",sousEtapes:[
 {titre:"Arrivée à Gand",narr:"Bienvenue à Gand, la plus fière des cités drapières ! Ici, la laine devient de l'or. Mais d'abord, apprends à connaître la ville.",activites:[
   {type:'decision',q:"Gand est le chef-lieu de quelle province ?",choix:['la Flandre orientale','le Hainaut','le Limbourg','Anvers'],r:'la Flandre orientale',fait:['prov_gand','la Flandre orientale']},
   {type:'decision',q:"Gand est bâtie au confluent de l'Escaut et de… ?",choix:['la Meuse','la Lys','la Sambre','le Rhin'],r:'la Lys',fait:['riviere_gand','la Lys']},
   {type:'decision',q:"Au Moyen Âge, Gand était riche grâce au commerce de… ?",choix:['la laine et le drap','le sel','le charbon','les épices'],r:'la laine et le drap',fait:['richesse_gand','la laine et le drap']},
   {type:'decision',q:"Quel empereur célèbre est né à Gand en 1500 ?",choix:['Charles Quint','Napoléon','Jules César','Louis XIV'],r:'Charles Quint',fait:['charlesquint','Charles Quint']},
   {type:'decision',q:"Le château des comtes de Flandre s'appelle le… ?",choix:['Gravensteen','le Louvre','le Colisée','l\'Atomium'],r:'Gravensteen',fait:['gravensteen','Gravensteen']},
 ],crins:40,renom:2,cartes:["cheval_diligence","cheval_cosaque"]},
 {titre:"Charrier la laine",rappel:true,narr:"Les ballots de laine viennent de débarquer par la Lys ! Il faut de solides chevaux pour les porter jusqu'aux ateliers des tisserands.",activites:[
   {type:'compo',consigne:"Une équipe de 3 chevaux de Travail pour porter la laine.",slots:[{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_charbonnier'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_laboureur'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_pompier'}],puissanceMin:[88,102]},
   {type:'calcul',q:["Chaque cheval porte 5 ballots. Avec 4 chevaux, combien de ballots ?","Un ballot pèse 8 kg. Combien pèsent 7 ballots, en kg ?"],choix:[['20','15','9','25'],['56','48','63','15']],r:['20','56']},
 ],crins:32,renom:2},
 {titre:"Gagner le contrat de la laine",rappel:true,narr:"La ville rivale de Bruges veut la laine anglaise, elle aussi ! La guilde fixe un juste prix : approche-t'en le plus possible pour emporter le contrat.",activites:[
   {type:'compo',consigne:["Compose une équipe dont la Puissance s'approche le plus possible de 85.","Compose une équipe dont la Puissance s'approche le plus possible de 100."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[85,100]},
 ],crins:40,renom:3},
 {titre:"Teindre les draps",rappel:true,narr:"Les draps doivent être teints de belles couleurs pour la foire ! Attelle les bons chevaux, puis aide les teinturiers.",activites:[
   {type:'compo',consigne:"Deux chevaux de Travail et le cheval de diligence pour livrer les teintures.",slots:[{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_charbonnier'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_laboureur'},{label:'Cheval de diligence',m:M_DILIGENCE,buy:'cheval_diligence'}]},
   {type:'quiz',q:"En mélangeant du bleu et du jaune, quelle couleur obtient-on ?",choix:['du vert','du violet','du rouge','du noir'],r:'du vert'},
 ],crins:32,renom:2},
 {titre:"Le trésor de Gand",rappel:true,narr:"Viens, je vais te montrer le trésor caché de Gand.",activites:[
   {type:'lecture',texte:"Dans la grande cathédrale de Gand se cache un trésor : L'Agneau mystique. Cet immense tableau fut peint il y a près de six cents ans par deux frères, Hubert et Jan van Eyck. On dit que c'est l'un des tableaux les plus précieux du monde, et beaucoup ont voulu le voler. En 1934, un voleur découpa même un morceau du tableau… qu'on n'a jamais retrouvé !",questions:[
     {q:"Qui a peint L'Agneau mystique ?",choix:['les frères Van Eyck','Rubens','Picasso'],r:'les frères Van Eyck'},
     {q:"Que s'est-il passé en 1934 ?",choix:['un morceau a été volé','la ville a brûlé','le tableau a coulé'],r:'un morceau a été volé'},
   ]},
 ],crins:30,renom:2},
 {titre:"La cloche du beffroi",rappel:true,narr:"Un bailli cupide veut taxer Gand et lui prendre ses libertés ! La cloche Roland sonne du haut du beffroi pour rassembler la ville. Défends la liberté de Gand !",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux — le bailli est coriace !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[95,108]},
 ],crins:55,renom:4},
 {titre:"La Grande Foire aux draps",narr:"La foire est un triomphe ! Les draps de Gand partent dans toute l'Europe. La ville te remercie du fond du cœur.",activites:[{type:'bonus'}],crins:65,renom:3},
]};
const M_EAU=c=>(c.familles||[]).includes('elementaires');
const ETAPE_BRUGES={key:"bruges",pays:"Belgique",drapeau:"🇧🇪",numero:3,region:"Bruges",fond:"aventure/fond_bruges.jpg",province:"Flandre occidentale",theme:"⛵ Les marchands & la mer",enjeu:"garder sa route vers la mer et rester la Venise du Nord",reveal:"Pieter-Jan te fait découvrir le Beffroi de Bruges et ses canaux : on l'appelle la Venise du Nord !",nom:"Bruges, la Venise du Nord",finText:"Bruges brille de mille feux ! La prochaine province t'attend bientôt… 🐴",sousEtapes:[
 {titre:"Arrivée à Bruges",narr:"Bienvenue à Bruges, la Venise du Nord ! Ici, des marchands du monde entier se croisent sur les canaux. Apprenons d'abord à connaître la ville.",activites:[
   {type:'decision',q:"Bruges est le chef-lieu de quelle province ?",choix:['la Flandre occidentale','la Flandre orientale','le Hainaut','Namur'],r:'la Flandre occidentale',fait:['prov_bruges','la Flandre occidentale']},
   {type:'decision',q:"On surnomme Bruges la « … du Nord » (pour ses canaux) ?",choix:['Venise','Rome','Paris','Athènes'],r:'Venise',fait:['venise','Venise']},
   {type:'decision',q:"Autrefois, Bruges était reliée à la mer par un bras d'eau, le… ?",choix:['Zwin','Rhin','Nil','Danube'],r:'Zwin',fait:['zwin','le Zwin']},
   {type:'decision',q:"Bruges est mondialement connue pour sa… (un tissu très fin fait main) ?",choix:['dentelle','soie','laine','fourrure'],r:'dentelle',fait:['dentelle','la dentelle']},
   {type:'decision',q:"Une invention des marchands est née à Bruges : la… ?",choix:['Bourse','banque','usine','poste'],r:'Bourse',fait:['bourse','la Bourse']},
 ],crins:42,renom:2,cartes:["cheval_facteur","cheval_pompier"]},
 {titre:"Décharger les navires du monde",rappel:true,narr:"Les navires remontent le Zwin, chargés d'épices, de soie et de vin ! Il faut de solides chevaux pour tout porter jusqu'au grand marché.",activites:[
   {type:'compo',consigne:"Trois chevaux de Travail pour décharger les navires.",slots:[{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_charbonnier'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_laboureur'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_pompier'}],puissanceMin:[90,104]},
   {type:'calcul',q:["Un sac d'épices coûte 3 pièces. Combien coûtent 4 sacs ?","Le marchand a 50 pièces et en dépense 18. Combien lui reste-t-il ?"],choix:[['12','7','9','15'],['32','42','38','22']],r:['12','32']},
 ],crins:34,renom:2},
 {titre:"Le juste prix à la Bourse",rappel:true,narr:"À Bruges est née la Bourse, où les marchands fixent les prix ! Comme un bon négociant, vise juste : approche-toi le plus possible du prix demandé.",activites:[
   {type:'compo',consigne:["Compose une équipe dont la Puissance s'approche le plus possible de 85.","Compose une équipe dont la Puissance s'approche le plus possible de 100."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[85,100]},
 ],crins:42,renom:3},
 {titre:"Garder le Zwin ouvert",rappel:true,narr:"Malheur ! Le chenal vers la mer s'ensable peu à peu. Sans lui, plus de navires ! Il faut un cheval d'eau et de solides chevaux pour dégager le passage.",activites:[
   {type:'compo',consigne:"Un cheval d'eau (le halage) et deux chevaux de Travail pour dégager le sable.",slots:[{label:"Cheval d'eau (halage)",m:M_EAU,buy:'cheval_halage'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_charbonnier'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_laboureur'}]},
   {type:'quiz',q:"Quand la mer monte puis redescend, comment appelle-t-on cela ?",choix:['les marées','les vagues','les nuages','les étoiles'],r:'les marées'},
 ],crins:34,renom:2},
 {titre:"Les cygnes de Bruges",rappel:true,narr:"Viens sur le bord du canal, je vais te raconter la légende des cygnes de Bruges.",activites:[
   {type:'lecture',texte:"Sur les canaux de Bruges glissent de magnifiques cygnes blancs. Une vieille histoire raconte qu'autrefois, les habitants se fâchèrent contre un officier de l'empereur nommé Pieter Lanchals — ce qui veut dire « long cou ». Après sa mort, l'empereur ordonna à la ville de garder pour toujours des « longs cous » sur ses eaux : des cygnes ! Depuis, dit-on, les cygnes de Bruges resteront à jamais sur les canaux de la Venise du Nord.",questions:[
     {q:"Quels oiseaux blancs nagent sur les canaux de Bruges ?",choix:['les cygnes','les canards','les mouettes'],r:'les cygnes'},
     {q:"Que veut dire « à jamais » ?",choix:['pour toujours','jamais','parfois'],r:'pour toujours'},
   ]},
 ],crins:30,renom:2},
 {titre:"La mer se retire",rappel:true,narr:"Le Zwin s'ensable, et un port rival monte en puissance… Bruges risque de s'endormir ! Rassemble ta meilleure équipe pour un dernier grand effort et garder la ville prospère !",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux — l'enjeu est immense !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[96,110]},
 ],crins:58,renom:4},
 {titre:"La Venise du Nord",narr:"Bruges brille de mille feux, et ses cygnes te saluent ! La ville te remercie du fond du cœur.",activites:[{type:'bonus'}],crins:68,renom:3},
]};
const M_SAUVAGE=c=>(c.familles||[]).includes('sauvages');
const ETAPE_LIMBOURG={key:"limbourg",pays:"Belgique",drapeau:"🇧🇪",numero:4,region:"Hasselt",fond:"aventure/fond_hasselt.jpg",province:"Limbourg",theme:"🌳 La forêt & les vergers",enjeu:"réussir sa grande récolte de fruits",reveal:"Pieter-Jan t'accueille à Hasselt, devant sa cathédrale Saint-Quentin, au cœur du Limbourg des vergers et des forêts.",nom:"Hasselt, au pays des vergers",finText:"Le Limbourg a réussi sa récolte ! La prochaine province t'attend bientôt… 🐴",sousEtapes:[
 {titre:"Arrivée en Limbourg",narr:"Bienvenue au Limbourg, la province des vergers en fleurs et des grandes forêts ! Apprenons d'abord à connaître ce beau pays.",activites:[
   {type:'decision',q:"Hasselt est le chef-lieu de quelle province ?",choix:['le Limbourg','le Hainaut','Anvers','Namur'],r:'le Limbourg',fait:['prov_limbourg','le Limbourg']},
   {type:'decision',q:"Le Limbourg est réputé pour ses vergers et ses… ?",choix:['fruits','bateaux','montagnes','volcans'],r:'fruits',fait:['fruits','les fruits']},
   {type:'decision',q:"La grande région de landes et de pins du Limbourg s'appelle la… ?",choix:['Campine','Toscane','Sibérie','Amazonie'],r:'Campine',fait:['campine','la Campine']},
   {type:'decision',q:"Autrefois, on creusait le sol du Limbourg pour extraire du… ?",choix:['charbon','or','sel','pétrole'],r:'charbon',fait:['charbon','le charbon']},
   {type:'decision',q:"Au printemps, les vergers du Limbourg se couvrent de… ?",choix:['fleurs','neige','sable','feuilles mortes'],r:'fleurs',fait:['fleurs','des fleurs']},
   {type:'quiz',q:"Ici, en Flandre, on parle néerlandais ! « appel », qu'est-ce que c'est ?",choix:['une pomme','un cheval','une maison','un arbre'],r:'une pomme'},
   {type:'quiz',q:"Et « paard », en néerlandais, c'est… ?",choix:['un cheval','un chien','une vache','un oiseau'],r:'un cheval'},
 ],crins:44,renom:2,cartes:["ardennais","dulmener"]},
 {titre:"La récolte des vergers",rappel:true,narr:"Les pommes et les cerises sont mûres ! Il faut de solides chevaux pour porter les paniers des vergers jusqu'aux marchés.",activites:[
   {type:'compo',consigne:"Trois chevaux de Travail pour porter la récolte (un cheval rare est encore plus costaud !).",slots:[{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_charbonnier'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_laboureur'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_pompier'}],puissanceMin:[92,108]},
   {type:'calcul',q:["Chaque cheval porte 6 paniers de pommes. Avec 4 chevaux, combien de paniers ?","Un verger a 8 rangées de 9 pommiers. Combien de pommiers en tout ?"],choix:[['24','18','20','30'],['72','64','81','56']],r:['24','72']},
 ],crins:36,renom:2},
 {titre:"Le concours de la plus belle récolte",rappel:true,narr:"C'est la fête de la récolte ! Pour gagner le grand concours, il faut une équipe parfaitement équilibrée : vise juste.",activites:[
   {type:'compo',consigne:["Compose une équipe dont la Puissance s'approche le plus possible de 90.","Compose une équipe dont la Puissance s'approche le plus possible de 105."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[90,105]},
 ],crins:44,renom:3},
 {titre:"Traverser la forêt de la Campine",rappel:true,narr:"Pour rejoindre l'autre verger, il faut traverser la grande forêt de pins de la Campine. Prends des chevaux sauvages, habitués aux terres rudes, guidés par un cheval de travail.",activites:[
   {type:'compo',consigne:"Deux chevaux sauvages et un cheval de Travail pour ouvrir la voie dans la forêt.",slots:[{label:'Cheval sauvage',m:M_SAUVAGE,buy:'mustang_indien'},{label:'Cheval sauvage',m:M_SAUVAGE,buy:'dulmener'},{label:'Cheval de Travail',m:M_TRAIT,buy:'cheval_charbonnier'}]},
   {type:'quiz',q:"Les arbres de la Campine qui gardent leurs aiguilles vertes toute l'année sont des… ?",choix:['pins','palmiers','cactus','bananiers'],r:'pins'},
   {type:'quiz',q:"Quel petit animal roux cache des noisettes dans la forêt ?",choix:["l'écureuil",'le dauphin','le pingouin','le chameau'],r:"l'écureuil"},
   {type:'quiz',q:"Grâce aux arbres, l'air de la forêt est plus… ?",choix:['pur','sale','chaud','poussiéreux'],r:'pur'},
 ],crins:36,renom:2},
 {titre:"Les chevaux de la mine",rappel:true,narr:"Assieds-toi, je vais te raconter l'histoire des courageux chevaux du Limbourg.",activites:[
   {type:'lecture',texte:"Il y a longtemps, dans le Limbourg, on creusait de profondes mines pour trouver du charbon, une roche noire qui donne de la chaleur. Pour tirer les lourds wagons sous la terre, on employait de courageux petits chevaux : les chevaux de mine. Ils vivaient dans le noir, loin du soleil. Quand les mines fermèrent, on les ramena enfin à la lumière du jour — et l'on raconte qu'ils galopèrent de joie dans les prés en revoyant le soleil !",questions:[
     {q:"Que cherchait-on dans les mines du Limbourg ?",choix:['du charbon','de l\'or','des fruits'],r:'du charbon'},
     {q:"Comment appelait-on les chevaux qui travaillaient sous la terre ?",choix:['les chevaux de mine','les chevaux de course','les poneys de mer'],r:'les chevaux de mine'},
   ]},
 ],crins:30,renom:2},
 {titre:"L'orage sur les vergers",rappel:true,narr:"Un violent orage menace la récolte ! Rassemble ta meilleure équipe pour sauver les fruits avant que la pluie ne tombe !",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux — chaque minute compte !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[96,112]},
 ],crins:60,renom:4},
 {titre:"La grande fête de la récolte",narr:"La récolte est sauvée ! Tout le Limbourg fête ses fruits, et l'on te remercie du fond du cœur.",activites:[{type:'bonus'}],crins:70,renom:3},
]};
const M_RACE=c=>(c.familles||[]).includes('race');
const M_COUSINS=c=>(c.familles||[]).includes('sauvages');
const ETAPE_LOUVAIN={key:"louvain",pays:"Belgique",drapeau:"🇧🇪",numero:5,region:"Louvain",province:"Brabant flamand",theme:"🎓 Le savoir & la science",enjeu:"réussir la grande expérience de l'université",reveal:"Pieter-Jan t'emmène devant l'Hôtel de Ville de Louvain, un chef-d'œuvre gothique couvert de centaines de statues — de la vraie dentelle de pierre !",fond:"aventure/fond_louvain.jpg",nom:"Louvain, la ville du savoir",finText:"L'université de Louvain est fière de toi ! La province suivante t'attend… 🎓",sousEtapes:[
 {titre:"Arrivée à Louvain",narr:"Bienvenue à Louvain, la ville de la plus vieille université du pays ! Lis d'abord son histoire.",activites:[
   {type:'lecture',texte:"À Louvain se dresse la plus vieille université du pays : depuis presque six cents ans, des étudiants du monde entier viennent y apprendre. Son hôtel de ville est si couvert de statues qu'on dirait de la dentelle taillée dans la pierre ! Le soir, la ville s'anime de milliers d'étudiants venus de partout.",questions:[
     {q:"Depuis combien de temps existe l'université de Louvain ?",choix:['presque 600 ans','10 ans','50 ans'],r:'presque 600 ans'},
     {q:"À quoi ressemble son hôtel de ville ?",choix:['à de la dentelle de pierre','à un bateau','à une grotte'],r:'à de la dentelle de pierre'},
   ]},
   {type:'decision',q:"Louvain est le chef-lieu de quelle province ?",choix:['le Brabant flamand','le Brabant wallon','le Limbourg','Anvers'],r:'le Brabant flamand',fait:['prov_louvain','le Brabant flamand']},
   {type:'decision',q:"Qu'est-ce qui rend Louvain célèbre ?",choix:['sa très vieille université','sa mer','ses volcans','ses mines'],r:'sa très vieille université',fait:['universite','la plus vieille université']},
   {type:'decision',q:"À Louvain, en Flandre, quelle langue parle-t-on ?",choix:['le néerlandais','l\'italien','le russe','le grec'],r:'le néerlandais',fait:['langue_louvain','le néerlandais']},
 ],crins:44,renom:2,cartes:["cheval_chinois","zebre"]},
 {titre:"La grande expérience",rappel:true,narr:"Au laboratoire de l'université, on mène une expérience. Regarde bien le graphique des résultats !",activites:[
   {type:'graphique',bulle:"Au labo ! Lis le graphique 📊",titre:"Bulles produites chaque jour",labels:['Lun','Mar','Mer','Jeu'],valeurs:[3,5,8,12],q:["Quel jour a-t-on produit le plus de bulles ?","On ajoute +2, puis +3, puis +4… Combien vendredi ?"],choix:[['Jeudi','Lundi','Mardi','Mercredi'],['17','13','12','20']],r:['Jeudi','17']},
   {type:'calcul',q:["Lundi 3 bulles, mardi 5 : combien sur ces 2 jours ?","Sur les 4 jours (3+5+8+12), combien de bulles en tout ?"],choix:[['8','7','9','15'],['28','25','30','23']],r:['8','28']},
 ],crins:36,renom:2},
 {titre:"Doser la potion",rappel:true,narr:"Le savant a besoin du bon dosage : ni trop, ni trop peu. Vise juste !",activites:[
   {type:'compo',consigne:["Compose une équipe dont la Puissance s'approche le plus possible de 90.","Compose une équipe dont la Puissance s'approche le plus possible de 105."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[90,105]},
 ],crins:44,renom:3},
 {titre:"L'équipe de savants",rappel:true,narr:"Pour réussir l'expérience, réunis une équipe savante : un professeur, un assistant malin, et un curieux !",activites:[
   {type:'compo',consigne:"Le professeur (cheval de race), l'assistant malin (un cousin : âne, zèbre, poney…) et un cheval curieux.",slots:[{label:'Professeur (race)',m:M_RACE,buy:'cheval_boucle'},{label:'Assistant (cousin)',m:M_COUSINS,buy:'ane_tetu'},{label:'Curieux',m:M_TOUS,buy:'cheval_charbonnier'}]},
   {type:'quiz',q:"Quand la glace fond, elle devient… ?",choix:["de l'eau (liquide)","de la vapeur","de la pierre","du sable"],r:"de l'eau (liquide)"},
   {type:'quiz',q:"Quand l'eau bout très fort, elle se transforme en… ?",choix:['vapeur (gaz)','glace','neige','sable'],r:'vapeur (gaz)'},
 ],crins:36,renom:2},
 {titre:"Le collège des langues",rappel:true,narr:"Il y a 500 ans, à Louvain, on créa un collège pour apprendre plusieurs langues. Essayons !",activites:[
   {type:'lecture',texte:"À Louvain, on aime les langues depuis très longtemps. Il y a cinq cents ans, un savant nommé Érasme aida à créer un collège où l'on apprenait plusieurs langues à la fois. Aujourd'hui encore, les étudiants du monde entier s'y parlent souvent en anglais pour se comprendre.",questions:[
     {q:"En Flandre, on parle… ?",choix:['néerlandais','espagnol','chinois'],r:'néerlandais'},
     {q:"Pour se comprendre entre pays, les étudiants parlent souvent… ?",choix:['anglais','latin','rien'],r:'anglais'},
   ]},
   {type:'quiz',q:"En néerlandais, « boek » veut dire… ?",choix:['un livre','un cheval','une pomme','une maison'],r:'un livre'},
   {type:'quiz',q:"Et en anglais, « book » veut dire… ?",choix:['un livre','une école','un ami','un chien'],r:'un livre'},
 ],crins:32,renom:2},
 {titre:"Le grand examen",rappel:true,narr:"C'est le jour du grand examen de l'université ! Présente ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux — l'examen est exigeant !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[96,110]},
 ],crins:58,renom:4},
 {titre:"Diplômé de Louvain",narr:"Bravo, tu as réussi l'expérience et l'examen ! L'université te remet un diplôme et une carte.",activites:[{type:'bonus'}],crins:70,renom:3},
]};
const ETAPE_WAVRE={key:"wavre",pays:"Belgique",drapeau:"🇧🇪",numero:6,region:"Wavre",province:"Brabant wallon",theme:"⚔️ Waterloo & l'histoire",enjeu:"porter les messages à temps et ramener la paix",reveal:"Pieter-Jan t'accueille dans le vieux centre de Wavre, devant l'église Saint-Jean-Baptiste, tout près du champ de bataille de Waterloo.",fond:"aventure/fond_wavre.jpg",nom:"Wavre, sur les traces de Waterloo",finText:"La paix est revenue sur la plaine ! La province suivante t'attend… 🕊️",sousEtapes:[
 {titre:"Arrivée à Wavre",narr:"Bienvenue à Wavre, tout près du champ de Waterloo. Lis d'abord son histoire.",activites:[
   {type:'lecture',texte:"Non loin de Wavre, en 1815, se joua l'une des plus célèbres batailles de l'histoire : l'empereur Napoléon y perdit son tout dernier combat, à Waterloo. Aujourd'hui, une immense colline surmontée d'un Lion de fer veille sur la grande plaine, et rappelle qu'après les batailles vient toujours le temps de la paix.",questions:[
     {q:"Qui a perdu son dernier combat à Waterloo ?",choix:['Napoléon','Jules César','le roi Arthur'],r:'Napoléon'},
     {q:"Que voit-on aujourd'hui sur la colline ?",choix:['un Lion de fer','un phare','un moulin'],r:'un Lion de fer'},
   ]},
   {type:'decision',q:"Wavre est le chef-lieu de quelle province ?",choix:['le Brabant wallon','le Brabant flamand','le Hainaut','Namur'],r:'le Brabant wallon',fait:['prov_wavre','le Brabant wallon']},
   {type:'decision',q:"En quelle année eut lieu la bataille de Waterloo ?",choix:['1815','1830','1914','1500'],r:'1815',fait:['waterloo','1815']},
   {type:'decision',q:"Qu'y a-t-il au sommet de la colline de Waterloo ?",choix:['un Lion','un dragon','une couronne','un phare'],r:'un Lion',fait:['butte_lion','un Lion']},
 ],crins:46,renom:2,cartes:["cheval_cosaque","cheval_cowboy"]},
 {titre:"La ligne du temps",rappel:true,narr:"Pour bien comprendre l'histoire, remets ces époques dans l'ordre, de la plus ancienne à la plus récente !",activites:[
   {type:'ordre',consigne:"Range de la plus ANCIENNE à la plus récente :",elements:["Les chevaliers du Moyen Âge","La bataille de Waterloo","Les premières automobiles","Aujourd'hui"]},
 ],crins:38,renom:2},
 {titre:"Compter les troupes",rappel:true,narr:"L'état-major a besoin de bons calculs ! Aide-le avec les grands nombres.",activites:[
   {type:'calcul',q:["Quel est le plus grand nombre : 300, 3000 ou 30 ?","4 500 soldats + 2 300 renforts = combien ?"],choix:[['3000','300','30','33'],['6800','6500','7800','2200']],r:['3000','6800']},
   {type:'compo',consigne:["Approche-toi le plus possible de 90 de Puissance.","Approche-toi le plus possible de 105 de Puissance."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[90,105]},
 ],crins:46,renom:3},
 {titre:"Les messagers de l'Empereur",rappel:true,narr:"Il faut porter les ordres à toute allure d'un bout à l'autre du champ ! Réunis les chevaux les plus RAPIDES.",activites:[
   {type:'compo',consigne:"Trois chevaux rapides (famille course, ou vifs) pour porter les messages.",slots:[{label:'Cheval rapide',m:M_VITESSE,buy:['cheval_cosaque','cheval_cowboy','cheval_obstacle']},{label:'Cheval rapide',m:M_VITESSE,buy:['cheval_cosaque','cheval_desert','cheval_punk']},{label:'Cheval rapide',m:M_VITESSE,buy:['cheval_cosaque','cheval_obstacle','cheval_cyberpunk']}]},
 ],crins:36,renom:2},
 {titre:"Le grand champ de Waterloo",rappel:true,narr:"Écoute l'histoire de la grande bataille, et de la paix qui suivit.",activites:[
   {type:'lecture',texte:"Ce jour-là, des milliers de soldats et de chevaux se firent face dans la plaine. La bataille fut terrible et dura jusqu'au soir. Napoléon fut vaincu, et l'Europe connut ensuite de longues années de paix. On dit que le courage n'est pas de se battre, mais de savoir arrêter la guerre.",questions:[
     {q:"Combien de temps dura la bataille ?",choix:["jusqu'au soir","cinq minutes","toute l'année"],r:"jusqu'au soir"},
     {q:"Qu'est-ce qui suivit la bataille en Europe ?",choix:['de longues années de paix','une autre guerre','rien'],r:'de longues années de paix'},
   ]},
 ],crins:30,renom:2},
 {titre:"La charge finale",rappel:true,narr:"Un dernier grand effort pour ramener tout le monde sain et sauf ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[98,110]},
 ],crins:58,renom:4},
 {titre:"Le temps de la paix",narr:"Grâce à toi, tout le monde est rentré. Wavre te remercie et t'offre une carte !",activites:[{type:'bonus'}],crins:70,renom:3},
]};
const ETAPE_MONS={key:"mons",pays:"Belgique",drapeau:"🇧🇪",numero:7,region:"Mons",province:"Hainaut",theme:"🎭 Le folklore & les géants",enjeu:"réussir le grand cortège du Doudou",reveal:"Pieter-Jan t'attend sur la Grand-Place de Mons, devant le beffroi et l'hôtel de ville : bienvenue au pays du Doudou et des géants !",fond:"aventure/fond_mons.jpg",nom:"Mons, la ville des géants",finText:"Le Doudou fut un triomphe ! La province suivante t'attend… 🎭",sousEtapes:[
 {titre:"Arrivée à Mons",narr:"Bienvenue à Mons, la ville du Doudou ! Lis d'abord son histoire.",activites:[
   {type:'lecture',texte:"Une fois par an, à Mons, saint Georges combat un dragon sur la Grand-Place : c'est la fête du Doudou ! On dit qu'arracher un poil à la queue du dragon porte bonheur. Et tout près, à Binche, les célèbres Gilles au masque de cire lancent des oranges pendant le carnaval.",questions:[
     {q:"Que combat saint Georges à Mons ?",choix:['un dragon','un lion','un géant'],r:'un dragon'},
     {q:"Que lancent les Gilles de Binche au carnaval ?",choix:['des oranges','des cailloux','des ballons'],r:'des oranges'},
   ]},
   {type:'decision',q:"Mons est le chef-lieu de quelle province ?",choix:['le Hainaut','le Brabant wallon','Namur','Liège'],r:'le Hainaut',fait:['prov_mons','le Hainaut']},
   {type:'decision',q:"Comment s'appelle la grande fête de Mons ?",choix:['le Doudou','le Carnaval de Rio','la Foire du Trône'],r:'le Doudou',fait:['doudou','le Doudou']},
   {type:'decision',q:"À Binche, les Gilles portent un masque de… ?",choix:['cire','fer','papier','verre'],r:'cire',fait:['gilles','les Gilles']},
 ],crins:46,renom:2,cartes:["appaloosa","haflinger"]},
 {titre:"Le cortège du Doudou",rappel:true,narr:"Compose le cortège le plus COLORÉ : chaque cheval doit avoir une robe différente !",activites:[
   {type:'compo',robesDistinctes:true,consigne:"Trois chevaux, chacun d'une robe (couleur) DIFFÉRENTE : noir, blanc, alezan, isabelle, pie, tachetée…",slots:[{label:'Robe 1',m:M_ROBE,buy:['cheval_albinos','haflinger','appaloosa','gypsy_cob','frison']},{label:'Robe 2',m:M_ROBE,buy:['cheval_albinos','haflinger','appaloosa','gypsy_cob','fjord']},{label:'Robe 3',m:M_ROBE,buy:['cheval_albinos','haflinger','appaloosa','camargue','murgese']}]},
 ],crins:44,renom:3},
 {titre:"Les mots de la fête",rappel:true,narr:"Pour écrire les pancartes du cortège, il faut bien orthographier ! Écris les mots.",activites:[
   {type:'ortho',indice:"Écris le mot : la créature que combat saint Georges 🐉",mot:"dragon"},
   {type:'ortho',indice:"Écris le mot : une personne immense 🦣",mot:"géant"},
   {type:'ortho',indice:"Écris le mot : la grande fête costumée du printemps 🎭",mot:"carnaval"},
 ],crins:38,renom:2},
 {titre:"Le juste équilibre du cortège",rappel:true,narr:"Un beau cortège, ni trop lourd ni trop léger : vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 88 de Puissance.","Approche-toi le plus possible de 104 de Puissance."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[88,104]},
 ],crins:44,renom:3},
 {titre:"La légende de saint Georges",rappel:true,narr:"Écoute la légende du chevalier et du dragon.",activites:[
   {type:'lecture',texte:"Il y a très longtemps, un terrible dragon effrayait toute la ville. Un courageux chevalier, saint Georges, monta sur son fidèle cheval et affronta le monstre. Après un long combat, il délivra la ville. Depuis, chaque année, Mons rejoue ce combat pour ne jamais oublier le courage.",questions:[
     {q:"Qui affronte le dragon ?",choix:['saint Georges','Napoléon','Tchantchès'],r:'saint Georges'},
     {q:"Pourquoi Mons rejoue-t-elle ce combat ?",choix:['pour ne jamais oublier le courage','pour faire peur','pour dormir'],r:'pour ne jamais oublier le courage'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le grand Lumeçon",rappel:true,narr:"C'est le combat final sur la Grand-Place ! Ta meilleure équipe pour aider saint Georges.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[98,110]},
 ],crins:58,renom:4},
 {titre:"Vive le Doudou !",narr:"Le dragon est vaincu, la ville est en fête ! Mons te remercie et t'offre une carte.",activites:[{type:'bonus'}],crins:70,renom:3},
]};
const ETAPE_NAMUR={key:"namur",pays:"Belgique",drapeau:"🇧🇪",numero:8,region:"Namur",province:"province de Namur",theme:"💧 Les rivières & l'eau",enjeu:"remonter la Meuse et protéger la ville des crues",reveal:"Pieter-Jan t'attend au bord de l'eau : là-haut se dresse la Citadelle de Namur, immense forteresse sur son rocher, au confluent de la Sambre et de la Meuse.",fond:"aventure/fond_namur.jpg",nom:"Namur, où les rivières se rencontrent",finText:"La Meuse est apaisée ! La province suivante t'attend… 💧",sousEtapes:[
 {titre:"Arrivée à Namur",narr:"Bienvenue à Namur, capitale de la Wallonie, là où deux rivières se rencontrent. Lis son histoire.",activites:[
   {type:'lecture',texte:"À Namur, deux rivières se rejoignent au pied d'une puissante forteresse : la Sambre et la Meuse. Tout en haut du grand rocher veille la Citadelle. Et à Namur, on a une drôle de tradition : on se bat pour rire… sur des échasses ! Deux équipes montées sur de grands bâtons de bois essaient de se faire tomber.",questions:[
     {q:"Quelles deux rivières se rencontrent à Namur ?",choix:['la Sambre et la Meuse','le Rhin et le Nil','la Lys et l\'Escaut'],r:'la Sambre et la Meuse'},
     {q:"Sur quoi se bat-on, pour rire, à Namur ?",choix:['des échasses','des chevaux','des bateaux'],r:'des échasses'},
   ]},
   {type:'decision',q:"Namur est le chef-lieu de quelle province ?",choix:['la province de Namur','le Hainaut','Liège','le Brabant wallon'],r:'la province de Namur',fait:['prov_namur','la province de Namur']},
   {type:'decision',q:"Namur est aussi la capitale de la… ?",choix:['Wallonie','Flandre','France','Europe'],r:'Wallonie',fait:['capitale_wallonie','la Wallonie']},
   {type:'decision',q:"Quelle forteresse veille sur Namur ?",choix:['la Citadelle','l\'Atomium','le Gravensteen','le Colisée'],r:'la Citadelle',fait:['citadelle','la Citadelle']},
 ],crins:46,renom:2,cartes:["cheval_rivieres","poney_shetland"]},
 {titre:"Le cycle de l'eau",rappel:true,narr:"D'où vient la pluie qui remplit la Meuse ? Remets le cycle de l'eau dans le bon ordre !",activites:[
   {type:'ordre',bulle:"Le cycle de l'eau 💧",consigne:"Remets le cycle de l'eau dans l'ordre :",elements:["☀️ le soleil chauffe l'eau","💧 l'eau s'évapore","☁️ le nuage se forme","🌧️ la pluie tombe","🏞️ la rivière coule vers la mer"]},
 ],crins:38,renom:2},
 {titre:"Le juste débit",rappel:true,narr:"L'écluse doit laisser passer juste ce qu'il faut d'eau. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 90 de Puissance.","Approche-toi le plus possible de 106 de Puissance."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[90,106]},
 ],crins:46,renom:3},
 {titre:"Les mariniers de la Meuse",rappel:true,narr:"Il faut remonter la Meuse à contre-courant ! Attelle des chevaux d'EAU, habitués aux rivières.",activites:[
   {type:'compo',consigne:"Deux chevaux d'eau (halage, rivières…) et un cheval au choix pour tirer la péniche.",slots:[{label:"Cheval d'eau",m:M_EAU,buy:['cheval_halage','cheval_rivieres','cheval_corail']},{label:"Cheval d'eau",m:M_EAU,buy:['cheval_halage','cheval_rivieres','cheval_glace']},{label:'Cheval',m:M_TOUS,buy:['cheval_charbonnier','cheval_laboureur']}]},
   {type:'graphique',bulle:"Lis le graphique des pluies 📊",titre:"Pluie par saison (mm)",labels:['Prin.','Été','Aut.','Hiver'],valeurs:[7,4,9,6],q:["Quelle saison est la plus pluvieuse ?","Combien de mm de plus en automne qu'en été ?"],choix:[['Automne','Été','Hiver','Printemps'],['5','4','9','13']],r:['Automne','5']},
 ],crins:38,renom:2},
 {titre:"La Citadelle de Namur",rappel:true,narr:"Grimpe avec moi jusqu'à la Citadelle, je te raconte son histoire.",activites:[
   {type:'lecture',texte:"La Citadelle de Namur est l'une des plus grandes forteresses d'Europe. Bâtie sur un rocher, elle protégeait la ville depuis le sommet, à l'endroit exact où la Sambre se jette dans la Meuse. De là-haut, les soldats voyaient venir tout danger de très loin.",questions:[
     {q:"Où est bâtie la Citadelle ?",choix:['sur un rocher','sous l\'eau','dans la forêt'],r:'sur un rocher'},
     {q:"À quoi servait-elle ?",choix:['protéger la ville','faire du pain','jouer'],r:'protéger la ville'},
   ]},
 ],crins:30,renom:2},
 {titre:"La crue de la Meuse",rappel:true,narr:"La Meuse monte dangereusement ! Rassemble ta meilleure équipe pour protéger Namur.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[100,112]},
 ],crins:58,renom:4},
 {titre:"Namur te remercie",narr:"La ville est sauvée des eaux ! Namur t'offre une carte en remerciement.",activites:[{type:'bonus'}],crins:70,renom:3},
]};
const ETAPE_LIEGE={key:"liege",pays:"Belgique",drapeau:"🇧🇪",numero:9,region:"Liège",province:"province de Liège",theme:"⚡ L'industrie & l'énergie",enjeu:"rallumer la Cité Ardente et garder les forges en vie",reveal:"Pieter-Jan t'accueille au pied de la Montagne de Bueren, le célèbre escalier de 374 marches qui grimpe vers la vieille ville de Liège !",fond:"aventure/fond_liege.jpg",nom:"Liège, la Cité Ardente",finText:"La Cité Ardente brille de nouveau ! La toute dernière province t'attend… ⚡",sousEtapes:[
 {titre:"Arrivée à Liège",narr:"Bienvenue à Liège, la fière Cité Ardente ! Lis d'abord sa grande histoire.",activites:[
   {type:'lecture',texte:"Voici Liège, la « Cité Ardente » ! Pendant près de 800 ans, Liège ne fut ni française ni belge : c'était une principauté indépendante, gouvernée par des princes-évêques. Brûlée et rebâtie mille fois, elle veille au bord de la Meuse. Ici est né Georges Simenon, le papa du commissaire Maigret, et vit toujours Tchantchès, la marionnette la plus têtue de Belgique. Pour grimper à la vieille ville, il faut escalader un escalier de 374 marches !",questions:[
     {q:"Pendant combien de temps Liège fut-elle indépendante ?",choix:['près de 800 ans','10 ans','50 ans'],r:'près de 800 ans'},
     {q:"Qui gouvernait la principauté de Liège ?",choix:['des princes-évêques','un roi','un empereur'],r:'des princes-évêques'},
     {q:"Combien de marches à la Montagne de Bueren ?",choix:['374','50','1000'],r:'374'},
   ]},
   {type:'decision',q:"Liège est le chef-lieu de quelle province ?",choix:['la province de Liège','Namur','le Luxembourg','le Hainaut'],r:'la province de Liège',fait:['prov_liege','la province de Liège']},
   {type:'decision',q:"Au bord de quel fleuve se trouve Liège ?",choix:['la Meuse','l\'Escaut','le Rhin','la Lys'],r:'la Meuse',fait:['fleuve_liege','la Meuse']},
   {type:'decision',q:"Comment surnomme-t-on Liège ?",choix:['la Cité Ardente','la Venise du Nord','la Ville Lumière'],r:'la Cité Ardente',fait:['cite_ardente','la Cité Ardente']},
 ],crins:60,renom:3,cartes:["cheval_romain","roi_montagnes"]},
 {titre:"La Montagne de Bueren",rappel:true,narr:"Grimpons les 374 marches de la Montagne de Bueren ! À chaque bon calcul, on monte.",activites:[
   {type:'calcul',q:["Tu montes 9 marches à la fois. En 4 fois, combien de marches ?","Tu es à la marche 250 sur 374. Combien en reste-t-il ?"],choix:[['36','13','45','32'],['124','114','134','624']],r:['36','124']},
 ],crins:44,renom:3},
 {titre:"Doser l'acier",rappel:true,narr:"Le maître de forge veut le juste mélange, ni trop ni trop peu. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 92 de Puissance.","Approche-toi le plus possible de 108 de Puissance."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[92,108]},
 ],crins:48,renom:3},
 {titre:"À la forge des hauts-fourneaux",rappel:true,narr:"Les forges de Liège ont lancé l'industrie ! Il faut les chevaux les plus ENDURANTS pour tenir le rythme.",activites:[
   {type:'compo',consigne:"Trois chevaux endurants pour tenir le rythme des hauts-fourneaux.",slots:[{label:'Cheval endurant',m:M_ENDURANCE,buy:['cheval_charbonnier','mustang_indien','cheval_romain']},{label:'Cheval endurant',m:M_ENDURANCE,buy:['roi_montagnes','cheval_laboureur','cheval_desert']},{label:'Cheval endurant',m:M_ENDURANCE,buy:['mustang_indien','ane_egyptien','cheval_romain']}]},
   {type:'quiz',q:"Qu'est-ce qui faisait tourner les grandes roues des usines au bord de la Meuse ?",choix:["l'eau",'le vent','la lune','le sable'],r:"l'eau"},
 ],crins:48,renom:3},
 {titre:"Rallumer la Cité Ardente",rappel:true,narr:"Une panne a plongé la ville dans le noir ! Répare le circuit électrique pour rallumer Liège.",activites:[
   {type:'circuit',bulle:"Répare le circuit ⚡",schema:"🔋 pile — 🔌 fil — ✂️ coupé — 💡 ampoule",q:"Le circuit est coupé ! Que faut-il pour que le courant passe et allume l'ampoule ?",choix:['refermer le circuit','couper le fil','enlever la pile','éteindre tout'],r:'refermer le circuit'},
   {type:'quiz',q:"Dans une lampe de poche, qui donne l'électricité ?",choix:['la pile','le verre','le plastique','la lumière'],r:'la pile'},
 ],crins:52,renom:4},
 {titre:"Tchantchès & les feux de la ville",rappel:true,narr:"Écoute l'histoire de Tchantchès, puis aide à garder les forges allumées cette nuit.",activites:[
   {type:'lecture',texte:"Tchantchès est la marionnette la plus célèbre de Liège. On raconte qu'il est né entre deux pavés du quartier d'Outremeuse ! Têtu comme une mule mais le cœur immense, il défend toujours les plus faibles. Chaque année, en août, tout Liège fait la fête en son honneur.",questions:[
     {q:"Où serait né Tchantchès ?",choix:['entre deux pavés','dans un château','sur un bateau'],r:'entre deux pavés'},
     {q:"Comment est le cœur de Tchantchès ?",choix:['immense (généreux)','tout petit','en pierre'],r:'immense (généreux)'},
   ]},
   {type:'compo',consigne:"Ta meilleure équipe pour garder les feux allumés toute la nuit !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[100,113]},
 ],crins:66,renom:5},
 {titre:"Liège brille de mille feux",narr:"Bravo, championne ! La Cité Ardente s'illumine et fait la fête. Elle t'offre une belle carte… et une gaufre de Liège pour la route ! 🧇",activites:[{type:'bonus',rarete:['rare','epique']}],crins:130,renom:7},
]};
const ETAPE_ARLON={key:"arlon",pays:"Belgique",drapeau:"🇧🇪",numero:10,region:"Arlon",province:"le Luxembourg",theme:"🏰 Les Ardennes & les chevaliers",enjeu:"traverser les forêts sauvages et défendre le château fort",reveal:"Pieter-Jan te guide dans la vieille ville d'Arlon, jusqu'à l'église Saint-Donat perchée sur sa colline : l'une des plus anciennes cités du pays, au cœur des Ardennes.",fond:"aventure/fond_arlon.jpg",nom:"Arlon, au cœur des Ardennes",finText:"Le château est sauvé ! Il ne reste plus que la capitale… 🏰",sousEtapes:[
 {titre:"Arrivée à Arlon",narr:"Bienvenue à Arlon, l'une des plus vieilles villes du pays, au cœur des Ardennes ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Arlon est l'une des plus anciennes villes de Belgique : elle existait déjà du temps des Romains ! Tout autour s'étendent les grandes forêts des Ardennes, pleines de cerfs et de sangliers. Jadis, du haut d'un château fort de Bouillon, partit un célèbre chevalier nommé Godefroid, pour un très long voyage à travers le monde.",questions:[
     {q:"De quelle époque date la ville d'Arlon ?",choix:['du temps des Romains','de la semaine dernière','du futur'],r:'du temps des Romains'},
     {q:"Quels animaux vivent dans les forêts des Ardennes ?",choix:['des cerfs et des sangliers','des dauphins','des chameaux'],r:'des cerfs et des sangliers'},
   ]},
   {type:'decision',q:"Arlon est le chef-lieu de quelle province ?",choix:['le Luxembourg','Namur','Liège','le Hainaut'],r:'le Luxembourg',fait:['prov_arlon','le Luxembourg']},
   {type:'decision',q:"Comment s'appellent les grandes forêts autour d'Arlon ?",choix:['les Ardennes','la Campine','les Alpes','le Sahara'],r:'les Ardennes',fait:['ardennes','les Ardennes']},
   {type:'decision',q:"De quel château partit le chevalier Godefroid ?",choix:['Bouillon','Gravensteen','Atomium','Versailles'],r:'Bouillon',fait:['bouillon','le château de Bouillon']},
 ],crins:48,renom:2,cartes:["cheval_tournoi","cheval_cosaque"]},
 {titre:"La chaîne alimentaire",rappel:true,narr:"Dans la forêt, chacun mange et est mangé. Remets la chaîne alimentaire dans le bon ordre !",activites:[
   {type:'ordre',bulle:"Qui mange qui ? 🌿🦌🐺",consigne:"Range la chaîne alimentaire de la forêt :",elements:["🌿 l'herbe pousse","🦌 le cerf mange l'herbe","🐺 le loup mange le cerf"]},
 ],crins:38,renom:2},
 {titre:"L'expédition équilibrée",rappel:true,narr:"Pour traverser les Ardennes, il faut une expédition ni trop lourde ni trop légère. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 92 de Puissance.","Approche-toi le plus possible de 108 de Puissance."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[92,108]},
 ],crins:46,renom:3},
 {titre:"Les chevaliers du château",rappel:true,narr:"Le château fort a besoin de ses chevaliers ! Réunis des chevaux de BATAILLE, prêts pour le tournoi.",activites:[
   {type:'compo',consigne:"Trois chevaux de bataille (les montures des chevaliers).",slots:[{label:'Cheval de bataille',m:M_BATAILLE,buy:['cheval_cosaque','cheval_romain','cheval_tournoi']},{label:'Cheval de bataille',m:M_BATAILLE,buy:['cheval_cosaque','cheval_police','cheval_romain']},{label:'Cheval de bataille',m:M_BATAILLE,buy:['cheval_cosaque','cheval_tournoi','cheval_police']}]},
   {type:'quiz',q:"Au Moyen Âge, pour se protéger, le chevalier portait une… ?",choix:['armure','casquette','écharpe','couronne'],r:'armure'},
 ],crins:38,renom:2},
 {titre:"Godefroid de Bouillon",rappel:true,narr:"Écoute l'histoire du plus célèbre chevalier des Ardennes.",activites:[
   {type:'lecture',texte:"Il y a près de mille ans, du haut de son château de Bouillon, le chevalier Godefroid partit pour un très long voyage à travers le monde. Courageux et juste, il devint l'un des chevaliers les plus célèbres de toute l'histoire. Aujourd'hui, son château veille toujours sur la rivière Semois, au milieu des grandes forêts.",questions:[
     {q:"D'où partit Godefroid ?",choix:['de son château de Bouillon','de la mer','de Paris'],r:'de son château de Bouillon'},
     {q:"Sur quoi veille encore son château ?",choix:['la Semois','la mer','le désert'],r:'la Semois'},
   ]},
 ],crins:30,renom:2},
 {titre:"Défendre le château",rappel:true,narr:"Des pillards approchent du château ! Rassemble ta meilleure équipe pour le défendre.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[102,114]},
 ],crins:60,renom:4},
 {titre:"Le château est sauvé",narr:"Les Ardennes sont en paix, et le château brille au soleil ! Arlon t'offre une carte.",activites:[{type:'bonus'}],crins:72,renom:3},
]};
const ETAPE_BRUXELLES={key:"bruxelles",pays:"Belgique",drapeau:"🇧🇪",numero:11,boss:true,region:"Bruxelles",province:"capitale de la Belgique",theme:"👑 La capitale & les symboles",enjeu:"réunir toute la Belgique et devenir la championne du royaume",fond:"aventure/fond_bruxelles.jpg",nom:"Bruxelles, cœur de la Belgique",finText:"Toute la Belgique est réunie ! Le monde s'ouvre à toi… 🌍",sousEtapes:[
 {titre:"Arrivée à Bruxelles",narr:"Te voici à Bruxelles, la capitale ! Le plus grand défi t'attend. D'abord, découvre la ville.",activites:[
   {type:'lecture',texte:"Voici Bruxelles, la capitale de la Belgique ! Sa Grand-Place est l'une des plus belles du monde. Un petit garçon de bronze, le Manneken-Pis, a plus de mille costumes, et l'Atomium, un cristal de fer géant, veille sur la ville. C'est aussi la patrie de Tintin et des Schtroumpfs, et la capitale de l'Europe, où l'on entend toutes les langues.",questions:[
     {q:"Quel géant de fer veille sur Bruxelles ?",choix:["l'Atomium",'la tour Eiffel','le Colisée'],r:"l'Atomium"},
     {q:"Quels héros de bande dessinée sont nés à Bruxelles ?",choix:['Tintin et les Schtroumpfs','Astérix','Harry Potter'],r:'Tintin et les Schtroumpfs'},
   ]},
   {type:'decision',q:"Bruxelles est la… de la Belgique ?",choix:['capitale','plus petite ville','montagne'],r:'capitale',fait:['bruxelles_cap','la capitale']},
   {type:'decision',q:"Bruxelles est aussi la capitale de… ?",choix:["l'Europe","l'Asie","l'Afrique"],r:"l'Europe",fait:['bxl_europe',"l'Europe"]},
   {type:'quiz',q:"Ici on entend de l'anglais ! « hello » veut dire… ?",choix:['bonjour','au revoir','merci','non'],r:'bonjour'},
   {type:'quiz',q:"Et « thank you » veut dire… ?",choix:['merci','bonjour','pardon','oui'],r:'merci'},
 ],crins:60,renom:3,cartes:["cheval_carrosse","poulain"]},
 {titre:"La grande carte de Belgique",rappel:true,narr:"Pour devenir championne, tu dois connaître toute la Belgique ! Place chaque chef-lieu dans sa province.",activites:[
   {type:'carte',pairs:[["Anvers","Anvers"],["Gand","Flandre orientale"],["Bruges","Flandre occidentale"],["Hasselt","Limbourg"],["Louvain","Brabant flamand"],["Wavre","Brabant wallon"],["Mons","Hainaut"],["Namur","Namur"],["Liège","Liège"],["Arlon","Luxembourg"]]},
 ],crins:80,renom:5},
 {titre:"Le grand rappel du voyage",rappel:true,narr:"Repense à tout ton voyage à travers la Belgique… un dernier tour de mémoire !",activites:[
   {type:'quiz',q:"Dans quelle ville la Bourse est-elle née ?",choix:['Bruges','Anvers','Liège','Mons'],r:'Bruges'},
   {type:'quiz',q:"Quelle ville est la « Cité Ardente » ?",choix:['Liège','Gand','Namur','Arlon'],r:'Liège'},
   {type:'quiz',q:"Où combat-on un dragon chaque année (le Doudou) ?",choix:['Mons','Louvain','Wavre','Bruges'],r:'Mons'},
 ],crins:60,renom:4},
 {titre:"Le défi de gala",rappel:true,narr:"Pour le grand bal du royaume, présente une équipe de tes plus BELLES cartes rares !",activites:[
   {type:'compo',consigne:"Trois chevaux rares (pas de commun !) pour éblouir la cour.",slots:[{label:'Cheval rare',m:M_RARE,buy:['cheval_romain','cheval_tournoi','appaloosa']},{label:'Cheval rare',m:M_RARE,buy:['cheval_obstacle','cheval_carrosse','cheval_police']},{label:'Cheval rare',m:M_RARE,buy:['appaloosa','cheval_romain','cheval_desert']}]},
 ],crins:80,renom:5},
 {titre:"Le grand final",rappel:true,narr:"Voici l'épreuve suprême, championne ! Présente la plus puissante équipe de tout ton voyage.",activites:[
   {type:'compo',consigne:"Ton équipe la plus puissante — c'est la finale !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[108,124]},
 ],crins:120,renom:8},
 {titre:"Championne de Belgique !",narr:"BRAVO ! Tu as réuni toute la Belgique et gagné le cœur du royaume ! Reçois l'emblème national, une carte légendaire… et le monde entier s'ouvre désormais à toi ! 🌍👑",activites:[{type:'bonus',carteId:'pieter_jan'}],crins:250,renom:15},
]};
const ETAPES_BE={anvers:ETAPE_ANVERS,gand:ETAPE_GAND,bruges:ETAPE_BRUGES,limbourg:ETAPE_LIMBOURG,louvain:ETAPE_LOUVAIN,wavre:ETAPE_WAVRE,mons:ETAPE_MONS,namur:ETAPE_NAMUR,liege:ETAPE_LIEGE,arlon:ETAPE_ARLON,bruxelles:ETAPE_BRUXELLES};
const ETAPE_LILLE={key:"lille",pays:"France",drapeau:"🇫🇷",numero:1,region:"Lille",province:"Hauts-de-France",theme:"⚜️ Beffrois & braderie",enjeu:"porter mille trésors à travers la grande braderie",fond:"aventure/fond_lille.jpg",reveal:"François t'accueille sur la Grand-Place de Lille, devant le beffroi, en pleine braderie — le plus grand marché aux puces d'Europe !",nom:"Lille, la grande braderie",finText:"La braderie fut un triomphe ! La région suivante t'attend… ⚜️",sousEtapes:[
 {titre:"Arrivée à Lille",narr:"Bienvenue en France ! Nous voici à Lille, tout près de la Belgique. Lis d'abord son histoire.",activites:[
   {type:'lecture',texte:"Lille est la grande ville du nord de la France, juste à côté de la Belgique — on y trouve aussi un beffroi, comme chez toi ! Chaque année s'y tient la braderie de Lille, le plus grand marché aux puces d'Europe : des millions de visiteurs, et des montagnes de coquilles de moules dans les rues, car on y mange des moules-frites !",questions:[
     {q:"Qu'est-ce que la braderie de Lille ?",choix:['le plus grand marché aux puces d\'Europe','une montagne','un fleuve'],r:'le plus grand marché aux puces d\'Europe'},
     {q:"Que mange-t-on beaucoup à la braderie ?",choix:['des moules-frites','des sushis','des tacos'],r:'des moules-frites'},
   ]},
   {type:'decision',q:"Lille est une grande ville de quelle région ?",choix:['les Hauts-de-France','la Bretagne','les Alpes','la Provence'],r:'les Hauts-de-France',fait:['reg_lille','les Hauts-de-France']},
   {type:'decision',q:"La France est la voisine de quel pays, au nord ?",choix:['la Belgique','l\'Espagne','l\'Italie','la Grèce'],r:'la Belgique',fait:['france_voisine','la Belgique']},
   {type:'decision',q:"Que partagent Lille et les villes belges ?",choix:['un beffroi','un volcan','un désert','une banquise'],r:'un beffroi',fait:['beffroi_lille','un beffroi']},
 ],crins:48,renom:2,cartes:["boulonnais","cheval_charbonnier"]},
 {titre:"La boussole de la braderie",rappel:true,narr:"La braderie est un vrai labyrinthe ! Pour t'y retrouver, apprends à t'orienter avec la rose des vents.",activites:[
   {type:'quiz',q:"Sur la rose des vents, quelle direction est en HAUT ?",schema:"🧭  N\\n O ─ ┼ ─ E\\n     S",choix:['le Nord','le Sud','l\'Est','l\'Ouest'],r:'le Nord'},
   {type:'quiz',q:"Le stand des jouets est à l'EST du beffroi. L'Est, c'est… ?",schema:"🧭 O ← ┼ → E",choix:['à droite (vers E)','à gauche','en haut','en bas'],r:'à droite (vers E)'},
   {type:'quiz',q:"Pour aller vers le SUD, tu vas… ?",schema:"🧭 N(haut) ↕ S(bas)",choix:['vers le bas','vers le haut','vers la gauche','nulle part'],r:'vers le bas'},
 ],crins:40,renom:2},
 {titre:"Le juste prix du chineur",rappel:true,narr:"Un bon chineur marchande ! Approche-toi le plus possible du juste prix.",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 88 de Puissance.","Approche-toi le plus possible de 104 de Puissance."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[88,104]},
 ],crins:46,renom:3},
 {titre:"Les portefaix",rappel:true,narr:"Il faut porter des montagnes de trésors chinés ! Réunis de solides chevaux de trait du Nord.",activites:[
   {type:'compo',consigne:"Trois chevaux de Travail costauds pour porter les trésors de la braderie.",slots:[{label:'Cheval de Travail',m:M_TRAIT,buy:['cheval_charbonnier','boulonnais','ardennais']},{label:'Cheval de Travail',m:M_TRAIT,buy:['cheval_laboureur','boulonnais','kaltblut']},{label:'Cheval de Travail',m:M_TRAIT,buy:['cheval_pompier','ardennais','gypsy_cob']}],puissanceMin:[92,106]},
   {type:'calcul',q:["Un vieux jouet coûte 4 pièces. Combien pour 3 jouets ?","Tu paies 15 pièces avec un billet de 20. On te rend ?"],choix:[['12','7','9','16'],['5','15','35','3']],r:['12','5']},
 ],crins:40,renom:2},
 {titre:"Le géant de Lille",rappel:true,narr:"Écoute l'histoire des géants du Nord.",activites:[
   {type:'lecture',texte:"Dans le Nord de la France, comme en Belgique, on aime les géants ! Ce sont d'immenses mannequins d'osier portés à bras d'hommes pendant les fêtes. Chaque ville a les siens, avec un nom et une histoire, et ils dansent sur les places au son des fanfares.",questions:[
     {q:"En quoi sont faits les géants du Nord ?",choix:['en osier','en or','en glace'],r:'en osier'},
     {q:"Que font les géants pendant les fêtes ?",choix:['ils dansent sur les places','ils dorment','ils nagent'],r:'ils dansent sur les places'},
   ]},
 ],crins:30,renom:2},
 {titre:"La grande foule",rappel:true,narr:"La braderie attire une foule immense ! Rassemble ta meilleure équipe pour ouvrir le passage.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[100,112]},
 ],crins:60,renom:4},
 {titre:"Vive la braderie !",narr:"Quelle réussite ! Lille te remercie et t'offre une carte.",activites:[{type:'bonus'}],crins:72,renom:3},
]};
const ETAPE_PARIS={key:"paris",pays:"France",drapeau:"🇫🇷",numero:11,boss:true,region:"Paris",province:"capitale de la France",theme:"👑 La Ville Lumière",enjeu:"réunir toute la France pour le grand défilé du 14 juillet",fond:"aventure/fond_paris.jpg",reveal:"François t'emmène au pied de la tour Eiffel : bienvenue à Paris, la Ville Lumière, capitale de la France !",nom:"Paris, cœur de la France",finText:"Toute la France est réunie ! Le monde continue de s'ouvrir à toi… 🌍",sousEtapes:[
 {titre:"Arrivée à Paris",narr:"Te voici à Paris pour l'épreuve suprême ! Découvre d'abord la Ville Lumière.",activites:[
   {type:'lecture',texte:"Paris est la capitale de la France, traversée par la Seine — le même genre de fleuve tranquille que tu as suivi à Rouen. On y trouve la tour Eiffel, haute de 324 mètres, le musée du Louvre et sa pyramide de verre, et la cathédrale Notre-Dame. Chaque 14 juillet, un grand défilé descend les Champs-Élysées.",questions:[
     {q:"Quel monument de fer mesure 324 m à Paris ?",choix:['la tour Eiffel','le Louvre','Notre-Dame'],r:'la tour Eiffel'},
     {q:"Quel fleuve traverse Paris ?",choix:['la Seine','le Rhône','le Rhin'],r:'la Seine'},
   ]},
   {type:'decision',q:"Paris est la… de la France ?",choix:['capitale','plus petite ville','montagne'],r:'capitale',fait:['paris_cap','la capitale']},
   {type:'quiz',q:"À Paris, ville internationale, on entend de l'anglais : « hello » = ?",choix:['bonjour','merci','au revoir'],r:'bonjour'},
 ],crins:60,renom:3,cartes:["cheval_carrosse","poulain"]},
 {titre:"La grande carte de France",rappel:true,narr:"Pour être championne, connais toute la France ! Place chaque ville dans sa région.",activites:[
   {type:'carte',pairs:[["Lille","Hauts-de-France"],["Rouen","Normandie"],["Mont-Saint-Michel","la Manche"],["Brocéliande","Bretagne"],["Dune du Pilat","Nouvelle-Aquitaine"],["Pau","Pyrénées"],["Arles","Camargue"],["Chamonix","Alpes"],["Lyon","Rhône"],["Strasbourg","Alsace"]]},
 ],crins:90,renom:5},
 {titre:"Le grand rappel de France",rappel:true,narr:"Repense à ton grand tour de France…",activites:[
   {type:'quiz',q:"Quel peintre peignait la cathédrale de Rouen à toutes les heures ?",choix:['Monet','Picasso','Rubens'],r:'Monet'},
   {type:'quiz',q:"Quelle est la plus haute montagne des Alpes ?",choix:['le Mont Blanc','le Kilimandjaro','l\'Everest'],r:'le Mont Blanc'},
   {type:'quiz',q:"De quel pays la France est-elle voisine, au nord ?",choix:['la Belgique','le Japon','le Brésil'],r:'la Belgique'},
 ],crins:60,renom:4},
 {titre:"Le carrousel de gala",rappel:true,narr:"Pour le bal de Versailles, présente tes plus belles cartes rares !",activites:[
   {type:'compo',consigne:"Trois chevaux rares (pas de commun !) pour le carrousel.",slots:[{label:'Cheval rare',m:M_RARE,buy:['cheval_romain','boulonnais','appaloosa']},{label:'Cheval rare',m:M_RARE,buy:['cheval_carrosse','ardennais','cheval_obstacle']},{label:'Cheval rare',m:M_RARE,buy:['appaloosa','cheval_desert','gypsy_cob']}]},
 ],crins:90,renom:5},
 {titre:"Le défilé du 14 juillet",rappel:true,narr:"Voici l'épreuve suprême ! Ton équipe la plus puissante descend les Champs-Élysées.",activites:[
   {type:'compo',consigne:"Ton équipe la plus puissante — c'est la grande finale de France !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[112,126]},
 ],crins:150,renom:8},
 {titre:"Championne de France !",narr:"BRAVO ! Toute la France t'acclame ! François de Camargue lui-même te rejoint, et le feu d'artifice illumine la tour Eiffel ! 🎆",activites:[{type:'bonus',carteId:'francois_camargue'}],crins:300,renom:15},
]};
const ETAPE_ROUEN={key:"rouen",pays:"France",drapeau:"🇫🇷",numero:2,region:"Rouen",province:"Normandie",theme:"🎨 La Seine & les impressionnistes",enjeu:"réussir le grand tableau de la Seine",fond:"aventure/fond_rouen.jpg",reveal:"François longe la Seine jusqu'à Rouen, devant la cathédrale que le peintre Monet aimait tant.",nom:"Rouen, la ville de Monet",finText:"Le tableau est magnifique ! La région suivante t'attend… 🎨",sousEtapes:[
 {titre:"Arrivée à Rouen",narr:"Nous suivons la Seine jusqu'à Rouen. Lis son histoire.",activites:[
   {type:'lecture',texte:"Rouen est la grande ville de Normandie, posée sur la Seine, le fleuve qui coule vers Paris puis vers la mer. Ici vécut le peintre Claude Monet : il peignit la cathédrale de Rouen plus de trente fois, à toutes les heures du jour, pour attraper la lumière qui change !",questions:[
     {q:"Sur quel fleuve se trouve Rouen ?",choix:['la Seine','le Rhône','le Rhin'],r:'la Seine'},
     {q:"Combien de fois Monet a-t-il peint la cathédrale ?",choix:['plus de trente fois','deux fois','jamais'],r:'plus de trente fois'},
   ]},
   {type:'decision',q:"Rouen est la grande ville de quelle région ?",choix:['la Normandie','la Bretagne','les Alpes','la Provence'],r:'la Normandie',fait:['reg_rouen','la Normandie']},
   {type:'decision',q:"Vers quelle ville la Seine coule-t-elle ?",choix:['Paris','Rome','Berlin','Madrid'],r:'Paris',fait:['seine_paris','Paris']},
   {type:'decision',q:"Que cherchait Monet à attraper dans ses tableaux ?",choix:['la lumière','le vent','le bruit','le froid'],r:'la lumière',fait:['monet','la lumière']},
 ],crins:48,renom:2,cartes:["haflinger","poney_heureux"]},
 {titre:"La palette de Monet",rappel:true,narr:"La lumière change toute la journée ! Remets les moments dans l'ordre, du matin au soir.",activites:[
   {type:'ordre',bulle:"La lumière du jour 🎨",consigne:"Range du matin au soir :",elements:["🌅 l'aube rose","🌤️ le matin clair","☀️ le midi doré","🌆 le soir violet"]},
   {type:'quiz',q:"En peinture, bleu + jaune donne… ?",choix:['du vert','du violet','du rouge','du noir'],r:'du vert'},
 ],crins:40,renom:2},
 {titre:"Le juste ton",rappel:true,narr:"Un bon peintre dose ses couleurs. Approche-toi du juste ton !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 88.","Approche-toi le plus possible de 104."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[88,104]},
 ],crins:46,renom:3},
 {titre:"Les modèles de Monet",rappel:true,narr:"Pour poser dans le tableau, il faut des chevaux DOUX qui ne bougent pas ! Choisis des chevaux de la famille des prés.",activites:[
   {type:'compo',consigne:"Trois chevaux doux (famille prés) pour poser sans bouger devant le peintre.",slots:[{label:'Cheval doux (prés)',m:M_PRES,buy:['poney_heureux','haflinger','belle_champs']},{label:'Cheval doux (prés)',m:M_PRES,buy:['belle_champs','maman_cheval','cheval_gourmand']},{label:'Cheval doux (prés)',m:M_PRES,buy:['maman_cheval','poney_shetland','poulain']}]},
   {type:'quiz',q:"On appelle « impressionniste » la peinture qui capte surtout… ?",choix:['la lumière et l\'instant','les chiffres','les batailles'],r:'la lumière et l\'instant'},
 ],crins:40,renom:2},
 {titre:"Le jardin de Giverny",rappel:true,narr:"Viens voir le jardin secret de Monet.",activites:[
   {type:'lecture',texte:"Non loin de Rouen, à Giverny, Monet créa un immense jardin avec un bassin couvert de nénuphars et un petit pont japonais. Il le peignit des centaines de fois. Aujourd'hui, on visite ce jardin comme on entre dans un tableau.",questions:[
     {q:"Qu'y avait-il sur le bassin de Giverny ?",choix:['des nénuphars','des bateaux','de la glace'],r:'des nénuphars'},
     {q:"Que peignait Monet à Giverny ?",choix:['son jardin','des voitures','des fusées'],r:'son jardin'},
   ]},
 ],crins:30,renom:2},
 {titre:"L'exposition",rappel:true,narr:"Le grand jour de l'exposition ! Ta meilleure équipe pour accrocher les tableaux.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[102,114]},
 ],crins:60,renom:4},
 {titre:"Vernissage !",narr:"Les tableaux émerveillent tout le monde ! Rouen t'offre une carte.",activites:[{type:'bonus'}],crins:72,renom:3},
]};
const ETAPE_MSM={key:"montsaintmichel",pays:"France",drapeau:"🇫🇷",numero:3,region:"Mont-Saint-Michel",province:"la Manche",theme:"🌊 Les marées de la Manche",enjeu:"traverser la baie avant que la mer ne monte",fond:"aventure/fond_montsaintmichel.jpg",reveal:"François t'emmène dans la baie du Mont-Saint-Michel : l'abbaye sur son rocher devient une île quand la mer monte !",nom:"Le Mont-Saint-Michel",finText:"Traversée réussie ! La région suivante t'attend… 🌊",sousEtapes:[
 {titre:"Arrivée dans la baie",narr:"Bienvenue dans la baie du Mont-Saint-Michel ! Lis bien avant de traverser.",activites:[
   {type:'lecture',texte:"Le Mont-Saint-Michel est une abbaye bâtie sur un rocher, dans la mer de la Manche. À marée basse, on peut y aller à pied ; mais quand la mer monte, il redevient une île ! On dit que la mer y revient « à la vitesse d'un cheval au galop ». Attention aux sables mouvants !",questions:[
     {q:"Que devient le Mont-Saint-Michel à marée haute ?",choix:['une île','une montagne','un bateau'],r:'une île'},
     {q:"De quoi faut-il se méfier dans la baie ?",choix:['des sables mouvants','de la neige','du désert'],r:'des sables mouvants'},
   ]},
   {type:'decision',q:"Le Mont-Saint-Michel se trouve dans quelle mer ?",choix:['la Manche','la Méditerranée','la mer Noire'],r:'la Manche',fait:['msm_mer','la Manche']},
   {type:'decision',q:"Combien de fois par jour la mer monte-t-elle et descend-elle ?",choix:['deux fois','jamais','dix fois'],r:'deux fois',fait:['marees_2','deux fois par jour']},
 ],crins:48,renom:2,cartes:["bebe_poney","poney_shetland"]},
 {titre:"Le tableau des marées",rappel:true,narr:"Pour traverser à pied, il faut y aller quand la mer est la PLUS BASSE. Lis le graphique !",activites:[
   {type:'graphique',bulle:"La hauteur de l'eau 🌊",titre:"Hauteur de la mer selon l'heure",labels:['8h','10h','12h','14h','16h'],valeurs:[6,3,1,4,7],q:["À quelle heure la mer est-elle la plus BASSE (on traverse) ?","De combien la mer monte-t-elle entre 12h et 16h ?"],choix:[['12h','8h','16h','10h'],['6','1','7','12']],r:['12h','6']},
 ],crins:42,renom:2},
 {titre:"Le juste pas",rappel:true,narr:"Ni trop vite, ni trop lentement sur le sable. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 80.","Approche-toi le plus possible de 96."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[80,96]},
 ],crins:46,renom:3},
 {titre:"Les guides de la baie",rappel:true,narr:"Sur le sable mouillé, les chevaux LOURDS s'enfoncent ! Il faut une équipe la plus LÉGÈRE possible.",activites:[
   {type:'compo',consigne:"Une équipe la plus LÉGÈRE possible (petits chevaux !) — les lourds s'enlisent.",slots:[{label:'Cheval léger',m:M_TOUS,buy:['poney_shetland','bebe_poney']},{label:'Cheval léger',m:M_TOUS,buy:['bebe_poney','poulain']},{label:'Cheval léger',m:M_TOUS,buy:['poulain','poney_shetland']}],puissanceMax:[74,90]},
   {type:'quiz',q:"Qu'est-ce qui fait monter et descendre la mer ?",choix:['la Lune','le vent','les poissons','les nuages'],r:'la Lune'},
 ],crins:40,renom:2},
 {titre:"L'abbaye des moines",rappel:true,narr:"Grimpe jusqu'à l'abbaye, tout en haut.",activites:[
   {type:'lecture',texte:"Tout en haut du rocher, des moines ont bâti une abbaye il y a plus de mille ans, pierre par pierre, en montant tout à dos d'hommes et de chevaux. C'est l'un des lieux les plus visités de France, comme un château de conte de fées posé sur la mer.",questions:[
     {q:"Qui a bâti l'abbaye ?",choix:['des moines','des pirates','des rois d\'Égypte'],r:'des moines'},
     {q:"À quoi ressemble le Mont ?",choix:['à un château de conte de fées','à une usine','à un stade'],r:'à un château de conte de fées'},
   ]},
 ],crins:30,renom:2},
 {titre:"La course contre la marée",rappel:true,narr:"La mer arrive au galop ! Ton équipe la plus LÉGÈRE pour filer avant qu'elle ne monte !",activites:[
   {type:'compo',consigne:"L'équipe la plus légère file la première ! (petits chevaux)",slots:[{label:'Cheval léger',m:M_TOUS,buy:['poney_shetland','bebe_poney']},{label:'Cheval léger',m:M_TOUS,buy:['bebe_poney','poulain']},{label:'Cheval léger',m:M_TOUS,buy:['poulain','poney_shetland']}],puissanceMax:[78,92]},
 ],crins:60,renom:4},
 {titre:"Sains et saufs !",narr:"Tout le monde a traversé avant la marée ! Le Mont te remercie et t'offre une carte.",activites:[{type:'bonus'}],crins:72,renom:3},
]};
const ETAPE_BROCELIANDE={key:"broceliande",pays:"France",drapeau:"🇫🇷",numero:4,region:"Brocéliande",province:"Bretagne",theme:"🧙 Merlin & les légendes",enjeu:"réveiller la magie de la forêt enchantée",fond:"aventure/fond_broceliande.jpg",reveal:"François s'enfonce dans la forêt de Brocéliande, en Bretagne, là où dort le magicien Merlin…",nom:"Brocéliande, la forêt de Merlin",finText:"La magie est revenue ! La région suivante t'attend… 🧙",sousEtapes:[
 {titre:"Entrée dans Brocéliande",narr:"Bienvenue dans la forêt enchantée de Brocéliande. Lis sa légende.",activites:[
   {type:'lecture',texte:"Au cœur de la Bretagne s'étend Brocéliande, une forêt de légende. On raconte que le magicien Merlin y dort pour toujours, ensorcelé par la fée Viviane près de la fontaine de Barenton, dont l'eau se met à bouillonner quand on y verse une goutte !",questions:[
     {q:"Quel magicien dort dans la forêt ?",choix:['Merlin','Napoléon','Tchantchès'],r:'Merlin'},
     {q:"Que fait l'eau de la fontaine de Barenton ?",choix:['elle bouillonne','elle gèle','elle chante'],r:'elle bouillonne'},
   ]},
   {type:'decision',q:"Brocéliande est une forêt de quelle région ?",choix:['la Bretagne','la Normandie','les Alpes','la Provence'],r:'la Bretagne',fait:['reg_broce','la Bretagne']},
   {type:'decision',q:"Quel océan borde la Bretagne ?",choix:['l\'Atlantique','la Méditerranée','la mer Noire'],r:'l\'Atlantique',fait:['bretagne_ocean','l\'Atlantique']},
   {type:'decision',q:"Qui a ensorcelé Merlin ?",choix:['la fée Viviane','le roi Arthur','un dragon'],r:'la fée Viviane',fait:['viviane','la fée Viviane']},
 ],crins:48,renom:2,cartes:["cheval_rose","cheval_fantome"]},
 {titre:"La quête d'Avalon",rappel:true,narr:"Seule la magie réveille la forêt ! Réunis des chevaux de LÉGENDE.",activites:[
   {type:'compo',consigne:"Trois chevaux de légende ou de magie (licorne, cheval rose, fantôme…).",slots:[{label:'Cheval de légende',m:M_LEGENDE,buy:['cheval_rose','licorne_girly','cheval_fantome']},{label:'Cheval de légende',m:M_LEGENDE,buy:['cheval_fantome','cheval_rose','cheval_corail']},{label:'Cheval de légende',m:M_LEGENDE,buy:['licorne_girly','cheval_nuages','cheval_rose']}]},
   {type:'quiz',q:"Un « enchanteur » est quelqu'un qui fait de la… ?",choix:['magie','cuisine','musique'],r:'magie'},
 ],crins:46,renom:3},
 {titre:"Le juste sortilège",rappel:true,narr:"Le sortilège doit être parfaitement dosé. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 90.","Approche-toi le plus possible de 106."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[90,106]},
 ],crins:46,renom:3},
 {titre:"Le Val sans Retour",rappel:true,narr:"On raconte l'histoire de la fée Morgane.",activites:[
   {type:'lecture',texte:"Dans Brocéliande se cache le Val sans Retour, où la fée Morgane retenait, dit-on, les chevaliers qui n'étaient pas fidèles. Mais un cœur pur pouvait toujours en ressortir. La forêt est pleine de ces histoires de fées, de chevaliers et de magie.",questions:[
     {q:"Qui retenait les chevaliers dans le Val ?",choix:['la fée Morgane','un dragon','un roi'],r:'la fée Morgane'},
     {q:"Qui pouvait ressortir du Val ?",choix:['un cœur pur','personne','les oiseaux'],r:'un cœur pur'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le vocabulaire des légendes",rappel:true,narr:"Les mots magiques ! Écris-les bien.",activites:[
   {type:'ortho',indice:"Écris le mot : celui qui fait de la magie 🧙",mot:"magicien"},
   {type:'ortho',indice:"Écris le mot : une créature blanche à corne d'or 🦄",mot:"licorne"},
 ],crins:36,renom:2},
 {titre:"Le réveil de la forêt",rappel:true,narr:"Pour réveiller toute la magie, ta meilleure équipe !",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[104,116]},
 ],crins:60,renom:4},
 {titre:"La forêt s'illumine",narr:"Brocéliande scintille de magie ! Elle t'offre une carte enchantée.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_PILAT={key:"pilat",pays:"France",drapeau:"🇫🇷",numero:5,region:"Dune du Pilat",province:"Nouvelle-Aquitaine",theme:"🏖️ L'océan & la dune",enjeu:"comprendre la dune qui avance et sauver la forêt",fond:"aventure/fond_pilat.jpg",reveal:"François grimpe la Dune du Pilat, la plus haute d'Europe, entre l'océan et la forêt de pins.",nom:"La Dune du Pilat",finText:"Tu as percé le secret de la dune ! La région suivante t'attend… 🏖️",sousEtapes:[
 {titre:"Au pied de la dune",narr:"Bienvenue à la Dune du Pilat ! Lis son histoire.",activites:[
   {type:'lecture',texte:"La Dune du Pilat est la plus haute dune de sable d'Europe : plus de 100 mètres, entre l'océan Atlantique et une immense forêt de pins. Et surprise : elle avance ! Poussée par le vent, elle recule de quelques mètres chaque année et recouvre peu à peu la forêt.",questions:[
     {q:"La Dune du Pilat est la plus haute de… ?",choix:['toute l\'Europe','la France seulement','ton jardin'],r:'toute l\'Europe'},
     {q:"Qu'est-ce qui fait avancer la dune ?",choix:['le vent','la pluie','les voitures'],r:'le vent'},
   ]},
   {type:'decision',q:"La Dune du Pilat borde quel océan ?",choix:['l\'Atlantique','la Méditerranée','la mer du Nord'],r:'l\'Atlantique',fait:['pilat_ocean','l\'Atlantique']},
   {type:'decision',q:"Que recouvre peu à peu la dune ?",choix:['la forêt de pins','la mer','une ville'],r:'la forêt de pins',fait:['dune_foret','la forêt de pins']},
 ],crins:48,renom:2,cartes:["zebre","ane_egyptien"]},
 {titre:"La dune qui avance",rappel:true,narr:"Regarde comme la dune s'est déplacée au fil des années !",activites:[
   {type:'graphique',bulle:"La dune avance 🏖️",titre:"Distance parcourue par la dune (m)",labels:['An 1','An 2','An 3','An 4'],valeurs:[5,10,15,20],q:["Combien la dune a-t-elle avancé en tout en 4 ans ?","Combien avance-t-elle chaque année ?"],choix:[['20','15','10','25'],['5','4','10','2']],r:['20','5']},
 ],crins:42,renom:2},
 {titre:"Le juste chargement",rappel:true,narr:"Pour traverser le sable, ni trop lourd ni trop léger. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 86.","Approche-toi le plus possible de 102."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[86,102]},
 ],crins:46,renom:3},
 {titre:"La caravane du Poitou",rappel:true,narr:"Dans le sable, les COUSINS du cheval (ânes, zèbres, poneys) avancent sans s'enliser ! Forme la caravane.",activites:[
   {type:'compo',consigne:"Trois cousins du cheval (âne, zèbre, poney…) pour la caravane du désert.",slots:[{label:'Cousin du cheval',m:M_COUSINS,buy:['ane_tetu','ane_egyptien','zebre']},{label:'Cousin du cheval',m:M_COUSINS,buy:['ane_egyptien','poney_shetland','zebre']},{label:'Cousin du cheval',m:M_COUSINS,buy:['zebre','ane_tetu','poney_shetland']}]},
   {type:'quiz',q:"Le vent qui transporte le sable, c'est un phénomène d'… ?",choix:['érosion','évaporation','électricité'],r:'érosion'},
 ],crins:40,renom:2},
 {titre:"La forêt de pins",rappel:true,narr:"Marchons dans la grande forêt.",activites:[
   {type:'lecture',texte:"Derrière la dune s'étend la plus grande forêt plantée d'Europe : des millions de pins, alignés il y a longtemps pour fixer le sable et protéger les villages. Les pins gardent leurs aiguilles vertes toute l'année : ce sont des conifères.",questions:[
     {q:"Pourquoi a-t-on planté cette forêt ?",choix:['pour fixer le sable','pour faire du bruit','pour cacher la mer'],r:'pour fixer le sable'},
     {q:"Un arbre toujours vert est un… ?",choix:['conifère','feuillu','cactus'],r:'conifère'},
   ]},
 ],crins:30,renom:2},
 {titre:"Sauver la forêt",rappel:true,narr:"Aide à replanter avant que la dune n'avance ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[104,118]},
 ],crins:60,renom:4},
 {titre:"Le secret de la dune",narr:"Tu as compris comment vit la dune ! On t'offre une carte.",activites:[{type:'bonus'}],crins:72,renom:3},
]};
const ETAPE_PAU={key:"pau",pays:"France",drapeau:"🇫🇷",numero:6,region:"Pau",province:"Pyrénées",theme:"⛰️ La montagne & la transhumance",enjeu:"mener le troupeau à l'alpage à travers les Pyrénées",fond:"aventure/fond_pau.jpg",reveal:"François arrive à Pau, face à la grande muraille des Pyrénées, frontière avec l'Espagne.",nom:"Pau et les Pyrénées",finText:"Le troupeau est à l'alpage ! La région suivante t'attend… ⛰️",sousEtapes:[
 {titre:"Arrivée à Pau",narr:"Face à Pau se dresse la muraille des Pyrénées. Lis son histoire.",activites:[
   {type:'lecture',texte:"De Pau, on voit toute la chaîne des Pyrénées, les montagnes qui séparent la France de l'Espagne. Dans ces montagnes vivent les pottoks, de petits chevaux basques à demi sauvages. Chaque été, les bergers mènent leurs troupeaux vers les hauts pâturages : c'est la transhumance.",questions:[
     {q:"Les Pyrénées séparent la France de quel pays ?",choix:['l\'Espagne','l\'Italie','l\'Allemagne'],r:'l\'Espagne'},
     {q:"Comment s'appelle la montée des troupeaux en été ?",choix:['la transhumance','la récréation','la marée'],r:'la transhumance'},
   ]},
   {type:'decision',q:"Pau est située au pied de quelle chaîne de montagnes ?",choix:['les Pyrénées','les Alpes','les Vosges'],r:'les Pyrénées',fait:['pau_montagne','les Pyrénées']},
   {type:'decision',q:"Les petits chevaux basques s'appellent les… ?",choix:['pottoks','poneys de mer','licornes'],r:'pottoks',fait:['pottok','les pottoks']},
 ],crins:48,renom:2,cartes:["fjord","roi_montagnes"]},
 {titre:"L'étagement de la montagne",rappel:true,narr:"En montant la montagne, tout change ! Remets les étages dans l'ordre, du bas vers le haut.",activites:[
   {type:'ordre',bulle:"On monte la montagne ⛰️",consigne:"Range du BAS (vallée) vers le HAUT (sommet) :",elements:["🏡 la vallée","🌲 la forêt","🌿 l'alpage (prairie)","🪨 les rochers","❄️ les neiges éternelles"]},
 ],crins:42,renom:2},
 {titre:"Le juste rythme",rappel:true,narr:"En montagne, il faut le bon rythme. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 90.","Approche-toi le plus possible de 106."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[90,106]},
 ],crins:46,renom:3},
 {titre:"La cordée",rappel:true,narr:"Encadrer un grand troupeau demande plus de bras : forme une CORDÉE de QUATRE chevaux endurants !",activites:[
   {type:'compo',consigne:"Quatre chevaux endurants pour encadrer le troupeau (première équipe de 4 !).",slots:[{label:'Endurant',m:M_ENDURANCE,buy:['cheval_charbonnier','fjord','roi_montagnes']},{label:'Endurant',m:M_ENDURANCE,buy:['mustang_indien','roi_montagnes','fjord']},{label:'Endurant',m:M_ENDURANCE,buy:['cheval_laboureur','ane_egyptien','fjord']},{label:'Endurant',m:M_ENDURANCE,buy:['roi_montagnes','mustang_indien','cheval_desert']}],puissanceMin:[124,146]},
   {type:'quiz',q:"En haut des montagnes, la neige ne fond jamais : ce sont les… ?",choix:['neiges éternelles','plages','déserts'],r:'neiges éternelles'},
 ],crins:40,renom:2},
 {titre:"Les pottoks sauvages",rappel:true,narr:"À la rencontre des petits chevaux des Pyrénées.",activites:[
   {type:'lecture',texte:"Les pottoks vivent en liberté dans la montagne depuis des milliers d'années. Petits, robustes et malins, ils supportent le froid, la pluie et la neige. Longtemps, ils ont aidé les bergers et même travaillé dans les mines. Aujourd'hui, on les protège.",questions:[
     {q:"Comment vivent les pottoks ?",choix:['en liberté dans la montagne','en ville','dans la mer'],r:'en liberté dans la montagne'},
     {q:"Que supportent bien les pottoks ?",choix:['le froid et la neige','la chaleur du désert seulement','rien'],r:'le froid et la neige'},
   ]},
 ],crins:30,renom:2},
 {titre:"L'orage en montagne",rappel:true,narr:"Un orage éclate sur l'alpage ! Ta meilleure équipe pour mettre le troupeau à l'abri.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[106,120]},
 ],crins:60,renom:4},
 {titre:"À l'alpage !",narr:"Le troupeau broute en paix sur les hauteurs ! Pau t'offre une carte.",activites:[{type:'bonus'}],crins:72,renom:3},
]};
const ETAPE_CAMARGUE={key:"camargue",pays:"France",drapeau:"🇫🇷",numero:7,region:"Camargue",province:"Camargue",theme:"🦩 Chevaux blancs & flamants roses",enjeu:"réussir le grand rassemblement des manades",fond:"aventure/fond_camargue.jpg",reveal:"François te ramène CHEZ LUI, en Camargue : les étangs, les flamants roses, et les chevaux blancs comme lui !",nom:"La Camargue, chez François",finText:"Quel bonheur de rentrer à la maison ! La région suivante t'attend… 🦩",sousEtapes:[
 {titre:"Bienvenue chez François",narr:"François est tout ému : nous voici en Camargue, sa terre natale ! Lis son histoire.",activites:[
   {type:'lecture',texte:"La Camargue est un immense delta, là où le grand fleuve Rhône se sépare et se jette dans la mer Méditerranée : des marais, du sel, et des roseaux à perte de vue. On y élève des taureaux et les fameux chevaux blancs de Camargue — qui, comme François, naissent tout foncés et blanchissent en grandissant ! Et des milliers de flamants roses y vivent.",questions:[
     {q:"La Camargue est le delta de quel fleuve ?",choix:['le Rhône','la Seine','le Rhin'],r:'le Rhône'},
     {q:"De quelle couleur naissent les chevaux de Camargue ?",choix:['foncés (ils blanchissent après)','blancs','verts'],r:'foncés (ils blanchissent après)'},
   ]},
   {type:'decision',q:"La Camargue se jette dans quelle mer ?",choix:['la Méditerranée','la Manche','l\'Atlantique'],r:'la Méditerranée',fait:['camargue_mer','la Méditerranée']},
   {type:'decision',q:"Quel oiseau rose vit en Camargue ?",choix:['le flamant rose','le pingouin','le perroquet'],r:'le flamant rose',fait:['flamant','le flamant rose']},
 ],crins:50,renom:2,cartes:["cheval_albinos","camargue"]},
 {titre:"Le secret des flamants",rappel:true,narr:"Sais-tu pourquoi les flamants sont roses ? Regarde et devine !",activites:[
   {type:'quiz',q:"Pourquoi les flamants sont-ils roses ?",schema:"🦐 petites crevettes → 🦩 flamant rose",choix:['ils mangent de petites crevettes roses','ils prennent des coups de soleil','ils se peignent'],r:'ils mangent de petites crevettes roses'},
   {type:'quiz',q:"Sur quoi les flamants se tiennent-ils souvent ?",choix:['sur une seule patte','sur la tête','sur le dos'],r:'sur une seule patte'},
 ],crins:42,renom:2},
 {titre:"Le juste troupeau",rappel:true,narr:"Un beau troupeau bien équilibré. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 92.","Approche-toi le plus possible de 108."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[92,108]},
 ],crins:46,renom:3},
 {titre:"La manade de François",rappel:true,narr:"Pour le grand rassemblement, il faut une manade de chevaux TOUS BLANCS, comme les vrais camarguais !",activites:[
   {type:'compo',robesDistinctes:false,consigne:"Trois chevaux de robe BLANCHE (camargue, albinos, François…) pour la manade.",slots:[{label:'Cheval blanc',m:M_BLANC,buy:['cheval_albinos','camargue']},{label:'Cheval blanc',m:M_BLANC,buy:['cheval_albinos','camargue']},{label:'Cheval blanc',m:M_BLANC,buy:['cheval_albinos','camargue']}]},
   {type:'quiz',q:"Les cow-boys de Camargue qui gardent les taureaux s'appellent les… ?",choix:['gardians','gladiateurs','pirates'],r:'gardians'},
 ],crins:40,renom:2},
 {titre:"Les gardians",rappel:true,narr:"À la rencontre des cavaliers de Camargue.",activites:[
   {type:'lecture',texte:"Les gardians sont les cavaliers de Camargue : montés sur leurs chevaux blancs, un trident à la main, ils gardent les grands troupeaux de taureaux noirs dans les marais. Ils portent un grand chapeau et vivent au rythme des saisons, comme de vrais cow-boys de France.",questions:[
     {q:"Que gardent les gardians ?",choix:['des troupeaux de taureaux','des poules','des poissons'],r:'des troupeaux de taureaux'},
     {q:"Sur quels chevaux montent-ils ?",choix:['des chevaux blancs','des zèbres','des poneys roses'],r:'des chevaux blancs'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le grand rassemblement",rappel:true,narr:"Tous les troupeaux se retrouvent ! Ta meilleure équipe pour les guider.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[106,120]},
 ],crins:66,renom:5},
 {titre:"La fête camarguaise",narr:"La Camargue fête son grand rassemblement, et François est le plus fier des chevaux ! On t'offre une belle carte.",activites:[{type:'bonus',rarete:['rare','epique']}],crins:90,renom:5},
]};
const ETAPE_CHAMONIX={key:"chamonix",pays:"France",drapeau:"🇫🇷",numero:8,region:"Chamonix",province:"Alpes",theme:"🏔️ Le Mont Blanc, toit de l'Europe",enjeu:"réussir la grande expédition du Mont Blanc",fond:"aventure/fond_chamonix.jpg",reveal:"François lève les yeux vers le Mont Blanc, 4808 m, le toit de l'Europe, à Chamonix.",nom:"Chamonix & le Mont Blanc",finText:"L'expédition est un triomphe ! La région suivante t'attend… 🏔️",sousEtapes:[
 {titre:"Arrivée à Chamonix",narr:"Bienvenue à Chamonix, au pied du Mont Blanc ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Chamonix est un village des Alpes, au pied du Mont Blanc, la plus haute montagne d'Europe occidentale : 4 808 mètres ! Ses glaciers, comme la Mer de Glace, sont d'immenses fleuves de glace. Mais attention : plus on monte, plus il fait froid, et ces glaciers reculent d'année en année.",questions:[
     {q:"Quelle est la hauteur du Mont Blanc ?",choix:['4 808 m','100 m','1 000 m'],r:'4 808 m'},
     {q:"Que se passe-t-il quand on monte en altitude ?",choix:['il fait plus froid','il fait plus chaud','rien'],r:'il fait plus froid'},
   ]},
   {type:'decision',q:"Le Mont Blanc se trouve dans quelle chaîne de montagnes ?",choix:['les Alpes','les Pyrénées','les Vosges'],r:'les Alpes',fait:['montblanc_alpes','les Alpes']},
   {type:'decision',q:"Comment s'appelle le grand glacier de Chamonix ?",choix:['la Mer de Glace','la Grande Bleue','le Lac Noir'],r:'la Mer de Glace',fait:['merdeglace','la Mer de Glace']},
 ],crins:48,renom:2,cartes:["cheval_glace","cheval_corail"]},
 {titre:"Altitude et température",rappel:true,narr:"Plus on monte, plus il fait froid. Regarde le graphique !",activites:[
   {type:'graphique',bulle:"Il fait plus froid en montant 🏔️",titre:"Température selon l'altitude (°C)",labels:['0 m','1000 m','2000 m','3000 m'],valeurs:[15,9,3,0],q:["Où fait-il le plus FROID ?","La température à 0 m est 15°. À 2000 m elle est 3°. Combien de degrés de moins ?"],choix:[['à 3000 m','à 0 m','à 1000 m','partout pareil'],['12','3','15','9']],r:['à 3000 m','12']},
 ],crins:42,renom:2},
 {titre:"Le juste équipement",rappel:true,narr:"Pour l'ascension, ni trop chargé ni trop léger. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 92.","Approche-toi le plus possible de 108."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[92,108]},
 ],crins:46,renom:3},
 {titre:"L'attelage des glaces",rappel:true,narr:"Sur les glaciers, il faut des chevaux que le froid ne gêne pas : les chevaux ÉLÉMENTAIRES de glace !",activites:[
   {type:'compo',consigne:"Trois chevaux élémentaires / de glace pour marcher sur les glaciers.",slots:[{label:'Cheval de glace',m:M_ELEM,buy:['cheval_glace','cheval_corail','cheval_nuages']},{label:'Cheval élémentaire',m:M_ELEM,buy:['cheval_corail','cheval_glace','licorne_girly']},{label:'Cheval élémentaire',m:M_ELEM,buy:['cheval_nuages','cheval_glace','cheval_corail']}]},
   {type:'quiz',q:"Quand la glace fond, elle devient… ?",choix:['de l\'eau (liquide)','de la vapeur','de la pierre'],r:'de l\'eau (liquide)'},
 ],crins:40,renom:2},
 {titre:"La Mer de Glace",rappel:true,narr:"Descendons sur le grand glacier.",activites:[
   {type:'lecture',texte:"La Mer de Glace est un glacier long de plusieurs kilomètres : un fleuve de glace qui avance très lentement. Depuis cent ans, avec le réchauffement, il fond et recule de plus en plus vite. Les savants le mesurent chaque année pour comprendre le climat.",questions:[
     {q:"Qu'est-ce qu'un glacier ?",choix:['un fleuve de glace','un lac chaud','une plage'],r:'un fleuve de glace'},
     {q:"Que fait la Mer de Glace depuis cent ans ?",choix:['elle fond et recule','elle grandit','elle disparaît en été seulement'],r:'elle fond et recule'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le sommet",rappel:true,narr:"L'assaut final vers les hauteurs ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[108,120]},
 ],crins:60,renom:4},
 {titre:"Au sommet de l'Europe !",narr:"Te voilà sur le toit de l'Europe ! Chamonix t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_LYON={key:"lyon",pays:"France",drapeau:"🇫🇷",numero:9,region:"Lyon",province:"Rhône",theme:"🎭 La soie & les Lumières",enjeu:"tisser la grande soie pour la fête des Lumières",fond:"aventure/fond_lyon.jpg",reveal:"François arrive à Lyon, au confluent du Rhône et de la Saône — comme Namur avec la Sambre et la Meuse !",nom:"Lyon, la ville de la soie",finText:"La fête des Lumières illumine la ville ! La dernière région t'attend… 🎭",sousEtapes:[
 {titre:"Arrivée à Lyon",narr:"Nous voici à Lyon, au bord de deux rivières. Lis son histoire.",activites:[
   {type:'lecture',texte:"Lyon est bâtie au confluent de deux rivières, le Rhône et la Saône — exactement comme Namur avec la Sambre et la Meuse, se souvient François ! C'est la ville des canuts, les tisseurs de soie, et de Guignol, la célèbre marionnette (un cousin de Tchantchès !). Chaque décembre, à la fête des Lumières, toutes les fenêtres s'illuminent de bougies.",questions:[
     {q:"Lyon est au confluent du Rhône et de la… ?",choix:['Saône','Meuse','Seine'],r:'Saône'},
     {q:"Comment s'appelle la marionnette de Lyon ?",choix:['Guignol','Tchantchès','Pinocchio'],r:'Guignol'},
   ]},
   {type:'decision',q:"Que tissaient les canuts de Lyon ?",choix:['la soie','le charbon','le sel'],r:'la soie',fait:['canuts','la soie']},
   {type:'decision',q:"Quelle grande fête illumine Lyon en décembre ?",choix:['la fête des Lumières','le carnaval','la braderie'],r:'la fête des Lumières',fait:['lumieres','la fête des Lumières']},
 ],crins:48,renom:2,cartes:["cheval_diligence","cheval_romain"]},
 {titre:"Le motif des canuts",rappel:true,narr:"Le tissage suit un motif qui se répète. Trouve la suite logique !",activites:[
   {type:'quiz',q:"Continue le motif : ▲ ● ▲ ● ▲ ● … ?",schema:"▲ ● ▲ ● ▲ ● ❓",choix:['▲','●','■','★'],r:'▲'},
   {type:'quiz',q:"Continue : ▲ ▲ ● ▲ ▲ ● … ?",schema:"▲▲● ▲▲● ❓",choix:['▲','●','■','◆'],r:'▲'},
 ],crins:42,renom:2},
 {titre:"Le juste fil",rappel:true,narr:"Un fil bien tendu, ni trop ni trop peu. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 92.","Approche-toi le plus possible de 110."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[92,110]},
 ],crins:46,renom:3},
 {titre:"Les canuts",rappel:true,narr:"Pour porter les lourdes soies dans les rues en pente, réunis des chevaux des vieux métiers : les HISTORIQUES !",activites:[
   {type:'compo',consigne:"Trois chevaux des vieux métiers (diligence, pompier, facteur…).",slots:[{label:'Cheval historique',m:M_HISTORIQUES,buy:['cheval_diligence','cheval_pompier','cheval_romain']},{label:'Cheval historique',m:M_HISTORIQUES,buy:['cheval_pompier','cheval_facteur','cheval_cosaque']},{label:'Cheval historique',m:M_HISTORIQUES,buy:['cheval_facteur','cheval_diligence','mustang_indien']}]},
   {type:'calcul',q:["Un motif se répète tous les 4 fils. Après 3 motifs, combien de fils ?","Combien de fils pour 6 motifs de 4 fils ?"],choix:[['12','7','8','16'],['24','20','18','30']],r:['12','24']},
 ],crins:40,renom:2},
 {titre:"Guignol",rappel:true,narr:"Petit spectacle de marionnettes !",activites:[
   {type:'lecture',texte:"Guignol est né à Lyon il y a plus de deux cents ans, inventé par un ancien canut. Malin et bon cœur, il défend les petites gens et se moque des puissants, souvent avec un bon coup de bâton — tout comme Tchantchès à Liège ! Aujourd'hui encore, les enfants rient devant ses spectacles.",questions:[
     {q:"Qui a inventé Guignol ?",choix:['un ancien canut','un roi','un pirate'],r:'un ancien canut'},
     {q:"À quelle marionnette belge ressemble Guignol ?",choix:['Tchantchès','Pieter-Jan','le Manneken-Pis'],r:'Tchantchès'},
   ]},
 ],crins:30,renom:2},
 {titre:"La fête des Lumières",rappel:true,narr:"Il faut allumer toute la ville ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[108,122]},
 ],crins:60,renom:4},
 {titre:"Lyon s'illumine",narr:"Toute la ville brille de mille bougies ! Lyon t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_STRASBOURG={key:"strasbourg",pays:"France",drapeau:"🇫🇷",numero:10,region:"Strasbourg",province:"Alsace",theme:"🇪🇺 Le Rhin & l'Europe",enjeu:"accueillir toute l'Europe à Strasbourg",fond:"aventure/fond_strasbourg.jpg",reveal:"François atteint Strasbourg, sur le Rhin : ses cigognes, ses colombages, et le Parlement de l'Europe.",nom:"Strasbourg, capitale de l'Europe",finText:"Toute la France est presque réunie… direction Paris ! 🇪🇺",sousEtapes:[
 {titre:"Arrivée à Strasbourg",narr:"Nous voici à Strasbourg, tout à l'est, sur le Rhin. Lis son histoire.",activites:[
   {type:'lecture',texte:"Strasbourg est la grande ville d'Alsace, posée sur le Rhin, le fleuve qui sépare la France de l'Allemagne. On y voit des maisons à colombages, des cigognes sur les toits, et le plus vieux marché de Noël du pays. Strasbourg abrite aussi le Parlement européen : avec Bruxelles, c'est une capitale de l'Europe !",questions:[
     {q:"Sur quel fleuve se trouve Strasbourg ?",choix:['le Rhin','le Rhône','la Seine'],r:'le Rhin'},
     {q:"Quel grand bâtiment européen s'y trouve ?",choix:['le Parlement européen','la tour Eiffel','le Colisée'],r:'le Parlement européen'},
   ]},
   {type:'decision',q:"Strasbourg est la grande ville de quelle région ?",choix:['l\'Alsace','la Bretagne','la Provence'],r:'l\'Alsace',fait:['reg_strasbourg','l\'Alsace']},
   {type:'decision',q:"Le Rhin sépare la France de quel pays ?",choix:['l\'Allemagne','l\'Espagne','l\'Italie'],r:'l\'Allemagne',fait:['rhin_allemagne','l\'Allemagne']},
   {type:'decision',q:"Avec quelle ville belge Strasbourg partage-t-elle l'Europe ?",choix:['Bruxelles','Gand','Liège'],r:'Bruxelles',fait:['strasbourg_bxl','Bruxelles']},
 ],crins:48,renom:2,cartes:["kaltblut","cheval_cirque"]},
 {titre:"Les langues d'Europe",rappel:true,narr:"À Strasbourg, on entend toutes les langues d'Europe ! Sauras-tu dire bonjour et merci ?",activites:[
   {type:'quiz',q:"En néerlandais (Flandre), « bonjour » se dit… ?",choix:['hallo','bonjour','hello','guten Tag'],r:'hallo'},
   {type:'quiz',q:"En anglais, « merci » se dit… ?",choix:['thank you','dank je','danke','merci'],r:'thank you'},
   {type:'quiz',q:"En allemand, « merci » se dit… ?",choix:['danke','merci','thank you','grazie'],r:'danke'},
 ],crins:42,renom:2},
 {titre:"Le juste accueil",rappel:true,narr:"Une délégation bien équilibrée. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 94.","Approche-toi le plus possible de 112."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[94,112]},
 ],crins:46,renom:3},
 {titre:"Les ambassadeurs",rappel:true,narr:"Pour représenter toute l'Europe, choisis 3 chevaux de 3 ROYAUMES DIFFÉRENTS !",activites:[
   {type:'compo',royaumesDistincts:true,consigne:"Trois chevaux de trois royaumes (origines) DIFFÉRENTS — la délégation de l'Europe !",slots:[{label:'Ambassadeur 1',m:M_TOUS,buy:['cheval_charbonnier','kaltblut']},{label:'Ambassadeur 2',m:M_TOUS,buy:['cheval_cirque','boulonnais']},{label:'Ambassadeur 3',m:M_TOUS,buy:['mustang_indien','zebre']}]},
   {type:'quiz',q:"Comment s'appelle l'union des pays d'Europe ?",choix:['l\'Union européenne','les Nations unies','la Ligue'],r:'l\'Union européenne'},
 ],crins:40,renom:2},
 {titre:"Les cigognes",rappel:true,narr:"Regarde les grands oiseaux sur les toits.",activites:[
   {type:'lecture',texte:"En Alsace, les cigognes sont partout : de grands oiseaux blancs et noirs qui bâtissent d'énormes nids sur les toits et les clochers. Chaque année, elles partent passer l'hiver au chaud en Afrique, puis reviennent au printemps. Elles sont le symbole de la région.",questions:[
     {q:"Où les cigognes font-elles leur nid ?",choix:['sur les toits','sous l\'eau','dans les grottes'],r:'sur les toits'},
     {q:"Où vont-elles passer l'hiver ?",choix:['en Afrique','au pôle Nord','à la mer'],r:'en Afrique'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le grand marché de Noël",rappel:true,narr:"Le marché de Noël attire une foule immense ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[110,124]},
 ],crins:60,renom:4},
 {titre:"Vive l'Europe !",narr:"Strasbourg accueille toute l'Europe en fête ! Il ne reste plus que Paris. On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_DOUVRES={key:"douvres",pays:"Royaume-Uni",drapeau:"🇬🇧",numero:1,region:"Douvres",province:"Angleterre",theme:"⛴️ Les falaises blanches",enjeu:"accoster et découvrir le Royaume",fond:"aventure/fond_douvres.jpg",reveal:"Big Ben t'accueille au pied des falaises blanches de Douvres, après la traversée de la Manche !",nom:"Douvres, la porte du Royaume",finText:"Bienvenue au Royaume-Uni ! La région suivante t'attend… ⛴️",sousEtapes:[
 {titre:"Arrivée à Douvres",narr:"Après la traversée de la Manche, nous accostons à Douvres ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Douvres est la porte d'entrée du Royaume-Uni : ses immenses falaises blanches accueillent depuis toujours les bateaux qui traversent la Manche. Elles sont blanches car faites de craie — une roche tendre venue de minuscules coquillages ! Ici, on parle anglais et, attention, on roule à gauche !",questions:[
     {q:"Pourquoi les falaises de Douvres sont-elles blanches ?",choix:['elles sont en craie (coquillages)','on les a peintes','à cause de la neige'],r:'elles sont en craie (coquillages)'},
     {q:"De quel côté roule-t-on au Royaume-Uni ?",choix:['à gauche','à droite','au milieu'],r:'à gauche'},
   ]},
   {type:'decision',q:"Douvres se trouve dans quelle nation du Royaume-Uni ?",choix:['l\'Angleterre','l\'Écosse','le Pays de Galles','l\'Irlande'],r:'l\'Angleterre',fait:['nation_douvres','l\'Angleterre']},
   {type:'decision',q:"Quelle mer sépare Douvres de la France ?",choix:['la Manche','la Méditerranée','la mer Noire'],r:'la Manche',fait:['douvres_manche','la Manche']},
   {type:'decision',q:"En anglais, « bonjour » se dit… ?",choix:['hello','hallo','bonjour','ciao'],r:'hello',fait:['hello','hello']},
 ],crins:50,renom:2,cartes:["cheval_obstacle","cheval_charbonnier"]},
 {titre:"L'horaire du ferry",rappel:true,narr:"Pour repartir explorer, il faut lire l'horaire des ferries et bien s'orienter !",activites:[
   {type:'quiz',q:"Le ferry pour l'Écosse part vers le NORD. Sur la carte, le Nord est… ?",schema:"🧭 N(haut) · S(bas)",choix:['en haut','en bas','à droite','à gauche'],r:'en haut'},
   {type:'graphique',bulle:"Combien de bateaux par jour ? 📊",titre:"Ferries par jour",labels:['Lun','Mar','Mer','Jeu'],valeurs:[8,6,10,7],q:["Quel jour y a-t-il le plus de ferries ?","Combien de ferries en tout sur Lundi et Mardi ?"],choix:[['Mercredi','Lundi','Jeudi','Mardi'],['14','8','10','16']],r:['Mercredi','14']},
 ],crins:42,renom:2},
 {titre:"Le juste embarquement",rappel:true,narr:"Ni trop chargé ni trop léger sur le pont. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 90.","Approche-toi le plus possible de 106."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[90,106]},
 ],crins:46,renom:3},
 {titre:"Le comité d'accueil",rappel:true,narr:"Big Ben rassemble ses cousins géants pour t'accueillir : trois grands chevaux de trait !",activites:[
   {type:'compo',consigne:"Trois chevaux de Travail (les Shire géants du comité d'accueil).",slots:[{label:'Cheval de Travail',m:M_TRAIT,buy:['cheval_charbonnier','boulonnais','kaltblut']},{label:'Cheval de Travail',m:M_TRAIT,buy:['cheval_laboureur','ardennais','gypsy_cob']},{label:'Cheval de Travail',m:M_TRAIT,buy:['cheval_pompier','boulonnais','ardennais']}],puissanceMin:[92,104]},
   {type:'quiz',q:"En anglais, « welcome » veut dire… ?",choix:['bienvenue','au revoir','merci','non'],r:'bienvenue'},
 ],crins:40,renom:2},
 {titre:"Les falaises de craie",rappel:true,narr:"Grimpons en haut des falaises.",activites:[
   {type:'lecture',texte:"Les falaises blanches de Douvres sont hautes de plus de cent mètres. La craie qui les compose s'est formée il y a des millions d'années, au fond de la mer, avec les coquilles de milliards d'animaux minuscules. La mer, en tapant contre elles, les use petit à petit : c'est encore l'érosion !",questions:[
     {q:"Comment s'est formée la craie ?",choix:['avec des coquilles d\'animaux minuscules','avec du sable du désert','avec de la neige'],r:'avec des coquilles d\'animaux minuscules'},
     {q:"Qu'est-ce qui use les falaises ?",choix:['la mer (érosion)','le feu','le vent chaud'],r:'la mer (érosion)'},
   ]},
 ],crins:30,renom:2},
 {titre:"La foule du port",rappel:true,narr:"Le port grouille de voyageurs ! Ta meilleure équipe pour ouvrir le passage.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[104,116]},
 ],crins:62,renom:4},
 {titre:"Welcome to Britain !",narr:"Te voilà accueillie au Royaume-Uni ! Douvres t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_LONDRES={key:"londres",pays:"Royaume-Uni",drapeau:"🇬🇧",numero:11,boss:true,region:"Londres",province:"capitale du Royaume-Uni",theme:"👑 La Garde royale",enjeu:"représenter tout le Royaume à la grande parade",fond:"aventure/fond_londres.jpg",reveal:"Big Ben t'emmène devant Tower Bridge et Big Ben (la tour !) : bienvenue à Londres, capitale du Royaume-Uni !",nom:"Londres, cœur du Royaume",finText:"Tu es la championne du Royaume ! Le monde continue de s'ouvrir… 🌍",sousEtapes:[
 {titre:"Arrivée à Londres",narr:"Te voici à Londres pour l'épreuve suprême ! Découvre la capitale.",activites:[
   {type:'lecture',texte:"Londres est la capitale du Royaume-Uni, traversée par la Tamise. On y voit la grande horloge Big Ben (qui a donné son nom à ton ami Shire !), le pont-levis de Tower Bridge, le palais de Buckingham où vit le roi, et de fameux bus rouges à deux étages. La relève de la garde du roi se fait même à cheval !",questions:[
     {q:"Quel fleuve traverse Londres ?",choix:['la Tamise','la Seine','le Rhin'],r:'la Tamise'},
     {q:"Où vit le roi à Londres ?",choix:['au palais de Buckingham','dans le métro','sur un bateau'],r:'au palais de Buckingham'},
   ]},
   {type:'decision',q:"Londres est la capitale de quel pays ?",choix:['le Royaume-Uni','la France','la Belgique'],r:'le Royaume-Uni',fait:['londres_cap','le Royaume-Uni']},
   {type:'quiz',q:"En anglais, « king » veut dire… ?",choix:['roi','reine','cheval','pont'],r:'roi'},
 ],crins:60,renom:3,cartes:["gypsy_cob","poulain"]},
 {titre:"La carte des 4 nations",rappel:true,narr:"Le Royaume-Uni est fait de plusieurs nations ! Place chaque lieu dans la bonne nation.",activites:[
   {type:'carte',pairs:[["Douvres","Angleterre"],["Stonehenge","Angleterre"],["Dartmoor","Angleterre"],["Snowdonia","Pays de Galles"],["Newmarket","Angleterre"],["York","Angleterre"],["Édimbourg","Écosse"],["Loch Ness","Écosse"],["Shetland","Écosse"],["Connemara","Irlande"]]},
 ],crins:90,renom:5},
 {titre:"Le grand rappel du Royaume",rappel:true,narr:"Repense à tout ton voyage dans les îles…",activites:[
   {type:'quiz',q:"Dans quel lac vit le célèbre monstre Nessie ?",choix:['le Loch Ness','la Tamise','la Manche'],r:'le Loch Ness'},
   {type:'quiz',q:"Quel animal orne le drapeau du Pays de Galles ?",choix:['un dragon rouge','un lion','un aigle'],r:'un dragon rouge'},
   {type:'quiz',q:"De quel côté roule-t-on au Royaume-Uni ?",choix:['à gauche','à droite'],r:'à gauche'},
 ],crins:60,renom:4},
 {titre:"La Garde royale",rappel:true,narr:"Pour la relève de la garde, présente tes plus belles cartes rares — les chevaux du roi !",activites:[
   {type:'compo',consigne:"Trois chevaux rares (pas de commun !) pour la Garde royale.",slots:[{label:'Cheval rare',m:M_RARE,buy:['cheval_obstacle','cheval_romain','gypsy_cob']},{label:'Cheval rare',m:M_RARE,buy:['boulonnais','appaloosa','cheval_carrosse']},{label:'Cheval rare',m:M_RARE,buy:['cheval_police','cheval_desert','ardennais']}]},
 ],crins:90,renom:5},
 {titre:"La grande parade",rappel:true,narr:"Voici l'épreuve suprême ! Ton équipe la plus puissante défile devant le roi.",activites:[
   {type:'compo',consigne:"Ton équipe la plus puissante — la grande parade royale !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[116,130]},
 ],crins:160,renom:8},
 {titre:"Championne du Royaume !",narr:"BRAVO ! Tout le Royaume t'acclame, et Big Ben le Shire lui-même te rejoint pour la parade ! 🎆",activites:[{type:'bonus',carteId:'big_ben'}],crins:320,renom:15},
]};
const ETAPE_STONEHENGE={key:"stonehenge",pays:"Royaume-Uni",drapeau:"🇬🇧",numero:2,region:"Stonehenge",province:"Angleterre",theme:"🗿 Le mystère des pierres",enjeu:"aider les Anciens à dresser les pierres géantes",fond:"aventure/fond_stonehenge.jpg",reveal:"Big Ben t'emmène devant Stonehenge, le cercle de pierres géantes vieux de 5000 ans !",nom:"Stonehenge, le cercle mystérieux",finText:"Les pierres sont dressées ! La région suivante t'attend… 🗿",sousEtapes:[
 {titre:"Devant les pierres",narr:"Voici Stonehenge ! Lis son mystère.",activites:[
   {type:'lecture',texte:"Stonehenge est un cercle de pierres géantes dressées il y a près de 5000 ans, à l'époque de la préhistoire. Personne ne sait vraiment comment on a déplacé ces blocs de 25 tonnes — certains viennent du Pays de Galles, à 250 km ! Le cercle est aligné sur le Soleil : au premier jour de l'été, le soleil se lève pile entre deux pierres.",questions:[
     {q:"De quand date Stonehenge ?",choix:['la préhistoire (5000 ans)','l\'an dernier','le Moyen Âge'],r:'la préhistoire (5000 ans)'},
     {q:"Sur quel astre le cercle est-il aligné ?",choix:['le Soleil','la Lune','Mars'],r:'le Soleil'},
   ]},
   {type:'decision',q:"Stonehenge se trouve dans quelle nation ?",choix:['l\'Angleterre','l\'Écosse','l\'Irlande'],r:'l\'Angleterre',fait:['nation_stone','l\'Angleterre']},
   {type:'decision',q:"Combien pèse chaque grande pierre ?",choix:['environ 25 tonnes','1 kilo','100 grammes'],r:'environ 25 tonnes',fait:['pierre_25t','25 tonnes']},
   {type:'quiz',q:"En anglais, une pierre se dit… ?",choix:['a stone','a horse','a house'],r:'a stone'},
 ],crins:50,renom:2,cartes:["boulonnais","cheval_charbonnier"]},
 {titre:"Aligner les pierres",rappel:true,narr:"Le cercle doit être parfaitement symétrique. Aide à placer la pierre-miroir !",activites:[
   {type:'quiz',q:"Le cercle est symétrique. Si une pierre est à GAUCHE, sa jumelle doit être… ?",schema:"🗿 ⟷ ❓  (miroir)",choix:['à droite, à la même distance','tout en haut','au centre'],r:'à droite, à la même distance'},
   {type:'ordre',bulle:"Range les pierres 🗿",consigne:"Range les pierres de la PLUS PETITE à la PLUS GRANDE :",elements:["🪨 petite","🗿 moyenne","⛰️ grande","🏔️ géante"]},
 ],crins:44,renom:2},
 {titre:"Le juste effort",rappel:true,narr:"Pour bouger une pierre, le bon nombre de chevaux. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 96.","Approche-toi le plus possible de 112."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[96,112]},
 ],crins:46,renom:3},
 {titre:"Les colosses",rappel:true,narr:"Traîner des blocs de 25 tonnes demande les chevaux les plus PUISSANTS du monde !",activites:[
   {type:'compo',consigne:"Les trois chevaux les plus puissants pour traîner les pierres géantes.",slots:[{label:'Colosse',m:M_TOUS,buy:['boulonnais','ardennais','kaltblut']},{label:'Colosse',m:M_TOUS,buy:['ardennais','shire','boulonnais']},{label:'Colosse',m:M_TOUS,buy:['kaltblut','shire','cheval_charbonnier']}],puissanceMin:[106,120]},
   {type:'quiz',q:"Un objet est symétrique quand ses deux moitiés sont… ?",choix:['pareilles (en miroir)','toutes différentes','invisibles'],r:'pareilles (en miroir)'},
 ],crins:42,renom:2},
 {titre:"Le peuple des bâtisseurs",rappel:true,narr:"Qui a bâti Stonehenge ?",activites:[
   {type:'lecture',texte:"Les bâtisseurs de Stonehenge vivaient à la préhistoire, bien avant les Romains et les chevaliers. Ils n'avaient ni machines ni roues de fer : ils déplaçaient les pierres avec des rondins de bois, des cordes et la force des hommes et des animaux. C'est encore un mystère pour les savants !",questions:[
     {q:"Avaient-ils des machines ?",choix:['non, des rondins et des cordes','oui, des grues','oui, des camions'],r:'non, des rondins et des cordes'},
     {q:"Qui vivait le plus tôt ?",choix:['les bâtisseurs de Stonehenge','les chevaliers','les Romains'],r:'les bâtisseurs de Stonehenge'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le solstice",rappel:true,narr:"Le grand jour du soleil d'été ! Ta meilleure équipe pour la cérémonie.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[108,120]},
 ],crins:62,renom:4},
 {titre:"Le cercle est dressé !",narr:"Les pierres tiennent debout pour 5000 ans de plus ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_DARTMOOR={key:"dartmoor",pays:"Royaume-Uni",drapeau:"🇬🇧",numero:3,region:"Dartmoor",province:"Angleterre",theme:"🌫️ La lande brumeuse",enjeu:"ramener les poneys perdus dans la brume",fond:"aventure/fond_dartmoor.jpg",reveal:"Big Ben t'emmène sur la lande brumeuse de Dartmoor, où vivent en liberté les poneys sauvages…",nom:"Dartmoor, la lande des poneys",finText:"Tous les poneys sont rentrés ! La région suivante t'attend… 🌫️",sousEtapes:[
 {titre:"Dans la lande",narr:"Bienvenue sur la lande sauvage de Dartmoor. Lis son histoire.",activites:[
   {type:'lecture',texte:"Dartmoor est une lande immense et sauvage : de l'herbe rase, des rochers, des marais et une brume qui tombe d'un coup. Des poneys de Dartmoor y vivent en liberté depuis toujours. C'est un endroit si mystérieux qu'un écrivain y a placé un terrible chien fantôme, le « chien des Baskerville » !",questions:[
     {q:"Comment vivent les poneys de Dartmoor ?",choix:['en liberté sur la lande','en ville','à la mer'],r:'en liberté sur la lande'},
     {q:"Quel animal de légende hante la lande ?",choix:['un chien fantôme','un dragon','une licorne'],r:'un chien fantôme'},
   ]},
   {type:'decision',q:"Qu'est-ce qui tombe soudain sur la lande et fait perdre son chemin ?",choix:['la brume','la neige','le sable'],r:'la brume',fait:['dartmoor_brume','la brume']},
   {type:'quiz',q:"En anglais, sombre/foncé se dit… ?",choix:['dark','light','blue'],r:'dark'},
 ],crins:50,renom:2,cartes:["frison","murgese"]},
 {titre:"L'itinéraire dans la brume",rappel:true,narr:"La brume est tombée ! Suis les repères dans le bon ordre pour traverser sans te perdre.",activites:[
   {type:'ordre',bulle:"Suis le chemin 🌫️",consigne:"Traverse la lande : range les repères du DÉPART à l'ARRIVÉE :",elements:["🚩 le départ","🪨 le grand rocher","🌉 le vieux pont","🌳 l'arbre tordu","🏡 la ferme (arrivée)"]},
 ],crins:44,renom:2},
 {titre:"Le juste pas",rappel:true,narr:"Sur les marais, avance prudemment. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 96.","Approche-toi le plus possible de 112."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[96,112]},
 ],crins:46,renom:3},
 {titre:"Les fantômes de la lande",rappel:true,narr:"Seuls les chevaux à la robe NOIRE connaissent les secrets de la brume. Réunis-les !",activites:[
   {type:'compo',consigne:"Deux chevaux de robe NOIRE (les ombres de la lande) et un cheval de ton choix.",slots:[{label:'Cheval noir',m:M_NOIR,buy:['frison','murgese']},{label:'Cheval noir',m:M_NOIR,buy:['murgese','frison']},{label:'Cheval au choix',m:M_TOUS}]},
   {type:'quiz',q:"La brume, c'est en fait… ?",choix:['un nuage tout près du sol','de la fumée','de la poussière'],r:'un nuage tout près du sol'},
 ],crins:40,renom:2},
 {titre:"Les poneys libres",rappel:true,narr:"À la rencontre des poneys de la lande.",activites:[
   {type:'lecture',texte:"Les poneys de Dartmoor sont petits, robustes et malins. Ils supportent le froid, la pluie et la brume, et trouvent seuls leur nourriture sur la lande. Depuis des siècles, ils appartiennent un peu à tout le monde et à personne : on les rassemble une fois par an pour les compter et les soigner.",questions:[
     {q:"Comment sont les poneys de Dartmoor ?",choix:['petits et robustes','énormes','fragiles'],r:'petits et robustes'},
     {q:"Que fait-on une fois par an ?",choix:['on les rassemble pour les compter','on les cache','on les peint'],r:'on les rassemble pour les compter'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le grand rassemblement",rappel:true,narr:"La brume se lève, il faut vite ramener tout le monde ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[108,122]},
 ],crins:62,renom:4},
 {titre:"Tous rentrés !",narr:"Pas un poney perdu ! La lande te remercie et t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_SNOWDONIA={key:"snowdonia",pays:"Royaume-Uni",drapeau:"🏴",numero:4,region:"Snowdonia",province:"Pays de Galles",theme:"🐉 Le dragon rouge",enjeu:"réveiller le dragon rouge du Pays de Galles",fond:"aventure/fond_snowdonia.jpg",reveal:"Big Ben grimpe les montagnes du Snowdon, au Pays de Galles, terre des châteaux et du dragon rouge !",nom:"Snowdonia et le dragon",finText:"Le dragon rouge veille à nouveau ! La région suivante t'attend… 🐉",sousEtapes:[
 {titre:"Au pays du dragon",narr:"Bienvenue au Pays de Galles ! Lis sa légende.",activites:[
   {type:'lecture',texte:"Le Pays de Galles est une terre de montagnes — dont le Snowdon, le plus haut sommet — et de châteaux forts. Sur son drapeau trône un dragon rouge, le seul dragon au monde sur un drapeau de pays ! Ici, on parle une autre langue, le gallois : « bore da » veut dire bonjour.",questions:[
     {q:"Quel animal orne le drapeau gallois ?",choix:['un dragon rouge','un lion','un ours'],r:'un dragon rouge'},
     {q:"Comment dit-on bonjour en gallois ?",choix:['bore da','hello','bonjour'],r:'bore da'},
   ]},
   {type:'decision',q:"Snowdonia est dans quelle nation ?",choix:['le Pays de Galles','l\'Écosse','l\'Irlande'],r:'le Pays de Galles',fait:['nation_snow','le Pays de Galles']},
   {type:'decision',q:"Le Snowdon est un… ?",choix:['sommet (montagne)','lac','désert'],r:'sommet (montagne)',fait:['snowdon','une montagne']},
   {type:'quiz',q:"En anglais, dragon se dit… ?",choix:['dragon','horse','castle'],r:'dragon'},
 ],crins:50,renom:2,cartes:["cheval_tournoi","cheval_cosaque"]},
 {titre:"La légende du dragon rouge",rappel:true,narr:"Écoute la vieille légende galloise.",activites:[
   {type:'lecture',texte:"La légende raconte que deux dragons, un rouge et un blanc, se battaient sous une colline et empêchaient de bâtir un château. Un jeune magicien, Merlin, les libéra : le dragon rouge chassa le blanc. Depuis, le dragon rouge est le symbole du Pays de Galles, fier et protecteur.",questions:[
     {q:"Quels dragons se battaient ?",choix:['un rouge et un blanc','deux verts','trois noirs'],r:'un rouge et un blanc'},
     {q:"Quel dragon l'emporta ?",choix:['le rouge','le blanc','aucun'],r:'le rouge'},
   ]},
 ],crins:44,renom:2},
 {titre:"Le juste équilibre",rappel:true,narr:"En montagne, l'équilibre est tout. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 98.","Approche-toi le plus possible de 114."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[98,114]},
 ],crins:46,renom:3},
 {titre:"Les gardiens du dragon",rappel:true,narr:"Pour réveiller le dragon, il faut des montures de BATAILLE, braves comme les chevaliers gallois !",activites:[
   {type:'compo',consigne:"Trois chevaux de bataille pour garder le dragon rouge.",slots:[{label:'Cheval de bataille',m:M_BATAILLE,buy:['cheval_cosaque','cheval_tournoi','cheval_police']},{label:'Cheval de bataille',m:M_BATAILLE,buy:['cheval_tournoi','cheval_romain','cheval_armure']},{label:'Cheval de bataille',m:M_BATAILLE,buy:['cheval_police','cheval_cosaque','cheval_royal']}]},
   {type:'quiz',q:"En gallois, « bore da » veut dire… ?",choix:['bonjour','merci','au revoir'],r:'bonjour'},
 ],crins:40,renom:2},
 {titre:"Les châteaux gallois",rappel:true,narr:"Le Pays de Galles compte plus de châteaux que partout ailleurs !",activites:[
   {type:'lecture',texte:"Le Pays de Galles est le pays qui compte le plus de châteaux forts par kilomètre au monde ! Bâtis en pierre sur les collines, avec de hautes tours et des remparts, ils protégeaient les habitants. Beaucoup se visitent encore aujourd'hui, comme des décors de contes de chevaliers.",questions:[
     {q:"De quoi le Pays de Galles est-il rempli ?",choix:['de châteaux forts','de volcans','de plages de sable'],r:'de châteaux forts'},
     {q:"En quoi sont bâtis ces châteaux ?",choix:['en pierre','en verre','en glace'],r:'en pierre'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le réveil du dragon",rappel:true,narr:"Le dragon rouge s'éveille ! Ta meilleure équipe pour la grande garde.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[110,122]},
 ],crins:62,renom:4},
 {titre:"Le dragon veille !",narr:"Le dragon rouge protège à nouveau le Pays de Galles ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_NEWMARKET={key:"newmarket",pays:"Royaume-Uni",drapeau:"🇬🇧",numero:5,region:"Newmarket",province:"Angleterre",theme:"🏇 La capitale des courses",enjeu:"gagner la grande course de Newmarket",fond:"aventure/fond_newmarket.jpg",reveal:"Big Ben t'emmène à Newmarket, la capitale mondiale des courses de chevaux !",nom:"Newmarket, la ville des courses",finText:"Quelle course ! La région suivante t'attend… 🏇",sousEtapes:[
 {titre:"À Newmarket",narr:"Bienvenue à Newmarket, la ville des courses ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Newmarket est la capitale mondiale des courses de chevaux : ici galope le pur-sang anglais, le cheval le plus rapide du monde ! Chose incroyable : tous les pur-sang de la planète descendent de seulement trois étalons arrivés en Angleterre il y a environ 300 ans.",questions:[
     {q:"Quel cheval est le plus rapide du monde ?",choix:['le pur-sang anglais','le poney Shetland','l\'âne'],r:'le pur-sang anglais'},
     {q:"De combien d'étalons descendent tous les pur-sang ?",choix:['trois','cent','mille'],r:'trois'},
   ]},
   {type:'decision',q:"Newmarket est dans quelle nation ?",choix:['l\'Angleterre','l\'Écosse','le Pays de Galles'],r:'l\'Angleterre',fait:['nation_newm','l\'Angleterre']},
   {type:'quiz',q:"En anglais, une course se dit… ?",choix:['a race','a stone','a king'],r:'a race'},
 ],crins:50,renom:2,cartes:["cheval_obstacle","mustang_indien"]},
 {titre:"La grande course !",rappel:true,narr:"À toi de jouer ! Tape « GALOP ! » le plus vite possible pour gagner la course.",activites:[
   {type:'course',taps:16,bulle:"Tape « GALOP ! » très vite pour dépasser ton rival ! 🏇",q:["Tu finis la course en 12 secondes, ton rival en 15. Tu gagnes de combien de secondes ?","La course fait 20 furlongs. Tu en as fait 12. Combien reste-t-il ?"],choix:[['3 secondes','5 secondes','27 secondes','2 secondes'],['8','12','32','6']],r:['3 secondes','8']},
 ],crins:46,renom:3},
 {titre:"Le juste départ",rappel:true,narr:"Un bon départ, ni trop tôt ni trop tard. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 98.","Approche-toi le plus possible de 114."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[98,114]},
 ],crins:46,renom:3},
 {titre:"L'écurie de course",rappel:true,narr:"Pour gagner, il faut les chevaux les plus RAPIDES !",activites:[
   {type:'compo',consigne:"Trois chevaux rapides pour l'écurie de course.",slots:[{label:'Cheval rapide',m:M_VITESSE,buy:['mustang_indien','cheval_obstacle','cheval_cirque']},{label:'Cheval rapide',m:M_VITESSE,buy:['cheval_obstacle','cheval_desert','mustang_indien']},{label:'Cheval rapide',m:M_VITESSE,buy:['cheval_cirque','cheval_cosaque','cheval_obstacle']}],puissanceMin:[100,114]},
   {type:'calcul',q:["Une course dure 2 minutes. Combien de secondes ?","Trois courses de 2 minutes : combien de minutes en tout ?"],choix:[['120','60','200','20'],['6','5','8','4']],r:['120','6']},
 ],crins:40,renom:2},
 {titre:"Le secret des pur-sang",rappel:true,narr:"D'où vient la vitesse du pur-sang ?",activites:[
   {type:'lecture',texte:"Le pur-sang anglais est né du croisement de juments anglaises et de trois étalons venus d'Arabie et d'Orient, réputés pour leur endurance. De ce mélange est né le cheval de course parfait : léger, tout en muscles, capable de galoper à plus de 60 km/h ! On note soigneusement sa famille dans un grand livre, le stud-book.",questions:[
     {q:"À quelle vitesse galope un pur-sang ?",choix:['plus de 60 km/h','5 km/h','200 km/h'],r:'plus de 60 km/h'},
     {q:"D'où venaient les trois étalons ?",choix:['d\'Arabie et d\'Orient','du pôle Nord','de la Lune'],r:'d\'Arabie et d\'Orient'},
   ]},
 ],crins:30,renom:2},
 {titre:"La grande finale",rappel:true,narr:"La course reine de Newmarket ! Ton équipe la plus puissante.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[110,124]},
 ],crins:64,renom:4},
 {titre:"Photo-finish gagnante !",narr:"Tu franchis la ligne en tête ! Newmarket t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_YORK={key:"york",pays:"Royaume-Uni",drapeau:"🇬🇧",numero:6,region:"York",province:"Angleterre",theme:"⚔️ Les Vikings",enjeu:"défendre la ville et raconter son histoire",fond:"aventure/fond_york.jpg",reveal:"Big Ben t'emmène à York, la ville aux remparts, jadis envahie par les Vikings !",nom:"York, la ville viking",finText:"L'histoire de York est sauvée ! La région suivante t'attend… ⚔️",sousEtapes:[
 {titre:"Dans York",narr:"Bienvenue à York, ville d'histoire ! Lis son passé.",activites:[
   {type:'lecture',texte:"York est une vieille ville entourée de remparts, avec une immense cathédrale. Il y a plus de mille ans, elle fut envahie par les Vikings, ces navigateurs venus du Nord sur leurs drakkars ; ils l'appelaient Jorvik. Beaucoup de mots anglais nous viennent d'eux, et sous la ville on a retrouvé leurs maisons !",questions:[
     {q:"Qui a envahi York il y a mille ans ?",choix:['les Vikings','les Romains','les Égyptiens'],r:'les Vikings'},
     {q:"Comment les Vikings appelaient-ils la ville ?",choix:['Jorvik','Paris','Rome'],r:'Jorvik'},
   ]},
   {type:'decision',q:"Sur quoi les Vikings naviguaient-ils ?",choix:['des drakkars','des avions','des trains'],r:'des drakkars',fait:['drakkar','des drakkars']},
   {type:'quiz',q:"En anglais, vieux/ancien se dit… ?",choix:['old','new','fast'],r:'old'},
 ],crins:50,renom:2,cartes:["cheval_romain","cheval_diligence"]},
 {titre:"La frise du temps",rappel:true,narr:"Remets l'histoire dans l'ordre, du plus ancien au plus récent !",activites:[
   {type:'ordre',bulle:"La frise du temps ⚔️",consigne:"Range du PLUS ANCIEN au PLUS RÉCENT :",elements:["🗿 la préhistoire","🏛️ les Romains","⚔️ les Vikings","🏰 les chevaliers","🚗 aujourd'hui"]},
 ],crins:44,renom:2},
 {titre:"Le juste équilibre",rappel:true,narr:"Une défense bien équilibrée. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 100.","Approche-toi le plus possible de 116."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[100,116]},
 ],crins:46,renom:3},
 {titre:"La garde du Nord",rappel:true,narr:"Pour défendre York, réunis les montures des temps anciens : les HISTORIQUES !",activites:[
   {type:'compo',consigne:"Trois chevaux des temps anciens (famille historiques).",slots:[{label:'Cheval historique',m:M_HISTORIQUES,buy:['cheval_diligence','mustang_indien','cheval_romain']},{label:'Cheval historique',m:M_HISTORIQUES,buy:['cheval_romain','cheval_pompier','cheval_chinois']},{label:'Cheval historique',m:M_HISTORIQUES,buy:['cheval_pompier','cheval_diligence','cheval_tournoi']}]},
   {type:'quiz',q:"Les Vikings venaient de quelle direction ?",schema:"🧭 du NORD ⬆️",choix:['du Nord','du Sud','du désert'],r:'du Nord'},
 ],crins:40,renom:2},
 {titre:"Les traces vikings",rappel:true,narr:"On fouille sous la ville…",activites:[
   {type:'lecture',texte:"À York, les savants ont creusé et retrouvé un village viking entier : des maisons de bois, des outils, des pièces de monnaie, et même des chaussures ! On a reconstitué Jorvik pour montrer comment on y vivait il y a mille ans. C'est ainsi qu'on apprend l'histoire : en cherchant des traces.",questions:[
     {q:"Qu'a-t-on retrouvé sous York ?",choix:['un village viking','un vaisseau spatial','un volcan'],r:'un village viking'},
     {q:"Comment apprend-on l'histoire ?",choix:['en cherchant des traces','en inventant','en dormant'],r:'en cherchant des traces'},
   ]},
 ],crins:30,renom:2},
 {titre:"La défense de York",rappel:true,narr:"Les drakkars approchent ! Ta meilleure équipe sur les remparts.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[112,124]},
 ],crins:64,renom:4},
 {titre:"York est sauvée !",narr:"La ville et son histoire sont préservées ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_EDIMBOURG={key:"edimbourg",pays:"Royaume-Uni",drapeau:"🏴",numero:7,region:"Édimbourg",province:"Écosse",theme:"🏰 Château, kilts & cornemuses",enjeu:"mener le clan à la grande parade des Highlands",fond:"aventure/fond_edimbourg.jpg",reveal:"Big Ben t'emmène à Édimbourg, en Écosse, devant son château dressé sur un rocher !",nom:"Édimbourg, la fière Écosse",finText:"Le clan a défilé avec honneur ! La région suivante t'attend… 🏰",sousEtapes:[
 {titre:"Arrivée en Écosse",narr:"Bienvenue en Écosse ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Édimbourg est la capitale de l'Écosse : son château est bâti tout en haut d'un rocher, au-dessus de la ville. Les Écossais portent le kilt, une jupe aux carreaux de couleurs appelée tartan, et jouent de la cornemuse. Chaque famille, ou clan, a son propre motif de tartan !",questions:[
     {q:"Où est bâti le château d'Édimbourg ?",choix:['en haut d\'un rocher','sous la mer','dans un arbre'],r:'en haut d\'un rocher'},
     {q:"Comment s'appelle le motif à carreaux écossais ?",choix:['le tartan','le tricolore','le damier'],r:'le tartan'},
   ]},
   {type:'decision',q:"Édimbourg est la capitale de quelle nation ?",choix:['l\'Écosse','le Pays de Galles','l\'Irlande'],r:'l\'Écosse',fait:['nation_edim','l\'Écosse']},
   {type:'decision',q:"De quel instrument jouent les Écossais ?",choix:['la cornemuse','le piano','la trompette'],r:'la cornemuse',fait:['cornemuse','la cornemuse']},
   {type:'quiz',q:"En anglais, château se dit… ?",choix:['castle','stone','race'],r:'castle'},
 ],crins:50,renom:2,cartes:["cheval_obstacle","cheval_charbonnier"]},
 {titre:"Le motif du tartan",rappel:true,narr:"Le tartan croise deux couleurs qui se répètent. Trouve la suite !",activites:[
   {type:'quiz',q:"Continue le tartan : 🔴🔵🔴🔵🔴🔵 … ?",schema:"🔴🔵 🔴🔵 🔴🔵 ❓",choix:['🔴','🔵','🟢','⚫'],r:'🔴'},
   {type:'quiz',q:"Continue : 🔴🔴🔵 🔴🔴🔵 … ?",schema:"🔴🔴🔵 🔴🔴🔵 ❓",choix:['🔴','🔵','🟢','⚫'],r:'🔴'},
 ],crins:44,renom:2},
 {titre:"Le juste tissage",rappel:true,narr:"Un tartan bien serré, ni trop ni trop peu. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 100.","Approche-toi le plus possible de 116."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[100,116]},
 ],crins:46,renom:3},
 {titre:"Le clan",rappel:true,narr:"Un clan, c'est une seule et même famille ! Réunis 3 chevaux du MÊME royaume.",activites:[
   {type:'compo',royaumeUnique:true,consigne:"Trois chevaux du MÊME royaume (le clan) — même origine pour tous !",slots:[{label:'Membre du clan',m:M_TOUS,buy:['cheval_charbonnier','cheval_obstacle']},{label:'Membre du clan',m:M_TOUS,buy:['cheval_obstacle','cheval_police']},{label:'Membre du clan',m:M_TOUS,buy:['cheval_police','cheval_charbonnier']}]},
   {type:'quiz',q:"Un « clan » écossais, c'est… ?",choix:['une grande famille','un château','une montagne'],r:'une grande famille'},
 ],crins:40,renom:2},
 {titre:"Le monstre du château",rappel:true,narr:"Une petite pause thé avant la parade ! (tea time ☕)",activites:[
   {type:'lecture',texte:"En Écosse, on fait souvent une pause pour le thé, le fameux « tea time ». C'est aussi le pays des légendes : lochs mystérieux, châteaux hantés, et bien sûr un certain monstre dans un grand lac que tu vas bientôt rencontrer… Les Highlands, ce sont les hautes terres, sauvages et magnifiques.",questions:[
     {q:"Qu'appelle-t-on les Highlands ?",choix:['les hautes terres','les plages','les déserts'],r:'les hautes terres'},
     {q:"Quelle pause fait-on en Écosse ?",choix:['le tea time (thé)','la sieste','le goûter à midi'],r:'le tea time (thé)'},
   ]},
 ],crins:34,renom:2},
 {titre:"La grande parade",rappel:true,narr:"Le clan défile au son des cornemuses ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[112,126]},
 ],crins:64,renom:4},
 {titre:"Fière Écosse !",narr:"Le clan a défilé avec honneur ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_LOCHNESS={key:"lochness",pays:"Royaume-Uni",drapeau:"🏴",numero:8,region:"Loch Ness",province:"Écosse",theme:"🌊 Le monstre du lac",enjeu:"percer le mystère du grand lac",fond:"aventure/fond_lochness.jpg",reveal:"Big Ben t'emmène au bord du Loch Ness, le lac profond et mystérieux des Highlands…",nom:"Le Loch Ness et Nessie",finText:"Le mystère du loch t'a livré ses secrets ! La région suivante t'attend… 🌊",sousEtapes:[
 {titre:"Au bord du loch",narr:"Bienvenue au Loch Ness ! Lis son mystère.",activites:[
   {type:'lecture',texte:"Un « loch », en Écosse, c'est un grand lac. Le Loch Ness est si profond et si sombre qu'il contiendrait plus d'eau que tous les lacs d'Angleterre réunis ! On raconte qu'un monstre, Nessie, y vivrait — mais personne ne l'a jamais vraiment vu. Les savants, eux, mesurent la profondeur du lac.",questions:[
     {q:"Qu'est-ce qu'un « loch » ?",choix:['un grand lac','une montagne','un château'],r:'un grand lac'},
     {q:"Qui vivrait dans le Loch Ness ?",choix:['le monstre Nessie','un dragon','une sirène'],r:'le monstre Nessie'},
   ]},
   {type:'decision',q:"Le Loch Ness se trouve dans quelle nation ?",choix:['l\'Écosse','le Pays de Galles','l\'Angleterre'],r:'l\'Écosse',fait:['nation_loch','l\'Écosse']},
   {type:'quiz',q:"En anglais, profond se dit… ?",choix:['deep','small','fast'],r:'deep'},
 ],crins:50,renom:2,cartes:["cheval_rivieres","cheval_halage"]},
 {titre:"Les profondeurs du loch",rappel:true,narr:"Les savants ont mesuré la profondeur à différents endroits. Lis le graphique !",activites:[
   {type:'graphique',bulle:"Où est-ce le plus profond ? 🌊",titre:"Profondeur du loch (m)",labels:['Bord','Milieu','Fond','Sortie'],valeurs:[30,150,230,60],q:["Où le lac est-il le plus PROFOND ?","De combien le fond est-il plus profond que le bord ?"],choix:[['au Fond','au Bord','au Milieu','à la Sortie'],['200','230','30','260']],r:['au Fond','200']},
 ],crins:44,renom:2},
 {titre:"Le juste sondage",rappel:true,narr:"Descends la sonde au bon niveau. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 102.","Approche-toi le plus possible de 118."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[102,118]},
 ],crins:46,renom:3},
 {titre:"Les nageurs du loch",rappel:true,narr:"Seuls les chevaux d'EAU osent explorer le lac de Nessie !",activites:[
   {type:'compo',consigne:"Trois chevaux de la famille de l'eau pour explorer le loch.",slots:[{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_halage','cheval_rivieres','camargue']},{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_rivieres','cheval_corail','kelpie']},{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_corail','cheval_halage','hippocampe']}]},
   {type:'quiz',q:"Un lac d'eau douce très profond en Écosse s'appelle un… ?",choix:['loch','fjord','delta'],r:'loch'},
 ],crins:40,renom:2},
 {titre:"La légende de Nessie",rappel:true,narr:"Alors, ce monstre… vrai ou faux ?",activites:[
   {type:'lecture',texte:"Depuis presque cent ans, des gens disent avoir vu Nessie : un long cou sortant de l'eau, une grosse bosse… Mais aucune preuve solide n'existe, et les photos les plus célèbres étaient des farces ! Les savants pensent qu'on confond souvent des vagues, des troncs ou de gros poissons. La légende, elle, fait rêver le monde entier.",questions:[
     {q:"A-t-on une vraie preuve de Nessie ?",choix:['non, aucune preuve solide','oui, une photo sûre','oui, on l\'a attrapé'],r:'non, aucune preuve solide'},
     {q:"Que confond-on parfois avec le monstre ?",choix:['des vagues ou des troncs','des étoiles','des nuages'],r:'des vagues ou des troncs'},
   ]},
 ],crins:30,renom:2},
 {titre:"L'exploration finale",rappel:true,narr:"On sonde le loch en entier ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[114,126]},
 ],crins:66,renom:5},
 {titre:"Mystère éclairci !",narr:"Tu as cartographié tout le loch (sans réveiller Nessie) ! On t'offre une belle carte.",activites:[{type:'bonus',rarete:['rare','epique']}],crins:90,renom:5},
]};
const ETAPE_SHETLAND={key:"shetland",pays:"Royaume-Uni",drapeau:"🏴",numero:9,region:"Îles Shetland",province:"Écosse",theme:"🐧 Les plus petits poneys",enjeu:"recenser les macareux et les petits poneys",fond:"aventure/fond_shetland.jpg",reveal:"Big Ben t'emmène tout au nord, aux îles Shetland, terre des plus petits poneys du monde et des macareux !",nom:"Les îles Shetland",finText:"Recensement terminé ! La dernière région t'attend… 🐧",sousEtapes:[
 {titre:"Tout au nord",narr:"Bienvenue aux îles Shetland ! Lis leur histoire.",activites:[
   {type:'lecture',texte:"Les îles Shetland sont tout au nord du Royaume-Uni, battues par le vent et la mer. On y trouve les plus petits poneys du monde, les poneys Shetland : minuscules mais incroyablement forts — à sa taille, un poney Shetland tire plus lourd qu'un cheval de trait ! On y voit aussi des macareux, ces oiseaux au bec coloré.",questions:[
     {q:"Comment sont les poneys Shetland ?",choix:['minuscules mais très forts','énormes','fragiles'],r:'minuscules mais très forts'},
     {q:"Quel oiseau au bec coloré vit là ?",choix:['le macareux','le perroquet','l\'autruche'],r:'le macareux'},
   ]},
   {type:'decision',q:"Les îles Shetland sont dans quelle nation ?",choix:['l\'Écosse','le Pays de Galles','l\'Irlande'],r:'l\'Écosse',fait:['nation_shet','l\'Écosse']},
   {type:'quiz',q:"En anglais, petit se dit… ?",choix:['small','big','deep'],r:'small'},
 ],crins:50,renom:2,cartes:["poney_shetland","poulain"]},
 {titre:"Le grand comptage",rappel:true,narr:"Aide à recenser les macareux sur les falaises ! Compte bien.",activites:[
   {type:'graphique',bulle:"Compte les macareux 🐧",titre:"Macareux par falaise",labels:['Nord','Est','Sud','Ouest'],valeurs:[40,25,30,15],q:["Sur quelle falaise y a-t-il le PLUS de macareux ?","Combien de macareux en tout au Nord et au Sud ?"],choix:[['au Nord','à l\'Est','au Sud','à l\'Ouest'],['70','40','30','65']],r:['au Nord','70']},
 ],crins:44,renom:2},
 {titre:"Le juste attelage",rappel:true,narr:"Sur ces petites îles, léger c'est mieux. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 82.","Approche-toi le plus possible de 96."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[82,96]},
 ],crins:46,renom:3},
 {titre:"Les minuscules",rappel:true,narr:"Sur les sentiers étroits des falaises, les plus PETITS passent partout ! Forme l'équipe la plus légère.",activites:[
   {type:'compo',consigne:"L'équipe la plus LÉGÈRE possible — les minuscules poneys sont les rois ici !",slots:[{label:'Petit poney',m:M_TOUS,buy:['poney_shetland','poulain']},{label:'Petit poney',m:M_TOUS,buy:['poulain','bebe_poney']},{label:'Petit poney',m:M_TOUS,buy:['bebe_poney','poney_shetland']}],puissanceMax:[76,90]},
   {type:'quiz',q:"« Petit mais costaud » décrit bien le poney… ?",choix:['Shetland','pur-sang','Shire'],r:'Shetland'},
 ],crins:40,renom:2},
 {titre:"La vie des îles",rappel:true,narr:"Comment vit-on sur ces îles lointaines ?",activites:[
   {type:'lecture',texte:"Aux Shetland, il fait froid et venteux presque toute l'année, et le soleil brille très longtemps l'été mais disparaît vite l'hiver. Les habitants élèvent des moutons, pêchent, et fêtent chaque hiver un grand festival du feu en souvenir des Vikings, qui ont vécu ici autrefois.",questions:[
     {q:"Quel temps fait-il aux Shetland ?",choix:['froid et venteux','chaud et sec','tropical'],r:'froid et venteux'},
     {q:"Quel festival y fête-t-on ?",choix:['un festival du feu','un carnaval de plage','une fête des fleurs'],r:'un festival du feu'},
   ]},
 ],crins:30,renom:2},
 {titre:"La course des poneys",rappel:true,narr:"Les petits poneys filent sur les sentiers ! L'équipe la plus légère gagne.",activites:[
   {type:'compo',consigne:"L'équipe la plus légère file la première !",slots:[{label:'Petit poney',m:M_TOUS,buy:['poney_shetland','poulain']},{label:'Petit poney',m:M_TOUS,buy:['poulain','bebe_poney']},{label:'Petit poney',m:M_TOUS,buy:['bebe_poney','poney_shetland']}],puissanceMax:[80,94]},
 ],crins:64,renom:4},
 {titre:"Recensement terminé !",narr:"Tous les macareux et poneys sont comptés ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_CONNEMARA={key:"connemara",pays:"Irlande",drapeau:"☘️",numero:10,region:"Connemara",province:"Irlande",theme:"☘️ L'île verte & les Celtes",enjeu:"réussir la grande fête celtique d'Irlande",fond:"aventure/fond_connemara.jpg",reveal:"Big Ben traverse jusqu'en Irlande, dans le Connemara : prairies vertes, falaises et légendes celtiques !",nom:"Le Connemara irlandais",finText:"Quelle fête ! Il ne reste plus que Londres… ☘️",sousEtapes:[
 {titre:"Sur l'île verte",narr:"Bienvenue en Irlande ! Lis son histoire.",activites:[
   {type:'lecture',texte:"L'Irlande est une île à part, si verte qu'on l'appelle l'île d'Émeraude, bordée par l'océan Atlantique et ses hautes falaises. On y raconte des légendes de leprechauns, de petits lutins farceurs qui cachent un chaudron d'or au pied de l'arc-en-ciel, et de trèfles à quatre feuilles porte-bonheur. C'est la terre du poney Connemara et de l'Irish Cob, souvent noir et blanc (pie).",questions:[
     {q:"Pourquoi appelle-t-on l'Irlande l'île d'Émeraude ?",choix:['parce qu'+"'"+'elle est très verte','parce qu'+"'"+'elle brille','à cause de la neige'],r:'parce qu'+"'"+'elle est très verte'},
     {q:"Que cache le leprechaun ?",choix:['un chaudron d\'or','une épée','un dragon'],r:'un chaudron d\'or'},
   ]},
   {type:'decision',q:"Quel océan borde l'Irlande ?",choix:['l\'Atlantique','la Méditerranée','la mer Noire'],r:'l\'Atlantique',fait:['irlande_ocean','l\'Atlantique']},
   {type:'decision',q:"L'Irish Cob a souvent une robe… ?",choix:['pie (noir et blanc)','toute rouge','dorée'],r:'pie (noir et blanc)',fait:['irish_pie','pie (noir et blanc)']},
   {type:'quiz',q:"En anglais, vert se dit… ?",choix:['green','red','blue'],r:'green'},
 ],crins:52,renom:2,cartes:["gypsy_cob","cheval_rose"]},
 {titre:"Le trèfle de la chance",rappel:true,narr:"Résous l'énigme du leprechaun pour trouver son or !",activites:[
   {type:'quiz',q:"Le trèfle porte-bonheur d'Irlande a un nombre spécial de feuilles : lequel ?",choix:['4','2','7'],r:'4'},
   {type:'quiz',q:"Le leprechaun dit : « mon or est au pied de l'arc-en-ciel ». Après la pluie, où regarder ?",schema:"🌧️ → 🌈 → 💰 ?",choix:['sous l\'arc-en-ciel','dans la mer','sous la terre'],r:'sous l\'arc-en-ciel'},
 ],crins:44,renom:2},
 {titre:"Le juste partage",rappel:true,narr:"Partage l'or équitablement. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 104.","Approche-toi le plus possible de 118."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[104,118]},
 ],crins:46,renom:3},
 {titre:"Les trèfles pie",rappel:true,narr:"Pour la fête celtique, réunis les chevaux à la robe PIE (noir et blanc), comme les Irish Cob !",activites:[
   {type:'compo',consigne:"Deux chevaux de robe PIE (noir et blanc) et un cheval de ton choix.",slots:[{label:'Cheval pie',m:M_PIE,buy:['gypsy_cob']},{label:'Cheval pie',m:M_PIE,buy:['gypsy_cob']},{label:'Cheval au choix',m:M_TOUS}]},
   {type:'quiz',q:"Une robe « pie », c'est un cheval… ?",choix:['à grandes taches noir et blanc','tout doré','à pois roses'],r:'à grandes taches noir et blanc'},
 ],crins:40,renom:2},
 {titre:"La musique celtique",rappel:true,narr:"Écoute la musique d'Irlande.",activites:[
   {type:'lecture',texte:"En Irlande, la musique est partout : violons, flûtes et tambours font danser tout le village dans les pubs. On y danse les pieds qui claquent et le buste bien droit, une danse célèbre dans le monde entier. La harpe est même le symbole du pays — le seul pays au monde avec un instrument de musique comme emblème !",questions:[
     {q:"Quel instrument est le symbole de l'Irlande ?",choix:['la harpe','la guitare','le tambour'],r:'la harpe'},
     {q:"Comment danse-t-on en Irlande ?",choix:['les pieds qui claquent, buste droit','couché','en nageant'],r:'les pieds qui claquent, buste droit'},
   ]},
 ],crins:30,renom:2},
 {titre:"La grande fête celtique",rappel:true,narr:"Tout le Connemara danse ! Ta meilleure équipe pour mener la fête.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[116,128]},
 ],crins:66,renom:5},
 {titre:"Sláinte ! (à la tienne !)",narr:"La fête celtique est un triomphe ! Il ne te reste plus que Londres. On t'offre une carte.",activites:[{type:'bonus'}],crins:90,renom:5},
]};
const ETAPE_COLOGNE={key:"cologne",pays:"Allemagne",drapeau:"🇩🇪",numero:1,region:"Cologne",province:"Allemagne",theme:"⛪ La cathédrale & le Rhin",enjeu:"suivre le grand fleuve à travers l'Allemagne",fond:"aventure/fond_cologne.jpg",reveal:"Inge t'accueille à Cologne, en Allemagne, devant l'immense cathédrale, au bord du Rhin !",nom:"Cologne, sur le Rhin",finText:"Le voyage du Rhin commence ! La région suivante t'attend… ⛪",sousEtapes:[
 {titre:"Arrivée à Cologne",narr:"Bienvenue en Allemagne ! Nous voici à Cologne, au bord du Rhin. Lis son histoire.",activites:[
   {type:'lecture',texte:"Cologne est une grande ville d'Allemagne, posée sur le Rhin, le grand fleuve que nous allons suivre jusqu'à la mer. Sa cathédrale, la plus haute d'Allemagne, a mis plus de 600 ans à être bâtie ! Ici on parle allemand : « guten Tag » veut dire bonjour.",questions:[
     {q:"Sur quel grand fleuve se trouve Cologne ?",choix:['le Rhin','la Seine','la Tamise'],r:'le Rhin'},
     {q:"Combien de temps pour bâtir la cathédrale ?",choix:['plus de 600 ans','un an','un jour'],r:'plus de 600 ans'},
   ]},
   {type:'decision',q:"Cologne se trouve dans quel pays ?",choix:['l\'Allemagne','les Pays-Bas','l\'Angleterre'],r:'l\'Allemagne',fait:['pays_cologne','l\'Allemagne']},
   {type:'decision',q:"Le Rhin naît dans les montagnes et se jette dans… ?",choix:['la mer du Nord','le désert','un lac'],r:'la mer du Nord',fait:['rhin_mer','la mer du Nord']},
   {type:'quiz',q:"En allemand, « guten Tag » veut dire… ?",choix:['bonjour','merci','au revoir'],r:'bonjour'},
 ],crins:52,renom:2,cartes:["kaltblut","cheval_charbonnier"]},
 {titre:"Le voyage du Rhin",rappel:true,narr:"Le Rhin voyage de la montagne à la mer. Remets son parcours dans l'ordre !",activites:[
   {type:'ordre',bulle:"Le Rhin, de la source à la mer 🌊",consigne:"Range le voyage du Rhin, du DÉBUT (montagne) à la FIN (mer) :",elements:["⛰️ la source (les Alpes)","🇩🇪 l'Allemagne","🇳🇱 les Pays-Bas","🌊 la mer du Nord"]},
 ],crins:44,renom:2},
 {titre:"Le juste chargement",rappel:true,narr:"Sur la péniche du Rhin, ni trop ni trop peu. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 92.","Approche-toi le plus possible de 108."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[92,108]},
 ],crins:46,renom:3},
 {titre:"Les chevaux du Rhin",rappel:true,narr:"Pour haler les péniches, réunis de puissants chevaux de trait rhénans !",activites:[
   {type:'compo',consigne:"Trois chevaux de Travail (les grands trait du Rhin).",slots:[{label:'Cheval de Travail',m:M_TRAIT,buy:['kaltblut','cheval_charbonnier','boulonnais']},{label:'Cheval de Travail',m:M_TRAIT,buy:['cheval_laboureur','ardennais','kaltblut']},{label:'Cheval de Travail',m:M_TRAIT,buy:['cheval_pompier','boulonnais','ardennais']}],puissanceMin:[94,106]},
   {type:'quiz',q:"En allemand, « danke » veut dire… ?",choix:['merci','bonjour','non'],r:'merci'},
 ],crins:40,renom:2},
 {titre:"La cathédrale",rappel:true,narr:"Levons les yeux vers les deux flèches.",activites:[
   {type:'lecture',texte:"La cathédrale de Cologne dresse deux flèches de pierre à plus de 150 mètres de haut. Pendant des siècles, ce fut le plus haut bâtiment du monde ! Des milliers de tailleurs de pierre s'y sont relayés, de génération en génération. Elle a résisté aux bombes de la guerre et se visite encore aujourd'hui.",questions:[
     {q:"À quelle hauteur montent ses flèches ?",choix:['plus de 150 mètres','10 mètres','2 mètres'],r:'plus de 150 mètres'},
     {q:"Qui l'a bâtie ?",choix:['des tailleurs de pierre, sur des siècles','un seul homme en un jour','des robots'],r:'des tailleurs de pierre, sur des siècles'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le carnaval de Cologne",rappel:true,narr:"Cologne fête son grand carnaval ! Ta meilleure équipe pour le défilé.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[106,118]},
 ],crins:62,renom:4},
 {titre:"Willkommen !",narr:"Cologne t'accueille en fête ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_BERLIN={key:"berlin",pays:"Allemagne",drapeau:"🇩🇪",numero:11,boss:true,region:"Berlin",province:"capitale de l'Allemagne",theme:"🏛️ La capitale & le Mur",enjeu:"réunir tout le voyage pour la grande parade",fond:"aventure/fond_berlin.jpg",reveal:"Inge t'emmène devant la porte de Brandebourg : bienvenue à Berlin, la capitale de l'Allemagne !",nom:"Berlin, cœur de l'Allemagne",finText:"Tu es la championne du Rhin ! Le monde continue de s'ouvrir… 🌍",sousEtapes:[
 {titre:"Arrivée à Berlin",narr:"Te voici à Berlin pour l'épreuve suprême ! Découvre la capitale.",activites:[
   {type:'lecture',texte:"Berlin est la capitale de l'Allemagne. Son monument le plus célèbre est la porte de Brandebourg. Il y a moins de cent ans, un grand mur a coupé Berlin en deux, séparant les familles pendant près de trente ans. Puis, un jour de fête, le mur est tombé et la ville a été réunie !",questions:[
     {q:"Quel monument célèbre trouve-t-on à Berlin ?",choix:['la porte de Brandebourg','la tour Eiffel','Big Ben'],r:'la porte de Brandebourg'},
     {q:"Qu'a fait le mur de Berlin ?",choix:['il a coupé la ville en deux','il a protégé un château','rien'],r:'il a coupé la ville en deux'},
   ]},
   {type:'decision',q:"Berlin est la capitale de quel pays ?",choix:['l\'Allemagne','les Pays-Bas','la France'],r:'l\'Allemagne',fait:['berlin_cap','l\'Allemagne']},
   {type:'quiz',q:"En allemand, « ja » veut dire… ?",choix:['oui','non','peut-être'],r:'oui'},
 ],crins:60,renom:3,cartes:["kaltblut","poulain"]},
 {titre:"La carte du voyage",rappel:true,narr:"Ton grand voyage a traversé DEUX pays ! Place chaque lieu dans le bon pays.",activites:[
   {type:'carte',pairs:[["Cologne","Allemagne"],["La Lorelei","Allemagne"],["Forêt-Noire","Allemagne"],["Munich","Allemagne"],["Hambourg","Allemagne"],["Dülmen","Allemagne"],["Amsterdam","Pays-Bas"],["Kinderdijk","Pays-Bas"],["Friesland","Pays-Bas"],["Rotterdam","Pays-Bas"]]},
 ],crins:90,renom:5},
 {titre:"La frise du Mur",rappel:true,narr:"Remets l'histoire du mur de Berlin dans l'ordre.",activites:[
   {type:'ordre',bulle:"L'histoire du Mur 🧱",consigne:"Range du PLUS ANCIEN au PLUS RÉCENT :",elements:["🏙️ Berlin, une seule ville","🧱 le mur coupe la ville en deux","🔨 le mur tombe","🤝 Berlin est réunie"]},
 ],crins:70,renom:4},
 {titre:"Le grand rappel",rappel:true,narr:"Repense à tous tes voyages…",activites:[
   {type:'quiz',q:"Dans quel pays coule le Rhin, avant les Pays-Bas ?",choix:['l\'Allemagne','l\'Espagne','l\'Irlande'],r:'l\'Allemagne'},
   {type:'quiz',q:"Le plus grand cheval du monde, ton ami Big Ben, est un… ?",choix:['Shire','poney Shetland','âne'],r:'Shire'},
   {type:'quiz',q:"Quelle est la capitale de la France ?",choix:['Paris','Londres','Rome'],r:'Paris'},
 ],crins:60,renom:4},
 {titre:"Le gala de Berlin",rappel:true,narr:"Pour le grand gala, présente tes plus belles cartes rares !",activites:[
   {type:'compo',consigne:"Trois chevaux rares (pas de commun !) pour le gala.",slots:[{label:'Cheval rare',m:M_RARE,buy:['cheval_obstacle','kaltblut','cheval_romain']},{label:'Cheval rare',m:M_RARE,buy:['boulonnais','appaloosa','cheval_obstacle']},{label:'Cheval rare',m:M_RARE,buy:['fjord','haflinger','gypsy_cob']}]},
 ],crins:90,renom:5},
 {titre:"La grande parade",rappel:true,narr:"Voici l'épreuve suprême ! Ton équipe la plus puissante défile sous la porte de Brandebourg.",activites:[
   {type:'compo',consigne:"Ton équipe la plus puissante — la grande parade de Berlin !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[118,132]},
 ],crins:170,renom:8},
 {titre:"Championne du Rhin !",narr:"BRAVO ! Toute l'Allemagne et les Pays-Bas t'acclament ! Inge la Frisonne te rejoint : « Big Ben, Pieter-Jan et moi sommes cousins — bienvenue dans la famille ! » 🎆",activites:[{type:'bonus',carteId:'inge'}],crins:340,renom:15},
]};
const ETAPE_LORELEI={key:"lorelei",pays:"Allemagne",drapeau:"🇩🇪",numero:2,region:"La Lorelei",province:"Allemagne",theme:"🧜 La sirène du Rhin",enjeu:"passer le rocher de la Lorelei sans se perdre",fond:"aventure/fond_lorelei.jpg",reveal:"Inge longe le Rhin jusqu'au rocher de la Lorelei, où chantait, dit-on, une sirène…",nom:"La Lorelei, la sirène du Rhin",finText:"Le rocher est passé ! La région suivante t'attend… 🧜",sousEtapes:[
 {titre:"Le rocher de la Lorelei",narr:"Le Rhin se resserre entre les collines. Lis la légende.",activites:[
   {type:'lecture',texte:"À cet endroit, le Rhin se faufile entre de hautes collines couvertes de vignes et de châteaux. Sur un grand rocher, la légende dit qu'une belle sirène, la Lorelei, chantait pour ensorceler les bateliers et les faire couler ! C'est l'un des plus beaux passages du fleuve.",questions:[
     {q:"Que faisait la sirène Lorelei, selon la légende ?",choix:['elle chantait pour ensorceler les bateliers','elle pêchait','elle dormait'],r:'elle chantait pour ensorceler les bateliers'},
     {q:"Qu'y a-t-il sur les collines du Rhin ici ?",choix:['des vignes et des châteaux','des volcans','des déserts'],r:'des vignes et des châteaux'},
   ]},
   {type:'decision',q:"La Lorelei se trouve le long de quel fleuve ?",choix:['le Rhin','la Seine','la Tamise'],r:'le Rhin',fait:['lorelei_rhin','le Rhin']},
   {type:'quiz',q:"On cultive la vigne pour faire… ?",choix:['du raisin (et du jus)','du pain','du fromage'],r:'du raisin (et du jus)'},
 ],crins:50,renom:2,cartes:["cheval_rose","cheval_charbonnier"]},
 {titre:"Le chant ensorcelé",rappel:true,narr:"Pour résister au chant de la sirène, il faut de la magie ! Réunis des chevaux de LÉGENDE.",activites:[
   {type:'compo',consigne:"Trois chevaux de légende ou de magie pour résister au sortilège.",slots:[{label:'Cheval de légende',m:M_LEGENDE,buy:['cheval_rose','licorne_girly','cheval_corail']},{label:'Cheval de légende',m:M_LEGENDE,buy:['cheval_fantome','cheval_nuages','cheval_rose']},{label:'Cheval de légende',m:M_LEGENDE,buy:['cheval_corail','licorne_girly','cheval_fantome']}]},
   {type:'quiz',q:"Une sirène, c'est une créature moitié femme, moitié… ?",choix:['poisson','oiseau','cheval'],r:'poisson'},
 ],crins:44,renom:2},
 {titre:"Le juste courant",rappel:true,narr:"Le courant est fort ici. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 94.","Approche-toi le plus possible de 110."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[94,110]},
 ],crins:46,renom:3},
 {titre:"Les châteaux du Rhin",rappel:true,narr:"Regarde tous ces châteaux sur les hauteurs.",activites:[
   {type:'lecture',texte:"La vallée de la Lorelei compte des dizaines de châteaux perchés sur les collines. Autrefois, leurs seigneurs faisaient payer un péage aux bateaux qui passaient sur le Rhin — un peu comme une barrière de péage sur l'autoroute ! Aujourd'hui, ces châteaux font rêver les touristes du monde entier.",questions:[
     {q:"À quoi servaient ces châteaux ?",choix:['à faire payer un péage aux bateaux','à cultiver des fleurs','à garder des dragons'],r:'à faire payer un péage aux bateaux'},
     {q:"Où sont bâtis les châteaux ?",choix:['sur les collines','sous l\'eau','dans le désert'],r:'sur les collines'},
   ]},
 ],crins:30,renom:2},
 {titre:"L'orthographe du fleuve",rappel:true,narr:"Écris bien ces mots du voyage !",activites:[
   {type:'ortho',indice:"Écris le mot : le grand fleuve que l'on suit 🌊",mot:"rhin"},
   {type:'ortho',indice:"Écris le mot : une créature moitié femme moitié poisson 🧜",mot:"sirene"},
 ],crins:36,renom:2},
 {titre:"Le passage périlleux",rappel:true,narr:"Franchis le passage étroit ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[108,120]},
 ],crins:62,renom:4},
 {titre:"Le rocher est passé !",narr:"Tu as résisté au chant de la Lorelei ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_FORETNOIRE={key:"foretnoire",pays:"Allemagne",drapeau:"🇩🇪",numero:3,region:"Forêt-Noire",province:"Allemagne",theme:"🌲 Contes de Grimm",enjeu:"traverser la forêt des contes sans se perdre",fond:"aventure/fond_foretnoire.jpg",reveal:"Inge s'enfonce dans la Forêt-Noire, terre des coucous et des contes de Grimm.",nom:"La Forêt-Noire",finText:"La forêt t'a livré ses contes ! La région suivante t'attend… 🌲",sousEtapes:[
 {titre:"Dans la Forêt-Noire",narr:"Bienvenue dans la Forêt-Noire ! Lis son histoire.",activites:[
   {type:'lecture',texte:"La Forêt-Noire est une immense forêt de sapins si sombres qu'on la dit « noire ». C'est là que naît le Danube, un autre grand fleuve d'Europe. On y fabrique les fameuses horloges à coucou, et c'est le pays des frères Grimm, qui ont recueilli les contes du Petit Chaperon rouge et de Hansel et Gretel !",questions:[
     {q:"Quel fleuve naît dans la Forêt-Noire ?",choix:['le Danube','la Seine','la Tamise'],r:'le Danube'},
     {q:"Quel objet célèbre y fabrique-t-on ?",choix:['des horloges à coucou','des bateaux','des fusées'],r:'des horloges à coucou'},
   ]},
   {type:'decision',q:"Les frères Grimm ont recueilli des… ?",choix:['contes','recettes','chansons'],r:'contes',fait:['grimm','des contes']},
   {type:'quiz',q:"Pourquoi la forêt est-elle dite « noire » ?",choix:['ses sapins sombres et serrés','elle est peinte','il y fait nuit toute l\'année'],r:'ses sapins sombres et serrés'},
 ],crins:50,renom:2,cartes:["haflinger","fjord"]},
 {titre:"Un conte de Grimm",rappel:true,narr:"Écoute un conte de la forêt, puis réponds.",activites:[
   {type:'lecture',texte:"Dans « Hansel et Gretel », deux enfants perdus dans la forêt sèment des miettes de pain pour retrouver leur chemin — mais les oiseaux les mangent ! Ils tombent alors sur une maison en pain d'épice habitée par une sorcière. Par la ruse, ils s'échappent et rentrent chez eux. Beaucoup de contes de Grimm se passent dans la forêt profonde.",questions:[
     {q:"Que sèment Hansel et Gretel pour retrouver leur chemin ?",choix:['des miettes de pain','des cailloux d\'or','des fleurs'],r:'des miettes de pain'},
     {q:"En quoi est faite la maison de la sorcière ?",choix:['en pain d\'épice','en pierre','en glace'],r:'en pain d\'épice'},
   ]},
 ],crins:44,renom:2},
 {titre:"Le juste chemin",rappel:true,narr:"Ne te perds pas dans la forêt. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 96.","Approche-toi le plus possible de 112."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[96,112]},
 ],crins:46,renom:3},
 {titre:"Les chevaux dorés",rappel:true,narr:"Dans la Forêt-Noire vivent des chevaux à la robe couleur de miel ! Réunis 2 chevaux DORÉS et un au choix.",activites:[
   {type:'compo',consigne:"Deux chevaux à la robe DORÉE (alezan ou isabelle) et un cheval de ton choix.",slots:[{label:'Cheval doré',m:M_DORE,buy:['haflinger','fjord','akhal_teke']},{label:'Cheval doré',m:M_DORE,buy:['fjord','haflinger','akhal_teke']},{label:'Cheval au choix',m:M_TOUS}]},
   {type:'quiz',q:"Une robe « alezan », c'est une robe… ?",choix:['brun-roux (couleur miel)','toute noire','à pois'],r:'brun-roux (couleur miel)'},
 ],crins:40,renom:2},
 {titre:"Le coucou",rappel:true,narr:"Écoute la petite horloge chanter.",activites:[
   {type:'lecture',texte:"L'horloge à coucou est née dans la Forêt-Noire il y a plus de 300 ans. À chaque heure, un petit oiseau de bois sort d'une porte et chante « coucou ! » autant de fois qu'il est d'heures. Les artisans les sculptent encore à la main, avec des toits de chalet, des feuilles et des animaux.",questions:[
     {q:"Que fait le coucou à chaque heure ?",choix:['il sort et chante','il dort','il vole'],r:'il sort et chante'},
     {q:"Comment sont faites ces horloges ?",choix:['sculptées à la main','imprimées','en plastique'],r:'sculptées à la main'},
   ]},
 ],crins:30,renom:2},
 {titre:"La traversée de la forêt",rappel:true,narr:"Sors de la forêt profonde ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[108,122]},
 ],crins:62,renom:4},
 {titre:"Hors de la forêt !",narr:"Tu as traversé la Forêt-Noire ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_MUNICH={key:"munich",pays:"Allemagne",drapeau:"🇩🇪",numero:4,region:"Munich",province:"Allemagne",theme:"🍺 Oktoberfest & Alpes",enjeu:"tirer le grand char de la fête de Munich",fond:"aventure/fond_munich.jpg",reveal:"Inge arrive à Munich, en Bavière, pour la grande fête de l'Oktoberfest, les Alpes en fond !",nom:"Munich et l'Oktoberfest",finText:"Quelle fête ! La région suivante t'attend… 🍺",sousEtapes:[
 {titre:"Arrivée à Munich",narr:"Bienvenue à Munich, en Bavière ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Munich est la grande ville de Bavière, dans le sud de l'Allemagne, tout près des Alpes. Chaque automne s'y tient l'Oktoberfest, la plus grande fête populaire du monde : des millions de visiteurs, des fanfares, et de grands chars tirés par de puissants chevaux ! Au loin, on aperçoit les sommets enneigés des Alpes.",questions:[
     {q:"Comment s'appelle la grande fête de Munich ?",choix:['l\'Oktoberfest','le carnaval','la braderie'],r:'l\'Oktoberfest'},
     {q:"Quelles montagnes voit-on près de Munich ?",choix:['les Alpes','les Pyrénées','l\'Oural'],r:'les Alpes'},
   ]},
   {type:'decision',q:"Munich est la grande ville de quelle région ?",choix:['la Bavière','la Frise','la Forêt-Noire'],r:'la Bavière',fait:['munich_baviere','la Bavière']},
   {type:'quiz',q:"En allemand, « bier » veut dire… ?",choix:['bière','eau','pain'],r:'bière'},
 ],crins:50,renom:2,cartes:["haflinger","cheval_charbonnier"]},
 {titre:"Le grand attelage",rappel:true,narr:"Le char de la fête est énorme : il faut un attelage de CINQ chevaux pour le tirer !",activites:[
   {type:'compo',consigne:"Un grand attelage de CINQ chevaux pour tirer le char de l'Oktoberfest ! (première équipe de 5)",slots:[{label:'Cheval 1',m:M_TOUS,buy:['cheval_charbonnier','boulonnais']},{label:'Cheval 2',m:M_TOUS,buy:['cheval_laboureur','kaltblut']},{label:'Cheval 3',m:M_TOUS,buy:['cheval_pompier','ardennais']},{label:'Cheval 4',m:M_TOUS,buy:['mustang_indien','haflinger']},{label:'Cheval 5',m:M_TOUS,buy:['cheval_diligence','fjord']}],puissanceMin:[150,175]},
 ],crins:48,renom:3},
 {titre:"Le juste remplissage",rappel:true,narr:"Remplis les chopes, ni trop ni trop peu. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 96.","Approche-toi le plus possible de 112."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[96,112]},
 ],crins:46,renom:3},
 {titre:"Les Alpes bavaroises",rappel:true,narr:"Lève les yeux vers les montagnes.",activites:[
   {type:'lecture',texte:"Au sud de Munich se dressent les Alpes, la plus haute chaîne de montagnes d'Europe. Le roi de Bavière y fit construire un château de conte de fées, Neuschwanstein, avec des tours blanches perchées sur un piton rocheux — celui-là même qui a inspiré le château de Walt Disney !",questions:[
     {q:"Quelle chaîne de montagnes borde le sud de la Bavière ?",choix:['les Alpes','les Pyrénées','les Vosges'],r:'les Alpes'},
     {q:"Le château de Neuschwanstein a inspiré…?",choix:['le château de Disney','une gare','un pont'],r:'le château de Disney'},
   ]},
 ],crins:32,renom:2},
 {titre:"Le bretzel géant",rappel:true,narr:"Petite pause gourmande à l'Oktoberfest !",activites:[
   {type:'quiz',q:"L'Oktoberfest est la plus grande fête populaire… ?",choix:['du monde','du village','de l\'école'],r:'du monde'},
   {type:'quiz',q:"Munich est dans le sud de l'Allemagne, tout près des… ?",choix:['Alpes','plages','déserts'],r:'Alpes'},
 ],crins:30,renom:2},
 {titre:"La fanfare",rappel:true,narr:"La fanfare démarre ! Ta meilleure équipe pour ouvrir le défilé.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[110,122]},
 ],crins:62,renom:4},
 {titre:"Prost ! (santé !)",narr:"Le char de l'Oktoberfest fait le tour de la fête ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_HAMBOURG={key:"hambourg",pays:"Allemagne",drapeau:"🇩🇪",numero:5,region:"Hambourg",province:"Allemagne",theme:"⚓ Le grand port",enjeu:"faire tourner le grand port de la mer du Nord",fond:"aventure/fond_hambourg.jpg",reveal:"Inge découvre Hambourg et son immense port, ouvert sur la mer du Nord.",nom:"Hambourg, le grand port",finText:"Le port tourne à plein ! La région suivante t'attend… ⚓",sousEtapes:[
 {titre:"Au port de Hambourg",narr:"Bienvenue à Hambourg, ville-port ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Hambourg possède l'un des plus grands ports d'Europe, relié à la mer du Nord par un fleuve. Jour et nuit, d'immenses bateaux y déchargent des conteneurs venus du monde entier, soulevés par des grues géantes. C'est une ville d'eau, traversée de canaux et de ponts — encore plus qu'à Venise !",questions:[
     {q:"À quelle mer le port de Hambourg est-il relié ?",choix:['la mer du Nord','la Méditerranée','la mer Noire'],r:'la mer du Nord'},
     {q:"Que soulèvent les grues géantes ?",choix:['des conteneurs','des montagnes','des nuages'],r:'des conteneurs'},
   ]},
   {type:'decision',q:"Hambourg est surtout connue pour son… ?",choix:['grand port','volcan','désert'],r:'grand port',fait:['hambourg_port','son grand port']},
   {type:'quiz',q:"En anglais, un bateau se dit… ?",choix:['a ship','a horse','a stone'],r:'a ship'},
 ],crins:50,renom:2,cartes:["cheval_rivieres","cheval_halage"]},
 {titre:"Le trafic du port",rappel:true,narr:"Combien de bateaux arrivent chaque jour ? Lis le graphique !",activites:[
   {type:'graphique',bulle:"Les bateaux du port ⚓",titre:"Bateaux arrivés par jour",labels:['Lun','Mar','Mer','Jeu'],valeurs:[12,18,9,15],q:["Quel jour arrive-t-il le PLUS de bateaux ?","Combien de bateaux en tout sur Mercredi et Jeudi ?"],choix:[['Mardi','Lundi','Jeudi','Mercredi'],['24','9','15','30']],r:['Mardi','24']},
 ],crins:44,renom:2},
 {titre:"Le juste chargement",rappel:true,narr:"Charge le bateau, ni trop ni trop peu. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 98.","Approche-toi le plus possible de 114."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[98,114]},
 ],crins:46,renom:3},
 {titre:"Les chevaux du port",rappel:true,narr:"Pour travailler les pieds dans l'eau, réunis des chevaux de la famille de l'EAU !",activites:[
   {type:'compo',consigne:"Trois chevaux de la famille de l'eau pour le port.",slots:[{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_halage','cheval_rivieres','camargue']},{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_rivieres','cheval_corail','kelpie']},{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_corail','cheval_halage','hippocampe']}]},
   {type:'quiz',q:"Un « conteneur », c'est… ?",choix:['une grande boîte métallique de transport','un poisson','un nuage'],r:'une grande boîte métallique de transport'},
 ],crins:40,renom:2},
 {titre:"La ville d'eau",rappel:true,narr:"Promenons-nous le long des canaux.",activites:[
   {type:'lecture',texte:"Hambourg compte plus de ponts que Venise, Amsterdam et Londres réunies ! Ses vieux entrepôts de briques rouges, bâtis sur l'eau, servaient autrefois à stocker le café, les épices et le thé venus par bateau. Aujourd'hui, on s'y promène en bateau-bus le long des canaux.",questions:[
     {q:"Qu'y avait-il dans les vieux entrepôts ?",choix:['du café, des épices, du thé','des voitures','de la neige'],r:'du café, des épices, du thé'},
     {q:"Hambourg a beaucoup de… ?",choix:['ponts','volcans','déserts'],r:'ponts'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le grand chargement",rappel:true,narr:"Un cargo géant à charger avant la marée ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[110,124]},
 ],crins:62,renom:4},
 {titre:"Bon vent !",narr:"Le port tourne à plein régime ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_DULMEN={key:"dulmen",pays:"Allemagne",drapeau:"🇩🇪",numero:6,region:"Dülmen",province:"Allemagne",theme:"🐎 Les poneys sauvages",enjeu:"veiller sur les derniers chevaux sauvages d'Allemagne",fond:"aventure/fond_dulmen.jpg",reveal:"Inge te présente Klaus, un poney sauvage de Dülmen — les seuls chevaux sauvages d'Allemagne !",nom:"Dülmen, chez Klaus",finText:"Les poneys sauvages sont en sécurité ! La région suivante t'attend… 🐎",sousEtapes:[
 {titre:"Rencontre avec Klaus",narr:"Inge te présente son ami Klaus, un poney Dülmener. Lis son histoire.",activites:[
   {type:'lecture',texte:"À Dülmen vivent les seuls chevaux sauvages d'Allemagne : les poneys Dülmener, comme Klaus ! Ils galopent en liberté dans une grande réserve, cherchent seuls leur nourriture et affrontent l'hiver sans abri. Une fois par an, on rassemble les jeunes mâles lors d'une grande fête très ancienne.",questions:[
     {q:"Qu'ont de spécial les poneys de Dülmen ?",choix:['ce sont les seuls chevaux sauvages d\'Allemagne','ils volent','ils sont géants'],r:'ce sont les seuls chevaux sauvages d\'Allemagne'},
     {q:"Comment vivent-ils ?",choix:['en liberté dans une réserve','en ville','à la mer'],r:'en liberté dans une réserve'},
   ]},
   {type:'decision',q:"Comment s'appelle la race sauvage de Dülmen ?",choix:['le Dülmener','le Frison','le Shire'],r:'le Dülmener',fait:['dulmener','le Dülmener']},
   {type:'quiz',q:"Un animal « sauvage » est un animal qui… ?",choix:['vit libre, sans maître','habite en maison','porte un collier'],r:'vit libre, sans maître'},
 ],crins:50,renom:2,cartes:["dulmener","cheval_fourrure"]},
 {titre:"Le recensement sauvage",rappel:true,narr:"Aide à compter les poneys de la réserve ! Lis le graphique.",activites:[
   {type:'graphique',bulle:"Compte les poneys 🐎",titre:"Poneys par prairie",labels:['Prairie A','Prairie B','Prairie C'],valeurs:[35,50,20],q:["Quelle prairie a le PLUS de poneys ?","Combien de poneys en tout dans les prairies A et C ?"],choix:[['Prairie B','Prairie A','Prairie C','aucune'],['55','35','20','50']],r:['Prairie B','55']},
 ],crins:44,renom:2},
 {titre:"Le juste troupeau",rappel:true,narr:"Un troupeau bien équilibré. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 100.","Approche-toi le plus possible de 116."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[100,116]},
 ],crins:46,renom:3},
 {titre:"Les libres",rappel:true,narr:"Pour guider les poneys sans les effrayer, réunis des chevaux SAUVAGES, comme Klaus !",activites:[
   {type:'compo',consigne:"Trois chevaux de la famille des sauvages.",slots:[{label:'Cheval sauvage',m:M_SAUVAGE,buy:['dulmener','mustang_indien','cheval_fourrure']},{label:'Cheval sauvage',m:M_SAUVAGE,buy:['mustang_indien','zebre','roi_montagnes']},{label:'Cheval sauvage',m:M_SAUVAGE,buy:['cheval_fourrure','fjord','cheval_cowboy']}]},
   {type:'quiz',q:"Comment les poneys sauvages passent-ils l'hiver ?",choix:['dehors, sans abri','au chaud dans une maison','à la plage'],r:'dehors, sans abri'},
 ],crins:40,renom:2},
 {titre:"L'hiver arrive",rappel:true,narr:"Il faut vérifier que tous vont bien avant le froid.",activites:[
   {type:'lecture',texte:"En hiver, les poneys Dülmener laissent pousser un poil long et épais qui les protège du froid et de la pluie, comme un gros manteau. Ils se serrent les uns contre les autres et grattent la neige pour trouver l'herbe. C'est ainsi que les animaux sauvages s'adaptent aux saisons, sans l'aide des hommes.",questions:[
     {q:"Comment les poneys se protègent-ils du froid ?",choix:['un poil long et épais','un pull','un feu de camp'],r:'un poil long et épais'},
     {q:"Comment trouvent-ils l'herbe sous la neige ?",choix:['ils grattent la neige','ils volent','ils attendent le printemps'],r:'ils grattent la neige'},
   ]},
 ],crins:30,renom:2},
 {titre:"La grande fête de Dülmen",rappel:true,narr:"La foule vient voir les poneys sauvages ! Ta meilleure équipe pour veiller sur eux.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[112,124]},
 ],crins:62,renom:4},
 {titre:"Klaus te remercie !",narr:"Les poneys sauvages sont saufs, et Klaus a un nouvel ami : toi ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_AMSTERDAM={key:"amsterdam",pays:"Pays-Bas",drapeau:"🇳🇱",numero:7,region:"Amsterdam",province:"Pays-Bas",theme:"🚲 Canaux & tulipes",enjeu:"pédaler dans la ville sous le niveau de la mer",fond:"aventure/fond_amsterdam.jpg",reveal:"Inge entre aux Pays-Bas, à Amsterdam : canaux, vélos, tulipes… et la ville est sous le niveau de la mer !",nom:"Amsterdam, la ville des canaux",finText:"Goedendag Amsterdam ! La région suivante t'attend… 🚲",sousEtapes:[
 {titre:"Bienvenue aux Pays-Bas",narr:"Nous voici aux Pays-Bas, à Amsterdam ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Amsterdam est la capitale des Pays-Bas, une ville de canaux, de vélos et de maisons étroites et penchées ! Le plus étonnant : une grande partie du pays est SOUS le niveau de la mer — les Néerlandais ont construit des digues pour empêcher l'eau d'entrer. Au printemps, des champs entiers de tulipes colorent le pays. Ici on parle néerlandais : « goedendag » veut dire bonjour.",questions:[
     {q:"Qu'est-ce qui est étonnant aux Pays-Bas ?",choix:['une partie du pays est sous le niveau de la mer','il y a des volcans','c\'est un désert'],r:'une partie du pays est sous le niveau de la mer'},
     {q:"Quelle fleur colore le pays au printemps ?",choix:['la tulipe','le cactus','le palmier'],r:'la tulipe'},
   ]},
   {type:'decision',q:"Amsterdam est la capitale de quel pays ?",choix:['les Pays-Bas','l\'Allemagne','la Belgique'],r:'les Pays-Bas',fait:['amsterdam_nl','les Pays-Bas']},
   {type:'quiz',q:"En néerlandais, « goedendag » veut dire… ?",choix:['bonjour','merci','au revoir'],r:'bonjour'},
   {type:'quiz',q:"En néerlandais, « dank je » veut dire… ?",choix:['merci','bonjour','oui'],r:'merci'},
 ],crins:52,renom:2,cartes:["cheval_cirque","cheval_charbonnier"]},
 {titre:"Sous le niveau de la mer",rappel:true,narr:"Comment vit-on quand la mer est plus HAUTE que la ville ? Regarde le schéma !",activites:[
   {type:'quiz',q:"Aux Pays-Bas, la mer est parfois plus HAUTE que les maisons. Qu'est-ce qui retient l'eau ?",schema:"🌊 mer (haute) | 🧱 digue | 🏠 maisons (basses)",choix:['une digue (un grand mur)','un pont','un bateau'],r:'une digue (un grand mur)'},
   {type:'quiz',q:"Si la digue se brisait, que se passerait-il ?",choix:['l\'eau entrerait dans la ville','rien','il neigerait'],r:'l\'eau entrerait dans la ville'},
 ],crins:44,renom:2},
 {titre:"Le juste équilibre",rappel:true,narr:"Sur le vélo, garde l'équilibre ! Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 100.","Approche-toi le plus possible de 116."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[100,116]},
 ],crins:46,renom:3},
 {titre:"Les rapides du plat pays",rappel:true,narr:"Le pays est tout plat : parfait pour filer vite ! Réunis les chevaux les plus RAPIDES.",activites:[
   {type:'compo',consigne:"Trois chevaux rapides pour filer sur les routes plates.",slots:[{label:'Cheval rapide',m:M_VITESSE,buy:['mustang_indien','cheval_cirque','cheval_obstacle']},{label:'Cheval rapide',m:M_VITESSE,buy:['cheval_obstacle','cheval_desert','cheval_cirque']},{label:'Cheval rapide',m:M_VITESSE,buy:['cheval_cirque','mustang_indien','cheval_cosaque']}]},
   {type:'quiz',q:"En néerlandais, « ja » veut dire… ?",choix:['oui','non','bonjour'],r:'oui'},
 ],crins:40,renom:2},
 {titre:"La ville aux mille vélos",rappel:true,narr:"Regarde tous ces vélos !",activites:[
   {type:'lecture',texte:"Aux Pays-Bas, il y a plus de vélos que d'habitants ! Comme le pays est tout plat, tout le monde pédale : les enfants pour aller à l'école, les parents au travail, parfois même avec un bébé et les courses sur le vélo. Des pistes cyclables sillonnent tout le pays, et les vélos ont souvent la priorité sur les voitures.",questions:[
     {q:"Pourquoi pédale-t-on autant aux Pays-Bas ?",choix:['le pays est tout plat','il fait très chaud','il n\'y a pas de routes'],r:'le pays est tout plat'},
     {q:"Y a-t-il beaucoup de vélos ?",choix:['plus que d\'habitants !','très peu','aucun'],r:'plus que d\'habitants !'},
   ]},
 ],crins:30,renom:2},
 {titre:"La course des canaux",rappel:true,narr:"File le long des canaux avant la fermeture des ponts ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[112,126]},
 ],crins:62,renom:4},
 {titre:"Tot ziens ! (à bientôt !)",narr:"Amsterdam t'a adoptée ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_KINDERDIJK={key:"kinderdijk",pays:"Pays-Bas",drapeau:"🇳🇱",numero:8,region:"Kinderdijk",province:"Pays-Bas",theme:"🌬️ Moulins & polders",enjeu:"faire tourner les moulins pour assécher les polders",fond:"aventure/fond_kinderdijk.jpg",reveal:"Inge t'emmène à Kinderdijk, devant sa rangée de moulins qui assèchent les polders.",nom:"Les moulins de Kinderdijk",finText:"Les polders sont au sec ! La région suivante t'attend… 🌬️",sousEtapes:[
 {titre:"Devant les moulins",narr:"Voici la célèbre rangée de moulins de Kinderdijk. Lis leur secret.",activites:[
   {type:'lecture',texte:"À Kinderdijk s'alignent dix-neuf vieux moulins à vent. Leur travail n'était pas de moudre le grain, mais de POMPER l'eau ! Aux Pays-Bas, on gagne des terres sur la mer et les marais : on entoure une zone d'une digue, puis les moulins pompent l'eau vers l'extérieur jusqu'à ce que le sol soit sec. Cette terre asséchée s'appelle un polder.",questions:[
     {q:"À quoi servaient les moulins de Kinderdijk ?",choix:['à pomper l\'eau','à moudre le grain','à faire de l\'électricité'],r:'à pomper l\'eau'},
     {q:"Comment appelle-t-on une terre asséchée gagnée sur l'eau ?",choix:['un polder','une île','un désert'],r:'un polder'},
   ]},
   {type:'decision',q:"Qu'est-ce qui fait tourner un moulin à vent ?",choix:['le vent','le feu','les chevaux'],r:'le vent',fait:['moulin_vent','le vent']},
   {type:'quiz',q:"En néerlandais, « water » veut dire… ?",choix:['eau','vent','terre'],r:'eau'},
 ],crins:50,renom:2,cartes:["cheval_halage","mustang_indien"]},
 {titre:"Comment le moulin assèche",rappel:true,narr:"Remets dans l'ordre comment on assèche un polder !",activites:[
   {type:'ordre',bulle:"Assécher un polder 🌬️",consigne:"Range les étapes dans l'ordre :",elements:["🧱 on entoure la zone d'une digue","🌬️ le vent fait tourner le moulin","💧 le moulin pompe l'eau dehors","🌷 le sol est sec : un polder !"]},
 ],crins:44,renom:2},
 {titre:"Le juste débit",rappel:true,narr:"Pompe l'eau au bon rythme. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 102.","Approche-toi le plus possible de 118."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[102,118]},
 ],crins:46,renom:3},
 {titre:"Les infatigables",rappel:true,narr:"Assécher un polder, c'est un travail sans fin : réunis les chevaux les plus ENDURANTS !",activites:[
   {type:'compo',consigne:"Trois chevaux endurants pour le long travail des polders.",slots:[{label:'Endurant',m:M_ENDURANCE,buy:['cheval_charbonnier','mustang_indien','roi_montagnes']},{label:'Endurant',m:M_ENDURANCE,buy:['cheval_laboureur','cheval_fourrure','mustang_indien']},{label:'Endurant',m:M_ENDURANCE,buy:['roi_montagnes','ane_egyptien','cheval_romain']}],puissanceMin:[104,118]},
   {type:'quiz',q:"Le vent est une énergie… ?",choix:['gratuite et naturelle','qui pollue beaucoup','en plastique'],r:'gratuite et naturelle'},
 ],crins:40,renom:2},
 {titre:"L'eau et les Pays-Bas",rappel:true,narr:"Un pays en lutte avec l'eau depuis toujours.",activites:[
   {type:'lecture',texte:"« Dieu a créé le monde, mais les Néerlandais ont créé les Pays-Bas », dit un vieux dicton. Depuis des siècles, ils repoussent la mer avec des digues, des moulins et aujourd'hui d'énormes pompes et des barrages. Sans eux, la moitié du pays serait sous l'eau ! C'est un combat de tous les jours contre l'inondation.",questions:[
     {q:"Que serait la moitié des Pays-Bas sans les digues ?",choix:['sous l\'eau','un désert','une forêt'],r:'sous l\'eau'},
     {q:"Contre quoi luttent les Néerlandais ?",choix:['l\'inondation','le désert','le froid'],r:'l\'inondation'},
   ]},
 ],crins:30,renom:2},
 {titre:"La grande tempête",rappel:true,narr:"Une tempête menace les digues ! Ta meilleure équipe pour faire tourner tous les moulins.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[114,126]},
 ],crins:62,renom:4},
 {titre:"Les polders sont sauvés !",narr:"Grâce à toi, les moulins ont tenu bon ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_FRIESLAND={key:"friesland",pays:"Pays-Bas",drapeau:"🇳🇱",numero:9,region:"Friesland",province:"Pays-Bas",theme:"🖤 Chez Inge",enjeu:"réunir la harde des frisons noirs",fond:"aventure/fond_friesland.jpg",reveal:"Inge te ramène CHEZ ELLE, en Frise : les lacs, et les frisons noirs comme elle !",nom:"La Frise, chez Inge",finText:"Quel bonheur pour Inge de rentrer ! Il ne reste plus que Rotterdam… 🖤",sousEtapes:[
 {titre:"Chez Inge, en Frise",narr:"Inge est tout émue : nous voici en Frise, sa terre natale ! Lis son histoire.",activites:[
   {type:'lecture',texte:"La Frise est une région du nord des Pays-Bas, faite de prairies, de lacs et de canaux gelés l'hiver. C'est la patrie du cheval Frison, tout noir et élégant, comme Inge ! Les Frisons ont même leur propre langue, le frison, différente du néerlandais. L'hiver, quand les canaux gèlent, on y fait de grandes courses de patin à glace.",questions:[
     {q:"De quelle couleur est le cheval Frison ?",choix:['tout noir','tout blanc','doré'],r:'tout noir'},
     {q:"Que fait-on en Frise quand les canaux gèlent ?",choix:['des courses de patin à glace','du ski','de la voile'],r:'des courses de patin à glace'},
   ]},
   {type:'decision',q:"La Frise se trouve dans quel pays ?",choix:['les Pays-Bas','l\'Allemagne','l\'Écosse'],r:'les Pays-Bas',fait:['frise_nl','les Pays-Bas']},
   {type:'quiz',q:"Le Frison a même sa propre… ?",choix:['langue','planète','couleur de ciel'],r:'langue'},
 ],crins:52,renom:2,cartes:["frison","cheval_halage"]},
 {titre:"La harde d'Inge",rappel:true,narr:"Pour la grande photo de famille, réunis 2 chevaux NOIRS (comme les frisons) et un au choix !",activites:[
   {type:'compo',consigne:"Deux chevaux de robe NOIRE (comme les frisons) et un cheval de ton choix.",slots:[{label:'Cheval noir',m:M_NOIR,buy:['frison','murgese']},{label:'Cheval noir',m:M_NOIR,buy:['murgese','frison']},{label:'Cheval au choix',m:M_TOUS}]},
   {type:'quiz',q:"Le Frison est surnommé la… ?",choix:['perle noire','étoile filante','boule de neige'],r:'perle noire'},
 ],crins:44,renom:2},
 {titre:"Le juste attelage",rappel:true,narr:"Attelle la calèche frisonne. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 102.","Approche-toi le plus possible de 118."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[102,118]},
 ],crins:46,renom:3},
 {titre:"La danse du Frison",rappel:true,narr:"Le Frison sait « danser » ! Ta meilleure équipe pour le spectacle.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux pour le spectacle.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[110,124]},
 ],crins:48,renom:3},
 {titre:"La grande course de patin",rappel:true,narr:"L'hiver, la Frise gèle. On raconte la course la plus dure du pays.",activites:[
   {type:'lecture',texte:"En Frise, quand tous les canaux gèlent, on organise l'Elfstedentocht : une course de patin à glace de près de 200 km qui relie onze villes ! Elle n'a lieu que très rarement, quand la glace est assez épaisse — parfois pas une seule fois en dix ans. Des milliers de patineurs y participent, emmitouflés dans le froid.",questions:[
     {q:"Combien de villes relie la grande course de patin ?",choix:['onze','deux','cent'],r:'onze'},
     {q:"Pourquoi a-t-elle lieu si rarement ?",choix:['il faut que la glace soit assez épaisse','il faut du soleil','il faut de la pluie'],r:'il faut que la glace soit assez épaisse'},
   ]},
 ],crins:32,renom:2},
 {titre:"La fête frisonne",rappel:true,narr:"Toute la Frise se rassemble ! Ta meilleure équipe pour mener la fête.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[114,128]},
 ],crins:66,renom:5},
 {titre:"Chez soi !",narr:"Inge est la plus heureuse des frisonnes ! On t'offre une belle carte.",activites:[{type:'bonus',rarete:['rare','epique']}],crins:90,renom:5},
]};
const ETAPE_ROTTERDAM={key:"rotterdam",pays:"Pays-Bas",drapeau:"🇳🇱",numero:10,region:"Rotterdam",province:"Pays-Bas",theme:"🌊 Le Rhin atteint la mer",enjeu:"accompagner le Rhin jusqu'à la mer",fond:"aventure/fond_rotterdam.jpg",reveal:"Inge atteint Rotterdam : ici, le Rhin finit son grand voyage et se jette dans la mer !",nom:"Rotterdam, le Rhin et la mer",finText:"Le Rhin a rejoint la mer ! Direction Berlin pour la grande finale… 🌊",sousEtapes:[
 {titre:"Au bout du fleuve",narr:"Nous voici à Rotterdam, là où finit le voyage du Rhin. Lis son histoire.",activites:[
   {type:'lecture',texte:"Rotterdam abrite le plus grand port d'Europe : une forêt de grues et de porte-conteneurs longs comme des rues ! C'est ici, dans un immense delta, que le Rhin — après avoir traversé les Alpes, l'Allemagne et les Pays-Bas — se sépare en plusieurs bras et se jette enfin dans la mer du Nord. Son grand voyage se termine.",questions:[
     {q:"Qu'abrite Rotterdam ?",choix:['le plus grand port d\'Europe','le plus haut sommet','le plus grand désert'],r:'le plus grand port d\'Europe'},
     {q:"Où le Rhin finit-il son voyage ?",choix:['dans la mer du Nord','dans un lac','dans le désert'],r:'dans la mer du Nord'},
   ]},
   {type:'decision',q:"Un fleuve qui se sépare en bras avant la mer forme un… ?",choix:['delta','sommet','volcan'],r:'delta',fait:['delta','un delta']},
   {type:'quiz',q:"Le Rhin a traversé combien de nos pays du voyage ?",choix:['deux (Allemagne, Pays-Bas)','dix','aucun'],r:'deux (Allemagne, Pays-Bas)'},
 ],crins:52,renom:2,cartes:["cheval_rivieres","cheval_halage"]},
 {titre:"Le delta du Rhin",rappel:true,narr:"Le fleuve se divise avant la mer. Remets son parcours final dans l'ordre !",activites:[
   {type:'ordre',bulle:"Le Rhin rejoint la mer 🌊",consigne:"Range la fin du voyage, du fleuve à la mer :",elements:["🏞️ le Rhin, un seul grand fleuve","🌿 il se divise en plusieurs bras (le delta)","🏭 il traverse le grand port","🌊 il se jette dans la mer du Nord"]},
 ],crins:44,renom:2},
 {titre:"Le juste tirant d'eau",rappel:true,narr:"Charge le cargo au bon niveau. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 104.","Approche-toi le plus possible de 120."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[104,120]},
 ],crins:46,renom:3},
 {titre:"Les chevaux du grand port",rappel:true,narr:"Sur les quais du plus grand port d'Europe, réunis des chevaux de l'EAU !",activites:[
   {type:'compo',consigne:"Trois chevaux de la famille de l'eau pour le grand port.",slots:[{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_halage','cheval_rivieres','camargue']},{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_rivieres','kelpie','cheval_corail']},{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_corail','hippocampe','cheval_halage']}]},
   {type:'quiz',q:"Un « delta » ressemble à quelle forme ?",schema:"🏞️→🌿🌿🌿→🌊",choix:['un éventail / une main ouverte','un rond','une ligne droite'],r:'un éventail / une main ouverte'},
 ],crins:40,renom:2},
 {titre:"Le plus grand port",rappel:true,narr:"Découvre l'immensité du port.",activites:[
   {type:'lecture',texte:"Le port de Rotterdam est si grand qu'il faudrait des heures pour le traverser en bateau. Des marchandises du monde entier y arrivent, puis repartent par bateau, par train ou par camion vers toute l'Europe. Beaucoup passent par le Rhin, qui sert d'autoroute d'eau jusqu'au cœur de l'Allemagne et de la Suisse.",questions:[
     {q:"Le Rhin sert d'…",choix:['autoroute d\'eau pour les marchandises','piste d\'atterrissage','patinoire'],r:'autoroute d\'eau pour les marchandises'},
     {q:"D'où viennent les marchandises du port ?",choix:['du monde entier','d\'une seule ville','de nulle part'],r:'du monde entier'},
   ]},
 ],crins:30,renom:2},
 {titre:"L'adieu au Rhin",rappel:true,narr:"Le fleuve rejoint la mer : accompagne-le une dernière fois ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[116,130]},
 ],crins:66,renom:5},
 {titre:"Le Rhin a rejoint la mer !",narr:"Le grand voyage du fleuve est accompli ! Il ne reste que la capitale, Berlin. On t'offre une carte.",activites:[{type:'bonus'}],crins:90,renom:5},
]};
const ETAPE_SEVILLE={key:"seville",pays:"Espagne",drapeau:"🇪🇸",numero:1,region:"Séville",province:"Espagne",theme:"💃 Flamenco & Giralda",enjeu:"ouvrir la grande feria de Séville",fond:"aventure/fond_seville.jpg",reveal:"Rocío t'accueille chez elle, à Séville, en Andalousie, au son du flamenco et devant la Giralda !",nom:"Séville, chez Rocío",finText:"¡Olé ! La région suivante t'attend… 💃",sousEtapes:[
 {titre:"Bienvenue chez Rocío",narr:"Nous voici en Espagne, à Séville, la ville natale de Rocío ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Séville est la grande ville d'Andalousie, dans le sud ensoleillé de l'Espagne. C'est la patrie du flamenco, cette danse au son des guitares et des mains qui claquent, et des fiers chevaux andalous comme Rocío ! On y voit la Giralda, une haute tour, et la Plaza de España aux mille azulejos. Ici on parle espagnol : « hola » veut dire bonjour.",questions:[
     {q:"De quelle danse Séville est-elle la patrie ?",choix:['le flamenco','la valse','le rock'],r:'le flamenco'},
     {q:"Comment dit-on bonjour en espagnol ?",choix:['hola','olá','hallo'],r:'hola'},
   ]},
   {type:'decision',q:"Séville est la grande ville de quelle région ?",choix:['l\'Andalousie','la Bavière','la Frise'],r:'l\'Andalousie',fait:['seville_and','l\'Andalousie']},
   {type:'decision',q:"Pour venir de France en Espagne, quelle chaîne de montagnes a-t-on passée ?",choix:['les Pyrénées','les Alpes','l\'Oural'],r:'les Pyrénées',fait:['pyrenees_es','les Pyrénées']},
   {type:'quiz',q:"De quelle race est Rocío ?",choix:['andalouse','frisonne','shire'],r:'andalouse'},
 ],crins:52,renom:2,cartes:["andalou","cheval_rose"]},
 {titre:"Le compás du flamenco",rappel:true,narr:"Le flamenco a un rythme bien à lui, le « compás ». Remets les temps dans l'ordre !",activites:[
   {type:'ordre',bulle:"Le rythme du flamenco 💃",consigne:"Range la danse dans l'ordre, du début à la fin :",elements:["👏 on frappe dans les mains","🎸 la guitare entre","💃 la danseuse tourne","🌹 le grand final : ¡Olé !"]},
 ],crins:44,renom:2},
 {titre:"Le juste tempo",rappel:true,narr:"Ni trop vite, ni trop lent : trouve le bon tempo. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 94.","Approche-toi le plus possible de 110."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[94,110]},
 ],crins:46,renom:3},
 {titre:"Les danseuses",rappel:true,narr:"Le cheval andalou danse avec grâce ! Réunis les chevaux les plus BEAUX (affinité beauté).",activites:[
   {type:'compo',consigne:"Trois chevaux à l'affinité BEAUTÉ, gracieux comme des danseurs.",slots:[{label:'Cheval gracieux',m:M_BEAUTE,buy:['andalou','cheval_rose','poney_heureux']},{label:'Cheval gracieux',m:M_BEAUTE,buy:['cheval_rose','belle_champs','maman_cheval']},{label:'Cheval gracieux',m:M_BEAUTE,buy:['poney_heureux','cheval_gourmand','andalou']}]},
   {type:'quiz',q:"En espagnol, « gracias » veut dire… ?",choix:['merci','bonjour','oui'],r:'merci'},
 ],crins:40,renom:2},
 {titre:"La Plaza de España",rappel:true,narr:"Promenons-nous sur la grande place.",activites:[
   {type:'lecture',texte:"La Plaza de España de Séville est une immense place en demi-cercle, décorée de milliers d'azulejos, ces carreaux de faïence peints. Chaque province d'Espagne y a son petit tableau de céramique. On s'y promène en barque sur un canal, sous de jolis ponts. C'est l'un des plus beaux endroits de la ville.",questions:[
     {q:"De quoi la Plaza de España est-elle décorée ?",choix:['d\'azulejos (carreaux peints)','de glace','de sable'],r:'d\'azulejos (carreaux peints)'},
     {q:"Comment se promène-t-on sur la place ?",choix:['en barque sur un canal','en avion','en train'],r:'en barque sur un canal'},
   ]},
 ],crins:30,renom:2},
 {titre:"La grande feria",rappel:true,narr:"La feria de Séville commence ! Ta meilleure équipe pour ouvrir le défilé de chevaux.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[106,116]},
 ],crins:62,renom:4},
 {titre:"¡Olé !",narr:"La feria est un triomphe, et Rocío est la plus fière des Andalouses ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_MADRID={key:"madrid",pays:"Espagne",drapeau:"🇪🇸",numero:11,boss:true,region:"Madrid",province:"capitale de l'Espagne",theme:"👑 La capitale royale",enjeu:"réunir toute la péninsule pour la grande parade royale",fond:"aventure/fond_madrid.jpg",reveal:"Rocío t'emmène à la Puerta del Sol : bienvenue à Madrid, la capitale de l'Espagne !",nom:"Madrid, cœur de l'Espagne",finText:"Tu es la championne de la péninsule ! Le monde continue de s'ouvrir… 🌍",sousEtapes:[
 {titre:"Arrivée à Madrid",narr:"Te voici à Madrid pour l'épreuve suprême ! Découvre la capitale.",activites:[
   {type:'lecture',texte:"Madrid est la capitale de l'Espagne, au centre exact du pays. Sur sa place de la Puerta del Sol se trouve le « kilomètre 0 », le point de départ de toutes les routes d'Espagne ! On y visite le Palais royal et le musée du Prado, l'un des plus grands musées de peinture du monde.",questions:[
     {q:"Où se trouve le « kilomètre 0 » des routes d'Espagne ?",choix:['à Madrid (Puerta del Sol)','à Séville','à Lisbonne'],r:'à Madrid (Puerta del Sol)'},
     {q:"Quel grand musée de peinture est à Madrid ?",choix:['le Prado','le Louvre','le Guggenheim'],r:'le Prado'},
   ]},
   {type:'decision',q:"Madrid est la capitale de quel pays ?",choix:['l\'Espagne','le Portugal','la France'],r:'l\'Espagne',fait:['madrid_cap','l\'Espagne']},
   {type:'quiz',q:"En espagnol, « sí » veut dire… ?",choix:['oui','non','merci'],r:'oui'},
 ],crins:60,renom:3,cartes:["andalou","poulain"]},
 {titre:"La carte des 2 pays",rappel:true,narr:"Ton voyage a traversé DEUX pays ! Place chaque lieu dans le bon pays.",activites:[
   {type:'carte',pairs:[["Séville","Espagne"],["Grenade","Espagne"],["Tolède","Espagne"],["Valence","Espagne"],["Barcelone","Espagne"],["Compostelle","Espagne"],["Bilbao","Espagne"],["Porto","Portugal"],["Sintra","Portugal"],["Lisbonne","Portugal"]]},
 ],crins:90,renom:5},
 {titre:"Les grands explorateurs",rappel:true,narr:"Depuis l'Espagne et le Portugal, des marins sont partis explorer le monde. Remets leurs exploits dans l'ordre !",activites:[
   {type:'ordre',bulle:"Les Grandes Découvertes ⛵",consigne:"Range du DÉBUT à la FIN d'un grand voyage de découverte :",elements:["🗺️ on étudie les cartes","⛵ on part sur une caravelle","🌊 on traverse l'océan","🏝️ on découvre une terre nouvelle"]},
 ],crins:70,renom:4},
 {titre:"Le grand rappel",rappel:true,narr:"Repense à tous tes voyages…",activites:[
   {type:'quiz',q:"Quelle chaîne de montagnes sépare la France de l'Espagne ?",choix:['les Pyrénées','les Alpes','les Vosges'],r:'les Pyrénées'},
   {type:'quiz',q:"Les premiers chevaux d'Amérique venaient de… ?",choix:['l\'Espagne (sur les bateaux)','la Lune','l\'Australie'],r:'l\'Espagne (sur les bateaux)'},
   {type:'quiz',q:"Quelle est la capitale de l'Allemagne ?",choix:['Berlin','Paris','Londres'],r:'Berlin'},
 ],crins:60,renom:4},
 {titre:"Le gala royal",rappel:true,narr:"Pour le gala du Palais royal, présente tes plus belles cartes rares !",activites:[
   {type:'compo',consigne:"Trois chevaux rares (pas de commun !) pour le gala royal.",slots:[{label:'Cheval rare',m:M_RARE,buy:['andalou','lusitanien','cheval_romain']},{label:'Cheval rare',m:M_RARE,buy:['arabe','cheval_desert','appaloosa']},{label:'Cheval rare',m:M_RARE,buy:['cheval_obstacle','boulonnais','gypsy_cob']}]},
 ],crins:90,renom:5},
 {titre:"La grande parade royale",rappel:true,narr:"Voici l'épreuve suprême ! Ton équipe la plus puissante défile devant le Palais royal.",activites:[
   {type:'compo',consigne:"Ton équipe la plus puissante — la grande parade de Madrid !",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[120,134]},
 ],crins:180,renom:8},
 {titre:"¡Campeona !",narr:"BRAVO ! Toute l'Espagne et le Portugal t'acclament ! Rocío te rejoint : « Andalou, Lusitanien et les mustangs d'Amérique sont ma famille — bienvenue ! » 🎆",activites:[{type:'bonus',carteId:'rocio'}],crins:360,renom:15},
]};
const ETAPE_GRENADE={key:"grenade",pays:"Espagne",drapeau:"🇪🇸",numero:2,region:"Grenade",province:"Espagne",theme:"🕌 L'Alhambra & les Maures",enjeu:"protéger le palais de l'Alhambra",fond:"aventure/fond_grenade.jpg",reveal:"Rocío t'emmène à Grenade, devant l'Alhambra, le magnifique palais des rois maures.",nom:"Grenade et l'Alhambra",finText:"L'Alhambra est sauvegardée ! La région suivante t'attend… 🕌",sousEtapes:[
 {titre:"Devant l'Alhambra",narr:"Voici l'Alhambra, joyau de Grenade. Lis son histoire.",activites:[
   {type:'lecture',texte:"Pendant près de 800 ans, une grande partie de l'Espagne fut gouvernée par les Maures, des musulmans venus d'Afrique du Nord. On appelait ce pays Al-Andalus. À Grenade, ils bâtirent l'Alhambra, un palais aux cours fraîches où l'eau chante dans les fontaines, couvert de fins motifs de plâtre et d'azulejos. Ce fut leur dernier royaume en Espagne.",questions:[
     {q:"Combien de temps les Maures ont-ils régné sur une partie de l'Espagne ?",choix:['près de 800 ans','un an','un jour'],r:'près de 800 ans'},
     {q:"Comment appelait-on l'Espagne des Maures ?",choix:['Al-Andalus','la Gaule','la Bavière'],r:'Al-Andalus'},
   ]},
   {type:'decision',q:"L'Alhambra est un… ?",choix:['palais','port','volcan'],r:'palais',fait:['alhambra','un palais'] },
   {type:'quiz',q:"Les Maures venaient d'où ?",choix:['d\'Afrique du Nord','du pôle Nord','d\'Amérique'],r:'d\'Afrique du Nord'},
 ],crins:50,renom:2,cartes:["cheval_desert","arabe"]},
 {titre:"Les chevaux mauresques",rappel:true,narr:"Les Maures amenèrent leurs chevaux barbes et arabes ! Réunis 2 chevaux du royaume d'Arabie et un au choix.",activites:[
   {type:'compo',consigne:"Deux chevaux mauresques (royaume d'Arabie) et un cheval de ton choix.",slots:[{label:'Cheval mauresque',m:M_ARABE,buy:['cheval_desert','arabe']},{label:'Cheval mauresque',m:M_ARABE,buy:['arabe','cheval_desert']},{label:'Cheval au choix',m:M_TOUS}]},
   {type:'quiz',q:"Un cheval « barbe » vient de… ?",choix:['l\'Afrique du Nord','la Sibérie','l\'Australie'],r:'l\'Afrique du Nord'},
 ],crins:44,renom:2},
 {titre:"Le juste jardin",rappel:true,narr:"Dessine un jardin bien équilibré. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 96.","Approche-toi le plus possible de 112."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[96,112]},
 ],crins:46,renom:3},
 {titre:"Les fontaines qui chantent",rappel:true,narr:"L'eau est partout dans l'Alhambra.",activites:[
   {type:'lecture',texte:"Les Maures étaient des maîtres de l'eau : venus de régions sèches, ils savaient la transporter, la faire monter, et la faire chanter dans les fontaines pour rafraîchir les palais. À l'Alhambra, de fins canaux mènent l'eau des montagnes jusqu'aux jardins. C'est de l'ingénierie vieille de mille ans !",questions:[
     {q:"En quoi les Maures étaient-ils des maîtres ?",choix:['de l\'eau','du feu','de la glace'],r:'de l\'eau'},
     {q:"D'où vient l'eau de l'Alhambra ?",choix:['des montagnes','de la mer','du désert'],r:'des montagnes'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le grand motif",rappel:true,narr:"Continue le motif mauresque des azulejos !",activites:[
   {type:'quiz',q:"Continue le motif : 🔷⭐🔷⭐🔷⭐ … ?",schema:"🔷⭐ 🔷⭐ 🔷⭐ ❓",choix:['🔷','⭐','⬛','🔴'],r:'🔷'},
   {type:'quiz',q:"Les motifs mauresques sont surtout faits de… ?",choix:['formes géométriques','photos','lettres géantes'],r:'formes géométriques'},
 ],crins:36,renom:2},
 {titre:"La garde du palais",rappel:true,narr:"Le palais a besoin de gardiens ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[108,120]},
 ],crins:62,renom:4},
 {titre:"L'Alhambra veille !",narr:"Le palais des Maures est préservé ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_TOLEDE={key:"tolede",pays:"Espagne",drapeau:"🇪🇸",numero:3,region:"Tolède",province:"Espagne",theme:"⚔️ La ville des 3 cultures",enjeu:"forger la paix entre les trois peuples",fond:"aventure/fond_tolede.jpg",reveal:"Rocío grimpe à Tolède, la vieille ville fortifiée dressée sur sa colline, au-dessus du fleuve Tage.",nom:"Tolède, ville des 3 cultures",finText:"Tolède est en paix ! La région suivante t'attend… ⚔️",sousEtapes:[
 {titre:"Dans Tolède",narr:"Voici Tolède, perchée sur sa colline. Lis son histoire.",activites:[
   {type:'lecture',texte:"Tolède est une vieille ville fortifiée, entourée par le fleuve Tage. Longtemps, trois peuples y ont vécu côte à côte : des chrétiens, des musulmans et des juifs, chacun avec ses églises, ses mosquées et ses synagogues. On l'appelle « la ville des trois cultures ». On y forgeait aussi les meilleures épées d'Europe, l'acier de Tolède !",questions:[
     {q:"Combien de peuples vivaient à Tolède côte à côte ?",choix:['trois','un seul','dix'],r:'trois'},
     {q:"Pour quoi Tolède était-elle célèbre ?",choix:['ses épées (acier de Tolède)','ses glaces','ses bateaux'],r:'ses épées (acier de Tolède)'},
   ]},
   {type:'decision',q:"Quel fleuve entoure Tolède ?",choix:['le Tage','le Rhin','la Tamise'],r:'le Tage',fait:['tolede_tage','le Tage']},
   {type:'quiz',q:"Vivre en paix avec des gens différents, cela s'appelle la… ?",choix:['tolérance','guerre','peur'],r:'tolérance'},
 ],crins:50,renom:2,cartes:["cheval_tournoi","cheval_cosaque"]},
 {titre:"Les trois cultures",rappel:true,narr:"Associe chaque peuple à sa maison de prière.",activites:[
   {type:'quiz',q:"Les chrétiens prient dans une… ?",choix:['église','mosquée','synagogue'],r:'église'},
   {type:'quiz',q:"Les musulmans prient dans une… ?",choix:['mosquée','église','gare'],r:'mosquée'},
   {type:'quiz',q:"Les juifs prient dans une… ?",choix:['synagogue','mosquée','usine'],r:'synagogue'},
 ],crins:44,renom:2},
 {titre:"Le juste tranchant",rappel:true,narr:"Forge une épée bien équilibrée. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 98.","Approche-toi le plus possible de 114."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[98,114]},
 ],crins:46,renom:3},
 {titre:"Les chevaliers de Tolède",rappel:true,narr:"Pour défiler avec les épées de Tolède, réunis des montures de BATAILLE !",activites:[
   {type:'compo',consigne:"Trois chevaux de bataille pour la garde de Tolède.",slots:[{label:'Cheval de bataille',m:M_BATAILLE,buy:['cheval_cosaque','cheval_tournoi','cheval_police']},{label:'Cheval de bataille',m:M_BATAILLE,buy:['cheval_tournoi','cheval_romain','cheval_armure']},{label:'Cheval de bataille',m:M_BATAILLE,buy:['cheval_police','cheval_royal','cheval_cosaque']}]},
   {type:'quiz',q:"L'acier sert à fabriquer des objets… ?",choix:['durs et solides','mous','liquides'],r:'durs et solides'},
 ],crins:40,renom:2},
 {titre:"Le peintre El Greco",rappel:true,narr:"Un célèbre peintre vécut à Tolède.",activites:[
   {type:'lecture',texte:"À Tolède vécut un peintre venu de Grèce, surnommé El Greco (« le Grec »). Il peignait des personnages très allongés, aux couleurs étranges, comme étirés vers le ciel. On ne comprit son génie que bien plus tard. Aujourd'hui, ses tableaux font la fierté de la ville et de toute l'Espagne.",questions:[
     {q:"D'où venait le peintre El Greco ?",choix:['de Grèce','d\'Islande','du Japon'],r:'de Grèce'},
     {q:"Comment peignait-il ses personnages ?",choix:['très allongés','tout ronds','minuscules'],r:'très allongés'},
   ]},
 ],crins:30,renom:2},
 {titre:"La paix de Tolède",rappel:true,narr:"Fais régner la paix entre les trois peuples ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[110,122]},
 ],crins:62,renom:4},
 {titre:"Tolède en paix !",narr:"Les trois cultures vivent en harmonie ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_VALENCE={key:"valence",pays:"Espagne",drapeau:"🇪🇸",numero:4,region:"Valence",province:"Espagne",theme:"🍊 Oranges & Méditerranée",enjeu:"réussir la grande récolte d'oranges",fond:"aventure/fond_valence.jpg",reveal:"Rocío arrive à Valence, au bord de la Méditerranée, entre les orangers et la Cité des Arts et des Sciences.",nom:"Valence et ses oranges",finText:"La récolte est rentrée ! La région suivante t'attend… 🍊",sousEtapes:[
 {titre:"À Valence",narr:"Bienvenue à Valence, sur la côte ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Valence est une ville de la côte méditerranéenne, au climat doux et ensoleillé : parfait pour les orangers, dont les champs parfument tout le pays ! On y a inventé la paella, un grand plat de riz. Chaque printemps, la ville brûle d'immenses statues de carton lors de la fête des Fallas. Et une Cité des Arts et des Sciences ultramoderne s'y dresse comme un vaisseau blanc.",questions:[
     {q:"Quel fruit pousse autour de Valence ?",choix:['l\'orange','la banane','l\'ananas'],r:'l\'orange'},
     {q:"Que brûle-t-on à la fête des Fallas ?",choix:['d\'immenses statues de carton','des livres','des bateaux'],r:'d\'immenses statues de carton'},
   ]},
   {type:'decision',q:"Valence borde quelle mer ?",choix:['la Méditerranée','la mer du Nord','l\'Atlantique'],r:'la Méditerranée',fait:['valence_medit','la Méditerranée']},
   {type:'quiz',q:"Le climat méditerranéen est… ?",choix:['doux et ensoleillé','glacé toute l\'année','pluvieux tous les jours'],r:'doux et ensoleillé'},
 ],crins:50,renom:2,cartes:["haflinger","fjord"]},
 {titre:"La récolte d'oranges",rappel:true,narr:"Combien d'oranges par arbre ? Lis le graphique !",activites:[
   {type:'graphique',bulle:"La récolte d'oranges 🍊",titre:"Oranges récoltées (caisses)",labels:['Verger A','Verger B','Verger C'],valeurs:[30,45,25],q:["Quel verger a donné le PLUS d'oranges ?","Combien de caisses en tout pour A et C ?"],choix:[['Verger B','Verger A','Verger C','aucun'],['55','30','25','45']],r:['Verger B','55']},
 ],crins:44,renom:2},
 {titre:"Le juste panier",rappel:true,narr:"Remplis le panier, ni trop ni trop peu. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 98.","Approche-toi le plus possible de 114."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[98,114]},
 ],crins:46,renom:3},
 {titre:"Les chevaux dorés",rappel:true,narr:"Dorés comme les oranges au soleil ! Réunis 2 chevaux à la robe DORÉE et un au choix.",activites:[
   {type:'compo',consigne:"Deux chevaux à la robe DORÉE (alezan ou isabelle) et un cheval de ton choix.",slots:[{label:'Cheval doré',m:M_DORE,buy:['haflinger','fjord','akhal_teke']},{label:'Cheval doré',m:M_DORE,buy:['fjord','haflinger','akhal_teke']},{label:'Cheval au choix',m:M_TOUS}]},
   {type:'quiz',q:"Pourquoi tant d'orangers à Valence ?",choix:['le climat doux et ensoleillé','il neige beaucoup','le sol est gelé'],r:'le climat doux et ensoleillé'},
 ],crins:40,renom:2},
 {titre:"La Cité des Sciences",rappel:true,narr:"Visitons le grand vaisseau blanc.",activites:[
   {type:'lecture',texte:"La Cité des Arts et des Sciences de Valence ressemble à un décor de film : de grands bâtiments blancs aux formes de coquillage ou d'œil géant, entourés de bassins bleus. On y trouve un aquarium immense, un cinéma en boule et un musée des sciences où l'on touche à tout. L'architecte a imaginé une ville du futur.",questions:[
     {q:"À quoi ressemble la Cité des Sciences ?",choix:['un décor de film futuriste','un château médiéval','une grotte'],r:'un décor de film futuriste'},
     {q:"Qu'y trouve-t-on ?",choix:['un aquarium et un musée des sciences','une ferme','un désert'],r:'un aquarium et un musée des sciences'},
   ]},
 ],crins:30,renom:2},
 {titre:"La grande récolte",rappel:true,narr:"Toute la récolte à rentrer avant la nuit ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[110,122]},
 ],crins:62,renom:4},
 {titre:"Récolte rentrée !",narr:"Les oranges embaument la ville ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_BARCELONE={key:"barcelone",pays:"Espagne",drapeau:"🇪🇸",numero:5,region:"Barcelone",province:"Espagne",theme:"🎨 Gaudí & les mosaïques",enjeu:"achever la mosaïque de Gaudí",fond:"aventure/fond_barcelone.jpg",reveal:"Rocío t'emmène à Barcelone, devant la Sagrada Família, l'incroyable église de l'architecte Gaudí !",nom:"Barcelone et Gaudí",finText:"La mosaïque brille de mille couleurs ! La région suivante t'attend… 🎨",sousEtapes:[
 {titre:"À Barcelone",narr:"Bienvenue à Barcelone ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Barcelone est une grande ville de Catalogne, au bord de la Méditerranée. Un architecte de génie, Antoni Gaudí, y a créé des bâtiments comme sortis d'un rêve : la Sagrada Família, une église hérissée de tours, en chantier depuis plus de 140 ans, et le parc Güell, tout en mosaïques de morceaux de faïence colorés. Rien n'y est droit : tout ondule comme dans la nature !",questions:[
     {q:"Comment s'appelle l'architecte de Barcelone ?",choix:['Gaudí','Monet','Gaudi n\'existe pas'],r:'Gaudí'},
     {q:"Depuis quand la Sagrada Família est-elle en chantier ?",choix:['plus de 140 ans','un mois','mille ans'],r:'plus de 140 ans'},
   ]},
   {type:'decision',q:"Barcelone est la grande ville de quelle région ?",choix:['la Catalogne','l\'Andalousie','la Bavière'],r:'la Catalogne',fait:['barcelone_cat','la Catalogne']},
   {type:'quiz',q:"Une mosaïque est faite de… ?",choix:['petits morceaux colorés assemblés','une seule grande photo','du sable'],r:'petits morceaux colorés assemblés'},
 ],crins:50,renom:2,cartes:["appaloosa","cheval_albinos"]},
 {titre:"La mosaïque de Gaudí",rappel:true,narr:"Compte les morceaux pour finir la mosaïque !",activites:[
   {type:'graphique',bulle:"La mosaïque 🎨",titre:"Morceaux par couleur",labels:['Bleu','Jaune','Rouge','Vert'],valeurs:[20,15,25,10],q:["De quelle couleur y a-t-il le PLUS de morceaux ?","Combien de morceaux bleus et verts en tout ?"],choix:[['Rouge','Bleu','Jaune','Vert'],['30','20','10','25']],r:['Rouge','30']},
 ],crins:44,renom:2},
 {titre:"Le juste assemblage",rappel:true,narr:"Assemble la mosaïque, ni trop ni trop peu. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 100.","Approche-toi le plus possible de 116."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[100,116]},
 ],crins:46,renom:3},
 {titre:"L'équipe arc-en-ciel",rappel:true,narr:"La mosaïque de Gaudí est multicolore ! Réunis 3 chevaux aux robes toutes DIFFÉRENTES (comme le cortège de Mons !).",activites:[
   {type:'compo',robesDistinctes:true,consigne:"Trois chevaux aux robes toutes différentes, pour la mosaïque multicolore.",slots:[{label:'Robe 1',m:M_ROBE,buy:['appaloosa','frison']},{label:'Robe 2',m:M_ROBE,buy:['cheval_albinos','haflinger']},{label:'Robe 3',m:M_ROBE,buy:['gypsy_cob','fjord']}]},
   {type:'quiz',q:"Chez Gaudí, les formes sont surtout… ?",choix:['courbes, comme dans la nature','toutes droites','invisibles'],r:'courbes, comme dans la nature'},
 ],crins:40,renom:2},
 {titre:"Le parc Güell",rappel:true,narr:"Montons au parc coloré.",activites:[
   {type:'lecture',texte:"Le parc Güell domine Barcelone. Gaudí l'a rempli de mosaïques : un grand lézard multicolore à l'entrée, un long banc ondulé couvert de faïence, des colonnes penchées comme des troncs d'arbres. Il récupérait des morceaux de vaisselle cassée pour en faire des œuvres d'art. De là-haut, on voit toute la ville et la mer.",questions:[
     {q:"Que récupérait Gaudí pour ses mosaïques ?",choix:['de la vaisselle cassée','des pièces d\'or','des coquillages'],r:'de la vaisselle cassée'},
     {q:"Qu'y a-t-il à l'entrée du parc Güell ?",choix:['un grand lézard en mosaïque','un dragon vivant','une fusée'],r:'un grand lézard en mosaïque'},
   ]},
 ],crins:30,renom:2},
 {titre:"L'inauguration",rappel:true,narr:"La grande mosaïque est prête à être dévoilée ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[110,124]},
 ],crins:62,renom:4},
 {titre:"Quelle œuvre d'art !",narr:"La mosaïque de Gaudí émerveille tout le monde ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_COMPOSTELLE={key:"compostelle",pays:"Espagne",drapeau:"🇪🇸",numero:6,region:"Compostelle",province:"Espagne",theme:"🐚 Le grand pèlerinage",enjeu:"guider les pèlerins jusqu'à la cathédrale",fond:"aventure/fond_compostelle.jpg",reveal:"Rocío arrive à Saint-Jacques-de-Compostelle, devant sa grande cathédrale baroque, au bout du plus grand chemin de pèlerinage d'Europe.",nom:"Saint-Jacques-de-Compostelle",finText:"Les pèlerins sont arrivés ! La région suivante t'attend… 🐚",sousEtapes:[
 {titre:"Au bout du chemin",narr:"Voici Compostelle, but des pèlerins. Lis son histoire.",activites:[
   {type:'lecture',texte:"Depuis plus de mille ans, des pèlerins marchent des semaines, parfois des mois, pour rejoindre la cathédrale de Saint-Jacques-de-Compostelle, dans le nord-ouest de l'Espagne. Ils suivent un chemin balisé par une coquille, la coquille Saint-Jacques, et par des flèches jaunes. Certains disent même qu'ils suivent la Voie lactée dans le ciel !",questions:[
     {q:"Quel objet balise le chemin des pèlerins ?",choix:['la coquille Saint-Jacques','un ballon','un drapeau rouge'],r:'la coquille Saint-Jacques'},
     {q:"Combien de temps peuvent marcher les pèlerins ?",choix:['des semaines, voire des mois','cinq minutes','une heure'],r:'des semaines, voire des mois'},
   ]},
   {type:'decision',q:"Un pèlerinage, c'est un long voyage… ?",choix:['à pied vers un lieu sacré','en avion','en sous-marin'],r:'à pied vers un lieu sacré',fait:['pelerinage','à pied vers un lieu sacré']},
   {type:'quiz',q:"En espagnol, « camino » veut dire… ?",choix:['chemin','maison','cheval'],r:'chemin'},
 ],crins:50,renom:2,cartes:["cheval_romain","cheval_charbonnier"]},
 {titre:"Le chemin de Compostelle",rappel:true,narr:"Guide les pèlerins ! Remets les étapes du chemin dans l'ordre.",activites:[
   {type:'ordre',bulle:"Le Camino 🐚",consigne:"Range le chemin, du DÉPART à l'ARRIVÉE :",elements:["🎒 on prépare son sac","🥾 on marche des jours","⛰️ on passe les montagnes","⛪ on arrive à la cathédrale"]},
 ],crins:44,renom:2},
 {titre:"Le juste rythme",rappel:true,narr:"Marche à bon rythme sans t'épuiser. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 100.","Approche-toi le plus possible de 116."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[100,116]},
 ],crins:46,renom:3},
 {titre:"Les infatigables",rappel:true,narr:"Le pèlerinage est long : réunis les chevaux les plus ENDURANTS !",activites:[
   {type:'compo',consigne:"Trois chevaux endurants pour le long chemin.",slots:[{label:'Endurant',m:M_ENDURANCE,buy:['cheval_charbonnier','mustang_indien','cheval_romain']},{label:'Endurant',m:M_ENDURANCE,buy:['cheval_laboureur','roi_montagnes','cheval_fourrure']},{label:'Endurant',m:M_ENDURANCE,buy:['mustang_indien','ane_egyptien','cheval_diligence']}]},
   {type:'quiz',q:"Être « endurant », c'est pouvoir… ?",choix:['faire un effort très longtemps','courir 2 secondes','dormir beaucoup'],r:'faire un effort très longtemps'},
 ],crins:40,renom:2},
 {titre:"La coquille",rappel:true,narr:"Chaque pèlerin rapporte une coquille.",activites:[
   {type:'lecture',texte:"La coquille Saint-Jacques est le symbole du pèlerin : on l'accroche à son sac ou à son chapeau. Ses lignes qui se rejoignent en un point rappellent les nombreux chemins d'Europe qui mènent tous à Compostelle. Autrefois, la rapporter chez soi prouvait qu'on avait fait le grand voyage.",questions:[
     {q:"Que prouvait la coquille rapportée ?",choix:['qu\'on avait fait le grand voyage','qu\'on savait nager','qu\'on était riche'],r:'qu\'on avait fait le grand voyage'},
     {q:"Que rappellent les lignes de la coquille ?",choix:['les chemins qui mènent à Compostelle','des vagues','des éclairs'],r:'les chemins qui mènent à Compostelle'},
   ]},
 ],crins:30,renom:2},
 {titre:"L'arrivée à la cathédrale",rappel:true,narr:"Les derniers mètres vers la cathédrale ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[112,124]},
 ],crins:62,renom:4},
 {titre:"¡Arrivés !",narr:"Les pèlerins pleurent de joie devant la cathédrale ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_BILBAO={key:"bilbao",pays:"Espagne",drapeau:"🇪🇸",numero:7,region:"Bilbao",province:"Espagne",theme:"🎨 Pays basque & Pottok",enjeu:"ramener les petits poneys du Pays basque",fond:"aventure/fond_bilbao.jpg",reveal:"Rocío t'emmène à Bilbao, au Pays basque, devant le musée Guggenheim tout brillant.",nom:"Bilbao et le Pays basque",finText:"Les Pottok sont rentrés ! La région suivante t'attend… 🎨",sousEtapes:[
 {titre:"Au Pays basque",narr:"Bienvenue à Bilbao, au Pays basque ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Bilbao est la grande ville du Pays basque, au nord de l'Espagne, contre les Pyrénées. Les Basques parlent une langue très spéciale, le basque (euskara) : elle ne ressemble à AUCUNE autre langue au monde, et serait la plus vieille d'Europe ! Dans leurs montagnes vivent les Pottok, de tout petits poneys sauvages. À Bilbao brille le musée Guggenheim, aux murs d'argent ondulés.",questions:[
     {q:"Qu'a de spécial la langue basque ?",choix:['elle ne ressemble à aucune autre','elle est écrite en chiffres','personne ne la parle'],r:'elle ne ressemble à aucune autre'},
     {q:"Comment sont les poneys Pottok ?",choix:['de tout petits poneys','des géants','des chevaux de course'],r:'de tout petits poneys'},
   ]},
   {type:'decision',q:"Le Pays basque est contre quelle chaîne de montagnes ?",choix:['les Pyrénées','les Alpes','l\'Oural'],r:'les Pyrénées',fait:['basque_pyr','les Pyrénées']},
   {type:'quiz',q:"La langue basque serait la plus… d'Europe ?",choix:['vieille','récente','longue'],r:'vieille'},
 ],crins:50,renom:2,cartes:["poney_shetland","poulain"]},
 {titre:"Un mot de basque",rappel:true,narr:"Découvre cette langue unique !",activites:[
   {type:'quiz',q:"En basque, « kaixo » veut dire bonjour. C'est une langue… ?",choix:['unique, comme aucune autre','pareille au français','faite de chiffres'],r:'unique, comme aucune autre'},
   {type:'quiz',q:"Le musée Guggenheim de Bilbao est couvert de… ?",choix:['plaques brillantes comme de l\'argent','paille','glace'],r:'plaques brillantes comme de l\'argent'},
 ],crins:44,renom:2},
 {titre:"Le juste sentier",rappel:true,narr:"Sur les sentiers étroits, vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 82.","Approche-toi le plus possible de 96."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[82,96]},
 ],crins:46,renom:3},
 {titre:"Les petits Pottok",rappel:true,narr:"Les Pottok sont minuscules ! Pour passer les sentiers de montagne, forme l'équipe la plus LÉGÈRE.",activites:[
   {type:'compo',consigne:"L'équipe la plus LÉGÈRE possible — les petits poneys passent partout !",slots:[{label:'Petit poney',m:M_TOUS,buy:['poney_shetland','poulain']},{label:'Petit poney',m:M_TOUS,buy:['poulain','bebe_poney']},{label:'Petit poney',m:M_TOUS,buy:['bebe_poney','poney_shetland']}],puissanceMax:[78,92]},
   {type:'quiz',q:"Un Pottok, c'est un poney… ?",choix:['tout petit et sauvage','géant','de course'],r:'tout petit et sauvage'},
 ],crins:40,renom:2},
 {titre:"Le Guggenheim",rappel:true,narr:"Visitons le musée brillant.",activites:[
   {type:'lecture',texte:"Le musée Guggenheim de Bilbao ressemble à un immense vaisseau d'argent aux formes tordues, qui brille au bord du fleuve. Devant l'entrée se dresse « Puppy », un chien géant entièrement recouvert de fleurs vivantes ! Ce musée a rendu la ville célèbre dans le monde entier et attire des visiteurs de partout.",questions:[
     {q:"Qu'est-ce que « Puppy » devant le musée ?",choix:['un chien géant couvert de fleurs','une fontaine','un train'],r:'un chien géant couvert de fleurs'},
     {q:"À quoi ressemble le musée ?",choix:['un vaisseau d\'argent aux formes tordues','une pyramide','un château fort'],r:'un vaisseau d\'argent aux formes tordues'},
   ]},
 ],crins:30,renom:2},
 {titre:"Le rassemblement des Pottok",rappel:true,narr:"Ramène tous les petits poneys avant l'orage ! L'équipe la plus légère file devant.",activites:[
   {type:'compo',consigne:"L'équipe la plus légère file la première !",slots:[{label:'Petit poney',m:M_TOUS,buy:['poney_shetland','poulain']},{label:'Petit poney',m:M_TOUS,buy:['poulain','bebe_poney']},{label:'Petit poney',m:M_TOUS,buy:['bebe_poney','poney_shetland']}],puissanceMax:[82,96]},
 ],crins:62,renom:4},
 {titre:"Agur ! (au revoir en basque)",narr:"Les Pottok sont à l'abri ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_PORTO={key:"porto",pays:"Portugal",drapeau:"🇵🇹",numero:8,region:"Porto",province:"Portugal",theme:"🌉 Le Douro & les azulejos",enjeu:"remonter le Douro avec les bateaux de porto",fond:"aventure/fond_porto.jpg",reveal:"Rocío passe la frontière et entre au Portugal, à Porto, devant le pont Dom-Luís et le fleuve Douro !",nom:"Porto, sur le Douro",finText:"Bem-vindo a Portugal ! La région suivante t'attend… 🌉",sousEtapes:[
 {titre:"Bienvenue au Portugal",narr:"Nous passons la frontière : voici le Portugal, à Porto ! Lis son histoire.",activites:[
   {type:'lecture',texte:"Porto est la deuxième ville du Portugal, posée sur le fleuve Douro, qu'enjambe le grand pont de fer Dom-Luís. Ses maisons se couvrent d'azulejos, ces carreaux bleus qui racontent des histoires. Sur le fleuve glissent de vieux bateaux de bois qui transportaient le vin de Porto. Ici on parle portugais : « olá » veut dire bonjour.",questions:[
     {q:"Sur quel fleuve se trouve Porto ?",choix:['le Douro','le Rhin','le Tage'],r:'le Douro'},
     {q:"Comment dit-on bonjour en portugais ?",choix:['olá','hola','hallo'],r:'olá'},
   ]},
   {type:'decision',q:"Porto se trouve dans quel pays ?",choix:['le Portugal','l\'Espagne','la France'],r:'le Portugal',fait:['porto_pt','le Portugal']},
   {type:'quiz',q:"Les azulejos sont des carreaux de quelle couleur surtout ?",choix:['bleus','rouges','verts'],r:'bleus'},
 ],crins:52,renom:2,cartes:["cheval_rivieres","cheval_halage"]},
 {titre:"Un mot de portugais",rappel:true,narr:"Apprends la langue du pays !",activites:[
   {type:'quiz',q:"En portugais, « obrigado » veut dire… ?",choix:['merci','bonjour','au revoir'],r:'merci'},
   {type:'quiz',q:"En portugais, « sim » veut dire… ?",choix:['oui','non','peut-être'],r:'oui'},
 ],crins:44,renom:2},
 {titre:"Le juste chargement",rappel:true,narr:"Charge le bateau de porto. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 102.","Approche-toi le plus possible de 118."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[102,118]},
 ],crins:46,renom:3},
 {titre:"Les bateaux du Douro",rappel:true,narr:"Pour remonter le fleuve, réunis des chevaux de la famille de l'EAU !",activites:[
   {type:'compo',consigne:"Trois chevaux de la famille de l'eau pour le Douro.",slots:[{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_halage','cheval_rivieres','camargue']},{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_rivieres','cheval_corail','kelpie']},{label:'Cheval d\'eau',m:M_EAU,buy:['cheval_corail','hippocampe','cheval_halage']}]},
   {type:'quiz',q:"Le Douro est un… ?",choix:['fleuve','océan','lac de montagne'],r:'fleuve'},
 ],crins:40,renom:2},
 {titre:"Les azulejos",rappel:true,narr:"Regarde les murs couverts de carreaux bleus.",activites:[
   {type:'lecture',texte:"Au Portugal, on couvre les murs, les églises et même les gares d'azulejos : des carreaux de faïence, le plus souvent bleus et blancs, qui forment de grandes fresques. Ils racontent des batailles, des bateaux, des scènes de la vie. C'est à la fois joli et utile : les carreaux protègent les murs de la pluie et gardent les maisons fraîches.",questions:[
     {q:"À quoi servent aussi les azulejos ?",choix:['protéger les murs et rafraîchir','faire du bruit','éclairer la nuit'],r:'protéger les murs et rafraîchir'},
     {q:"De quelles couleurs sont-ils surtout ?",choix:['bleus et blancs','noirs','dorés'],r:'bleus et blancs'},
   ]},
 ],crins:30,renom:2},
 {titre:"La remontée du fleuve",rappel:true,narr:"Remonte le Douro jusqu'aux vignes ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[114,126]},
 ],crins:62,renom:4},
 {titre:"Obrigado, Porto !",narr:"Les bateaux ont remonté le Douro ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_SINTRA={key:"sintra",pays:"Portugal",drapeau:"🇵🇹",numero:9,region:"Sintra",province:"Portugal",theme:"🏰 Le palais de conte de fées",enjeu:"réveiller la magie du palais de Pena",fond:"aventure/fond_sintra.jpg",reveal:"Rocío grimpe à Sintra, dans les collines boisées, devant le palais de Pena, tout coloré comme un jouet.",nom:"Sintra et le palais de Pena",finText:"Le palais scintille ! La dernière région t'attend… 🏰",sousEtapes:[
 {titre:"Dans les collines de Sintra",narr:"Voici Sintra, ville de palais. Lis son histoire.",activites:[
   {type:'lecture',texte:"Sintra se cache dans des collines vertes et brumeuses, près de Lisbonne. Un roi y fit peindre un palais, le palais de Pena, en rouge vif et jaune soleil, avec des tours et des tourelles comme un château de dessin animé ! Tout autour, des jardins pleins de fougères géantes, de grottes et de passages secrets. On dirait un décor de conte de fées.",questions:[
     {q:"De quelles couleurs est peint le palais de Pena ?",choix:['rouge et jaune','tout gris','noir'],r:'rouge et jaune'},
     {q:"À quoi ressemble Sintra ?",choix:['un décor de conte de fées','un désert','une usine'],r:'un décor de conte de fées'},
   ]},
   {type:'decision',q:"Sintra se trouve dans quel pays ?",choix:['le Portugal','l\'Espagne','l\'Italie'],r:'le Portugal',fait:['sintra_pt','le Portugal']},
   {type:'quiz',q:"En portugais, « castelo » veut dire… ?",choix:['château','cheval','mer'],r:'château'},
 ],crins:50,renom:2,cartes:["cheval_rose","cheval_fantome"]},
 {titre:"La magie du palais",rappel:true,narr:"Pour réveiller la magie du palais, réunis des chevaux de LÉGENDE !",activites:[
   {type:'compo',consigne:"Trois chevaux de légende ou de magie pour le palais enchanté.",slots:[{label:'Cheval de légende',m:M_LEGENDE,buy:['cheval_rose','licorne_girly','cheval_fantome']},{label:'Cheval de légende',m:M_LEGENDE,buy:['cheval_fantome','cheval_corail','cheval_rose']},{label:'Cheval de légende',m:M_LEGENDE,buy:['licorne_girly','cheval_nuages','cheval_fantome']}]},
   {type:'quiz',q:"Un palais « enchanté », c'est un palais… ?",choix:['plein de magie','en carton','sans porte'],r:'plein de magie'},
 ],crins:44,renom:2},
 {titre:"Le juste sortilège",rappel:true,narr:"Dose bien la magie. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 102.","Approche-toi le plus possible de 118."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[102,118]},
 ],crins:46,renom:3},
 {titre:"Le château des Maures",rappel:true,narr:"Grimpe au vieux château.",activites:[
   {type:'lecture',texte:"Au-dessus de Sintra se dressent les ruines d'un vieux château bâti par les Maures, il y a plus de mille ans. Ses remparts serpentent sur la crête comme une muraille de Chine miniature. De là-haut, par temps clair, on voit jusqu'à l'océan Atlantique. Sintra mêle ainsi les palais des rois et les forteresses des Maures.",questions:[
     {q:"Qui a bâti le vieux château au-dessus de Sintra ?",choix:['les Maures','les Vikings','les Romains'],r:'les Maures'},
     {q:"Que voit-on de là-haut par temps clair ?",choix:['l\'océan Atlantique','le désert','la banquise'],r:'l\'océan Atlantique'},
   ]},
 ],crins:30,renom:2},
 {titre:"Les jardins secrets",rappel:true,narr:"Explore les jardins mystérieux de Sintra.",activites:[
   {type:'quiz',q:"Dans les jardins de Sintra, on trouve des passages… ?",choix:['secrets et des grottes','de sable','de glace'],r:'secrets et des grottes'},
   {type:'quiz',q:"En portugais, « obrigado » veut dire… ?",choix:['merci','bonjour','non'],r:'merci'},
 ],crins:30,renom:2},
 {titre:"Le juste équilibre",rappel:true,narr:"Le grand bal du palais ! Ta meilleure équipe.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[114,128]},
 ],crins:62,renom:4},
 {titre:"Le palais enchanté !",narr:"Le palais de Pena brille de magie ! On t'offre une carte.",activites:[{type:'bonus'}],crins:74,renom:3},
]};
const ETAPE_LISBONNE={key:"lisbonne",pays:"Portugal",drapeau:"🇵🇹",numero:10,region:"Lisbonne",province:"Portugal",theme:"⛵ Les Grandes Découvertes",enjeu:"préparer le grand départ des explorateurs",fond:"aventure/fond_lisbonne.jpg",reveal:"Rocío atteint Lisbonne, la capitale du Portugal : ses tramways jaunes et la tour de Belém, d'où partirent les grands explorateurs sur l'océan !",nom:"Lisbonne, ville des explorateurs",finText:"Les caravelles sont prêtes ! Direction Madrid pour la grande finale… ⛵",sousEtapes:[
 {titre:"À Lisbonne",narr:"Voici Lisbonne, ville des navigateurs. Lis son histoire.",activites:[
   {type:'lecture',texte:"Lisbonne est la capitale du Portugal, au bord de l'océan Atlantique. Il y a environ 500 ans, c'est d'ici que partirent les grands explorateurs sur leurs caravelles, de petits bateaux à voiles, pour découvrir des routes vers l'Afrique, l'Inde et l'Amérique. On visite la tour de Belém, qui gardait le port, et on grimpe la ville dans de vieux tramways jaunes.",questions:[
     {q:"Sur quels bateaux partaient les explorateurs ?",choix:['des caravelles','des sous-marins','des radeaux'],r:'des caravelles'},
     {q:"De quelle couleur sont les vieux tramways de Lisbonne ?",choix:['jaunes','noirs','roses'],r:'jaunes'},
   ]},
   {type:'decision',q:"Lisbonne est la capitale de quel pays ?",choix:['le Portugal','l\'Espagne','la France'],r:'le Portugal',fait:['lisbonne_cap','le Portugal']},
   {type:'decision',q:"Quel océan borde Lisbonne ?",choix:['l\'Atlantique','la Méditerranée','la mer du Nord'],r:'l\'Atlantique',fait:['lisbonne_ocean','l\'Atlantique']},
 ],crins:52,renom:2,cartes:["lusitanien","mustang_indien"]},
 {titre:"Le voyage de l'explorateur",rappel:true,narr:"Prépare une grande expédition ! Remets les étapes dans l'ordre.",activites:[
   {type:'ordre',bulle:"Une Grande Découverte ⛵",consigne:"Range le grand voyage, du DÉBUT à la FIN :",elements:["🗺️ on étudie les cartes","⛵ on charge la caravelle","🌊 on traverse l'océan","🏝️ on découvre une terre nouvelle"]},
 ],crins:44,renom:2},
 {titre:"Le juste cap",rappel:true,narr:"Garde le bon cap sur l'océan. Vise juste !",activites:[
   {type:'compo',consigne:["Approche-toi le plus possible de 104.","Approche-toi le plus possible de 120."],slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],cible:[104,120]},
 ],crins:46,renom:3},
 {titre:"Les caravelles rapides",rappel:true,narr:"Pour filer sur l'océan avant les tempêtes, réunis les chevaux les plus RAPIDES !",activites:[
   {type:'compo',consigne:"Trois chevaux rapides comme les caravelles.",slots:[{label:'Cheval rapide',m:M_VITESSE,buy:['mustang_indien','cheval_cirque','cheval_obstacle']},{label:'Cheval rapide',m:M_VITESSE,buy:['cheval_obstacle','cheval_desert','cheval_cirque']},{label:'Cheval rapide',m:M_VITESSE,buy:['cheval_cirque','mustang_indien','cheval_cosaque']}]},
   {type:'quiz',q:"Une caravelle avançait grâce… ?",choix:['au vent dans ses voiles','à un moteur','à des rames seulement'],r:'au vent dans ses voiles'},
 ],crins:40,renom:2},
 {titre:"Vasco de Gama",rappel:true,narr:"Le plus célèbre navigateur portugais.",activites:[
   {type:'lecture',texte:"Le navigateur portugais Vasco de Gama fut le premier à rejoindre l'Inde par la mer, en contournant toute l'Afrique — un voyage de plusieurs mois, plein de tempêtes et de dangers ! Grâce à ces explorateurs, on a dessiné les vraies cartes du monde. C'est l'époque qu'on appelle les Grandes Découvertes.",questions:[
     {q:"Qu'a réussi Vasco de Gama ?",choix:['rejoindre l\'Inde par la mer','voler jusqu\'à la Lune','traverser à la nage'],r:'rejoindre l\'Inde par la mer'},
     {q:"Comment appelle-t-on cette époque ?",choix:['les Grandes Découvertes','la préhistoire','le Moyen Âge'],r:'les Grandes Découvertes'},
   ]},
 ],crins:32,renom:2},
 {titre:"Le grand départ",rappel:true,narr:"Les caravelles lèvent l'ancre ! Ta meilleure équipe pour le grand départ.",activites:[
   {type:'compo',consigne:"Ta meilleure équipe de 3 chevaux.",slots:[{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS},{label:'Cheval',m:M_TOUS}],puissanceMin:[116,130]},
 ],crins:66,renom:5},
 {titre:"Bon voyage !",narr:"Les explorateurs partent à la découverte du monde ! Il ne reste que Madrid. On t'offre une carte.",activites:[{type:'bonus'}],crins:90,renom:5},
]};
const ETAPES_ES={seville:ETAPE_SEVILLE,grenade:ETAPE_GRENADE,tolede:ETAPE_TOLEDE,valence:ETAPE_VALENCE,barcelone:ETAPE_BARCELONE,compostelle:ETAPE_COMPOSTELLE,bilbao:ETAPE_BILBAO,porto:ETAPE_PORTO,sintra:ETAPE_SINTRA,lisbonne:ETAPE_LISBONNE,madrid:ETAPE_MADRID};
const ETAPES_DE={cologne:ETAPE_COLOGNE,lorelei:ETAPE_LORELEI,foretnoire:ETAPE_FORETNOIRE,munich:ETAPE_MUNICH,hambourg:ETAPE_HAMBOURG,dulmen:ETAPE_DULMEN,amsterdam:ETAPE_AMSTERDAM,kinderdijk:ETAPE_KINDERDIJK,friesland:ETAPE_FRIESLAND,rotterdam:ETAPE_ROTTERDAM,berlin:ETAPE_BERLIN};
const ETAPES_GB={douvres:ETAPE_DOUVRES,stonehenge:ETAPE_STONEHENGE,dartmoor:ETAPE_DARTMOOR,snowdonia:ETAPE_SNOWDONIA,newmarket:ETAPE_NEWMARKET,york:ETAPE_YORK,edimbourg:ETAPE_EDIMBOURG,lochness:ETAPE_LOCHNESS,shetland:ETAPE_SHETLAND,connemara:ETAPE_CONNEMARA,londres:ETAPE_LONDRES};
const ETAPES_FR={lille:ETAPE_LILLE,rouen:ETAPE_ROUEN,montsaintmichel:ETAPE_MSM,broceliande:ETAPE_BROCELIANDE,pilat:ETAPE_PILAT,pau:ETAPE_PAU,camargue:ETAPE_CAMARGUE,chamonix:ETAPE_CHAMONIX,lyon:ETAPE_LYON,strasbourg:ETAPE_STRASBOURG,paris:ETAPE_PARIS};
const ETAP_ALL=Object.assign({},ETAPES_BE,ETAPES_FR,ETAPES_GB,ETAPES_DE,ETAPES_ES);
const MONDES={belgique:{cle:'belgique',etapes:ETAPES_BE,pins:'#be-pins .etape',bossSel:'#svg-belgique .drapeau.boss'},france:{cle:'france',etapes:ETAPES_FR,pins:'#fr-pins .etape',bossSel:'#svg-france .drapeau.boss'},iles:{cle:'iles',etapes:ETAPES_GB,pins:'#gb-pins .etape',bossSel:'#svg-iles .drapeau.boss'},rhin:{cle:'rhin',etapes:ETAPES_DE,pins:'#de-pins .etape',bossSel:'#svg-rhin .drapeau.boss'},iberie:{cle:'iberie',etapes:ETAPES_ES,pins:'#es-pins .etape',bossSel:'#svg-iberie .drapeau.boss'}};
const PRIX_ACHAT={commune:200,rare:450,epique:900,legendaire:2200,mythique:6000};
