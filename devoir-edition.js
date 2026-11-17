// MBN modernisé — édition d'une évaluation (onglets des paramètres et de la
// saisie des notes). Repère la page (pour devoir-edition.css) et ajoute :
//   1. des raccourcis de date et d'heure de diffusion des résultats ;
//   2. des valeurs toutes faites pour le barème et le coefficient ;
//   3. dans la saisie des notes : avancement, élèves sans évaluation repérés,
//      boutons à la place des listes de la fiche de l'élève, passage à l'élève
//      suivant ou précédent, répartition des notes ;
//   4. Ctrl+S pour valider l'onglet affiché ;
//   5. fenêtre de choix des compétences : discipline mémorisée par référentiel,
//      filtre instantané, fermeture par Échap.
// Rien n'est enregistré par l'extension : chaque raccourci règle les champs
// d'origine de MBN, comme une saisie à la main.

(() => {
  const formulaire = document.getElementById('form_devoir');
  const module = document.getElementById('module_notes');
  if (!formulaire || !module || !document.getElementById('devoir-tabView')) return;
  module.classList.add('mbn-edition-devoir');

  const moderne = () => document.documentElement.classList.contains('mbn-moderne');
  const deux = (n) => String(n).padStart(2, '0');
  const texte = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const affiche = (el) => !!el && el.getClientRects().length > 0 && el.getBoundingClientRect().left > -10000;
  const creer = (balise, classe, contenu) => {
    const el = document.createElement(balise);
    if (classe) el.className = classe;
    if (contenu) el.textContent = contenu;
    if (balise === 'button') el.type = 'button';
    return el;
  };
  // N'écrit un style que s'il change : la page est observée, on évite de se réveiller soi-même.
  const poser = (el, propriete, valeur) => {
    if (el.style.getPropertyValue(propriete) !== valeur) el.style.setProperty(propriete, valeur);
  };
  // Règle un champ comme après une saisie à la main.
  const regler = (champ, valeur) => {
    if (champ.value === valeur) return;
    champ.value = valeur;
    for (const type of ['input', 'change']) champ.dispatchEvent(new Event(type, { bubbles: true }));
    champ.dispatchEvent(new FocusEvent('blur'));
    champ.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  };

  // ---- 1. Diffusion des résultats ----
  const DATE = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/;
  const HEURE = /^\s*(\d{1,2})\s*[h:]\s*(\d{2})\s*$/i;
  const parametres = document.getElementById('devoir-tab-parametres');

  // Date et heure de fin de l'évaluation elle-même. MBN les donne selon les cas
  // dans un champ, dans une liste ou en clair (« 17/11/2026 de 10h00 à 10h55 ») :
  // on lit donc chaque ligne des informations générales, textes et valeurs.
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const contenu = (noeud) => {
    if (noeud.nodeType === Node.TEXT_NODE) return noeud.nodeValue;
    if (noeud.nodeType !== Node.ELEMENT_NODE || /^(SCRIPT|STYLE|BUTTON)$/.test(noeud.tagName)) return '';
    if (noeud.classList.contains('mbn-raccourcis')) return '';
    // Seulement ce qui est affiché : la ligne cache d'autres séances du jour
    // (champs masqués, listes repliées) dont les heures fausseraient le résultat.
    if (noeud.getClientRects().length === 0) return '';
    if (noeud.tagName === 'SELECT') return [...noeud.selectedOptions].map((o) => o.text).join(' ');
    if (noeud.tagName === 'INPUT') return /^(checkbox|radio|button|submit|hidden)$/i.test(noeud.type) ? '' : noeud.value;
    if (noeud.tagName === 'TEXTAREA') return '';
    return [...noeud.childNodes].map(contenu).join(' ');
  };
  const lireDate = (t) => {
    let m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(t);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    m = new RegExp('\\b(\\d{1,2})(?:er)?\\s+(' + MOIS.join('|') + ')\\s+(\\d{4})\\b', 'i').exec(t);
    if (m) return new Date(Number(m[3]), MOIS.indexOf(m[2].toLowerCase()), Number(m[1]));
    m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const momentEvaluation = () => {
    if (!parametres) return null;
    const lignes = [...parametres.querySelectorAll('.ligne_parametre, .ligne_parametre_grisee')].filter((ligne) =>
      !ligne.matches('.date-diffusion-resultats, .slug') && !ligne.closest('#param_avances_conteneur, #enonce_corrige_conteneur'));
    for (const ligne of lignes) {
      const t = contenu(ligne).replace(/\s+/g, ' ');
      const date = lireDate(t);
      if (!date || Number.isNaN(date.getTime())) continue;
      // L'heure de fin : celle d'un horaire « de 10:00 à 11:00 » s'il y en a
      // un, sinon la plus tardive des heures affichées sur la ligne.
      let fin = -1;
      const horaire = /(\d{1,2})\s*(?:h|:)\s*(\d{2})\s*(?:à|a|-|\u2013|\u2192)\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})/i.exec(t);
      if (horaire && Number(horaire[3]) < 24 && Number(horaire[4]) < 60) {
        fin = Number(horaire[3]) * 60 + Number(horaire[4]);
      } else {
        for (const m of t.matchAll(/\b(\d{1,2})\s*(?:h|:)\s*(\d{2})\b/gi)) {
          const minutes = Number(m[1]) * 60 + Number(m[2]);
          if (Number(m[1]) < 24 && Number(m[2]) < 60 && minutes > fin) fin = minutes;
        }
      }
      return { date, heure: fin < 0 ? null : `${deux(Math.floor(fin / 60))}:${deux(fin % 60)}` };
    }
    return null;
  };

  const RACCOURCIS = [
    {
      nom: 'Après l’évaluation',
      aide: 'Le jour de l’évaluation, à l’heure de fin si la page la donne (sinon 18:00)',
      calcul: () => {
        const moment = momentEvaluation();
        return moment && { date: moment.date, heure: moment.heure || '18:00' };
      },
    },
    {
      nom: 'Maintenant',
      aide: 'Aujourd’hui, à l’heure qu’il est',
      calcul: () => { const d = new Date(); return { date: d, heure: `${deux(d.getHours())}:${deux(d.getMinutes())}` }; },
    },
    {
      nom: 'Demain 8 h',
      calcul: () => { const d = new Date(); d.setDate(d.getDate() + 1); return { date: d, heure: '08:00' }; },
    },
    {
      nom: 'Dans 1 semaine',
      aide: 'Dans sept jours, sans changer l’heure',
      calcul: () => { const d = new Date(); d.setDate(d.getDate() + 7); return { date: d, heure: null }; },
    },
  ];

  for (const ligne of formulaire.querySelectorAll('.date-diffusion-resultats')) {
    const champDate = ligne.querySelector('.datefield input');
    const bloc = ligne.querySelector('.hourfield');
    const champHeure = bloc && bloc.querySelector('input');
    if (!champDate || !champHeure) continue;
    const barre = creer('span', 'mbn-raccourcis');
    for (const raccourci of RACCOURCIS) {
      const bouton = creer('button', 'mbn-puce', raccourci.nom);
      if (raccourci.aide) bouton.title = raccourci.aide;
      bouton.addEventListener('click', () => {
        const voulu = raccourci.calcul();
        bouton.classList.toggle('mbn-puce-echec', !voulu);
        if (!voulu) {
          bouton.title = 'Date de l’évaluation introuvable dans la page';
          return;
        }
        const d = voulu.date;
        regler(champDate, `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()}`);
        if (voulu.heure) {
          if (globalThis.mbnHeuresAnciennes) globalThis.mbnHeuresAnciennes.regler(champHeure, voulu.heure);
          else regler(champHeure, voulu.heure);
        }
      });
      barre.append(bouton);
    }
    bloc.after(barre);
  }

  // ---- 2. Barème et coefficient ----
  const puces = (id, valeurs) => {
    const champ = document.getElementById(id);
    if (!champ) return;
    const nombre = (v) => Number(String(v).replace(',', '.'));
    const barre = creer('span', 'mbn-raccourcis');
    const boutons = valeurs.map((valeur) => {
      const bouton = creer('button', 'mbn-puce', String(valeur).replace('.', ','));
      bouton.addEventListener('click', () => {
        // Même écriture des décimales que la valeur en place.
        const point = champ.value.includes('.') || !champ.value.includes(',');
        const ecrit = /\.\d/.test(champ.value) && Number.isInteger(valeur) ? valeur.toFixed(1) : String(valeur);
        regler(champ, point ? ecrit : ecrit.replace('.', ','));
        marquer();
      });
      barre.append(bouton);
      return { bouton, valeur };
    });
    const marquer = () => boutons.forEach(({ bouton, valeur }) =>
      bouton.classList.toggle('mbn-puce-active', champ.value.trim() !== '' && nombre(champ.value) === valeur));
    champ.addEventListener('input', marquer);
    champ.addEventListener('change', marquer);
    marquer();
    champ.after(barre);
  };
  puces('DEVOIR_BAREME', [5, 10, 20, 40]);
  puces('DEVOIR_COEFF', [0.5, 1, 2, 3]);

  // Couleur de la classe de l'évaluation.
  const listeClasses = document.getElementById('cbx_classes_groupes');
  const colorer = () => {
    const option = listeClasses && listeClasses.selectedOptions[0];
    const couleur = option && globalThis.mbnCouleurs ? globalThis.mbnCouleurs.pour(texte(option), true) : null;
    if (!couleur) { delete module.dataset.mbnClasse; return; }
    module.dataset.mbnClasse = texte(option);
    for (const cle of ['fond', 'bord', 'pale', 'texte']) {
      if (couleur[cle]) module.style.setProperty('--mbn-classe-' + cle, couleur[cle]);
    }
  };
  if (listeClasses) { listeClasses.addEventListener('change', colorer); colorer(); }

  // ---- 4. Ctrl+S ----
  const boutonValider = () => [...formulaire.querySelectorAll('#submit-valider-notes, #submit-valider')].find(affiche) || null;
  for (const bouton of formulaire.querySelectorAll('#submit-valider-notes, #submit-valider')) {
    if (!bouton.title) bouton.title = 'Valider (Ctrl+S)';
    bouton.before(creer('span', 'mbn-aide-raccourci', 'Ctrl+S pour valider'));
  }
  document.addEventListener('keydown', (e) => {
    if (!e.isTrusted || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.repeat) return;
    if (e.key.toLowerCase() !== 's' || !moderne()) return;
    const bouton = boutonValider();
    if (!bouton || document.querySelector('.modal--show')) return;
    if (globalThis.mbnRoue && globalThis.mbnRoue.champOuvert()) return;
    e.preventDefault();
    e.stopPropagation();
    // La saisie en cours est d'abord transmise à MBN.
    if (document.activeElement instanceof HTMLElement && formulaire.contains(document.activeElement)) {
      document.activeElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
    bouton.click();
  }, true);

  // ---- 5. Fenêtre de choix des compétences ----
  // Elle se rouvre sur la discipline choisie la dernière fois pour le même
  // référentiel (quelle que soit la classe), avec les mêmes rubriques repliées
  // ou dépliées, reçoit un filtre instantané, et
  // se ferme par Échap ou d'un clic à côté. Seuls les identifiants du
  // référentiel et de la discipline sont mémorisés.
  (() => {
    const cadre = () => document.getElementById('selecteur_competences_popin_c');
    const visible = () => {
      const c = cadre();
      return !!c && !c.classList.contains('yui-overlay-hidden') && c.style.visibility !== 'hidden' && c.getClientRects().length > 0;
    };
    const referentiel = () => document.getElementById('comp-filtre-referentiel');
    const discipline = () => document.getElementById('comp-filtre-discipline');
    const liste = () => document.getElementById('body_selection_competence');
    const normaliser = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // Mémorise la discipline choisie à la main, par référentiel.
    document.addEventListener('change', async (e) => {
      if (!e.isTrusted || !(e.target instanceof HTMLSelectElement)) return;
      if (e.target.id === 'comp-filtre-referentiel') { retablir(); return; }
      if (e.target.id !== 'comp-filtre-discipline' || !referentiel()) return;
      const option = e.target.selectedOptions[0];
      const { devoirDisciplines } = await chrome.storage.local.get({ devoirDisciplines: {} });
      devoirDisciplines[referentiel().value] = { valeur: e.target.value, libelle: option ? texte(option) : '' };
      chrome.storage.local.set({ devoirDisciplines });
    }, true);

    // Rétablit la discipline mémorisée dès que MBN a rempli la liste.
    let essai = 0;
    const retablir = () => {
      const numero = ++essai;
      let reste = 12;
      const tenter = async () => {
        if (numero !== essai || !moderne() || !visible()) return;
        const ref = referentiel();
        const dis = discipline();
        if (!ref || !dis || dis.options.length < 2) {
          if (--reste > 0) setTimeout(tenter, 250);
          return;
        }
        const { devoirDisciplines } = await chrome.storage.local.get({ devoirDisciplines: {} });
        const voulu = devoirDisciplines[ref.value];
        if (!voulu) return;
        const option = [...dis.options].find((o) => o.value === voulu.valeur) ||
          [...dis.options].find((o) => voulu.libelle && texte(o) === voulu.libelle);
        if (!option || dis.value === option.value) return;
        dis.value = option.value;
        dis.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setTimeout(tenter, 150);
    };

    // Rubriques (matières) repliées ou dépliées : retenues par référentiel et
    // par titre, donc retrouvées quelle que soit la classe ou la discipline.
    const blocDe = (titre) => {
      const bloc = titre.nextElementSibling;
      return bloc && !bloc.matches('.competence_section_accordeon') ? bloc : null;
    };
    const estRepliee = (titre) => {
      const bloc = blocDe(titre);
      return !!bloc && (bloc.classList.contains('d-none') || bloc.style.display === 'none');
    };
    document.addEventListener('click', (e) => {
      if (!e.isTrusted || !(e.target instanceof Element) || !referentiel()) return;
      const titre = e.target.closest('#body_selection_competence .competence_section_accordeon');
      if (!titre) return;
      const ref = referentiel().value;
      setTimeout(async () => {
        if (!titre.isConnected || !texte(titre)) return;
        const { devoirRubriques } = await chrome.storage.local.get({ devoirRubriques: {} });
        devoirRubriques[ref] = { ...(devoirRubriques[ref] || {}), [texte(titre)]: estRepliee(titre) };
        chrome.storage.local.set({ devoirRubriques });
      }, 250);
    }, true);
    let plisPrevus = 0;
    const retablirPlis = () => {
      clearTimeout(plisPrevus);
      plisPrevus = setTimeout(async () => {
        const zone = liste();
        if (!zone || !referentiel() || !moderne() || !visible()) return;
        const { devoirRubriques } = await chrome.storage.local.get({ devoirRubriques: {} });
        const voulus = devoirRubriques[referentiel().value];
        if (!voulus) return;
        for (const titre of zone.querySelectorAll('.competence_section_accordeon')) {
          const voulu = voulus[texte(titre)];
          if (voulu === undefined || !blocDe(titre) || estRepliee(titre) === voulu) continue;
          // On actionne le bouton de MBN, puis son titre si rien n'a bougé.
          const bouton = titre.querySelector('button');
          (bouton || titre).click();
          if (bouton && estRepliee(titre) !== voulu) titre.click();
        }
      }, 200);
    };

    // Filtre instantané sur les libellés des compétences.
    let champFiltre = null;
    const filtrer = () => {
      const zone = liste();
      if (!zone || !champFiltre) return;
      const mots = normaliser(champFiltre.value).split(/\s+/).filter(Boolean);
      for (const ligne of zone.querySelectorAll('.ligne-cb-competence')) {
        const cache = mots.length > 0 && !mots.every((mot) => normaliser(texte(ligne)).includes(mot));
        const case_ = ligne.previousElementSibling;
        for (const el of [ligne, case_ && case_.matches('input[type="checkbox"]') ? case_ : null]) {
          if (el && el.classList.contains('mbn-masque') !== cache) el.classList.toggle('mbn-masque', cache);
        }
      }
      // Une rubrique dont toutes les compétences sont masquées disparaît aussi.
      for (const titre of zone.querySelectorAll('.competence_section_accordeon')) {
        const bloc = titre.nextElementSibling;
        const vide = mots.length > 0 && !!bloc && !bloc.querySelector('.ligne-cb-competence:not(.mbn-masque)');
        if (titre.classList.contains('mbn-masque') !== vide) titre.classList.toggle('mbn-masque', vide);
      }
    };
    const installerFiltre = () => {
      const zone = liste();
      if (!zone || (champFiltre && champFiltre.isConnected)) return;
      champFiltre = creer('input', 'mbn-filtre-competences');
      champFiltre.type = 'search';
      champFiltre.placeholder = 'Filtrer les compétences\u2026';
      champFiltre.setAttribute('aria-label', 'Filtrer les compétences');
      champFiltre.addEventListener('input', filtrer);
      zone.before(champFiltre);
      // MBN réécrit la liste à chaque changement de discipline.
      new MutationObserver(() => {
        if (champFiltre.value) filtrer();
        retablirPlis();
      }).observe(zone, { childList: true, subtree: true });
    };

    const fermer = () => {
      const croix = visible() ? cadre().querySelector('.container-close') : null;
      if (croix) croix.click();
      return !!croix;
    };
    document.addEventListener('keydown', (e) => {
      if (!e.isTrusted || e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey || !moderne()) return;
      if (champFiltre && e.target === champFiltre && champFiltre.value) {
        champFiltre.value = '';
        filtrer();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (fermer()) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    document.addEventListener('click', (e) => {
      if (e.isTrusted && moderne() && e.target instanceof Element && e.target.id === 'selecteur_competences_popin_mask') fermer();
    }, true);

    // La fenêtre n'existe qu'une fois ouverte : on guette son apparition.
    let ouverte = false;
    setInterval(() => {
      const etat = visible();
      if (etat && !ouverte) {
        installerFiltre();
        if (champFiltre) { champFiltre.value = ''; filtrer(); }
        retablir();
        retablirPlis();
      }
      ouverte = etat;
    }, 400);
  })();

  // ---- 3. Saisie des notes ----
  const ecran = document.getElementById('js-ecran-eval');
  const fiche = document.getElementById('js-eval-eleve');
  if (!ecran || !fiche) return;
  const champNote = document.getElementById('js-eval-eleve__note');
  const eleves = () => [...ecran.querySelectorAll('.js-eleve')];
  const estCouleur = (c) => !!c && c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c);

  // Couleur de chaque niveau de compétence, apprise au fil des pastilles
  // que MBN affiche dans la grille (valeur de la liste → couleurs).
  let niveaux = {};
  let niveauxChanges = false;

  // Remplace une liste par une rangée de boutons, un par choix.
  const rangees = [];
  // Ordre de tabulation de la fiche, géré ici : note, chaque compétence, puis
  // appréciation. MBN numérote ses champs, ce qui ferait sauter nos boutons.
  const rangeesNiveaux = [];
  const courantDe = (rangee) => rangee.querySelector('.mbn-choix-bouton[tabindex="0"]') || rangee.querySelector('.mbn-choix-bouton');
  const etape = (rangee, pas) => {
    const rang = rangeesNiveaux.indexOf(rangee) + pas;
    if (rang < 0) return champNote;
    if (rang < rangeesNiveaux.length) return courantDe(rangeesNiveaux[rang]);
    return document.getElementById('js-eval-eleve__appreciation');
  };
  const boutonner = (liste, competence) => {
    const rangee = creer('div', 'mbn-choix' + (competence ? ' mbn-choix-niveaux' : ''));
    liste.after(rangee);
    liste.classList.add('mbn-liste-remplacee');
    // Niveaux : le bouton ne porte que le code (« 3 »), le descriptif complet
    // passe en infobulle et s'affiche en bout de rangée pour le niveau choisi.
    const descriptif = competence ? creer('span', 'mbn-choix-descriptif') : null;
    let signature = null;
    const dessiner = () => {
      const options = [...liste.options];
      const nouvelle = options.map((o) => o.value + '\u0001' + o.text).join('\u0002');
      if (nouvelle !== signature) {
        signature = nouvelle;
        rangee.replaceChildren(...options.map((option) => {
          const libelle = texte(option);
          const code = competence ? /^(\S{1,3})\s*[–—:-]\s*(\S.*)$/.exec(libelle) : null;
          const aucun = !libelle || (competence && !option.value) || (!!code && /^aucun/i.test(code[2]));
          const bouton = creer('button', 'mbn-choix-bouton', aucun ? '–' : code ? code[1] : libelle);
          bouton.dataset.valeur = option.value;
          bouton.dataset.descriptif = aucun ? '' : code ? code[2] : libelle;
          if (code || aucun) bouton.title = code ? code[2] : libelle || 'Aucun';
          if (aucun) bouton.classList.add('mbn-choix-aucun');
          else if (code) bouton.classList.add('mbn-choix-code');
          bouton.addEventListener('click', () => {
            if (liste.disabled) return;
            liste.value = option.value;
            liste.dispatchEvent(new Event('change', { bubbles: true }));
            dessiner();
          });
          return bouton;
        }));
        if (descriptif) rangee.append(descriptif);
      }
      if (descriptif) {
        const choisi = [...rangee.children].find((b) => b.dataset.valeur === liste.value);
        const voulu = choisi ? choisi.dataset.descriptif || '' : '';
        if (descriptif.textContent !== voulu) descriptif.textContent = voulu;
      }
      // Une seule étape de tabulation par rangée, comme la liste d'origine :
      // le bouton du choix en cours, à défaut le premier.
      const boutons = [...rangee.querySelectorAll('.mbn-choix-bouton')];
      const courant = boutons.find((b) => b.dataset.valeur === liste.value) || boutons[0];
      for (const bouton of boutons) {
        const rang = bouton === courant ? 0 : -1;
        if (bouton.tabIndex !== rang) bouton.tabIndex = rang;
        bouton.classList.toggle('mbn-choix-actif', bouton.dataset.valeur === liste.value);
        const couleur = competence ? niveaux[bouton.dataset.valeur] : null;
        poser(bouton, '--mbn-niveau-fond', couleur ? couleur[0] : '');
        poser(bouton, '--mbn-niveau-texte', couleur ? couleur[1] : '');
        bouton.classList.toggle('mbn-choix-colore', !!couleur);
      }
    };
    // Au clavier, comme dans la liste d'origine : le premier caractère du
    // choix (0 à 4 pour un niveau) le sélectionne, les flèches passent au
    // voisin ; Entrée passe à l'élève suivant.
    const choisir = (option) => {
      if (liste.disabled || !option) return;
      if (liste.value !== option.value) {
        liste.value = option.value;
        liste.dispatchEvent(new Event('change', { bubbles: true }));
      }
      dessiner();
      const bouton = [...rangee.querySelectorAll('.mbn-choix-bouton')].find((b) => b.dataset.valeur === option.value);
      if (bouton) bouton.focus();
    };
    if (competence) rangeesNiveaux.push(rangee);
    rangee.addEventListener('keydown', (e) => {
      if (!e.isTrusted || !moderne() || e.ctrlKey || e.metaKey || e.altKey) return;
      const options = [...liste.options];
      let option = null;
      if (e.key === 'Tab' && competence) {
        const cible = etape(rangee, e.shiftKey ? -1 : 1);
        if (!cible) return;
        e.preventDefault();
        e.stopPropagation();
        cible.focus();
        if (cible === champNote) champNote.select();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        aller(1);
        return;
      }
      if (/^Arrow(Left|Up|Right|Down)$/.test(e.key)) {
        const pas = /Left|Up/.test(e.key) ? -1 : 1;
        option = options[Math.min(options.length - 1, Math.max(0, liste.selectedIndex + pas))];
      } else if (e.key.length === 1 && e.key !== ' ') {
        const lettre = e.key.toLowerCase();
        const candidats = options.filter((o) => texte(o).toLowerCase().startsWith(lettre));
        // Même lettre retapée : choix suivant commençant par cette lettre.
        option = candidats[(candidats.indexOf(liste.selectedOptions[0]) + 1) % candidats.length] || null;
        if (!option) return;
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      choisir(option);
    });
    liste.addEventListener('change', dessiner);
    rangees.push(dessiner);
  };
  const listeNonNote = document.getElementById('js-eval-eleve__non-notation');
  if (listeNonNote) boutonner(listeNonNote, false);
  const listesCompetences = [...fiche.querySelectorAll('select.select_competence')];
  listesCompetences.forEach((liste) => boutonner(liste, true));

  // Élève précédent / suivant, dans l'ordre de la grille.
  const aller = (pas) => {
    const visibles = eleves().filter(affiche);
    if (!visibles.length) return false;
    const actuel = visibles.findIndex((el) => el.classList.contains('eleve--is-selected'));
    const cible = visibles[actuel < 0 ? 0 : (actuel + pas + visibles.length) % visibles.length];
    const zone = cible.querySelector('.selection__simple') || cible;
    zone.click();
    cible.scrollIntoView({ block: 'nearest' });
    if (champNote) { champNote.focus(); champNote.select(); }
    return true;
  };
  const enTete = fiche.querySelector('.evaluations-eleve__header');
  if (enTete) {
    const navigation = creer('span', 'mbn-navigation');
    for (const [pas, signe, aide] of [[-1, '↑', 'Élève précédent (flèche haut dans la note)'],
      [1, '↓', 'Élève suivant (Entrée ou flèche bas dans la note)']]) {
      const bouton = creer('button', 'mbn-puce', signe);
      bouton.title = aide;
      bouton.addEventListener('click', () => aller(pas));
      navigation.append(bouton);
    }
    enTete.prepend(navigation);
  }
  if (champNote) {
    champNote.addEventListener('keydown', (e) => {
      if (!e.isTrusted || !moderne() || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (e.key === 'Tab' && !e.shiftKey && rangeesNiveaux.length) {
        const cible = courantDe(rangeesNiveaux[0]);
        if (!cible) return;
        e.preventDefault();
        e.stopPropagation();
        cible.focus(); // quitter le champ transmet la note à MBN, comme d'habitude
        return;
      }
      const pas = e.key === 'Enter' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      if (!pas) return;
      e.preventDefault();
      e.stopPropagation();
      // La note tapée est transmise à MBN avant de changer d'élève.
      champNote.dispatchEvent(new Event('change', { bubbles: true }));
      champNote.dispatchEvent(new FocusEvent('blur'));
      champNote.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      aller(pas);
    }, true);
    champNote.after(creer('span', 'mbn-aide-raccourci', 'Tab : compétences (touches 0 à 4) \u00b7 Entrée ou ↓ : élève suivant · ↑ : précédent'));
  }

  // Maj+Tab depuis l'appréciation : retour à la dernière compétence.
  const champAppreciation = document.getElementById('js-eval-eleve__appreciation');
  if (champAppreciation) {
    champAppreciation.addEventListener('keydown', (e) => {
      if (!e.isTrusted || !moderne() || e.key !== 'Tab' || !e.shiftKey || !rangeesNiveaux.length) return;
      const cible = courantDe(rangeesNiveaux[rangeesNiveaux.length - 1]);
      if (!cible) return;
      e.preventDefault();
      e.stopPropagation();
      cible.focus();
    }, true);
  }

  // Avancement et répartition.
  const grilleEnTete = ecran.querySelector('.grille-eleves__header');
  const avancement = creer('span', 'mbn-avancement');
  const jauge = creer('span', 'mbn-jauge');
  const jaugeValeur = creer('span', 'mbn-jauge-valeur');
  const compte = creer('span', 'mbn-compte');
  jauge.append(jaugeValeur);
  avancement.append(jauge, compte);
  const filtres = grilleEnTete && grilleEnTete.querySelector('.filtre_saisie_notes');
  if (filtres) filtres.before(avancement);
  else if (grilleEnTete) grilleEnTete.append(avancement);

  const pied = ecran.querySelector('.grille-eleves__footer');
  const repartition = creer('span', 'mbn-repartition');
  repartition.title = 'Répartition des notes par quart du barème';
  if (pied) pied.append(repartition);
  const champBareme = document.getElementById('DEVOIR_BAREME');

  let prevu = false;
  const actualiser = () => {
    prevu = false;
    const tous = eleves();
    let saisis = 0;
    const tranches = [0, 0, 0, 0];
    const bareme = Number(String(champBareme ? champBareme.value : '').replace(',', '.')) || 20;
    for (const eleve of tous) {
      const note = texte(eleve.querySelector('.eleve__note')).replace(/^[-–—.\s]+$/, '');
      const pastilles = [...eleve.querySelectorAll('.eleve__comp-icon')];
      const colorees = pastilles.filter((p) => estCouleur(p.style.backgroundColor));
      const vide = !note && !colorees.length;
      if (!vide) saisis++;
      if (eleve.dataset.mbnVide !== (vide ? '1' : undefined)) {
        if (vide) eleve.dataset.mbnVide = '1'; else delete eleve.dataset.mbnVide;
      }
      const valeur = /^\d+([.,]\d+)?$/.test(note) ? Number(note.replace(',', '.')) : null;
      if (valeur !== null) tranches[Math.min(3, Math.max(0, Math.floor((valeur / bareme) * 4)))]++;
      // Couleurs des niveaux : l'élève affiché dans la fiche sert de repère.
      if (eleve.classList.contains('eleve--is-selected')) {
        listesCompetences.forEach((liste, rang) => {
          const pastille = pastilles[rang];
          if (!pastille || !liste.value || !estCouleur(pastille.style.backgroundColor)) return;
          const couleur = [pastille.style.backgroundColor, pastille.style.color || ''];
          const connue = niveaux[liste.value];
          if (connue && connue[0] === couleur[0] && connue[1] === couleur[1]) return;
          niveaux[liste.value] = couleur;
          niveauxChanges = true;
        });
      }
    }
    if (niveauxChanges) {
      niveauxChanges = false;
      chrome.storage.local.set({ devoirNiveaux: niveaux });
    }
    const libelle = tous.length ? `${saisis} sur ${tous.length} évalués` : '';
    if (compte.textContent !== libelle) compte.textContent = libelle;
    poser(jaugeValeur, 'width', tous.length ? Math.round((saisis / tous.length) * 100) + '%' : '0px');
    avancement.classList.toggle('mbn-complet', tous.length > 0 && saisis === tous.length);
    const maximum = Math.max(1, ...tranches);
    if (repartition.children.length !== 4) repartition.replaceChildren(...tranches.map(() => creer('i')));
    tranches.forEach((n, rang) => {
      poser(repartition.children[rang], 'height', Math.round(3 + (n / maximum) * 15) + 'px');
      const borne = (quart) => String(Math.round(((bareme * quart) / 4) * 100) / 100).replace('.', ',');
      const aide = `${n} note${n > 1 ? 's' : ''} dans [${borne(rang)} ; ${borne(rang + 1)}${rang < 3 ? '[' : ']'}`;
      if (repartition.children[rang].title !== aide) repartition.children[rang].title = aide;
    });
    rangees.forEach((dessiner) => dessiner());
  };
  const planifier = () => {
    if (prevu) return;
    prevu = true;
    setTimeout(actualiser, 80);
  };

  chrome.storage.local.get({ devoirNiveaux: {} }).then(({ devoirNiveaux }) => {
    niveaux = { ...devoirNiveaux, ...niveaux };
    actualiser();
    // MBN réécrit la grille et la fiche à chaque élève choisi ou note saisie.
    new MutationObserver(planifier).observe(ecran, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'],
    });
    ecran.addEventListener('click', planifier);
    ecran.addEventListener('change', planifier);
  });
})();
