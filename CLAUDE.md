# MBN modernisé — consignes pour Claude

Extension Chrome (Manifest V3) qui corrige et modernise l'affichage de Mon Bureau
Numérique (`*.monbureaunumerique.fr`, socle Skolengo/Kosmos), pour un usage
enseignant. Le `README.md` décrit les écrans couverts et le rôle de chaque fichier.

Répondre en français.

## Règle absolue : ne jamais ouvrir MBN

MBN contient des données d'élèves protégées par le RGPD. Ne jamais naviguer sur
le site, ni dans Chrome ni dans un autre navigateur, même si une session y est
ouverte.

Le travail se fait à partir des **captures anonymisées** que produit le bouton
« Capturer cette page » de l'extension : structure, classes, positions et
couleurs, chaque texte remplacé par sa longueur. Les captures d'écran envoyées
par l'utilisateur servent de complément.

1. Reproduire la page en maquette locale à partir de la capture, hors du dépôt
   (dossier temporaire), servie par `python3 -m http.server --bind 127.0.0.1`.
2. Y charger les fichiers de l'extension et vérifier dans le navigateur intégré.
3. Dire clairement ce qui a été vérifié sur maquette et ce qui reste à confirmer
   sur MBN par l'utilisateur.

Ne jamais mettre dans un fichier suivi un nom d'élève, de professeur,
d'établissement ou de classe réelle, ni une capture.

## Git et publication

- Dépôt public `Belenos-Toutatis/mbn-modernise`, branche `main`.
- Ne valider et ne pousser **que sur demande explicite** de l'utilisateur.
- Les commits portent l'adresse anonyme `noreply` du compte GitHub, réglée dans
  la configuration Git locale : vérifier `git config user.email` avant de
  valider. Ni nom réel ni adresse personnelle dans le dépôt.
- Chaque version publiée incrémente `version` dans `manifest.json` : l'avis de
  mise à jour (`arriere-plan.js`) compare ce numéro à celui du dépôt.
- Tenir `README.md` à jour (tableau des écrans, réglages, organisation du code).
- Tenir ce fichier `CLAUDE.md` à jour lui aussi, dans la même modification que
  le code : nouvelle convention, nouveau réglage ou classe sur `<html>`, nouvel
  événement du pont, règle donnée par l'utilisateur. Retirer ce qui n'est plus
  vrai.

## Conventions du code

- JavaScript et CSS sans dépendance ni étape de construction ; identifiants,
  commentaires et textes en français.
- Un couple `ecran.js` / `ecran.css` par écran, déclaré dans `manifest.json`.
  Chaque script repère sa page, lui pose une classe `mbn-…`, et ne fait rien
  ailleurs.
- Les styles dépendent des classes posées sur `<html>` par `moderne.js`
  (`mbn-moderne`, `mbn-couleurs`, `mbn-compact`, `mbn-menu-survol`…), pour que
  chaque réglage se désactive séparément depuis la fenêtre de l'extension.
- Couleurs de classe : toujours passer par `globalThis.mbnCouleurs`
  (`couleurs-classes.js`).
- L'extension n'enregistre rien dans MBN de sa propre initiative. Pour agir,
  piloter les commandes d'origine de MBN (valeur + événement `change`, clic sur
  ses propres boutons) à la suite d'un clic de l'utilisateur. Garder un moyen de
  retrouver les commandes d'origine si la version modernisée échoue.
- `pont.js` est le seul script exécuté dans le contexte de la page (monde
  `MAIN`) ; on lui parle par des `CustomEvent` (`mbn-regler-champ`,
  `mbn-sonder-champ`). Ne pas y ajouter autre chose que l'accès aux objets de la
  page.
- Choix d'une heure : toujours par les molettes de `roue-heure.js`
  (`globalThis.mbnRoue`), que l'utilisateur préfère à une liste ou à une grille
  d'heures (demande du 2026-11-17). Pour régler un champ d'heure d'une ancienne
  page depuis un autre script : `globalThis.mbnHeuresAnciennes.regler(champ, 'HH:MM')`. Les anciennes pages ne sont pas en
  « border-box » : tout composant ajouté doit l'imposer lui-même.
- Évaluation : l'énoncé et le corrigé ne peuvent pas être diffusés avant les
  résultats. `devoir-edition.js` les reporte à la date des résultats quand
  l'utilisateur la change ou joint un fichier (demande du 2026-11-22), jamais
  au chargement de la page : le formulaire porte l'enregistrement automatique
  de MBN (`js-autosaved`), un changement sans geste pourrait donc enregistrer.
- Raccourcis clavier : n'accepter que les frappes réelles (`isTrusted`), et rien
  quand une fenêtre modale est ouverte.
- `rafraichissement.js` ne doit jamais recharger une page pendant une saisie :
  ajouter à `bloque()` tout nouveau formulaire.
- Aucune requête vers l'extérieur, hormis la lecture du `manifest.json` publié
  et, sur un clic de l'utilisateur dans `mise-a-jour.html`, le téléchargement
  de l'archive ZIP du dépôt (mise à jour en un clic, demandée le 2026-11-18).
- `mise-a-jour.js` écrit dans le dossier de l'extension : il doit toujours
  vérifier que le dossier choisi et l'archive contiennent bien cette extension
  (même `name` dans `manifest.json`), ne rien supprimer, et écrire
  `manifest.json` en dernier. Tout fichier ajouté au dépôt est copié tel quel
  chez les utilisateurs : n'y laisser que ce qui doit l'être.
- Dans `mise-a-jour.js`, toute attente sur un dossier est bornée (`borner`), sauf
  le sélecteur et `requestPermission`, qui attendent l'utilisateur : un dossier
  relu d'IndexedDB peut ne jamais répondre (signalé le 2026-11-23). Ne jamais
  laisser un bouton grisé sans issue. Ne rien copier si le dossier contient déjà
  la version publiée : la copie écraserait un travail en cours.

## Démarche attendue

L'utilisateur envoie une capture et demande d'améliorer l'écran. Il apprécie
qu'on propose de soi-même les modernisations visibles dans la capture
(regroupements, raccourcis d'un clic, mémorisation des choix), sans se limiter au
défaut signalé.
