# Changelog

Every release is a git tag (`git tag` lists them). The panel shows which version you are
looking at: "v0.10.0" when it is exactly a release, "v0.10.0 + changes" when there is
work since. To run an earlier release next to the current one, see "Versions" in the
README (`npm run versions`, `npm run serve:version -- v0.8.0`).

Numbering: the middle number goes up for new features, the last one for fixes to the
release before. The first number becomes 1 when the viewer is finished.

## 0.10.0, 6 November 2026

- Nothing goes below the ground, in any mode, with Go through walls on or off. The ground is the lawns, drive and ground floors inside the estate and the hills beyond the walls. Orbit, Fly and the jumps between places all stop 35 cm above it, and so does the orbit's pivot.
- Crickets on warm nights from late April to late October, loudest in high summer, starting at dusk. There are a dozen, each with its own pitch, place in the stereo field, rhythm and loudness, a few close and the rest further off, over the shimmer of many more far away. Indoors you hear them faintly through the windows. (Since 0.9.0 they had only sung from late June, so on the default date they were silent, and they were faint before that.)
- Versions you can see: the panel shows the version, this changelog lists every release, and `npm run serve:version` runs any earlier release next to the current one.
- A saved picture's file name says the date, the time and the version.

## 0.9.0, 6 November 2026

- The seasons: a slider for the day of the year, with ▶ to run a year in a minute.
  - The sun takes its real path for the date.
  - Trees come into leaf in spring, turn yellow and orange-brown and go bare leaf by leaf; their shadows and the far trees change with them.
  - The grass changes colour through the year.
  - Snow lies in midwinter on the lawns, roofs and drive, with snow falling and footsteps that crunch.
  - Birds and crickets follow the seasons.

## 0.8.0, 6 November 2026

- Colours matched to TRJTA's Lumion renders (lawn, brick with light mortar, gravel), measured and calibrated against his render over the gate.
- A grass shader that hides the tiling from above and joins the lawn to the fields.
- The entrance planted as in the renders: two oaks inside the gate, dense shrubs along the house and outside the wall.
- The tour and the estate flyby go through the gate arch.
- Places from above (over the gate, straight down) and for the rooms; the front view no longer looks into a tree.

## 0.7.0, 6 November 2026

- Doors that open (the front door and the kitchen door); the 17 painted-on doors stay shut and block you.
- Go through walls, off at first: walls stop Walk, Fly and Orbit.
- Fly starts over the gate and speeds up with height.
- The tour cuts between rooms instead of flying through walls, and every camera path is checked against walls and tree crowns.
- Tomb Raider-style flybys that bank into turns, with a slight fisheye.
- The pool reads as water behind the post effects.

## 0.6.1, 6 November 2026

- The Pool place frames the pool and its reflections instead of a pillar.

## 0.6.0, 6 November 2026

- A guided tour with captions.
- Synthesised sound: birds, crickets, owl, breeze, fountain, clock, and footsteps by surface.
- Save a picture.

## 0.5.0, 5 November 2026

- The country around the manor: oaks and ashes, bushes, a billboard forest, hills, and the drive beyond the gate.
- A warmer grade with outdoor material tints, and warm indoor light.
- Ambient occlusion (N8AO) with SMAA, and an adaptive resolution.

## 0.4.1, 5 November 2026

- The blue hour: a twilight glow in the sky for the first hour after sunset.

## 0.4.0, 5 November 2026

- Evening and night: a time-of-day slider on the real sun path.
- Candle flames on every chandelier and sconce, a pool of eight point lights that follows you, the kitchen tubes, a porch lantern and floodlights on the facade.
- Glowing windows, moonlight, stars and a night sky.

## 0.3.1, 5 November 2026

- The ivy climbs the walls. The eight pieces came centred on the origin, a blob in front of the porch; each now sits on a plain stretch of brick, found by scanning the facades.

## 0.3.0, 5 November 2026

- Reflective water for the pool, fountain and pond: planar mirrors with ripples and a Fresnel blend, only the nearest one rendered each frame. The fountain's jet flows.

## 0.2.0, 5 November 2026

- Proper walking: a capsule body against a collision tree of the estate, with stairs, walls and jumping. Fly keeps the old free movement.

## 0.1.0, 5 November 2026

- Croft Manor in three.js: the OBJ built into a GLB, orbit and fly views, the sun, and switches for ivy and shadows.
