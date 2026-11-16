// MBN modernisé — alignement de la liste des messages (Zimbra).
//
// Les lignes de la liste ne suivent pas les largeurs des titres de colonnes.
// On mesure donc les titres et on transmet leurs largeurs aux lignes via la
// variable CSS --mbn-colonnes, exploitée par messagerie.css.

(() => {
  const suivis = new WeakSet();
  let prevu = false;

  const planifier = () => {
    if (prevu) return;
    prevu = true;
    requestAnimationFrame(() => {
      prevu = false;
      document.querySelectorAll('.DwtListView-ColHeader').forEach(aligner);
      document.querySelectorAll('.ZToolbar').forEach(ajusterBarre);
      document.querySelectorAll('.ZmMailMsgView').forEach(etendreListe);
    });
  };

  // Barre d'outils : si ses boutons dépassent la largeur disponible, on la
  // resserre par étapes (voir messagerie.css), puis en dernier recours on la
  // réduit légèrement d'échelle, sans descendre sous 80 %.
  const ajusterBarre = (barre) => {
    const table = barre.querySelector(':scope > table.ZToolbarTable');
    if (!table || !barre.clientWidth) return;
    for (const el of [barre, table]) {
      if (!suivis.has(el)) {
        suivis.add(el);
        observateurTaille.observe(el);
      }
    }
    const deborde = () => table.offsetWidth > barre.clientWidth + 1;

    table.style.removeProperty('zoom');
    delete barre.dataset.mbnBarre;
    for (let etape = 1; etape <= 2 && deborde(); etape++) barre.dataset.mbnBarre = etape;
    if (deborde()) {
      table.style.zoom = Math.max(0.8, barre.clientWidth / table.offsetWidth).toFixed(3);
    }
  };

  const observateurTaille = new ResizeObserver(planifier);

  // ---- Touche Échap : refermer le volet de lecture ----
  // Échap rend toute la hauteur à la liste, comme avant l'ouverture du message.
  // Le volet se rouvre dès qu'un autre message s'affiche, ou d'un clic (ou de
  // la touche Entrée) sur un message de la liste.
  const aLEcran = (selecteur) =>
    [...document.querySelectorAll(selecteur)].some((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight;
    });

  const rouvrir = () => {
    let change = false;
    for (const vue of document.querySelectorAll('[data-mbn-ferme]')) {
      delete vue.dataset.mbnFerme;
      change = true;
    }
    if (change) planifier();
  };

  const surTouche = (e) => {
    if (e.key === 'Enter') { rouvrir(); return; }
    if (e.key !== 'Escape' || !document.documentElement.classList.contains('mbn-moderne')) return;
    // Pas pendant une saisie, ni quand Échap sert à fermer un menu, une boîte
    // de dialogue ou la rédaction d'un message.
    const cible = e.target;
    if (cible && cible.nodeType === 1) {
      if (cible.isContentEditable || /^(TEXTAREA|SELECT)$/.test(cible.tagName)) return;
      if (cible.tagName === 'INPUT' && !/^(button|checkbox|radio)$/i.test(cible.type) && cible.value) return;
    }
    if (aLEcran('.ZmComposeView, .DwtDialog, .DwtMenu, .ActionMenu')) return;

    for (const volet of document.querySelectorAll('.ZmMailMsgView')) {
      const vue = volet.parentElement;
      if (!vue || vue.dataset.mbnPleine || !(parseFloat(volet.style.top) > 0) || !volet.getClientRects().length) continue;
      vue.dataset.mbnFerme = '1';
    }
    planifier();
  };
  document.addEventListener('keydown', surTouche, true);
  // Clic sur un message de la liste :
  //   - volet refermé : il se rouvre ;
  //   - message déjà ouvert : le volet se referme (comme Échap).
  // On note l'état au moment où le bouton s'enfonce, avant que la messagerie
  // ne change la sélection, et on n'agit qu'au clic complet : un glisser-déposer
  // vers un dossier ne referme donc rien.
  const estChoisie = (ligne) =>
    /selected/i.test(ligne.className) || !!ligne.querySelector(':scope > [class*="selected"]');
  let clicEnCours = null;

  document.addEventListener('mousedown', (e) => {
    clicEnCours = null;
    const ligne = e.target instanceof Element ? e.target.closest('.DwtListView-Rows > li') : null;
    if (!ligne || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (document.querySelector('[data-mbn-ferme]')) { rouvrir(); return; }
    // Les colonnes d'icônes (drapeau, étiquette, lu / non lu) ont leur propre action.
    if (e.target.closest('.ZmMsgListColFlag, .ZmMsgListColTag, .ZmMsgListColRead, .ZmMsgListColPriority')) return;
    const choisies = [...ligne.parentElement.children].filter(estChoisie);
    if (choisies.length === 1 && choisies[0] === ligne) clicEnCours = ligne;
  }, true);

  document.addEventListener('click', (e) => {
    const ligne = e.target instanceof Element ? e.target.closest('.DwtListView-Rows > li') : null;
    const attendue = clicEnCours;
    clicEnCours = null;
    if (!ligne || ligne !== attendue || !document.documentElement.classList.contains('mbn-moderne')) return;
    const liste = ligne.closest('.DwtListView');
    const vue = liste && liste.parentElement;
    const volet = vue && vue.querySelector(':scope > .ZmMailMsgView');
    if (!volet || vue.dataset.mbnPleine || !(parseFloat(volet.style.top) > 0) || !volet.getClientRects().length) return;
    vue.dataset.mbnFerme = '1';
    planifier();
  }, true);

  // Un nouveau message affiché dans le volet le rouvre. Le corps du message
  // est dans un cadre à part : on y écoute aussi la touche Échap.
  const surveillerVolet = (volet) => {
    for (const cadre of volet.querySelectorAll('iframe')) {
      try {
        const doc = cadre.contentDocument;
        if (doc && !suivis.has(doc)) {
          suivis.add(doc);
          doc.addEventListener('keydown', surTouche, true);
        }
      } catch { /* cadre d'une autre origine : rien à écouter */ }
    }
    if (suivis.has(volet)) return;
    suivis.add(volet);
    new MutationObserver(rouvrir).observe(volet, { childList: true, subtree: true });
  };

  // Volet de lecture en bas et vide (aucun message ouvert) : la liste prend
  // toute la hauteur. Dès qu'un message est ouvert, Zimbra reprend la main.
  const etendreListe = (volet) => {
    const vue = volet.parentElement;
    const liste = vue && vue.querySelector(':scope > .DwtListView');
    const lignes = liste && liste.querySelector('.DwtListView-Rows');
    if (!lignes) return;
    if (!suivis.has(vue)) {
      suivis.add(vue);
      observateurTaille.observe(vue);
    }
    const actif = document.documentElement.classList.contains('mbn-moderne');
    const vide = !!volet.querySelector('td.NoResults');
    const enBas = parseFloat(volet.style.top) > 0;
    // Volet refermé à la main par la touche Échap (voir plus bas).
    const ferme = vue.dataset.mbnFerme === '1';
    surveillerVolet(volet);

    if (actif && enBas && (vide || ferme)) {
      const entete = liste.querySelector('.DwtListView-ColHeader');
      const haut = Math.max(100, vue.clientHeight - (entete ? entete.offsetHeight : 0) - 2);
      ecrire(lignes, '--mbn-liste-haut', haut + 'px');
      if (vue.dataset.mbnPleine !== '1') vue.dataset.mbnPleine = '1';
    } else if (vue.dataset.mbnPleine) {
      delete vue.dataset.mbnPleine;
      lignes.style.removeProperty('--mbn-liste-haut');
      // La liste retrouve sa hauteur réduite : le message choisi doit rester visible.
      const choisi = lignes.querySelector(':scope > [class*="selected"]');
      if (choisi) requestAnimationFrame(() => choisi.scrollIntoView({ block: 'nearest' }));
    }
  };

  // N'écrit que si la valeur change, pour ne pas relancer inutilement les observateurs.
  const ecrire = (el, propriete, valeur) => {
    if (el.style.getPropertyValue(propriete) !== valeur) el.style.setProperty(propriete, valeur);
  };

  const aligner = (entete) => {
    const vue = entete.closest('.DwtListView');
    const lignes = vue && vue.querySelector('.DwtListView-Rows');
    if (!lignes) return;

    const colonnes = [...entete.querySelectorAll('td.DwtListView-Column')].filter((td) => td.offsetWidth > 0);
    const modele = lignes.querySelector('.DwtMsgListMultiCol');

    // On n'intervient que si les lignes ont bien une cellule par colonne.
    if (!modele || !colonnes.length || modele.children.length !== colonnes.length) {
      delete lignes.dataset.mbnAligne;
      entete.style.removeProperty('padding-right');
      return;
    }

    for (const el of [lignes, entete, ...colonnes]) {
      if (!suivis.has(el)) {
        suivis.add(el);
        observateurTaille.observe(el);
      }
    }

    // La barre de défilement rétrécit les lignes mais pas les titres :
    // on réserve la même place à droite des titres.
    const barre = lignes.offsetWidth - lignes.clientWidth;
    ecrire(entete, 'padding-right', barre + 'px');

    const gauche = lignes.getBoundingClientRect().left;
    const boites = colonnes.map((td) => td.getBoundingClientRect());
    ecrire(lignes, '--mbn-colonnes', boites.map((b) => b.width.toFixed(2) + 'px').join(' '));
    ecrire(lignes, '--mbn-decalage', Math.max(0, boites[0].left - gauche).toFixed(2) + 'px');
    lignes.dataset.mbnAligne = '1';
  };

  // Page MBN : le cadre de la messagerie a une hauteur fixe (fenêtre moins la
  // barre MBN de 40 px). Quand MBN affiche un bandeau d'annonce au-dessus, le
  // cadre dépasse d'autant en bas : la page défile et le bas de la messagerie
  // est caché. On cale donc sa hauteur sur sa position réelle.
  const ajusterCadre = (cadre) => {
    const haut = Math.round(cadre.getBoundingClientRect().top + window.scrollY);
    // On compare la position mémorisée, pas le texte du style : le navigateur
    // réécrit la formule à sa façon, ce qui relancerait le calcul sans fin.
    if (cadre.dataset.mbnHaut === String(haut)) return;
    cadre.dataset.mbnHaut = String(haut);
    cadre.style.setProperty('height', `calc(100vh - ${haut}px)`, 'important');
  };
  const ajusterCadres = () => document.querySelectorAll('iframe.iframe-zimbra').forEach(ajusterCadre);
  if (document.querySelector('iframe.iframe-zimbra')) {
    ajusterCadres();
    window.addEventListener('resize', ajusterCadres);
    new MutationObserver(ajusterCadres).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'],
    });
  }

  planifier();
  window.addEventListener('resize', planifier);
  new MutationObserver(planifier).observe(document.documentElement, { childList: true, subtree: true });
})();
