// MBN modernisé — page de connexion de l'académie, après le choix du profil
// sur MBN. Trois écrans possibles : identifiant et mot de passe ; mot de
// passe seul ; date de naissance (demandée de temps en temps, tapée dans un
// champ masqué comme un mot de passe, identifiant déjà connu).
//
// Connexion sans clic (réglage « connexionAuto ») : l'écran est reconnu, la
// valeur qu'il demande est obtenue de coffre.js (qui vérifie l'adresse de la
// page et refuse un deuxième essai du même écran), tapée, puis « Se
// connecter » est cliqué. Écran non reconnu : rien n'est tapé. Erreur
// affichée après un essai de l'extension : connexion sans clic suspendue,
// pour ne pas bloquer le compte par essais répétés.
//
// Sinon (réglage « connexionRapide ») : quand Chrome a rempli lui-même les
// champs, « Se connecter » est mis en avant et reçoit le focus, pour un clic
// ou Entrée. Chrome ne transmet un mot de passe pré-rempli à la page qu'après
// un geste de l'utilisateur : l'extension ne le lit pas.

(() => {
  const motDePasse = document.querySelector('form input[type="password"]');
  const formulaire = motDePasse && motDePasse.form;
  const bouton = formulaire && (formulaire.querySelector('#submit-button')
    || formulaire.querySelector('button[type="submit"], input[type="submit"]'));
  if (!bouton) return;

  const texte = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const envoyer = (message) => chrome.runtime.sendMessage(message).catch(() => null);
  const erreurAffichee = () => [...document.querySelectorAll('.fr-alert--error, .fr-message--error, .fr-error-text, .fr-input-group--error, .fr-password--error, .fr-fieldset--error')]
    .some((el) => visible(el) && texte(el));

  // ---- Écran affiché ----
  const champIdentifiant = [...formulaire.querySelectorAll('input')]
    .find((champ) => ['text', 'email'].includes(champ.type) && visible(champ) && !champ.readOnly);
  // Texte lisible seulement : le nom technique du champ vaut souvent
  // « password » quelle que soit la valeur demandée (date de naissance, code…).
  const etiquette = (champ) => [
    texte(champ.id && document.querySelector(`label[for="${CSS.escape(champ.id)}"]`)),
    champ.placeholder, champ.getAttribute('aria-label'),
  ].join(' ');
  const indices = `${etiquette(motDePasse)} ${texte(formulaire.querySelector('h1, h2, legend'))}`;
  const etape = /naissance/i.test(indices) ? 'naissance'
    : champIdentifiant ? 'identifiants'
      : /mot de passe|password/i.test(indices) ? 'mot-de-passe'
        : null;

  // ---- Avis au-dessus du formulaire ----
  const avis = (message, genre = '', action = null) => {
    let boite = document.querySelector('.mbn-connexion-avis');
    if (!boite) {
      boite = document.createElement('div');
      boite.setAttribute('role', 'status');
      formulaire.parentNode.insertBefore(boite, formulaire);
    }
    boite.className = 'mbn-connexion-avis' + (genre ? ' mbn-connexion-avis--' + genre : '');
    boite.replaceChildren(message);
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = action.libelle;
      b.addEventListener('click', action.faire);
      boite.append(' ', b);
    }
  };
  const modifier = { libelle: 'Modifier mes identifiants', faire: () => envoyer({ mbn: 'coffre-ouvrir-saisie' }) };
  const avisEchec = () => avis('La connexion automatique n\'a pas abouti : elle est suspendue pour ne pas bloquer votre compte. Connectez-vous à la main, puis vérifiez vos identifiants.', 'echec', modifier);

  // Taper comme au clavier : valeur, puis événements que la page écoute.
  const taper = (champ, valeur) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const remplir = (valeurs) => {
    if (etape === 'identifiants') { taper(champIdentifiant, valeurs.identifiant); taper(motDePasse, valeurs.motDePasse); }
    else taper(motDePasse, etape === 'naissance' ? valeurs.naissance : valeurs.motDePasse);
    avis('Connexion automatique…');
    setTimeout(() => bouton.click(), 200);
  };

  // ---- Mise en avant de « Se connecter » quand Chrome a rempli les champs ----
  const rempli = (champ) => [':autofill', ':-webkit-autofill'].some((selecteur) => {
    try { return champ.matches(selecteur); } catch { return false; }
  });
  const champs = () => [...formulaire.querySelectorAll('input')]
    .filter((champ) => ['text', 'email', 'password'].includes(champ.type) && visible(champ));
  const pret = () => {
    document.documentElement.classList.add('mbn-connexion-prete');
    bouton.classList.add('mbn-connexion-bouton');
    const note = document.createElement('p');
    note.className = 'mbn-connexion-note';
    note.textContent = 'Identifiants remplis par Chrome : un clic sur « Se connecter » ou la touche Entrée suffit.';
    (bouton.closest('ul') || bouton).insertAdjacentElement('afterend', note);
    // Les autres moyens de connexion (hors de ce formulaire) passent en retrait.
    for (const autre of document.querySelectorAll('[id^="reselect-flow-button"]')) {
      if (!formulaire.contains(autre)) autre.classList.add('mbn-connexion-retrait');
    }
    const actif = document.activeElement;
    if (!actif || actif === document.body || actif === document.documentElement) bouton.focus({ preventScroll: true });
    bouton.scrollIntoView({ block: 'nearest' });
  };
  const guetter = () => {
    // Chrome remplit les champs peu après le chargement : on le guette 5 s.
    const debut = Date.now();
    const verifier = () => {
      const liste = champs();
      if (liste.length && liste.every(rempli) && !erreurAffichee()) { pret(); return; }
      if (Date.now() - debut < 5000) setTimeout(verifier, 150);
    };
    verifier();
  };

  chrome.storage.local.get({ connexionRapide: true, connexionAuto: false }).then(async (reglages) => {
    if (reglages.connexionAuto === true) {
      if (erreurAffichee()) {
        await envoyer({ mbn: 'coffre-echec' });
        const etat = await envoyer({ mbn: 'coffre-etat' });
        if (etat && etat.echec) avisEchec();
      } else if (etape) {
        const reponse = await envoyer({ mbn: 'coffre-lire', etape });
        if (reponse && reponse.valeurs) { remplir(reponse.valeurs); return; }
        if (reponse && reponse.refus === 'echec') avisEchec();
        else if (reponse && reponse.refus === 'verrouille') {
          avis('Connexion sans clic verrouillée depuis l\'ouverture de Chrome : tapez votre phrase de passe, puis rechargez cette page.', '', { libelle: 'Déverrouiller…', faire: modifier.faire });
        }
        else if (reponse && reponse.refus === 'manquant' && etape === 'naissance') {
          avis('Date de naissance non enregistrée dans l\'extension : saisissez-la ici.', '', { libelle: 'L\'ajouter à l\'extension', faire: modifier.faire });
        }
      }
    }
    if (reglages.connexionRapide !== false) guetter();
  });
})();
