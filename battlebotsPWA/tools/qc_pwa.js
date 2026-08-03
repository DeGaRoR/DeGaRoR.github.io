// tools/qc_pwa.js — cohérence de l'emballage PWA (fichiers, SW, manifest).
const fs = require("fs");
const path = require("path");
const { check, safe, report } = require("./check.js");
const DIR = path.join(__dirname, "..");   // l'app vit à la racine de battlebotsPWA

safe("emballage", () => {
  const files = fs.readdirSync(DIR);
  for (const f of ["index.html","styles.css","data.js","engine.js","app.js",
                   "sw.js","manifest.webmanifest","favicon.ico"])
    check("présent : " + f, files.includes(f));

  const idx = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  check("index charge data → engine → app dans l'ordre",
        idx.indexOf('src="data.js"') > 0 &&
        idx.indexOf('src="data.js"') < idx.indexOf('src="engine.js"') &&
        idx.indexOf('src="engine.js"') < idx.indexOf('src="app.js"'));
  check("enregistrement SW gardé (http seulement)",
        idx.includes("serviceWorker") && idx.includes("location.protocol"));

  const sw = fs.readFileSync(path.join(DIR, "sw.js"), "utf8");
  const arr = sw.match(/const ASSETS = \[([^\]]+)\]/);
  const assets = [...(arr ? arr[1] : "").matchAll(/"([^"]+)"/g)].map(m => m[1])
    .filter(a => a !== "./");
  const missing = assets.filter(a => !fs.existsSync(path.join(DIR, a)));
  check("precache du SW ⊆ fichiers réels", missing.length === 0, missing.join(",") || "—");
  check("nom de cache versionné", /roboclash-v\d+/.test(sw));

  for (const f of ["data.js","app.js","engine.js"])
    check("zéro base64 embarqué dans " + f,
          !fs.readFileSync(path.join(DIR, f), "utf8").includes("data:image"));
  const walk = (d) => fs.readdirSync(path.join(DIR, d), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(d + "/" + e.name) : [d + "/" + e.name]);
  const real = walk("assets");
  const cached = new Set(assets.filter(a => a.startsWith("assets/")));
  const uncached = real.filter(f => !cached.has(f));
  check("assets/ peuplé et précaché en totalité (récursif)",
        real.length >= 30 && uncached.length === 0 && cached.size === real.length,
        uncached.join(",") || real.length + " fichiers");

  const man = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.webmanifest"), "utf8"));
  check("manifest valide (name, start_url, icônes)",
        !!man.name && !!man.start_url && Array.isArray(man.icons) && man.icons.length > 0);

  /* Contrat d'icônes — écrit après l'incident « petite icône dégueu » : le test
     précédent se contentait d'exiger la présence d'un icon.svg. Une icône PWA
     correcte suppose du PNG (compatibilité universelle), les deux tailles
     canoniques, une variante MASKABLE (sans elle Android rétrécit l'icône dans
     une pastille blanche), et zéro fichier fantôme. */
  const iconSrc = man.icons.map(i => i.src);
  check("icônes : toutes présentes sur le disque",
        iconSrc.every(s => fs.existsSync(path.join(DIR, s))),
        iconSrc.filter(s => !fs.existsSync(path.join(DIR, s))).join(",") || "—");
  check("icônes : toutes en PNG (compatibilité)",
        man.icons.every(i => i.type === "image/png" && /\.png$/.test(i.src)));
  check("icônes : 192 et 512 déclarées",
        ["192x192","512x512"].every(sz => man.icons.some(i => i.sizes === sz && i.purpose !== "maskable")));
  check("icônes : variante maskable 192 ET 512 (sinon Android rétrécit)",
        ["192x192","512x512"].every(sz => man.icons.some(i => i.sizes === sz && i.purpose === "maskable")));
  /* Décision produit : les maskable sont PLEIN CADRE, rigoureusement identiques
     aux icônes normales — aucun rembourrage, aucune bande. Vérifié à l'octet. */
  check("icônes : maskable strictement identiques aux normales (plein cadre)",
        [192,512].every(sz => {
          const a = fs.readFileSync(path.join(DIR, `assets/icons/icon-${sz}.png`));
          const b = fs.readFileSync(path.join(DIR, `assets/icons/maskable-${sz}.png`));
          return a.equals(b);
        }));
  check("icônes : sizes cohérent avec le fichier réel",
        man.icons.every(i => {
          const buf = fs.readFileSync(path.join(DIR, i.src));
          const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);   // en-tête IHDR du PNG
          return i.sizes === w + "x" + h;
        }));
  check("icônes : toutes précachées par le SW",
        iconSrc.every(s => assets.includes(s)) && assets.includes("favicon.ico"),
        iconSrc.filter(s => !assets.includes(s)).join(",") || "—");
  check("aucun vestige de l'ancienne icône (icon.svg)",
        !fs.existsSync(path.join(DIR, "icon.svg")) && !sw.includes("icon.svg") && !idx.includes("icon.svg"));
  check("index : favicon, apple-touch-icon et theme-color déclarés",
        idx.includes('rel="icon"') && idx.includes('rel="apple-touch-icon"') && idx.includes('name="theme-color"'));
  check("manifest : couleurs alignées sur la DA",
        man.background_color === "#120a12" && man.theme_color === "#0e070c",
        man.background_color + " / " + man.theme_color);
});
report("QC PWA");
