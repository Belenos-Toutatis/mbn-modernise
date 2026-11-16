// MBN modernisé — zoom automatique de l'aperçu PDF.
//
// MBN ouvre l'aperçu à 100 %. Sur un écran haut (portrait), une page A4 à
// 100 % laisse un grand vide sous elle. À chaque ouverture d'un aperçu, on
// agrandit donc la page — en actionnant le bouton « zoom + » de MBN, pour un
// rendu net — jusqu'à ce qu'elle occupe la place disponible, sans jamais
// dépasser ni en largeur ni en hauteur. On ne réduit jamais le zoom d'origine,
// et on n'intervient qu'une fois par ouverture : le zoom manuel reste libre.

(() => {
  const MARGE_BASSE = 48; // espace laissé sous la fenêtre d'aperçu
  const traites = new WeakSet();
  let prevu = false;

  const attendre = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (el) => el.getClientRects().length > 0;

  const ajuster = async (visionneuse) => {
    const contenu = visionneuse.querySelector('.pdf-viewer__content');
    const plus = visionneuse.querySelector('.js-zoomin');
    const moins = visionneuse.querySelector('.js-zoomout');
    const largeur = () => {
      const page = contenu.querySelector('.page');
      return page ? page.getBoundingClientRect().width : 0;
    };

    const boite = contenu.querySelector('.page').getBoundingClientRect();
    const hauteurDispo = window.innerHeight - MARGE_BASSE - contenu.getBoundingClientRect().top;
    const marges = parseFloat(getComputedStyle(contenu).paddingLeft) + parseFloat(getComputedStyle(contenu).paddingRight);
    const cible = Math.min(contenu.clientWidth - marges - 2, hauteurDispo * (boite.width / boite.height));

    let actuelle = boite.width;
    // Tant que le pas réel du zoom est inconnu, on suppose un cran d'au moins
    // 12 % : si MBN a déjà ajusté la page à la largeur, on ne touche à rien.
    let pas = 1.12;
    for (let i = 0; i < 8 && actuelle * pas <= cible; i++) {
      plus.click();
      let nouvelle = actuelle;
      for (let t = 0; t < 15 && nouvelle === actuelle; t++) {
        await attendre(100);
        nouvelle = largeur();
      }
      if (nouvelle <= actuelle) break; // le zoom ne réagit pas : on n'insiste pas
      pas = nouvelle / actuelle;
      actuelle = nouvelle;
      if (actuelle > cible + 1) { // un cran de trop : on revient en arrière
        if (moins) moins.click();
        break;
      }
    }
  };

  const examiner = () => {
    prevu = false;
    document.querySelectorAll('.pdf-viewer').forEach((visionneuse) => {
      if (!visible(visionneuse)) {
        traites.delete(visionneuse); // aperçu refermé : prêt pour la prochaine ouverture
        return;
      }
      if (traites.has(visionneuse)) return;
      const page = visionneuse.querySelector('.pdf-viewer__content .page');
      if (!page || !page.getBoundingClientRect().width || !visionneuse.querySelector('.js-zoomin')) return;
      traites.add(visionneuse);
      ajuster(visionneuse);
    });
  };

  const planifier = () => {
    if (prevu) return;
    prevu = true;
    setTimeout(examiner, 200);
  };

  planifier();
  new MutationObserver(planifier).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
})();
