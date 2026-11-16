// MBN modernisé — pont vers les sélecteurs de date et d'heure de MBN.
//
// Ce fichier s'exécute dans le contexte de la page (et non dans celui, isolé,
// de l'extension) : c'est le seul moyen d'atteindre le sélecteur « flatpickr »
// attaché à un champ. Il ne fait qu'une chose : quand l'extension le demande
// (clic sur un de ses raccourcis), régler la date ou l'heure d'un champ.

(() => {
  const deux = (n) => String(n).padStart(2, '0');
  const selecteurDe = (champ) => {
    const enveloppe = champ.closest('.js-datePicker');
    const candidats = [champ, enveloppe, ...(enveloppe ? enveloppe.querySelectorAll('input') : [])];
    return candidats.map((el) => el && el._flatpickr).find((f) => f && typeof f.setDate === 'function');
  };

  // L'extension demande si un champ a bien un sélecteur : on le marque.
  document.addEventListener('mbn-sonder-champ', (e) => {
    let d;
    try { d = JSON.parse(e.detail); } catch { return; }
    for (const id of Array.isArray(d && d.ids) ? d.ids : []) {
      const champ = typeof id === 'string' ? document.getElementById(id) : null;
      if (champ && selecteurDe(champ)) champ.dataset.mbnSelecteur = '1';
    }
  });

  document.addEventListener('mbn-regler-champ', (e) => {
    let d;
    try { d = JSON.parse(e.detail); } catch { return; }
    const champ = d && typeof d.id === 'string' ? document.getElementById(d.id) : null;
    if (!champ) return;
    const date = new Date(d.annee, d.mois, d.jour, d.heure || 0, d.minute || 0);
    if (Number.isNaN(date.getTime())) return;

    const selecteur = selecteurDe(champ);
    if (selecteur) { selecteur.setDate(date, true); return; }

    // Pas de sélecteur trouvé : on écrit la valeur dans le format déjà utilisé.
    champ.value = d.type === 'heure'
      ? (/\dh\d/i.test(champ.value) ? `${deux(d.heure)}h${deux(d.minute)}` : `${deux(d.heure)}:${deux(d.minute)}`)
      : `${deux(d.jour)}/${deux(d.mois + 1)}/${d.annee}`;
    for (const type of ['input', 'change', 'blur']) champ.dispatchEvent(new Event(type, { bubbles: true }));
  });
  // Signale à l'extension que le pont écoute.
  document.dispatchEvent(new CustomEvent('mbn-pont-pret'));
})();
