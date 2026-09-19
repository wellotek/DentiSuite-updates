# DentiSuite — Workflows

**Version :** Desktop 3.4.0 / API 3.1.2  

Ne documenter que les parcours réellement supportés par l’application.

---

## WORKFLOW 1 — Première installation (Legacy)

1. Installer `DentiSuite-Setup-3.4.0.exe`
2. Lancer DentiSuite
3. **Activation de votre licence** → License ID + code → **Activer la licence**
4. Accès à l’application (pas d’écran Équipe)
5. **Paramètres** → identité cabinet, logo, FR/AR, langue
6. Créer dentistes (annuaire)
7. Créer premiers patients
8. Paramètres → **Médicaments** / actes
9. Créer une **sauvegarde** JSON de référence

**Résultat :** cabinet opérationnel en local.

---

## WORKFLOW 2 — Première installation (Cloud)

1. Installer + activer la **licence Desktop**
2. **Créer votre cabinet** (bootstrap organisation + admin)
3. Connexion confirmée / hydrate des données
4. Paramètres → identité, catalogues
5. **Équipe** → inviter assistants / autres admins + permissions
6. Annuaire **Dentistes**
7. Former les utilisateurs ; vérifier que les menus visibles correspondent aux permissions

**Résultat :** organisation Cloud multi-utilisateurs prête.

---

## WORKFLOW 3 — Nouveau patient → RDV → consultation → ordonnance

1. **Patients** → **Nouveau Patient** → enregistrer  
2. Ouvrir la fiche patient  
3. Raccourci **Rendez-vous** (ou Agenda → Nouveau RDV)  
4. Jour J : Agenda → statut (Confirmé → En salle → Terminé)  
5. Fiche patient → onglet **Soins** : odontogramme + actes (À faire / Fait)  
6. Onglet **Séances** : note de visite  
7. Raccourci **Ordonnance** → modèles / médicaments → enregistrer → imprimer  
8. (Option) **Paiement** → Finances  
9. (Option) Onglet **Imagerie** : ajouter cliché

**Résultat :** parcours clinique complet documenté.

**Permissions Cloud :** `patients.*`, `appointments.*`, `prescriptions.*`, éventuellement `billing.*`.

---

## WORKFLOW 4 — Patient existant → historique → nouvelle séance

1. Patients → rechercher (nom / téléphone) ou **Ctrl+K**  
2. Ouvrir la fiche  
3. Consulter **Soins** / **Séances** / **Imagerie**  
4. Nouvelle séance + nouveaux actes  
5. (Option) Document Cloud (menu Documents) si mode Cloud  
6. (Option) Ordonnance / prothèse / paiement via barre contextuelle

---

## WORKFLOW 5 — Facturation

1. Finances **ou** raccourci **Paiement** depuis contexte patient  
2. Créer / enregistrer la transaction (patient ou saisie libre)  
3. Suivre Payé / Facturé  
4. Export CSV ou impression rapport si besoin

**Permissions Cloud :** typiquement `billing.read` (+ écriture). Les **ASSISTANT** n’ont souvent pas la facturation par défaut.

---

## WORKFLOW 6 — Suivi prothèse

1. Fiche patient → raccourci **Prothèse** **ou** menu Prothèses  
2. Créer fiche (type, dent, labo, dates)  
3. Mettre à jour statut : En cours → Reçue → Posée (ou Annulée)  
4. Suivre les indicateurs (ouvertes / retard)

---

## WORKFLOW 7 — Stock

1. Stock → ajouter article (catégorie, quantités, seuils, dates)  
2. Ajuster ± lors des mouvements  
3. Traiter alertes stock bas / péremption  
4. Impression / rapport si nécessaire

---

## WORKFLOW 8 — Archiver un patient

1. Liste Patients → **Archiver**  
2. Confirmer (double confirmation)  
3. Toast « Patient archivé »  
4. Le patient disparaît des listes et de la recherche globale patients

**Limitation :** pas de bouton **Restaurer** dans l’UI liste actuelle (restore technique existe côté données / API).

---

## WORKFLOW 9 — Multi-utilisateur (Cloud)

1. Admin → **Équipe**  
2. Ajouter utilisateur  
3. Rôle ADMIN ou ASSISTANT  
4. Ajuster overrides de permissions  
5. L’utilisateur se connecte (username/email + mot de passe)  
6. Vérifier les menus visibles (filtrés)

---

## WORKFLOW 10 — Sauvegarde (Legacy)

1. Paramètres → section sauvegarde  
2. Créer sauvegarde JSON  
3. Stocker hors machine  
4. (Sinistre) Restaurer depuis le fichier — **écrase** les données locales

---

## WORKFLOW 11 — Export / continuité (Cloud)

1. Paramètres → export / sauvegarde Cloud selon UI  
2. En cas de panne API : écran serveur inaccessible — attendre rétablissement  
3. Après conflit patient multi-poste : accepter le rechargement (toast d’actualisation)

---

## WORKFLOW 12 — Mise à jour logicielle

1. Toast / Paramètres indique une mise à jour  
2. Sauvegarde ou export préalable  
3. Lancer l’installation de mise à jour  
4. Relancer ; vérifier version (À vérifier : où la version s’affiche exactement)
5. Contrôler ouverture patients / agenda

---

## Matrice workflows × modes

| Workflow | Legacy | Cloud |
|----------|--------|-------|
| W1 Première install Legacy | Oui | — |
| W2 Première install Cloud | — | Oui |
| W3 Parcours clinique | Oui | Oui* |
| W4 Historique | Oui | Oui* |
| W5 Facturation | Oui | Oui* |
| W6 Prothèses | Oui | Oui* |
| W7 Stock | Oui | Oui* |
| W8 Archive patient | Oui | Oui* |
| W9 Équipe | Non | Oui |
| W10 Backup restore | Oui | Non (équivalent) |
| W11 Export / sync | Partiel | Oui |
| W12 Update | Oui | Oui |

\* Sous réserve des permissions du compte.
