# Changelog

Every release is a git tag (`git tag` lists them). The panel shows which version you are
looking at: "v0.10.0" when it is exactly a release, "v0.10.0 + changes" when there is
work since. To run an earlier release next to the current one, see "Versions" in the
README (`npm run versions`, `npm run serve:version -- v0.8.0`).

Numbering: the middle number goes up for new features, the last one for fixes to the
release before. The first number becomes 1 when the viewer is finished.

## 0.27.0, 7 November 2026

- A prototype of other visitors, live: where the site has the server for it, a setting shows everyone else walking the estate as faint lanterns. It shares only where you walk, under a random name for the visit, and keeps nothing. The server is on a TwoDoorIdeas branch, not live, so the setting doesn't appear anywhere yet.

## 0.26.0, 7 November 2026

- VR: with a headset, *Enter VR* appears in the panel. You stand where you were; the left stick walks you, the right stick turns you in steps, and a trigger hops you forward. Walls stop you and you follow the stairs. Not yet tried on a real headset.

## 0.25.0, 7 November 2026

- Photo mode: the panel and the hints go, you click on the picture to focus, set how much the rest blurs, and pick a film look (warm film, a faded print, teal and orange, black and white, sepia), then save it at full resolution. A flyby holds still while you take it.

## 0.24.0, 7 November 2026

- The northern lights on a few clear winter nights (7 November, 19 January, 2 and 12 February): green along the northern horizon over the house, red and violet rays above, the curtains drifting and folding. The weather label says so while they are up, and *Holidays… › Sights › Northern lights* takes you to the next of those nights. Tonight, 7 November, is one of them.

## 0.23.0, 7 November 2026

