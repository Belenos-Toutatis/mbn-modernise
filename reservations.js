// MBN modernisé — liste des ressources réservables (PROC=RESA_RESSOURCES).
// Repère la page (pour reservations.css) et ajoute trois commodités :
//  - un clic sur le nom d'une famille la déplie, comme le petit bouton « + » ;
//  - un bouton « Tout déplier / Tout replier » ;
//  - les familles dépliées sont mémorisées et rouvertes à la visite suivante.
// Le script ne fait que cliquer sur les boutons « + » de MBN ; il ne réserve rien.

(() => {
  if (!/[?&]PROC=RESA_RESSOURCES(&|$)/.test(location.search)) return;
  const liste = document.querySelector('.js-liste-rubrique');
  const principal = liste && liste.closest('main');
  if (!principal) return;
  principal.classList.add('mbn-resa');

  const CLE = 'resaOuvertes';
  const moderne = () => document.documentElement.classList.contains('mbn-moderne');

  // Familles dépliables : celles dont la première colonne porte un bouton.
  const familles = () => [...liste.querySelectorAll('li.js-rubrique-item')]
    .map((li) => ({ li, bouton: li.querySelector(':scope > div.col > button'), icone: li.querySelector(':scope > div.col > button .js-plus') }))
    .filter((f) => f.bouton && f.icone);
  const ouverte = (f) => !f.icone.classList.contains('icon--plus');

  // ---- Clic sur le nom ----
  liste.addEventListener('click', (e) => {
    if (!moderne() || !(e.target instanceof Element) || e.target.closest('button, a, input, label')) return;
    const colonne = e.target.closest('li.js-rubrique-item > div.col');
    const bouton = colonne && colonne.querySelector(':scope > button');
    if (bouton && e.target.closest('span')) bouton.click();
  });

  // ---- Tout déplier / tout replier ----
  const tout = document.createElement('button');
  tout.type = 'button';
  tout.className = 'mbn-resa-tout';
  const titre = principal.querySelector('.panel__title--sm');
  if (titre) titre.closest('.row').append(tout);
  const libeller = () => {
    const f = familles();
    tout.hidden = f.length === 0;
    tout.textContent = f.length && f.every(ouverte) ? 'Tout replier' : 'Tout déplier';
  };
  tout.addEventListener('click', () => {
    const f = familles();
    const replier = f.every(ouverte);
    for (const famille of f) if (ouverte(famille) === replier) famille.bouton.click();
  });

  // ---- Mémoire des familles dépliées ----
  let pret = false;
  let minuterie = 0;
  const noter = () => {
    libeller();
    if (!pret) return;
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      const ids = familles().filter(ouverte).map((f) => f.li.id).filter(Boolean);
      chrome.storage.local.set({ [CLE]: ids });
    }, 300);
  };
  new MutationObserver(noter).observe(liste, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });

  chrome.storage.local.get({ [CLE]: [] }).then((valeurs) => {
    const ids = new Set(Array.isArray(valeurs[CLE]) ? valeurs[CLE] : []);
    if (moderne()) {
      for (const famille of familles()) {
        if (ids.has(famille.li.id) && !ouverte(famille)) famille.bouton.click();
      }
    }
    pret = true;
    libeller();
  });
})();
