# Guide opérationnel de capture — DentiSuite

**Version documentée :** Desktop 3.4.0 · API Cloud 3.1.2  
**Plan source :** `SCREENSHOTS_PLAN.md`  
**Destination fichiers :** `docs/user-guide/screenshots/`  
**Convention de nommage :** `SCREENSHOT-NNN.png` (+ optionnel `SCREENSHOT-NNN-annotated.png`)

> Suivre ce guide dans DentiSuite **réel**. Ne pas générer d’images factices.  
> Langue UI pour le manuel FR : **Français**.

---

## Qualité visuelle (règles communes)

| Règle | Détail |
|-------|--------|
| Résolution | Fenêtre maximisée, idéalement **1920×1080** |
| Thème | Cohérent ; pas de bascule de langue entre captures |
| Curseur | Hors champ si possible |
| Toasts parasites | Attendre disparition avant capture (sauf si la capture **est** le toast) |
| Données | **Uniquement** le dataset fictif ci-dessous |
| Secrets | Masquer License ID réel, mots de passe, tokens, URLs internes sensibles |
| Barre Windows | Acceptable en bas ; préférer fenêtre app seule si outil de capture le permet |
| PDF A4 | Captures nettes, texte lisible ; éviter zoom extrême |
| Annotations | Sur copie `-annotated.png` uniquement ; garder l’original intact |

---

## Dataset fictif standard (DEMO)

Utiliser **uniquement** ces données (clairement fictives).

### Cabinet
| Champ | Valeur |
|-------|--------|
| Nom | Cabinet Dentaire Exemple |
| Téléphone | 0550 11 22 33 |
| Adresse | 12 rue de la Démo, 16000 Alger |
| E-mail | demo@cabinet-exemple.dz |
| Ville (Cloud bootstrap) | Alger |

### Compte Cloud ADMIN (si applicable)
| Champ | Valeur |
|-------|--------|
| Nom | Admin Démo |
| Email / username | admin.demo@cabinet-exemple.dz |
| Mot de passe | *(ne jamais capturer en clair ; laisser champ masqué `••••••••`)* |

### Dentiste (annuaire)
| Champ | Valeur |
|-------|--------|
| Nom | Dr. Ahmed Benali |
| Spécialité | Omnipratique |

### Patient principal
| Champ | Valeur |
|-------|--------|
| Nom | Dupont |
| Prénom | Jean |
| Date de naissance | 15/03/1985 |
| Téléphone | 0550 00 00 00 |
| Adresse | 5 avenue Fictive, Alger |
| Dentiste traitant | Dr. Ahmed Benali |
| Antécédents | Aucun |
| Allergies | Non |

### Patient secondaire (listes / recherche)
| Champ | Valeur |
|-------|--------|
| Nom | Martin |
| Prénom | Sara |
| Téléphone | 0550 99 88 77 |
| Date de naissance | 22/07/1992 |

### Compte ASSISTANT Cloud (Équipe)
| Champ | Valeur |
|-------|--------|
| Username | assist.demo |
| Nom affiché | Assistant Démo |
| Rôle | Assistant |

### Médicaments (catalogue réel du logiciel)
Utiliser des entrées du catalogue seed, par ex. :
- **Amoxicilline** — 500 mg — Gélule  
- **Paracétamol** (si présent) / ou lignes des **modèles d’ordonnances** (Paracétamol 1 g, Ibuprofène 400 mg)

### Modèle d’ordonnance recommandé
**Antalgique post-extraction** (modèle intégré)

### RDV
| Champ | Valeur |
|-------|--------|
| Patient | Jean Dupont |
| Type / catégorie | Consultation |
| Statut | Confirmé |
| Dentiste | Dr. Ahmed Benali |
| Heure | dans la plage affichée (ex. 10:00) |

### Prothèse
| Champ | Valeur |
|-------|--------|
| Patient | Jean Dupont |
| Type | Couronne (ou type catalogue disponible) |
| Dent / site | 16 |
| Laboratoire | Labo Démo |
| Statut | En cours |

### Stock
| Champ | Valeur |
|-------|--------|
| Article | Gants nitrile M (DEMO) |
| Catégorie | Consommable |
| Quantité | 20 |
| Seuil d’alerte | 50 *(pour déclencher « Stock bas » si possible)* |

### Finance
| Champ | Valeur |
|-------|--------|
| Patient | Jean Dupont |
| Libellé | Consultation |
| Montant | 3000 DA |
| Statut | Payé |

### Imagerie
Fichier **JPG fictif** (radiographie / photo dentaire de démo, sans identité réelle), &lt; 80 Mo.

### Licence (captures 002/003)
Utiliser une licence de **démo / sandbox** fournie pour la doc.  
**Ne jamais** photographier une vraie clé production complète ; flouter si besoin (`SCREENSHOT-003` : montrer la structure des champs, flouter les valeurs sensibles).

---

## Préparation globale avant Session A

1. Installer / lancer **DentiSuite 3.4.0**.  
2. Prévoir **deux environnements** si possible : build **Legacy** et build **Cloud** (ou deux configs).  
3. Langue : **Français**.  
4. Créer le dataset DEMO (ordre recommandé § Ordre optimal).  
5. Créer le dossier de destination : `docs/user-guide/screenshots/`.  
6. Outil de capture : Snipping Tool / ShareX / etc. — PNG.

---

## Convention fichiers

```
docs/user-guide/screenshots/
  SCREENSHOT-001.png
  SCREENSHOT-002.png
  …
  SCREENSHOT-026.png
  SCREENSHOT-008-annotated.png   # optionnel
  SCREENSHOT-011-annotated.png   # optionnel
  SCREENSHOT-022-annotated.png   # optionnel
```

---

# SESSION A — ONBOARDING / AUTH / LICENCE

**Mode :** Cloud (+ licence commune)  
**Rôle :** aucun / bootstrap  
**Captures :** 003 → 002 → 001 → 023  

> Ordre : licence d’abord (écran bloquant), puis création cabinet (si org neuve), puis login, puis (plus tard ou en fin) API down.

