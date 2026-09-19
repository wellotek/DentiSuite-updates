# DentiSuite — Guide d’utilisation

**Version Desktop :** 3.4.0  
**Version API Cloud :** 3.1.2  
**Public :** praticiens, secrétaires, assistants (selon permissions)

> Les libellés de menus Legacy sont ceux de l’interface en français (i18n). En Cloud, la barre latérale utilise des libellés plus courts (codés en français dans l’application).

---

## 1. Présentation de DentiSuite

### Objectif

DentiSuite est une application **Windows (Electron)** de gestion de cabinet dentaire : patients, agenda, soins / odontogramme, séances cliniques, ordonnances, prothèses, stock, caisse, paramètres.

### À qui s’adresse le logiciel

- Praticiens (dentistes)
- Secrétariat / assistants
- Administrateur du cabinet (surtout en mode Cloud)

### Architecture utile à l’utilisateur

| Mode | Description |
|------|-------------|
| **LEGACY** | Données stockées localement sur le poste. Licence Desktop requise. |
| **CLOUD** | Données d’organisation synchronisées via l’API. Connexion utilisateur + licence Desktop. Multi-poste / multi-utilisateur. |

Le mode est défini au démarrage de l’application (variables d’environnement / packaging), pas via un interrupteur dans l’interface utilisateur principale.

---

## 2. Configuration requise

### Observé dans le projet

- **Windows** (build NSIS : `DentiSuite-Setup-x.y.z.exe`)
- Application Electron packagée
- **Licence** : vérification via serveur de licence (connexion Internet nécessaire pour activer / revalider selon les états)
- **Mode Cloud** : accès réseau au serveur API Cloud ; écran « Serveur inaccessible » si l’API ne répond pas

### Offline

| Mode | Comportement |
|------|----------------|
| Legacy | Travail local possible une fois licence valide. Un état licence « offline » peut demander une reconnexion Internet. |
| Cloud | Sans API : écran d’indisponibilité. Pas de bascule automatique vers un cabinet local. |

**À vérifier dans l’interface :** prérequis matériels exacts (RAM, résolution minimale) — non formalisés dans le code métier.

---

## 3. Installation et lancement

### Étapes typiques

1. Exécuter l’installateur `DentiSuite-Setup-3.4.0.exe` (ou version équivalente).
2. Lancer **DentiSuite** depuis le menu Démarrer / raccourci.
3. Première ouverture : écran **Activation de licence** si non activé.
4. Ensuite : accès à l’application (Legacy) ou flux Cloud (inscription cabinet / connexion).

### Mises à jour

Voir **ADMIN_GUIDE** § Mises à jour. L’application peut proposer une mise à jour (toast) et une section dans Paramètres.

**IMPORTANT :** les builds peuvent être non signés Authenticode selon la release — Windows SmartScreen peut avertir.

---

## 4. Licence et activation

### Où ?

Écran dédié au démarrage si licence non valide : **Activation de votre licence**.

### Champs

1. **License ID**
2. **Code d’activation**
3. Bouton **Activer la licence**

### États possibles (libellés i18n)

| Situation | Message / action |
|-----------|------------------|
| Succès | « Licence activée avec succès. » |
| Identifiants incorrects | « Identifiant de licence ou code d’activation incorrect. » |
| Déjà utilisée ailleurs | « Cette licence est déjà activée sur un autre ordinateur. » |
| Révoquée | « Votre licence DentiSuite n’est plus valide. » |
| Réseau | « Impossible de contacter le serveur de licence. » |
| Besoin online | « Une vérification de licence est nécessaire. Connectez DentiSuite à Internet… » |
| Actions | **Réessayer**, **Utiliser une autre licence**, contact support |

**CONSEIL :** conserver License ID et code fournis par l’éditeur hors de l’ordinateur.

---

## 5. Compte et connexion (mode Cloud uniquement)

### Première création de cabinet

Écran **Créer votre cabinet** (après licence) : informations cabinet + compte administrateur (email / mot de passe / nom).  
Correspond au bootstrap organisation côté API (licence Cloud + compte owner).

### Connexion

Écran **Connexion au cabinet** :

1. **Username ou email**
2. **Mot de passe**
3. Connexion

Puis chargement (hydrate) des données du cabinet.

### Déconnexion

Dans la barre Cloud : **Déconnexion** (pied de navigation).

### Mot de passe

Changement / réinitialisation côté **Équipe** (administrateur) pour les collaborateurs.  
**À vérifier dans l’interface :** présence d’un « mot de passe oublié » self-service — non observé comme parcours utilisateur autonome dans les pages Cloud actuelles.

### Sessions

En Cloud, la session est gérée par l’application (stockage sécurisé côté Electron). Messages possibles (libellés `cloudErrorLabel`) : « Session expirée (401) », « Session expirée ou invalide (401) », « Identifiants invalides ».

---

## 6. Découverte de l’interface

### Sidebar Legacy (libellés FR)

