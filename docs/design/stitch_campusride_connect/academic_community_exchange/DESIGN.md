---
name: Academic Community Exchange
colors:
  surface: '#fcf9ee'
  surface-dim: '#dddad0'
  surface-bright: '#fcf9ee'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f4e9'
  surface-container: '#f1eee3'
  surface-container-high: '#ebe8dd'
  surface-container-highest: '#e5e3d8'
  on-surface: '#1c1c16'
  on-surface-variant: '#4d4635'
  inverse-surface: '#31312a'
  inverse-on-surface: '#f4f1e6'
  outline: '#7f7663'
  outline-variant: '#d0c5af'
  surface-tint: '#745b00'
  primary: '#745b00'
  on-primary: '#ffffff'
  primary-container: '#f2c94c'
  on-primary-container: '#6b5400'
  inverse-primary: '#ebc246'
  secondary: '#77574d'
  on-secondary: '#ffffff'
  secondary-container: '#fed3c7'
  on-secondary-container: '#795950'
  tertiary: '#006d37'
  on-tertiary: '#ffffff'
  tertiary-container: '#68e590'
  on-tertiary-container: '#006532'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe08b'
  primary-fixed-dim: '#ebc246'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#584400'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#e7bdb1'
  on-secondary-fixed: '#2c160e'
  on-secondary-fixed-variant: '#5d4037'
  tertiary-fixed: '#7efba4'
  tertiary-fixed-dim: '#61de8a'
  on-tertiary-fixed: '#00210c'
  on-tertiary-fixed-variant: '#005228'
  background: '#fcf9ee'
  on-background: '#1c1c16'
  surface-variant: '#e5e3d8'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-margin-mobile: 20px
  container-margin-desktop: 64px
  gutter-md: 16px
  section-gap: 40px
  element-gap: 12px
---

## Brand & Style

The visual identity is rooted in the "Modern Scholarly" aesthetic—a sophisticated blend of traditional academic prestige and contemporary digital efficiency. It targets a university demographic that values safety, institutional trust, and shared communal responsibility.

The design system employs a **Minimalist-Corporate** hybrid style. It uses generous whitespace (the "cream" canvas) to reduce cognitive load while leveraging high-quality serif typography to establish an authoritative, "library-quiet" atmosphere. The emotional response is one of calm reliability—less like a chaotic gig-economy app and more like a trusted university utility.

Key visual pillars include:
- **Warmth:** Eschewing sterile blues for a rich, parchment-inspired base.
- **Precision:** Clean, thin lines for input fields and containers to maintain a sense of order.
- **Trust:** Clear labeling and structured hierarchies that feel institutional and safe.

## Colors

The palette is anchored by a warm cream background that prevents the eye fatigue often associated with pure white screens. 

- **Primary (Gold):** Used exclusively for high-priority actions (CTAs), verification badges, and key wayfinding elements. It represents excellence and the "gold standard" of safety.
- **Secondary (Oxblood/Deep Brown):** Used for typography and iconography to provide softer contrast than pure black, maintaining the scholarly feel.
- **Tertiary (Safety Green):** Reserved for "Verified Student" status and success states.
- **Neutral (Cream/Paper):** The primary canvas color, creating a distinctive, non-generic brand presence.

## Typography

This system uses a dual-font strategy to balance tradition and utility.

**Playfair Display** handles all editorial and structural headings. It provides the "scholarly" weight and elegance. For mobile, headline sizes are slightly reduced to ensure no more than three words per line in large titles.

**Work Sans** is used for all functional text, inputs, and body copy. Its neutral, highly legible character ensures that data-heavy ride details are easy to parse at a glance, especially on small screens.

Use `label-md` with slight letter-spacing and uppercase styling for section headers and "Safety Filter" categories to create a clear informational hierarchy.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model with a strong emphasis on vertical rhythm. 

- **Mobile (Default):** A 4-column grid with 20px side margins. Elements are primarily stacked. Cards occupy the full width of the grid minus margins.
- **Desktop:** A 12-column grid with a max-width of 1200px. Content is centered with large 64px margins to maintain the premium, spacious feel.
- **Rhythm:** An 8px base unit governs all padding and margins. Use `section-gap` between major blocks (e.g., Search vs. Results) and `element-gap` for items within a card.

## Elevation & Depth

Depth is conveyed through **Tonal Layers** and **Low-Contrast Outlines** rather than aggressive shadows. This keeps the interface feeling "flat" like a piece of stationery.

- **Level 0 (Background):** The Cream (#FCF9EE) base layer.
- **Level 1 (Cards/Containers):** Pure white surfaces with a subtle 1px border (#E5E0D0). This creates a crisp distinction without relying on heavy dropshadows.
- **Interactive States:** When a card or button is pressed, use a subtle 4px blur, low-opacity shadow (#5D4037 at 10%) to indicate tactile feedback.
- **Overlays:** Modals should use a 20% opacity backdrop of the secondary color (#5D4037) to dim the background while maintaining warmth.

## Shapes

The shape language is "Softly Formal." It avoids the juvenile feel of extreme pill shapes while eschewing the harshness of sharp corners.

- **Primary Containers:** 0.5rem (8px) radius. This applies to cards, input fields, and main button states.
- **Large Elements:** Featured hero sections or large "Find Your Ride" blocks use 1rem (16px) for a slightly more welcoming, enclosed feel.
- **Icons:** Should be contained within circular or rounded-square backdrops when used as category markers.

## Components

### Buttons
- **Primary:** Gold background with oxblood text. Bold weight, 0.5rem radius.
- **Secondary/Ghost:** Oxblood border (1px) with transparent background. Used for "Filter" or "Cancel" actions.

### Inputs
- **Field Style:** White background with a thin 1px border (#E5E0D0). Labels sit above the field in `label-sm` Work Sans.
- **Icons:** Use thin-stroke icons in the secondary color to lead input fields (e.g., a location pin for "Starting point").

### Cards (Ride Result)
- White background, 1px border. 
- Top-left: User photo (circular). 
- Center: Route details in Playfair Display (Medium).
- Bottom-right: Price/Seat count in a Gold accent pill.

### Chips
- Used for "Safety Filters" (e.g., "Verified Only"). 
- Background: A slightly darker cream (#F2EFE0).
- Selected State: Gold background with oxblood text.

### Verification Badge
- A small Gold shield icon with a checkmark, always placed next to the student’s name to reinforce the "Campus Only" safety promise.