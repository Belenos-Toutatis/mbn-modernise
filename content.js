// MBN modernisé — script injecté dans toutes les pages de monbureaunumerique.fr.
// Pour l'instant : agrandissement des aperçus PDF. Les correctifs de la
// messagerie seront ajoutés une fois la structure de la page connue.

(() => {
  const PROPORTION = 0.85; // part de la hauteur de fenêtre donnée à l'aperçu

  const estPdf = (el) => {
    const type = el.getAttribute('type') || '';
    const source = el.getAttribute('src') || el.getAttribute('data') || '';
    return /pdf/i.test(type) || /pdf/i.test(source);
  };

  const agrandir = (el) => {
    if (el.dataset.mbnPdf) return;
    el.dataset.mbnPdf = '1';
    const cible = Math.round(window.innerHeight * PROPORTION);
    if (el.getBoundingClientRect().height >= cible) return;

    el.style.setProperty('height', cible + 'px', 'important');
    el.style.setProperty('min-height', cible + 'px', 'important');

    // Les conteneurs à hauteur fixe ou à défilement interne brident l'aperçu :
    // on les laisse s'étirer.
    let parent = el.parentElement;
    for (let i = 0; i < 5 && parent && parent !== document.body; i++) {
      const cs = getComputedStyle(parent);
      if (parent.clientHeight < cible && (cs.overflowY !== 'visible' || cs.maxHeight !== 'none')) {
        parent.style.setProperty('height', 'auto', 'important');
        parent.style.setProperty('max-height', 'none', 'important');
      }
      parent = parent.parentElement;
    }
  };

  const parcourir = (racine) => {
    if (!racine.querySelectorAll) return;
    if (racine.matches && racine.matches('iframe, embed, object') && estPdf(racine)) agrandir(racine);
    racine.querySelectorAll('iframe, embed, object').forEach((el) => {
      if (estPdf(el)) agrandir(el);
    });
  };

  parcourir(document);

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') parcourir(m.target);
      else m.addedNodes.forEach(parcourir);
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'data'],
  });
})();
