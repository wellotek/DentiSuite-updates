# Nomenclature officielle — ne pas modifier ces fichiers

Source : Ministère de l’Industrie Pharmaceutique (Algérie)  
Page : https://www.miph.gov.dz/fr/nomenclature-nationale-des-produits-pharmaceutiques/  
Fichier : `clean_NOMENCLATURE.VERSION.AOUT_.2026-.xlsx`  
Version : Août 2026 (publiée sur le site du ministère)

Réimport DentiSuite :

```bash
npm run medications:import-miph
```

Le script lit ce XLSX (inchangé) et régénère `src/data/miph-nomenclature-aout-2026.json`.
