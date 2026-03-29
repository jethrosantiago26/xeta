import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { getMe, setApiAuthToken, syncAuth, updateProfile } from '../lib/api.js'
import { getBrowserCoordinates, reverseGeocodeCoordinates } from '../lib/location.js'

const SessionContext = createContext(null)
const LOCATION_SETUP_STORAGE_KEY = 'xeta:auto-location-setup:v1'

function hasSavedLocation(profile) {
  return Boolean(
    profile?.location_name
      || profile?.city
      || profile?.latitude
      || profile?.longitude,
  )
}

async function tryAutoSetupLocation(profile) {
  if (!profile || profile.role === 'admin' || hasSavedLocation(profile)) {
    return profile
  }

  const identity = profile.clerk_id || profile.id
  const markerKey = `${LOCATION_SETUP_STORAGE_KEY}:${identity}`
  const markerValue = localStorage.getItem(markerKey)

  if (markerValue === 'done' || markerValue === 'blocked') {
    return profile
  }

  try {
    const { latitude, longitude } = await getBrowserCoordinates()
    const location = await reverseGeocodeCoordinates({ latitude, longitude })

    await updateProfile({
      name: profile.name,
      city: location.city,
      state: location.state,
      postal_code: location.postal_code,
      country: (location.country_code || profile.country || 'PH').toUpperCase(),
      timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      location_name: location.formatted_address || location.city || profile.location_name || '',
      latitude: latitude.toFixed(7),
      longitude: longitude.toFixed(7),
      location_source: 'browser_geolocation',
    })

    const refreshed = await getMe()
    localStorage.setItem(markerKey, 'done')
    return normalizeUser(refreshed.data)
  } catch (error) {
    localStorage.setItem(markerKey, 'blocked')
    return profile
  }
}

function normalizeUser(payload) {
  if (!payload) {
    return null
  }

  if (payload.data) {
    return payload.data
  }

  if (payload.user) {
    return payload.user.data ?? payload.user
  }

  return payload
}

export function SessionProvider({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadSession() {
      if (!isLoaded) {
        return
      }

      if (!isSignedIn) {
        setApiAuthToken(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const token = await getToken({ skipCache: true })
        setApiAuthToken(token)
        try {
          await syncAuth()
        } catch {
          // Continue with getMe so existing users can still load their profile.
        }
        const response = await getMe()
        let currentUser = normalizeUser(response.data)
        currentUser = await tryAutoSetupLocation(currentUser)

        if (active) {
          setProfile(currentUser)
        }
      } catch (error) {
        if (active) {
          setProfile(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      active = false
    }
  }, [getToken, isLoaded, isSignedIn])

  const value = {
    profile,
    loading,
    isLoaded,
    isSignedIn,
    refreshProfile: async () => {
      if (!isSignedIn) {
        return null
      }

      const token = await getToken({ skipCache: true })
      setApiAuthToken(token)
      const response = await getMe()
      const currentUser = normalizeUser(response.data)
      setProfile(currentUser)
      return currentUser
    },
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)

  if (!context) {
    return {
      profile: null,
      loading: false,
      isLoaded: false,
      isSignedIn: false,
      refreshProfile: async () => null,
    }
  }

  return context
}