| Menu | Destination |
|------|-------------|
| Tableau de bord | `/` |
| Patients & Odontogramme | `/patients` |
| Agenda & Rendez-vous | `/agenda` |
| Dentistes / Équipe | `/praticiens` |
| Suivi des Prothèses | `/protheses` |
| Ordonnances | `/ordonnances` |
| Gestion de Stock | `/stock` |
| Caisse & Finances | `/finances` |
| Paramètres du cabinet | `/parametres` |

### Sidebar Cloud (libellés FR courts)

Tableau de bord, Patients, Agenda, Dentistes, Prothèses, Ordonnances, Stock, Finances, **Documents**, Paramètres, **Équipe**.  
Les entrées sont filtrées selon les permissions (`patients.read`, `appointments.read`, etc.).

### Header Cloud

Badge **DentiSuite Cloud**.

### Navigation contextuelle patient

Sur Agenda, Ordonnances, Finances, Prothèses (lorsqu’un patient est dans le contexte) : barre **Patient** avec retour fiche, raccourcis Ordonnance / Rendez-vous / Paiement / Prothèse.

### Recherche globale

**Raccourci :** `Ctrl+K` (Windows) / `Cmd+K` (macOS si applicable).

Recherche dans : Patients, RDV, Ordonnances, Factures, Prothèses, Dentistes, Médicaments.  
Les patients archivés sont exclus de la recherche patients.

### Notifications (toasts)

Exemples de messages : « Patient enregistré », « Patient archivé », « Rendez-vous enregistré », « Ordonnance enregistrée », « Facture enregistrée », « Ce patient a été modifié sur un autre poste… », « Connexion Cloud interrompue ».

### Langue

Paramètres → **Langue** : Français / العربية (RTL).  
**ATTENTION :** une partie de l’UI Cloud (sidebar, login, équipe, documents) reste en français fixe et n’est pas entièrement couverte par l’i18n.

---

## 7. Tableau de bord

### Où ?

Menu **Tableau de bord**.

### Contenu observé

- Indicateurs : CA du jour (soins « Fait »), RDV du jour, prothèses ouvertes, stock critique
- Graphique de revenus (semaine / mois)
- Prochains rendez-vous
- Liens vers les modules concernés

Montants affichés en **DA** (dinar).

---

## 8. Gestion des patients

### Où ?

**Patients & Odontogramme** (Legacy) / **Patients** (Cloud).

### Permissions Cloud

- Voir la liste : `patients.read`
- Créer : `patients.create` (selon rôle / overrides)
- Modifier : `patients.update`
- Archiver : équivalent suppression soft (`patients.delete` côté API)

### Créer un patient

1. Cliquer **Nouveau Patient**.
2. Remplir : Nom, Prénom, Date de naissance, Âge (calculé si date), Téléphone, Adresse, Dentiste traitant (optionnel), Antécédents / Allergies, case allergies.
3. Valider.

**Résultat :** le patient apparaît dans la liste ; navigation vers la fiche.

### Modifier

Action **Modifier** sur la ligne (ou depuis la fiche).

### Rechercher

Champ : « Rechercher par nom ou téléphone… » (debounce). Pagination **50** patients / page.

### Archiver

Bouton **Archiver** avec confirmation en deux temps.  
**Résultat :** patient masqué des listes actives ; toast « Patient archivé ».  
Historique clinique conservé (soft archive).

### Restaurer

La restauration existe dans le moteur de données / API (`restore`), **mais aucune action « Restaurer » n’est exposée dans la liste Patients actuelle**.

**POINTS À VALIDER MANUELLEMENT :** comment un admin récupère un patient archivé en production (écran manquant ou procédure support).

### Colonnes liste

Patient, Téléphone, Âge (+ date de naissance), Dentiste, Antécédents, Actions.

---

## 9. Fiche patient

### Où ?

Clic sur un patient → `/patients/:id`.

### Onglets principaux

1. **Soins** — odontogramme FDI + palette d’actes + tableau de soins  
2. **Séances** — notes de visite (séances cliniques)  
3. **Imagerie** — fichiers JPG / PNG / DICOM (max **80 Mo**)

### Raccourcis depuis la fiche

Ordonnance, Rendez-vous, Paiement, Prothèse (navigation contextuelle).

### Odontogramme (onglet Soins)

**Statuts dentaires observés :** Saine, Carie, Soin à faire, À surveiller, Traitée, Obturation, Couronne, Facette, Implant, Extraction.

**Actes :** catégories Consultations, Soins, Prothèses, Chirurgie, Radios (`data/acts`).

**Statuts de soin :** À faire | Fait.

### Séances

Création / historique de séances (notes).  
**Brouillons** : autosauvegarde locale possible (« Brouillon récupéré »).

### Imagerie

Glisser-déposer ou sélection fichier ; stockage local (Electron) en Legacy ; en Cloud également via miroir / stockage selon flux.

---

## 10. Agenda et rendez-vous

### Où ?

**Agenda & Rendez-vous** / **Agenda**.

### Permission Cloud

`appointments.read` / création-modification selon `appointments.create` / `appointments.update`.

### Fonctions

- Vues **jour** / **semaine**
- Création via modal **Nouveau RDV**
- Déplacement (glisser-déposer)
- Légende des catégories

### Catégories

