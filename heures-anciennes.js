// MBN modernisé — champs d'heure des anciennes pages (« hourfield »), par
// exemple l'heure de diffusion des résultats d'une évaluation.
// Un clic dans le champ ou sur sa flèche ouvre les molettes de roue-heure.js,
// à la place de la liste d'heures de MBN.
//
// L'heure s'affiche dans le champ pendant le choix, et n'est transmise à MBN
// qu'à la fermeture (OK, Entrée, ou clic ailleurs) ; Échap rétablit l'ancienne.
// Pour la transmettre, on clique sur la même heure dans la liste de MBN si elle
// y figure ; sinon on prévient MBN comme après une saisie au clavier.

(() => {
  const roue = globalThis.mbnRoue;
  if (!roue || !document.querySelector('.hourfield')) return;
  document.documentElement.classList.add('mbn-roue-heures');

  const deux = (n) => String(n).padStart(2, '0');
  const lire = (texte) => {
    const m = /^\s*(\d{1,2})\s*[h:]\s*(\d{2})/i.exec(texte || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const ecrire = (minutes) => `${deux(Math.floor(minutes / 60))}:${deux(minutes % 60)}`;
  const champDe = (cible) => {
    const bloc = cible instanceof Element ? cible.closest('.hourfield') : null;
    if (!bloc || !cible.closest('input, .displayHourSelector')) return null;
    return bloc.querySelector('input[type="text"], input:not([type])');
  };

  const transmettre = (champ, avant, heure) => {
    const bloc = champ.closest('.hourfield');
    const ligne = [...bloc.querySelectorAll('div[id^="hourSelector"] li')].find((li) => li.textContent.trim() === heure);
    if (ligne) {
      // Par la liste de MBN : on repart de l'ancienne valeur pour voir si le clic a pris.
      champ.value = avant;
      for (const type of ['mousedown', 'mouseup', 'click']) {
        ligne.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
      if (champ.value === heure) return;
    }
    champ.value = heure;
    for (const type of ['input', 'change']) champ.dispatchEvent(new Event(type, { bubbles: true }));
    champ.dispatchEvent(new FocusEvent('blur'));
    champ.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  };

  // Pour les raccourcis d'autres scripts : règle un champ d'heure sur « HH:MM ».
  globalThis.mbnHeuresAnciennes = {
    regler: (champ, heure) => { if (champ.value !== heure) transmettre(champ, champ.value, heure); },
  };

  const ouvrir = (champ) => {
    if (!document.documentElement.classList.contains('mbn-moderne')) return;
    if (champ.disabled || champ.readOnly || roue.champOuvert() === champ) return;
    const avant = champ.value;
    const actuelle = lire(avant);
    let affichee = avant; // ce que nous avons écrit dans le champ
    roue.ouvrir({
      champ,
      depart: actuelle === null ? 8 * 60 : actuelle,
      surChangement: (v) => {
        // Une frappe au clavier pendant le choix a la priorité.
        if (champ.value !== affichee) return;
        affichee = ecrire(v);
        champ.value = affichee;
      },
      surFermeture: (valide) => {
        if (champ.value !== affichee) return; // heure tapée au clavier : on n'y touche pas
        if (!valide) { champ.value = avant; return; }
        if (affichee !== avant) transmettre(champ, avant, affichee);
      },
    });
  };

  const surGeste = (e) => {
    const champ = champDe(e.target);
    if (champ) ouvrir(champ);
  };
  document.addEventListener('click', surGeste, true);
  document.addEventListener('focusin', surGeste);
})();
