// MBN modernisé — couleurs de classe, communes à tous les écrans :
// une teinte par niveau, une nuance par classe du niveau.
// Chargé avant les autres scripts, qui y accèdent par globalThis.mbnCouleurs.

globalThis.mbnCouleurs = (() => {
  const TEINTE_NIVEAU = { 6: 140, 5: 215, 4: 35, 3: 290, 2: 345, 1: 178, 0: 70 };
  // « 3A », « 3EME D », « 5 - 2 », « 4B GR1 »… : chiffre du niveau, puis lettre ou numéro.
  const CLASSE = /^\s*(\d)\s*(?:(?:[eè]me|e)(?=[\s\-_.]+\S))?[\s\-_.]*([A-Za-z]|\d{1,2})?/i;

  // Saturation des fonds : 90 était criard, 70 (première version) se faisait
  // délaver ; 62 donne des couleurs nettes sans agressivité.
  const SATURATION = 62;

  const lireClasse = (libelle) => {
    const m = CLASSE.exec(libelle);
    if (!m) return null;
    const suffixe = (m[2] || '').toUpperCase();
    const rang = !suffixe ? 0 : /\d/.test(suffixe) ? Number(suffixe) - 1 : suffixe.charCodeAt(0) - 65;
    return { cle: m[1] + suffixe, niveau: Number(m[1]), rang: Math.max(0, rang) % 5 };
  };

  const empreinte = (texte) => {
    let h = 0;
    for (const c of texte) h = (h * 31 + c.codePointAt(0)) >>> 0;
    return h;
  };

  // Luminosité perçue (0 = noir, 1 = blanc) d'une couleur hsl : un jaune ou
  // un vert paraissent bien plus clairs qu'un bleu de même « clarté ».
  const luminosite = (teinte, saturation, clarte) => {
    const s = saturation / 100;
    const l = clarte / 100;
    const a = s * Math.min(l, 1 - l);
    const canal = (n) => {
      const k = (n + teinte / 30) % 12;
      const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(0) + 0.7152 * canal(8) + 0.0722 * canal(4);
  };

  // Couleur de texte (blanc ou presque noir) offrant le meilleur contraste
  // sur un fond hsl donné.
  const texteSur = (teinte, saturation, clarte) => {
    const fond = luminosite(teinte, saturation, clarte);
    const contrasteBlanc = 1.05 / (fond + 0.05);
    const contrasteNoir = (fond + 0.05) / 0.058;
    return contrasteBlanc > contrasteNoir ? '#ffffff' : '#10151c';
  };

  // Clarté des cinq nuances d'un niveau, de la classe A (ou 1) à E (ou 5).
  const CLARTES = [84, 75, 66, 57, 48];

  // Couleurs d'un libellé de classe ou de groupe. Un libellé qui n'est pas
  // une classe reconnue (« LATIN », « Atelier »…) reçoit une teinte tirée de
  // son nom si « secours » est vrai, sinon rien. « attenue » donne la version
  // éclaircie et moins saturée, pour les séances passées.
  const pour = (libelle, secours = false, attenue = false) => {
    const classe = lireClasse(libelle);
    const teinte = classe ? TEINTE_NIVEAU[classe.niveau] : undefined;
    if (teinte !== undefined) {
      // La teinte parcourt 40° autour de celle du niveau.
      const nuance = (teinte + 10 * (classe.rang - 2) + 360) % 360;
      let saturation = SATURATION;
      let clarte = CLARTES[classe.rang];
      if (attenue) {
        saturation = Math.round(saturation * 0.6);
        clarte = Math.round(clarte + (100 - clarte) * 0.4);
      }
      return {
        fond: `hsl(${nuance}, ${saturation}%, ${clarte}%)`,
        bord: `hsl(${nuance}, 70%, 30%)`,
        pale: `hsl(${nuance}, 65%, ${95 - 2 * classe.rang}%)`,
        texte: texteSur(nuance, saturation, clarte),
      };
    }
    if (!secours || !libelle.trim()) return null;
    const t = empreinte(libelle.trim()) % 360;
    return { fond: `hsl(${t}, 45%, 86%)`, bord: `hsl(${t}, 40%, 42%)`, pale: `hsl(${t}, 45%, 97%)`, texte: '#10151c' };
  };

  // Cherche un nom de classe dans un texte libre (« PHYSIQUE-CHIMIE - 3B-GP1 »,
  // « jeudi 3 septembre à 09:00 3A »…). Les horaires, les dates, les nombres
  // seuls et les ordinaux (« 3e trimestre ») sont écartés : le chiffre du
  // niveau doit être suivi d'une majuscule ou d'un chiffre.
  const classeDansTexte = (texte) => {
    for (const brut of String(texte).split(/[\s,;()|]+/)) {
      const mot = brut.replace(/^[^0-9A-Za-z]+|[^0-9A-Za-z]+$/g, '');
      if (mot.length < 2 || mot.length > 14) continue;
      if (/^\d{1,2}[hH:]/.test(mot) || /^\d{1,4}[\/.]\d/.test(mot) || /^\d+$/.test(mot)) continue;
      if (!/^\d[A-Z0-9]/.test(mot)) continue;
      if (lireClasse(mot)) return mot;
    }
    return '';
  };

  return { lireClasse, empreinte, pour, classeDansTexte };
})();
