// MBN modernisé — cahier de textes, vue en liste :
//   1. panneau de critères replié par défaut derrière un bouton ;
//   2. index flottant par mois, avec un bouton « Aujourd'hui », pour ne plus
//      faire défiler toute l'année.
// Les dates sont lues dans les en-têtes de séance, sur place dans la page.

(() => {
  const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout',
    'septembre', 'octobre', 'novembre', 'decembre'];
  const ABREGES = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août',
    'sept.', 'oct.', 'nov.', 'déc.'];
  const EN_LETTRES = new RegExp('(\\d{1,2})(?:er)?\\s+(' + MOIS.join('|') + ')(?:\\s+(\\d{4}))?');
  const EN_CHIFFRES = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;

  const sansAccents = (texte) => texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Sans année écrite, on retient celle de l'année scolaire en cours
  // (août à décembre : première année ; janvier à juillet : la suivante).
  const anneeScolaire = (mois) => {
    const maintenant = new Date();
    const debut = maintenant.getMonth() >= 7 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;
    return mois >= 7 ? debut : debut + 1;
  };

  const lireDate = (texte) => {
    const propre = sansAccents(texte);
    let jour, mois, annee;
    let m = EN_LETTRES.exec(propre);
    if (m) {
      jour = Number(m[1]); mois = MOIS.indexOf(m[2]); annee = m[3] && Number(m[3]);
    } else if ((m = EN_CHIFFRES.exec(propre))) {
      jour = Number(m[1]); mois = Number(m[2]) - 1; annee = m[3] && Number(m[3]);
      if (annee && annee < 100) annee += 2000;
    } else {
      return null;
    }
    if (mois < 0 || mois > 11 || jour < 1 || jour > 31) return null;
    return new Date(annee || anneeScolaire(mois), mois, jour);
  };

  // ---- 1. Panneau de critères repliable ----
  const installerCriteres = () => {
    const formulaire = document.getElementById('selecteur_critere_periode');
    if (!formulaire || formulaire.querySelector('.mbn-bascule-criteres')) return;

    const messages = document.getElementById('kui_messages');
    const aDesResultats = !!document.querySelector('.criteres_resultats_liste .jour');
    // Replié seulement s'il y a des séances à lire et aucun message d'erreur.
    let replie = aDesResultats && !(messages && messages.textContent.trim());

    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'mbn-bascule-criteres';
    const afficher = () => {
      formulaire.classList.toggle('mbn-replie', replie);
      bouton.textContent = (replie ? '▸' : '▾') + ' Critères de recherche';
      bouton.setAttribute('aria-expanded', String(!replie));
    };
    bouton.addEventListener('click', () => { replie = !replie; afficher(); });
    formulaire.prepend(bouton);
    afficher();
  };

  // ---- 2. Index par mois ----
  const installerIndex = () => {
    const liste = document.querySelector('.criteres_resultats_liste');
    if (!liste || document.querySelector('.mbn-index-cdt')) return;

    const seances = [];
    for (const entete of liste.querySelectorAll(':scope > .jour')) {
      const date = lireDate(entete.textContent);
      if (date) seances.push({ entete, date });
    }
    if (seances.length < 2) return; // dates illisibles ou liste trop courte : pas d'index

    const aller = (entete) => entete.scrollIntoView({ block: 'start' });
    const index = document.createElement('nav');
    index.className = 'mbn-index-cdt';
    index.setAttribute('aria-label', 'Aller à un mois');

    const ajouter = (libelle, titre, cible, classe) => {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.textContent = libelle;
      bouton.title = titre;
      if (classe) bouton.className = classe;
      bouton.addEventListener('click', () => aller(cible));
      index.appendChild(bouton);
    };

    // « Aujourd'hui » : la séance dont la date est la plus proche d'aujourd'hui.
    const maintenant = Date.now();
    const proche = seances.reduce((a, b) =>
      (Math.abs(b.date - maintenant) < Math.abs(a.date - maintenant) ? b : a));
    ajouter('Auj.', "Aller à la séance la plus proche d'aujourd'hui", proche.entete, 'mbn-aujourdhui');

    let precedent = '';
    for (const { entete, date } of seances) {
      const cle = date.getFullYear() + '-' + date.getMonth();
      if (cle === precedent) continue;
      precedent = cle;
      ajouter(ABREGES[date.getMonth()], `Aller à ${MOIS_COMPLETS[date.getMonth()]} ${date.getFullYear()}`, entete);
    }
    document.body.appendChild(index);
  };

  const MOIS_COMPLETS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
    'septembre', 'octobre', 'novembre', 'décembre'];

  // ---- 3. Couleur de la classe sur chaque séance ----
  // Le titre d'une séance mêle matière et classe (« MATIÈRE - 3A »…) : on
  // cherche, parmi ses morceaux, celui qui est un nom de classe.
  const estClasse = (morceau) => {
    const propre = morceau.trim();
    // Un horaire (« 08h00 », « 8:00 »), une date (« 16/11/2026 ») ou un
    // nombre seul commencent aussi par un chiffre : ce ne sont pas des classes.
    if (!propre || propre.length > 14) return false;
    if (/^\d{1,2}\s*[hH:]/.test(propre) || /^\d{1,4}[\/.]\d/.test(propre) || /^\d+$/.test(propre)) return false;
    return !!globalThis.mbnCouleurs.lireClasse(propre);
  };

  const classeDuTitre = (texte) => {
    for (const morceau of texte.split(/\s+[-–—|]\s+|\s*[,;]\s*/)) {
      if (estClasse(morceau)) return morceau.trim();
    }
    // Sans séparateur (« jeudi 3 septembre 2026 à 09:00 3A-GP1 ») : la classe
    // est le dernier mot.
    const mots = texte.trim().split(/\s+/);
    const dernier = mots[mots.length - 1] || '';
    return estClasse(dernier) ? dernier : '';
  };

  const marquer = (element, texte, avecPastille) => {
    const classe = classeDuTitre(texte);
    const couleur = classe && globalThis.mbnCouleurs.pour(classe);
    if (!couleur) return;
    element.dataset.mbnClasse = classe;
    element.style.setProperty('--mbn-classe-fond', couleur.fond);
    element.style.setProperty('--mbn-classe-bord', couleur.bord);
    element.style.setProperty('--mbn-classe-pale', couleur.pale);
    element.style.setProperty('--mbn-classe-texte', couleur.texte);
    if (avecPastille && !element.querySelector('.mbn-pastille-classe')) {
      const titre = element.querySelector('h4');
      const pastille = document.createElement('span');
      pastille.className = 'mbn-pastille-classe';
      pastille.textContent = classe;
      if (titre) titre.insertBefore(pastille, titre.querySelector(':scope > a'));
    }
  };

  const colorerSeances = () => {
    // vue « semaine en liste »
    for (const entete of document.querySelectorAll('.seancejour > .seance_deco')) {
      const lien = entete.querySelector('h4 > a');
      if (!lien) continue;
      marquer(entete, lien.textContent, true);
      // le contenu de la séance, juste dessous, porte le même liseré
      const detail = entete.nextElementSibling;
      if (detail && detail.classList.contains('seancejour_detail')) marquer(detail, lien.textContent, false);
    }
    // vue « liste » sur une période
    for (const entete of document.querySelectorAll('.criteres_resultats_liste > .jour')) {
      marquer(entete, entete.textContent, false);
    }
  };

  installerCriteres();
  installerIndex();
  colorerSeances();
})();
