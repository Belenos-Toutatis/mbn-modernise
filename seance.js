// MBN modernisé — page de détail d'une séance du cahier de textes.
// Repère la page (pour seance.css) et, si le nom de la classe figure dans le
// bandeau de la séance, lui donne la couleur de cette classe.
// En mode édition : Ctrl+S ou Ctrl+Entrée valide le formulaire de l'activité,
// exactement comme un clic sur son bouton « Valider ».

(() => {
  const principal = document.querySelector('main:has(> #windowViewSeances)');
  if (!principal) return;
  principal.classList.add('mbn-page-seance');

  // ---- Formulaire d'une activité ----
  const boutonValider = () => {
    const bouton = principal.querySelector('.js-editionActivity form input[type="submit"]');
    return bouton && bouton.getClientRects().length ? bouton : null;
  };
  const annoncer = () => {
    const bouton = boutonValider();
    if (!bouton || bouton.dataset.mbnRaccourci) return;
    bouton.dataset.mbnRaccourci = '1';
    if (!bouton.title) bouton.title = 'Valider (Ctrl+S ou Ctrl+Entrée)';
    const aide = document.createElement('span');
    aide.className = 'mbn-aide-raccourci';
    aide.textContent = 'Ctrl+S ou Ctrl+Entrée pour valider';
    bouton.after(aide);
  };
  annoncer();
  new MutationObserver(annoncer).observe(principal, { childList: true, subtree: true });

  document.addEventListener('keydown', (e) => {
    if (!e.isTrusted || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.repeat) return;
    if (e.key !== 'Enter' && e.key.toLowerCase() !== 's') return;
    if (!document.documentElement.classList.contains('mbn-moderne')) return;
    const bouton = boutonValider();
    // Rien si une fenêtre est ouverte par-dessus, ou si la frappe vient d'ailleurs.
    if (!bouton || document.querySelector('.modal--show')) return;
    if (e.key === 'Enter' && !(e.target instanceof Element && e.target.closest('.js-editionActivity'))) return;
    e.preventDefault();
    e.stopPropagation();
    bouton.click();
  }, true);

  // ---- Petites bulles de la page (ressources réservées, état de la séance) ----
  // Elles ne se fermaient que par leur croix : Échap et un clic à côté y
  // suffisent désormais, en cliquant la croix d'origine.
  const bulleOuverte = () => {
    for (const croix of document.querySelectorAll('.window--sm.js-window:not(.hide) .js-window__close')) {
      if (croix.getClientRects().length) return croix;
    }
    return null;
  };
  const moderne = () => document.documentElement.classList.contains('mbn-moderne');
  document.addEventListener('keydown', (e) => {
    if (!e.isTrusted || e.key !== 'Escape' || !moderne()) return;
    if (document.querySelector('.modal--show')) return;
    const croix = bulleOuverte();
    if (!croix) return;
    e.preventDefault();
    croix.click();
  }, true);
  document.addEventListener('click', (e) => {
    if (!e.isTrusted || !moderne()) return;
    const croix = bulleOuverte();
    if (!croix) return;
    const contenu = croix.closest('.js-window__content') || croix.parentElement;
    if (e.target instanceof Node && contenu.contains(e.target)) return;
    // Après MBN : si son propre bouton vient de refermer la bulle, ne rien faire.
    setTimeout(() => {
      if (croix.isConnected && croix.getClientRects().length && bulleOuverte() === croix) croix.click();
    }, 0);
  }, true);

  const { classeDansTexte, pour } = globalThis.mbnCouleurs;
  const texte = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // Le bandeau d'abord, puis la ligne d'informations placée dessous.
  const zones = [principal.querySelector(':scope > .panel'), principal.querySelector(':scope > .content-filter')];
  let classe = '';
  for (const zone of zones) {
    classe = classeDansTexte(texte(zone));
    if (classe) break;
  }
  const couleur = classe ? pour(classe) : null;
  if (!couleur) return;
  principal.dataset.mbnClasse = classe;
  principal.style.setProperty('--mbn-classe-pale', couleur.pale);
  principal.style.setProperty('--mbn-classe-bord', couleur.bord);
  principal.style.setProperty('--mbn-classe-fond', couleur.fond);
})();
