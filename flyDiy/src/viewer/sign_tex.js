// GENERATED FILE - DO NOT EDIT. Built by tools/sign_prep.js from
// assets/billboards/out/ (the user's own painted signs; see CREDITS.md). The
// files live under media/tex/signs/ (hash-in-filename); loading starts at
// script eval and every consumer waits on img.complete/onload.
//
// THE BILLBOARDS (G313): each sign with its aspect (width over height) - the
// sign slot sizes its board by width and takes the height from here.
const SIGN_TEX_SETS = (typeof Image !== 'undefined') ? (() => {
  const B = (typeof FLYDIY_ASSET_BASE !== 'undefined') ? FLYDIY_ASSET_BASE : '';
  // A SET LOADS WHEN IT IS READ (LOADING S4.1): the maps are getters, the
  // Image made on first access (one per url); nothing here fetches at script eval
  const IM = {};
  const mk = src => IM[src] || (IM[src] = (() => { const i = new Image(); i.src = B + src; return i; })());
  return {
    air_taxi: { name: 'Admiralty Air Taxi', kind: 'roadside', aspect: 2.772, px: [693, 250], get img() { return mk('media/tex/signs/air_taxi_1k.e6d423e9.png'); } },
    harbor_fuel: { name: 'Harbor Fuel & Bait', kind: 'harbour', aspect: 2.940, px: [682, 232], get img() { return mk('media/tex/signs/harbor_fuel_1k.e72abc46.png'); } },
    general_store: { name: 'Kootz Landing General Store', kind: 'store', aspect: 2.897, px: [678, 234], get img() { return mk('media/tex/signs/general_store_1k.a55420f7.png'); } },
    tidal_cup: { name: 'Tidal Cup Cafe', kind: 'store', aspect: 3.071, px: [688, 224], get img() { return mk('media/tex/signs/tidal_cup_1k.00faf619.png'); } },
    bear_tours: { name: 'Bear Coast Tours', kind: 'roadside', aspect: 2.230, px: [660, 296], get img() { return mk('media/tex/signs/bear_tours_1k.89a22627.png'); } },
    sitka_lumber: { name: 'Sitka Spruce Lumber', kind: 'industrial', aspect: 3.004, px: [682, 227], get img() { return mk('media/tex/signs/sitka_lumber_1k.6d38fe1b.png'); } },
    north_motel: { name: 'North Channel Motel', kind: 'roadside', aspect: 2.917, px: [668, 229], get img() { return mk('media/tex/signs/north_motel_1k.9d86db3a.png'); } },
    tongass_marine: { name: 'Tongass Marine Supply', kind: 'harbour', aspect: 3.027, px: [675, 223], get img() { return mk('media/tex/signs/tongass_marine_1k.eb57d574.png'); } },
    admiralty_police: { name: 'Admiralty Police', kind: 'civic', role: 'police', aspect: 2.145, px: [665, 310], get img() { return mk('media/tex/signs/admiralty_police_1k.ba6e1e17.png'); } },
    island_clinic: { name: 'Island Clinic', kind: 'civic', role: 'clinic', aspect: 2.496, px: [664, 266], get img() { return mk('media/tex/signs/island_clinic_1k.8796209e.png'); } },
    town_hall: { name: 'Town Hall', kind: 'civic', role: 'town hall', aspect: 2.645, px: [677, 256], get img() { return mk('media/tex/signs/town_hall_1k.a68849c0.png'); } },
    fire_brigade: { name: 'Fire Brigade', kind: 'civic', role: 'fire hall', aspect: 3.294, px: [672, 204], get img() { return mk('media/tex/signs/fire_brigade_1k.2ef9803d.png'); } },
    kootz_school: { name: 'Kootz Landing School', kind: 'civic', role: 'school', aspect: 2.142, px: [664, 310], get img() { return mk('media/tex/signs/kootz_school_1k.82d079fd.png'); } },
    postal_service: { name: 'Postal Service', kind: 'civic', role: 'post office', aspect: 3.702, px: [707, 191], get img() { return mk('media/tex/signs/postal_service_1k.a8f1c88e.png'); } },
    community_church: { name: 'Community Church', kind: 'civic', role: 'church', aspect: 2.176, px: [631, 290], get img() { return mk('media/tex/signs/community_church_1k.b5cfd90f.png'); } },
    veterinary_care: { name: 'Veterinary Care', kind: 'civic', role: 'vet', aspect: 3.423, px: [688, 201], get img() { return mk('media/tex/signs/veterinary_care_1k.11f29877.png'); } },
  };
})() : null;
// the same table headless, for the gates: keys, names, kinds, aspects
const SIGN_TEX_META = {"air_taxi":{"name":"Admiralty Air Taxi","kind":"roadside","role":null,"aspect":2.772},"harbor_fuel":{"name":"Harbor Fuel & Bait","kind":"harbour","role":null,"aspect":2.94},"general_store":{"name":"Kootz Landing General Store","kind":"store","role":null,"aspect":2.897},"tidal_cup":{"name":"Tidal Cup Cafe","kind":"store","role":null,"aspect":3.071},"bear_tours":{"name":"Bear Coast Tours","kind":"roadside","role":null,"aspect":2.23},"sitka_lumber":{"name":"Sitka Spruce Lumber","kind":"industrial","role":null,"aspect":3.004},"north_motel":{"name":"North Channel Motel","kind":"roadside","role":null,"aspect":2.917},"tongass_marine":{"name":"Tongass Marine Supply","kind":"harbour","role":null,"aspect":3.027},"admiralty_police":{"name":"Admiralty Police","kind":"civic","role":"police","aspect":2.145},"island_clinic":{"name":"Island Clinic","kind":"civic","role":"clinic","aspect":2.496},"town_hall":{"name":"Town Hall","kind":"civic","role":"town hall","aspect":2.645},"fire_brigade":{"name":"Fire Brigade","kind":"civic","role":"fire hall","aspect":3.294},"kootz_school":{"name":"Kootz Landing School","kind":"civic","role":"school","aspect":2.142},"postal_service":{"name":"Postal Service","kind":"civic","role":"post office","aspect":3.702},"community_church":{"name":"Community Church","kind":"civic","role":"church","aspect":2.176},"veterinary_care":{"name":"Veterinary Care","kind":"civic","role":"vet","aspect":3.423}};
if (typeof module !== 'undefined' && module.exports) module.exports = { SIGN_TEX_META };