---

# SCREENSHOT-001

## Nom
Connexion Cloud

## Objectif
Montrer l’entrée utilisateur Cloud après activation licence.

## Module
Authentification Cloud

## Mode
Cloud

## Préconditions
- Mode Cloud actif  
- Licence déjà valide (sinon l’app reste sur activation)  
- Organisation déjà créée (sinon écran 002)  
- Déconnecté  

## Données nécessaires
Champs vides ou préremplis avec `admin.demo@cabinet-exemple.dz` ; mot de passe **masqué**.

## Chemin
Démarrer DentiSuite Cloud → écran **DentiSuite / Connexion au cabinet**

## Actions
1. Lancer l’app Cloud (session non authentifiée).  
2. Si « Créer votre cabinet » s’affiche → cliquer **Déjà un compte ? Se connecter**.  
3. Saisir username/email DEMO (optionnel).  
4. Laisser le mot de passe masqué.  
5. Capturer **avant** de cliquer Se connecter (ou juste après focus champs).

## État attendu avant capture
Titre **DentiSuite**, sous-titre **Connexion au cabinet**, champs **Username ou email** + **Mot de passe**, bouton **Se connecter**.

## Éléments à capturer
- Branding DentiSuite  
- Sous-titre Connexion au cabinet  
- Deux champs  
- Bouton Se connecter  
- Liens bas de formulaire (licence / nouveau cabinet) si visibles sans gêner  

## Ce qu’il NE faut PAS montrer
Mot de passe en clair ; tokens ; License ID complet si affiché ailleurs.

## Cadrage recommandé
Fenêtre centrée sur le formulaire (carte login), pas toute la desktop vide.

## Annotation recommandée
1. Username ou email  
2. Mot de passe  
3. Se connecter  

## Légende
Figure 01 — Écran de connexion au cabinet DentiSuite Cloud.

## Chapitre du manuel
USER_GUIDE.md §5 · GAMMA Chapitre 3 · ADMIN_GUIDE §3

## Priorité
P1

## Fichier
`SCREENSHOT-001.png`

---

# SCREENSHOT-002

## Nom
Création de cabinet Cloud

## Objectif
Documenter le bootstrap organisation + compte admin.

## Module
Onboarding Cloud

## Mode
Cloud

## Préconditions
- Licence valide  
- Aucune org liée / étape `REGISTER_CLINIC`  
- Role : futur ADMIN  

## Données nécessaires
Cabinet Dentaire Exemple · Alger · Admin Démo · email DEMO · mot de passe masqué.

## Chemin
Post-licence → **Créer votre cabinet**  
ou depuis login → **Activer un nouveau cabinet**

## Actions
1. Atteindre le formulaire Créer votre cabinet.  
2. Remplir les champs DEMO (mdp masqué).  
3. Capturer **avant** soumission (évite de créer des doublons si déjà fait).

## État attendu
Titre **Créer votre cabinet** ; sections **Cabinet** et **Compte administrateur** ; bouton **Créer le cabinet et se connecter**.

## Éléments à capturer
Nom cabinet, téléphone, ville, nom admin, email, mdp, confirmation, bouton principal.

## Ce qu’il NE faut PAS montrer
Vrai License ID non flouté ; vrai mot de passe.

## Cadrage
Formulaire complet (scroll si besoin en 2 captures — préférer une seule fenêtre lisible).

## Annotation
1. Cabinet  2. Compte administrateur  3. Créer le cabinet…

## Légende
Figure 02 — Création du cabinet Cloud.

## Chapitre
USER_GUIDE §5 · ADMIN_GUIDE §3 · WORKFLOWS W2

## Priorité
P1

## Fichier
`SCREENSHOT-002.png`

---

# SCREENSHOT-003

## Nom
Activation de licence

## Objectif
Parcours licence Desktop (Legacy et Cloud).

## Module
Licence

## Mode
Legacy + Cloud *(même écran ; **une capture suffit**)*

## Préconditions
État licence non valide / écran d’activation accessible (nouvelle install, ou **Utiliser une autre licence**).

## Données nécessaires
Champs **License ID** et **Code d’activation** — valeurs floutées ou placeholder démo.

## Chemin
Démarrage app sans licence valide → **Activation de votre licence**

## Actions
1. Afficher l’écran d’activation.  
2. Saisir (ou non) des valeurs ; **flouter** avant publication si réelles.  
3. Capturer avec bouton **Activer la licence** visible.

## État attendu
Titre **Activation de votre licence** ; champs License ID + Code ; bouton Activer.

## Éléments à capturer
Titre, sous-titre, License ID, Code d’activation, Activer la licence.

## Ce qu’il NE faut PAS montrer
Codes de licence production lisibles.

## Cadrage
Formulaire licence centré.

## Annotation
1. License ID  2. Code  3. Activer la licence

## Légende
Figure 03 — Activation de licence Desktop.

## Chapitre
USER_GUIDE §4 · ADMIN_GUIDE §2 · GAMMA Chapitre 2

## Priorité
P0

## Fichier
`SCREENSHOT-003.png`

---

# SCREENSHOT-023

## Nom
Serveur Cloud inaccessible

## Objectif
Écran troubleshooting Cloud (API down).

## Module
Cloud / erreurs

## Mode
Cloud

## Préconditions
API injoignable (arrêter API locale, couper réseau, ou mauvaise URL).  
Licence OK ; pas encore « connecté » métier.

## Données nécessaires
Aucune donnée patient. L’URL API affichée peut être floutée si sensible.

## Chemin
Lancer Cloud alors que l’API ne répond pas → écran **Serveur inaccessible**

## Actions
1. Rendre l’API injoignable.  
2. Relancer / réessayer connexion Cloud.  
3. Capturer la carte d’erreur.

## État attendu
Titre **Serveur inaccessible** ; texte sur API ; bouton **Réessayer** ; éventuelle ligne `API : …`

## Éléments à capturer
Titre, paragraphe d’explication, bouton Réessayer.

