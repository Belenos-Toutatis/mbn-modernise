// MBN modernisé — coffre des identifiants de la connexion sans clic
// (demandes du 2026-11-28). Chargé par arriere-plan.js.
//
// Garde l'identifiant, le mot de passe et la date de naissance académiques,
// chiffrés (AES-GCM 256), dans chrome.storage.local : profil Chrome de
// l'ordinateur, jamais le dossier de l'extension. Deux protections, choisies
// sur chaque ordinateur :
// - « phrase » : clé tirée d'une phrase de passe (PBKDF2-SHA-256, 600 000
//   tours, sel aléatoire), jamais écrite sur le disque. Une fois la phrase
//   tapée, la clé reste dans la mémoire de session de Chrome
//   (chrome.storage.session, hors de portée des pages et des scripts de
//   contenu) jusqu'à la fermeture de Chrome ou au rechargement de l'extension ;
// - « appareil » : clé non exportable rangée dans la base IndexedDB de
//   l'extension, dans le même profil que les données. Ne protège d'une copie
//   du profil que si le disque est chiffré : réservé à un ordinateur
//   personnel au disque chiffré. Coffre d'une version antérieure : ce mode.
//
// Qui obtient quoi :
// - les pages de l'extension (fenêtre de saisie, fenêtre de réglages) :
//   enregistrer, déverrouiller, verrouiller, oublier, et lire l'identifiant et
//   la date pour les modifier ; jamais le mot de passe ;
// - la page de connexion de l'académie (adresse vérifiée ici) : la seule
//   valeur que demande l'écran affiché, une fois par écran et par onglet en
//   deux minutes ; une deuxième demande signifie un échec, et la connexion
//   automatique est alors suspendue (pas de blocage du compte par essais
//   répétés) jusqu'à un nouvel enregistrement ;
// - l'écran de choix du profil de MBN : savoir si des identifiants existent
//   et s'ils sont verrouillés, et passer l'onglet en connexion classique.
// Rien n'est envoyé ailleurs.

