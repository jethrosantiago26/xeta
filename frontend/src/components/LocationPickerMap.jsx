import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
    },
  })

  return null
}

function MapRecenter({ center, zoom }) {
  const map = useMap()

  useEffect(() => {
    map.flyTo(center, zoom, { animate: false })

    // Ensure tile/layout sync after coordinate changes from external form updates.
    const resizeTimer = setTimeout(() => {
      map.invalidateSize()
    }, 0)

    return () => clearTimeout(resizeTimer)
  }, [center, map, zoom])

  return null
}

function LocationPickerMap({ latitude, longitude, onSelect }) {
  const [fallbackCenter, setFallbackCenter] = useState([12.8797, 121.7740])
  const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude)
  const center = hasLocation ? [latitude, longitude] : fallbackCenter

  const markerIcon = useMemo(() => L.divIcon({
    className: 'xeta-marker-wrap',
    html: '<span class="xeta-marker-pin" aria-hidden="true"></span>',
    iconSize: [24, 34],
    iconAnchor: [12, 34],
  }), [])

  useEffect(() => {
    if (hasLocation || !navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFallbackCenter([
          position.coords.latitude,
          position.coords.longitude,
        ])
      },
      () => {
        // Keep Philippines center fallback when location permission is denied.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    )
  }, [hasLocation])

  return (
    <MapContainer
      center={center}
      zoom={hasLocation ? 14 : 6}
      className="leaflet-map"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapRecenter center={center} zoom={hasLocation ? 14 : 6} />
      <ClickHandler onSelect={onSelect} />
      {hasLocation ? <Marker position={[latitude, longitude]} icon={markerIcon} /> : null}
    </MapContainer>
  )
}

export default LocationPickerMap
