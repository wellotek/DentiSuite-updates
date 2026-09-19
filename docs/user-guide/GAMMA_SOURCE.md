# DentiSuite — Guide d’utilisation

> Matière éditoriale prête pour import Gamma / mise en page PDF.  
> Version Desktop **3.4.0** · API Cloud **3.1.2**  
> Ne pas inventer de boutons ou d’écrans. Insérer les captures selon `SCREENSHOTS_PLAN.md`.

---

## Couverture

**Titre :** DentiSuite  
**Sous-titre :** Guide d’utilisation officiel  
**Version :** Desktop 3.4.0 · API Cloud 3.1.2  
**Modes :** Legacy (local) · Cloud (organisation)  
**Public :** praticiens, secrétaires, assistants, administrateurs  

---

## Chapitre 1 — Présentation

**Titre :** Qu’est-ce que DentiSuite ?

DentiSuite est une application Windows de gestion de cabinet dentaire : patients, agenda, odontogramme, séances, ordonnances, prothèses, stock et caisse.

**Encadré IMPORTANT**  
Deux modes d’exploitation existent :

- **Legacy** — données sur le poste, licence Desktop  
- **Cloud** — données d’organisation synchronisées, multi-utilisateurs, licence Desktop toujours requise  

Le mode est fixé à l’installation / packaging, pas par un interrupteur utilisateur quotidien.

**[SCREENSHOT-004 / 005]**  
*Légende : Navigation Legacy vs Cloud.*

---

## Chapitre 2 — Installation et licence

**Titre :** Installer et activer

### Étapes

1. Exécuter l’installateur Windows `DentiSuite-Setup-3.4.0.exe`  
2. Lancer DentiSuite  
3. Saisir **License ID** et **code d’activation**  
4. Cliquer **Activer la licence**  

**Résultat attendu :** message « Licence activée avec succès. »

**[SCREENSHOT-003]**  
*Figure 03 — Activation de licence.*  
1. License ID · 2. Code · 3. Activer  

**Encadré ATTENTION**  
Messages possibles :

- Identifiant de licence ou code d’activation incorrect.  
- Cette licence est déjà activée sur un autre ordinateur.  
- Votre licence DentiSuite n’est plus valide.  
- Impossible de contacter le serveur de licence.  
- Une vérification de licence est nécessaire. Connectez DentiSuite à Internet pour continuer.  

Actions : **Réessayer** · **Utiliser une autre licence**

---

## Chapitre 3 — Connexion Cloud

**Titre :** Créer le cabinet et se connecter *(Cloud uniquement)*

### Première fois

1. Après licence → **Créer votre cabinet**  
2. Renseigner le cabinet et le compte administrateur  
3. Valider  

**[SCREENSHOT-002]**

### Sessions suivantes

1. **Connexion au cabinet**  
2. Username ou email + mot de passe  
3. Attendre le chargement des données  

**[SCREENSHOT-001]**  
*Figure 01 — Connexion.*

**Encadré CONSEIL**  
Déconnexion : pied de navigation Cloud → **Déconnexion**.

Messages session : « Session expirée (401) » / « Session expirée ou invalide (401) » → se reconnecter.

---

## Chapitre 4 — Interface

**Titre :** Se repérer dans l’application

### Sidebar Legacy (FR)

Tableau de bord · Patients & Odontogramme · Agenda & Rendez-vous · Dentistes / Équipe · Suivi des Prothèses · Ordonnances · Gestion de Stock · Caisse & Finances · Paramètres du cabinet

### Sidebar Cloud (FR courts)

Tableau de bord · Patients · Agenda · Dentistes · Prothèses · Ordonnances · Stock · Finances · Documents · Paramètres · Équipe  

Les entrées Cloud sont filtrées par permissions (`patients.read`, `billing.read`, etc.).

### Recherche globale

Raccourci **Ctrl+K**  
Recherche : patients (hors archivés), RDV, ordonnances, factures, prothèses, dentistes, médicaments.

**[SCREENSHOT-022]**

### Barre patient

Sur plusieurs modules : Retour fiche · Ordonnance · Rendez-vous · Paiement · Prothèse  

**[SCREENSHOT-011]**

**Encadré ATTENTION**  
Une partie de l’UI Cloud (sidebar, login, équipe, documents) reste en français fixe même si la langue arabe est choisie dans Paramètres.

---

## Chapitre 5 — Tableau de bord

**Titre :** Vue d’ensemble

Indicateurs : CA du jour (soins « Fait »), RDV du jour, prothèses ouvertes, stock critique, graphique, prochains rendez-vous. Montants en **DA**.

**[SCREENSHOT-006]**

---

## Chapitre 6 — Patients

**Titre :** Gérer les patients

### Créer

1. **Patients** → **Nouveau Patient**  
2. Nom, prénom, date de naissance, téléphone, adresse, dentiste, antécédents / allergies  
3. Enregistrer  

**[SCREENSHOT-007]**

### Rechercher

Champ « Rechercher par nom ou téléphone… » · pagination 50 / page · ou **Ctrl+K**

### Archiver

1. Action **Archiver**  
2. Confirmer (historique conservé)  
3. Toast « Patient archivé »  

**[SCREENSHOT-025]**

**Encadré IMPORTANT**  
Aucune action **Restaurer** n’est visible dans la liste Patients actuelle (restauration technique existante côté données / API). À valider manuellement en production.

**Permissions Cloud :** `patients.read` / `create` / `update` ; archive ≈ `patients.delete` (absent du rôle ASSISTANT par défaut).

