# Design System: Precision Editorial

## 1. Overview & Creative North Star

### The Creative North Star: "Precision Engineering"
This design system moves beyond the standard "gamer" aesthetic to embrace a high-end, editorial experience that mirrors the technical sophistication of professional gaming hardware. We are not just building a store; we are creating a digital showroom. 

The system breaks away from the generic ecommerce template by utilizing **intentional asymmetry** and **tonal depth**. By combining the industrial rigidity of high-performance gear with a sophisticated, minimalist layout, we create an environment where products are treated as masterpieces. We prioritize heavy "dark space" to let the precision of the hardware shine, using high-contrast typography scales to guide the user through a curated technical narrative.

---

## 2. Colors

The palette is anchored in deep blacks and tectonic grays, punctuated by high-chroma accents that signify performance and energy.

### Color Tokens (Material Design Convention)
*   **Background / Surface:** `#131313` (The deep void of the interface)
*   **Primary (Accent):** `#F3CBC1` (A soft, technical peach for key highlights)
*   **Secondary:** `#808BA7` (Cool-toned slate for technical meta-data)
*   **Surface Container Tiers:** 
    *   `Lowest (#0E0E0E)` | `Low (#1B1C1C)` | `High (#2A2A2A)` | `Highest (#353535)`

### The "No-Line" Rule
To maintain a premium, seamless feel, **1px solid borders are strictly prohibited for sectioning.** Boundaries must be defined solely through background color shifts. For instance, a product description section in `surface-container-low` should sit directly against a `background` page, creating a clean, monolithic transition rather than a "boxed" look.

### The "Glass & Gradient" Rule
For floating elements—such as navigation bars or quick-buy modals—use **Glassmorphism**. Apply the `surface` color at 60% opacity with a `24px` backdrop-blur. To add "visual soul," use subtle linear gradients (e.g., `primary` to `primary-container`) on active states and hero CTAs to simulate the iridescent sheen of premium peripherals.

---

## 3. Typography

The typographic system utilizes a "High-Contrast Pairing" to balance technical specs with editorial authority.

*   **Display & Headlines (Space Grotesk):** This font provides a wide, "engineered" feel. Use `display-lg` (3.5rem) for hero product names to create an aggressive, high-performance presence.
*   **Body & Titles (Inter):** Inter is used for its exceptional legibility and neutral, professional tone. It serves as the functional "instruction manual" to the headline's "advertisement."

### Typographic Hierarchy
*   **Display-LG:** Space Grotesk / 3.5rem / Tracking -2% (The "Hero" statement)
*   **Headline-MD:** Space Grotesk / 1.75rem / Tracking -1% (Section headers)
*   **Title-MD:** Inter / 1.125rem / Medium Weight (Product names in cards)
*   **Body-MD:** Inter / 0.875rem / Regular Weight (Product descriptions)
*   **Label-SM:** Inter / 0.6875rem / All-Caps / Tracking +5% (Technical specs/metadata)

---

## 4. Elevation & Depth

Hierarchy is achieved through **Tonal Layering** rather than structural shadows or lines.

### The Layering Principle
Depth is created by "stacking" surface tiers.
*   **Base:** `surface` (#131313)
*   **Section:** `surface-container-low` (#1B1C1C)
*   **Interactive Element (Card):** `surface-container-high` (#2A2A2A)
This creates a natural, soft lift that feels integrated into the hardware itself.

### Ambient Shadows
When a floating effect is required (e.g., a "Product Preview" modal), use **Ambient Shadows**.
*   **Shadow Value:** `0px 20px 40px rgba(0, 0, 0, 0.4)`
*   Shadows should be extra-diffused and low-opacity, avoiding "dark grey" drop shadows in favor of tinted depths that blend with the background.

### The "Ghost Border"
If a container requires a border for accessibility (e.g., Input Fields), use a **Ghost Border**: `outline-variant` (#504441) at 15% opacity. This provides a "precision-milled" edge without cluttering the visual field.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary` (#F3CBC1) with `on-primary` (#432A24) text. **Radius:** `0.25rem` (sharp but refined).
*   **Secondary:** Ghost style. Transparent background with a `Ghost Border` and `primary` text.
*   **States:** On hover, primary buttons should utilize a slight scale up (1.02x) and a subtle glow effect using the `surface-tint` token.

### Cards & Lists
*   **Rule:** Forbid divider lines. Use `1.5rem` to `2rem` of vertical space to separate list items.
*   **Product Cards:** Use `surface-container-low` for the card background. Imagery must be high-key product photography with transparent backgrounds to let the product "float" on the container.

### Precision Input Fields
*   **Style:** `surface-container-lowest` background with a `Ghost Border`.
*   **Focus State:** The border transitions to 100% `primary` opacity with a subtle `primary` outer glow.

### Additional Components: The "Spec-Grid"
A custom component for gaming peripherals. A 2-column grid of `label-sm` technical specs (e.g., "Weight: 54g", "Sensor: PAW3395") using `secondary` text color, placed within a `surface-container-high` module.

---

## 6. Do's and Don'ts

### Do:
*   **DO** use extreme dark space (negative space) to focus attention on product details.
*   **DO** use asymmetric layouts (e.g., a product image bleeding off the right edge while text stays left-aligned).
*   **DO** use "Space Grotesk" for all numerical values (DPI, Weight, Latency) to emphasize the engineering aspect.

### Don't:
*   **DON'T** use standard grey `#CCCCCC` for text. Use the `on-surface-variant` or `secondary` tokens to maintain tonal harmony.
*   **DON'T** use 100% sharp corners (`0px`). Use the `DEFAULT` (0.25rem) or `sm` (0.125rem) roundedness scale to mimic the "soft-touch" finish of high-end plastic and aluminum.
*   **DON'T** use standard "Blue" for links. Every interactive highlight must use the `primary` or `secondary` color tokens.