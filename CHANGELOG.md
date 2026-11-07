# Changelog

Every release is a git tag (`git tag` lists them). The panel shows which version you are
looking at: "v0.10.0" when it is exactly a release, "v0.10.0 + changes" when there is
work since. To run an earlier release next to the current one, see "Versions" in the
README (`npm run versions`, `npm run serve:version -- v0.8.0`).

Numbering: the middle number goes up for new features, the last one for fixes to the
release before. The first number becomes 1 when the viewer is finished.

## 0.42.0, 7 November 2026

The crows, and the chimney smoke.

- **Crows in autumn** (Sights): over two hundred crows, a dense, dark mass over the house with ragged edges, already in the picture as the sight opens, coming in from the right and wheeling overhead for a minute and a half, with the din of a whole flock (a new recording: "Crows singing" by IgnasD, CC0) over the single caws. The evening flocks going to roost are bigger too (70 to 130).
- **Chimney smoke**: thin wisps rising from the chimneys, many small faint puffs overlapping, instead of a string of round balls; a jump in the date or the time clears the smoke of before (it hung on from a cold night into an October afternoon).

## 0.41.0, 7 November 2026

Animals, Santa on the roof, New Year towards the gate.

- **Father Christmas lands on the roof**: every other time he comes over on Christmas Eve (the first time of the evening too), he turns in along the ridge of the front roof and lands, the reindeer standing there for half a minute, now and then one with its head down, the bells shaken and a "ho ho ho"; then off along the ridge and up. In the *Santa's sleigh* flyby the sleigh lands on the ridge too, a few seconds' stop, before going on.
- **Reindeer**: CDmir's realistic deer, made grey-brown, on Quaternius's gallop (CC0), instead of the low-poly stag.
- **The horse**: a realistic horse (Lyndon Daniels's, CC0) on Quaternius's animations. At the door after the hunt it now stands out on the gravel in front of the porch, side-on, instead of with its head in the wall; the hound that noses about moved to the other side.
- **Red deer**: they now walk (their own models on Quaternius's walk and gallop) instead of a slowed run.
- **Rabbits**: CDmir's realistic rabbit (CC0), which hops, sits up and sits; it replaces the low-poly one and its credit.
- **Easter Sunday**: nine rabbits out all day on the lawns either side of the fountain and along the front, hopping about among the daffodils and the eggs; they scatter as you come close and come back out half a minute later.
- **New Year towards the gate**: the fireworks now go up in the fields beyond the gate, and "Happy New Year" and the year are written over the drive outside it, reading from the house. The *New Year* flyby starts by the porch looking out past the fountain to the gate for the countdown, then rises and flies out over the gate through the year, turns back round the house high up, and ends over the roof looking out to the gate and the fireworks. *Holidays › New Year* stands you by the porch facing the gate.
- The camera paths are clear of walls and trees (the trees by the gate moved a little away from the path, and the front oak a little west).
- The chimney smoke at night is a faint veil instead of grey puffs.

## 0.40.0, 7 November 2026

The opening view, Reset, the outdoor lights' switch, and darker glass.

- **Where you start**: on the front lawn under an oak, its leaves over the top of the picture, the porch straight ahead and a rearing horse in stone on a plinth to the right, through a longer lens (as in the picture of the front Tudor liked). As soon as you move, the lens eases back to the usual one while you keep looking at the house. Also in the Place menu as *Under the oak*.
- **The statue**: "Horse Statue 01" by Rico Cilliers (Poly Haven, CC0), made garden-sized, in the same weathered stone as the dolphin on the fountain, on a plinth of the house's dressed stone. Walking, it stops you.
- **Reset** (in the buttons at the bottom of the panel): back to the start, on foot, with today's date, the time now and the real weather.
- **Outdoor** (beside Room and House under Lights): the lamps, floodlights and lanterns outside and the assault course's lights, all off or on at once; by day it moves the clock on to the evening first, as House does.
- **Glass**: from outside by day the windows are dark and mirror the sky and the trees, as in TRJTA's renders; from inside they stay clear to look out through.

## 0.39.0, 7 November 2026

As in TRJTA's pictures: a place for each of his renders Tudor sent, the planting, trees, sky and sunlight to match.

- **Places**: under *As in TRJTA's pictures* in the Place menu, TRJTA 1 to 17 (the same camera as each picture, with its lens, and a summer afternoon under fair-weather clouds; the rooms at an hour when the sun comes in), and *Through the gate* and *By the fountain*. A place's longer lens holds until you move, then eases back to the usual one while you keep looking at the same thing.
- **Trees**: each crown is lit as a volume, bright on the sunny side and dark underneath and inside, with leaf-to-leaf colour; the light inside a crown is green, not the sky's blue.
  - Woods close behind the side and back walls: a belt of 58 real trees and 1,500 more as billboards behind them, the estate in its clearing; parkland trees in front.
  - The two big trees inside the gate are taller and closer in, their crowns over the wall.
  - The far trees are lighter and greener.
- **Garden** (`src/garden.js`):
  - A clipped hedge along the back of the low wall to the assault course, its ends turning in beside the path through it.
  - Shrub borders inside the side walls and in clumps round the course and among its crates; shrubs under the balcony.
  - Long grass in drifts in the course and along the foot of the walls outside, mown in front of the hedge; it goes to straw in late summer.
  - Small leafy plants outside the front wall by the gate, dying back in winter.
  - Clipped evergreens: cones in the pots by the front door, tiered balls in the pots by the kitchen door, cones and a tall column in the planting along the front.
  - On the balcony: a clipped bay on a stem and a bird of paradise in a white pot (the iron chairs are the model's own).
  - A trolley with a T-bar on the zip line.
  - Smoke from three chimneys on cold days: by the real temperature with the live weather, otherwise the season's and the hour's.
- **Sunlight indoors**: the sun's shadows close in round you inside (a centimetre a texel instead of seven), so the windows land on the floors and walls in their shapes, and the sun that comes in is twice as bright. On foot outside they cover the ground ahead of you, so the shade under the trees is sharper.
- **Colours**: the crates a warm pine, the stone dressings sandstone, the roof a browner tile, the lawn a deeper green, the hall's black-and-white floor no longer blue.
- **Sky**: *Fair-weather clouds* are big white heaps of cumulus.
- Speed, at 1400 × 850, adaptive quality off: 47 to 60 fps (the front 60, the course 54, over the gate 50, the hall 56, the gate at night 47).

## 0.38.1, 7 November 2026

QA: speed, security, the interface.

- Fixed:
  - Choosing *Deer at dawn* before the hounds had loaded broke the hunt; they now join it when they arrive.
  - The *Santa's sleigh* flyby was nearly silent: the sleigh bells now ring just ahead of you all the way, with his "ho ho ho" now and then (in its videos too).
  - A loading tip read awkwardly.
- Checked:
  - Speed, at 1400 × 850 with the adaptive quality off:

    | Scene | fps |
    |---|---|
    | An ordinary night at the front | 40 |
    | Christmas Eve night at the front | 46 |
    | Bonfire Night at the front | 46 |
    | Bonfire Night by the fire | 33 |
    | The Halloween storm | 46 |
    | *Deer at dawn* | 38 to 41 |
    | The sleigh ride | 61 |

    The view in through the gate runs at about 30 fps on any night; Christmas Eve's lights add little.
  - Loading: about 7 to 10 s here, against 19 s before 0.34.0.
  - A video of the new flyby exports, with its sound.
  - Every camera path, the new one too, is clear of walls and trees. Walking and the tour work as before.
  - The loading screen fits a phone.
  - Security: no dependency has a known vulnerability. Nothing new reaches an outside service or writes HTML; the new sounds and models are the viewer's own files.
- Known:
  - Nobody has heard the new recordings yet (fireworks, a shot, hounds, a horse, sleigh bells, "ho ho ho"); their levels are set by measurement only.
  - The hounds are husky and wolf models recoloured: no free animated hound or beagle exists. The red deer have no walk of their own, so their slow walk is their run, slowed.
  - The Halloween figure is seen best from the west, coming along the front; straight on, the window's mullions hide much of it.

## 0.38.0, 7 November 2026

Tudor's notes of 7 November, the fifth part: Christmas Eve.

- From Christmas Eve to Twelfth Night the house is dressed more:
  - a wreath on the front door;
  - light strings round the front windows, with a candle on each sill;
  - a tall fir on the lawn with coloured lights wound round it and a gold star on top, and small lit firs in tubs either side of the door;
  - fairy lights in more of the trees;
  - lights wound up the gate's pillars and along the wall either side of the gate.
- On Christmas Eve night Father Christmas crosses the sky every few minutes: his sleigh, eight galloping reindeer, the lead one's nose glowing red, and a trail of sparkles. His sleigh bells and his "ho ho ho" come from far off as he passes.
- A new flyby, *Santa's sleigh*: ride with him, the reindeer galloping on ahead of you, over the lit gate, the drive, the roofline, round above the house and past the tree, then up into the night.

## 0.37.0, 7 November 2026

Tudor's notes of 7 November, the fourth part: Deer at dawn.

- Better deer: red deer, hinds and stags, with real coats and antlers, grazing, looking round and running. The herd is a dozen now.
- *Deer at dawn* (Sights) is a little scene:
  - You arrive high above the field in the low golden sun, with the herd grazing below.
  - A few seconds later a shot rings out from the woods, and the deer bolt out of the field and are gone.
  - Then the hounds come home, out of the field, through the gate and up the drive, the view following them. Two wait at the front door, one drinks from the fountain and one noses about the gravel.
  - A saddled horse stands at the door, waiting for its rider, shifting its weight and snorting now and then.
  - Drag the view at any time to take over.

## 0.36.0, 7 November 2026

Tudor's notes of 7 November, the third part: real fireworks, and the cat's adventures.

- The fireworks sound real: recorded bangs, some with their crackling tail, glitter after some, and rockets whistling as they climb. Near ones are loud, further ones muffled, and far ones are a dull thud with an echo, all arriving late by the distance.
- The cat now and then:
  - chases a mouse: it breaks from the foot of the wall, the cat crouches, then goes after it, and the mouse escapes into the shrubs with a squeak;
  - is chased by a terrier, which comes galloping across the lawn barking. The cat hisses and bolts round the corner of the house; the dog sniffs where it went, barks once more and trots off down the drive. The cat stays away a while.
- New models and recordings for this and the next releases, all CC0, credited in `public/animals/LICENSE.txt` and `public/sounds/LICENSE.txt`: hounds, a terrier, a mouse, a horse, red deer, Santa's sleigh and Santa; fireworks, a shot, hounds, a horse, sleigh bells and "ho ho ho".

## 0.35.0, 7 November 2026

Tudor's notes of 7 November, the second part: Halloween and the lightning.

- The Halloween flyby:
  - A candle lights in every room as you fly past, one after another: its flame on the sill, the room behind warm round it. At the far end a close strike puts out the lights, and every candle goes out with them.
  - The dark figure is no longer at a window. It stands in the middle of the room behind the big window over the front door, and a candle on the floor below the sill throws its long shadow up the wall behind it. As you draw level the lightning strikes and it is gone.
- Halloween on foot: now and then that figure is in the room behind the big window while you are outside in front. It goes after a while, or once you have looked at it a moment, or at a flash.
- Lightning, more like the real thing:
  - A bolt draws itself down from the cloud in a fraction of a second, then flashes three to five times down the same path at uneven intervals, now and then with a lingering glow. The cloud lights up where the bolt leaves it, and the branches go dark before the main channel.
  - A near strike lights everything as the sun would, blue-white and from the bolt's side: the house, the trees and the window frames throw hard shadows, and indoors the flash comes in at the windows in their shapes, across the floor.
  - The strikes the flybys call for (Halloween, the hall at the end of *Through the gate* with seasons) land in front of the house, where you see them and their light comes in.
- Fixed: the big window over the front door, and the wide one on the east wing, were missed when finding the windows. Their middles fall on stone mullions.

## 0.34.0, 7 November 2026

Tudor's notes of 7 November, the first part: loading, the birds, the bonfire, the assault course, your light.

- Loading:
  - It says what it is doing, and changes the moment each step is done: downloading the house (with the megabytes), unpacking it, laying out the grounds, mapping the walls for walking, growing the trees, the finishing touches one by one, the shaders, the textures going up to the graphics card (counted), the first view. No more time left.
  - A tip under the bar while you wait, a new one every few seconds.
  - Twice as quick: about 10 s here instead of 19. The long wait at the end was the Easter daffodils (4 s, finding the grass one triangle at a time; now a search tree) and the textures (3 s; most now go up while the collision tree is built in its worker, when the page is idle).
- Birds sing and call only in spring and summer, March to August. In autumn and winter only the crows and magpies do.
- The fox screams only on Halloween night; the rest of the year the fox is silent.
- No church bells on Easter Sunday.
- Bonfire Night:
  - The bonfire is smaller: about two and a half metres, between the last two sizes.
  - Much more smoke, dark against the night sky and lit from below by the fire.
  - The fireworks leave their smoke hanging where they burst, lit up by each new burst.
  - Other bonfires far off on the hills all round, each a flickering point with its smoke going up, and now and then someone else's fireworks low over the horizon, the bang arriving seconds later.
- The assault course: no floodlight poles. Instead, LED strips round the foot and the top of every crate, with a soft glow on the sand, to guide the way in the dark. (The crates are found from their own planks, including the ones standing at an angle.)
- Your light:
  - A torch (a flashlight) you can see in your right hand, its beam where you look and a faint cone of it in the air.
  - A flaming torch with its flame at the end of the stick: many small tongues of fire, an uneven flicker, the odd spark, the head charred and glowing.
  - The glow round you is larger.
  - What you hold is drawn over everything, so it never goes into a wall.

## 0.33.1, 7 November 2026

QA: speed, security, the interface.

- Fixed:
  - On a phone, the walking keys sat over the bottom of the panel. The panel now stops above them and scrolls.
  - The line at the top (an Easter egg found) stays on one line on a narrow screen.
- Quicker:
  - The crow flocks, the Halloween effects and your light no longer make garbage every frame. That was a new vector and matrix for every bird, every frame.
  - Your light does no work while it is off.
- Checked:
  - Speed: loading takes about 8 s from this machine. The flybys run at 45 to 60 fps at full Retina size, and night is about a third faster than in 0.31.0 (see 0.32.0).
  - Videos export with the new scenes and sounds.
  - Security: no dependency has a known vulnerability; the saved light choice is checked against the menu before use; nothing new writes HTML or reaches an outside service.
  - Every camera path is clear of walls and trees.
- Known:
  - The Halloween flyby still stutters for about a second as it starts, while the dusk storm's shaders compile. Compiling them all before it moves was slower (3 s here), so it stays as it is.
  - The page's script is 5.3 MB, about the same as before: 3.9 MB of it is the tree generator's own pictures, built into the library.

## 0.33.0, 7 November 2026

- Wildlife, each at its own time of year and day, not every day and never many at once, with real recordings of their calls:
  - crows in autumn, flocks crossing the sky or wheeling over the trees, more towards evening
  - a red kite circling high
  - wood pigeons on the roof, cooing, and a collared dove
  - a robin that comes down near you in the garden and sings
  - magpies on the lawns
  - rabbits at dawn and dusk in spring and summer, bolting when you come near
  - a fox crossing the lawn at night, and foxes screaming or barking in the fields
  - a black cat about the front of the house some mornings and evenings
  - mallards on the fountain or the water by the assault course
- Some May mornings one of the deer wanders up to graze just outside the gate.
- New Sights in the Holidays menu: *Deer at dawn*, *A rainbow* and *Crows in autumn*.

## 0.32.0, 7 November 2026

- Run, beside Walk, Orbit and Fly: you walk at a run, and Shift walks.
- Your light, in the panel: while you walk at night, a soft glow round you, a flashlight, or a flaming torch. It is remembered.
- Night lights: lanterns at the gateway, uplights in the fountain, and safety lights on the assault course (a floodlight pole at each corner and amber markers along the boxes).
- Faster at night, by about a third: only 18 real lights are lit at once, handed each frame to the ones that matter from where you are. It looks the same. Measured at 2400×1350 against 0.31.0:

  | View, at night | 0.31.0 | 0.32.0 |
  |---|---|---|
  | The front | 28 fps | 37 fps |
  | The hall | 43 fps | 52 fps |
  | The gallery | 44 fps | 49 fps |
  | The assault course | 35 fps | 46 fps |

## 0.31.0, 7 November 2026

- Easter, worked out for each year (28 March in 2027), in the Holidays menu and as a flyby:
  - Daffodils come out across the estate from mid-March to late April: clumps along the drive, round the oaks at the gate and along the lawns. They nod in the wind and go over.
  - Over the Easter weekend, a dozen painted eggs are hidden on the lawns. Walk up to one to find it; a chime and a line at the top count them.
  - On Easter morning the village church's bells ring across the fields.
  - The *Easter Sunday* flyby goes low over the daffodils and the eggs, then up over the house.

## 0.30.0, 7 November 2026

- The tour is always a clear midsummer afternoon, with the sun raking across the front and in at the windows. Your own time, date and weather come back when it ends.
- *Through the gate* with seasons and weathers ticked has its own seasons, each where it belongs: winter outside the gate, Halloween at dusk as it goes through, summer near the house, a sunny afternoon as it comes in at the window, then in the hall, all at once, a thunderstorm with lightning lighting the room.
- Bonfire Night: the bonfire is half as big again (about three metres high), out on the open lawn well clear of the oak it stood under.
- Christmas Eve is at dusk (16:00), light enough to see the house in the snow, in its flyby and from the Holidays menu.
- New Year:
  - "Happy New Year" is written over 2027.
  - The flyby's ending turns back and circles the house from high up, the fireworks bursting over it, rather than flying on into them.
- Fireworks look more like the real thing:
  - Sparks streak along their paths.
  - They burn white-hot, then their colour, then die orange.
  - They slow hard in the air.
  - New kinds of burst: peonies with a heart of another colour, gold chrysanthemums, palms and crackling glitter.
  - Sparks passing close to the camera stay thin.

## 0.29.0, 7 November 2026

- Halloween at dusk, in a storm and fog (*Storm in the fog*, also in the Weather menu), light enough to see, dark enough to be eerie. The house is dark, and the front door stands ajar, stirring in the wind.
- The ghosts are gone. Nothing is a show that repeats now; each thing happens once in a while, for a moment:
  - A figure at a window: only one at a time, and the next comes a long while later, at another window.
  - Stand by the front door a little while and a dark figure is standing in the gateway behind you. Look at it, or wait for the lightning, and it is gone.
  - After a close strike the lights outside may fail for a few seconds. The pumpkins' candles stay lit.
- The *Halloween night* flyby: a figure at a window ahead as you fly along the front, then someone walking the upstairs rooms with a candle. As the candle goes, the lightning strikes close and the lights fail.

## 0.28.0, 7 November 2026

- The loading bar moves at the real pace, steadily to the end, with the time left under it. It had filled with the download and then sat near the end for most of the rest. Loading is also quicker: nothing is drawn behind the loading screen any more, which had slowed the collision tree from 1 s to 5 s.
- The stars are the real ones (4,103 from the Yale Bright Star Catalogue), where they are over Surrey at that moment. They wheel round the Pole Star through the night and turn with the Compass slider. Orion, the Plough and Sirius are where they should be.
- The pale band on the far hills at dusk is gone. It was the evening sky drawn in front of the farthest hills, and a grey haze lighter than the sky; the hills are now deep blue silhouettes. A moon still behind the hills no longer glows through them.
- The moon fades while the date runs fast, rather than whirling round the sky. Its path is right (checked against astronomy-engine to 3°): this autumn it swings far north and south, so on some days it only skims the southern hills, and on Halloween evening it is just rising in the east-north-east.

## 0.27.2, 7 November 2026

- A shorter pause as Bonfire Night or New Year begins: the bonfire's lights now stay in the scene all year (dark), so its arrival no longer recompiles every shader.

## 0.27.1, 7 November 2026

- Halloween: the ghosts' moans are louder and carry across the lawn; beyond a few metres they had been almost silent, in videos too.

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