---

## Chapitre 7 — Fiche patient

**Titre :** Soins, séances, imagerie

### Onglet Soins

Odontogramme FDI · statuts dentaires (Saine, Carie, Soin à faire, À surveiller, Traitée, Obturation, Couronne, Facette, Implant, Extraction) · actes · soins À faire / Fait  

**[SCREENSHOT-008]**

### Onglet Séances

Notes de visite · brouillon récupérable  

**[SCREENSHOT-009]**

### Onglet Imagerie

JPG / PNG / DICOM · max **80 Mo**  
Message : « Le fichier dépasse la taille maximale autorisée (80 Mo). »

**[SCREENSHOT-010]**

---

## Chapitre 8 — Agenda

**Titre :** Rendez-vous

Vues jour / semaine · glisser-déposer · Nouveau RDV  

**Catégories :** Urgence, Consultation, Contrôle, Soin, Extraction, Prothèse  
**Statuts :** Confirmé, En salle, Terminé, Annulé  

**[SCREENSHOT-012]**

Toast : « Rendez-vous enregistré »

---

## Chapitre 9 — Ordonnances et médicaments

**Titre :** Prescrire

1. Menu **Ordonnances** ou raccourci depuis le patient  
2. Choisir patient · modèles · médicaments  
3. Enregistrer · imprimer A4  

**[SCREENSHOT-013]**

Catalogue médicaments : **Paramètres → Médicaments** (pas de menu principal dédié).

**[SCREENSHOT-014]**

---

## Chapitre 10 — Prothèses, stock, finances

**Titre :** Modules opérationnels

### Prothèses

Statuts : En cours, Reçue, Posée, Annulée  

**[SCREENSHOT-015]**

### Stock

Catégories : Consommable, Prothèse, Hygiène, Médicament · alertes · ±  

**[SCREENSHOT-016]**  
*ASSISTANT : lecture seule par défaut (`stock.read`).*

### Finances

Périodes · CA · Payé / Facturé · CSV · impression · saisie patient ou libre · **DA**  

**[SCREENSHOT-017]**  
*ASSISTANT : pas de `billing.*` par défaut → menu Finances masqué.*

---

## Chapitre 11 — Documents Cloud

**Titre :** Documents *(Cloud uniquement)*

Menu **Documents** · patient · envoi / voir / supprimer  

**[SCREENSHOT-018]**

En Legacy : imagerie dans la fiche patient.

---

## Chapitre 12 — Dentistes et Équipe

**Titre :** Annuaire vs comptes

**Dentistes** = annuaire clinique (spécialité, couleur, photo)  
**Équipe** (Cloud) = comptes, rôles ADMIN / ASSISTANT, permissions  

**[SCREENSHOT-019]** · **[SCREENSHOT-020]**

---

## Chapitre 13 — Paramètres, sauvegarde, mises à jour

**Titre :** Administrer le cabinet

### Paramètres

Identité · logo · FR/AR · langue · médicaments · actes · licence · sauvegarde/export · mises à jour  

**[SCREENSHOT-021]**

### Sauvegarde

| Legacy | Cloud |
|--------|-------|
| Backup JSON + restauration (écrase les données) | Export / données serveur ; pas de restore local équivalent |

**Encadré ATTENTION**  
Toujours sauvegarder avant restauration ou mise à jour majeure.

### Mises à jour

Toast / Paramètres · auto-update Electron  
Builds peuvent être non signés → SmartScreen Windows possible.

---

## Chapitre 14 — Cloud : sync et erreurs

**Titre :** Multi-poste

- Hydrate au login  
- Toast conflit : « Ce patient a été modifié sur un autre poste. Les données ont été actualisées. »  
- « Connexion Cloud interrompue »  
- « Serveur Cloud inaccessible (réseau) »  

**[SCREENSHOT-023]** · **[SCREENSHOT-024]**

Autres libellés Cloud utiles :

- Identifiants invalides  
- Limite de sièges licence atteinte  
- Licence cabinet expirée ou inactive  
- Permission refusée (403)  

---

## Chapitre 15 — Workflows (résumés)

**Parcours clinique :** Nouveau patient → RDV → Soins / Séances → Ordonnance → (Paiement)  
**Admin Cloud :** Licence → Cabinet → Paramètres → Équipe → Dentistes  
**Archive :** Archiver (pas de Restaurer UI)  
**Backup Legacy :** Paramètres → JSON → restauration contrôlée  

Détail : fichier `WORKFLOWS.md`.

---

## Chapitre 16 — FAQ courte

- Offline Legacy : oui (sauf revalidation licence) · Cloud : non sans API  
- Médicaments : dans Paramètres  
- Ctrl+K : recherche globale  
- DA : devise affichée  
- Restaurer patient : **À vérifier dans l’interface** (bouton absent)  

---

## Chapitre 17 — Glossaire

Patient · Séance · Soins · Ordonnance · Acte · Legacy · Cloud · Archive · Miroir cabinet · Licence · Équipe · DA  

---

## Annexes pour le maquettiste

1. Insérer les figures SCREENSHOT-001 à 026 selon priorité P0 → P2  
2. Encadrés : IMPORTANT / CONSEIL / ATTENTION (style distinct)  
3. Tableaux Legacy/Cloud en double page si besoin  
4. Ne pas illustrer de fonctionnalités absentes du code  

**Statut matière :** prête pour design documentaire après captures réelles.
