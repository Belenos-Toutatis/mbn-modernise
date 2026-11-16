// MBN modernisé — cahier de textes, vue en liste sur une période :
//   1. raccourcis de période (« Cette semaine », « Ce mois »…) ;
//   2. filtre instantané des séances affichées, par classe et par texte ;
//   3. critères de recherche mémorisés d'une visite à l'autre.
// Chargé après cahier-liste.js, qui a déjà repéré la classe de chaque séance.

(() => {
  const formulaire = document.getElementById('selecteur_critere_periode');
  const liste = document.querySelector('.criteres_resultats_liste');
  if (!formulaire && !liste) return;

  const sansAccents = (texte) => texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const boutonValider = () => formulaire.querySelector(
    '.valider-formulaire input[type="submit"], .valider-formulaire button[type="submit"], input.submit');

  const valider = () => {
    const bouton = boutonValider();
    if (bouton) bouton.click();
    else if (formulaire.requestSubmit) formulaire.requestSubmit();
    else formulaire.submit();
  };

  // ---- 1. Raccourcis de période ----
  const installerRaccourcis = () => {
    const debut = document.getElementById('DATE_DEBUT');
    const fin = document.getElementById('DATE_FIN');
    if (!formulaire || !debut || !fin || formulaire.querySelector('.mbn-raccourcis')) return;

    // On écrit les dates dans le format déjà utilisé par les deux champs.
    const modele = (debut.value || fin.value || '').trim();
    const deux = (n) => String(n).padStart(2, '0');
    let ecrire;
    if (!modele || /^\d{2}\/\d{2}\/\d{4}$/.test(modele)) {
      ecrire = (d) => `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(modele)) {
      ecrire = (d) => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
    } else {
      return; // format inconnu : on ne risque pas d'écrire des dates fausses
    }

    const aujourdhui = new Date();
    aujourdhui.setHours(12, 0, 0, 0);
    const decaler = (date, jours) => { const r = new Date(date); r.setDate(r.getDate() + jours); return r; };
    const lundi = decaler(aujourdhui, -((aujourdhui.getDay() + 6) % 7));
    const annee = aujourdhui.getFullYear();
    const mois = aujourdhui.getMonth();
    const rentree = new Date(mois >= 7 ? annee : annee - 1, 8, 1, 12);

    const periodes = [
      ['Semaine dernière', decaler(lundi, -7), decaler(lundi, -1)],
      ['Cette semaine', lundi, decaler(lundi, 6)],
      ['Semaine prochaine', decaler(lundi, 7), decaler(lundi, 13)],
      ['Ce mois', new Date(annee, mois, 1, 12), new Date(annee, mois + 1, 0, 12)],
      ['Depuis la rentrée', rentree, aujourdhui],
    ];

    const barre = document.createElement('div');
    barre.className = 'mbn-raccourcis';
    for (const [libelle, duVoulu, auVoulu] of periodes) {
      // période ramenée dans l'année scolaire, ou écartée si elle est dehors
      const bornee = globalThis.mbnPeriodes.borner(duVoulu, auVoulu);
      if (!bornee) continue;
      const [du, au] = bornee;
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.textContent = libelle;
      bouton.title = `Du ${ecrire(du)} au ${ecrire(au)}`;
      if (debut.value.trim() === ecrire(du) && fin.value.trim() === ecrire(au)) bouton.classList.add('mbn-actif');
      bouton.addEventListener('click', () => {
        debut.value = ecrire(du);
        fin.value = ecrire(au);
        for (const champ of [debut, fin]) champ.dispatchEvent(new Event('change', { bubbles: true }));
        valider();
      });
      barre.appendChild(bouton);
    }
    const bascule = formulaire.querySelector('.mbn-bascule-criteres');
    if (bascule) bascule.after(barre);
    else formulaire.prepend(barre);
  };

  // ---- 3. Critères mémorisés (listes et cases à cocher, pas les dates) ----
  const champsMemorises = () =>
    [...formulaire.querySelectorAll('select[id], input[type="checkbox"][id]')];

  const memoriser = () => {
    const valeurs = {};
    for (const champ of champsMemorises()) {
      valeurs[champ.id] = champ.type === 'checkbox' ? champ.checked : champ.value;
    }
    chrome.storage.local.set({ cahierCriteres: valeurs });
  };

  // Garde-fou contre une boucle de rechargements (voir devoirs.js).
  const dejaTente = () => {
    try {
      const maintenant = Date.now();
      const recentes = JSON.parse(sessionStorage.getItem('mbnCahierCriteres') || '[]').filter((t) => maintenant - t < 8000);
      if (recentes.length >= 2) return true;
      recentes.push(maintenant);
      sessionStorage.setItem('mbnCahierCriteres', JSON.stringify(recentes));
    } catch { /* stockage indisponible : on tente quand même */ }
    return false;
  };

  const installerMemoire = () => {
    if (!formulaire) return;
    // Enregistrement à chaque recherche lancée, quel que soit le moyen.
    formulaire.addEventListener('submit', memoriser, true);
    const bouton = boutonValider();
    if (bouton) bouton.addEventListener('click', memoriser, true);

    chrome.storage.local.get({ cahierCriteres: null }).then(({ cahierCriteres }) => {
      if (!cahierCriteres) return;
      // On compare à ce que MBN a réellement appliqué (l'état écrit dans la
      // page), pas à ce que le navigateur a pu remettre dans les champs.
      let ecart = false;
      for (const champ of champsMemorises()) {
        if (!(champ.id in cahierCriteres)) continue;
        const voulu = cahierCriteres[champ.id];
        if (champ.type === 'checkbox') {
          if (champ.defaultChecked !== voulu) ecart = true;
          champ.checked = voulu;
        } else {
          if (![...champ.options].some((o) => o.value === voulu)) continue;
          const applique = [...champ.options].find((o) => o.defaultSelected) || champ.options[0];
          if (!applique || applique.value !== voulu) ecart = true;
          champ.value = voulu;
        }
      }
      if (ecart && !dejaTente()) valider();
    });
  };

  // ---- 2. Filtre instantané des séances affichées ----
  const installerFiltre = () => {
    if (!liste || liste.querySelector('.mbn-filtre-cdt')) return;

    // Une séance = son en-tête (.jour) et les rubriques qui le suivent.
    const seances = [];
    let courante = null;
    for (const el of liste.children) {
      if (el.classList.contains('jour')) {
        courante = { elements: [el], classe: el.dataset.mbnClasse || '' };
        seances.push(courante);
      } else if (courante && el.classList.contains('seance_section')) {
        courante.elements.push(el);
      }
    }
    if (seances.length < 2) return;
    for (const seance of seances) {
      seance.texte = sansAccents(seance.elements.map((el) => el.textContent).join(' '));
    }

    const AUTRES = '\u0000autres';
    const choisies = new Set();
    let recherche = '';

    const barre = document.createElement('div');
    barre.className = 'mbn-filtre-cdt';

    const champ = document.createElement('input');
    champ.type = 'search';
    champ.placeholder = 'Filtrer les séances affichées…';
    champ.setAttribute('aria-label', 'Filtrer les séances affichées');
    barre.appendChild(champ);

    const compteur = document.createElement('span');
    compteur.className = 'mbn-filtre-compteur';

    const appliquer = () => {
      let visibles = 0;
      for (const seance of seances) {
        const classeOk = !choisies.size || choisies.has(seance.classe || AUTRES);
        const texteOk = !recherche || seance.texte.includes(recherche);
        const visible = classeOk && texteOk;
        if (visible) visibles++;
        for (const el of seance.elements) el.classList.toggle('mbn-masque', !visible);
      }
      compteur.textContent = visibles === seances.length
        ? `${seances.length} séances`
        : `${visibles} séance${visibles > 1 ? 's' : ''} sur ${seances.length}`;
    };

    // Une pastille par classe présente, de la 6e à la 3e.
    const classes = [...new Set(seances.map((s) => s.classe).filter(Boolean))].sort((a, b) => {
      const na = globalThis.mbnCouleurs.lireClasse(a);
      const nb = globalThis.mbnCouleurs.lireClasse(b);
      return (nb ? nb.niveau : 0) - (na ? na.niveau : 0) || a.localeCompare(b, 'fr', { numeric: true });
    });
    const cles = classes.map((c) => [c, c]);
    if (classes.length && seances.some((s) => !s.classe)) cles.push([AUTRES, 'Autres']);

    if (cles.length > 1) {
      for (const [cle, libelle] of cles) {
        const pastille = document.createElement('button');
        pastille.type = 'button';
        pastille.className = 'mbn-filtre-classe';
        pastille.textContent = libelle;
        pastille.setAttribute('aria-pressed', 'false');
        const couleur = cle !== AUTRES && globalThis.mbnCouleurs.pour(cle);
        if (couleur) {
          pastille.style.setProperty('--mbn-classe-fond', couleur.fond);
          pastille.style.setProperty('--mbn-classe-bord', couleur.bord);
          pastille.style.setProperty('--mbn-classe-texte', couleur.texte);
        }
        pastille.addEventListener('click', () => {
          if (choisies.has(cle)) choisies.delete(cle);
          else choisies.add(cle);
          pastille.setAttribute('aria-pressed', String(choisies.has(cle)));
          barre.classList.toggle('mbn-filtre-actif', choisies.size > 0);
          appliquer();
        });
        barre.appendChild(pastille);
      }
    }
    barre.appendChild(compteur);

    champ.addEventListener('input', () => {
      recherche = sansAccents(champ.value.trim());
      appliquer();
    });

    const titre = liste.querySelector(':scope > #titre_ecran');
    if (titre) titre.after(barre);
    else liste.prepend(barre);
    appliquer();

    // La barre reste collée en haut : les en-têtes de séance se collent dessous.
    const mesurer = () => document.documentElement.style.setProperty('--mbn-haut-filtre', barre.offsetHeight + 'px');
    new ResizeObserver(mesurer).observe(barre);
    mesurer();
  };

  globalThis.mbnPeriodes.pret.then(installerRaccourcis);
  installerMemoire();
  installerFiltre();
})();
