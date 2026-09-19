# DENTISUITE — SCREENSHOT CAPTURE PREPARATION REPORT

**Date :** 2026-09-16  
**Versions :** Desktop 3.4.0 · API Cloud 3.1.2  
**Périmètre :** documentation uniquement (aucune modification du logiciel)

---

## Total

**26 captures** planifiées (SCREENSHOT-001 … SCREENSHOT-026)

---

## P0 (indispensables — 9)

003 Licence · 004 Sidebar Legacy · 005 Sidebar Cloud · 007 Patients · 008 Odontogramme · 012 Agenda · 013 Ordonnances · 021 Paramètres · 022 Ctrl+K  

---

## P1 (importantes — 14)

001 Login · 002 Création cabinet · 006 Dashboard · 009 Séances · 010 Imagerie · 011 Raccourcis · 014 Médicaments · 015 Prothèses · 016 Stock · 017 Finances · 018 Documents · 019 Dentistes · 020 Équipe · 025 Archivage  

---

## P2 (optionnelles / support — 3)

023 Serveur inaccessible · 024 Toast conflit · 026 Mises à jour  

---

## Sessions

| Session | Contenu | IDs |
|---------|---------|-----|
| A | Onboarding / Auth / Licence / API down | 003, 002, 001, 023 |
| B | Navigation / Dashboard / Search | 004, 005, 006, 022 |
| C | Patients & fiche | 007–011, 025 |
| D | Agenda | 012 |
| E | Ordonnances & médicaments | 013, 014 |
| F | Prothèses / Stock / Finances | 015–017 |
| G | Documents & Équipe Cloud | 018, 020 |
| H | Dentistes / Paramètres / MAJ | 019, 021, 026 |
| I | Sync conflit | 024 |

Ordre optimal détaillé dans `SCREENSHOT_CAPTURE_GUIDE.md`.

---

## Dataset fictif

- **Cabinet :** Cabinet Dentaire Exemple  
- **Patient :** Jean Dupont (15/03/1985, 0550 00 00 00)  
- **Patient 2 (archive) :** Sara Martin  
- **Dentiste :** Dr. Ahmed Benali  
- **Admin Cloud :** admin.demo@cabinet-exemple.dz  
- **Assistant :** assist.demo  
- **Rx :** modèle *Antalgique post-extraction*  
- **Médicament catalogue :** Amoxicilline 500 mg  
- **Stock / Finance / Prothèse :** valeurs DEMO documentées dans le guide  

Aucune donnée médicale réelle.

---

## Modes

### Legacy
004, et série métier 006–017, 019, 021–022, 025–026 (principal).  
Backup : « Créer une sauvegarde ».

### Cloud
001, 002, 005, 018, 020, 023, 024.  
Recapture métier seulement si UI différente.  
Export : « Exporter le cabinet ».

### Legacy + Cloud (même UI → 1 capture)
003, et la plupart des modules métier si inchangés.

---

## Points nécessitant vérification manuelle

1. **024** — clé `toast.conflict` présente en i18n, **aucun appel UI trouvé** → capture peut être impossible.  
2. Affichage version **3.4.0** (Paramètres → Mises à jour).  
3. Libellés exacts backup Legacy vs export Cloud.  
4. Prompt auto-update (bas-droit) vs section Paramètres.  
5. Absence bouton Restaurer patient.  
6. Confirmation archive = **inline**, pas modal `deleteConfirm`.  
7. i18n AR partiel sur shell Cloud.  
8. Impression OS (hors ID dédié).  
9. Cases permissions Équipe vs vocabulary API.  
10. SmartScreen installateur (hors captures produit).

---

## Captures nécessitant impression

Aucune capture dédiée « dialogue Imprimer ».  
Boutons impression visibles dans **013**, **016**, **017**.

---

## Captures nécessitant ADMIN

005 (menus complets), 017 (`billing.read`), 018 (`documents.*`), 020 (`team.*`), 025 (`patients.delete`), préparation stock écriture (016).

---

## Captures nécessitant données spécifiques

| ID | Données |
|----|---------|
| 006–013, 015, 017, 022 | Jean Dupont + activité liée |
| 008 | Actes / dents sur odontogramme |
| 009 | ≥1 séance |
| 010 | ≥1 JPG |
| 013 | Modèle antalgique |
| 014 | Amoxicilline visible |
| 016 | Article + alerte bas souhaitable |
| 020 | ADMIN + ASSISTANT |
| 023 | API down |
| 024 | 2 postes Cloud *(si toast branché)* |
| 025 | Sara Martin (confirmation inline) |

---

## Convention de nommage

`SCREENSHOT-NNN.png` (+ `-annotated` optionnel)

---

## Destination

```
docs/user-guide/
├── SCREENSHOTS_PLAN.md              (index mis à jour)
├── SCREENSHOT_CAPTURE_GUIDE.md      (fiches + sessions + checklist)
├── SCREENSHOT_CAPTURE_PREPARATION_REPORT.md
└── screenshots/                     (vide — PNG à déposer)
    └── README.md
```

---

## Livrables créés / mis à jour

| Fichier | Action |
|---------|--------|
| `SCREENSHOT_CAPTURE_GUIDE.md` | Créé — guide opérationnel complet |
| `SCREENSHOTS_PLAN.md` | Mis à jour — index pratique |
| `screenshots/README.md` | Créé — dossier destination |
| `SCREENSHOT_CAPTURE_PREPARATION_REPORT.md` | Créé — ce rapport |
| `README.md` (user-guide) | À jour (lien guide capture) |

---

## FINAL STATUS

**READY_FOR_SCREENSHOT_CAPTURE**

Vous pouvez ouvrir DentiSuite et suivre `SCREENSHOT_CAPTURE_GUIDE.md` sans deviner les chemins, données, rôles, modes ni cadrages.  
Point bloquant potentiel unique documenté : **SCREENSHOT-024** (toast conflit peut être non branché).

*Aucun commit · aucun push · aucun changement logiciel.*