## Ce qu’il NE faut PAS montrer
Secrets env ; credentials.

## Cadrage
Carte d’erreur centrée.

## Annotation
Aucune ou 1. Réessayer

## Légende
Figure 23 — Serveur Cloud inaccessible.

## Chapitre
USER_GUIDE §19 · TROUBLESHOOTING §2 · FAQ offline Cloud

## Priorité
P2

## Fichier
`SCREENSHOT-023.png`

---

# SESSION B — NAVIGATION & DASHBOARD (LEGACY puis CLOUD)

**Captures :** 004, 006, 022 (Legacy) · 005 (Cloud, après login ADMIN)

---

# SCREENSHOT-004

## Nom
Sidebar Legacy

## Objectif
Cartographier la navigation Legacy (libellés i18n FR).

## Module
Layout / navigation

## Mode
Legacy

## Préconditions
App Legacy ouverte, licence OK, langue FR.

## Données nécessaires
Aucune spécifique ; dashboard peut être peu rempli.

## Chemin
N’importe quelle page authentifiée Legacy

## Actions
1. Ouvrir Legacy.  
2. S’assurer que la sidebar est entièrement visible (pas réduite).  
3. Capturer avec **Tableau de bord** actif de préférence.

## État attendu
Menus : Tableau de bord · Patients & Odontogramme · Agenda & Rendez-vous · Dentistes / Équipe · Suivi des Prothèses · Ordonnances · Gestion de Stock · Caisse & Finances · Paramètres du cabinet

## Éléments à capturer
Toute la sidebar + un peu de contenu pour contexte.

## Ce qu’il NE faut PAS montrer
Données patients réelles.

## Cadrage
Fenêtre app complète (sidebar + zone principale).

## Annotation
Numéroter les entrées de menu 1–9 si besoin (`-annotated`).

## Légende
Figure 04 — Navigation latérale (mode Legacy).

## Chapitre
USER_GUIDE §6

## Priorité
P0

## Fichier
`SCREENSHOT-004.png`

---

# SCREENSHOT-005

## Nom
Sidebar Cloud

## Objectif
Montrer menus Cloud (Documents, Équipe) + badge Cloud.

## Module
CloudAppShell

## Mode
Cloud

## Préconditions
Connecté en **ADMIN** (`team.read`, `documents.read`, `billing.read`, etc. — ADMIN a tout).

## Role
ADMIN  
**Permissions :** toutes (défaut ADMIN)

## Données nécessaires
Cabinet DEMO connecté.

## Chemin
Après login Cloud → n’importe quelle page

## Actions
1. Se connecter ADMIN.  
2. Vérifier présence **Documents** et **Équipe**.  
3. Capturer sidebar + badge **DentiSuite Cloud** + **Déconnexion**.

## État attendu
Menus : Tableau de bord, Patients, Agenda, Dentistes, Prothèses, Ordonnances, Stock, Finances, Documents, Paramètres, Équipe.

## Éléments à capturer
Sidebar complète, badge Cloud, Déconnexion.

## Ce qu’il NE faut PAS montrer
Email personnel réel hors DEMO.

## Cadrage
Fenêtre complète Cloud.

## Annotation
Mettre en évidence Documents + Équipe (différences Legacy).

## Légende
Figure 05 — Navigation latérale (mode Cloud).

## Chapitre
USER_GUIDE §6 · ADMIN_GUIDE §11

## Priorité
P0

## Fichier
`SCREENSHOT-005.png`

---

# SCREENSHOT-006

## Nom
Tableau de bord

## Objectif
Vue d’ensemble activité.

## Module
Dashboard

## Mode
Legacy + Cloud — **une capture Legacy suffit** si UI identique ; sinon refaire Cloud.

## Préconditions
Dataset DEMO partiellement rempli (RDV jour, soin Fait, prothèse, stock bas) pour indicateurs non vides.

## Données nécessaires
Jean Dupont + RDV du jour + transaction / soin Fait + prothèse + article stock bas.

## Chemin
Sidebar → **Tableau de bord**

## Actions
1. Préparer données DEMO.  
2. Ouvrir Tableau de bord.  
3. Capturer sans toast.

## État attendu
Titre Tableau de bord ; cartes CA / RDV / stock / patients ; graphique ; RDV imminents ; prothèses.

## Éléments à capturer
Indicateurs, graphique, listes latérales.

## Ce qu’il NE faut PAS montrer
Vrais noms patients.

## Cadrage
Zone principale complète.

## Annotation
Optionnel : 1 CA  2 RDV  3 Stock critique

## Légende
Figure 06 — Tableau de bord.

## Chapitre
USER_GUIDE §7

## Priorité
P1

## Fichier
`SCREENSHOT-006.png`

---

# SCREENSHOT-022

## Nom
Recherche globale (Ctrl+K)

## Objectif
Overlay recherche multi-entités.

## Module
GlobalSearch

## Mode
Legacy + Cloud — **une capture suffit**

## Préconditions
Au moins Jean Dupont + éventuellement RDV / Rx pour groupes multiples.

## Données nécessaires
Patient Jean Dupont visible dans les résultats.

## Chemin
N’importe quelle page → **Ctrl+K** (ou bouton Rechercher)

## Actions
1. Ctrl+K.  
2. Taper `Dupont`.  
3. Attendre les groupes de résultats.  
4. Capturer l’overlay.

## État attendu
Titre **Recherche globale** ; placeholder ; groupe **Patients** avec Jean Dupont ; éventuellement autres groupes.

## Éléments à capturer
Overlay, champ, au moins un résultat patient.

## Ce qu’il NE faut PAS montrer
Autres patients réels.

## Cadrage
Overlay centré (+ fond app légèrement visible).

## Annotation
1. Champ recherche  2. Groupe Patients

## Légende
Figure 22 — Recherche globale (Ctrl+K).

## Chapitre
USER_GUIDE §6 / §18

## Priorité
P0

## Fichier
`SCREENSHOT-022.png` · optionnel `SCREENSHOT-022-annotated.png`

