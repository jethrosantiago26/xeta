export function getBrowserCoordinates(options = {}) {
  const config = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    ...options,
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => reject(error),
      config,
    )
  })
}

export async function reverseGeocodeCoordinates({ latitude, longitude }) {
  const endpoint = new URL('https://nominatim.openstreetmap.org/reverse')
  endpoint.searchParams.set('lat', String(latitude))
  endpoint.searchParams.set('lon', String(longitude))
  endpoint.searchParams.set('format', 'jsonv2')
  endpoint.searchParams.set('addressdetails', '1')

  const response = await fetch(endpoint.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })
  const payload = await response.json()

  if (!response.ok || !payload?.address) {
    throw new Error('Failed to reverse geocode the coordinates.')
  }

  const address = payload.address

  const city = address.city || address.town || address.village || address.municipality || ''
  const state = address.state || address.region || ''
  const country = address.country || ''
  const countryCode = (address.country_code || '').toUpperCase()
  const postalCode = address.postcode || ''

  return {
    city,
    state,
    country,
    country_code: countryCode,
    postal_code: postalCode,
    formatted_address: payload.display_name || '',
  }
}

export async function searchAddressSuggestions(query, limit = 5) {
  const trimmed = String(query || '').trim()

  if (!trimmed) {
    return []
  }

  const cappedLimit = Math.max(1, Math.min(limit, 8))

  try {
    const endpoint = new URL('https://nominatim.openstreetmap.org/search')
    endpoint.searchParams.set('q', trimmed)
    endpoint.searchParams.set('format', 'jsonv2')
    endpoint.searchParams.set('addressdetails', '1')
    endpoint.searchParams.set('limit', String(cappedLimit))

    const response = await fetch(endpoint.toString(), {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Primary address provider failed.')
    }

    const payload = await response.json()

    if (!Array.isArray(payload)) {
      return []
    }

    return payload.map((item) => {
      const address = item.address || {}
      const city = address.city || address.town || address.village || address.municipality || ''
      const state = address.state || address.region || ''
      const postalCode = address.postcode || ''
      const countryCode = (address.country_code || '').toUpperCase()

      return {
        id: `osm-${item.place_id}`,
        label: item.display_name || '',
        latitude: Number(item.lat),
        longitude: Number(item.lon),
        city,
        state,
        postal_code: postalCode,
        country_code: countryCode,
      }
    })
  } catch {
    const fallback = new URL('https://photon.komoot.io/api/')
    fallback.searchParams.set('q', trimmed)
    fallback.searchParams.set('limit', String(cappedLimit))

    const response = await fetch(fallback.toString(), {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Address search request failed.')
    }

    const payload = await response.json()
    const features = Array.isArray(payload?.features) ? payload.features : []

    return features.map((feature, index) => {
      const props = feature.properties || {}
      const coords = feature.geometry?.coordinates || []
      const lon = Number(coords[0])
      const lat = Number(coords[1])

      return {
        id: `photon-${props.osm_id || index}`,
        label: [props.name, props.street, props.city, props.state, props.country]
          .filter(Boolean)
          .join(', '),
        latitude: lat,
        longitude: lon,
        city: props.city || props.county || '',
        state: props.state || '',
        postal_code: props.postcode || '',
        country_code: String(props.countrycode || '').toUpperCase(),
      }
    })
  }
}
