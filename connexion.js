// MBN modernisé — écran de choix du profil de connexion (page CAS de MBN :
// enseignant d'une académie, parent ou élève…).
//
// Connexion rapide (réglage « connexionRapide ») : le profil que l'utilisateur
// valide est retenu ; aux visites suivantes, il est coché et validé seul après
// un court délai, pendant lequel « Annuler » rend la connexion classique
// (demande du 2026-11-28). C'est la seule validation de formulaire faite sans
// clic sur MBN : elle ne transmet qu'un choix de profil.
//
// Connexion sans clic (réglage « connexionAuto ») : « Connexion sans clic… »
// ouvre une fenêtre de l'extension (connexion-saisie.html, dans un cadre que
// MBN ne peut pas lire) pour enregistrer profil, identifiant, mot de passe et
// date de naissance. connexion-academie.js les tape ensuite sur la page de
// l'académie ; coffre.js les garde chiffrés.
//
// Rien n'est validé seul, et l'onglet passe en connexion classique :
// - après une déconnexion volontaire, jusqu'à la prochaine validation à la
//   main ou un clic sur « Me connecter automatiquement » (poste partagé : ne
//   pas reconnecter aussitôt le compte) ;
// - si l'extension a validé dans cet onglet il y a moins d'une minute (échec,
//   retour arrière) : pas de boucle. Ici le profil est coché, sans plus.

