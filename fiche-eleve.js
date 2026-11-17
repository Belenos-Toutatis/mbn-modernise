// MBN modernisé — fiche d'un élève (contacts, emploi du temps, vie scolaire,
// résultats, commentaires). Repère la page (pour fiche-eleve.css), donne à la
// pastille de classe la couleur de la classe, et rouvre la fiche sur le
// dernier onglet consulté.

(() => {
  const resume = document.getElementById('sele--ficheeleve_resume');
  const principal = resume && resume.closest('main');
  if (!principal) return;
  principal.classList.add('mbn-fiche-eleve');
  const texte = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // Pastille de la classe, aux couleurs communes à toute l'extension.
  if (globalThis.mbnCouleurs) {
    for (const pastille of resume.querySelectorAll('.cartouche')) {
      const libelle = texte(pastille);
      if (!globalThis.mbnCouleurs.lireClasse(libelle)) continue;
      const couleur = globalThis.mbnCouleurs.pour(libelle);
      if (!couleur) continue;
      pastille.classList.add('mbn-pastille-classe');
      pastille.style.setProperty('--mbn-classe-fond', couleur.fond);
      pastille.style.setProperty('--mbn-classe-bord', couleur.bord);
      pastille.style.setProperty('--mbn-classe-texte', couleur.texte || '#1f2933');
      break;
    }
  }

  // ---- Dernier onglet consulté ----
  // Seul le nom de l'onglet (paramètre TAB du lien) est mémorisé, jamais l'élève.
  const onglets = () => [...principal.querySelectorAll('.grid__item .content-filter a.tabs__link[href]')];
  const nomOnglet = (lien) => {
    try { return new URL(lien.href, location.href).searchParams.get('TAB'); } catch { return null; }
  };
  principal.addEventListener('click', (e) => {
    const lien = e.isTrusted && e.target instanceof Element ? e.target.closest('a.tabs__link[href]') : null;
    if (!lien || !onglets().includes(lien)) return;
    const nom = nomOnglet(lien);
    if (nom) chrome.storage.local.set({ ficheEleveOnglet: nom });
  }, true);

  // Fiche ouverte sans onglet précisé : on passe à celui mémorisé, en suivant
  // le lien de MBN. Une seule tentative rapprochée, pour ne jamais boucler.
  if (new URLSearchParams(location.search).has('TAB')) return;
  chrome.storage.local.get({ ficheEleveOnglet: '' }).then(({ ficheEleveOnglet }) => {
    if (!ficheEleveOnglet || !document.documentElement.classList.contains('mbn-moderne')) return;
    const lien = onglets().find((l) => nomOnglet(l) === ficheEleveOnglet);
    if (!lien || lien.classList.contains('active')) return;
    try {
      const dernier = Number(sessionStorage.getItem('mbnFicheOnglet') || 0);
      if (Date.now() - dernier < 8000) return;
      sessionStorage.setItem('mbnFicheOnglet', String(Date.now()));
    } catch { return; }
    location.replace(lien.href);
  });
})();
