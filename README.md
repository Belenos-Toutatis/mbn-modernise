# MBN modernisé

Extension Chrome qui corrige et modernise l'affichage de Mon Bureau Numérique
(`monbureaunumerique.fr`), pour un usage enseignant.

Elle agit uniquement dans votre navigateur : elle ne transmet aucune donnée à
l'extérieur. Elle n'enregistre rien dans MBN de sa propre initiative : elle
n'agit sur un formulaire que lorsque vous cliquez sur un de ses raccourcis.

Sa seule requête vers l'extérieur est la lecture, deux fois par jour, du numéro
de version publié dans ce dépôt, pour vous signaler une mise à jour. Cette
vérification se désactive dans la fenêtre de l'extension.

## Ce qu'elle fait

| Écran | Améliorations |
|---|---|
| Messagerie | colonnes alignées sur leurs titres et rééquilibrées, barre d'outils qui tient dans la fenêtre, bandeau du haut sur une seule rangée, liste en pleine hauteur tant qu'aucun message n'est ouvert, fermeture du volet de lecture par Échap ou par un clic sur le message ouvert (volet en bas, ou à droite quand la fenêtre est étroite ; vue par message comme vue par conversation) ; volet à droite et liste large : un message par ligne, avec les titres de colonnes |
| Aperçus PDF | fenêtre d'aperçu sur toute la hauteur, élargie en mode portrait |
| Cahier de textes, vue agenda | grille étirée à la hauteur de la fenêtre, séances colorées par niveau et par classe (ou par matière dans le cahier d'une seule classe), cahier choisi mémorisé |
| Cahier de textes, page d'une séance | page recentrée, rubriques en cartes ; en modification : boutons « Annuler » et « Valider » toujours à l'écran, validation par Ctrl+S ou Ctrl+Entrée, éditeur plus haut ; bulle « Ressources réservées » en carte lisible, fermée par Échap ou par un clic à côté |
| Cahier de textes, copie vers d'autres séances | page lisible et recentrée, « tout cocher », clic dans le champ pour choisir la séance, fenêtre de choix agrandie, compteur sur cinq séances |
| Cahier de textes, réservation de ressources | ressources regroupées par type, ajoutées ou retirées d'un clic, filtre |
| Réservation de ressources, liste | lignes compactes, noms affichés en entier, boutons « consulter » et « réserver », familles dépliées mémorisées, tout déplier d'un clic |
| Réservation de ressources, planning et formulaire | clic dans toute la case libre, vos réservations en bleu, week-end vide masqué ; date de fin qui suit la date de début, heures choisies sur des molettes à faire défiler, durées toutes faites, Ctrl+S pour valider |
| Cahier de textes, vues en liste | séances en cartes, raccourcis de période, filtre instantané par classe et par texte, critères mémorisés, index par mois |
| Évaluations et relevés de notes, listes | filtres et tri mémorisés, lignes colorées par classe, titres affichés en entier ; heure de diffusion des résultats choisie sur des molettes à faire défiler, calendriers de choix de la date et de la séance plus lisibles, ainsi que la petite fenêtre de choix entre plusieurs séances d'un même jour |
| Évaluations, paramètres et saisie des notes | page recentrée, raccourcis de diffusion des résultats (dont « Après l'évaluation »), barèmes et coefficients d'un clic, boutons « Valider » toujours à l'écran et Ctrl+S ; saisie des notes : grille d'élèves resserrée, élèves sans évaluation repérés, avancement, niveaux de compétence et motifs de non-notation en boutons, Entrée ou flèches pour changer d'élève, répartition des notes ; choix des compétences : fenêtre agrandie, filtre instantané, discipline rouverte par référentiel |
| Relevé de notes d'une classe | tableau à la largeur de son contenu, lignes resserrées, noms en entier, titres de colonnes qui restent en vue, bilan de la classe (moyenne, extrêmes, répartition), jauge sous chaque moyenne |
| Fiche d'un élève | résumé étroit qui reste en vue, contenu des onglets à une largeur de lecture sans déplacer le cadre de la page (l'emploi du temps garde toute la largeur), un cadre par responsable avec libellés et valeurs côte à côte, compteurs de vie scolaire en cartes, pastille de classe colorée, dernier onglet consulté rouvert |
| Appels | feuille d'appel remise dans la page, états colorés, bilan chiffré ; historique avec appels non saisis repérés et raccourcis de période |
| Partout | menu latéral réduit qui se déplie au survol sans décaler la page, infobulles de survol lisibles, rechargement automatique des pages laissées sans activité (jamais pendant une saisie ni quand un formulaire de modification est ouvert) |

Les couleurs de classe suivent une règle unique : une teinte par niveau
(6e vert, 5e bleu, 4e orange, 3e violet), une nuance par classe.

## Installation

1. Récupérez le dossier, par `git clone` ou en téléchargeant l'archive ZIP du dépôt.
2. Dans Chrome, ouvrez `chrome://extensions`.
3. Activez le « Mode développeur », en haut à droite.
4. Cliquez sur « Charger l'extension non empaquetée » et choisissez le dossier.

## Mise à jour

Une extension installée de cette façon ne se met pas à jour toute seule. Elle vous
prévient en revanche quand une nouvelle version est publiée : une pastille « ↑ »
apparaît sur son icône, et sa fenêtre rappelle la marche à suivre.

1. Dans le dossier, récupérez la dernière version : `git pull`.
2. Dans `chrome://extensions`, cliquez sur la flèche de rechargement de la carte « MBN modernisé ».
3. Rechargez les pages MBN ouvertes.

## Réglages

Un clic sur l'icône de l'extension ouvre ses réglages :

- apparence modernisée ;
- couleurs par classe ou par matière ;
- bandeau de la messagerie sur une seule rangée ;
- menu latéral réduit qui se déplie au survol ;
- rechargement automatique et sa durée d'inactivité ;
- signalement des nouvelles versions.

Chaque réglage se désactive séparément si un écran s'affiche mal.

## Signaler un défaut d'affichage sans rien divulguer

La même fenêtre contient un bouton « Capturer cette page ». Il relève la mise en
page de l'onglet affiché (balises, classes, positions, couleurs) **sans aucun
texte de la page** : chaque texte est remplacé par sa longueur. Le résultat reste
sur votre ordinateur ; relisez-le avant de le transmettre.

## Organisation du code

| Fichiers | Rôle |
|---|---|
| `manifest.json` | déclaration de l'extension |
| `icones/` | icône de l'extension (source SVG et PNG aux quatre tailles) |
| `popup.html`, `popup.js`, `capture.js` | fenêtre de réglages et capture anonymisée |
| `arriere-plan.js` | vérifie deux fois par jour si une version plus récente est publiée |
| `moderne.js` | applique les réglages d'apparence à chaque page |
| `commun.css`, `infobulles.js`, `menu.*`, `rafraichissement.js` | correctifs communs à toutes les pages |
| `couleurs-classes.js` | couleurs par niveau et par classe |
| `periodes.js` | bornes de l'année scolaire pour les périodes préréglées |
| `messagerie.*`, `messagerie-moderne.css` | messagerie |
| `apercu-pdf.*`, `content.js` | aperçus PDF |
| `agenda.*`, `cahier-*.js`, `cahier-liste.css`, `seance.*`, `copier-vers.*`, `ressources.*` | cahier de textes |
| `reservations.*`, `planning-resa.js`, `saisie-resa.js` | réservation de ressources : liste, planning, formulaire |
| `roue-heure.*`, `heures-anciennes.js` | sélecteur d'heure à molettes, et son branchement sur les champs d'heure des anciennes pages |
| `pont.js` | règle les sélecteurs de date et d'heure de MBN (seul script exécuté dans le contexte de la page) |
| `devoirs.*`, `calendriers.css` | listes des évaluations et des relevés de notes ; calendriers de choix d'une date et d'une séance |
| `devoir-edition.*` | paramètres d'une évaluation et saisie des notes |
| `releve.*` | relevé de notes d'une classe |
| `fiche-eleve.*` | fiche d'un élève |
| `appels.*` | appels |

## Limites

L'extension dépend de la structure des pages de MBN : une mise à jour du site
peut dérégler un écran. Dans ce cas, désactivez le réglage concerné en attendant
un correctif.

Cette extension est un projet personnel, sans lien avec l'éditeur de MBN.
