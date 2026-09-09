const MSG = {
  invalid: "Identifiant de licence ou code d'activation incorrect.",
  notFound: 'Licence introuvable.',
  already: 'Cette licence est déjà activée sur un autre ordinateur.',
  limit: "Cette licence a atteint le nombre maximum d'activations autorisées.",
  revoked: "Votre licence DentiSuite n'est plus valide.",
  expired: 'Cette licence a expiré.',
  product: 'Cette licence ne correspond pas au produit DentiSuite.',
  network: "Impossible de contacter le serveur d'activation. Vérifiez votre connexion Internet.",
  online: 'Une vérification de licence est nécessaire. Connectez DentiSuite à Internet pour continuer.',
  rate: 'Trop de tentatives. Réessayez dans quelques instants.',
}

function bodyText(body) {
  if (!body) return ''
  if (typeof body === 'string') return body
  try {
    return JSON.stringify(body)
  } catch {
    return ''
  }
}

function classify(body, status) {
  const text = `${bodyText(body)} ${status}`.toLowerCase()
  if (
    text.includes('maximum activation limit') ||
    text.includes('activation limit') ||
    text.includes('max_activation') ||
    text.includes('max activation') ||
    text.includes('users exceeded') ||
    text.includes('user limit') ||
    text.includes('seats') ||
    text.includes('nombre d')
  ) {
    return 'limit'
  }
  if (
    text.includes('wrong product') ||
    text.includes('product mismatch') ||
    text.includes('invalid product') ||
    text.includes('produit') ||
    text.includes('vetosuite') ||
    text.includes('wellotek') ||
    text.includes('rentcar')
  ) {
    return 'product'
  }
  if (
    text.includes('expired') ||
    text.includes('expir') ||
    text.includes('caduque')
  ) {
    return 'expired'
  }
  if (
    text.includes('already') ||
    text.includes('autre ordinateur') ||
    text.includes('another') ||
    text.includes('in_use') ||
    status === 409
  ) {
    return 'already'
  }
  if (
    text.includes('revok') ||
    text.includes('inactive') ||
    text.includes('suspend') ||
    text.includes('disabled') ||
    text.includes("n'est plus")
  ) {
    return 'revoked'
  }
  if (text.includes('not found') || text.includes('introuvable') || text.includes('unknown license')) {
    return 'notFound'
  }
  if (
    text.includes('invalid') ||
    text.includes('incorrect') ||
    text.includes('unknown')
  ) {
    return 'invalid'
  }
  return null
}

function mapHttpError(status, body, fallback) {
  if (status === 429) return MSG.rate
  if (status === 408 || status === 500 || status === 502 || status === 503 || status === 0) return MSG.network
  const kind = classify(body, status)
  if (kind === 'limit') return MSG.limit
  if (kind === 'product') return MSG.product
  if (kind === 'expired') return MSG.expired
  if (kind === 'already') return MSG.already
  if (kind === 'revoked') return MSG.revoked
  if (kind === 'notFound') return MSG.notFound
  if (kind === 'invalid' || status === 401 || status === 403 || status === 404) {
    if (status === 404) return MSG.notFound
    return MSG.invalid
  }
  return fallback || MSG.invalid
}

function isNetworkError(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  const code = error && error.code ? String(error.code) : ''
  return (
    /timeout|timed out|délai|enotfound|econnrefused|econnreset|enetunreach|eai_again|offline|network/i.test(
      `${message} ${code}`,
    ) || code.startsWith('ERR_')
  )
}

module.exports = { MSG, mapHttpError, isNetworkError, classify }
