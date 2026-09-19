# DentiSuite — Guide administrateur

**Version Desktop :** 3.4.0  
**Version API Cloud :** 3.1.2  
**Public :** propriétaire / administrateur du cabinet

Ce guide complète le **USER_GUIDE**. Il couvre licence, équipe Cloud, permissions, paramètres, sauvegarde, mises à jour et différences Legacy / Cloud.

---

## 1. Rôle administrateur

### Legacy

Il n’y a pas de multi-utilisateurs applicatifs dans le mode Legacy : un poste = une installation + une licence. La « gestion d’équipe » se limite à l’**annuaire des dentistes** (praticiens).

### Cloud

L’administrateur (rôle **ADMIN**) gère :

- Organisation / cabinet
- Comptes **Équipe**
- Permissions (rôles + overrides)
- Paramètres
- Documents (selon droits)
- Export / sauvegarde Cloud
- Licence Desktop (toujours requise)

---

## 2. Licence Desktop

### Activation

Écran **Activation de votre licence** :

1. Saisir **License ID**
2. Saisir **Code d’activation**
3. Cliquer **Activer la licence**

### États et messages (réels)

| Message | Cause probable | Que faire |
|---------|----------------|-----------|
| Licence activée avec succès | OK | Continuer |
| Identifiant de licence ou code d’activation incorrect | Mauvais ID/code | Vérifier la saisie |
| Cette licence est déjà activée sur un autre ordinateur | Machine liée ailleurs | Contacter le support / autre licence |
| Votre licence DentiSuite n’est plus valide | Révoquée / invalide | Contacter le support |
| Impossible de contacter le serveur de licence | Réseau / serveur | Vérifier Internet, **Réessayer** |
| Une vérification de licence est nécessaire. Connectez DentiSuite à Internet… | État offline licence | Se reconnecter |

Actions UI : **Réessayer**, **Utiliser une autre licence**.

**IMPORTANT :** la licence Desktop s’applique aussi en mode Cloud.

---

## 3. Bootstrap Cloud — premier cabinet

Après licence valide en mode Cloud :

1. Écran **Créer votre cabinet**
2. Renseigner identité du cabinet + compte administrateur (email / mot de passe / nom)
3. Validation → organisation créée côté API
4. Accès à l’application Cloud

Ensuite : **Connexion au cabinet** pour les sessions suivantes.

---

## 4. Équipe (Cloud uniquement)

### Où ?

Sidebar Cloud → **Équipe**.

### Prérequis

Permissions d’administration utilisateurs (rôle **ADMIN** typiquement).

### Actions observées

- Liste des membres
- Invitation / ajout d’utilisateur
- Attribution du rôle **ADMIN** ou **ASSISTANT**
- Overrides de permissions (cases individuelles)
- Désactivation / révocation selon UI
- Réinitialisation de mot de passe (par admin)

### Rôles

| Rôle | Intention |
|------|-----------|
| **ADMIN** | Toutes les permissions du vocabulaire API |
| **ASSISTANT** | Liste d’autorisations par défaut (voir ci-dessous) ; overrides possibles |

**ATTENTION :** les permissions exactes dépendent du rôle **et** des overrides. Vérifier dans l’écran Équipe.

### Permissions ASSISTANT par défaut (code)

Incluses :

- patients : `read`, `create`, `update` (**pas** `delete` / archive)
- appointments : `read`, `create`, `update` (**pas** `delete`)
- consultations : `read`, `create`, `update` (**pas** `delete`)
- prescriptions : `read`, `create`, `update` (**pas** `delete`)
- dentists : `read` seulement
- documents : `read`, `upload` (**pas** `delete`)
- imaging : `read`, `upload` (**pas** `delete`)
- stock : `read` seulement (**pas** create/update/delete)
- reports : `read`
- profile : `read`, `update`
- devices : `read`, `revoke`

**Absentes par défaut pour ASSISTANT :**

- `billing.*` (menu Finances masqué)
- `patients.delete`, `appointments.delete`, `prescriptions.delete`, …
- `stock.create` / `update` / `delete`
- `settings.*`, `team.*`, `audit.read`, `license.read`
- `documents.delete`, `imaging.delete`, `dentists.create/update/delete`

### Filtrage navigation Cloud

| Menu | Permission requise |
|------|-------------------|
| Patients | `patients.read` |
| Agenda | `appointments.read` |
| Dentistes | `dentists.read` |
| Prothèses | `patients.read` |
| Ordonnances | `prescriptions.read` |
| Stock | `stock.read` |
| Finances | `billing.read` |
| Documents | `documents.read` |
| Équipe | `team.read` |
| Tableau de bord / Paramètres | toujours visibles dans le shell (`perm: null`) |

Si une entrée n’apparaît pas : permission `*.read` manquante.

---

## 5. Paramètres du cabinet

### Où ?

