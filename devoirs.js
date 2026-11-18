// MBN modernisé — listes des évaluations (devoirs), des relevés de notes, des
// appréciations (bulletins) et des conseils de classe de l'enseignant, bâties
// sur le même tableau :
//   1. mémorise les filtres choisis et le tri du tableau, et les rétablit à
//      chaque chargement de la page (y compris après un rafraîchissement) ;
//   2. repère la classe de chaque ligne pour la colorer (devoirs.css).

(() => {
  // Chaque liste mémorise ses propres filtres et son propre tri.
  const LISTES = [
    { filtres: 'filtre-liste-releves-enseignant', tableau: 'liste-releves-enseignant', cle: 'releves', garde: 'mbnReleves', classe: 'libelleGroupe' },
    { filtres: 'filtre-liste-conseils-classe', tableau: 'gestion-conseils-classes', cle: 'conseils', garde: 'mbnConseils', classe: 'classeLibelle' },
    { filtres: 'filtre-liste-bulletins-enseignant', tableau: 'liste-bulletins-enseignant', cle: 'bulletins', garde: 'mbnBulletins', classe: 'libelleGroupe' },
    { filtres: 'filtre-liste-devoirs-enseignant', tableau: 'liste-devoir', cle: 'devoirs', garde: 'mbnDevoirs', classe: 'libelleGroupe' },
  ];
  const liste = LISTES.find((l) => document.getElementById(l.filtres) || document.getElementById(l.tableau));
  if (!liste) return;
  const formulaire = document.getElementById(liste.filtres);
  const tableau = document.getElementById(liste.tableau);
  const CLE_FILTRES = liste.cle + 'Filtres';
  const CLE_TRI = liste.cle + 'Tri';
  const GARDE = liste.garde;

  const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Garde-fou contre une boucle de rechargements : si rétablir un réglage
  // recharge la page et que MBN ne le retient pas, on s'arrête à la deuxième
  // tentative rapprochée. Un rafraîchissement isolé, même juste après
  // l'ouverture de la page, n'est pas bloqué.
  const dejaTente = (cle) => {
    try {
      const maintenant = Date.now();
      const recentes = JSON.parse(sessionStorage.getItem(cle) || '[]').filter((t) => maintenant - t < 8000);
      if (recentes.length >= 2) return true;
      recentes.push(maintenant);
      sessionStorage.setItem(cle, JSON.stringify(recentes));
    } catch { /* stockage indisponible : on tente quand même */ }
    return false;
  };

  // Après un rafraîchissement (ou un retour arrière), le navigateur remet
  // lui-même les listes sur leurs anciennes valeurs, sans que MBN applique le
  // filtre : la valeur affichée ne prouve alors rien.
  const navigation = performance.getEntriesByType('navigation')[0];
  const valeursRestaurees = !!navigation && (navigation.type === 'reload' || navigation.type === 'back_forward');

  // Attend que le tableau ait fini de se réécrire (aucun changement pendant
  // « calme » ms), sans dépasser « maximum » ms.
  const attendreCalme = (el, calme = 600, maximum = 6000) => new Promise((resolve) => {
    let minuterie;
    const finir = () => { observateur.disconnect(); clearTimeout(limite); clearTimeout(minuterie); resolve(); };
    const observateur = new MutationObserver(() => { clearTimeout(minuterie); minuterie = setTimeout(finir, calme); });
    const limite = setTimeout(finir, maximum);
    observateur.observe(el, { childList: true, subtree: true });
    minuterie = setTimeout(finir, calme);
  });

  // ---- 1a. Filtres ----
  if (formulaire) {
    formulaire.addEventListener('change', async (e) => {
      const champ = e.target;
      if (!e.isTrusted || champ.tagName !== 'SELECT' || !champ.id) return;
      const memorises = (await chrome.storage.local.get({ [CLE_FILTRES]: {} }))[CLE_FILTRES];
      memorises[champ.id] = champ.value;
      chrome.storage.local.set({ [CLE_FILTRES]: memorises });
    }, true);
  }

  const retablirFiltres = (memorises) => {
    if (!formulaire) return;
    const aChanger = [...formulaire.querySelectorAll('select[id]')].filter((champ) => {
      const voulu = memorises[champ.id];
      if (voulu === undefined || ![...champ.options].some((o) => o.value === voulu)) return false;
      if (champ.value !== voulu) return true;
      // Même valeur, mais remise par le navigateur : MBN ne l'a pas appliquée,
      // sauf si c'est la valeur par défaut de la liste.
      const parDefaut = [...champ.options].find((o) => o.defaultSelected) || champ.options[0];
      return valeursRestaurees && !!parDefaut && parDefaut.value !== voulu;
    });
    if (!aChanger.length || dejaTente(GARDE + 'Filtres2')) return;
    // Toutes les valeurs d'abord, puis les signaux : si le premier signal
    // envoie le formulaire, il part avec tous les filtres.
    aChanger.forEach((champ) => { champ.value = memorises[champ.id]; });
    aChanger.forEach((champ) => champ.dispatchEvent(new Event('change', { bubbles: true })));
  };

  // ---- 1b. Tri ----
  const colonneTriee = () => tableau.querySelector('thead th.yui-dt-asc, thead th.yui-dt-desc');
  const cleColonne = (th) => (/(?:^|\s)yui-dt-col-(\S+)/.exec(th.className) || [])[1];

  if (tableau) {
    tableau.addEventListener('click', (e) => {
      if (!e.isTrusted || !e.target.closest || !e.target.closest('thead th.yui-dt-sortable')) return;
      setTimeout(() => {
        const th = colonneTriee();
        if (!th) return;
        chrome.storage.local.set({
          [CLE_TRI]: { colonne: cleColonne(th), sens: th.classList.contains('yui-dt-desc') ? 'desc' : 'asc' },
        });
      }, 500);
    }, true);
  }

  const retablirTri = async (tri) => {
    if (!tableau || !tri || !tri.colonne) return;
    const th = tableau.querySelector('thead th.yui-dt-col-' + CSS.escape(tri.colonne));
    if (!th || th.classList.contains('yui-dt-' + tri.sens) || dejaTente(GARDE + 'Tri2')) return;
    // Un clic trie dans un sens, un second inverse.
    for (let i = 0; i < 2 && !th.classList.contains('yui-dt-' + tri.sens); i++) {
      const lien = th.querySelector('a.yui-dt-sortable');
      if (!lien) return;
      lien.click();
      await attendre(500);
    }
  };

  // ---- 2. Classe de chaque ligne ----
  let prevu = false;
  const marquer = () => {
    prevu = false;
    for (const ligne of tableau.querySelectorAll('tbody.yui-dt-data > tr')) {
      const cellule = ligne.querySelector('td.yui-dt-col-' + liste.classe + ' .yui-dt-liner');
      const libelle = cellule ? cellule.textContent.replace(/\s+/g, ' ').trim() : '';
      const couleur = libelle ? globalThis.mbnCouleurs.pour(libelle, true) : null;
      if (ligne.dataset.mbnClasse === libelle) continue;
      if (!couleur) {
        delete ligne.dataset.mbnClasse;
        continue;
      }
      ligne.dataset.mbnClasse = libelle;
      ligne.style.setProperty('--mbn-classe-fond', couleur.fond);
      ligne.style.setProperty('--mbn-classe-bord', couleur.bord);
      ligne.style.setProperty('--mbn-classe-pale', couleur.pale);
      ligne.style.setProperty('--mbn-classe-texte', couleur.texte);
    }
  };
  const planifier = () => {
    if (prevu) return;
    prevu = true;
    setTimeout(marquer, 50);
  };

  if (tableau) {
    marquer();
    // Le tableau réécrit ses lignes à chaque tri ou filtrage.
    new MutationObserver(planifier).observe(tableau, { childList: true, subtree: true, characterData: true });
  }

  chrome.storage.local.get({ [CLE_FILTRES]: {}, [CLE_TRI]: null }).then(async (memoire) => {
    retablirFiltres(memoire[CLE_FILTRES]);
    // Le tri n'est rétabli qu'une fois le tableau rempli et filtré.
    if (tableau) await attendreCalme(tableau);
    retablirTri(memoire[CLE_TRI]);
  });
})();
