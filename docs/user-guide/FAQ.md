# DentiSuite — FAQ

**Version :** Desktop 3.4.0 / API 3.1.2  

Réponses basées uniquement sur le comportement observé dans le code / l’UI. Si non certain : « À vérifier dans l’interface. »

---

### Quelle est la différence entre Legacy et Cloud ?

**Legacy :** données sur le poste, licence Desktop, pas d’équipe multi-comptes.  
**Cloud :** données d’organisation via API, utilisateurs Équipe, permissions, page Documents ; licence Desktop toujours requise.

---

### Puis-je travailler sans Internet ?

**Legacy :** oui pour le métier local, sauf états licence exigeant une vérification en ligne.  
**Cloud :** non si le serveur API est inaccessible (écran d’indisponibilité).

---

### Comment activer ma licence ?

Écran **Activation de votre licence** → License ID + code d’activation → **Activer la licence**.

---

### La licence est déjà utilisée sur un autre PC. Que faire ?

Message : « Cette licence est déjà activée sur un autre ordinateur. » Contacter le support ; ou **Utiliser une autre licence**.

---

### Comment changer la langue ?

Paramètres → Langue → Français ou العربية.  
**Note :** certaines pages Cloud (sidebar, login, équipe, documents) restent en français fixe.

---

### Où gérer le catalogue de médicaments ?

Paramètres → section **Médicaments** (pas d’entrée de menu principale dédiée).

---

### Comment archiver un patient ?

Liste Patients → **Archiver** → confirmer. Toast « Patient archivé ».

---

### Comment restaurer un patient archivé ?

La restauration technique existe, **mais aucune action Restaurer n’est visible dans la liste Patients actuelle**.  
→ **À vérifier dans l’interface** / procédure support.

---

### Que fait Ctrl+K ?

Ouvre la **recherche globale** (patients, RDV, ordonnances, factures, prothèses, dentistes, médicaments). Exclut les patients archivés de la recherche patients.

---

### Pourquoi je ne vois pas le menu Finances / Documents / Équipe ?

En Cloud, les menus sont filtrés par permissions. Ex. pas de `billing.read` → pas Finances ; pas de Documents / Équipe hors droits admin typiques.

---

### Quelle est la différence entre Dentistes et Équipe ?

**Dentistes** = annuaire clinique. **Équipe** (Cloud) = comptes de connexion et permissions.

---

### Les assistants peuvent-ils facturer ?

Par défaut, le rôle **ASSISTANT** n’inclut généralement pas la facturation. Un admin peut éventuellement ajouter des overrides — **À vérifier dans l’écran Équipe**.

---

### Que signifie le toast « Ce patient a été modifié sur un autre poste… » ?

Conflit / mise à jour concurrente Cloud : les données ont été rechargées depuis le serveur.

---

### Quelle taille max pour une image patient ?

**80 Mo** (JPG / PNG / DICOM) — message d’erreur si dépassé.

---

### La devise est-elle configurable ?

L’affichage utilise **DA**. Pas de sélecteur de devise multi-monnaie observé dans l’UI.

---

### Comment sauvegarder ?

**Legacy :** Paramètres → créer sauvegarde JSON ; restauration depuis fichier.  
**Cloud :** export / mécanismes Cloud — pas un restore local identique à Legacy.

---

### Les mises à jour effacent-elles mes données ?

Non conçu pour effacer ; **CONSEIL :** sauvegarder / exporter avant une mise à jour majeure.  
Comportement exact du toast update : **À vérifier dans l’interface**.

---

### Pourquoi Windows bloque l’installateur ?

Les builds peuvent être **non signés** Authenticode → SmartScreen. Valider la source (éditeur / canal officiel).

---

### Puis-je utiliser DentiSuite sur plusieurs postes en Legacy ?

Chaque poste a ses données locales. Le partage multi-poste temps réel est le mode **Cloud**.

---

### Où voir la version installée ?

Paramètres / zone mises à jour. Emplacement exact du numéro **3.4.0** : **À vérifier dans l’interface**.
