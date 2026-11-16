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

  // ---- Historique : classe et état de saisie de chaque ligne ----
  if (historique) {
    const marquer = () => {
      for (const ligne of historique.querySelectorAll('tbody.yui-dt-data > tr')) {
        colorer(ligne, texte(ligne.querySelector('td.yui-dt-col-libClasse .yui-dt-liner')));
        const saisi = texte(ligne.querySelector('td.yui-dt-col-appelSaisi .yui-dt-liner'));
        const etat = /^non/i.test(saisi) ? 'non' : /^oui/i.test(saisi) ? 'oui' : '';
        if (etat) { if (ligne.dataset.mbnSaisi !== etat) ligne.dataset.mbnSaisi = etat; }
        else delete ligne.dataset.mbnSaisi;
      }
    };
    marquer();
    new MutationObserver(differer(marquer)).observe(historique, { childList: true, subtree: true, characterData: true });
  }

  // ---- Historique : raccourcis de période ----
  if (filtre && !filtre.querySelector('.mbn-raccourcis')) {
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
      ];
      const barre = document.createElement('div');
      barre.className = 'mbn-raccourcis';
      for (const [libelle, du, au] of periodes) {
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
  }
})();
