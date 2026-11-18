const resultat = document.getElementById('resultat');
const etat = document.getElementById('etat');
const boutonCopier = document.getElementById('copier');
const boutonEnregistrer = document.getElementById('enregistrer');

document.getElementById('capturer').addEventListener('click', async () => {
  etat.textContent = 'Capture en cours…';
  try {
    const [onglet] = await chrome.tabs.query({ active: true, currentWindow: true });
    const cadres = await chrome.scripting.executeScript({
      target: { tabId: onglet.id, allFrames: true },
      files: ['capture.js'],
    });
    // Version et heure : permettent de savoir de quand date une capture.
    const version = chrome.runtime.getManifest().version;
    const heure = new Date().toLocaleString('fr-FR');
    resultat.value = `# extension MBN modernisé ${version} — capture du ${heure}\n\n` + cadres
      .filter((c) => typeof c.result === 'string')
      .map((c) => `===== cadre ${c.frameId} =====\n${c.result}`)
      .join('\n\n');
    const lignes = resultat.value.split('\n').length;
    etat.textContent = `${lignes} lignes relevées dans ${cadres.length} cadre(s).`;
    boutonCopier.disabled = boutonEnregistrer.disabled = !resultat.value;
  } catch (erreur) {
    etat.textContent = 'Capture impossible sur cette page : ' + erreur.message;
  }
});

boutonCopier.addEventListener('click', async () => {
  await navigator.clipboard.writeText(resultat.value);
  etat.textContent = 'Copié dans le presse-papiers.';
});

boutonEnregistrer.addEventListener('click', () => {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([resultat.value], { type: 'text/plain' }));
  const horodatage = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  lien.download = `capture-mbn-${horodatage}.txt`;
  lien.click();
  etat.textContent = 'Fichier enregistré dans vos téléchargements.';
});

// ---- Réglages du rafraîchissement automatique ----
const caseRafraichir = document.getElementById('rafraichir');
const champMinutes = document.getElementById('minutes');

chrome.storage.local.get({ rafraichissement: { actif: true, minutes: 5 } }).then(({ rafraichissement }) => {
  caseRafraichir.checked = rafraichissement.actif !== false;
  champMinutes.value = rafraichissement.minutes || 5;
});

const enregistrerReglages = () => {
  const minutes = Math.min(120, Math.max(1, Math.round(Number(champMinutes.value)) || 5));
  chrome.storage.local.set({ rafraichissement: { actif: caseRafraichir.checked, minutes } });
};
caseRafraichir.addEventListener('change', enregistrerReglages);
champMinutes.addEventListener('change', enregistrerReglages);

// ---- Apparence modernisée ----
const caseModerne = document.getElementById('moderne');
chrome.storage.local.get({ moderne: true }).then(({ moderne }) => { caseModerne.checked = moderne !== false; });
caseModerne.addEventListener('change', () => chrome.storage.local.set({ moderne: caseModerne.checked }));

// ---- Couleurs des séances ----
const caseCouleurs = document.getElementById('couleurs');
chrome.storage.local.get({ couleurs: true }).then(({ couleurs }) => { caseCouleurs.checked = couleurs !== false; });
caseCouleurs.addEventListener('change', () => chrome.storage.local.set({ couleurs: caseCouleurs.checked }));

// ---- Bandeau compact de la messagerie ----
const caseCompact = document.getElementById('compact');
chrome.storage.local.get({ compact: true }).then(({ compact }) => { caseCompact.checked = compact !== false; });
caseCompact.addEventListener('change', () => chrome.storage.local.set({ compact: caseCompact.checked }));

// ---- Menu latéral qui se déplie au survol ----
const caseMenu = document.getElementById('menuSurvol');
chrome.storage.local.get({ menuSurvol: true }).then(({ menuSurvol }) => { caseMenu.checked = menuSurvol !== false; });
caseMenu.addEventListener('change', () => chrome.storage.local.set({ menuSurvol: caseMenu.checked }));

// ---- Mises à jour ----
// La vérification est faite par arriere-plan.js ; ici on affiche son résultat.
const ouvrirMaj = () => chrome.tabs.create({ url: chrome.runtime.getURL('mise-a-jour.html') });
const caseMaj = document.getElementById('verifierMaj');
const blocMaj = document.getElementById('maj');
const ligneVersion = document.getElementById('version');
// « verdict » : on vient de cliquer sur « Vérifier maintenant ». Le bandeau du
// haut est alors hors de vue (la fenêtre a défilé) : le résultat s'affiche
// aussi juste à côté du bouton.
const afficherMaj = async (verdict = false) => {
  const installee = chrome.runtime.getManifest().version;
  const v = await chrome.storage.local.get({ verifierMaj: true, majDisponible: '', majVerifiee: 0, majErreur: '' });
  caseMaj.checked = v.verifierMaj !== false;
  const nouvelle = v.verifierMaj !== false ? v.majDisponible : '';
  blocMaj.hidden = !nouvelle;
  if (nouvelle) document.getElementById('maj-titre').textContent = `Version ${nouvelle} disponible (vous avez la ${installee}).`;
  ligneVersion.textContent = `Version installée : ${installee}. `;
  if (v.verifierMaj === false) return;
  ligneVersion.append(v.majErreur ? 'Dernière vérification impossible (hors ligne ?). '
    : v.majVerifiee ? `Vérifié le ${new Date(v.majVerifiee).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}${nouvelle ? '' : ' : à jour'}. `
      : 'Pas encore vérifié. ');
  const bouton = document.createElement('button');
  bouton.textContent = 'Vérifier maintenant';
  bouton.addEventListener('click', async () => {
    bouton.disabled = true;
    bouton.textContent = 'Vérification…';
    try { await chrome.runtime.sendMessage({ mbn: 'verifier-maj' }); } catch { /* arrière-plan indisponible */ }
    afficherMaj(true);
  });
  ligneVersion.append(bouton);
  if (!verdict) return;
  const resultat = document.createElement('span');
  resultat.setAttribute('role', 'status');
  resultat.className = 'verdict ' + (v.majErreur ? 'erreur' : nouvelle ? 'nouvelle' : 'a-jour');
  resultat.textContent = v.majErreur ? 'Vérification impossible' : nouvelle ? `Version ${nouvelle} disponible` : '✓ Vous êtes à jour';
  ligneVersion.append(resultat);
  if (nouvelle && !v.majErreur) {
    const installer = document.createElement('button');
    installer.className = 'principal';
    installer.textContent = 'Mettre à jour…';
    installer.addEventListener('click', ouvrirMaj);
    ligneVersion.append(installer);
  }
};
caseMaj.addEventListener('change', async () => {
  await chrome.storage.local.set({ verifierMaj: caseMaj.checked });
  setTimeout(afficherMaj, 400);
});
afficherMaj();
// La mise à jour elle-même se fait dans un onglet (mise-a-jour.html) : cette
// fenêtre se ferme dès qu'elle perd le focus, donc au premier choix de dossier.
document.getElementById('maj-installer').addEventListener('click', ouvrirMaj);
document.getElementById('page-maj').addEventListener('click', ouvrirMaj);
document.getElementById('recharger-extension').addEventListener('click', () => chrome.runtime.reload());
