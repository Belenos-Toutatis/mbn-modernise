// MBN modernisé — planning hebdomadaire d'une ressource réservable.
//  - repère la page (pour reservations.css) : un clic n'importe où dans une
//    case libre ouvre la réservation, plus seulement le petit « + » ;
//  - colore vos propres réservations et donne à chacune une infobulle complète ;
//  - masque le week-end quand il est vide (bouton pour le réafficher).

(() => {
  const grille = document.getElementById('vue_hebdomadaire');
  const calque = document.getElementById('evenements');
  const principal = grille && calque && grille.closest('main');
  if (!principal) return;
  principal.classList.add('mbn-planning-resa');

  const propre = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const plat = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const blocs = [...calque.querySelectorAll('.bloc_evenement')];

  // ---- Vos réservations ----
  // Le nom affiché dans le menu est comparé à celui porté par chaque réservation.
  const moi = propre((document.querySelector('nav.menu ul.user > li') || {}).textContent);
  const mots = (t) => plat(t).split(/[^a-z]+/).filter((m) => m.length >= 3 && !/^(mme|mlle|madame|monsieur)$/.test(m));
  const mesMots = new Set(mots(moi));
  const estAMoi = (personne) => {
    const siens = mots(personne);
    if (!siens.length || !mesMots.size) return false;
    const communs = siens.filter((m) => mesMots.has(m)).length;
    return communs === siens.length || communs >= 2;
  };

  // ---- Infobulles ----
  let miennes = 0;
  for (const bloc of blocs) {
    const heure = propre((bloc.querySelector('.heure_precise') || {}).textContent);
    const titre = propre((bloc.querySelector('.titre') || {}).textContent);
    const personne = propre((bloc.querySelector('.personne') || {}).textContent);
    if (!bloc.title) bloc.title = [heure, titre, personne].filter(Boolean).join('\n');
    if (estAMoi(personne)) { bloc.classList.add('mbn-mienne'); miennes += 1; }
  }
  chrome.storage.local.remove('resaCreneaux'); // mémoire d'une version précédente, plus utilisée

  // ---- Barre : légende et week-end ----
  const barre = principal.querySelector('.navigation_agenda');
  const outils = document.createElement('span');
  outils.className = 'mbn-planning-outils';
  if (miennes) {
    const legende = document.createElement('span');
    legende.className = 'mbn-planning-legende';
    legende.textContent = miennes === 1 ? 'Votre réservation' : 'Vos réservations';
    outils.append(legende);
  }

  // Samedi et dimanche : masqués s'ils sont vides et si les deux tableaux
  // superposés de MBN restent bien alignés une fois les colonnes retirées.
  const enTetes = [...grille.querySelectorAll('thead th')];
  const iSam = enTetes.findIndex((th) => th.id === 'semaine_jour_samedi');
  const iDim = enTetes.findIndex((th) => th.id === 'semaine_jour_dimanche');
  const ligne = calque.querySelector('table.evenements tr');
  const cases = ligne ? [...ligne.children] : [];
  const masquable = enTetes.length === 8 && iSam === 6 && iDim === 7 && cases.length === 8 &&
    !cases[6].querySelector('.bloc_evenement') && !cases[7].querySelector('.bloc_evenement');
  if (masquable) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'mbn-planning-weekend';
    const appliquer = (montrer) => {
      principal.classList.toggle('mbn-sans-weekend', !montrer);
      if (!montrer) {
        // Garde-fou : si les colonnes ne coïncident plus, on revient en arrière.
        const ecart = Math.abs(enTetes[5].getBoundingClientRect().left - cases[5].getBoundingClientRect().left);
        if (ecart > 3) { principal.classList.remove('mbn-sans-weekend'); bouton.remove(); return; }
      }
      bouton.textContent = montrer ? 'Masquer le week-end' : 'Afficher le week-end';
      bouton.setAttribute('aria-pressed', String(montrer));
    };
    chrome.storage.local.get({ resaWeekend: false }).then(({ resaWeekend }) => {
      outils.append(bouton);
      appliquer(!!resaWeekend);
    });
    bouton.addEventListener('click', () => {
      const montrer = principal.classList.contains('mbn-sans-weekend');
      appliquer(montrer);
      chrome.storage.local.set({ resaWeekend: montrer });
    });
  }
  if (barre) {
    const vues = barre.querySelector('.scheduler-group__views');
    if (vues) vues.before(outils); else barre.append(outils);
  }
})();
