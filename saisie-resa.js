// MBN modernisé — formulaire de réservation d'une ressource.
//  - dates : la date de fin suit la date de début ;
//  - heures : un sélecteur à molettes (heures et minutes à faire défiler à la
//    souris ou au doigt) à la place des petites flèches du sélecteur de MBN ;
//  - heure de fin : des durées toutes faites ;
//  - Ctrl+S ou Ctrl+Entrée pour valider.
// Les champs sont réglés par pont.js, à travers le sélecteur de MBN lui-même.

(() => {
  const form = document.getElementById('js-formCreateEvent');
  const dDebut = document.getElementById('js-dateDebut');
  const dFin = document.getElementById('js-dateFin');
  const hDebut = document.getElementById('js-heureDebut');
  const hFin = document.getElementById('js-heureFin');
  if (!form || !dDebut || !hDebut || !hFin || !globalThis.mbnRoue) return;
  form.classList.add('mbn-saisie-resa');

  const DUREES = [55, 60, 110, 120];

  const deux = (n) => String(n).padStart(2, '0');
  const envoyer = (nom, detail) => document.dispatchEvent(new CustomEvent(nom, { detail: JSON.stringify(detail) }));
  const aujourdHui = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const reglerDate = (champ, d) => envoyer('mbn-regler-champ', { id: champ.id, type: 'date', annee: d.getFullYear(), mois: d.getMonth(), jour: d.getDate() });
  const reglerHeure = (champ, minutes) => {
    const d = aujourdHui();
    envoyer('mbn-regler-champ', { id: champ.id, type: 'heure', annee: d.getFullYear(), mois: d.getMonth(), jour: d.getDate(), heure: Math.floor(minutes / 60), minute: minutes % 60 });
  };

  // Valeur d'un champ : celle affichée, sinon celle du champ caché voisin.
  const valeurs = (champ) => {
    const enveloppe = champ.closest('.js-datePicker');
    return [champ.value, ...(enveloppe ? [...enveloppe.querySelectorAll('input')].map((i) => i.value) : [])];
  };
  const lireHeure = (champ) => {
    for (const v of valeurs(champ)) {
      const m = /^\s*(\d{1,2})\s*[h:]\s*(\d{2})/i.exec(v || '');
      if (m) return Number(m[1]) * 60 + Number(m[2]);
    }
    return null;
  };
  const lireDate = (champ) => {
    for (const v of valeurs(champ)) {
      let m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v || '');
      if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      m = /(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    return null;
  };

  const rangee = (titre, variante) => {
    const bloc = document.createElement('div');
    bloc.className = 'mbn-raccourcis' + (variante ? ' mbn-raccourcis--' + variante : '');
    const nom = document.createElement('span');
    nom.className = 'mbn-raccourcis__titre';
    nom.textContent = titre;
    const liste = document.createElement('span');
    liste.className = 'mbn-raccourcis__liste';
    bloc.append(nom, liste);
    return { bloc, liste };
  };
  const pastille = (texte, action, aide) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mbn-raccourci';
    b.textContent = texte;
    if (aide) b.title = aide;
    b.addEventListener('click', action);
    return b;
  };
  const plusTard = () => setTimeout(marquer, 60);

  // ---- Dates : la date de fin suit la date de début ----
  // Quand la date de début change, la date de fin prend la même valeur si elle
  // lui était égale, ou si elle se retrouverait avant elle.
  let debutConnu = lireDate(dDebut);
  const suivreDate = () => {
    const debut = lireDate(dDebut);
    if (!debut || (debutConnu && +debut === +debutConnu)) return;
    const ancien = debutConnu;
    debutConnu = debut;
    if (!dFin) return;
    const fin = lireDate(dFin);
    if (!fin || !ancien || +fin === +ancien || fin < debut) reglerDate(dFin, debut);
  };

  // ---- Heures : un sélecteur à molettes ----
  // Un clic dans le champ (ou sur son horloge) ouvre les molettes de
  // roue-heure.js. Elles remplacent le sélecteur à petites
  // flèches de MBN, mais seulement si le pont (pont.js) a trouvé comment régler
  // les champs à sa place : sinon celui de MBN reste en service.
  let pontPret = false;

  // Changer l'heure de début déplace l'heure de fin d'autant : la durée est conservée.
  const changerDebut = (minutes) => {
    const debut = lireHeure(hDebut);
    const fin = lireHeure(hFin);
    reglerHeure(hDebut, minutes);
    if (debut !== null && fin !== null && fin > debut && minutes + (fin - debut) < 24 * 60) reglerHeure(hFin, minutes + (fin - debut));
    else if (fin === null || fin <= minutes) reglerHeure(hFin, Math.min(minutes + 55, 23 * 60 + 55));
  };

  const ouvrir = (champ, changer) => {
    if (!pontPret || !document.documentElement.classList.contains('mbn-moderne')) return;
    const actuel = lireHeure(champ);
    globalThis.mbnRoue.ouvrir({
      champ,
      depart: actuel === null ? 8 * 60 : actuel,
      surChangement: (v) => {
        if (v !== lireHeure(champ)) { changer(v); plusTard(); }
      },
    });
  };

  for (const [champ, changer] of [[hDebut, changerDebut], [hFin, (v) => reglerHeure(hFin, v)]]) {
    champ.addEventListener('focus', () => ouvrir(champ, changer));
    champ.addEventListener('click', () => ouvrir(champ, changer));
  }

  // Durées toutes faites, sous l'heure de fin.
  const durees = rangee('Durée', 'grille');
  const pastillesDurees = DUREES.map((duree) => {
    const texte = duree % 60 === 0 ? `${duree / 60} h` : duree > 60 ? `${Math.floor(duree / 60)} h ${deux(duree % 60)}` : `${duree} min`;
    const b = pastille(texte, () => {
      const debut = lireHeure(hDebut);
      if (debut === null || debut + duree >= 24 * 60) return;
      reglerHeure(hFin, debut + duree);
      plusTard();
    }, 'Règle l’heure de fin d’après l’heure de début');
    durees.liste.append(b);
    return { b, duree };
  });
  const blocFin = document.createElement('div');
  blocFin.className = 'mbn-heures';
  blocFin.append(durees.bloc);
  (hFin.closest('.js-datePicker') || hFin).after(blocFin);

  // Le pont est-il là, et a-t-il trouvé les sélecteurs de MBN ? Il peut être
  // chargé un peu après ce script, et MBN peut initialiser ses champs plus
  // tard encore : on redemande plusieurs fois.
  const sonder = () => {
    if (pontPret) return;
    envoyer('mbn-sonder-champ', { ids: [hDebut.id, hFin.id] });
    if (hDebut.dataset.mbnSelecteur && hFin.dataset.mbnSelecteur) {
      pontPret = true;
      form.classList.add('mbn-pont-ok');
      document.documentElement.classList.add('mbn-heures-modernes');
    }
  };
  for (const delai of [0, 150, 500, 1200, 2500, 5000]) setTimeout(sonder, delai);
  document.addEventListener('mbn-pont-pret', () => setTimeout(sonder, 0));

  // ---- Mise en évidence de ce qui est sélectionné ----
  function marquer() {
    suivreDate();
    const debut = lireHeure(hDebut);
    const fin = lireHeure(hFin);
    for (const p of pastillesDurees) p.b.setAttribute('aria-pressed', String(debut !== null && fin !== null && fin - debut === p.duree));
  }
  marquer();
  form.addEventListener('change', () => setTimeout(marquer, 30), true);
  setInterval(marquer, 800); // le sélecteur de MBN ne prévient pas toujours

  // ---- Clavier ----
  const titre = document.getElementById('js-titre');
  if (titre && !titre.value && document.activeElement === document.body) titre.focus({ preventScroll: true });
  const valider = document.getElementById('js-btnCreateEvent');
  if (valider) {
    if (!valider.title) valider.title = 'Valider (Ctrl+S ou Ctrl+Entrée)';
    document.addEventListener('keydown', (e) => {
      if (!e.isTrusted || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.repeat) return;
      if (e.key !== 'Enter' && e.key.toLowerCase() !== 's') return;
      if (!document.documentElement.classList.contains('mbn-moderne') || document.querySelector('.modal--show')) return;
      e.preventDefault();
      e.stopPropagation();
      valider.click();
    }, true);
  }
})();