---

# SESSION C — PATIENTS & FICHE

**Captures :** 007, 008, 009, 010, 011, 025  
**Mode recommandé pour série principale :** Legacy (puis vérifier Cloud si différence)  
**Rôle Cloud :** ADMIN ou ASSISTANT avec `patients.*` (archive = `patients.delete` → **ADMIN**)

---

# SCREENSHOT-007

## Nom
Liste des patients

## Objectif
Gestion dossiers patients.

## Module
Patients

## Mode
Legacy + Cloud — une capture si UI liste identique

## Préconditions
Patients Jean Dupont + Sara Martin créés.

## Données nécessaires
Les deux patients DEMO visibles ; colonnes téléphone, âge, dentiste.

## Chemin
**Patients & Odontogramme** (Legacy) / **Patients** (Cloud)

## Actions
1. Ouvrir Patients.  
2. Vider le champ recherche (tous visibles).  
3. Capturer.

## État attendu
Titre Patients ; bouton **Nouveau Patient** ; recherche ; tableau ; actions Modifier / Archiver.

## Éléments à capturer
Nouveau Patient, recherche, lignes patients, actions.

## Ce qu’il NE faut PAS montrer
Vrais patients.

## Cadrage
Fenêtre complète module Patients.

## Annotation
1. Nouveau Patient  2. Recherche  3. Actions

## Légende
Figure 07 — Liste des patients de DentiSuite.

## Chapitre
USER_GUIDE §8

## Priorité
P0

## Fichier
`SCREENSHOT-007.png`

### État vide (optionnel, hors ID 007)
Message réel si recherche sans match : **Aucun patient ne correspond à la recherche.**  
Ne pas vider tout le cabinet uniquement pour une capture vide sauf besoin pédagogique séparé.

---

# SCREENSHOT-008

## Nom
Fiche patient — Soins / odontogramme

## Objectif
Cœur clinique (FDI + actes).

## Module
PatientChart → Soins

## Mode
Legacy + Cloud — une capture si identique

## Préconditions
Jean Dupont ouvert ; au moins 1–2 dents/actes (ex. carie / soin À faire).

## Données nécessaires
Patient Jean Dupont ; odontogramme avec sélection visible ; ligne(s) dans tableau de soins.

## Chemin
Patients → Jean Dupont → onglet **Soins**

## Actions
1. Ouvrir fiche Jean Dupont.  
2. Onglet Soins.  
3. Sélectionner une dent ; appliquer un statut/acte DEMO.  
4. Capturer.

## État attendu
Onglet Soins actif ; odontogramme ; palette ; tableau actes (À faire / Fait).

## Éléments à capturer
Odontogramme, palette, soins, en-tête patient.

## Ce qu’il NE faut PAS montrer
Commentaires médicaux réels.

## Cadrage
Zone centrale fiche (odontogramme prioritaire).

## Annotation
1. Odontogramme  2. Actes  3. Tableau soins — fichier `-annotated` recommandé

## Légende
Figure 08 — Odontogramme et soins.

## Chapitre
USER_GUIDE §9

## Priorité
P0

## Fichier
`SCREENSHOT-008.png`

---

# SCREENSHOT-009

## Nom
Fiche patient — Séances

## Objectif
Notes de visite chronologiques.

## Module
PatientChart → Séances

## Mode
Legacy + Cloud

## Préconditions
Au moins une séance pour Jean Dupont (texte fictif).

## Données nécessaires
Séance ex. : « Contrôle post-soin — patient asymptomatique (DEMO) » datée du jour.

## Chemin
Fiche Jean Dupont → **Séances**

## Actions
1. Onglet Séances.  
2. Créer séance si besoin (+ Nouvelle séance).  
3. Capturer liste / détail.

## État attendu
Historique des séances visible (pas l’état vide).

## Éléments à capturer
Titre séances, bouton nouvelle séance, au moins une note.

## État vide (référence)
« Aucune séance enregistrée pour ce patient. » — **non requis** pour le manuel principal.

## Cadrage
Zone onglet Séances.

## Légende
Figure 09 — Séances cliniques.

## Chapitre
USER_GUIDE §9

## Priorité
P1

## Fichier
`SCREENSHOT-009.png`

---

# SCREENSHOT-010

## Nom
Fiche patient — Imagerie

## Objectif
Médias JPG/PNG/DICOM.

## Module
PatientChart → Imagerie

## Mode
Legacy + Cloud

## Préconditions
Au moins une miniature JPG DEMO importée.

## Données nécessaires
Fichier image fictif &lt; 80 Mo.

## Chemin
Fiche → **Imagerie**

## Actions
1. Onglet Imagerie.  
2. Uploader JPG DEMO si besoin.  
3. Capturer zone drop + miniature.

## État attendu
Zone **Glissez-déposez** / Uploader ; au moins un fichier.

## Éléments à capturer
Zone d’ajout, miniature, hint formats.

## État vide
« Aucun fichier d’imagerie pour ce patient. » — optionnel.

## Cadrage
Onglet Imagerie.

## Légende
Figure 10 — Imagerie patient (JPG / PNG / DICOM, max 80 Mo).

## Chapitre
USER_GUIDE §9

## Priorité
P1

## Fichier
`SCREENSHOT-010.png`

---

# SCREENSHOT-011

## Nom
Raccourcis contextuels patient

## Objectif
Navigation rapide depuis la fiche.

## Module
PatientChart (barre patient + boutons Ordonnance / Rendez-vous / Paiement / Prothèse)

## Mode
Legacy + Cloud

## Préconditions
Fiche Jean Dupont ouverte.

## Données nécessaires
Jean Dupont affiché dans la barre **Patient**.

## Chemin
Patients → Jean Dupont (reste sur la fiche)

## Actions
1. Ouvrir la fiche.  
2. S’assurer que la barre Patient + les 4 boutons sont visibles.  
3. Capturer le haut de fiche (pas besoin de tout l’odontogramme).

## État attendu
Barre **Patient** (nom, âge, tél.) + boutons **Ordonnance**, **Rendez-vous**, **Paiement**, **Prothèse**.

