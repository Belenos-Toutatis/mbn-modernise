// MBN modernisé — sélecteur d'heure à molettes, commun à plusieurs écrans.
// Deux molettes, heures et minutes, qu'on fait défiler à la molette de la
// souris, au doigt, au clavier, ou en cliquant sur une valeur.
//
//   mbnRoue.ouvrir({ champ, depart, surChangement, surFermeture })
//     champ          : le champ sous lequel le panneau s'affiche
//     depart         : heure affichée à l'ouverture, en minutes depuis minuit
//     surChangement  : appelée avec l'heure (en minutes) à chaque changement
//     surFermeture   : appelée avec (valide, heure) ; valide est faux après Échap
//   mbnRoue.fermer(valide)
//   mbnRoue.champOuvert()

(() => {
  const PAS = 36; // hauteur d'une valeur, en pixels (voir roue-heure.css)
  const deux = (n) => String(n).padStart(2, '0');
  let ouverte = null; // { panneau, champ, valeur, surFermeture }

  const fermer = (valide = true) => {
    if (!ouverte) return;
    const o = ouverte;
    ouverte = null;
    o.panneau.remove();
    if (o.surFermeture) o.surFermeture(valide, o.valeur());
  };

  const molette = (valeurs, actuelle, nom, texte, surChangement) => {
    const col = document.createElement('div');
    col.className = 'mbn-roue__col';
    col.tabIndex = 0;
    col.setAttribute('role', 'listbox');
    col.setAttribute('aria-label', nom);
    const cases = valeurs.map((v) => {
      const c = document.createElement('div');
      c.className = 'mbn-roue__val';
      c.setAttribute('role', 'option');
      c.textContent = texte(v);
      col.append(c);
      return c;
    });
    let index = Math.max(0, valeurs.indexOf(actuelle));
    const marquerCase = () => cases.forEach((c, i) => c.setAttribute('aria-selected', String(i === index)));
    // Déplacement immédiat : un défilement animé peut être interrompu par le
    // cran de molette suivant et laisser la molette entre deux valeurs.
    const aller = (i) => {
      index = Math.max(0, Math.min(valeurs.length - 1, i));
      col.scrollTop = index * PAS;
      marquerCase();
      surChangement();
    };
    // Défilement au doigt ou à la barre : on retient la valeur arrêtée au centre.
    let attente = 0;
    col.addEventListener('scroll', () => {
      clearTimeout(attente);
      attente = setTimeout(() => {
        const i = Math.max(0, Math.min(valeurs.length - 1, Math.round(col.scrollTop / PAS)));
        if (i !== index) { index = i; marquerCase(); surChangement(); }
      }, 110);
    }, { passive: true });
    // Molette de la souris : un cran = une valeur.
    let dernierCran = 0;
    col.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Un pavé tactile envoie des dizaines d'événements par geste : pas plus
      // d'une valeur toutes les 70 ms, pour garder la main.
      const maintenant = Date.now();
      if (!e.deltaY || maintenant - dernierCran < 70) return;
      dernierCran = maintenant;
      aller(index + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
    col.addEventListener('click', (e) => {
      const i = cases.indexOf(e.target);
      if (i >= 0) aller(i);
    });
    col.addEventListener('keydown', (e) => {
      const saut = { ArrowDown: 1, ArrowUp: -1, PageDown: 3, PageUp: -3 }[e.key];
      if (!saut) return;
      e.preventDefault();
      aller(index + saut);
    });
    return { col, valeur: () => valeurs[index], placer: () => { col.scrollTop = index * PAS; marquerCase(); } };
  };

  const ouvrir = ({ champ, depart, surChangement, surFermeture }) => {
    if (ouverte && ouverte.champ === champ) return;
    fermer();
    const heures = Array.from({ length: 24 }, (_, h) => h);
    const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
    if (!minutes.includes(depart % 60)) { minutes.push(depart % 60); minutes.sort((a, b) => a - b); }

    const panneau = document.createElement('div');
    panneau.className = 'mbn-roue';
    panneau.setAttribute('role', 'dialog');
    panneau.setAttribute('aria-label', 'Choix de l’heure');
    // Les molettes se calent à l'ouverture : on ignore ces premiers mouvements.
    let pret = false;
    let h;
    let m;
    const valeur = () => h.valeur() * 60 + m.valeur();
    const prevenir = () => { if (pret && surChangement) surChangement(valeur()); };
    h = molette(heures, Math.floor(depart / 60), 'Heures', (v) => `${v} h`, prevenir);
    m = molette(minutes, depart % 60, 'Minutes', (v) => deux(v), prevenir);
    const roues = document.createElement('div');
    roues.className = 'mbn-roue__roues';
    const points = document.createElement('span');
    points.className = 'mbn-roue__points';
    points.textContent = ':';
    roues.append(h.col, points, m.col);
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'mbn-roue__ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => fermer(true));
    panneau.append(roues, ok);
    document.body.append(panneau);

    // Sous le champ ; au-dessus s'il n'y a pas la place.
    const r = champ.getBoundingClientRect();
    const hauteur = panneau.offsetHeight;
    const dessous = r.bottom + 6 + hauteur <= innerHeight || r.top - 6 - hauteur < 0;
    panneau.style.top = `${(dessous ? r.bottom + 6 : r.top - 6 - hauteur) + scrollY}px`;
    panneau.style.left = `${Math.max(8, Math.min(r.left, innerWidth - panneau.offsetWidth - 8)) + scrollX}px`;
    h.placer();
    m.placer();
    setTimeout(() => { pret = true; }, 200);
    ouverte = { panneau, champ, valeur, surFermeture };
  };

  const dehors = (cible) => ouverte && !ouverte.panneau.contains(cible) && cible !== ouverte.champ;
  document.addEventListener('mousedown', (e) => { if (dehors(e.target)) fermer(true); }, true);
  document.addEventListener('focusin', (e) => { if (dehors(e.target)) fermer(true); });
  document.addEventListener('keydown', (e) => {
    if (!ouverte || (e.key !== 'Escape' && e.key !== 'Enter')) return;
    e.preventDefault();
    e.stopPropagation();
    fermer(e.key === 'Enter');
  }, true);

  globalThis.mbnRoue = { ouvrir, fermer, champOuvert: () => (ouverte ? ouverte.champ : null) };
})();
