# Plan de captures d’écran — DentiSuite

**Version :** Desktop 3.4.0 · API Cloud 3.1.2  

**Guide opérationnel (clics, données, sessions) :** [`SCREENSHOT_CAPTURE_GUIDE.md`](./SCREENSHOT_CAPTURE_GUIDE.md)  
**Fichiers cibles :** [`screenshots/SCREENSHOT-NNN.png`](./screenshots/)  
**Matière Gamma :** [`GAMMA_SOURCE.md`](./GAMMA_SOURCE.md)

> Ne pas inventer de visuels. Prendre les captures dans DentiSuite réel.  
> Dataset fictif obligatoire : **Cabinet Dentaire Exemple** / **Jean Dupont** / **Dr. Ahmed Benali** (détail dans le guide).

---

## Convention

| Élément | Valeur |
|---------|--------|
| Nommage | `SCREENSHOT-001.png` … `SCREENSHOT-026.png` |
| Annoté (optionnel) | `SCREENSHOT-NNN-annotated.png` |
| Résolution | 1920×1080, fenêtre maximisée, UI **Français** |
| Dossier | `docs/user-guide/screenshots/` |

---

## Index des 26 captures

| ID | Nom | Mode | Module | Priorité | Fichier | Chapitre manuel |
|----|-----|------|--------|----------|---------|-----------------|
| 001 | Connexion Cloud | Cloud | Auth | P1 | SCREENSHOT-001.png | USER §5 |
| 002 | Création cabinet Cloud | Cloud | Onboarding | P1 | SCREENSHOT-002.png | USER §5 / ADMIN §3 |
| 003 | Activation licence | Legacy+Cloud | Licence | P0 | SCREENSHOT-003.png | USER §4 / ADMIN §2 |
| 004 | Sidebar Legacy | Legacy | Nav | P0 | SCREENSHOT-004.png | USER §6 |
| 005 | Sidebar Cloud | Cloud | Nav | P0 | SCREENSHOT-005.png | USER §6 |
| 006 | Tableau de bord | Legacy(+Cloud) | Dashboard | P1 | SCREENSHOT-006.png | USER §7 |
| 007 | Liste patients | Legacy(+Cloud) | Patients | P0 | SCREENSHOT-007.png | USER §8 |
| 008 | Odontogramme / Soins | Legacy(+Cloud) | Chart | P0 | SCREENSHOT-008.png | USER §9 |
| 009 | Séances | Legacy(+Cloud) | Chart | P1 | SCREENSHOT-009.png | USER §9 |
| 010 | Imagerie | Legacy(+Cloud) | Chart | P1 | SCREENSHOT-010.png | USER §9 |
| 011 | Raccourcis patient | Legacy(+Cloud) | Chart | P1 | SCREENSHOT-011.png | USER §6/§9 |
| 012 | Agenda | Legacy(+Cloud) | Agenda | P0 | SCREENSHOT-012.png | USER §10 |
| 013 | Ordonnances | Legacy(+Cloud) | Rx | P0 | SCREENSHOT-013.png | USER §11 |
| 014 | Médicaments | Legacy(+Cloud) | Paramètres | P1 | SCREENSHOT-014.png | USER §12 |
| 015 | Prothèses | Legacy(+Cloud) | Prothèses | P1 | SCREENSHOT-015.png | USER §13 |
| 016 | Stock | Legacy(+Cloud) | Stock | P1 | SCREENSHOT-016.png | USER §14 |
| 017 | Finances | Legacy(+Cloud) | Finances | P1 | SCREENSHOT-017.png | USER §15 |
| 018 | Documents Cloud | Cloud | Documents | P1 | SCREENSHOT-018.png | USER §16 |
| 019 | Dentistes | Legacy(+Cloud) | Dentistes | P1 | SCREENSHOT-019.png | USER §17 |
| 020 | Équipe Cloud | Cloud | Équipe | P1 | SCREENSHOT-020.png | ADMIN §4 |
| 021 | Paramètres cabinet | Legacy(+Cloud) | Paramètres | P0 | SCREENSHOT-021.png | ADMIN §5 |
| 022 | Recherche Ctrl+K | Legacy(+Cloud) | Search | P0 | SCREENSHOT-022.png | USER §18 |
| 023 | Serveur inaccessible | Cloud | Erreur | P2 | SCREENSHOT-023.png | TROUBLESHOOTING |
| 024 | Toast conflit | Cloud | Sync | P2 | SCREENSHOT-024.png | USER §19 — **VERIFY** |
| 025 | Archivage confirm | Legacy(+Cloud) | Patients | P1 | SCREENSHOT-025.png | USER §8 |
| 026 | Mises à jour | Legacy(+Cloud) | Paramètres | P2 | SCREENSHOT-026.png | ADMIN §7 |