(() => {
  const texte = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const envoyer = (mbn) => chrome.runtime.sendMessage({ mbn }).catch(() => null);

  // ---- Déconnexion volontaire, notée depuis toutes les pages MBN ----
  const DECONNEXION = /logout|d[ée]connexion|d[ée]connecter/i;
  document.addEventListener('click', (e) => {
    if (!e.isTrusted || !e.target.closest) return;
    const lien = e.target.closest('a, button');
    if (!lien || lien.closest('.mbn-connexion-bandeau')) return;
    const indices = [lien.getAttribute('href'), lien.getAttribute('class'), lien.id,
      lien.getAttribute('title'), lien.getAttribute('aria-label'), texte(lien)].join(' ');
    if (DECONNEXION.test(indices)) chrome.storage.local.set({ connexionDeconnexion: Date.now() });
  }, true);

  // ---- Écran de choix du profil ----
  const formulaire = document.querySelector('form.cas__wayf-form');
  const valider = formulaire && formulaire.querySelector('#button-submit, [type="submit"]');
  if (!valider) return;
  document.documentElement.classList.add('mbn-connexion');

  // Libellé complet : catégorie (« Enseignant ») suivie du profil
  // (« de l'académie de … »), le second n'ayant pas de sens seul.
  const libelle = (radio) => {
    const etiquette = (radio.id && formulaire.querySelector(`label[for="${CSS.escape(radio.id)}"]`))
      || radio.closest('label') || (radio.parentElement && radio.parentElement.querySelector('label'));
    const categorie = radio.closest('fieldset');
    const titre = categorie ? texte(categorie.querySelector('legend')).replace(/^[−+-]\s*/, '') : '';
    const profil = texte(etiquette);
    return titre && !profil.toLowerCase().startsWith(titre.toLowerCase()) ? `${titre} ${profil}` : profil;
  };
  const radios = () => [...formulaire.querySelectorAll('input[type="radio"]')].filter((r) => r.id && !r.disabled);

  // Cocher par la commande d'origine (MBN réagit à ce clic), et déplier la
  // catégorie qui contient le profil si MBN l'a repliée.
  const cocher = (radio) => {
    if (!radio.checked) radio.click();
    const liste = radio.closest('.js-wayfchoices');
    const fieldset = liste && liste.classList.contains('hide') && liste.closest('fieldset');
    const deplier = fieldset && fieldset.querySelector('.js-wayftoggle');
    if (deplier) deplier.click();
  };

  // Toute validation : nouvelle tentative pour coffre.js. Validation à la main :
  // le profil coché est retenu, et une déconnexion antérieure est oubliée.
  let parExtension = false;
  formulaire.addEventListener('submit', () => {
    envoyer('connexion-debut');
    if (parExtension) return;
    const choisi = formulaire.querySelector('input[type="radio"]:checked');
    if (choisi && choisi.id) chrome.storage.local.set({ connexionProfil: { id: choisi.id, libelle: libelle(choisi) }, connexionDeconnexion: 0 });
  });
  const soumettre = () => { parExtension = true; valider.click(); };

  const MARQUE = 'mbn-connexion-auto';
  const lireMarque = () => { try { return Number(sessionStorage.getItem(MARQUE)) || 0; } catch { return 0; } };
  const poserMarque = () => { try { sessionStorage.setItem(MARQUE, String(Date.now())); } catch { /* sans mémoire d'onglet */ } };

  const DELAI = 1000; // temps laissé pour annuler

  // ---- Bandeau ----
  const bandeau = document.createElement('div');
  bandeau.className = 'mbn-connexion-bandeau';
  bandeau.setAttribute('role', 'status');
  const message = document.createElement('p');
  const barre = document.createElement('div');
  barre.className = 'mbn-connexion-barre';
  const actions = document.createElement('div');
  actions.className = 'mbn-connexion-actions';
  bandeau.append(message, barre, actions);
  const bouton = (libelleBouton, action, principal = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = principal ? 'mbn-connexion-bouton mbn-connexion-principal' : 'mbn-connexion-bouton';
    b.textContent = libelleBouton;
    b.addEventListener('click', action);
    actions.append(b);
    return b;
  };
  const afficher = (texteMessage, genre) => {
    message.textContent = texteMessage;
    bandeau.classList.remove('mbn-connexion-decompte', 'mbn-connexion-manuel', 'mbn-connexion-offre');
    if (genre) bandeau.classList.add(genre);
    actions.replaceChildren();
    if (!bandeau.isConnected) formulaire.prepend(bandeau);
  };
  const focaliserValider = () => {
    if (!document.activeElement || document.activeElement === document.body) valider.focus({ preventScroll: true });
  };

  // ---- Décompte ----
  let minuteur = 0;
  const arreterDecompte = () => {
    clearTimeout(minuteur);
    minuteur = 0;
    window.removeEventListener('pointerdown', surGeste, true);
    window.removeEventListener('keydown', surGeste, true);
  };
  // Un geste de l'utilisateur ailleurs que dans le bandeau interrompt le
  // décompte : il reprend la main, profil coché.
  function surGeste(e) {
    if (!e.isTrusted || (e.target.closest && e.target.closest('.mbn-connexion-bandeau'))) return;
    arreterDecompte();
    afficher('Validation automatique interrompue. Validez pour continuer.', 'mbn-connexion-manuel');
  }

  // ---- Fenêtre de saisie de la connexion sans clic ----
  const ORIGINE = new URL(chrome.runtime.getURL('')).origin;
  let calque = null;
  const fermerSaisie = () => { if (calque) { calque.remove(); calque = null; } };
  const ouvrirSaisie = () => {
    arreterDecompte();
    if (calque) return;
    // Profil proposé : celui qui est coché, sinon le premier profil enseignant.
    const profils = radios().map((r) => ({ id: r.id, libelle: libelle(r) }));
    const coche = formulaire.querySelector('input[type="radio"]:checked');
    const enseignant = profils.find((p) => /^enseignant/i.test(p.libelle));
    const donnees = { profils, choisi: coche ? coche.id : enseignant ? enseignant.id : '' };
    calque = document.createElement('div');
    calque.className = 'mbn-saisie-connexion';
    calque.setAttribute('role', 'dialog');
    calque.setAttribute('aria-modal', 'true');
    calque.setAttribute('aria-label', 'Connexion automatique');
    const cadre = document.createElement('iframe');
    cadre.title = 'Connexion automatique';
    cadre.src = chrome.runtime.getURL('connexion-saisie.html') + '#' + encodeURIComponent(JSON.stringify(donnees));
    calque.append(cadre);
    calque.addEventListener('click', (e) => { if (e.target === calque) annulerSaisie(); });
    document.body.append(calque);
    cadre.addEventListener('load', () => cadre.focus());
  };
  const annulerSaisie = () => {
    fermerSaisie();
    envoyer('connexion-classique');
    afficher('Connexion classique : choisissez votre profil et validez.', 'mbn-connexion-manuel');
    focaliserValider();
  };
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!calque || e.origin !== ORIGINE || !d || d.mbn !== 'saisie-connexion') return;
    const cadre = calque.querySelector('iframe');
    if (e.source !== cadre.contentWindow) return;
    if (d.action === 'taille') cadre.style.height = Math.min(Number(d.hauteur) || 0, window.innerHeight - 32) + 'px';
    else if (d.action === 'annuler') annulerSaisie();
    else if (d.action === 'enregistre') {
      fermerSaisie();
      const radio = d.profil && document.getElementById(d.profil);
      if (radio && formulaire.contains(radio)) cocher(radio);
      chrome.storage.local.set({ connexionDeconnexion: 0 });
      envoyer('connexion-auto');
      afficher('Connexion automatique…', 'mbn-connexion-decompte');
      if (formulaire.querySelector('input[type="radio"]:checked') && !valider.disabled) { poserMarque(); soumettre(); }
      else afficher('Choisissez votre profil et validez.', 'mbn-connexion-manuel');
    }
  });
  document.addEventListener('keydown', (e) => { if (calque && e.key === 'Escape' && e.isTrusted) annulerSaisie(); });

  // ---- Au chargement ----
  Promise.all([
    chrome.storage.local.get({ connexionRapide: true, connexionProfil: null, connexionDeconnexion: 0 }),
    chrome.runtime.sendMessage({ mbn: 'coffre-etat' }).catch(() => null),
  ]).then(([reglages, coffre]) => {
    if (reglages.connexionRapide === false) return;
    const sansClic = !!(coffre && coffre.enregistre && coffre.auto && !coffre.echec);
    const proposerSaisie = (libelleBouton = 'Connexion sans clic…') => bouton(libelleBouton, ouvrirSaisie);
    const signalerEchec = () => {
      if (!coffre || !coffre.echec) return '';
      bouton('Vérifier mes identifiants…', ouvrirSaisie);
      return ' Connexion sans clic suspendue après un échec.';
    };

    const profil = reglages.connexionProfil;
    const radio = profil && profil.id && document.getElementById(profil.id);
    if (!radio || radio.type !== 'radio' || radio.disabled || !formulaire.contains(radio)) {
      if (!coffre || !coffre.enregistre) {
        afficher('Se connecter sans aucun clic à chaque visite :', 'mbn-connexion-offre');
        proposerSaisie('Configurer…');
      }
      return;
    }

    cocher(radio);
    const nom = libelle(radio) || profil.libelle || 'profil retenu';
    // Libellé retenu par une version antérieure : remis à jour.
    if (nom !== profil.libelle) chrome.storage.local.set({ connexionProfil: { id: profil.id, libelle: nom } });

    if (reglages.connexionDeconnexion) {
      envoyer('connexion-classique');
      afficher(`Après une déconnexion, rien n'est fait automatiquement. Profil coché : « ${nom} ».`, 'mbn-connexion-manuel');
      if (coffre && coffre.enregistre && coffre.auto) {
        bouton('Me connecter automatiquement', () => {
          if (coffre.verrouille) { ouvrirSaisie(); return; } // phrase de passe d'abord
          chrome.storage.local.set({ connexionDeconnexion: 0 });
          envoyer('connexion-auto').then(() => { poserMarque(); soumettre(); });
        }, true);
      } else if (!coffre || !coffre.enregistre) proposerSaisie();
      focaliserValider();
      return;
    }
    if (Date.now() - lireMarque() < 60000) {
      afficher(`La connexion automatique vient d'être tentée. Profil coché : « ${nom} ». Validez pour continuer.`, 'mbn-connexion-manuel');
      if (!coffre || !coffre.enregistre) proposerSaisie();
      focaliserValider();
      return;
    }

    // Phrase de passe pas encore tapée depuis l'ouverture de Chrome : la
    // fenêtre de l'extension la demande, puis la connexion part seule.
    if (sansClic && coffre.verrouille) {
      afficher(`Connexion automatique avec « ${nom} » : phrase de passe demandée une fois par ouverture de Chrome.`, 'mbn-connexion-manuel');
      ouvrirSaisie();
      return;
    }

    afficher(`${sansClic ? 'Connexion automatique' : 'Connexion'} avec « ${nom} »…`, 'mbn-connexion-decompte');
    const suite = signalerEchec();
    if (suite) message.textContent += suite;
    bandeau.style.setProperty('--mbn-connexion-delai', DELAI + 'ms');
    bouton('Annuler', () => {
      arreterDecompte();
      envoyer('connexion-classique');
      afficher('Connexion classique : choisissez votre profil et validez.', 'mbn-connexion-manuel');
      focaliserValider();
    }, true);
    if (!coffre || !coffre.enregistre) proposerSaisie();

    window.addEventListener('pointerdown', surGeste, true);
    window.addEventListener('keydown', surGeste, true);
    minuteur = setTimeout(() => {
      arreterDecompte();
      if (!radio.checked || valider.disabled) { afficher('Validez pour continuer.', 'mbn-connexion-manuel'); return; }
      poserMarque();
      soumettre();
    }, DELAI);
  });
})();
