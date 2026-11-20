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
      volets().forEach(etendreListe);
      document.querySelectorAll('.ZmOverview').forEach(compterNonLus);
      document.querySelectorAll('iframe.ZmHtmlEditorIFrame[title]').forEach(sansInfobulle);
    });
  };

  // ---- Cadres : pas d'infobulle ----
  // Le cadre de la messagerie et celui de l'éditeur de message portent un
  // attribut « title ». Le navigateur l'affiche en infobulle dès que la souris
  // entre dans le cadre, et ne la retire plus tant qu'elle y reste : elle
  // masque le texte en cours de rédaction. Le nom passe dans « aria-label »,
  // que les lecteurs d'écran lisent de la même façon, sans infobulle.
  const sansInfobulle = (cadre) => {
    const nom = cadre.getAttribute('title');
    if (nom === null) return;
    if (nom && !cadre.hasAttribute('aria-label')) cadre.setAttribute('aria-label', nom);
    cadre.removeAttribute('title');
  };

  // ---- Barre latérale : nombre de non-lus en pastille ----
  // La messagerie écrit « Nom (3) », en gras, pour un dossier qui contient des
  // messages non lus. On sépare le nombre du nom pour l'afficher en pastille
  // (messagerie-moderne.css). Seul ce texte en gras est touché : un dossier
  // dont le nom finit par une parenthèse reste intact. La messagerie réécrit
  // la cellule à chaque changement ; on repasse alors dessus.
  const compterNonLus = (arbre) => {
    if (!document.documentElement.classList.contains('mbn-moderne')) return;
    for (const gras of arbre.querySelectorAll('.DwtTreeItem td[id$="_textCell"] > span[style*="bold"]')) {
      const cellule = gras.parentElement;
      if (cellule.querySelector('.mbn-nonlus')) continue;
      const noeud = gras.lastChild;
      const trouve = noeud && noeud.nodeType === 3 ? /^(.*\S)\s*\((\d+)\)\s*$/.exec(noeud.data) : null;
      if (!trouve) continue;
      noeud.data = trouve[1];
      const pastille = document.createElement('span');
      pastille.className = 'mbn-nonlus';
      pastille.textContent = trouve[2];
      pastille.title = trouve[2] + (trouve[2] === '1' ? ' message non lu' : ' messages non lus');
      cellule.prepend(pastille);
    }
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

  // Volets de lecture : celui de la vue par message (.ZmMailMsgView) et celui
  // de la vue par conversation (.ZmConvView2). On ne retient que ceux placés à
  // côté d'une liste, pas les messages affichés à l'intérieur d'une conversation.
  const VOLET = ':scope > .ZmMailMsgView, :scope > .ZmConvView2';
  const voletDe = (vue) => (vue ? vue.querySelector(VOLET) : null);
  const volets = () =>
    [...document.querySelectorAll('.ZmMailMsgView, .ZmConvView2')].filter(
      (volet) => volet.parentElement && volet.parentElement.querySelector(':scope > .DwtListView') &&
        voletDe(volet.parentElement) === volet);

  // Le volet n'affiche-t-il que son message d'attente (« aucun message ouvert ») ?
  // En vue par conversation, ce message reste dans la page, masqué par un
  // « display: none » posé sur un de ses parents : on lit ces styles plutôt que
  // la taille à l'écran, qui est nulle aussi quand c'est nous qui cachons le volet.
  const estVide = (volet) => {
    const attente = volet.querySelector('td.NoResults');
    if (!attente) return false;
    for (let el = attente; el && el !== volet; el = el.parentElement) {
      if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
    }
    return true;
  };

  // ---- Touche Échap : refermer le volet de lecture ----
  // Échap rend toute la hauteur à la liste, comme avant l'ouverture du message.
  // Le volet se rouvre dès qu'un autre message s'affiche, ou d'un clic (ou de
  // la touche Entrée) sur un message de la liste.
  const aLEcran = (selecteur) =>
    [...document.querySelectorAll(selecteur)].some((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight;
    });

  // Le volet de lecture peut-il être refermé par l'extension ?
  //   - volet en bas : toujours ;
  //   - volet à droite : seulement si la messagerie est trop étroite pour
  //     afficher confortablement la liste et le message côte à côte.
  const LARGEUR_ETROITE = 1500; // px de large pour la liste et le volet réunis
  const placeDuVolet = (volet) => {
    const vue = volet.parentElement;
    if (parseFloat(volet.style.top) > 0) return 'bas';
    if (parseFloat(volet.style.left) > 0 && vue && vue.clientWidth < LARGEUR_ETROITE) return 'droite';
    return '';
  };

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

    for (const volet of volets()) {
      const vue = volet.parentElement;
      if (!vue || vue.dataset.mbnPleine || !placeDuVolet(volet) || !volet.getClientRects().length) continue;
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
    // Les colonnes d'icônes (déplier la conversation, drapeau, étiquette, lu / non lu)
    // ont leur propre action.
    if (e.target.closest('.ZmMsgListColExpand, .ZmMsgListColFlag, .ZmMsgListColTag, .ZmMsgListColRead, .ZmMsgListColPriority')) return;
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
    const volet = voletDe(vue);
    if (!volet || vue.dataset.mbnPleine || !placeDuVolet(volet) || !volet.getClientRects().length) return;
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

  // Volet de lecture vide (aucun message ouvert) ou refermé : la liste prend
  // toute la place — la hauteur si le volet est en bas, la largeur s'il est à
  // droite sur une messagerie étroite. Dès qu'un message est ouvert, Zimbra
  // reprend la main.
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
    const vide = estVide(volet);
    const place = placeDuVolet(volet);
    // Volet refermé à la main : touche Échap, ou clic sur le message ouvert.
    const ferme = vue.dataset.mbnFerme === '1';
    surveillerVolet(volet);

    if (actif && place === 'bas' && (vide || ferme)) {
      const entete = liste.querySelector('.DwtListView-ColHeader');
      const haut = Math.max(100, vue.clientHeight - (entete ? entete.offsetHeight : 0) - 2);
      ecrire(lignes, '--mbn-liste-haut', haut + 'px');
      if (vue.dataset.mbnPleine !== '1') vue.dataset.mbnPleine = '1';
    } else if (actif && place === 'droite' && (vide || ferme)) {
      // Volet à droite sur une messagerie étroite : la liste prend toute la largeur.
      lignes.style.removeProperty('--mbn-liste-haut');
      if (vue.dataset.mbnPleine !== 'droite') vue.dataset.mbnPleine = 'droite';
    } else if (vue.dataset.mbnPleine) {
      delete vue.dataset.mbnPleine;
      lignes.style.removeProperty('--mbn-liste-haut');
      // La liste retrouve sa taille réduite : le message choisi doit rester visible.
      const choisi = lignes.querySelector(':scope > [class*="selected"]');
      if (choisi) requestAnimationFrame(() => choisi.scrollIntoView({ block: 'nearest' }));
    }
  };

  // N'écrit que si la valeur change, pour ne pas relancer inutilement les observateurs.
  const ecrire = (el, propriete, valeur) => {
    if (el.style.getPropertyValue(propriete) !== valeur) el.style.setProperty(propriete, valeur);
  };

  // ---- Volet de lecture à droite : liste en colonnes, avec des titres ----
  // Zimbra affiche alors chaque message sur deux lignes, sans titre de colonne.
  // Quand la liste est assez large, messagerie-moderne.css remet chaque message
  // sur une ligne (expéditeur, objet, date) ; on ajoute ici la rangée de titres
  // sous la ligne « Trié par… » d'origine, calée sur les lignes de la liste.
  const LARGEUR_COLONNES = 1000; // px de large pour la liste seule
  const TITRES = [['mbn-titre-de', 'De'], ['mbn-titre-objet', 'Objet'], ['mbn-titre-date', 'Reçu']];

  const titrer = (entete, liste, lignes) => {
    const modele = lignes.querySelector('.ZmRowDoubleHeader');
    const actif = document.documentElement.classList.contains('mbn-moderne');
    let titres = entete.querySelector(':scope > .mbn-titres');

    // On juge sur la largeur de la liste, fixée par Zimbra ou par la vue, et non
    // sur celle des lignes : celle-ci dépend de leur contenu, donc de l'affichage
    // choisi ici, et la liste alternait alors sans fin entre les deux affichages.
    if (!actif || !modele || liste.clientWidth < LARGEUR_COLONNES) {
      if (titres) titres.remove();
      if (liste.dataset.mbnColonnes) {
        delete liste.dataset.mbnColonnes;
        lignes.style.removeProperty('--mbn-lignes-haut');
      }
      return;
    }
    for (const el of [lignes, entete, liste]) {
      if (!suivis.has(el)) {
        suivis.add(el);
        observateurTaille.observe(el);
      }
    }
    if (liste.dataset.mbnColonnes !== '1') liste.dataset.mbnColonnes = '1';
    if (!titres) {
      titres = document.createElement('div');
      titres.className = 'mbn-titres';
      titres.setAttribute('aria-hidden', 'true');
      for (const [classe, texte] of TITRES) {
        const titre = document.createElement('span');
        titre.className = classe;
        titre.textContent = texte;
        titres.appendChild(titre);
      }
      entete.appendChild(titres);
    }
    const ligne = modele.getBoundingClientRect();
    const boite = entete.getBoundingClientRect();
    ecrire(titres, 'left', (ligne.left - boite.left).toFixed(1) + 'px');
    ecrire(titres, 'width', ligne.width.toFixed(1) + 'px');
    // L'en-tête a grandi : Zimbra ne le sait pas, on ajuste la hauteur des lignes.
    ecrire(lignes, '--mbn-lignes-haut', Math.max(100, liste.clientHeight - entete.offsetHeight - 2) + 'px');
  };

  const aligner = (entete) => {
    const vue = entete.closest('.DwtListView');
    const lignes = vue && vue.querySelector('.DwtListView-Rows');
    if (!lignes) return;

    const colonnes = [...entete.querySelectorAll('td.DwtListView-Column')].filter((td) => td.offsetWidth > 0);
    const modele = lignes.querySelector('.DwtMsgListMultiCol');

    // Liste sur deux lignes (volet de lecture à droite) : voir titrer().
    titrer(entete, vue, lignes);

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
    sansInfobulle(cadre);
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
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'title'],
    });
  }

  planifier();
  window.addEventListener('resize', planifier);
  new MutationObserver(planifier).observe(document.documentElement, { childList: true, subtree: true });
  // L'éditeur peut poser son « title » après coup (voir sansInfobulle).
  new MutationObserver(planifier).observe(document.documentElement, { attributes: true, attributeFilter: ['title'], subtree: true });
})();