(() => {
  const ACADEMIE = /^https:\/\/[^/]+\.ac-(nancy-metz|reims|strasbourg)\.fr\/idp\//;
  const MBN = /^https?:\/\/([^/]+\.)?monbureaunumerique\.fr\//;
  const PAGES = chrome.runtime.getURL('');
  const DELAI_ESSAI = 2 * 60 * 1000;
  const DELAI_CLASSIQUE = 10 * 60 * 1000;
  const ITERATIONS = 600000;
  const PHRASE_MIN = 12;
  const CLE_SESSION = 'connexionCleSession';
  const ETAPES = { identifiants: ['identifiant', 'motDePasse'], 'mot-de-passe': ['motDePasse'], naissance: ['naissance'] };

  const enBase64 = (octets) => btoa(String.fromCharCode(...new Uint8Array(octets)));
  const deBase64 = (texte) => Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));

  // ---- Clé d'appareil (mode « appareil ») ----
  const base = () => new Promise((ok, non) => {
    const demande = indexedDB.open('mbn-coffre', 1);
    demande.onupgradeneeded = () => demande.result.createObjectStore('cle');
    demande.onsuccess = () => ok(demande.result);
    demande.onerror = () => non(demande.error);
  });
  const transaction = async (mode, action) => {
    const bd = await base();
    try {
      return await new Promise((ok, non) => {
        const t = bd.transaction('cle', mode);
        const demande = action(t.objectStore('cle'));
        t.oncomplete = () => ok(demande.result);
        t.onerror = () => non(t.error);
      });
    } finally { bd.close(); }
  };
  const cleAppareil = async (creer) => {
    let valeur = await transaction('readonly', (s) => s.get('aes'));
    if (!valeur && creer) {
      valeur = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await transaction('readwrite', (s) => s.put(valeur, 'aes'));
    }
    return valeur || null;
  };
  const effacerCleAppareil = () => transaction('readwrite', (s) => s.delete('aes'));

  // ---- Clé tirée de la phrase de passe (mode « phrase ») ----
  const deriver = async (phrase, sel, iterations = ITERATIONS) => {
    const materiau = await crypto.subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations }, materiau, 256));
  };
  const cleBrute = (octets) => crypto.subtle.importKey('raw', octets, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const cleSession = async () => {
    const valeur = (await chrome.storage.session.get(CLE_SESSION))[CLE_SESSION];
    return valeur ? cleBrute(deBase64(valeur)) : null;
  };
  const retenirCleSession = (octets) => chrome.storage.session.set({ [CLE_SESSION]: enBase64(octets) });
  const oublierCleSession = () => chrome.storage.session.remove(CLE_SESSION);

  // ---- Coffre ----
  const lireCoffre = async () => (await chrome.storage.local.get({ connexionCoffre: null })).connexionCoffre;
  const modeDe = (coffre) => (coffre && coffre.mode === 'phrase' ? 'phrase' : 'appareil');
  const cleDu = (coffre) => (modeDe(coffre) === 'phrase' ? cleSession() : cleAppareil(false));
  const chiffrer = async (cle, valeurs) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const donnees = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cle, new TextEncoder().encode(JSON.stringify(valeurs)));
    return { iv: enBase64(iv), donnees: enBase64(donnees) };
  };
  const dechiffrer = async (cle, coffre) => {
    try {
      const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(coffre.iv) }, cle, deBase64(coffre.donnees));
      return JSON.parse(new TextDecoder().decode(clair));
    } catch { return null; } // mauvaise clé ou données abîmées
  };
  const ouvrir = async (coffre) => {
    const cle = coffre && await cleDu(coffre);
    return cle ? dechiffrer(cle, coffre) : null;
  };
  const verrouille = async (coffre) => modeDe(coffre) === 'phrase' && !(await cleSession());

  // ---- État de chaque onglet (mémoire de session, hors de portée des pages) ----
  const nomOnglet = (id) => `connexion-onglet-${id}`;
  const lireOnglet = async (id) => (await chrome.storage.session.get(nomOnglet(id)))[nomOnglet(id)] || {};
  const noterOnglet = async (id, ajout) => chrome.storage.session.set({ [nomOnglet(id)]: { ...await lireOnglet(id), ...ajout } });
  chrome.tabs.onRemoved.addListener((id) => { chrome.storage.session.remove(nomOnglet(id)); });

  const texte = (valeur, max) => (typeof valeur === 'string' ? valeur.slice(0, max) : '');

  // ---- Demandes ----
  const traiter = async (message, expediteur) => {
    const adresse = expediteur.url || '';
    const pageExtension = adresse.startsWith(PAGES);
    const academie = ACADEMIE.test(adresse) && expediteur.frameId === 0;
    const mbn = MBN.test(adresse);
    const onglet = expediteur.tab && expediteur.tab.id;

    switch (message.mbn) {
      case 'coffre-etat': {
        const r = await chrome.storage.local.get({ connexionCoffre: null, connexionAuto: false, connexionEchec: 0 });
        const coffre = r.connexionCoffre;
        const etat = {
          enregistre: !!coffre,
          auto: r.connexionAuto === true,
          echec: r.connexionEchec || 0,
          mode: coffre ? modeDe(coffre) : '',
          verrouille: !!coffre && await verrouille(coffre),
        };
        if (pageExtension && coffre && !etat.verrouille) {
          const valeurs = await ouvrir(coffre);
          if (valeurs) Object.assign(etat, { identifiant: valeurs.identifiant || '', naissance: valeurs.naissance || '' });
        }
        return etat;
      }
      case 'coffre-enregistrer': {
        if (!pageExtension) return { refus: 'expediteur' };
        const mode = message.mode === 'appareil' ? 'appareil' : 'phrase';
        const ancienCoffre = await lireCoffre();
        const ancien = await ouvrir(ancienCoffre);
        const valeurs = {
          identifiant: texte(message.identifiant, 200).trim(),
          motDePasse: texte(message.motDePasse, 500) || (ancien && ancien.motDePasse) || '',
          naissance: texte(message.naissance, 40).trim(),
        };
        if (!valeurs.identifiant) return { refus: 'incomplet' };
        if (!valeurs.motDePasse) return { refus: ancienCoffre && !ancien ? 'verrouille' : 'incomplet' };
        let cle;
        const protection = { mode };
        if (mode === 'phrase') {
          const phrase = texte(message.phrase, 1000);
          if (phrase) {
            if ([...phrase].length < PHRASE_MIN) return { refus: 'phrase-courte' };
            const sel = crypto.getRandomValues(new Uint8Array(16));
            const octets = await deriver(phrase, sel);
            cle = await cleBrute(octets);
            await retenirCleSession(octets);
            Object.assign(protection, { sel: enBase64(sel), iterations: ITERATIONS });
          } else if (ancienCoffre && modeDe(ancienCoffre) === 'phrase' && (cle = await cleSession())) {
            Object.assign(protection, { sel: ancienCoffre.sel, iterations: ancienCoffre.iterations });
          } else return { refus: 'phrase-manquante' };
          await effacerCleAppareil(); // plus aucune clé rangée sur le disque
        } else {
          cle = await cleAppareil(true);
          await oublierCleSession();
        }
        await chrome.storage.local.set({
          connexionCoffre: { ...await chiffrer(cle, valeurs), ...protection },
          connexionAuto: true,
          connexionEchec: 0,
        });
        return { ok: true };
      }
      case 'coffre-deverrouiller': {
        if (!pageExtension) return { refus: 'expediteur' };
        const coffre = await lireCoffre();
        if (!coffre || modeDe(coffre) !== 'phrase') return { refus: 'mode' };
        const octets = await deriver(texte(message.phrase, 1000), deBase64(coffre.sel), coffre.iterations || ITERATIONS);
        if (!await dechiffrer(await cleBrute(octets), coffre)) return { refus: 'phrase' };
        await retenirCleSession(octets);
        return { ok: true };
      }
      case 'coffre-verrouiller':
        if (!pageExtension) return { refus: 'expediteur' };
        await oublierCleSession();
        return { ok: true };
      case 'coffre-oublier': {
        if (!pageExtension) return { refus: 'expediteur' };
        await chrome.storage.local.remove(['connexionCoffre', 'connexionEchec']);
        await chrome.storage.local.set({ connexionAuto: false });
        await oublierCleSession();
        await effacerCleAppareil();
        return { ok: true };
      }
      case 'coffre-reprendre': {
        if (!pageExtension) return { refus: 'expediteur' };
        await chrome.storage.local.set({ connexionEchec: 0 });
        return { ok: true };
      }
      case 'connexion-classique': // « Annuler » sur l'écran de MBN : rien de tapé dans cet onglet
        if ((mbn || pageExtension) && onglet) await noterOnglet(onglet, { classique: Date.now() });
        return { ok: true };
      case 'connexion-auto': // reprise demandée par l'utilisateur dans cet onglet
        if ((mbn || pageExtension) && onglet) await noterOnglet(onglet, { classique: 0 });
        return { ok: true };
      case 'connexion-debut': // profil validé sur MBN : nouvelle tentative, compteurs remis à zéro
        if (mbn && onglet) await noterOnglet(onglet, { identifiants: 0, 'mot-de-passe': 0, naissance: 0 });
        return { ok: true };
      case 'coffre-lire': {
        const champs = ETAPES[message.etape];
        if (!academie || !onglet || !champs) return { refus: 'expediteur' };
        const r = await chrome.storage.local.get({ connexionAuto: false, connexionEchec: 0, connexionCoffre: null });
        if (r.connexionAuto !== true) return { refus: 'inactif' };
        if (r.connexionEchec) return { refus: 'echec' };
        if (!r.connexionCoffre) return { refus: 'vide' };
        const etat = await lireOnglet(onglet);
        const maintenant = Date.now();
        if (maintenant - (etat.classique || 0) < DELAI_CLASSIQUE) return { refus: 'classique' };
        if (await verrouille(r.connexionCoffre)) return { refus: 'verrouille' };
        // Valeur absente (date de naissance non enregistrée) : rien n'est tenté,
        // ce n'est donc pas un essai.
        const valeurs = await ouvrir(r.connexionCoffre);
        if (!valeurs) return { refus: 'vide' };
        if (champs.some((c) => !valeurs[c])) return { refus: 'manquant' };
        if (maintenant - (etat[message.etape] || 0) < DELAI_ESSAI) {
          await chrome.storage.local.set({ connexionEchec: maintenant });
          return { refus: 'echec' };
        }
        await noterOnglet(onglet, { [message.etape]: maintenant });
        return { valeurs: Object.fromEntries(champs.map((c) => [c, valeurs[c]])) };
      }
      case 'coffre-echec': { // erreur affichée par l'académie après un essai de l'extension
        if (!academie || !onglet) return { refus: 'expediteur' };
        const etat = await lireOnglet(onglet);
        const essai = Math.max(etat.identifiants || 0, etat['mot-de-passe'] || 0, etat.naissance || 0);
        if (Date.now() - essai < DELAI_ESSAI) await chrome.storage.local.set({ connexionEchec: Date.now() });
        return { ok: true };
      }
      case 'coffre-ouvrir-saisie':
        if (academie || mbn || pageExtension) await chrome.tabs.create({ url: chrome.runtime.getURL('connexion-saisie.html') });
        return { ok: true };
      default:
        return undefined;
    }
  };

  chrome.runtime.onMessage.addListener((message, expediteur, repondre) => {
    if (!message || typeof message.mbn !== 'string' || !/^(coffre|connexion)-/.test(message.mbn)) return false;
    if (expediteur.id !== chrome.runtime.id) return false;
    traiter(message, expediteur).then(repondre, () => repondre({ refus: 'erreur' }));
    return true;
  });
})();
