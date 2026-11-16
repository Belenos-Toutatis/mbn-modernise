// MBN modernisé — reporte sur <html> les réglages d'apparence de la fenêtre
// de l'extension :
//   « mbn-moderne »  : apparence modernisée (feuilles de style *-moderne.css) ;
//   « mbn-couleurs » : couleurs des séances par classe ou par matière ;
//   « mbn-compact »  : bandeau du haut de la messagerie sur une seule rangée ;
//   « mbn-menu-survol » : menu latéral réduit qui se déplie au survol.

(() => {
  const DEFAUT = { moderne: true, couleurs: true, compact: true, menuSurvol: true };

  const appliquer = (reglages) => {
    const racine = document.documentElement;
    racine.classList.toggle('mbn-moderne', reglages.moderne !== false);
    racine.classList.toggle('mbn-couleurs', reglages.couleurs !== false);
    racine.classList.toggle('mbn-compact', reglages.compact !== false);
    racine.classList.toggle('mbn-menu-survol', reglages.menuSurvol !== false);
    // Les scripts de mise en page doivent refaire leurs mesures et couleurs.
    window.dispatchEvent(new Event('resize'));
  };

  chrome.storage.local.get(DEFAUT).then(appliquer);
  chrome.storage.onChanged.addListener((changements) => {
    if (changements.moderne || changements.couleurs || changements.compact || changements.menuSurvol) chrome.storage.local.get(DEFAUT).then(appliquer);
  });
})();