- Deer at dawn: a small herd grazes in the field south-west of the gate from first light until a couple of hours after sunrise. Walk up to them and they look up and bound away. (Quaternius's Deer and Stag, CC0.)
- Bats at summer dusk: from late May to early September, for about an hour after sunset, bats flit round the front of the house and over the fountain.

## 0.22.0, 7 November 2026

- A rainbow when the sun comes out after a shower, opposite the sun, with a fainter second bow above it. It needs the sun lower than 42°, so look for one in the morning or late afternoon after rain. *With seasons and weathers* has one among its cuts.
- Footprints in the snow: walking leaves a trail of boot prints behind you, which fade after a couple of minutes, sooner while it snows.

## 0.21.0, 7 November 2026

- Thunderstorms: a new weather in the panel, the real thing when Open-Meteo reports one in Surrey, and a few hot summer afternoons of the season's own. A dark sky, heavy rain and wind, and lightning every few seconds: mostly far off, flickering in the clouds, some nearer with a branching bolt, now and then close. The flashes light the sky and the house, and the thunder rolls in late by the distance, a crack and a boom when it is close, a long low roll when far.
- *With seasons and weathers* has a July thunderstorm among its cuts.
- Videos carry the thunder too.

## 0.20.0, 7 November 2026

- Every holiday has its flyby now, in a *Holidays* group of the flyby list and in the *Holidays…* menu, each putting on a show:
  - *Bonfire Night*: low past the bonfire, up through its smoke and over the roof into the fireworks, round among them, and back out in front to see the house under them, with more rockets and salvos than a normal evening.
  - *Christmas Eve*: snowy dusk, in over the lit gate, down the drive under the oaks' lights, up to the roofline and along the front with the lights chasing red, green and gold all the way, and away to see the house in the snow.
  - *New Year*: ten seconds to midnight on the drive with the clock running and the countdown big on screen, then up into a dozen rockets on the stroke of midnight as 2027 is written in the sky, and straight through the numbers.
  - *Halloween night*, as before, with the figures and ghosts coming back sooner.
- Videos now have the festivals' sounds: the ghosts' moans, the bonfire's roar and crackle, the rockets' whistles and the bangs. The New Year countdown is in the picture too.
- The bonfire's smoke catches its light from below and shows against the night sky.
- Fireworks: sparks flying past the camera fade out instead of filling the screen, and the bursts light the ground more gently (they made snow look like day).
- A limiter on the sound, so a dozen bursts at once don't clip.

## 0.19.0, 6 November 2026

- You arrive at noon today, with today's real weather at noon; *Now* jumps to the time now.
- The sound comes on with your first click on a mode, a flyby, the tour, Now, the lights or a holiday (unless you switched it off).
- *House* switches the lights inside the house all at once and leaves the outdoor lights on; by day it moves the clock on to the evening first.
- Holidays, in a new menu:
  - *Halloween*: the pumpkins are out from 26 October to 3 November, their candles lighting the steps. On Halloween night dark figures appear at the front windows and ghosts drift in the foggy garden, moaning; a *Halloween night* flyby shows it all.
  - *Bonfire Night* (5 November): a bonfire with smoke and embers on the front lawn, and fireworks over the house in the evening, with their whistles and bangs.
  - *Christmas*: the house's lights are cooler, a red, green and gold chase now and then and icicle lights dripping below, and they stay on all day and all night from Christmas Eve to New Year's Eve.
  - *New Year*: fireworks at midnight, and 2027 written across the sky in gold.
- *With seasons and weathers* always opens on heavy snow.
- Videos: croftmanor.sfatosu.com is a bigger watermark over the picture, and there is a 2× speed.
- Sounds: splashing when you wade into the fountain, the moat or the pool; a push-off when you jump and a thud when you land; the doors are a low groan and an iron latch, not a squeak.
- Fixed: the sound could stop with an error when the wind came out a hair below zero.

## 0.18.2, 6 November 2026

- Videos: the text in the bottom bar is about twice the size, to read on a phone (the site name, "Fork it on GitHub" and the credit; on YouTube in two rows), and the end card's lines are bigger too. A reel's film bars are a little taller to hold it.

## 0.18.1, 6 November 2026

- The seasons and weathers are the tick box's alone now: the flyby that had them is plain *Circling the manor* (the same spin round the house), and *A day at the manor* is gone.
- Go to a place: *Overview* and *Over the gate* are a little closer.

## 0.18.0, 6 November 2026

- *With seasons and weathers*, a tick box under the flybys: any flyby (and a video of it) cuts to another season, time and weather every three seconds, in a different order each time, as the *Seasons and weathers* flyby does. Over the estate with it ticked gives that flyby's motion with the cuts. Leaving puts the date, time and weather back.

## 0.17.0, 6 November 2026

- Flybys:
  - *Over the estate* comes first.
  - *Through the gate* starts just outside the gate, flies in through the window over the front door (a lancet 40 cm wide) and round the great hall.
  - *Rising over the gate* starts a little further out.
  - *A day at the manor* runs from midday to just after sunset.
  - *All weathers* and *A year at the manor* are one flyby now, *Seasons and weathers*: it cuts every three seconds to another season, time and weather, in a different order each time.
  - *The great hall* goes straight in at the front door.
  - Hold ← or → to rewind or fast-forward a flyby (they used to end it).
- Flybys look sharper and run smoother: the resolution drops in one step when a scene is far too slow (over the estate it used to stutter at 7–18 frames a second for ten seconds), a single long frame no longer counts, the shrubs lost the twigs their leaves hide (355k triangles), the water's reflection leaves out the shrubs and the fallen leaves, and a light sharpening runs when the picture is drawn smaller than the screen.
- Walk: the mouse looks round from the first move key or click (and the Walk and Fly buttons), and before that you can drag on the picture to look round. The hint sits at the bottom, out of the way.
- Lights: after midnight most of them go out one by one, until you go into the house, when the lights inside come back on. *Room* and *House* switches in the panel (and L for the room).
- The moon is where the real moon is, rising and setting at the right times, with NASA's map of its face, the right phase, bigger (about 2.4° across), and pale by day. Moonlight follows it.
- Halloween: carved pumpkins at the front door from 25 October to 1 November, glowing after dark. Christmas: lights along the top of the house and over the gate, and coloured lights in the two oaks inside the gate, from 1 December to 6 January.

## 0.16.1, 6 November 2026

- The loading screen's "Loading" keeps its big condensed type in a published build (the build had turned its style into one browsers reject, so it showed in small plain text).

## 0.16.0, 6 November 2026

- You start on the drive just inside the gate, between the two oaks, with the fountain before you and the front door beyond it. The loading screen stays up until walking is ready and the trees are planted, so nothing jumps: before, the page showed the view from high above for a few seconds while walking got ready, then dropped you on the drive.
- Orbit, Walk and Fly are back at the top of the panel, in that order. The keys for the mode you are in sit under the panel when the window has room for them, otherwise at the bottom right. The panel scrolls if the window is short (and on sfatosu.com both leave room for the site's Credits button in the bottom left corner).
- Quality is High by default.
- A classic loading bar: green running to cyan inside a white frame, with "Loading" above it.
- The weather is the real weather in Surrey now (from Open-Meteo), while the viewer keeps the real time: the sky, rain or snow, fog, the wind, snow on the ground and hard frost, with the temperature. Moving the clock or the date gives the season's weather, as before. The old behaviour is still in the menu ("As the season has it").
- Wind is part of the weather now: many days are calm (most in summer), some breezy, a few blustery, mostly in winter. The wind sound follows it and has quiet lulls between the gusts, so it is no longer always on; the rush of air on a flyby only comes on its fast stretches. The trees and the clouds follow it too.
- Fog comes on still mornings in more seasons: most often from late September into December, often in winter (some days it never lifts), sometimes in spring, and as a thin dawn mist on a few summer mornings.
- Trees: trunks and branches stand still; only the leaves move. In autumn the leaves fall and gather on the grass under each tree as its crown thins, thickest near the trunk; they go brown through the winter, snow covers them, and they are gone by April.
- The ice on the fountain and the pond is smooth cloudy ice with fine cracks and drifts of snow, instead of a pattern of squares that looked pixelated.
- The snowman is smooth (its balls were shaded in flat facets), with a soft sheen of packed snow, and it only goes up when there is snow lying.
- Flybys:
  - New: *Through the gate*, the classic one, low down the drive outside and straight through the gateway, over the fountain and down to the front door.
  - New: *Rising over the gate*, a vertical lift from the drive outside, the house framed in the gateway.
  - New: *All weathers*, round the house while the weather cuts from one kind to the next (sun, rain, snow lying in an instant, fog, cloud, overcast), named in the top bar.
  - *A day at the manor* runs the day about twice as fast (under a minute), at the same speed round.
  - *A year at the manor* starts in front of the house and spins round twice, the year passing in under a minute.
- Place starts as "Go to a place…" rather than claiming you are at the Overview.

## 0.15.0, 6 November 2026

- Two time-lapse flybys, which you can also record as videos:
  - A day at the manor: a slow circuit while the clock runs from just before sunrise to after sunset on the chosen date, with the time in the top bar.
  - A year at the manor: the same kind of circuit while the year turns, spring round to spring at midday, with the date in the bar: blossom-green spring, summer, a wet October, snow in January.
- Leaving a flyby or the tour puts you back where you were: on your feet in the same spot if you were walking, and the clock and the date as they were.
- You start walking, on the drive facing the house. The modes are now Walk, Fly and Orbit, in that order, in a dock at the bottom right. Each mode shows its keys, and the on-screen keys work when you hold them (W A S D, Shift, Space, C), as well as the real ones.
- The pool:
  - Moving caustics, the bright web of light a rippling surface throws, on the floor and walls under the water, deepening to blue-green with depth.
  - The sun glints on the ripples, and the light the water throws back plays on the walls above it.
  - At night an underwater light lights the pool turquoise from below.
  - The water is clearer looking straight down, and the pool hall (under its glass roof) is no longer overexposed.
- Winter: the fountain and the assault-course pond also freeze, and the fountain stops, whenever snow lies, including when you pick Snow from the Weather menu on another date.
- The video controls are tidier: a Make a video section, with the flyby, a YouTube 16:9 / Reel 9:16 switch and a Record button.
- Report a bug:
  - A short form. The version, the browser and graphics card, where you are, the time, date and weather, the quality and frame rate, and any recent errors are added for you.
  - It opens a GitHub issue with it all filled in, or copies the report. An email button appears once an address is set in `src/credits.js`.

## 0.14.0, 6 November 2026

- Make a video of a flyby: an MP4 with sound, for YouTube (1920 x 1080) or as an Instagram reel (1080 x 1920, with a taller lens so it sees as much).
  - It has the flyby's black film bars, with the title in the top bar for the first few seconds. The bottom bar carries croftmanor.sfatosu.com, "Fork it on GitHub" and the credit all the way through. A five-second end card has the links, the credits and the rights line.
  - It renders frame by frame at a steady 30 frames a second (however long each frame takes to draw), through the browser's own H.264 encoder. The sound is rendered afterwards from the same camera path, frame by frame and including the doors, so picture and sound match. A 17-second flyby took about 25 seconds to make here.
  - The words are in `src/credits.js`. The site and the GitHub address there are the intended ones: neither is live yet.

## 0.13.0, 6 November 2026

- Weather, worked out for each day and hour (so a date always has the same weather), or chosen in the new Weather menu:
  - Spring has fluffy clouds and summer clear or nearly clear skies.
  - Winter is grey overcast: the sun dims, shadows go soft, the stars and moon hide.
  - On about half the autumn days it rains on and off: rain falls round you outdoors, the ground goes dark and glossy and dries slowly after, and you hear it.
  - Some late-autumn mornings are foggy, and the fog lifts by late morning.
- Winter on everything that faces the sky. A height map of the estate, rendered once from above, says where the sky reaches. Snow lies on the gate, the wall caps, the roofs, the fountain, the assault course and the ground round the pond, but not under a roof, in the porch or under the pool's glass. The shrubs are snow-capped and the bare branches carry snow.
- The fountain and the assault-course pond freeze over from about 20 December to early February: cloudy blue-white ice, cracked and snowed on. The fountain is turned off and falls silent. (The indoor pool stays liquid.)
- Fluffier snow: big soft flakes of mixed sizes, falling slowly and drifting.
- A snowman on the front lawn, with a carrot nose, coal eyes and buttons, stick arms and a red scarf. It goes up around 21 December. It melts through the first half of February (it sags, its head tips, the nose and arms fall), and its carrot, coal and sticks lie on the grass for a few days after.

## 0.12.0, 6 November 2026

- Every lamp is lit, wherever you are. Before, a pool of eight lights followed you to the nearest fittings, so rooms lit up as you came near. Now fittings within a few metres of each other share a light (30 lights for the 36 fittings), and all of them are on together. At night it still runs at 54–60 frames a second on Balanced.
- Indoors, less haze and more sun shapes. Only the air inside the house scatters sunlight, so the windows no longer glow with outdoor haze. The sun that does come in lands harder on the floors and walls, and a room full of sunlit air (the pool under its glass roof) no longer fogs over. (The ballroom's windows face north: the sun only reaches it early and late on summer days.)
- The gravel is no longer a grid from above. It gets the same treatment as the lawn: sampled in world space at two scales, its tile pattern flattened, and warmer, greyer, lighter and darker patches over a few metres.
- Flybys:
  - Black film bars at the top and bottom, as in the old Tomb Raider cutscenes. The fisheye and wider lens are on from the first frame.
  - Esc, a click or W A S D leaves a flyby (or the tour), and a line in the top bar says so when it starts.
  - Over the estate now starts just outside the gate.
  - The rush of air past your ears, with your speed (in Fly mode too).
  - Two more: Round the manor (a banking circuit above the treetops, ending over the front door) and The grounds (low along the front wall, round the east lawn, over the assault course, back down the west side and up the facade). Both are checked against walls and trees.
- Sound you can place: the grandfather clock, the fountain and the doors are positioned in 3D around you, so you can tell where the clock is as you fly round the house. The walls muffle the clock from outside and the fountain from inside.
- A proper door sound: the latch, then the creak of a dry hinge as the door swings, and a thud and the latch as it shuts.
- No birds in autumn or winter, and more wind then, with gusts and a whistle on the windiest days.
- It opens on today's date and the time now, and keeps time with the real clock until you move either slider. Now goes back to it.

## 0.11.0, 6 November 2026

- Sunlight indoors. Shafts of sunlight show in the air where the sun comes in through the windows, with the window bars in them. For each pixel a shader steps along the view ray through the sun's shadow map, so they appear wherever sunlight really crosses a room: through the kitchen windows in the late afternoon, the bedroom's, the ballroom's in the morning, and down through the pool's glass roof. There is a switch for them (Sunbeams indoors).
- The rooms are no longer too dark. The eye adapts as you go in by day, as it does in a real house, so the sunlit patches and the windows are bright. The rooms keep more of the daylight that the sunlit floors, walls and gallery would bounce around. (The great hall never gets direct sun: the gallery round it catches the light from its high windows. So that bounced light was all it had, and there was too little of it.)
- Faster on Balanced and High. The ambient-occlusion pass had been turning its transparency mode back on every frame, which drew the scene twice more and emptied the sun's shadow map. Now it doesn't, and the great hall went from about 45–50 to 60 frames a second at the same resolution.

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
