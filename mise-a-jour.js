// MBN modernisé — page de mise à jour.
//
// Une extension chargée depuis un dossier ne peut pas se mettre à jour seule.
// Cette page le fait à sa place, sur un clic : elle télécharge l'archive ZIP
// du dépôt public, puis en copie les fichiers dans le dossier de l'extension,
// que l'utilisateur désigne une fois (Chrome retient ce choix, pas le droit
// d'écriture, qu'il redemande à chaque fois).
//
// Rien n'est envoyé : la seule requête est le téléchargement de l'archive.
// Garde-fous : le dossier choisi doit déjà contenir cette extension, l'archive
// aussi, et le « manifest.json » n'est remplacé qu'en dernier, pour qu'une
// copie interrompue laisse l'ancienne version en état de marche.

const ARCHIVE = 'https://codeload.github.com/Belenos-Toutatis/mbn-modernise/zip/refs/heads/main';

// ---- Lecture d'une archive ZIP (sans dépendance) ----
// Renvoie [{ nom, lire() }] pour chaque fichier, d'après le répertoire central.
const lireZip = (tampon) => {
  const vue = new DataView(tampon);
  const octets = new Uint8Array(tampon);
  let fin = -1;
  for (let i = tampon.byteLength - 22; i >= Math.max(0, tampon.byteLength - 66000); i -= 1) {
    if (vue.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('archive illisible');
  const nombre = vue.getUint16(fin + 10, true);
  let p = vue.getUint32(fin + 16, true);
  const decodeur = new TextDecoder('utf-8');
  const fichiers = [];
  for (let n = 0; n < nombre; n += 1) {
    if (vue.getUint32(p, true) !== 0x02014b50) throw new Error('archive illisible');
    const methode = vue.getUint16(p + 10, true);
    const tailleCompressee = vue.getUint32(p + 20, true);
    const longueurNom = vue.getUint16(p + 28, true);
    const longueurExtra = vue.getUint16(p + 30, true);
    const longueurCommentaire = vue.getUint16(p + 32, true);
    const debut = vue.getUint32(p + 42, true);
    const nom = decodeur.decode(octets.subarray(p + 46, p + 46 + longueurNom));
    p += 46 + longueurNom + longueurExtra + longueurCommentaire;
    if (nom.endsWith('/')) continue;
    fichiers.push({
      nom,
      lire: async () => {
        const donnees = debut + 30 + vue.getUint16(debut + 26, true) + vue.getUint16(debut + 28, true);
        const brut = octets.subarray(donnees, donnees + tailleCompressee);
        if (methode === 0) return brut;
        if (methode !== 8) throw new Error('compression non prise en charge');
        const flux = new Blob([brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(flux).arrayBuffer());
      },
    });
  }
  return fichiers;
};

// Retire le dossier de tête que GitHub ajoute (« depot-branche/ ») et écarte
// tout chemin qui sortirait du dossier ou toucherait à Git.
const chemins = (fichiers) => fichiers
  .map((f) => ({ ...f, chemin: f.nom.split('/').slice(1) }))
  .filter((f) => f.chemin.length && f.chemin.every((m) => m && m !== '.' && m !== '..' && !m.includes('\\')) && !f.chemin[0].startsWith('.git'));

// Vrai si la version « a » est plus récente que « b » (comparaison nombre à nombre).
const plusRecente = (a, b) => {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0;
  }
  return false;
};

const lireManifeste = (octets) => JSON.parse(new TextDecoder('utf-8').decode(octets));

// Un dossier relu dans la mémoire de Chrome peut ne plus jamais répondre, sans
// erreur : toute attente sur un dossier est donc bornée, sauf les fenêtres où
// Chrome attend l'utilisateur (choix du dossier, autorisation d'écrire).
const borner = (promesse, ms, quoi) => {
  let minuteur;
  const limite = new Promise((_, non) => {
    minuteur = setTimeout(() => {
      const erreur = new Error(`Chrome ne répond plus (${quoi}) : choisissez de nouveau le dossier de l'extension`);
      erreur.name = 'DossierMuet';
      non(erreur);
    }, ms);
  });
  return Promise.race([promesse, limite]).finally(() => clearTimeout(minuteur));
};

// Le dossier désigné contient-il bien cette extension ?
const versionDuDossier = async (dossier, nomAttendu) => {
  try {
    const fichier = await (await dossier.getFileHandle('manifest.json')).getFile();
    const manifeste = JSON.parse(await fichier.text());
    return manifeste.name === nomAttendu ? String(manifeste.version || '?') : '';
  } catch { return ''; }
};

// Écrit un fichier, sauf s'il est déjà identique : chaque écriture passe par
// un fichier temporaire que Chrome fait contrôler avant de le mettre en place,
// ce qui est lent (surtout avec un antivirus). D'une version à l'autre, la
// plupart des fichiers ne changent pas. Renvoie vrai si le fichier a été écrit.
const ecrire = async (dossier, chemin, octets) => {
  let ou = dossier;
  for (const partie of chemin.slice(0, -1)) ou = await ou.getDirectoryHandle(partie, { create: true });
  const fichier = await ou.getFileHandle(chemin[chemin.length - 1], { create: true });
  try {
    const actuel = await fichier.getFile();
    if (actuel.size === octets.length) {
      const anciens = new Uint8Array(await actuel.arrayBuffer());
      if (anciens.every((o, i) => o === octets[i])) return false;
    }
  } catch { /* illisible : on réécrit */ }
  // Chrome refuse parfois l'écriture si le fichier vient de changer sur le
  // disque : on réessaie deux fois, avec un accès neuf.
  for (let tour = 0; ; tour += 1) {
    let flux;
    try {
      const cible = tour ? await ou.getFileHandle(chemin[chemin.length - 1], { create: true }) : fichier;
      flux = await cible.createWritable();
      await flux.write(octets);
      await flux.close();
      return true;
    } catch (erreur) {
      if (flux) flux.abort().catch(() => {});
      if (tour >= 2 || !['InvalidStateError', 'NoModificationAllowedError'].includes(erreur.name)) {
        throw new Error(`« ${chemin.join('/')} » n’a pas pu être écrit (${erreur.name}) : réessayez`);
      }
      await new Promise((ok) => setTimeout(ok, 400 * (tour + 1)));
    }
  }
};

// Copie l'archive dans le dossier. Renvoie { version, ecrits, total }.
const installerArchive = async (dossier, tampon, nomAttendu, suivre = () => {}) => {
  const fichiers = chemins(lireZip(tampon));
  const manifeste = fichiers.find((f) => f.chemin.join('/') === 'manifest.json');
  if (!manifeste) throw new Error('l\'archive ne contient pas l\'extension');
  const octetsManifeste = await manifeste.lire();
  const publie = lireManifeste(octetsManifeste);
  if (publie.name !== nomAttendu || !/^\d+(\.\d+)*$/.test(String(publie.version))) throw new Error('l\'archive ne contient pas l\'extension');
  // Tout décompresser avant d'écrire : une archive abîmée ne touche à rien.
  const autres = fichiers.filter((f) => f !== manifeste);
  const contenus = await Promise.all(autres.map((f) => f.lire()));
  // Plusieurs fichiers à la fois : l'attente du contrôle de Chrome se partage.
  let suivant = 0;
  let faits = 0;
  let ecrits = 0;
  let arret = false; // une écriture en échec arrête aussi les autres ouvriers
  const ouvrier = async () => {
    while (!arret && suivant < autres.length) {
      const i = suivant;
      suivant += 1;
      try {
        if (await borner(ecrire(dossier, autres[i].chemin, contenus[i]), 60000, 'écriture de ' + autres[i].chemin.join('/'))) ecrits += 1;
      } catch (erreur) { arret = true; throw erreur; }
      faits += 1;
      suivre(faits / (autres.length + 1));
    }
  };
  await Promise.all(Array.from({ length: 6 }, ouvrier));
  if (await borner(ecrire(dossier, manifeste.chemin, octetsManifeste), 60000, 'écriture de manifest.json')) ecrits += 1;
  suivre(1);
  return { version: String(publie.version), ecrits, total: autres.length + 1 };
};

// ---- Mémoire du dossier (IndexedDB : seul endroit où ranger ce type d'objet) ----
const base = () => new Promise((ok, non) => {
  const demande = indexedDB.open('mbn-maj', 1);
  demande.onupgradeneeded = () => demande.result.createObjectStore('dossier');
  demande.onsuccess = () => ok(demande.result);
  demande.onerror = () => non(demande.error);
});
const memoire = async (mode, action) => {
  const bd = await base();
  try {
    return await new Promise((ok, non) => {
      const demande = action(bd.transaction('dossier', mode).objectStore('dossier'));
      demande.onsuccess = () => ok(demande.result);
      demande.onerror = () => non(demande.error);
    });
  } finally { bd.close(); }
};
const retenir = (dossier) => memoire('readwrite', (s) => s.put(dossier, 'extension'));
const retrouver = () => memoire('readonly', (s) => s.get('extension')).catch(() => null);

// ---- Page ----
(async () => {
  if (!globalThis.chrome || !chrome.runtime || !chrome.runtime.getManifest) return; // hors extension (essais)
  const $ = (id) => document.getElementById(id);
  const moi = chrome.runtime.getManifest();
  const etat = (texte, genre = '') => { $('etat').textContent = texte; $('etat').className = genre; };
  let dossier = await borner(retrouver(), 3000, 'mémoire du dossier').catch(() => null);
  let essai = 0; // choisir un autre dossier abandonne l'essai resté en attente

  const { majDisponible = '' } = await chrome.storage.local.get({ majDisponible: '' });
  $('versions').textContent = majDisponible
    ? `Version ${majDisponible} disponible — vous avez la ${moi.version}.`
    : `Version installée : ${moi.version}. Aucune version plus récente n'est signalée.`;

  // Le dossier contient déjà la dernière version (copiée à la main, par Git…) :
  // rien à copier, il suffit de recharger l'extension.
  const dejaCopiee = (version) => Boolean(version) && plusRecente(version, moi.version) && !plusRecente(majDisponible, version);
  const proposerRechargement = (version) => {
    etat(`La version ${version} est déjà dans le dossier : rien à copier. Rechargez l’extension, puis les pages MBN ouvertes.`, 'succes');
    $('recharger').hidden = false;
    $('installer').hidden = true;
    $('choisir').hidden = true;
  };
  // Chrome sert le manifeste depuis le disque : c'est la version du dossier, qui
  // peut être plus récente que celle en cours d'exécution.
  const versionSurDisque = async () => {
    try {
      const reponse = await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' });
      return String((await reponse.json()).version || '');
    } catch { return ''; }
  };

  const decrire = () => {
    $('dossier').textContent = dossier
      ? `Dossier retenu : « ${dossier.name} ».`
      : 'La première fois, Chrome vous demandera de désigner le dossier de l\'extension.';
    $('choisir').textContent = dossier ? 'Changer de dossier…' : 'Choisir le dossier de l\'extension…';
  };
  decrire();

  const choisir = async () => {
    if (!window.showDirectoryPicker) throw new Error('ce navigateur ne permet pas d\'écrire dans un dossier : suivez la méthode à la main');
    const choix = await window.showDirectoryPicker({ id: 'mbn-modernise', mode: 'readwrite' });
    if (!await borner(versionDuDossier(choix, moi.name), 5000, 'lecture du dossier')) throw new Error(`le dossier « ${choix.name} » ne contient pas l'extension (pas de manifest.json « ${moi.name} »)`);
    dossier = choix;
    await borner(retenir(dossier), 2000, 'mémorisation du dossier').catch(() => {});
    decrire();
  };

  const signaler = (erreur) => {
    if (erreur && erreur.name === 'AbortError') { etat('Choix annulé.'); return; }
    etat('Échec : ' + String(erreur && erreur.message || erreur) + '.', 'erreur');
  };

  $('choisir').addEventListener('click', async () => {
    try {
      await choisir();
      essai += 1;
      $('installer').disabled = false;
      etat('Dossier retenu. Cliquez sur « Mettre à jour maintenant ».');
    } catch (erreur) { signaler(erreur); }
  });

  $('installer').addEventListener('click', async () => {
    $('installer').disabled = true;
    essai += 1;
    const numero = essai;
    const abandonne = () => numero !== essai;
    try {
      if (dossier) {
        etat('Vérification du dossier…');
        // Délai court : le sélecteur doit pouvoir s'ouvrir dans le même clic.
        let droit;
        try {
          droit = await borner(dossier.queryPermission({ mode: 'readwrite' }), 1500, 'dossier mémorisé');
        } catch (erreur) {
          if (abandonne()) return;
          if (erreur.name !== 'DossierMuet') throw erreur;
          dossier = null;
          decrire();
          etat('Chrome ne répond plus pour le dossier mémorisé : choisissez-le de nouveau.');
        }
        if (abandonne()) return;
        if (dossier && droit !== 'granted') {
          etat('Autorisez l’écriture dans la fenêtre de Chrome. Si rien ne s’affiche, choisissez de nouveau le dossier.');
          droit = await dossier.requestPermission({ mode: 'readwrite' });
          if (abandonne()) return;
          if (droit !== 'granted') throw new Error("Chrome n'a pas reçu l'autorisation d'écrire dans le dossier");
        }
      }
      if (!dossier) await choisir();
      if (abandonne()) return;
      const presente = await borner(versionDuDossier(dossier, moi.name), 5000, 'lecture du dossier');
      if (abandonne()) return;
      if (!presente) throw new Error(`le dossier « ${dossier.name} » ne contient plus l'extension : choisissez-le de nouveau`);
      if (dejaCopiee(presente)) { proposerRechargement(presente); return; }
      $('choisir').disabled = true; // plus de changement pendant la copie
      etat('Téléchargement…');
      const reponse = await fetch(ARCHIVE, { cache: 'no-store', credentials: 'omit' });
      if (!reponse.ok) throw new Error('téléchargement impossible (HTTP ' + reponse.status + ')');
      const tampon = await reponse.arrayBuffer();
      etat('Copie des fichiers…');
      $('avancement').hidden = false;
      const { version, ecrits, total } = await installerArchive(dossier, tampon, moi.name, (part) => { $('avancement').value = part; });
      await chrome.storage.local.set({ majDisponible: '' });
      const bilan = ecrits ? `${ecrits} fichier${ecrits > 1 ? 's' : ''} remplacé${ecrits > 1 ? 's' : ''} sur ${total}` : 'tous les fichiers étaient déjà à jour';
      etat(version === moi.version
        ? `Version ${version} : ${bilan}. Rechargez l'extension, puis les pages MBN ouvertes.`
        : `Version ${version} copiée (${bilan}). Il reste à recharger l'extension, puis les pages MBN ouvertes.`, 'succes');
      $('recharger').hidden = false;
      $('installer').hidden = true;
      $('choisir').hidden = true;
    } catch (erreur) {
      if (abandonne()) return;
      if (erreur && erreur.name === 'DossierMuet') { dossier = null; decrire(); }
      $('avancement').hidden = true;
      signaler(erreur);
    } finally {
      if (!abandonne()) {
        $('installer').disabled = false;
        $('choisir').disabled = false;
      }
    }
  });

  // Recharge l'extension : cette page se ferme d'elle-même.
  $('recharger').addEventListener('click', () => chrome.runtime.reload());
  $('extensions').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions' }));

  const surDisque = await borner(versionSurDisque(), 3000, 'manifeste').catch(() => '');
  if (!essai && dejaCopiee(surDisque)) proposerRechargement(surDisque);
})();