## Éléments à capturer
PatientContextBar + 4 raccourcis.

## Note exactitude code
La barre seule sur Agenda/Ordonnances montre surtout **Fiche patient** ; les 4 raccourcis sont sur **PatientChart**. Capturer depuis la fiche.

## Annotation
1. Barre patient  2–5. Raccourcis

## Légende
Figure 11 — Raccourcis contextuels patient.

## Chapitre
USER_GUIDE §6 / §9

## Priorité
P1

## Fichier
`SCREENSHOT-011.png`

---

# SCREENSHOT-025

## Nom
Confirmation d’archivage patient

## Objectif
Soft-archive (confirmation en deux temps).

## Module
Patients

## Mode
Legacy + Cloud

## Role (Cloud)
ADMIN — permission **`patients.delete`**

## Préconditions
Patient DEMO secondaire **Sara Martin** (ne pas archiver Jean Dupont pendant la campagne si encore utile).

## Données nécessaires
Ligne Sara Martin visible.

## Chemin
Patients → ligne Sara Martin → **Archiver**

## Actions
1. Cliquer **Archiver** une première fois.  
2. L’UI passe en confirmation inline : bouton rouge **Archiver** + **Annuler**.  
3. Capturer **avant** de confirmer (ou confirmer seulement si acceptable).  
4. Si confirmé : toast **Patient archivé** (capture toast optionnelle séparée — non numérotée).

## État attendu
Confirmation inline sur la ligne (pas de modal dédié utilisant le texte i18n `patients.deleteConfirm` — clé présente dans i18n mais **non affichée** dans l’UI liste actuelle).

## Éléments à capturer
Ligne patient + boutons Archiver / Annuler de confirmation.

## Ce qu’il NE faut PAS montrer
Archivage d’un vrai patient.

## Cadrage
Tableau patients zoomé sur la ligne concernée (+ en-tête actions).

## Légende
Figure 25 — Confirmation d’archivage patient.

## Chapitre
USER_GUIDE §8 · WORKFLOWS W8

## Priorité
P1

## Fichier
`SCREENSHOT-025.png`

---

# SESSION D — AGENDA

**Capture :** 012

---

# SCREENSHOT-012

## Nom
Agenda et rendez-vous

## Objectif
Planification jour/semaine + création RDV.

## Module
Agenda

## Mode
Legacy + Cloud

## Role Cloud
`appointments.read` (+ create pour préparer données)

## Préconditions
RDV Jean Dupont créé ; légende catégories visible.

## Données nécessaires
RDV Consultation Confirmé pour Jean Dupont.

## Chemin
**Agenda & Rendez-vous** / **Agenda**

## Actions
1. Ouvrir Agenda (vue semaine ou jour avec RDV visible).  
2. Option recommandée : ouvrir aussi modal **Nouveau Rendez-vous** en second plan ou capture séparée annotée — **préférer une vue planning remplie** + si place, bouton Nouveau visible.  
3. Si modal : capturer modal rempli DEMO **ou** planning seul (priorité planning).

## État attendu
Planning avec au moins 1 RDV ; contrôles période ; bouton Nouveau Rendez-vous.

## Éléments à capturer
Vue agenda, RDV, catégories/statuts si légende visible, bouton Nouveau.

## Cadrage
Fenêtre Agenda complète.

## Annotation
1. Nouveau Rendez-vous  2. Créneau patient

## Légende
Figure 12 — Agenda et rendez-vous.

## Chapitre
USER_GUIDE §10

## Priorité
P0

## Fichier
`SCREENSHOT-012.png`

### État vide
« Aucun rendez-vous sur cette journée. » — non requis pour P0.

---

# SESSION E — ORDONNANCES & MÉDICAMENTS

**Captures :** 013, 014

---

# SCREENSHOT-013

## Nom
Module ordonnances

## Objectif
Liste, modèles, éditeur, impression.

## Module
Ordonnances

## Mode
Legacy + Cloud

## Role Cloud
`prescriptions.read` (+ create)

## Préconditions
Ordonnance Jean Dupont créée via modèle **Antalgique post-extraction**.

## Données nécessaires
Patient Jean Dupont ; modèle chargé ; lignes Paracétamol / Ibuprofène (du modèle).

## Chemin
**Ordonnances** → sélectionner / ouvrir ordonnance DEMO  
ou fiche → **Ordonnance**

## Actions
1. Ouvrir Ordonnances.  
2. Afficher modèles + éditeur ou liste avec une Rx.  
3. Capturer vue montrant **Modèles d’ordonnances** + contenu / liste.

## État attendu
Titre Ordonnances ; modèles ; au moins une ordonnance ou éditeur ouvert.

## Éléments à capturer
Modèles, patient, lignes médicaments, bouton **Imprimer** si visible.

## État vide
« Aucune ordonnance enregistrée… » — non prioritaire.

## Cadrage
Module Ordonnances (fenêtre complète).

## Légende
Figure 13 — Module ordonnances.

## Chapitre
USER_GUIDE §11

## Priorité
P0

## Fichier
`SCREENSHOT-013.png`

---

# SCREENSHOT-014

## Nom
Catalogue médicaments (Paramètres)

## Objectif
Gestion catalogue cabinet.

## Module
Paramètres → Médicaments

## Mode
Legacy + Cloud

## Préconditions
Section médicaments visible ; recherche possible sur Amoxicilline.

## Données nécessaires
Liste avec Amoxicilline (seed) visible.

## Chemin
**Paramètres du cabinet** / **Paramètres** → section **Médicaments**

## Actions
1. Ouvrir Paramètres.  
2. Scroller jusqu’à **Médicaments**.  
3. Rechercher `Amox` si besoin.  
4. Capturer la section (pas toute la page paramètres si trop longue — cadrer la section).

## État attendu
Titre Médicaments ; recherche ; liste ; actions Désactiver / Ajouter.

## Éléments à capturer
Recherche, liste, bouton Ajouter un médicament.

