/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { getMe, setApiAuthToken, syncAuth, updateProfile } from '../lib/api.js'
import { getBrowserCoordinates, reverseGeocodeCoordinates } from '../lib/location.js'

const SessionContext = createContext(null)
const LOCATION_SETUP_STORAGE_KEY = 'xeta:auto-location-setup:v1'
const SESSION_PROFILE_STORAGE_PREFIX = 'xeta:session-profile:v1:'

function getSessionProfileStorageKey(userId) {
  return `${SESSION_PROFILE_STORAGE_PREFIX}${userId || 'anonymous'}`
}

function readCachedProfile(userId) {
  if (!userId) {
    return null
  }

  try {
    const raw = localStorage.getItem(getSessionProfileStorageKey(userId))
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function writeCachedProfile(userId, profile) {
  if (!userId || !profile) {
    return
  }

  try {
    localStorage.setItem(getSessionProfileStorageKey(userId), JSON.stringify(profile))
  } catch {
    // Ignore localStorage write failures.
  }
}

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
  } catch {
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
  const { isLoaded, isSignedIn, getToken, userId } = useAuth()
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

      const cachedProfile = readCachedProfile(userId)
      if (cachedProfile) {
        setProfile(cachedProfile)
      } else {
        setProfile(null)
      }

      try {
        const applyToken = async (skipCache = false) => {
          console.debug('[SessionContext] Loading auth token...')
          const token = skipCache
            ? await getToken({ skipCache: true })
            : await getToken()

          setApiAuthToken(token)
          return token
        }

        await applyToken()

        let response = null

        try {
          console.debug('[SessionContext] Fetching user profile...')
          response = await getMe()
        } catch {
          // First-time accounts may not exist yet in the backend; sync and retry.
          console.debug('[SessionContext] Profile fetch failed. Syncing and retrying...')

          let recovered = false

          try {
            await syncAuth()
            response = await getMe()
            recovered = true
          } catch {
            // Continue with a fresh-token retry path.
          }

          if (!recovered) {
            await applyToken(true)
            await syncAuth()
            response = await getMe()
          }
        }

        const currentUser = normalizeUser(response.data)

        console.log('[SessionContext] Profile loaded:', {
          id: currentUser?.id,
          role: currentUser?.role,
          email: currentUser?.email,
        })

        if (active) {
          setProfile(currentUser)
          writeCachedProfile(userId, currentUser)
        }

        // Do location auto-setup in the background so session gate is not delayed.
        Promise.resolve()
          .then(() => tryAutoSetupLocation(currentUser))
          .then((updatedProfile) => {
            if (!active || !updatedProfile) {
              return
            }

            setProfile(updatedProfile)
            writeCachedProfile(userId, updatedProfile)
          })
          .catch(() => {
            // Ignore background location setup errors.
          })
      } catch {
        if (active) {
          setProfile(cachedProfile ?? null)
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
  }, [getToken, isLoaded, isSignedIn, userId])

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
      writeCachedProfile(userId, currentUser)
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