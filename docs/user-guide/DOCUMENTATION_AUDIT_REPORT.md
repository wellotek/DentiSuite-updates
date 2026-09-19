# DENTISUITE — DOCUMENTATION AUDIT REPORT

**Date :** 2026-09-16  
**Périmètre :** documentation utilisateur uniquement (aucun changement logiciel)  
**Sources :** code Desktop Electron (`package.json` 3.4.0), API (`apps/api` 3.1.2), routes/pages i18n, permissions `vocabulary.ts`, erreurs Cloud `errors.ts`

---

## Version documentée

| Composant | Version | Source |
|-----------|---------|--------|
| Desktop Electron | **3.4.0** | `package.json` |
| API Cloud | **3.1.2** | `apps/api/package.json` |
| Libellé marketing licence | « DentiSuite V8 » (si affiché) | distinct de la version produit — ne pas confondre |

Modes documentés : **LEGACY** (données locales) · **CLOUD** (organisation API + miroir).

---

## Fichiers produits

```
docs/user-guide/
├── README.md
├── TABLE_OF_CONTENTS.md
├── USER_GUIDE.md
├── ADMIN_GUIDE.md
├── WORKFLOWS.md
├── FAQ.md
├── TROUBLESHOOTING.md
├── SCREENSHOTS_PLAN.md
├── GAMMA_SOURCE.md
├── COVERAGE_MATRIX.md
└── DOCUMENTATION_AUDIT_REPORT.md
```

---

## Fonctionnalités documentées

- Activation licence + messages d’erreur i18n
- Onboarding Cloud (création cabinet, login, logout)
- Navigation Legacy / Cloud (libellés réels)
- Dashboard
- Patients (CRUD métier, archive soft, recherche, pagination 50)
- Fiche patient : Soins / odontogramme, Séances, Imagerie (80 Mo)
- Barre contextuelle patient
- Agenda (catégories, statuts, drag, modal)
- Ordonnances + modèles + impression
- Médicaments via Paramètres
- Prothèses, Stock, Finances (DA)
- Documents Cloud
- Dentistes (annuaire) vs Équipe (comptes)
- Permissions ADMIN / ASSISTANT (liste par défaut code)
- Paramètres, backup Legacy vs export Cloud
- Recherche globale Ctrl+K
- Sync Cloud (toasts conflit / interruption / serveur inaccessible)
- Auto-update (haut niveau)
- Workflows, FAQ, troubleshooting, plan captures, matière Gamma

---

## Fonctionnalités non documentées (volontairement)

| Élément | Raison |
|---------|--------|
| CloudProbe / écrans de diagnostic dev | Hors public utilisateur |
| Outils migration / pilot cutover API | Ops techniques, hors manuel cabinet |
| Endpoints API bruts | Hors guide utilisateur |
| Contenu exact de chaque modèle d’ordonnance | Partiel dans USER_GUIDE ; détail catalogue À vérifier |
| Audit log UI | Permission `audit.read` existe ; écran utilisateur dédié non confirmé comme module sidebar |

---

## Points à vérifier manuellement

1. **Restauration patient archivé** — pas de bouton UI ; procédure réelle ?
2. Emplacement d’affichage exact du numéro de version **3.4.0** dans Paramètres / À propos
3. Libellés exacts des boutons Backup / Restore / Export sur la build packagée
4. Toast / parcours exact d’**auto-update**
5. Couverture réelle de l’**arabe** sur pages Cloud (sidebar/login/équipe/documents = FR fixe)
6. Impression A4 (ordonnances, rapports) sur imprimantes cabinet
7. Cases permissions affichées dans l’UI Équipe (vs liste vocabulary complète)
8. Message exact d’échec login (UI montre aussi `Identifiants invalides` via `cloudErrorLabel`)
9. Comportement SmartScreen sur installateur non signé
10. Plage horaire agenda 08:00–19:00 — confirmer sur UI
11. Présence / absence d’un écran **audit** pour `audit.read`
12. Mot de passe oublié self-service (non observé hors reset admin Équipe)

---

## Screenshots nécessaires

26 captures planifiées dans `SCREENSHOTS_PLAN.md` (P0 = 003, 004, 005, 007, 008, 012, 013, 021, 022).

**État :** plan prêt · **captures réelles non produites** (volontairement — pas de fausses images).

---

## Legacy / Cloud differences

| Sujet | Legacy | Cloud |
|-------|--------|-------|
| Stockage | Local | API org + miroir |
| Utilisateurs | Poste unique | Équipe multi-comptes |
| RBAC | Non | ADMIN / ASSISTANT + overrides |
| Documents menu | Non (imagerie fiche) | Oui |
| Équipe menu | Non (libellé Dentistes / Équipe = annuaire) | Oui `/team` |
| Backup | JSON + restore | Export ; pas restore local équivalent |
| Offline métier | Oui (hors revalidation licence) | Non si API down |
| Licence Desktop | Oui | Oui |
| i18n sidebar | Oui (FR/AR) | Libellés FR codés en dur |

---

## Admin / User differences

| | Utilisateur / Assistant | Administrateur |
|--|-------------------------|----------------|
| Patients, agenda, Rx, séances | Oui (selon perms) | Oui |
| Finances | Non par défaut (ASSISTANT) | Oui |
| Stock écriture | Non par défaut | Oui |
| Archive patient (`patients.delete`) | Non par défaut | Oui |
| Équipe / settings update | Non | Oui |
| Licence / backup | Principalement admin / poste | Oui |
| Documents delete | Non par défaut | Oui |

---

## Documentation coverage

Voir `COVERAGE_MATRIX.md`.

- Modules métier principaux : **documentés**
- Limitation restore UI : **explicitement signalée**
- Erreurs : uniquement messages présents dans `messages.ts` / `cloud/errors.ts`
- Aucune invention de boutons / workflows absents

---

## Risques qualité doc

1. Sans captures, le PDF Gamma reste textuel jusqu’à prise de vue.  
2. Certains détails UI (backup wording, version string location) marqués VERIFY.  
3. Le manuel doit être relu sur une build **3.4.0** Legacy **et** Cloud.

---

## FINAL STATUS

**READY_FOR_DOCUMENT_DESIGN**

La matière documentaire est complète et fidèle au code actuel, avec points de validation manuelle listés et plan de captures prêt.  
Prochaine étape éditoriale : capturer les écrans réels puis importer `GAMMA_SOURCE.md` dans Gamma / outil PDF.

*Aucun commit · aucun push · aucun deploy · aucune modification du logiciel.*
