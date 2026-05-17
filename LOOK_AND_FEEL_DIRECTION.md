# Birdtrip Look And Feel Direction

## Goal

Move Birdtrip closer to a more user-friendly app. The target feel is a bright, guided birding trip planner rather than a quiet local utility.

## Current Birdtrip Feel

Birdtrip currently feels polished, calm, and operational. The layout is efficient: a left search sidebar, a large map, ranked stop cards, and a details drawer. The muted green, sky, and amber palette gives it a field-guide tone, but the interface reads more like an internal planning tool than a consumer birding product.

Strengths to keep:

- Clear route-first workflow.
- Large map as the main workspace.
- Ranked stop cards with practical metrics.
- Transparent score and route-impact details.
- Simple local-first architecture.

Weaknesses to improve:

- The first impression is subdued.
- Birding outcomes are not visually prominent enough.
- Setup and onboarding feel minimal.
- The app does not yet communicate "trip planner" as strongly as "route utility."
- Summary data is useful but not visually exciting.

## Qualities To Add

We want this to feel more like a complete consumer trip-planning product. It uses stronger branding, brighter colors, onboarding flows, product status cues, and visually distinct birding categories.

Qualities worth adopting:

- A brighter emerald-forward brand color.
- Clear setup status, such as "Setup Required" or "Ready to Search."
- Quick-start and onboarding affordances.
- Route/area mode switching with segmented controls.
- Colorful stat tiles for target species, notable birds, and top hotspots.
- A stronger map legend with meaningful birding categories.
- Dedicated panels for trip plan, target species, recent sightings, and uploaded lists.
- More explicit "powered by eBird" and route-planning confidence cues.

## Visual Direction

Use a brighter, more confident palette while avoiding a one-note green UI.

Suggested palette direction:

- Primary emerald: `#10b981`
- Deep emerald: `#065f46`
- Blue for route/map context: `#3b82f6`
- Purple for notable or rare sightings: `#a855f7`
- Amber for setup, warnings, or incomplete data: `#f59e0b`
- Red or rose for target species markers: `#ef4444`
- Neutral surface: `#ffffff`
- Page background: `#f8fafc` or very light green-tinted gray

Reduce the current soft nature-palette effect where it makes the app feel sleepy. Keep natural warmth in small touches, but let the primary product language be crisp, bright, and task-focused.

## Layout Direction

Keep the app-first layout, but make the hierarchy feel more productized.

Recommended structure:

1. Top header
   - Brand, quick-start button, setup/data status, settings menu.
   - This gives Birdtrip a stronger app identity than the current sidebar-only brand.

2. Left planning panel
   - Search mode segmented control: Route / Area.
   - Origin and destination inputs.
   - Search settings in a collapsible or tinted settings section.
   - Birding data setup and target species controls.

3. Main map
   - Keep the map dominant.
   - Add a richer legend: target species, notable birds, top hotspots, selected stops.
   - Use numbered markers for ranked stops.

4. Right or bottom intelligence panels
   - Trip Plan.
   - Target Species.
   - Recent Sightings.
   - Top Hotspots or Ranked Stops.
   - These panels should make birding value visible before the user opens a details drawer.

5. Details drawer/modal
   - Keep current route-impact and score detail.
   - Make the top summary more colorful and scannable.

## Component Changes

### Header

Add an app header with:

- Birdtrip logo/name.
- Quick Start button.
- Setup status badge.
- Settings/features menu.
- Optional dark mode toggle later.

The current brand block in the sidebar can become more compact once a header exists.

### Search Controls

Add a segmented control for search mode:

- Route.
- Area.

Even if Area mode is not fully implemented yet, the design should make room for it.

### Summary Tiles

Replace or augment the current dark summary strip with colorful metric tiles:

- Target Species.
- Notable Birds.
- Top Hotspots.
- Ranked Stops.
- Route Miles.
- Added Time Budget.

Each tile should have a clear color accent and a large value.

### Map Legend

Make map categories match birding intent:

- Target species.
- Notable or rare.
- Ranked hotspot.
- Selected stop.
- Route corridor.

The current High / Good / Scout legend is useful, but it is more abstract than the birding categories users care about.

### Ranked Stop Cards

Keep the ranked cards, but make them more lively:

- Use numbered colored badges.
- Add category chips for notable, target match, and top hotspot.
- Show the top few species with stronger visual separation.
- Use brighter score and route-impact pills.

### Onboarding

Add a quick-start path:

- Explain eBird token or data setup.
- Provide a sample route.
- Allow "Explore without setup" if no token is present.
- Show why setup improves target/lifer recommendations.

This should be short and action-oriented, not a marketing landing page.

## Copy Direction

Use practical, birding-specific language.

Prefer:

- "Find Stops"
- "Target Species"
- "Notable Birds"
- "Top Hotspots"
- "Recent Sightings"
- "Build Trip Plan"
- "Send to Maps"
- "Setup Required"
- "Ready to Search"

Avoid overly generic labels like:

- "Search Window" when "Search Settings" is clearer.
- "Candidate Count" when "Ranked Stops" is clearer.
- "Scout" unless it is explained by context.

## Implementation Priority

1. Refresh palette, header, and summary tiles.
2. Add route/area segmented control styling, even if only route mode works initially.
3. Replace the current map legend with birding-category legend items.
4. Make result cards use stronger badges and chips.
5. Add a quick-start/setup modal or panel.
6. Add richer panels for trip plan, target species, and recent sightings.

## Guardrails

- Do not turn Birdtrip into a marketing landing page. The first screen should remain the actual planning tool.
- Do not bury route inputs behind onboarding.
- Keep the map dominant.
- Keep route practicality visible; this is Birdtrip's strongest differentiator.
- Keep the interface scannable for repeated trip planning.
- Preserve the local-first, no-paid-map-key positioning unless the product direction changes.
