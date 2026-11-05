# Croft Manor viewer

A three.js page that shows Classic Croft Manor HD v2.3 (OBJ by TRJTA, exported from SketchUp). It covers the house, the grounds, the assault course, the ivy and the zipline trolley.

## Run it

```sh
npm install
npm run build:model   # once: source/ -> public/manor.glb (about 35 s)
npm run dev           # http://localhost:5190
```

`source/` holds the unpacked RAR. macOS cannot open that solid RAR, so it was unpacked with `node-unrar-js`. `source/`, `build/` and `public/manor.glb` are left out of git.

## What the model build does

`scripts/build-model.mjs`:

1. Copies `source/` to `build/work/`, then fixes three things there:
   - decodes the ivy's DXT5 `.dds` leaves to PNG;
   - renames `bump` lines to `map_Bump`, because obj2gltf only reads `map_Bump`;
   - points `cm_door_brown.jpg` at the `.png` that actually exists.
2. Converts the main OBJ, the trolley and the eight ivy OBJs with obj2gltf. Each one is flattened and then joined by material, so about 4,600 SketchUp groups become one mesh per material (157 draw calls).
3. Merges everything into one scene. The ivy goes under a node called `Ivy`, so the page can switch it off.
4. Sets material values that SketchUp doesn't export:
   - everything gets metalness 0 and roughness 0.82;
   - glass and water are see-through;
   - cut-out textures such as leaves and grilles get MASK, so they don't sort badly when blended.
5. Re-encodes textures as WebP, capped at 2048 px for colour and 1024 px for normal maps.

Change the caps with `COLOUR_MAX=4096 NORMAL_MAX=2048 npm run build:model`.

The result is about 83 MB: 36 MB of textures and 47 MB of geometry, with 763k triangles. The geometry is left uncompressed on purpose. Its texture coordinates run from -1153 to 671, which quantisation would blur.

## Using the page

- **Orbit**: drag to turn, right-drag to pan, scroll to zoom. Double-click a surface to fly towards it.
- **Walk**: click the view to capture the mouse. W A S D walk, Shift runs, Space jumps, and Esc frees the mouse. You're a capsule 1.8 m tall that collides with the whole estate, so stairs work and walls and furniture stop you. Every door in the model is a closed panel, so doors let you through. The collision tree (three-mesh-bvh) builds in a web worker in about 4 s after the model loads. If you switch to Walk from high up, you start on the drive.
- **Fly**: the same controls with no collision. Space goes up and C goes down.
- **Water**: the indoor pool, the fountain and the assault-course pond are mirrors with procedural ripples and a Fresnel blend (`src/water.js`). Only the nearest water surface in view, within 55 m, renders a reflection each frame, at half resolution. The fountain's jet flows.
- **Ivy**: the eight ivy OBJs come centred on the origin, meant for placing by hand (TRJTA placed them in Lumion). `src/ivy.js` puts each one on a plain stretch of brick, found by scanning the facades with rays.
- **Place** jumps to a saved view. To add one, use "Copy this view" and paste the line into `public/viewpoints.json`.
- **Time**: the sun follows its real path over Surrey in late May, with the front of the house facing south. The ▶ button runs a day in two minutes, and Compass turns the sun's path. From about 9° above the horizon the lamps come on (`src/lamps.js`):
  - every chandelier candle, wall sconce and kitchen tube gets a flame or glow, found by splitting the merged fitting meshes into pieces (one draw call for all the flames);
  - eight point lights follow you to the nearest fittings, outdoor ones first when you're outside;
  - outside there's a porch lantern, and floodlights at the foot of the front facade;
  - windows glow warm when you're outside;
  - at night the moon lights the estate, and there are stars and a navy sky (`src/sky.js`).
- Sliders set the brightness. Checkboxes switch the ivy and the shadows on and off.
