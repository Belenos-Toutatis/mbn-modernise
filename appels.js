// MBN modernisé — appel du jour et historique des appels.
//   - appel du jour : couleur de classe sur les vignettes de séance, bilan
//     chiffré au-dessus de la feuille (présents, absents, retards…) ;
//   - historique : couleur de classe par ligne, repérage des appels non
//     saisis, raccourcis de période.
// Lecture seule : ce script ne coche rien et ne modifie aucune saisie.

(() => {
  const feuille = document.getElementById('grille_appel');
  const historique = document.getElementById('grille_histo_appel');
  const menu = document.querySelector('.menu-seances');
  const filtre = document.getElementById('filtre_absences');
  if (!feuille && !historique && !menu && !filtre) return;

  const { pour } = globalThis.mbnCouleurs;

  const colorer = (element, libelle) => {
    const couleur = libelle ? pour(libelle, true) : null;
    if (element.dataset.mbnClasse === libelle) return;
    if (!couleur) { delete element.dataset.mbnClasse; return; }
    element.dataset.mbnClasse = libelle;
    element.style.setProperty('--mbn-classe-fond', couleur.fond);
    element.style.setProperty('--mbn-classe-bord', couleur.bord);
    element.style.setProperty('--mbn-classe-pale', couleur.pale);
    element.style.setProperty('--mbn-classe-texte', couleur.texte);
  };
  const texte = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const differer = (fonction) => {
    let prevu = false;
    return () => {
      if (prevu) return;
      prevu = true;
      setTimeout(() => { prevu = false; fonction(); }, 80);
    };
  };

  // ---- Appel du jour : vignettes de séance ----
  if (menu) {
    for (const seance of menu.querySelectorAll('a.absences-menu-cal')) {
      colorer(seance, texte(seance.querySelector('.libClasse')));
    }
  }

  // ---- Appel du jour : bilan chiffré ----
  if (feuille) {
    const bilan = document.createElement('div');
    bilan.className = 'mbn-bilan-appel';
    feuille.before(bilan);

    const compter = () => {
      const lignes = [...feuille.querySelectorAll('tbody.yui-dt-data > tr')].filter((tr) => tr.getClientRects().length);
      const coches = (colonne) => lignes.filter((tr) => tr.querySelector(`td.yui-dt-col-${colonne} .icon--check`)).length;
      const pastilles = [
        ['', lignes.length, 'élève'],
        ['mbn-presents', coches('present'), 'présent'],
        ['mbn-absents', coches('absent'), 'absent'],
        ['mbn-retards', coches('retard'), 'retard'],
        ['mbn-departs', coches('depart'), 'départ'],
        ['', coches('dispense'), 'dispensé'],
      ];
      const html = pastilles.map(([classe, nombre, libelle], i) => {
        const nul = i > 0 && nombre === 0 ? ' mbn-nul' : '';
        return `<span class="${classe}${nul}"><b>${nombre}</b> ${libelle}${nombre > 1 ? 's' : ''}</span>`;
      }).join('');
      if (bilan.innerHTML !== html) bilan.innerHTML = html;
    };
    compter();
    new MutationObserver(differer(compter)).observe(feuille, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'],
    });
  }

  // ---- Historique : couleurs, filtre rapide par classe, regroupements ----
  if (historique) {
    const AUTRES = '\u0000autres';
    const choisies = new Set();   // classes cochées dans le filtre rapide
    let nonSaisisSeuls = false;
    let signature = '';

    const barre = document.createElement('div');
    barre.className = 'mbn-filtre-appels';
    historique.before(barre); // hors du tableau, pour ne pas relancer son observateur

    const lignesDuTableau = () => [...historique.querySelectorAll('tbody.yui-dt-data > tr')];
    const classeDe = (ligne) => texte(ligne.querySelector('td.yui-dt-col-libClasse .yui-dt-liner'));
    const jourDe = (ligne) => texte(ligne.querySelector('td.yui-dt-col-libPeriode b'));

    // Masque les lignes écartées par le filtre, puis sépare visuellement les
    // groupes : par classe si le tableau est trié par classe, par jour sinon.
    const appliquer = () => {
      const parClasse = !!historique.querySelector('thead th.yui-dt-col-libClasse:is(.yui-dt-asc, .yui-dt-desc)');
      let precedent = null;
      let visibles = 0;
      const lignes = lignesDuTableau();
      for (const ligne of lignes) {
        const classe = classeDe(ligne);
        const visible = (!choisies.size || choisies.has(classe || AUTRES)) &&
          (!nonSaisisSeuls || ligne.dataset.mbnSaisi === 'non');
        ligne.classList.toggle('mbn-masque', !visible);
        if (!visible) { delete ligne.dataset.mbnGroupe; continue; }
        visibles++;
        const cle = parClasse ? classe : jourDe(ligne);
        if (precedent !== null && cle !== precedent) ligne.dataset.mbnGroupe = '1';
        else delete ligne.dataset.mbnGroupe;
        precedent = cle;
      }
      const compteur = barre.querySelector('.mbn-filtre-compteur');
      if (compteur) {
        compteur.textContent = visibles === lignes.length
          ? `${lignes.length} séances`
          : `${visibles} séance${visibles > 1 ? 's' : ''} sur ${lignes.length}`;
      }
    };

    // Une pastille par classe, avec son nombre de séances et, en rouge, le
    // nombre d'appels non saisis ; plus un bouton « Non saisis ».
    const construire = (lignes) => {
      const compte = new Map();
      for (const ligne of lignes) {
        const cle = classeDe(ligne) || AUTRES;
        const c = compte.get(cle) || { total: 0, nonSaisis: 0 };
        c.total++;
        if (ligne.dataset.mbnSaisi === 'non') c.nonSaisis++;
        compte.set(cle, c);
      }
      const nouvelle = JSON.stringify([...compte]);
      if (nouvelle === signature) return;
      signature = nouvelle;
      for (const cle of [...choisies]) if (!compte.has(cle)) choisies.delete(cle);

      const niveau = (libelle) => { const c = globalThis.mbnCouleurs.lireClasse(libelle); return c ? c.niveau : -1; };
      const cles = [...compte.keys()].sort((x, y) =>
        (x === AUTRES) - (y === AUTRES) || niveau(y) - niveau(x) || x.localeCompare(y, 'fr', { numeric: true }));

      barre.textContent = '';
      for (const cle of cles) {
        const { total, nonSaisis } = compte.get(cle);
        const pastille = document.createElement('button');
        pastille.type = 'button';
        pastille.className = 'mbn-filtre-classe';
        pastille.setAttribute('aria-pressed', String(choisies.has(cle)));
        pastille.append(cle === AUTRES ? 'Autres' : cle);
        const nombre = document.createElement('small');
        nombre.textContent = String(total);
        pastille.append(nombre);
        if (nonSaisis) {
          const alerte = document.createElement('small');
          alerte.className = 'mbn-non-saisis';
          alerte.textContent = String(nonSaisis);
          alerte.title = `${nonSaisis} appel${nonSaisis > 1 ? 's' : ''} non saisi${nonSaisis > 1 ? 's' : ''}`;
          pastille.append(alerte);
        }
        const couleur = cle !== AUTRES && pour(cle, true);
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

      const totalNonSaisis = [...compte.values()].reduce((somme, c) => somme + c.nonSaisis, 0);
      if (totalNonSaisis) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'mbn-filtre-non-saisis';
        bouton.setAttribute('aria-pressed', String(nonSaisisSeuls));
        bouton.textContent = `Non saisis (${totalNonSaisis})`;
        bouton.addEventListener('click', () => {
          nonSaisisSeuls = !nonSaisisSeuls;
          bouton.setAttribute('aria-pressed', String(nonSaisisSeuls));
          appliquer();
        });
        barre.appendChild(bouton);
      } else {
        nonSaisisSeuls = false;
      }
      barre.classList.toggle('mbn-filtre-actif', choisies.size > 0);
      const compteur = document.createElement('span');
      compteur.className = 'mbn-filtre-compteur';
      barre.appendChild(compteur);
    };

    const marquer = () => {
      const lignes = lignesDuTableau();
      for (const ligne of lignes) {
        colorer(ligne, classeDe(ligne));
        const saisi = texte(ligne.querySelector('td.yui-dt-col-appelSaisi .yui-dt-liner'));
        const etat = /^non/i.test(saisi) ? 'non' : /^oui/i.test(saisi) ? 'oui' : '';
        if (etat) { if (ligne.dataset.mbnSaisi !== etat) ligne.dataset.mbnSaisi = etat; }
        else delete ligne.dataset.mbnSaisi;
      }
      construire(lignes);
      appliquer();
    };
    marquer();
    // Le tableau réécrit ses lignes à chaque tri : on recommence alors.
    new MutationObserver(differer(marquer)).observe(historique, { childList: true, subtree: true, characterData: true });
    historique.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('thead th')) setTimeout(marquer, 400);
    });
  }

  // ---- Historique : raccourcis de période ----
  globalThis.mbnPeriodes.pret.then(() => {
    if (!filtre || filtre.querySelector('.mbn-raccourcis')) return;
    const debut = document.getElementById('ABS_DATE_DU_DATE');
    const fin = document.getElementById('ABS_DATE_AU_DATE');
    const valider = filtre.querySelector('input[type="submit"], button[type="submit"]');
    const modele = debut && fin ? (debut.value || fin.value || '').trim() : null;
    if (valider && modele !== null && (!modele || /^\d{2}\/\d{2}\/\d{4}$/.test(modele))) {
      const deux = (n) => String(n).padStart(2, '0');
      const ecrire = (d) => `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()}`;
      const aujourdhui = new Date();
      aujourdhui.setHours(12, 0, 0, 0);
      const decaler = (date, jours) => { const r = new Date(date); r.setDate(r.getDate() + jours); return r; };
      const lundi = decaler(aujourdhui, -((aujourdhui.getDay() + 6) % 7));
      const periodes = [
        ["Aujourd'hui", aujourdhui, aujourdhui],
        ['Hier', decaler(aujourdhui, -1), decaler(aujourdhui, -1)],
        ['Cette semaine', lundi, decaler(lundi, 6)],
        ['Semaine dernière', decaler(lundi, -7), decaler(lundi, -1)],
        ['Ce mois', new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1, 12),
          new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, 0, 12)],
        ['Mois dernier', new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1, 12),
          new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 0, 12)],
        ['3 derniers mois', new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 3, aujourdhui.getDate(), 12),
          aujourdhui],
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
        bouton.title = ecrire(du) === ecrire(au) ? `Le ${ecrire(du)}` : `Du ${ecrire(du)} au ${ecrire(au)}`;
        if (debut.value.trim() === ecrire(du) && fin.value.trim() === ecrire(au)) bouton.classList.add('mbn-actif');
        bouton.addEventListener('click', () => {
          debut.value = ecrire(du);
          fin.value = ecrire(au);
          for (const champ of [debut, fin]) champ.dispatchEvent(new Event('change', { bubbles: true }));
          valider.click();
        });
        barre.appendChild(bouton);
      }
      const legende = filtre.querySelector(':scope > legend');
      if (legende) legende.after(barre);
      else filtre.prepend(barre);
    }
  });
})();
