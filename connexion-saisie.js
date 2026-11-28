// MBN modernisé — fenêtre de la connexion sans clic.
//
// Deux usages :
// - posée par connexion.js sur l'écran de choix du profil de MBN (cadre de
//   l'extension : MBN ne peut pas lire ce qui y est tapé). La liste des
//   profils arrive dans l'ancre de l'adresse ; une fois enregistré ou
//   déverrouillé, l'écran de MBN est prévenu et valide le profil ; « Annuler »
//   le laisse en connexion classique ;
// - ouverte dans un onglet depuis la fenêtre de l'extension, pour modifier.
//
// Deux vues : « déverrouillage » (phrase de passe, une fois par ouverture de
// Chrome) et « saisie » (identifiants et protection sur cet ordinateur).
// Le mot de passe et la phrase ne sont jamais relus ici : seul coffre.js
// déchiffre.

(() => {
  const $ = (id) => document.getElementById(id);
  const PHRASE_MIN = 12;
  const dansMbn = window.top !== window;
  const origineMbn = (location.ancestorOrigins && location.ancestorOrigins[0]) || '*';
  const prevenir = (action, donnees = {}) => { if (dansMbn) window.parent.postMessage({ mbn: 'saisie-connexion', action, ...donnees }, origineMbn); };
  const etat = (element, message, genre = '') => { element.textContent = message; element.className = 'etat' + (genre ? ' ' + genre : ''); };
  const demander = (message) => chrome.runtime.sendMessage(message).catch(() => ({ refus: 'erreur' }));

  let profils = [];
  let choisi = '';
  try {
    const recu = JSON.parse(decodeURIComponent(location.hash.slice(1)) || '{}');
    profils = Array.isArray(recu.profils) ? recu.profils.filter((p) => p && typeof p.id === 'string') : [];
    choisi = typeof recu.choisi === 'string' ? recu.choisi : '';
  } catch { /* ouverte sans liste */ }

  if (!dansMbn) {
    document.body.classList.add('onglet');
    $('enregistrer').textContent = 'Enregistrer';
    $('ouvrir').textContent = 'Déverrouiller';
  }

  // Hauteur du contenu, pour que l'écran de MBN ajuste le cadre.
  // (hauteur du contenu lui-même : celle du document ne descend jamais sous
  // celle du cadre).
  const signalerTaille = () => prevenir('taille', { hauteur: Math.ceil(document.body.getBoundingClientRect().height) });
  new ResizeObserver(signalerTaille).observe(document.body);

  const fermer = () => {
    if (dansMbn) return;
    chrome.tabs.getCurrent().then((onglet) => onglet && chrome.tabs.remove(onglet.id)).catch(() => window.close());
  };
  const annuler = () => { prevenir('annuler'); fermer(); };
  document.querySelectorAll('.annuler').forEach((b) => b.addEventListener('click', annuler));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.isTrusted) annuler(); });

  // ---- Vue « saisie » ----
  let coffre = {};
  const modeChoisi = () => (document.querySelector('input[name="mode"]:checked') || {}).value || 'phrase';
  // Phrase obligatoire : nouveau coffre, passage au mode phrase, ou coffre
  // verrouillé dont la phrase est oubliée.
  const phraseObligatoire = () => modeChoisi() === 'phrase' && !(coffre.enregistre && coffre.mode === 'phrase' && !coffre.verrouille);
  const majProtection = () => {
    const phrase = modeChoisi() === 'phrase';
    $('bloc-phrase').hidden = !phrase;
    $('note-phrase').hidden = !phrase;
    $('note-appareil').hidden = phrase;
    $('phrase-aide').textContent = phraseObligatoire() ? `(${PHRASE_MIN} caractères au moins)` : '(laisser vide pour garder la même)';
  };
  document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', majProtection));

  const remplirProfils = async () => {
    const { connexionProfil } = await chrome.storage.local.get({ connexionProfil: null });
    if (!profils.length && connexionProfil) profils = [connexionProfil];
    $('profil').replaceChildren();
    if (!profils.length) { $('bloc-profil').hidden = true; $('profil-absent').hidden = false; return; }
    for (const profil of profils) $('profil').append(new Option(profil.libelle || profil.id, profil.id));
    $('profil').value = choisi || (connexionProfil && connexionProfil.id) || profils[0].id;
  };

  const montrerSaisie = async (message = '') => {
    $('deverrouillage').hidden = true;
    $('saisie').hidden = false;
    await remplirProfils();
    // Mot de passe gardé seulement si le coffre est lisible (déverrouillé).
    const lisible = coffre.enregistre && !coffre.verrouille;
    $('identifiant').value = (lisible && coffre.identifiant) || $('identifiant').value;
    $('naissance').value = (lisible && coffre.naissance) || $('naissance').value;
    $('mot-de-passe').placeholder = lisible ? 'inchangé' : '';
    $('mot-de-passe-aide').hidden = !lisible;
    const mode = coffre.mode || 'phrase';
    document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
    majProtection();
    if (message) etat($('etat'), message, 'succes');
    signalerTaille();
    ($('identifiant').value ? $('mot-de-passe') : $('identifiant')).focus();
  };

  $('saisie').addEventListener('submit', async (e) => {
    e.preventDefault();
    const lisible = coffre.enregistre && !coffre.verrouille;
    const identifiant = $('identifiant').value.trim();
    const motDePasse = $('mot-de-passe').value;
    const mode = modeChoisi();
    const phrase = mode === 'phrase' ? $('phrase').value : '';
    const erreur = (message, champ) => { etat($('etat'), message, 'erreur'); champ.focus(); };
    if (!identifiant) return erreur('Indiquez votre identifiant.', $('identifiant'));
    if (!motDePasse && !lisible) return erreur('Indiquez votre mot de passe.', $('mot-de-passe'));
    if (phrase || phraseObligatoire()) {
      if ([...phrase].length < PHRASE_MIN) return erreur(`La phrase de passe doit compter ${PHRASE_MIN} caractères au moins.`, $('phrase'));
      if (phrase !== $('phrase-confirmation').value) return erreur('Les deux phrases de passe ne sont pas identiques.', $('phrase-confirmation'));
    }
    $('enregistrer').disabled = true;
    etat($('etat'), mode === 'phrase' && phrase ? 'Chiffrement…' : 'Enregistrement…');
    const reponse = await demander({ mbn: 'coffre-enregistrer', identifiant, motDePasse, naissance: $('naissance').value, mode, phrase });
    $('mot-de-passe').value = '';
    $('phrase').value = '';
    $('phrase-confirmation').value = '';
    if (!reponse || !reponse.ok) {
      const raisons = {
        'phrase-courte': `La phrase de passe doit compter ${PHRASE_MIN} caractères au moins.`,
        'phrase-manquante': 'Choisissez une phrase de passe.',
        verrouille: 'Retapez votre mot de passe : l\'ancien est verrouillé.',
        incomplet: 'Indiquez votre identifiant et votre mot de passe.',
      };
      etat($('etat'), raisons[reponse && reponse.refus] || 'Enregistrement impossible : réessayez.', 'erreur');
      $('enregistrer').disabled = false;
      return;
    }
    const profil = profils.find((p) => p.id === $('profil').value);
    if (profil) await chrome.storage.local.set({ connexionProfil: { id: profil.id, libelle: profil.libelle || profil.id } });
    etat($('etat'), dansMbn ? 'Enregistré. Connexion…' : 'Enregistré.', 'succes');
    prevenir('enregistre', { profil: profil ? profil.id : '' });
    setTimeout(fermer, 900);
  });

  // ---- Vue « déverrouillage » ----
  const montrerDeverrouillage = () => {
    $('saisie').hidden = true;
    $('deverrouillage').hidden = false;
    signalerTaille();
    $('phrase-ouvrir').focus();
  };
  $('deverrouillage').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phrase = $('phrase-ouvrir').value;
    if (!phrase) { etat($('etat-ouvrir'), 'Tapez votre phrase de passe.', 'erreur'); return; }
    $('ouvrir').disabled = true;
    etat($('etat-ouvrir'), 'Vérification…');
    const reponse = await demander({ mbn: 'coffre-deverrouiller', phrase });
    $('phrase-ouvrir').value = '';
    $('ouvrir').disabled = false;
    if (!reponse || !reponse.ok) {
      etat($('etat-ouvrir'), reponse && reponse.refus === 'phrase' ? 'Phrase de passe incorrecte.' : 'Déverrouillage impossible : réessayez.', 'erreur');
      $('phrase-ouvrir').focus();
      return;
    }
    if (dansMbn) {
      etat($('etat-ouvrir'), 'Déverrouillé. Connexion…', 'succes');
      prevenir('enregistre', { profil: '' });
      return;
    }
    coffre = await demander({ mbn: 'coffre-etat' });
    montrerSaisie('Déverrouillé jusqu\'à la fermeture de Chrome. Vous pouvez revenir à la page de connexion.');
  });
  // Phrase oubliée : réenregistrer les identifiants (le mot de passe est
  // alors à retaper), ce qui remplace l'ancien coffre.
  $('oubliee').addEventListener('click', () => {
    montrerSaisie();
    etat($('etat'), 'Réenregistrez identifiant, mot de passe et date de naissance avec une nouvelle phrase de passe : ils remplaceront les anciens.');
  });

  // ---- Au chargement ----
  demander({ mbn: 'coffre-etat' }).then((reponse) => {
    coffre = reponse && !reponse.refus ? reponse : {};
    if (coffre.enregistre && coffre.verrouille) montrerDeverrouillage();
    else montrerSaisie();
  });
})();
