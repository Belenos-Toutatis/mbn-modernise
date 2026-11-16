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
