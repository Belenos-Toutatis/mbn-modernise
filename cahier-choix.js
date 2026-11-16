// MBN modernisé — cahier de textes : retient le cahier choisi dans la liste
// en haut de page (vue agenda comme vues en liste) et le rétablit à chaque
// arrivée sur le cahier de textes.

(() => {
  const liste = document.getElementById('navigationOf.textBookCode') ||
    document.querySelector('select.js-cdt-navigation__select');
  if (!liste) return;

  liste.addEventListener('change', (e) => {
    if (e.isTrusted) chrome.storage.local.set({ cahierChoisi: liste.value });
  }, true);

  // Garde-fou contre une boucle de rechargements : si MBN ne retient pas le
  // cahier rétabli, on s'arrête à la deuxième tentative rapprochée.
  const dejaTente = () => {
    try {
      const maintenant = Date.now();
      const recentes = JSON.parse(sessionStorage.getItem('mbnCahierChoisi') || '[]').filter((t) => maintenant - t < 8000);
      if (recentes.length >= 2) return true;
      recentes.push(maintenant);
      sessionStorage.setItem('mbnCahierChoisi', JSON.stringify(recentes));
    } catch { /* stockage indisponible : on tente quand même */ }
    return false;
  };

  chrome.storage.local.get({ cahierChoisi: null }).then(({ cahierChoisi }) => {
    if (cahierChoisi === null || ![...liste.options].some((o) => o.value === cahierChoisi)) return;

    // L'option marquée par MBN dans la page dit quel cahier est réellement
    // affiché, même si le navigateur a remis la liste sur une autre valeur
    // après un rafraîchissement.
    const affiche = [...liste.options].find((o) => o.defaultSelected) || liste.options[0];
    if (affiche && affiche.value === cahierChoisi) {
      liste.value = cahierChoisi;
      return;
    }
    if (dejaTente()) return;
    liste.value = cahierChoisi;
    liste.dispatchEvent(new Event('change', { bubbles: true }));
  });
})();
