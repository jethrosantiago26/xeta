const NAMED_COLOR_HEX = {
  black: '#1f2937',
  graphite: '#374151',
  silver: '#9ca3af',
  white: '#f4f7ff',
  red: '#ef4444',
  blue: '#2563eb',
  green: '#16a34a',
  yellow: '#f59e0b',
  orange: '#ea580c',
  purple: '#7c3aed',
  pink: '#ec4899',
  teal: '#0d9488',
  cyan: '#0891b2',
  gold: '#ca8a04',
  brown: '#92400e',
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function hashString(value) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function hslToHex(hue, saturation, lightness) {
  const s = clamp(saturation, 0, 100) / 100
  const l = clamp(lightness, 0, 100) / 100
  const hueNormalized = ((hue % 360) + 360) % 360

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((hueNormalized / 60) % 2 - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (hueNormalized < 60) {
    r = c
    g = x
  } else if (hueNormalized < 120) {
    r = x
    g = c
  } else if (hueNormalized < 180) {
    g = c
    b = x
  } else if (hueNormalized < 240) {
    g = x
    b = c
  } else if (hueNormalized < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const red = Math.round((r + m) * 255)
  const green = Math.round((g + m) * 255)
  const blue = Math.round((b + m) * 255)

  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function normalizeHex(hexValue) {
  if (typeof hexValue !== 'string') {
    return ''
  }

  const trimmed = hexValue.trim().toLowerCase()

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const [, red, green, blue] = trimmed
    return `#${red}${red}${green}${green}${blue}${blue}`
  }

  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return trimmed
  }

  return ''
}

function hexToRgb(hexValue) {
  const normalized = normalizeHex(hexValue)

  if (!normalized) {
    return null
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function mixHex(leftHex, rightHex, leftWeight = 0.5) {
  const leftRgb = hexToRgb(leftHex)
  const rightRgb = hexToRgb(rightHex)

  if (!leftRgb || !rightRgb) {
    return leftHex
  }

  const weight = clamp(leftWeight, 0, 1)
  const rightWeight = 1 - weight

  const red = Math.round(leftRgb.r * weight + rightRgb.r * rightWeight)
  const green = Math.round(leftRgb.g * weight + rightRgb.g * rightWeight)
  const blue = Math.round(leftRgb.b * weight + rightRgb.b * rightWeight)

  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function getRelativeLuminance(hexValue) {
  const rgb = hexToRgb(hexValue)

  if (!rgb) {
    return 0
  }

  const linearized = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const normalized = channel / 255
    if (normalized <= 0.03928) {
      return normalized / 12.92
    }

    return ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * linearized[0] + 0.7152 * linearized[1] + 0.0722 * linearized[2]
}

function getAccessibleTextColor(backgroundHex) {
  const luminance = getRelativeLuminance(backgroundHex)
  return luminance > 0.5 ? '#111111' : '#ffffff'
}

function extractNamedColor(text) {
  if (typeof text !== 'string') {
    return ''
  }

  const normalizedText = text.toLowerCase()
  const keys = Object.keys(NAMED_COLOR_HEX)

  for (const key of keys) {
    if (normalizedText.includes(key)) {
      return NAMED_COLOR_HEX[key]
    }
  }

  return ''
}

function resolveBaseColor(variant, index) {
  const attributeColor = normalizeHex(
    variant?.color_hex
      || variant?.colour_hex
      || variant?.hex
      || variant?.attributes?.color_hex
      || variant?.attributes?.colour_hex
      || variant?.attributes?.hex
      || '',
  )

  if (attributeColor) {
    return attributeColor
  }

  const namedColor = extractNamedColor(
    `${variant?.name || ''} ${variant?.color || ''} ${variant?.colour || ''} ${variant?.attributes?.color || ''} ${variant?.attributes?.colour || ''}`,
  )

  if (namedColor) {
    return namedColor
  }

  const seed = hashString(`${variant?.id || ''}:${variant?.sku || ''}:${variant?.name || ''}:${index}`)
  const hue = seed % 360
  const saturation = 64 + (seed % 12)
  const lightness = 48 + ((seed >> 3) % 8)

  return hslToHex(hue, saturation, lightness)
}

function resolveImageFromPayload(variant) {
  const candidates = [
    variant?.image_url,
    variant?.image?.url,
    typeof variant?.image === 'string' ? variant.image : '',
    variant?.attributes?.image_url,
    variant?.attributes?.image,
    variant?.attributes?.preview_image,
  ]

  return candidates.find((value) => typeof value === 'string' && value.trim() !== '') || ''
}

function escapeXml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function createVariantImageDataUri({ productName, variantName, color }) {
  const tint = mixHex(color, '#ffffff', 0.72)
  const shade = mixHex(color, '#0b1020', 0.6)
  const soft = mixHex(color, '#dde6ff', 0.35)
  const deeper = mixHex(color, '#020617', 0.42)
  const ring = mixHex(color, '#ffffff', 0.5)
  const productLabel = escapeXml(productName || 'XETA')
  const variantLabel = escapeXml(variantName || 'Variant')

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 900' role='img' aria-label='${productLabel} ${variantLabel}'><defs><linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${tint}'/><stop offset='100%' stop-color='${shade}'/></linearGradient><linearGradient id='panel' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${soft}' stop-opacity='0.9'/><stop offset='100%' stop-color='${deeper}' stop-opacity='0.82'/></linearGradient><linearGradient id='device' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#f8fbff' stop-opacity='0.92'/><stop offset='100%' stop-color='${ring}' stop-opacity='0.78'/></linearGradient><filter id='shadow' x='-20%' y='-20%' width='140%' height='160%'><feDropShadow dx='0' dy='24' stdDeviation='22' flood-opacity='0.22'/></filter></defs><rect x='24' y='24' width='1152' height='852' rx='64' fill='url(#bg)'/><g filter='url(#shadow)'><rect x='120' y='158' width='960' height='584' rx='52' fill='url(#panel)'/><rect x='220' y='258' width='760' height='190' rx='34' fill='url(#device)'/><rect x='260' y='292' width='682' height='30' rx='12' fill='${color}' fill-opacity='0.55'/><g fill='${deeper}' fill-opacity='0.34'><rect x='268' y='336' width='72' height='28' rx='9'/><rect x='350' y='336' width='72' height='28' rx='9'/><rect x='432' y='336' width='72' height='28' rx='9'/><rect x='514' y='336' width='72' height='28' rx='9'/><rect x='596' y='336' width='72' height='28' rx='9'/><rect x='678' y='336' width='72' height='28' rx='9'/><rect x='760' y='336' width='72' height='28' rx='9'/><rect x='842' y='336' width='92' height='28' rx='9'/></g><g><ellipse cx='428' cy='568' rx='186' ry='102' fill='url(#device)'/><ellipse cx='428' cy='568' rx='126' ry='68' fill='${color}' fill-opacity='0.5'/></g><g><rect x='620' y='496' width='302' height='148' rx='64' fill='url(#device)'/><circle cx='698' cy='570' r='22' fill='${color}' fill-opacity='0.64'/><circle cx='842' cy='570' r='22' fill='${color}' fill-opacity='0.64'/></g></g></svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function getVariantVisual(variant, { index = 0, productName = '' } = {}) {
  const baseColor = resolveBaseColor(variant, index)
  const ringColor = mixHex(baseColor, '#ffffff', 0.55)
  const textColor = getAccessibleTextColor(baseColor)
  const imageFromPayload = resolveImageFromPayload(variant)

  return {
    color: baseColor,
    ringColor,
    textColor,
    image: imageFromPayload || createVariantImageDataUri({
      productName,
      variantName: variant?.name,
      color: baseColor,
    }),
  }
}