## Cadrage
Section Médicaments.

## Légende
Figure 14 — Catalogue médicaments du cabinet.

## Chapitre
USER_GUIDE §12 · ADMIN_GUIDE §5

## Priorité
P1

## Fichier
`SCREENSHOT-014.png`

---

# SESSION F — PROTHÈSES / STOCK / FINANCES

**Captures :** 015, 016, 017

---

# SCREENSHOT-015

## Nom
Suivi des prothèses

## Objectif
Commandes labo / statuts.

## Module
Prothèses

## Mode
Legacy + Cloud (nav Cloud filtrée par `patients.read`)

## Préconditions
Prothèse Jean Dupont En cours + Labo Démo.

## Chemin
**Suivi des Prothèses** / **Prothèses**

## Actions
1. Ouvrir Prothèses.  
2. Vérifier indicateurs / ligne DEMO.  
3. Capturer.

## État attendu
Liste non vide ; statuts ; recherche.

## Éléments à capturer
Indicateurs, tableau, bouton Ajouter.

## Légende
Figure 15 — Suivi des prothèses.

## Chapitre
USER_GUIDE §13

## Priorité
P1

## Fichier
`SCREENSHOT-015.png`

---

# SCREENSHOT-016

## Nom
Gestion de stock

## Objectif
Articles, alertes, quantités.

## Module
Stock

## Mode
Legacy + Cloud

## Role Cloud écriture
`stock.create` / `stock.update` — **ADMIN** (ASSISTANT = read seul par défaut)

## Préconditions
Article DEMO avec alerte stock bas si possible.

## Chemin
**Gestion de Stock** / **Stock**

## Actions
1. Ouvrir Stock.  
2. Capturer liste + bandeaux alertes.

## État attendu
Articles visibles ; éventuellement Stock bas.

## Éléments à capturer
Tableau, ±, alertes, Ajouter un article.

## Légende
Figure 16 — Gestion de stock.

## Chapitre
USER_GUIDE §14

## Priorité
P1

## Fichier
`SCREENSHOT-016.png`

---

# SCREENSHOT-017

## Nom
Caisse et finances

## Objectif
CA, transactions, export.

## Module
Finances

## Mode
Legacy + Cloud

## Role Cloud
**ADMIN** — `billing.read` (ASSISTANT : menu souvent masqué)

## Préconditions
Transaction Jean Dupont 3000 DA Payé.

## Chemin
**Caisse & Finances** / **Finances**

## Actions
1. Ouvrir Finances.  
2. Période incluant la transaction.  
3. Capturer indicateurs + liste + boutons Imprimer / CSV.

## État attendu
CA ; graphique ou vide message ; transactions ; Payé/Facturé.

## Éléments à capturer
KPIs, liste tx, Export CSV / Imprimer.

## Légende
Figure 17 — Caisse et finances (DA).

## Chapitre
USER_GUIDE §15

## Priorité
P1

## Fichier
`SCREENSHOT-017.png`

---

# SESSION G — CLOUD ONLY (DOCUMENTS / ÉQUIPE)

**Captures :** 018, 020 · Role ADMIN

---

# SCREENSHOT-018

## Nom
Documents Cloud

## Objectif
Module Documents (Cloud uniquement).

## Module
Documents

## Mode
Cloud

## Role
ADMIN ou permission **`documents.read`** (+ upload pour préparer)

## Préconditions
Patient Jean Dupont sélectionnable ; éventuellement 1 document uploadé.

## Chemin
Sidebar Cloud → **Documents**

## Actions
1. Ouvrir Documents.  
2. Sélectionner Jean Dupont.  
3. Capturer UI liste / upload.

## État attendu
Sélecteur patient + zone documents.

## Éléments à capturer
Patient, actions voir/upload/supprimer selon UI.

## Légende
Figure 18 — Documents Cloud.

## Chapitre
USER_GUIDE §16 · ADMIN_GUIDE §9

## Priorité
P1

## Fichier
`SCREENSHOT-018.png`

---

# SCREENSHOT-020

## Nom
Équipe Cloud

## Objectif
Comptes, rôles ADMIN/ASSISTANT, permissions.

## Module
Équipe

## Mode
Cloud

## Role
ADMIN — permission **`team.read`** (et create/update pour préparer)

## Préconditions
Au moins Admin Démo + Assistant Démo listés.

## Chemin
Sidebar → **Équipe**

## Actions
1. Ouvrir Équipe du cabinet.  
2. Afficher liste membres + si possible panneau permissions ASSISTANT.  
3. Capturer **sans** mots de passe.

## État attendu
Titre **Équipe du cabinet** ; rôles Administrateur / Assistant ; cases permissions si panneau ouvert.

## Éléments à capturer
Liste membres, rôles, UI permissions (si ouverte).

## Ce qu’il NE faut PAS montrer
Hash / mots de passe ; emails hors DEMO.

## Annotation
1. Membres  2. Rôle  3. Permissions

## Légende
Figure 20 — Gestion de l’équipe Cloud.

## Chapitre
ADMIN_GUIDE §4 · WORKFLOWS W9

## Priorité
P1

## Fichier
`SCREENSHOT-020.png`

---

# SESSION H — DENTISTES & PARAMÈTRES / MAJ

**Captures :** 019, 021, 026

---

# SCREENSHOT-019

## Nom
Annuaire des dentistes

## Objectif
Distinguer annuaire clinique ≠ Équipe Cloud.

## Module
Dentistes / Practitioners

## Mode
Legacy + Cloud — une capture Legacy OK si UI identique

## Préconditions
Dr. Ahmed Benali créé.

## Chemin
**Dentistes / Équipe** (Legacy) ou **Dentistes** (Cloud)

## Actions
1. Ouvrir le module.  
2. Capturer carte/liste du Dr. Benali.

## État attendu
Titre Dentistes / Équipe ; praticien DEMO ; bouton Nouveau dentiste.

## Éléments à capturer
Liste praticiens, spécialité, couleur/photo si présents.

