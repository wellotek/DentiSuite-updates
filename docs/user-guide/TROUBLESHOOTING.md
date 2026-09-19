# DentiSuite — Résolution des problèmes

**Version :** Desktop 3.4.0 / API 3.1.2  

Pour chaque entrée : **Message** (si connu) · **Cause** · **Que faire**.  
Aucun message inventé.

---

## 1. Licence

### Identifiants incorrects

**Message :** Identifiant de licence ou code d’activation incorrect.  
**Cause :** License ID ou code erroné.  
**Que faire :** Vérifier la saisie ; contacter le support si le problème persiste.

### Licence déjà liée

**Message :** Cette licence est déjà activée sur un autre ordinateur.  
**Cause :** Activation liée à une autre machine.  
**Que faire :** Support ; ou **Utiliser une autre licence**.

### Licence non valide

**Message :** Votre licence DentiSuite n’est plus valide.  
**Cause :** Révocation / invalidité.  
**Que faire :** Contacter le support.

### Serveur de licence injoignable

**Message :** Impossible de contacter le serveur de licence.  
**Cause :** Réseau, firewall, serveur.  
**Que faire :** Vérifier Internet ; **Réessayer**.

### Vérification online requise

**Message :** Une vérification de licence est nécessaire. Connectez DentiSuite à Internet…  
**Cause :** État licence offline / revalidation.  
**Que faire :** Se connecter à Internet puis réessayer.

---

## 2. Connexion Cloud

### Serveur inaccessible

**Message :** Serveur Cloud inaccessible (réseau)  
**Cause :** API down, DNS, réseau, mauvaise URL API.  
**Que faire :** Vérifier la connexion ; attendre ; contacter l’admin / support. Pas de bascule Legacy automatique.

### Session expirée

**Message :** Session expirée (401) / Session expirée ou invalide (401)  
**Cause :** Token / session invalide.  
**Que faire :** Se reconnecter (écran **Connexion au cabinet**).

### Identifiants login

**Message :** Identifiants invalides  
**Cause :** username/email ou mot de passe incorrect.  
**Que faire :** Vérifier les identifiants ; demander reset à l’admin Équipe.

### Licence siège / cabinet (Cloud)

| Message | Cause | Que faire |
|---------|-------|-----------|
| Limite de sièges licence atteinte | `LICENSE_SEAT_LIMIT` | Contacter le support / libérer un siège |
| Licence cabinet expirée ou inactive | `LICENSE_EXPIRED` / `LICENSE_INACTIVE` | Contacter le support |
| Permission refusée (403) | Droit manquant | Admin → Équipe → permissions |

---

## 3. Synchronisation Cloud

### Connexion interrompue

**Message :** Connexion Cloud interrompue.  
**Cause :** Coupure réseau / API pendant l’usage.  
**Que faire :** Vérifier le réseau ; recharger / se reconnecter.

### Conflit patient multi-poste

**Message :** Ce patient a été modifié sur un autre poste. Les données ont été actualisées.  
**Cause :** Écriture concurrente.  
**Que faire :** Relire la fiche ; ressaisir si une modification locale a été perdue.

---

## 4. Patients

### Impossible d’archiver / modifier

**Cause (Cloud) :** permission manquante (`patients.update` / `patients.delete`).  
**Que faire :** Demander à l’admin d’ajuster le rôle / overrides.

### Patient introuvable après archive

**Cause :** soft-archive (exclu listes et recherche).  
**Que faire :** Pas de Restaurer UI actuellement — **À vérifier** procédure admin/support.

### Fiche non accessible

**Cause :** ID invalide, patient archivé, droits, sync.  
**Que faire :** Retour liste ; Ctrl+K ; vérifier permissions.

---

## 5. Imagerie

### Fichier trop volumineux

**Cause :** fichier > **80 Mo**.  
**Que faire :** Compresser / réduire ; formats JPG, PNG, DICOM.

### Format non supporté

**Cause :** extension hors JPG / PNG / DICOM.  
**Que faire :** Convertir le fichier.

---

## 6. Impression

### Ordonnance / rapport ne s’imprime pas

**Cause :** pilote imprimante, aperçu système, fenêtre bloquée.  
**Que faire :** Vérifier imprimante Windows ; réessayer depuis l’écran d’impression de l’app.

**À vérifier dans l’interface :** messages d’erreur d’impression spécifiques (s’ils existent).

---

## 7. Sauvegarde / restauration (Legacy)

### Restauration échouée

**Cause :** fichier corrompu, mauvaise version, interruption.  
**Que faire :** Reprendre une autre copie ; ne pas restaurer un export Cloud comme backup Legacy sans validation.

**ATTENTION :** une restauration réussie remplace les données locales.

### Où est mon backup Cloud ?

**Cause :** le Cloud n’offre pas le même restore fichier que Legacy.  
**Que faire :** Utiliser l’export Cloud prévu ; s’appuyer sur les données serveur.

---

## 8. Mises à jour

### SmartScreen bloque l’installateur / la MAJ

**Cause :** build non signé Authenticode possible.  
**Que faire :** Confirmer la source officielle ; procéder selon politique IT du cabinet.

### Après MAJ, données absentes

**Cause rare :** mauvais profil utilisateur Windows, mauvaise installation côte à côte.  
**Que faire :** Restaurer backup Legacy ; vérifier qu’on ouvre la même installation ; support.

---

## 9. Permissions / menus manquants

**Cause :** rôle ASSISTANT ou overrides ; menus filtrés (`*.read`).  
**Que faire :** Admin → Équipe → ajuster permissions ; se reconnecter.

---

## 10. Stock / Finances / Agenda — erreurs génériques

En cas d’échec d’enregistrement, l’UI affiche souvent un toast d’erreur générique ou un message API.

**Que faire :**

1. Vérifier la connexion (Cloud)
2. Vérifier les permissions
3. Réessayer
4. Noter le message exact pour le support

**À vérifier dans l’interface :** recenser les toasts d’erreur exacts module par module lors des tests QA.

---

## Actions recommandées (checklist support)

1. Mode Legacy ou Cloud ?  
2. Version Desktop affichée ?  
3. Message d’erreur **exact** (copier-coller)  
4. Capture d’écran  
5. Compte / rôle (Cloud)  
6. Heure de l’incident  
7. Backup / export récent disponible ?
