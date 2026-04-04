import './PriceSlider.css'
import { formatMoney } from '../lib/format.js'

export default function PriceSlider({ minPrice, maxPrice, setMinPrice, setMaxPrice, boundsMin = 0, boundsMax = 20000, step = 50 }) {
  const safeBoundsMin = Number.isFinite(Number(boundsMin)) ? Number(boundsMin) : 0
  const safeBoundsMax = Number.isFinite(Number(boundsMax)) ? Number(boundsMax) : safeBoundsMin
  const hasSpread = safeBoundsMax > safeBoundsMin
  const rangeSpan = Math.max(0, safeBoundsMax - safeBoundsMin)
  const safeStep = Math.max(1, Number(step) || 1)
  const sliderStep = rangeSpan > 0 ? Math.min(safeStep, rangeSpan) : 1

  const clampToBounds = (value) => Math.max(safeBoundsMin, Math.min(value, safeBoundsMax))

  const currentMin = minPrice !== '' && minPrice != null ? clampToBounds(Number(minPrice)) : safeBoundsMin
  const maxCandidate = maxPrice !== '' && maxPrice != null ? clampToBounds(Number(maxPrice)) : safeBoundsMax
  const currentMax = clampToBounds(Math.max(maxCandidate, currentMin))

  const handleMinChange = (e) => {
    if (!hasSpread) {
      return
    }

    // Prevent the left thumb from crossing the right thumb
    const value = Math.min(Number(e.target.value), currentMax - sliderStep)
    const safeValue = clampToBounds(value)

    setMinPrice(String(safeValue))
  }

  const handleMaxChange = (e) => {
    if (!hasSpread) {
      return
    }

    // Prevent the right thumb from crossing the left thumb
    const value = Math.max(Number(e.target.value), currentMin + sliderStep)
    const safeValue = clampToBounds(value)

    setMaxPrice(String(safeValue))
  }

  // Prevent sliding out of absolute bounds accidentally
  const safeLocalMin = currentMin
  const safeLocalMax = currentMax

  const denominator = Math.max(1, safeBoundsMax - safeBoundsMin)
  const percentMin = ((safeLocalMin - safeBoundsMin) / denominator) * 100
  const percentMax = ((safeLocalMax - safeBoundsMin) / denominator) * 100

  const formatCompact = (num) => formatMoney(num)

  return (
    <div className="price-slider-container">
      <div className="price-slider-labels">
        <span className="caption">Price Range</span>
        <span className="price-slider-values">
          {formatCompact(safeLocalMin)} - {formatCompact(safeLocalMax)}
        </span>
      </div>
      <div className="price-slider-track">
        <div
          className="price-slider-range"
          style={{
            left: `${percentMin}%`,
            right: `${100 - percentMax}%`,
          }}
        />
        <input
          type="range"
          min={safeBoundsMin}
          max={safeBoundsMax}
          step={sliderStep}
          value={safeLocalMin}
          onChange={handleMinChange}
          className="price-slider-thumb"
          aria-label="Minimum price"
          aria-valuetext={formatCompact(safeLocalMin)}
          disabled={!hasSpread}
        />
        <input
          type="range"
          min={safeBoundsMin}
          max={safeBoundsMax}
          step={sliderStep}
          value={safeLocalMax}
          onChange={handleMaxChange}
          className="price-slider-thumb"
          aria-label="Maximum price"
          aria-valuetext={formatCompact(safeLocalMax)}
          disabled={!hasSpread}
        />
      </div>
    </div>
  )
}