## Note
En Legacy le libellé menu est **Dentistes / Équipe** mais ce n’est **pas** la page Cloud `/team`.

## Légende
Figure 19 — Annuaire des dentistes.

## Chapitre
USER_GUIDE §17 · ADMIN_GUIDE §8

## Priorité
P1

## Fichier
`SCREENSHOT-019.png`

---

# SCREENSHOT-021

## Nom
Paramètres du cabinet

## Objectif
Identité, branding, langue, sauvegarde/export, MAJ.

## Module
Paramètres

## Mode
**Deux captures recommandées si différence Legacy/Cloud sur la section sauvegarde**  
- `SCREENSHOT-021.png` = Legacy (Créer une sauvegarde + restauration)  
- Option : `SCREENSHOT-021-cloud.png` = Export Cloud *(hors numérotation stricte 26 — ou remplacer 021 par Cloud si manuel Cloud-first)*  

Pour coller aux 26 IDs : capturer **Legacy** comme 021 principal ; noter Cloud en verification.

## Role Cloud
Accès Paramètres (shell : `perm: null` — visible) ; actions settings selon droits.

## Préconditions
Identité Cabinet Dentaire Exemple renseignée ; langue Français.

## Chemin
**Paramètres du cabinet** / **Paramètres**

## Actions
1. Ouvrir Paramètres.  
2. Scroller pour montrer **Informations du cabinet** + **Sauvegarde et restauration** (+ logo si possible).  
3. Capturer (éventuellement collage de 2 zones si page trop longue — préférer une capture haute montrant identité + sauvegarde).

## État attendu
Sections : Informations du cabinet ; Sauvegarde et restauration (boutons Legacy : **Créer une sauvegarde** / restauration) ; Logo ; Langue ; Médicaments plus bas ; **Mises à jour** (version **3.4.0**).

## Éléments à capturer
Identité DEMO ; section sauvegarde ; indication version si visible dans Mises à jour.

## Ce qu’il NE faut PAS montrer
Chemins fichiers locaux personnels.

## Légende
Figure 21 — Paramètres du cabinet.

## Chapitre
ADMIN_GUIDE §5–7 · USER_GUIDE paramètres

## Priorité
P0

## Fichier
`SCREENSHOT-021.png`

---

# SCREENSHOT-026

## Nom
Mises à jour

## Objectif
Auto-update / version installée.

## Module
Paramètres → Mises à jour (UpdateNotifier)

## Mode
Legacy + Cloud — une capture

## Préconditions
Build packagée de préférence (dev peut afficher états limités).

## Données nécessaires
« Version installée : 3.4.0 » (ou valeur affichée).

## Chemin
Paramètres → section **Mises à jour**

## Actions
1. Ouvrir Paramètres ; scroller jusqu’à **Mises à jour**.  
2. Cliquer **Vérifier les mises à jour** si besoin.  
3. Si statut `available` : capturer « Nouvelle version disponible (…) » + boutons.  
4. Sinon capturer l’état **À jour** avec version 3.4.0 — **toujours utile**.  
5. Si toast/prompt bas-droit `available`/`ready` : capturer à la place ou en plus.

## État attendu
Section Mises à jour ; version ; statut ; bouton Vérifier.

## Éléments à capturer
Version installée, statut, boutons.

## Note
Libellés exacts selon état : Vérification… / Nouvelle version disponible / À jour / Téléchargement… / Installation prête.

## Légende
Figure 26 — Mises à jour DentiSuite (version installée).

## Chapitre
ADMIN_GUIDE §7 · USER_GUIDE §3

## Priorité
P2

## Fichier
`SCREENSHOT-026.png`

---

# SESSION I — SYNC / TOAST CONFLIT (DIFFICILE)

**Capture :** 024

---

# SCREENSHOT-024

## Nom
Toast conflit multi-poste

## Objectif
Illustrer le message de conflit Cloud.

## Module
Patients / sync Cloud

## Mode
Cloud

## Préconditions
Deux postes Cloud sur le même patient — **OU** reproduction technique.

## Données nécessaires
Jean Dupont.

## Chemin
Fiche / édition patient en concurrence

## Actions (théoriques)
1. Poste A et B connectés Cloud.  
2. Modifier Jean Dupont sur B puis enregistrer sur A.  
3. Capturer le toast dès apparition.

## MANUAL VERIFICATION REQUIRED — CRITIQUE
La clé i18n `toast.conflict` (« Ce patient a été modifié sur un autre poste… ») **existe**, mais **aucun appel UI** `t('toast.conflict')` n’a été trouvé dans le code au moment de ce guide.  
→ La capture peut être **impossible** tant que le toast n’est pas branché.  
→ Vérifier manuellement ; si absent : marquer **NON DISPONIBLE** et retirer du PDF ou remplacer par note troubleshooting.

## État attendu (si branché)
Toast avec le texte exact du message.

## Cadrage
Toast + portion d’écran patient.

## Légende
Figure 24 — Actualisation après modification concurrente.

## Chapitre
USER_GUIDE §19 · TROUBLESHOOTING §3

## Priorité
P2

## Fichier
`SCREENSHOT-024.png`

---

# ORDRE OPTIMAL DE PRISE DE VUE

| # | ID | Session | Mode |
|---|-----|---------|------|
| 01 | 003 | A | Legacy ou Cloud |
| 02 | 002 | A | Cloud (org neuve / sandbox) |
| 03 | 001 | A | Cloud |
| 04 | 005 | B | Cloud ADMIN |
| 05 | 018 | G | Cloud |
| 06 | 020 | G | Cloud |
| 07 | 023 | A/I | Cloud API down |
| 08 | 024 | I | Cloud *(si possible)* |
| 09 | 004 | B | Legacy |
| 10 | 006 | B | Legacy |
| 11 | 019 | H | Legacy |
| 12 | 007 | C | Legacy |
| 13 | 008 | C | Legacy |
| 14 | 011 | C | Legacy |
| 15 | 009 | C | Legacy |
| 16 | 010 | C | Legacy |
| 17 | 012 | D | Legacy |
| 18 | 013 | E | Legacy |
| 19 | 015 | F | Legacy |
| 20 | 016 | F | Legacy |
| 21 | 017 | F | Legacy |
| 22 | 022 | B | Legacy |
| 23 | 014 | E | Legacy |
| 24 | 021 | H | Legacy |
| 25 | 026 | H | Legacy |
| 26 | 025 | C | Legacy (Sara Martin) |

