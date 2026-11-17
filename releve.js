// MBN modernisé — relevé de notes d'une classe (enseignant).
// Repère la page (pour releve.css), lui donne la couleur de la classe, et
// affiche un bilan : nombre d'élèves, moyenne, extrêmes et répartition des
// moyennes. Rien n'est modifié dans MBN : tout est lu dans le tableau affiché.
// La fenêtre de détail d'une note se ferme aussi par Échap ou d'un clic à côté.

(() => {
  const tableau = document.getElementById('releve-enseignant');
  const module = document.getElementById('module_notes');
  if (!tableau || !module) return;
  module.classList.add('mbn-releve');

  const texte = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const nombre = (t) => (/^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : null);
  const ecrire = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
  const poser = (el, propriete, valeur) => {
    if (el.style.getPropertyValue(propriete) !== valeur) el.style.setProperty(propriete, valeur);
  };

  // Couleur de la classe, lue dans le rappel des filtres au-dessus du tableau.
  const rappel = document.getElementById('releve-infos-filtres-texte');
  if (rappel && globalThis.mbnCouleurs) {
    const { classeDansTexte, pour } = globalThis.mbnCouleurs;
    const classe = [...rappel.querySelectorAll('span')].map(texte).map((t) => classeDansTexte(t)).find(Boolean) ||
      classeDansTexte(texte(rappel));
    const couleur = classe ? pour(classe) : null;
    if (couleur) {
      module.dataset.mbnClasse = classe;
      for (const cle of ['fond', 'bord', 'pale', 'texte']) {
        if (couleur[cle]) module.style.setProperty('--mbn-classe-' + cle, couleur[cle]);
      }
    }
  }

  // Fenêtre de détail d'une note : Échap ou un clic sur le fond sombre la
  // ferme, comme sa croix. (C'est le bouton de fermeture de MBN qui est actionné.)
  const fermerDetail = () => {
    const cadre = document.getElementById('contenuDevoir_c');
    if (!cadre || cadre.classList.contains('yui-overlay-hidden') || cadre.style.visibility === 'hidden') return false;
    const croix = cadre.querySelector('.container-close');
    if (!croix) return false;
    croix.click();
    return true;
  };
  document.addEventListener('click', (e) => {
    if (e.isTrusted && e.target instanceof Element && e.target.id === 'contenuDevoir_mask') fermerDetail();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!e.isTrusted || e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (fermerDetail()) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // ---- Bilan ----
  const bilan = document.createElement('div');
  bilan.className = 'mbn-releve-bilan';
  const chiffres = document.createElement('span');
  const repartition = document.createElement('span');
  repartition.className = 'mbn-repartition';
  bilan.append(chiffres, repartition);
  tableau.before(bilan);

  const BAREME = 20;
  let prevu = false;
  const actualiser = () => {
    prevu = false;
    const cellules = [...tableau.querySelectorAll('tbody.yui-dt-data td.yui-dt-col-moyenne')];
    const moyennes = [];
    for (const cellule of cellules) {
      const valeur = nombre(texte(cellule));
      if (valeur !== null) moyennes.push(valeur);
      // Petite jauge derrière la moyenne de l'élève.
      poser(cellule, '--mbn-part', valeur === null ? '0%' : Math.round(Math.min(1, valeur / BAREME) * 100) + '%');
    }
    const sur20 = moyennes.length > 0 && Math.max(...moyennes) <= BAREME;
    let resume = `${cellules.length} élève${cellules.length > 1 ? 's' : ''}`;
    if (moyennes.length) {
      const somme = moyennes.reduce((a, b) => a + b, 0);
      resume += ` · moyenne ${ecrire(somme / moyennes.length)} · de ${ecrire(Math.min(...moyennes))} à ${ecrire(Math.max(...moyennes))}`;
      if (moyennes.length < cellules.length) resume += ` · ${cellules.length - moyennes.length} sans moyenne`;
    }
    if (chiffres.textContent !== resume) chiffres.textContent = resume;

    const tranches = [0, 0, 0, 0];
    if (sur20) for (const m of moyennes) tranches[Math.min(3, Math.floor((m / BAREME) * 4))]++;
    const maximum = Math.max(1, ...tranches);
    if (repartition.children.length !== 4) repartition.replaceChildren(...tranches.map(() => document.createElement('i')));
    repartition.hidden = !sur20;
    tranches.forEach((n, rang) => {
      const barre = repartition.children[rang];
      poser(barre, 'height', Math.round(3 + (n / maximum) * 15) + 'px');
      const aide = `${n} moyenne${n > 1 ? 's' : ''} dans [${rang * 5} ; ${rang * 5 + 5}${rang < 3 ? '[' : ']'}`;
      if (barre.title !== aide) barre.title = aide;
    });
  };
  const planifier = () => {
    if (prevu) return;
    prevu = true;
    setTimeout(actualiser, 80);
  };
  actualiser();
  // Le tableau réécrit ses lignes à chaque tri.
  new MutationObserver(planifier).observe(tableau, { childList: true, subtree: true, characterData: true });
})();