---

## Priorités

| Priorité | IDs | Usage |
|----------|-----|--------|
| **P0** | 003, 004, 005, 007, 008, 012, 013, 021, 022 | Manuel minimal |
| **P1** | 001, 002, 006, 009–011, 014–020, 025 | Manuel complet |
| **P2** | 023, 024, 026 | Support / sync / update |

---

## Sessions de prise de vue (résumé)

| Session | IDs | Mode |
|---------|-----|------|
| A — Onboarding / Auth | 003, 002, 001, 023 | Cloud (+ licence) |
| B — Nav / Dashboard / Search | 004, 005, 006, 022 | Legacy puis Cloud |
| C — Patients & fiche | 007–011, 025 | Legacy (+Cloud check) |
| D — Agenda | 012 | Legacy |
| E — Ordonnances / Médicaments | 013, 014 | Legacy |
| F — Prothèses / Stock / Finances | 015–017 | Legacy |
| G — Cloud Documents / Équipe | 018, 020 | Cloud ADMIN |
| H — Dentistes / Paramètres / MAJ | 019, 021, 026 | Legacy |
| I — Sync conflit | 024 | Cloud — **peut être indisponible** |

Ordre détaillé + fiches complètes : **SCREENSHOT_CAPTURE_GUIDE.md**.

---

## Légendes (figures)

1. Figure 01 — Écran de connexion au cabinet DentiSuite Cloud.  
2. Figure 02 — Création du cabinet Cloud.  
3. Figure 03 — Activation de licence Desktop.  
4. Figure 04 — Navigation latérale (mode Legacy).  
5. Figure 05 — Navigation latérale (mode Cloud).  
6. Figure 06 — Tableau de bord.  
7. Figure 07 — Liste des patients de DentiSuite.  
8. Figure 08 — Odontogramme et soins.  
9. Figure 09 — Séances cliniques.  
10. Figure 10 — Imagerie patient (JPG / PNG / DICOM, max 80 Mo).  
11. Figure 11 — Raccourcis contextuels patient.  
12. Figure 12 — Agenda et rendez-vous.  
13. Figure 13 — Module ordonnances.  
14. Figure 14 — Catalogue médicaments du cabinet.  
15. Figure 15 — Suivi des prothèses.  
16. Figure 16 — Gestion de stock.  
17. Figure 17 — Caisse et finances (DA).  
18. Figure 18 — Documents Cloud.  
19. Figure 19 — Annuaire des dentistes.  
20. Figure 20 — Gestion de l’équipe Cloud.  
21. Figure 21 — Paramètres du cabinet.  
22. Figure 22 — Recherche globale (Ctrl+K).  
23. Figure 23 — Serveur Cloud inaccessible.  
24. Figure 24 — Actualisation après modification concurrente.  
25. Figure 25 — Confirmation d’archivage patient.  
26. Figure 26 — Mises à jour DentiSuite (version installée).

---

## Points d’attention (code réel)

| Sujet | Instruction capture |
|-------|---------------------|
| **011** | Capturer depuis **fiche patient** (4 raccourcis). La barre seule sur Agenda montre surtout « Fiche patient ». |
| **025** | Confirmation **inline** (Archiver + Annuler), pas un modal avec `patients.deleteConfirm`. |
| **023** | Titre exact : **Serveur inaccessible**. |
| **024** | Message i18n présent ; **appel toast non trouvé** dans le code UI → vérifier manuellement. |
| **021** | Legacy : « Créer une sauvegarde » ; Cloud : « Exporter le cabinet ». |
| **026** | Section Paramètres **Mises à jour** ; version attendue **3.4.0**. |
| Legacy vs Cloud | Pour modules communs : **une capture Legacy suffit** si UI identique ; 004/005 restent distincts. |

---

## Qualité

- Données fictives uniquement (voir dataset dans le guide).  
- Pas de secrets, tokens, vrais patients, licences production lisibles.  
- Pas de curseur / toast parasite (sauf si la capture est le toast).  
- Annotations uniquement sur copies `-annotated.png`.