Urgence, Consultation, Contrôle, Soin, Extraction, Prothèse.

### Statuts

Confirmé, En salle, Terminé, Annulé.

### Nouveau RDV — champs

Patient (sélecteur ou nouveau), date, heure, durée, motif/acte, dentiste, catégorie.  
Plage horaire typique : environ **08:00–19:00**.

**Résultat :** toast « Rendez-vous enregistré ».

---

## 11. Ordonnances

### Où ?

**Ordonnances**.

### Permission Cloud

`prescriptions.read` (+ create/update/delete selon droits).

### Fonctions

- Liste / recherche (patient, titre, médicament)
- Éditeur d’ordonnance
- Modèles prêts à l’emploi (ex. Antalgique post-extraction, Soin post-opératoire, Antibiothérapie, Bains de bouche, Inflammation gingivale, Urgence douleur)
- Impression A4
- Brouillon autosauvegardé (« Brouillon récupéré »)

### Médicaments dans l’ordonnance

Recherche dans le catalogue cabinet ; saisie manuelle possible selon l’éditeur.

---

## 12. Catalogue médicaments

### Où ?

**Paramètres du cabinet** → section **Médicaments** (pas de page menu dédiée).

### Actions

- Recherche
- Ajout : nom commercial, DCI, dosage, forme
- Désactivation / réactivation

**CONSEIL :** maintenir le catalogue avant les séances d’ordonnances intensives.

---

## 13. Prothèses

### Où ?

**Suivi des Prothèses** / **Prothèses**.

### Statuts

En cours, Reçue, Posée, Annulée.

### Données

Patient, type (liste + personnalisé), dent, laboratoire, dates, notes.  
Indicateurs : ouvertes / en cours / reçues / en retard.

---

## 14. Stock

### Où ?

**Gestion de Stock** / **Stock**.

### Permission Cloud

`stock.read` (+ écriture selon droits).

### Fonctions

- Articles par catégories : Consommable, Prothèse, Hygiène, Médicament
- Alertes stock bas / périmé / bientôt périmé
- Ajustement quantités ±
- CRUD articles
- Impression / rapport

---

## 15. Finances / Caisse

### Où ?

**Caisse & Finances** / **Finances**.

### Permission Cloud

`billing.read` (et create/update selon rôle — les assistants n’ont souvent pas la facturation par défaut).

### Fonctions

- Filtres de période
- Indicateurs CA
- Graphique
- Factures Payé / Facturé
- Export CSV
- Impression rapport
- Modal transaction : patient ou **Saisie libre**, libellé/acte, montants

Devise d’affichage : **DA**.

---

## 16. Documents Cloud

### Où ?

Menu Cloud **Documents** uniquement (`documents.read`).

### Fonctions

- Sélection patient
- Envoi d’image (URL signée)
- Voir / Supprimer

**Legacy :** pas de page Documents dédiée ; imagerie dans la fiche patient.

---

## 17. Dentistes / praticiens (annuaire)

### Où ?

**Dentistes / Équipe** (Legacy) / **Dentistes** (Cloud).

### Contenu

Annuaire des praticiens du cabinet : nom, spécialité (défaut *Omnipratique*), photo, couleur.  
**Ce n’est pas** la gestion des comptes utilisateurs Cloud (voir ADMIN_GUIDE → Équipe).

Association optionnelle « dentiste traitant » sur le patient.

---

## 18. Recherche globale

Voir §6. Raccourci **Ctrl+K**.

---

## 19. Synchronisation Cloud (aperçu utilisateur)

- Au login : chargement (hydrate) des données du cabinet
- Modifications envoyées à l’API selon le module
- Conflit possible : toast « Ce patient a été modifié sur un autre poste. Les données ont été actualisées. »
- Coupure : « Connexion Cloud interrompue » / « Serveur Cloud inaccessible (réseau) »

Détails admin : **ADMIN_GUIDE**.

---

## 20. Glossaire

| Terme | Sens dans DentiSuite |
|-------|----------------------|
| **Patient** | Dossier patient (actif ou soft-archivé) |
| **Séance** | Visite / note clinique (onglet Séances) |
| **Soins** | Actes / odontogramme |
| **Ordonnance** | Prescription médicamenteuse imprimable |
| **Acte** | Soin dentaire catalogue / ligne de traitement |
| **Legacy** | Mode données locales |
| **Cloud** | Mode organisation / API |
| **Archive** | Soft-archive : masqué des listes, historique conservé |
| **Miroir cabinet** | Copie locale des données Cloud pour l’UI |
| **Licence** | Activation Desktop (License ID + code) |
| **Équipe** | Comptes Cloud (Admin / Assistant) |
| **DA** | Devise affichée (dinar) |

---

## 21. Points à valider manuellement

1. Bouton / écran de **restauration** des patients archivés (absent de la liste actuelle).
2. Parcours exact « mot de passe oublié » s’il existe hors Équipe.
3. Comportement SmartScreen sur chaque build Windows.
4. Couverture réelle de l’arabe sur toutes les pages Cloud.
5. Impression : aperçu exact des documents A4 sur imprimantes du cabinet.