**Paramètres du cabinet** / **Paramètres**.

### Sections réellement présentes (Legacy + Cloud selon mode)

1. **Identité du cabinet** — nom, adresse, téléphone, email, logo  
2. **Informations bilingues FR / AR** — champs affichés sur documents  
3. **Langue** — Français / العربية  
4. **Médicaments** — catalogue cabinet (ajout, recherche, désactivation)  
5. **Catalogue d’actes** — actes et tarifs  
6. **Licence** — état / actions liées à la licence  
7. **Sauvegarde / Restauration** (Legacy) ou **Export** (Cloud)  
8. **Mises à jour** — vérification / info version  
9. Options Cloud spécifiques si présentes (organisation)

**CONSEIL :** renseigner logo + identité FR/AR avant d’imprimer ordonnances ou rapports.

---

## 6. Sauvegarde et restauration

### Legacy

| Action | Description |
|--------|-------------|
| **Créer une sauvegarde** | Export JSON des données locales |
| **Restaurer** | Import d’un fichier de sauvegarde |

**ATTENTION :**

- Restaurer **écrase** les données locales actuelles.
- Fermer les autres opérations pendant la restauration.
- Conserver plusieurs copies hors poste.

Libellés i18n observés autour de backup / restore (Paramètres).  
**À vérifier dans l’interface :** texte exact des boutons et dialogues de confirmation sur votre build.

### Cloud

- Export / sauvegarde **orientée export** (pas un restore local « classique » comme Legacy).
- Les données font autorité côté serveur d’organisation.
- Restaurer un vieux JSON Legacy **dans** un cabinet Cloud n’est pas le parcours nominal.

**IMPORTANT :** ne pas confondre sauvegarde Legacy et export Cloud.

---

## 7. Mises à jour (auto-update)

### Comportement observé

- Notification toast si une mise à jour est disponible
- Section Paramètres liée aux mises à jour
- Installation via le mécanisme Electron auto-updater (canal GitHub releases / feed configuré)

### Conservation des données

Les mises à jour d’application **ne doivent pas** effacer la base locale Legacy ni le miroir Cloud ; toutefois :

**CONSEIL :** faire une sauvegarde Legacy (ou export Cloud) **avant** toute mise à jour majeure.

**À vérifier manuellement :** message exact du toast de mise à jour et parcours d’installation sur Windows 10/11.

---

## 8. Dentistes vs Équipe

| Module | Rôle |
|--------|------|
| **Dentistes** | Annuaire clinique (praticiens, couleurs, spécialités) |
| **Équipe** (Cloud) | Comptes de connexion, rôles, permissions |

Un dentiste dans l’annuaire **n’est pas automatiquement** un utilisateur connecté.

---

## 9. Documents Cloud (admin)

- Menu **Documents**
- Upload / consultation / suppression liés à un patient
- Nécessite `documents.read` (+ droits d’écriture pour modifier)

En Legacy, gérer l’imagerie via la fiche patient → **Imagerie**.

---

## 10. Sécurité

### Recommandations alignées sur le produit

1. Compte ADMIN unique ou limité
2. Assistants sans `billing` si non nécessaire
3. Déconnexion en fin de journée (Cloud)
4. Ne pas partager le code de licence
5. Sauvegardes régulières (Legacy)
6. Mot de passe fort pour chaque membre Équipe

### Sessions

Messages possibles : « Session expirée », « Session expirée ou invalide » → se reconnecter.

---

## 11. Différences Legacy / Cloud (admin)

| Sujet | Legacy | Cloud |
|-------|--------|-------|
| Utilisateurs | 1 poste / 1 usage | Multi-utilisateurs (Équipe) |
| Permissions | Non applicables (pas de RBAC UI) | Rôles ADMIN / ASSISTANT + overrides |
| Données | Locales | Organisation API + miroir |
| Backup | JSON backup + restore | Export ; restore local non équivalent |
| Documents page | Non | Oui |
| Offline | Travail local (licence OK) | Bloqué si API inaccessible |
| Annuaire dentistes | Oui | Oui |
| Licence Desktop | Oui | Oui |

---

## 12. Parcours administrateur recommandé

1. Installer DentiSuite  
2. Activer la licence  
3. (Cloud) Créer le cabinet / se connecter  
4. Paramètres → identité + logo + FR/AR  
5. Catalogue actes + médicaments  
6. (Cloud) Créer l’équipe et ajuster les permissions  
7. Créer les dentistes dans l’annuaire  
8. Sauvegarde / export de référence  
9. Former les utilisateurs (USER_GUIDE)

---

## 13. Points à valider manuellement

1. Liste exacte des cases de permissions dans l’écran Équipe de votre build  
2. Contenu exact de la section Licence dans Paramètres  
3. Différence visuelle Backup Legacy vs Export Cloud  
4. Qui peut accéder à Paramètres en rôle ASSISTANT (si override)
