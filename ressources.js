// MBN modernisé — réservation de ressources pour une séance du cahier de textes.
//
// MBN propose une liste déroulante, deux flèches et une seconde liste : il
// faut choisir une ressource, cliquer sur la flèche, recommencer. Ici, toutes
// les ressources sont affichées d'un coup, regroupées par type ; un clic sur
// une ressource l'ajoute à la sélection, un second clic l'en retire.
//
// Le script ne fait qu'actionner les listes et les flèches de MBN, masquées
// tant qu'elles répondent. Rien n'est enregistré tant que vous n'avez pas validé.

(() => {
  const source = document.getElementById('TMP_RESSOURCES_SEANCE');
  if (!source || !source.form) return;
  const bloc = source.parentElement;
  const choisies = bloc.querySelector('select.multivalue');
  const fleches = [...bloc.querySelectorAll('img.clickable_element')];
  if (!choisies || fleches.length < 2) return;

  // Quelle flèche ajoute, laquelle retire ? D'après leurs attributs si possible,
  // sinon dans l'ordre de la page (la première ajoute).
  const indices = (img) => ['onclick', 'src', 'alt', 'title'].map((a) => img.getAttribute(a) || '').join(' ').toLowerCase();
  const AJOUT = /ajout|add|droite|right|plus|select/;
  const RETRAIT = /suppr|retir|remov|enlev|gauche|left|moins|delete/;
  let [flecheAjout, flecheRetrait] = fleches;
  const a0 = indices(fleches[0]);
  const a1 = indices(fleches[1]);
  if (RETRAIT.test(a0) && !RETRAIT.test(a1) && AJOUT.test(a1)) [flecheRetrait, flecheAjout] = fleches;

  const form = source.form;
  form.classList.add('mbn-form-ressources');

  const propre = (t) => t.replace(/\s+/g, ' ').trim();
  const plat = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // ---- Catalogue : toutes les ressources vues dans l'une ou l'autre liste ----
  const catalogue = []; // { valeur, libelle, groupe }
  const trouver = (option) => catalogue.find((r) => r.valeur === option.value) ||
    catalogue.find((r) => r.libelle === propre(option.text));
  const relever = () => {
    for (const liste of [source, choisies]) {
      for (const option of liste.options) {
        const libelle = propre(option.text);
        if (!option.value || !libelle || /^ind[ée]fini/i.test(libelle) || trouver(option)) continue;
        const parent = option.parentElement;
        catalogue.push({
          valeur: option.value,
          libelle,
          groupe: parent && parent.tagName === 'OPTGROUP' ? propre(parent.label) : '',
        });
      }
    }
  };
  const optionDans = (liste, ressource) =>
    [...liste.options].find((o) => o.value === ressource.valeur) ||
    [...liste.options].find((o) => propre(o.text) === ressource.libelle);
  const estChoisie = (ressource) => !!optionDans(choisies, ressource);

  // ---- Regroupement par type ----
  // Groupes de MBN s'il y en a ; sinon le premier mot du nom (« Tablette 3 »,
  // « Tablette 4 » → Tablette). Les ressources seules de leur type vont dans « Autres ».
  const premierMot = (libelle) => {
    const mot = (libelle.split(/[\s\-_:/.,(]+/).find((m) => /\p{L}{2,}/u.test(m)) || libelle);
    return mot;
  };
  const cleType = (mot) => plat(mot).replace(/(?<=.{3})[sx]$/, '');
  const grouper = () => {
    const groupes = new Map(); // clé → { titre, ressources }
    for (const r of catalogue) {
      const mot = r.groupe || premierMot(r.libelle);
      const cle = r.groupe ? 'g:' + plat(r.groupe) : cleType(mot);
      if (!groupes.has(cle)) groupes.set(cle, { titre: r.groupe || mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase(), ressources: [] });
      groupes.get(cle).ressources.push(r);
    }
    let liste = [...groupes.values()];
    const seuls = liste.filter((g) => g.ressources.length === 1);
    if (seuls.length >= 2 && seuls.length < liste.length) {
      liste = liste.filter((g) => g.ressources.length > 1);
      liste.push({ titre: 'Autres', ressources: seuls.flatMap((g) => g.ressources), autres: true });
    } else if (seuls.length === liste.length) {
      liste = [{ titre: '', ressources: catalogue.slice() }]; // aucun type commun : une seule liste
    }
    const ordre = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
    for (const g of liste) g.ressources.sort((a, b) => ordre.compare(a.libelle, b.libelle));
    liste.sort((a, b) => (a.autres ? 1 : 0) - (b.autres ? 1 : 0) || ordre.compare(a.titre, b.titre));
    return liste;
  };

  // ---- Affichage ----
  const panneau = document.createElement('div');
  panneau.className = 'mbn-ressources';
  const entete = document.createElement('div');
  entete.className = 'mbn-ressources__entete';
  const bilan = document.createElement('span');
  bilan.className = 'mbn-ressources__bilan';
  const filtre = document.createElement('input');
  filtre.type = 'search';
  filtre.className = 'mbn-ressources__filtre';
  filtre.placeholder = 'Filtrer les ressources…';
  filtre.setAttribute('aria-label', 'Filtrer les ressources');
  entete.append(bilan, filtre);
  const corps = document.createElement('div');
  corps.className = 'mbn-ressources__corps';
  const alerte = document.createElement('p');
  alerte.className = 'mbn-ressources__alerte';
  alerte.hidden = true;
  panneau.append(entete, alerte, corps);
  bloc.before(panneau);

  let signature = '';
  const afficher = () => {
    relever();
    const terme = plat(filtre.value.trim());
    const etat = catalogue.map((r) => r.valeur + (estChoisie(r) ? '+' : '-')).join('|') + '#' + terme;
    if (etat === signature) return;
    signature = etat;

    const nombre = catalogue.filter(estChoisie).length;
    bilan.textContent = nombre === 0 ? 'Aucune ressource sélectionnée — cliquez pour en ajouter'
      : nombre === 1 ? '1 ressource sélectionnée' : `${nombre} ressources sélectionnées`;
    bilan.classList.toggle('mbn-ressources__bilan--actif', nombre > 0);
    filtre.hidden = catalogue.length < 10;

    corps.textContent = '';
    for (const groupe of grouper()) {
      const visibles = groupe.ressources.filter((r) => !terme || plat(r.libelle).includes(terme) || plat(groupe.titre).includes(terme));
      if (!visibles.length) continue;
      const section = document.createElement('section');
      section.className = 'mbn-ressources__groupe';
      if (groupe.titre) {
        const titre = document.createElement('h3');
        titre.textContent = groupe.titre;
        const compte = document.createElement('span');
        compte.textContent = String(groupe.ressources.length);
        titre.append(' ', compte);
        section.append(titre);
      }
      const rangee = document.createElement('div');
      rangee.className = 'mbn-ressources__rangee';
      for (const r of visibles) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'mbn-ressource';
        const choisie = estChoisie(r);
        bouton.setAttribute('aria-pressed', String(choisie));
        bouton.textContent = r.libelle;
        bouton.title = choisie ? 'Retirer de la sélection' : 'Ajouter à la sélection';
        bouton.addEventListener('click', () => basculer(r));
        rangee.append(bouton);
      }
      section.append(rangee);
      corps.append(section);
    }
    if (!corps.childElementCount) {
      const vide = document.createElement('p');
      vide.className = 'mbn-ressources__vide';
      vide.textContent = catalogue.length ? 'Aucune ressource ne correspond au filtre.' : 'Aucune ressource proposée par MBN pour cette séance.';
      corps.append(vide);
    }
  };

  // ---- Clic sur une ressource : on actionne la liste et la flèche de MBN ----
  const basculer = (ressource) => {
    const avant = estChoisie(ressource);
    if (avant) {
      const option = optionDans(choisies, ressource);
      for (const o of choisies.options) o.selected = o === option;
      choisies.dispatchEvent(new Event('change', { bubbles: true }));
      flecheRetrait.click();
    } else {
      const option = optionDans(source, ressource);
      if (!option) return;
      source.value = option.value;
      option.selected = true;
      source.dispatchEvent(new Event('change', { bubbles: true }));
      flecheAjout.click();
    }
    setTimeout(() => {
      afficher();
      // MBN n'a pas réagi : on le dit, les listes d'origine restent utilisables.
      alerte.hidden = estChoisie(ressource) !== avant;
      if (!alerte.hidden) alerte.textContent = 'MBN n\'a pas pris ce clic en compte : utilisez les listes ci-dessous.';
      if (!alerte.hidden) form.classList.add('mbn-ressources-secours');
    }, 150);
  };

  filtre.addEventListener('input', afficher);
  filtre.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  const observateur = new MutationObserver(afficher);
  observateur.observe(source, { childList: true, subtree: true });
  observateur.observe(choisies, { childList: true, subtree: true });
  afficher();
})();
