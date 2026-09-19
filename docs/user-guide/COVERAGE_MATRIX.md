# Matrice de couverture — Documentation DentiSuite

**Version documentée :** Desktop 3.4.0 · API Cloud 3.1.2  

Légende STATUS : `COMPLETE` | `PARTIAL` | `MISSING_UI` | `VERIFY`

| FEATURE | DOCUMENTED | SCREENSHOT REQUIRED | ROLE | LEGACY | CLOUD | STATUS |
|---------|------------|---------------------|------|--------|-------|--------|
| Licence activation | YES | YES (003) | all | yes | yes | COMPLETE |
| Bootstrap cabinet Cloud | YES | YES (002) | ADMIN | no | yes | COMPLETE |
| Login / logout Cloud | YES | YES (001) | all Cloud | no | yes | COMPLETE |
| Sidebar Legacy | YES | YES (004) | all | yes | no | COMPLETE |
| Sidebar Cloud + perms | YES | YES (005) | filtered | no | yes | COMPLETE |
| Dashboard | YES | YES (006) | all | yes | yes | COMPLETE |
| Patients list/create/edit | YES | YES (007) | patients.* | yes | yes | COMPLETE |
| Patient soft archive | YES | YES (025) | patients.delete | yes | yes | COMPLETE |
| Patient restore UI | YES (limitation) | — | — | engine only | API only | MISSING_UI |
| PatientChart Soins/odontogramme | YES | YES (008) | patients / consultations | yes | yes | COMPLETE |
| PatientChart Séances | YES | YES (009) | consultations | yes | yes | COMPLETE |
| PatientChart Imagerie | YES | YES (010) | imaging | yes | yes | COMPLETE |
| Patient context bar | YES | YES (011) | all | yes | yes | COMPLETE |
| Agenda RDV | YES | YES (012) | appointments.* | yes | yes | COMPLETE |
| Ordonnances | YES | YES (013) | prescriptions.* | yes | yes | COMPLETE |
| Catalogue médicaments | YES | YES (014) | settings | yes | yes | COMPLETE |
| Prothèses | YES | YES (015) | patients.read (nav Cloud) | yes | yes | COMPLETE |
| Stock | YES | YES (016) | stock.* | yes | yes | COMPLETE |
| Finances / billing | YES | YES (017) | billing.* | yes | yes | COMPLETE |
| Documents Cloud | YES | YES (018) | documents.* | no | yes | COMPLETE |
| Dentistes annuaire | YES | YES (019) | dentists.* | yes | yes | COMPLETE |
| Équipe / RBAC | YES | YES (020) | team.* / ADMIN | no | yes | COMPLETE |
| Paramètres cabinet | YES | YES (021) | settings (Cloud) | yes | yes | COMPLETE |
| Backup/restore Legacy | YES | YES (021) | admin local | yes | no | COMPLETE |
| Export Cloud | YES | YES (021) | admin | no | yes | PARTIAL |
| Global search Ctrl+K | YES | YES (022) | all | yes | yes | COMPLETE |
| Cloud sync / conflicts | YES | YES (023–024) | Cloud users | no | yes | COMPLETE |
| Auto-update | YES | YES (026) | all | yes | yes | VERIFY |
| i18n FR/AR | YES (limites) | — | all | yes | partial UI | PARTIAL |
| Offline Legacy | YES | — | all | yes | n/a | COMPLETE |
| Offline Cloud | YES (blocked) | YES (023) | all | n/a | yes | COMPLETE |
| Permissions vocabulary | YES | — | ADMIN | n/a | yes | COMPLETE |
| CloudProbe / dev screens | NO (hors manuel user) | — | — | — | — | N/A |
| Migration pilot tools | NO (hors manuel user) | — | ops | — | — | N/A |

## Synthèse

| Indicateur | Valeur |
|------------|--------|
| Modules métier principaux documentés | Oui |
| Limitation majeure signalée | Restauration patient sans UI |
| Captures planifiées | 26 |
| Points VERIFY / manuels | Voir DOCUMENTATION_AUDIT_REPORT.md |
