# DentiSuite — Documentation utilisateur

Documentation officielle préparée à partir du code source réel (Desktop **3.4.0**, API Cloud **3.1.2**).

## Contenu

| Fichier | Rôle |
|---------|------|
| [TABLE_OF_CONTENTS.md](./TABLE_OF_CONTENTS.md) | Table des matières |
| [USER_GUIDE.md](./USER_GUIDE.md) | Guide utilisateur (praticien, secrétaire, assistant) |
| [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) | Guide administrateur (équipe, licence, paramètres) |
| [WORKFLOWS.md](./WORKFLOWS.md) | Parcours métier complets |
| [FAQ.md](./FAQ.md) | Questions fréquentes |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Résolution des problèmes |
| [SCREENSHOTS_PLAN.md](./SCREENSHOTS_PLAN.md) | Index des 26 captures + légendes |
| [SCREENSHOT_CAPTURE_GUIDE.md](./SCREENSHOT_CAPTURE_GUIDE.md) | Guide opérationnel de prise de vue (clics, données, sessions) |
| [SCREENSHOT_CAPTURE_PREPARATION_REPORT.md](./SCREENSHOT_CAPTURE_PREPARATION_REPORT.md) | Rapport de préparation des captures |
| [screenshots/](./screenshots/) | Dossier destination des PNG (manuel) |
| [GAMMA_SOURCE.md](./GAMMA_SOURCE.md) | Matière éditoriale pour mise en page (Gamma / PDF) |
| [COVERAGE_MATRIX.md](./COVERAGE_MATRIX.md) | Matrice de couverture fonctionnalités |
| [DOCUMENTATION_AUDIT_REPORT.md](./DOCUMENTATION_AUDIT_REPORT.md) | Rapport d’audit documentation |

## Versions documentées

- **Desktop (Electron)** : `3.4.0` (`package.json`, Paramètres → `APP_VERSION`)
- **API Cloud** : `3.1.2` (`apps/api/package.json`)
- **Écran licence** : libellé marketing « DentiSuite V8 » (distinct de la version produit)

## Modes

- **LEGACY** : données locales, licence Electron, sauvegarde/restauration JSON complète
- **CLOUD** : organisation multi-utilisateur, API, Documents, Équipe ; export miroir (pas de restore JSON complet)

## Règles

- Aucune fonctionnalité inventée : seul le comportement observé dans le code est décrit.
- Les points incertains sont listés dans le rapport d’audit (« POINTS À VALIDER MANUELLEMENT »).
- Ce dossier est documentaire uniquement (pas de modification du logiciel).