Puis contrôler les écrans Cloud vs Legacy pour 006–017 : **ne recapturer que si UI différente**.

---

# SCREENSHOT EXECUTION CHECKLIST

| ID | Nom | Mode | Module | Données nécessaires | Priorité | Statut |
|----|-----|------|--------|---------------------|----------|--------|
| 001 | Connexion Cloud | Cloud | Auth | email DEMO, mdp masqué | P1 | À FAIRE |
| 002 | Création cabinet | Cloud | Onboarding | Cabinet Exemple + Admin Démo | P1 | À FAIRE |
| 003 | Activation licence | Legacy+Cloud | Licence | champs floutés | P0 | À FAIRE |
| 004 | Sidebar Legacy | Legacy | Nav | — | P0 | À FAIRE |
| 005 | Sidebar Cloud | Cloud | Nav | ADMIN | P0 | À FAIRE |
| 006 | Tableau de bord | Legacy(+Cloud) | Dashboard | RDV+CA+stock+prothèse | P1 | À FAIRE |
| 007 | Liste patients | Legacy(+Cloud) | Patients | Dupont + Martin | P0 | À FAIRE |
| 008 | Odontogramme | Legacy(+Cloud) | Chart Soins | Dupont + actes | P0 | À FAIRE |
| 009 | Séances | Legacy(+Cloud) | Chart Séances | 1 séance DEMO | P1 | À FAIRE |
| 010 | Imagerie | Legacy(+Cloud) | Chart Imagerie | 1 JPG DEMO | P1 | À FAIRE |
| 011 | Raccourcis patient | Legacy(+Cloud) | Chart | Dupont | P1 | À FAIRE |
| 012 | Agenda | Legacy(+Cloud) | Agenda | RDV Dupont | P0 | À FAIRE |
| 013 | Ordonnances | Legacy(+Cloud) | Rx | modèle antalgique | P0 | À FAIRE |
| 014 | Médicaments | Legacy(+Cloud) | Paramètres | Amoxicilline | P1 | À FAIRE |
| 015 | Prothèses | Legacy(+Cloud) | Prothèses | Couronne Dupont | P1 | À FAIRE |
| 016 | Stock | Legacy(+Cloud) | Stock | Gants DEMO | P1 | À FAIRE |
| 017 | Finances | Legacy(+Cloud) | Finances | 3000 DA Payé | P1 | À FAIRE |
| 018 | Documents | Cloud | Documents | Dupont + doc | P1 | À FAIRE |
| 019 | Dentistes | Legacy(+Cloud) | Dentistes | Dr. Benali | P1 | À FAIRE |
| 020 | Équipe | Cloud | Équipe | ADMIN+ASSISTANT | P1 | À FAIRE |
| 021 | Paramètres | Legacy(+Cloud) | Paramètres | Cabinet Exemple | P0 | À FAIRE |
| 022 | Recherche Ctrl+K | Legacy(+Cloud) | Search | Dupont | P0 | À FAIRE |
| 023 | Serveur inaccessible | Cloud | Erreur | API down | P2 | À FAIRE |
| 024 | Toast conflit | Cloud | Sync | 2 postes *(VERIFY)* | P2 | À FAIRE |
| 025 | Archivage confirm | Legacy(+Cloud) | Patients | Sara Martin | P1 | À FAIRE |
| 026 | Mises à jour | Legacy(+Cloud) | Paramètres | version 3.4.0 | P2 | À FAIRE |

---

# MANUAL VERIFICATION REQUIRED

| POINT | Écran | Vérifier | Capture | Résultat attendu |
|-------|-------|----------|---------|------------------|
| Restauration patient | Patients | Bouton Restaurer ? | Aucune prévue (absent UI) | Confirmer absence |
| Affichage version | Paramètres → Mises à jour | Texte version | 026 / 021 | Affiche 3.4.0 |
| Libellés backup/export | Paramètres → Sauvegarde | Legacy vs Cloud | 021 | « Créer une sauvegarde » vs « Exporter le cabinet » |
| Toast auto-update | Prompt bas-droit / 026 | États available/ready | 026 | Libellés UpdateNotifier |
| i18n AR Cloud | Sidebar Cloud | Labels restent FR | Optionnelle | FR fixe |
| Impression | Ordonnances / Finances / Stock | Aperçu print | Hors 26 (ou crop 013) | Fenêtre print OS |
| Permissions Équipe | Équipe | Cases vs vocabulary | 020 | Liste réelle UI |
| SmartScreen | Installateur | Avertissement Windows | Hors manuel produit | Note IT |
| Toast conflit branché | — | Appel `toast.conflict` | 024 | Disponible ou NON DISPONIBLE |
| Texte archive | Patients | Confirmation inline | 025 | Pas de modal `deleteConfirm` |

---

# Captures ADMIN / permissions

| ID | Role | Permission clé |
|----|------|----------------|
| 005, 018, 020 | ADMIN | `documents.read`, `team.read`, … |
| 017 | ADMIN | `billing.read` |
| 016 (écriture données) | ADMIN | `stock.create` / `update` |
| 025 | ADMIN | `patients.delete` |
| 001–003, 023 | — | avant / hors session |

---

# Captures impression

Pas d’ID dédié « dialogue Imprimer Windows ».  
Éléments **Imprimer** visibles dans : **013** (ordonnances), **017** (finances), **016** (Exporter / Imprimer stock).  
Ne pas capturer de données patient réelles dans l’aperçu système.

---

Fin du guide opérationnel.  
Statut préparation : voir `SCREENSHOT_CAPTURE_PREPARATION_REPORT.md`.
