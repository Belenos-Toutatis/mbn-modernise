// MBN modernisé — avis de mise à jour.
//
// Une extension installée depuis un dossier ne se met pas à jour toute seule.
// Ce script compare donc, deux fois par jour, le numéro de version installé à
// celui publié sur GitHub, et affiche une pastille sur l'icône de l'extension
// quand une version plus récente existe. La fenêtre de l'extension dit alors
// comment la récupérer.
//
// La seule requête faite ici est la lecture du fichier « manifest.json » public
// du dépôt : rien n'est envoyé, ni sur vous ni sur MBN. Le téléchargement de la
// nouvelle version, lui, n'a lieu que sur un clic, dans mise-a-jour.html.

// Coffre des identifiants de la connexion sans clic (pages de connexion).
importScripts('coffre.js');

const SOURCE = 'https://raw.githubusercontent.com/Belenos-Toutatis/mbn-modernise/main/manifest.json';
const ALARME = 'mbn-verifier-maj';

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

const afficher = async (version) => {
  await chrome.action.setBadgeText({ text: version ? '↑' : '' });
  if (version) await chrome.action.setBadgeBackgroundColor({ color: '#d9480f' });
  await chrome.action.setTitle({ title: version ? `MBN modernisé — version ${version} disponible` : 'MBN modernisé' });
};

const verifier = async () => {
  const installee = chrome.runtime.getManifest().version;
  const { verifierMaj } = await chrome.storage.local.get({ verifierMaj: true });
  if (verifierMaj === false) {
    await chrome.storage.local.remove('majDisponible');
    await afficher('');
    return;
  }
  try {
    const reponse = await fetch(SOURCE, { cache: 'no-store', credentials: 'omit' });
    if (!reponse.ok) throw new Error('HTTP ' + reponse.status);
    const publiee = String((await reponse.json()).version || '');
    const nouvelle = /^\d+(\.\d+)*$/.test(publiee) && plusRecente(publiee, installee) ? publiee : '';
    await chrome.storage.local.set({ majDisponible: nouvelle, majVerifiee: Date.now(), majErreur: '' });
    await afficher(nouvelle);
  } catch (erreur) {
    // Hors ligne, dépôt inaccessible… : on garde le dernier résultat connu.
    await chrome.storage.local.set({ majErreur: String(erreur && erreur.message || erreur), majVerifiee: Date.now() });
  }
};

const programmer = () => chrome.alarms.create(ALARME, { delayInMinutes: 1, periodInMinutes: 720 });

chrome.runtime.onInstalled.addListener(() => { programmer(); verifier(); });
chrome.runtime.onStartup.addListener(() => { programmer(); verifier(); });
chrome.alarms.onAlarm.addListener((alarme) => { if (alarme.name === ALARME) verifier(); });
// La fenêtre de l'extension peut demander une vérification immédiate.
chrome.runtime.onMessage.addListener((message, _expediteur, repondre) => {
  if (!message || message.mbn !== 'verifier-maj') return false;
  verifier().then(() => repondre(true), () => repondre(false));
  return true;
});
chrome.storage.onChanged.addListener((changements) => { if (changements.verifierMaj) verifier(); });
