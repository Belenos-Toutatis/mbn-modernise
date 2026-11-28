// MBN modernisé — rafraîchissement automatique des pages.
//
// La page est rechargée après N minutes SANS activité (souris, clavier,
// défilement), ce qui maintient la session ouverte et les données à jour.
// Elle n'est jamais rechargée tant qu'une saisie est en cours : texte tapé
// dans un formulaire, éditeur de texte actif, ou rédaction d'un message.
//
// Le script tourne dans tous les cadres : les cadres intégrés (messagerie…)
// signalent leur activité et leur état à la page principale, qui seule décide.

(() => {
  const DEFAUT = { actif: true, minutes: 5 };
  const estHaut = window === window.top;
  let saisie = false; // du texte a été tapé dans cette page depuis son chargement

  const estMessagerie = () => !!document.getElementById('z_shell');

  const aLEcran = (selecteur) =>
    [...document.querySelectorAll(selecteur)].some((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < innerWidth && b.top < innerHeight;
    });

  // Présent et affiché dans la page, même hors de la partie visible.
  const affiche = (selecteur) =>
    [...document.querySelectorAll(selecteur)].some((el) => el.getClientRects().length > 0);

  const estChampTexte = (el) => {
    if (!el || !el.tagName) return false;
    if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' &&
      !/^(button|submit|reset|checkbox|radio|hidden|file|image|range|color)$/i.test(el.type);
  };

  const saisieActive = (el) => {
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === 'IFRAME') { // éditeur de texte riche
      try {
        const doc = el.contentDocument;
        return !!doc && (doc.designMode === 'on' || !!(doc.body && doc.body.isContentEditable));
      } catch {
        return false;
      }
    }
    return estChampTexte(el) && el.value.trim() !== '';
  };

  // Vrai tant qu'un rechargement ferait perdre quelque chose dans ce cadre.
  const bloque = () => {
    // La messagerie reste ouverte longtemps et vide ses champs elle-même :
    // seule la rédaction d'un message y bloque le rechargement.
    if (estMessagerie()) return aLEcran('.ZmComposeView');
    // Formulaire d'édition, éditeur de texte ou fenêtre ouverte : même sans
    // frappe (liste modifiée, pièce jointe ajoutée), recharger ferait tout perdre.
    if (affiche('.js-editionActivity, .cke, .modal--show, #js-formCreateEvent, #form_devoir, .mbn-saisie-connexion')) return true;
    return saisie || saisieActive(document.activeElement);
  };

  addEventListener('input', (e) => {
    if (e.isTrusted && estChampTexte(e.target) && e.target.id !== 'js-globalSearch') saisie = true;
  }, true);

  // ---- Activité de l'utilisateur ----
  let derniereActivite = 0;
  let relancer = () => {};
  const activite = (e) => {
    if (!e.isTrusted) return;
    const maintenant = Date.now();
    if (maintenant - derniereActivite < 2000) return;
    derniereActivite = maintenant;
    if (estHaut) relancer();
    else window.top.postMessage({ mbn: 'activite' }, '*');
  };
  for (const type of ['mousedown', 'mousemove', 'keydown', 'wheel', 'scroll', 'touchstart']) {
    addEventListener(type, activite, { capture: true, passive: true });
  }

  if (!estHaut) {
    setInterval(() => window.top.postMessage({ mbn: 'etat', bloque: bloque() }, '*'), 5000);
    return;
  }

  // ---- Page principale : compte à rebours et rechargement ----
  let reglages = { ...DEFAUT };
  let echeance = 0;
  let enCours = false;
  let pastille = null;
  const etatsCadres = new Map();

  const normaliser = (r) => ({
    actif: r ? r.actif !== false : DEFAUT.actif,
    minutes: Math.min(120, Math.max(0.05, Number(r && r.minutes) || DEFAUT.minutes)),
  });

  relancer = () => { echeance = Date.now() + reglages.minutes * 60000; };

  addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.mbn === 'activite') relancer();
    else if (d.mbn === 'etat') etatsCadres.set(e.source, { bloque: !!d.bloque, vu: Date.now() });
  });

  const afficher = (texte, aide) => {
    if (!pastille) {
      pastille = document.createElement('div');
      // Classe utilisée par commun.css pour retirer la pastille des impressions.
      pastille.className = 'mbn-pastille-rafraichissement';
      pastille.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483000;' +
        'padding:2px 8px;border-radius:10px;background:rgba(31,41,51,.72);color:#fff;' +
        'font:11px/1.5 system-ui,sans-serif;pointer-events:none;';
      document.documentElement.appendChild(pastille);
    }
    pastille.style.display = texte ? '' : 'none';
    pastille.textContent = texte;
    pastille.title = aide || '';
  };

  const recharger = () => {
    enCours = true;
    afficher('↻ rechargement…');
    // Navigation simple vers la même adresse : pas de renvoi de formulaire.
    if (location.hash) location.reload();
    else location.replace(location.href);
  };

  const tic = () => {
    if (enCours) return;
    if (!reglages.actif) { if (pastille) afficher(''); return; }
    const maintenant = Date.now();
    for (const [cadre, etat] of etatsCadres) if (maintenant - etat.vu > 15000) etatsCadres.delete(cadre);

    if (bloque() || [...etatsCadres.values()].some((etat) => etat.bloque)) {
      if (echeance - maintenant < 30000) echeance = maintenant + 30000;
      afficher('↻ en pause', 'Saisie en cours : la page ne sera pas rechargée.');
      return;
    }
    const reste = echeance - maintenant;
    if (reste <= 0) { recharger(); return; }
    const secondes = Math.ceil(reste / 1000);
    afficher(`↻ ${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, '0')}`,
      'Rechargement automatique après inactivité (MBN modernisé).');
  };

  chrome.storage.local.get({ rafraichissement: DEFAUT }).then((valeurs) => {
    reglages = normaliser(valeurs.rafraichissement);
    relancer();
    setInterval(tic, 1000);
    tic();
  });
  chrome.storage.onChanged.addListener((changements) => {
    if (!changements.rafraichissement) return;
    reglages = normaliser(changements.rafraichissement.newValue);
    relancer();
  });
})();
