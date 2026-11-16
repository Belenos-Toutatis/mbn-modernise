// MBN modernisé — bornes des périodes préréglées.
//
// MBN refuse les dates hors de l'année scolaire (« Les dates saisies doivent
// être comprises entre le 01/09/2026 et le 13/07/2027 »). Les raccourcis de
// période (« 3 derniers mois », « Semaine dernière »…) sont donc ramenés dans
// ces bornes avant d'être envoyés, et retirés s'ils tombent entièrement dehors.
//
// Bornes par défaut : du 1er septembre au 4 juillet, volontairement prudentes.
// Les bornes exactes de l'établissement sont apprises dès que MBN les affiche
// dans son message d'erreur, puis retenues.
// Chargé avant les autres scripts, qui y accèdent par globalThis.mbnPeriodes.

globalThis.mbnPeriodes = (() => {
  const midi = (annee, mois, jour) => new Date(annee, mois, jour, 12);
  const aujourdhui = new Date();
  const rentree = aujourdhui.getMonth() >= 7 ? aujourdhui.getFullYear() : aujourdhui.getFullYear() - 1;

  let minimum = midi(rentree, 8, 1);
  let maximum = midi(rentree + 1, 6, 4);

  const versIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const depuisIso = (iso) => {
    const [annee, mois, jour] = String(iso).split('-').map(Number);
    return midi(annee, mois - 1, jour);
  };

  // N'adopte que des bornes cohérentes et valables pour l'année scolaire en cours.
  const adopter = (bornes) => {
    if (!bornes || !bornes.min || !bornes.max) return;
    const debut = depuisIso(bornes.min);
    const fin = depuisIso(bornes.max);
    if (isNaN(debut) || isNaN(fin) || fin <= debut) return;
    if (debut.getFullYear() !== rentree && fin.getFullYear() !== rentree + 1) return;
    minimum = debut;
    maximum = fin;
  };

  const MESSAGE = /comprises?\s+entre\s+le\s+(\d{2})\/(\d{2})\/(\d{4})\s+et\s+le\s+(\d{2})\/(\d{2})\/(\d{4})/i;
  const lireLaPage = () => {
    for (const zone of document.querySelectorAll('#kui_messages, .notices, .msg-erreur, .msg-alerte, .global-notices')) {
      const m = MESSAGE.exec(zone.textContent || '');
      if (m) return { min: `${m[3]}-${m[2]}-${m[1]}`, max: `${m[6]}-${m[5]}-${m[4]}` };
    }
    return null;
  };

  const pret = chrome.storage.local.get({ bornesDates: null }).then(({ bornesDates }) => {
    adopter(bornesDates);
    const apprises = lireLaPage();
    if (apprises) {
      adopter(apprises);
      chrome.storage.local.set({ bornesDates: apprises });
    }
  }).catch(() => { /* stockage indisponible : bornes par défaut */ });

  // Ramène une période dans les bornes ; null si elle est entièrement dehors.
  const borner = (du, au) => {
    const debut = du < minimum ? minimum : du;
    const fin = au > maximum ? maximum : au;
    return debut > fin ? null : [new Date(debut), new Date(fin)];
  };

  return { pret, borner, bornes: () => ({ min: versIso(minimum), max: versIso(maximum) }) };
})();
