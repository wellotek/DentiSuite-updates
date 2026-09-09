export const OPEN_PRODUCT_DECISIONS = [
  {
    id: 'walk-in-invoice',
    title: 'Walk-in invoice policy',
    currentPolicy: 'SKIP (Cloud Invoice requires patientId)',
    status: 'UNRESOLVED' as const,
  },
  {
    id: 'walk-in-prescription',
    title: 'Walk-in prescription policy',
    currentPolicy: 'SKIP (Cloud Prescription requires patientId)',
    status: 'UNRESOLVED' as const,
  },
  {
    id: 'empty-phone',
    title: 'Empty phone policy',
    currentPolicy: 'ERROR in strict mode; never invent a phone',
    status: 'UNRESOLVED' as const,
  },
  {
    id: 'settings-migration',
    title: 'ClinicSettings migration',
    currentPolicy: 'DEFERRED. Optional settings.name → Organization.name only if --copy-organization-name (default off, no overwrite)',
    status: 'UNRESOLVED' as const,
  },
  {
    id: 'act-catalog-migration',
    title: 'ActCatalog migration',
    currentPolicy: 'DEFERRED. Treatment.act / code / actId preserved as opaque values; catalog rows are not imported',
    status: 'UNRESOLVED' as const,
  },
] as const;
