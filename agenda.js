// MBN modernisé — grille horaire (cahier de textes, et tout écran MBN bâti
// sur le même composant « scheduler ») étirée à la hauteur de la fenêtre.
//
// MBN écrit la hauteur de chaque créneau en dur : « calc(4rem * minutes / 60) »,
// soit 4rem par heure quelle que soit la fenêtre. On remplace ce 4rem par la
// variable --mbn-heure, puis on règle cette variable pour que la journée
// remplisse la hauteur disponible. On n'agrandit jamais au-delà de 3 fois la
// taille d'origine, et on ne réduit jamais.

(() => {
  const BASE = /calc\(4rem \*/g;
  const MINUTES = /\* (\d+(?:\.\d+)?) \/ 60\)/;
  const AGRANDISSEMENT_MAX = 3;
  let prevu = false;

  const ajuster = (grille) => {
    grille.querySelectorAll('[style*="calc(4rem *"]').forEach((el) => {
      el.setAttribute('style', el.getAttribute('style').replace(BASE, 'calc(var(--mbn-heure, 4rem) *'));
    });

    // Le calque des séances couvre toute la journée : sa hauteur donne sa durée.
    const calque = grille.querySelector('.scheduler__events-overlay, .scheduler__slots-overlay');
    const duree = calque && MINUTES.exec(calque.getAttribute('style') || '');
    const actif = document.documentElement.classList.contains('mbn-moderne');

    let valeur = '';
    if (duree && actif) {
      const heures = Number(duree[1]) / 60;
      const base = 4 * parseFloat(getComputedStyle(document.documentElement).fontSize);
      const haut = calque.getBoundingClientRect().top + window.scrollY;
      const voulue = Math.min(base * AGRANDISSEMENT_MAX, (window.innerHeight - haut - 8) / heures);
      if (voulue > base * 1.05) valeur = voulue.toFixed(2) + 'px';
    }
    if (grille.style.getPropertyValue('--mbn-heure') !== valeur) {
      if (valeur) grille.style.setProperty('--mbn-heure', valeur);
      else grille.style.removeProperty('--mbn-heure');
    }
  };

  // ---- Couleurs des séances ----
  // Plusieurs classes affichées : une teinte par niveau, une nuance par classe.
  // Une seule classe (cahier de textes d'une classe) : une couleur par matière.

  const { lireClasse, empreinte, pour } = globalThis.mbnCouleurs;
  const TEINTES_MATIERE = [0, 30, 55, 90, 140, 170, 195, 220, 255, 285, 315, 340];

  // Une teinte stable par matière (tirée de son nom) ; si deux matières de la
  // page tombent sur la même, la seconde prend la teinte libre suivante.
  const teintesParMatiere = (noms) => {
    const prises = new Set();
    const resultat = new Map();
    for (const nom of [...noms].sort()) {
      let i = empreinte(nom) % TEINTES_MATIERE.length;
      for (let essais = 0; prises.has(i) && essais < TEINTES_MATIERE.length; essais++) {
        i = (i + 1) % TEINTES_MATIERE.length;
      }
      prises.add(i);
      resultat.set(nom, TEINTES_MATIERE[i]);
    }
    return resultat;
  };

  // MBN délave la couleur de fond des séances (seul le liseré gauche garde
  // la couleur franche). On transmet donc aussi la couleur par la variable
  // --mbn-fond, que agenda-moderne.css applique par-dessus ce voile.
  const peindre = (carte, { fond, bord, texte }) => {
    if (carte.dataset.mbnFond === undefined) {
      carte.dataset.mbnFond = carte.style.backgroundColor;
      carte.dataset.mbnBord = carte.style.borderLeftColor;
      carte.dataset.mbnContour = carte.style.outlineColor;
    }
    if (carte.dataset.mbnPeint === fond) return;
    carte.dataset.mbnPeint = fond;
    carte.style.backgroundColor = fond;
    carte.style.borderLeftColor = bord;
    carte.style.outlineColor = bord;
    carte.style.setProperty('--mbn-fond', fond);
    carte.style.setProperty('--mbn-texte', texte);
  };

  const restaurer = (carte) => {
    if (carte.dataset.mbnFond === undefined) return;
    carte.style.backgroundColor = carte.dataset.mbnFond;
    carte.style.borderLeftColor = carte.dataset.mbnBord;
    carte.style.outlineColor = carte.dataset.mbnContour;
    carte.style.removeProperty('--mbn-fond');
    carte.style.removeProperty('--mbn-texte');
    delete carte.dataset.mbnFond;
    delete carte.dataset.mbnBord;
    delete carte.dataset.mbnContour;
    delete carte.dataset.mbnPeint;
  };

  const colorer = (grille) => {
    const cartes = [...grille.querySelectorAll('.scheduler__card')];
    if (!document.documentElement.classList.contains('mbn-couleurs')) {
      cartes.forEach(restaurer);
      return;
    }
    const lire = (carte, selecteur) => {
      const el = carte.querySelector(selecteur);
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    };
    const infos = cartes.map((carte) => {
      const titre = lire(carte, '.scheduler__card-title');
      return {
        carte,
        titre,
        matiere: lire(carte, '.scheduler__card-subject'),
        classe: lireClasse(titre),
        // MBN estompe le texte des séances passées, illisible sur un fond
        // coloré : on éclaircit plutôt leur fond, et le texte reste net.
        passee: carte.classList.contains('scheduler__card--session-past'),
      };
    });
    const distincts = (valeurs) => new Set(valeurs.filter(Boolean));
    const classes = distincts(infos.map((i) => i.classe && i.classe.cle));
    const titres = distincts(infos.map((i) => i.titre));
    const matieres = distincts(infos.map((i) => i.matiere));

    if (classes.size < 2 && Math.max(titres.size, matieres.size) >= 2) {
      // Une seule classe : couleur par matière (le champ le plus varié des deux).
      const champ = matieres.size >= titres.size ? 'matiere' : 'titre';
      const teintes = teintesParMatiere(champ === 'matiere' ? matieres : titres);
      for (const info of infos) {
        const teinte = teintes.get(info[champ]);
        if (teinte === undefined) restaurer(info.carte);
        else {
          const fond = info.passee ? `hsl(${teinte}, 40%, 85%)` : `hsl(${teinte}, 65%, 73%)`;
          peindre(info.carte, { fond, bord: `hsl(${teinte}, 70%, 30%)`, texte: '#10151c' });
        }
      }
      return;
    }
    for (const { carte, titre, passee } of infos) {
      const couleur = pour(titre, false, passee);
      if (couleur) peindre(carte, couleur);
      else restaurer(carte);
    }
  };

  // ---- Fenêtre de détail d'une séance ----
  // Le panneau qui s'ouvre au clic sur une séance prend la couleur de la
  // classe de cette séance (bandeau du haut), d'après la carte cliquée.
  const colorerFenetres = () => {
    const actif = document.documentElement.classList.contains('mbn-couleurs');
    for (const fenetre of document.querySelectorAll('.scheduler > .window--panel')) {
      const carte = document.querySelector('.scheduler__card--focus .scheduler__card-title');
      const ouverte = !fenetre.classList.contains('hide');
      const couleur = actif && ouverte && carte ? pour(carte.textContent.replace(/\s+/g, ' ').trim()) : null;
      const cle = couleur ? couleur.bord : '';
      if ((fenetre.dataset.mbnClasse || '') === cle) continue;
      if (!couleur) {
        delete fenetre.dataset.mbnClasse;
        for (const nom of ['pale', 'bord', 'fond']) fenetre.style.removeProperty('--mbn-classe-' + nom);
        continue;
      }
      fenetre.dataset.mbnClasse = cle;
      fenetre.style.setProperty('--mbn-classe-pale', couleur.pale);
      fenetre.style.setProperty('--mbn-classe-bord', couleur.bord);
      fenetre.style.setProperty('--mbn-classe-fond', couleur.fond);
    }
  };

  // Échap referme la fenêtre de séance (sauf pendant une saisie).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !document.documentElement.classList.contains('mbn-moderne')) return;
    const cible = e.target;
    if (cible instanceof Element && (cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))) return;
    const fenetre = document.querySelector('.scheduler > .window--panel:not(.hide)');
    const fermer = fenetre && fenetre.querySelector('.js-window__close');
    if (fermer && fermer.getClientRects().length) fermer.click();
  });

  const planifier = () => {
    if (prevu) return;
    prevu = true;
    requestAnimationFrame(() => {
      prevu = false;
      document.querySelectorAll('.scheduler').forEach((grille) => {
        ajuster(grille);
        colorer(grille);
      });
      colorerFenetres();
    });
  };

  planifier();
  window.addEventListener('resize', planifier);
  new MutationObserver(planifier).observe(document.documentElement, { childList: true, subtree: true });
  // L'ouverture et la fermeture de la fenêtre de séance ne changent que des classes.
  for (const fenetre of document.querySelectorAll('.scheduler > .window--panel')) {
    new MutationObserver(planifier).observe(fenetre, { attributes: true, attributeFilter: ['class'] });
  }
  document.addEventListener('click', () => setTimeout(planifier, 150), true);
})();
