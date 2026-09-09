/** Runtime flag: Zustand clinic mirror is backed by Cloud API (no local JSON persist). */
let cloudClinicMode = false

export function setCloudClinicMode(enabled: boolean) {
  cloudClinicMode = Boolean(enabled)
}

export function isCloudClinicMode(): boolean {
  return cloudClinicMode
}
