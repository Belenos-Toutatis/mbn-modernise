// MBN modernisé — page de détail d'une séance du cahier de textes.
// Repère la page (pour seance.css) et, si le nom de la classe figure dans le
// bandeau de la séance, lui donne la couleur de cette classe.

(() => {
  const principal = document.querySelector('main:has(> #windowViewSeances)');
  if (!principal) return;
  principal.classList.add('mbn-page-seance');

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
