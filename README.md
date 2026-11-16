# MBN modernisé

Extension Chrome qui corrige et modernise l'affichage de Mon Bureau Numérique
(`monbureaunumerique.fr`), pour un usage enseignant.

Elle agit uniquement dans votre navigateur : elle ne transmet rien à l'extérieur
et ne modifie aucune donnée de MBN. Elle ne coche rien et ne saisit rien à votre
place.

## Ce qu'elle fait

| Écran | Améliorations |
|---|---|
| Messagerie | colonnes alignées sur leurs titres et rééquilibrées, barre d'outils qui tient dans la fenêtre, bandeau du haut sur une seule rangée, liste en pleine hauteur tant qu'aucun message n'est ouvert, fermeture du volet de lecture par Échap ou par un clic sur le message ouvert |
| Aperçus PDF | fenêtre d'aperçu sur toute la hauteur, élargie en mode portrait |
| Cahier de textes, vue agenda | grille étirée à la hauteur de la fenêtre, séances colorées par niveau et par classe (ou par matière dans le cahier d'une seule classe), cahier choisi mémorisé |
| Cahier de textes, vues en liste | séances en cartes, raccourcis de période, filtre instantané par classe et par texte, critères mémorisés, index par mois |
| Évaluations | filtres et tri mémorisés, lignes colorées par classe, titres affichés en entier |
| Appels | feuille d'appel remise dans la page, états colorés, bilan chiffré ; historique avec appels non saisis repérés et raccourcis de période |
| Partout | infobulles de survol lisibles, rechargement automatique des pages laissées sans activité (jamais pendant une saisie) |

Les couleurs de classe suivent une règle unique : une teinte par niveau
(6e vert, 5e bleu, 4e orange, 3e violet), une nuance par classe.

## Installation

1. Récupérez le dossier, par `git clone` ou en téléchargeant l'archive ZIP du dépôt.
2. Dans Chrome, ouvrez `chrome://extensions`.
3. Activez le « Mode développeur », en haut à droite.
4. Cliquez sur « Charger l'extension non empaquetée » et choisissez le dossier.

## Mise à jour

Une extension installée de cette façon ne se met pas à jour toute seule.

1. Dans le dossier, récupérez la dernière version : `git pull`.
2. Dans `chrome://extensions`, cliquez sur la flèche de rechargement de la carte « MBN modernisé ».
3. Rechargez les pages MBN ouvertes.

## Réglages

Un clic sur l'icône de l'extension ouvre ses réglages :

- apparence modernisée ;
- couleurs par classe ou par matière ;
- bandeau de la messagerie sur une seule rangée ;
- rechargement automatique et sa durée d'inactivité.

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
| `popup.html`, `popup.js`, `capture.js` | fenêtre de réglages et capture anonymisée |
| `moderne.js` | applique les réglages d'apparence à chaque page |
| `commun.css`, `infobulles.js`, `rafraichissement.js` | correctifs communs à toutes les pages |
| `couleurs-classes.js` | couleurs par niveau et par classe |
| `messagerie.*`, `messagerie-moderne.css` | messagerie |
| `apercu-pdf.*`, `content.js` | aperçus PDF |
| `agenda.*`, `cahier-*.js`, `cahier-liste.css` | cahier de textes |
| `devoirs.*` | évaluations |
| `appels.*` | appels |

## Limites

L'extension dépend de la structure des pages de MBN : une mise à jour du site
peut dérégler un écran. Dans ce cas, désactivez le réglage concerné en attendant
un correctif.

Cette extension est un projet personnel, sans lien avec l'éditeur de MBN.
