// The guided tour and the flybys.
//
// The tour is a series of shots. Each shot is one smooth camera move inside one space
// (the grounds, the great hall, the ballroom...). Between shots it cuts, with a quick dip
// to black, rather than flying through walls. Every move can be checked against the
// collision tree (see `checkPath`), and the viewer does so once walking is ready.
//
// Flybys are long single moves in the style of the old Tomb Raider flyby cameras: the
// camera banks into its turns (a roll about the view axis, as a quaternion, on top of
// the look direction), and a slight fisheye bends the edges of the picture.

import * as THREE from 'three';
import { nextEaster } from './easter.js';

// A key is [camera position, look-at point, options]. Options: caption, speed (metres a
// second at this key; it changes smoothly to the next key's), roll (degrees, flybys).
const k = (pos, look, o = {}) => ({ pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look), ...o });

export const TOUR = [
  {
    keys: [
      k([62, 30, 96], [5, 4, -20], { caption: 'Croft Manor', speed: 4 }),
      k([32, 17, 80], [5, 4, -14], { speed: 10 }),
      k([9, 8.5, 62], [5, 3, 12], { speed: 6 }),
      k([5, 4, 44], [4.6, 2.4, 18], { caption: 'The gate', speed: 3.2 }),
      k([4.6, 2.1, 28], [4.6, 2.0, 12], { speed: 2.4 }),
      k([4.6, 2.0, 20.5], [4.6, 2.1, 8.4], { speed: 1.8 }),
      k([4.6, 2.3, 15], [4.6, 2.0, 8.4], { caption: 'The fountain', speed: 1.5 }),
      k([0.9, 2.2, 10.4], [4.6, 2.0, 7.4], { speed: 1.8 }),
      k([-1.4, 2.0, 4.2], [-1.85, 2.2, -8], { speed: 2 }),
      k([-1.85, 1.85, 0.5], [-1.85, 1.9, -12], { caption: 'The front door', speed: 1.6 }),
      k([-1.85, 1.75, -9.6], [-1.85, 2.1, -20], { speed: 1.5 }),
      k([-1.85, 1.8, -14.5], [-1.6, 3.6, -24], { caption: 'The great hall', speed: 1.3 }),
      k([-1.7, 3.2, -18], [-1.5, 5.4, -24], { speed: 0.5 }),
    ],
  },
  {
    keys: [
      k([-7.9, 5.0, -12.8], [-7.6, 4.7, -24], { caption: 'The gallery', speed: 0.6 }),
      k([-7.9, 5.0, -16.5], [0, 2.6, -19], { speed: 1.2 }),
      k([-7.4, 5.0, -21.2], [3, 3, -16], { speed: 0.5 }),
    ],
  },
  {
    keys: [
      k([10.6, 1.75, -27.6], [-6, 1.9, -27.6], { caption: 'The ballroom', speed: 0.6 }),
      k([4, 1.75, -26.4], [-6, 2.4, -29], { speed: 1.4 }),
      k([-5.5, 1.75, -26.2], [-7, 2.6, -32], { speed: 0.5 }),
    ],
  },
  {
    keys: [
      k([-9.7, 1.65, -20.4], [-13.5, 1.0, -25.5], { caption: 'The kitchen', speed: 0.5 }),
      k([-10.6, 1.65, -22.5], [-13.6, 1.1, -19.6], { speed: 0.9 }),
      k([-12.2, 1.65, -24.6], [-12.4, 1.2, -19], { speed: 0.4 }),
    ],
  },
  {
    keys: [
      k([19.6, 6.6, -22.9], [26, 4.8, -26.4], { caption: 'The pool', speed: 0.6 }),
      k([24, 6.8, -22.9], [27, 4.6, -27.5], { speed: 1.2 }),
      k([28.6, 6.6, -24.5], [21, 4.8, -27], { speed: 0.5 }),
    ],
  },
  {
    keys: [
      k([-13.2, 7.3, -19.9], [-11, 6.3, -24], { caption: 'The bedroom', speed: 0.5 }),
      k([-12.2, 7.3, -19.8], [-12.8, 6.4, -24.5], { speed: 0.4 }),
    ],
  },
  {
    keys: [
      k([6.4, 9.3, -27], [-8, 8.9, -27], { caption: 'The attic', speed: 0.5 }),
      k([0, 9.3, -27.2], [-8, 8.8, -26.6], { speed: 1.2 }),
      k([-4, 9.3, -27], [-9, 8.6, -25.6], { speed: 0.4 }),
    ],
  },
  {
    keys: [
      k([36, 13, -36], [10, 3, -70], { caption: 'The assault course', speed: 2 }),
      k([24, 15, -45], [-4, 3, -80], { speed: 6 }),
      k([2, 21, -42], [-4, 2, -78], { speed: 8 }),
      k([-26, 24, -38], [5, 4, -22], { speed: 9 }),
      k([-62, 31, 30], [5, 4, -22], { caption: 'Croft Manor', speed: 2 }),
    ],
  },
];

/** A circuit round the house, rising and falling, for the time-lapse flybys (a = 0 is in front). */
function circuit(start, radius, height, turns = 1, speed = 6) {
  const keys = [];
  const n = Math.round(14 * turns);
  const c = [5, 0, -22];
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2 * turns;
    const r = radius * (1 + 0.12 * Math.sin(a * 2 + 0.7));
    const y = height + 6 * Math.sin(a * 1.5);
    keys.push(k([c[0] + Math.sin(a) * r, y, c[2] + Math.cos(a) * r], [c[0], 6, c[2] + 1], { speed }));
  }
  return keys;
}

// The cuts of the seasons-and-weathers flyby, also laid over any other flyby when the panel's
// "With seasons and weathers" is ticked: every few seconds another season, time and weather.
export const SCENES = {
  what: 'scenes',
  every: 3,
  scenes: [
    { day: 95, hours: 12, weather: 'overcast' }, // early spring, grey
    { day: 112, hours: 13, weather: 'rain' }, // an April shower
    { day: 118, hours: 18.2, weather: 'clear', wet: 1, label: 'After the rain' }, // the sun out after an April shower: a rainbow
    { day: 128, hours: 13, weather: 'clouds' }, // spring, fluffy clouds
    { day: 165, hours: 14, weather: 'clear' }, // early summer
    { day: 196, hours: 19.5, weather: 'clear' }, // a summer evening
    { day: 205, hours: 17.5, weather: 'storm' }, // a July thunderstorm
    { day: 232, hours: 15, weather: 'clouds' }, // late summer
    { day: 290, hours: 13, weather: 'clear' }, // autumn gold
    { day: 300, hours: 14, weather: 'rain' }, // autumn rain
    { day: 318, hours: 9, weather: 'fog' }, // a November morning
    { day: 340, hours: 15.5, weather: 'overcast' }, // December dusk
    { day: 8, hours: 12, weather: 'snow', first: true }, // heavy snow falling (always the first cut)
    { day: 16, hours: 13, weather: 'clear' }, // snow lying, blue sky
    { day: 26, hours: 10, weather: 'fog' }, // freezing fog
  ],
};

// The tour's light: a clear midsummer afternoon, the sun in the south-west raking across the
// front and in at the windows (your own time, date and weather come back after it)
export const TOUR_LIGHT = { day: 172, hours: 16, weather: 'clear' };

export const FLYBYS = {
  estate: {
    label: 'Over the estate',
    keys: [
      k([4.6, 2.6, 36], [4.6, 2.2, 12], { speed: 5 }),
      k([4.6, 2.2, 28], [4.6, 2.0, 12], { speed: 8 }),
      k([4.6, 2.0, 21], [4.6, 2.2, 8.4], { speed: 8 }),
      k([4.6, 3.0, 13.5], [8, 2.2, 6], { speed: 8 }),
      k([12.5, 4.4, 6], [4.6, 2, 8.4], { speed: 8 }),
      k([6, 4, -0.5], [4.6, 2, 8.4], { speed: 8 }),
      k([-10, 5, 3.5], [0, 5, -11], { speed: 9 }),
      k([-19, 9, -6], [-10, 9, -20], { speed: 10 }),
      k([-22, 17, -30], [0, 8, -24], { speed: 11 }),
      k([-2, 21, -42], [6, 9, -22], { speed: 11 }),
      k([24, 19, -40], [22, 5, -25], { speed: 10 }),
      k([40, 14, -20], [22, 5, -24], { speed: 9 }),
      k([23, 13, -3], [5, 5, -16], { speed: 9 }),
      k([10, 18, 42], [4, 4, -14], { speed: 6 }),
      k([4.5, 26, 72], [4, 3, -10], { speed: 2.5 }),
    ],
  },
  gate: {
    label: 'Through the gate',
    // the classic: from just outside the gate, through the gateway and up past the fountain,
    // in through the window over the front door (a lancet 40 cm wide), over the landing and
    // round the great hall
    keys: [
      k([4.6, 1.8, 31], [4.6, 2.3, 8.4], { speed: 2.6 }),
      k([4.6, 2.1, 25], [4.6, 2.6, 6], { speed: 4.5 }),
      k([4.6, 2.3, 20.7], [3.4, 3.6, 2], { speed: 4.5 }),
      k([4.2, 3.4, 15], [0, 5.2, -6], { speed: 4.5 }),
      k([2.2, 4.9, 6.5], [-1.45, 5.4, -12], { speed: 4.2 }),
      k([-0.4, 5.35, 0.5], [-1.45, 5.45, -14], { speed: 3.6 }),
      k([-1.45, 5.4, -5], [-1.45, 5.5, -16], { speed: 2.6 }),
      k([-1.45, 5.45, -9.42], [-1.2, 5.3, -18], { speed: 2.2 }),
      k([-1.45, 5.65, -12.4], [0.5, 4.2, -20], { speed: 2.6 }),
      k([0.6, 4.7, -16], [-3, 4.2, -22], { speed: 3 }),
      k([2.2, 4.4, -19.5], [-4, 4, -18], { speed: 3 }),
      k([-1.5, 5.4, -22], [-4, 3, -14], { speed: 3 }),
      k([-5.4, 4.6, -18.5], [0, 3, -13], { speed: 3 }),
      k([-3.6, 3.2, -14.6], [0.7, 1.8, -22], { speed: 2.2 }),
      k([-0.8, 2.3, -17], [0.7, 1.8, -26], { speed: 0.8 }),
    ],
    // with "With seasons and weathers" ticked, its own seasons, each where it belongs: winter
    // outside the gate, Halloween at dusk as it goes through, summer as it nears the house, a
    // sunny afternoon as it comes in at the window, and in the hall, all at once, a thunderstorm
    // (at: seconds into the flyby; strikes: lightning that many seconds after the cut)
    seasons: {
      what: 'scenes',
      script: true,
      scenes: [
        { at: 0, day: 16, hours: 12.5, weather: 'snow', label: 'Winter' },
        { at: 2.5, day: 303, hours: 16.6, weather: 'eerie', label: 'Halloween' },
        { at: 5.8, day: 180, hours: 13.5, weather: 'clear', label: 'Summer' },
        { at: 11.1, day: 196, hours: 16.5, weather: 'clear', label: 'A summer afternoon' },
        { at: 16.4, day: 205, hours: 17.5, weather: 'storm', label: 'Thunderstorm', strikes: [0.15, 3.4] },
      ],
    },
  },
  lift: {
    label: 'Rising over the gate',
    // from the drive a little way outside, the house framed by the gateway, straight up into the air
    keys: [
      k([4.6, 1.5, 33], [4.6, 3.2, 0], { speed: 0.7 }),
      k([4.6, 4, 33.1], [4.6, 3.4, 0], { speed: 2.4 }),
      k([4.6, 12, 33.5], [4.5, 3, -5], { speed: 3.4 }),
      k([4.6, 24, 34.2], [4.3, 2, -11], { speed: 3 }),
      k([4.6, 36, 35], [4.1, 1, -16], { speed: 0.8 }),
    ],
  },
  circle: {
    label: 'Circling the manor',
    // from the front of the house, spinning round it twice, high up (with "With seasons and
    // weathers" ticked, the seasons cut by as it goes)
    keys: circuit(0, 66, 28, 2, 17),
  },
  easter: {
    label: 'Easter Sunday',
    holiday: true,
    // Easter Sunday morning in the spring sun, the church bells ringing across the fields: low over
    // the daffodils along the drive, through the gate and over the lawns where the eggs are hidden,
    // round towards the house, and up over it
    lapse: { what: 'scenes', every: 1e9, fixed: true, scenes: [{ day: nextEaster(), hours: 10.2, weather: 'clear', label: 'Easter Sunday' }] },
    keys: [
      k([4.6, 1.0, 36], [2.4, 0.4, 28], { speed: 1.6 }),
      k([3.4, 1.0, 28.5], [4.6, 1.2, 18], { speed: 2.2 }),
      k([4.6, 1.4, 21], [1.5, 0.4, 13], { speed: 2.6 }),
      k([2.4, 1.1, 15], [-3.4, 0.2, 9.2], { speed: 2.2 }),
      k([-2.5, 1.2, 11.5], [-8.2, 0.2, 4.4], { speed: 2.2 }),
      k([-8.5, 1.8, 8], [-2, 3, -6], { speed: 2.8 }),
      k([-7, 6, 4], [3, 6, -12], { speed: 3.4 }),
      k([2, 14, 14], [4, 4, -12], { speed: 3.4 }),
      k([8, 22, 34], [5, 4, -12], { speed: 1 }),
    ],
  },
  halloween: {
    label: 'Halloween night',
    holiday: true,
    // 31 October at dusk, a storm in the fog: through the gate and down the drive to the pumpkins
    // by the front door, standing ajar, then up along the front at the height of the windows: the
    // house is dark, but someone walks the upstairs rooms with a candle, a figure stands at a
    // window ahead for a moment, and as the candle goes the lightning strikes close and the
    // lights fail; then away over the garden (the seasons tick box doesn't apply)
    lapse: { what: 'scenes', every: 1e9, fixed: true, scenes: [{ day: 303, hours: 16.6, weather: 'eerie', halloween: true, label: 'Storm in the fog' }] },
    keys: [
      k([4.6, 1.8, 30], [4.6, 2.2, 10], { speed: 2.4 }),
      k([4.6, 2.0, 20.7], [0, 1.8, 8], { speed: 3 }),
      k([0.6, 1.8, 14], [-8, 1.4, 9], { speed: 3 }),
      k([-5, 1.9, 9.5], [-1.85, 1, -6], { speed: 2.6 }),
      k([-1.85, 1.6, 0.5], [-1.85, 0.6, -7], { speed: 1.6 }),
      k([-1.85, 1.9, -3.4], [-1.85, 0.9, -9], { speed: 0.9 }),
      k([-4.5, 4.2, -0.5], [-8, 4.6, -9.4], { speed: 2.2 }),
      k([-10, 4.6, -2.5], [-12, 4.6, -9.4], { speed: 2.2 }),
      k([2, 5.2, -1.5], [6, 4.6, -9.4], { speed: 2.4 }),
      k([12, 4.8, -1.5], [16, 4.6, -9.4], { speed: 2.4 }),
      k([22, 4.8, -1], [26, 4.2, -9.4], { speed: 2.2 }),
      k([24, 7, 10], [12, 1.5, 8], { speed: 2.6 }),
      k([12, 12, 26], [2, 3, 0], { speed: 1.2 }),
    ],
  },
  bonfire: {
    label: 'Bonfire Night',
    holiday: true,
    // 5 November, a clear evening: low past the bonfire on the lawn, round it, up through its
    // smoke and on over the roof into the fireworks bursting behind the house, round among them,
    // and back out in front to see the house under them (boost: more rockets, more salvos)
    lapse: { what: 'scenes', every: 1e9, fixed: true, scenes: [{ day: 308, hours: 19.75, weather: 'clear', boost: 2.6 }] },
    keys: [
      k([28.4, 1.6, 14.2], [20, 1.9, 10], { speed: 1.4 }),
      k([25, 1.4, 13], [19.6, 2.3, 9.4], { speed: 1.8 }),
      k([24.5, 1.7, 8.2], [19.8, 3.2, 10.4], { speed: 1.8 }),
      k([23.2, 5.2, 9], [20.5, 14, 9.6], { speed: 2 }),
      k([22.7, 10.5, 10.2], [12, 26, -14], { speed: 2.6 }),
      k([16, 17, 10], [6, 40, -48], { speed: 3.6 }),
      k([12, 27, 3], [5, 42, -54], { speed: 4.5 }),
      k([8, 36, -16], [4, 48, -56], { speed: 4.5 }),
      k([-4, 41, -40], [-14, 46, -60], { speed: 4 }),
      k([-24, 36, -36], [5, 30, -52], { speed: 4 }),
      k([-26, 28, 0], [5, 18, -36], { speed: 4.5 }),
      k([-6, 24, 26], [5, 18, -38], { speed: 3.4 }),
      k([6, 22, 34], [5, 16, -40], { speed: 1 }),
    ],
  },
  christmas: {
    label: 'Christmas Eve',
    holiday: true,
    // 24 December at dusk, snowing: in over the lit gate, down the drive under the two oaks' lights,
    // round the fountain and up to the roofline, along the whole front with its chasing lights and
    // icicles, and away to see the house lit up in the snow (boost: the lights chase all the way)
    lapse: { what: 'scenes', every: 1e9, fixed: true, scenes: [{ day: 357, hours: 16, weather: 'snow', boost: 1 }] },
    keys: [
      k([4.6, 6, 42], [4.6, 3.5, 12], { speed: 3 }),
      k([4.6, 2.8, 29], [4.6, 3.4, 12], { speed: 4 }),
      k([4.6, 2.2, 21.5], [4.6, 3.6, 10], { speed: 3.4 }),
      k([4.6, 2.0, 15.5], [1.5, 7.5, 12.5], { speed: 2.4 }),
      k([4.2, 2.4, 11.6], [8.5, 7.5, 13], { speed: 2.4 }),
      k([1.2, 3.2, 7.5], [-3, 8, -9.5], { speed: 3 }),
      k([-5, 7.5, -1.5], [-13, 9.5, -10], { speed: 3.4 }),
      k([-12.5, 9.5, -2], [-15, 10, -10], { speed: 2.4 }),
      k([-6, 10, -1.5], [2, 9.5, -10], { speed: 3.6 }),
      k([6, 10, -1.5], [14, 9.5, -10], { speed: 4 }),
      k([17, 10, -1.5], [25, 9.5, -10], { speed: 4 }),
      k([26, 10.5, -0.5], [28, 9.5, -9], { speed: 2.6 }),
      k([24, 13, 12], [8, 6, -10], { speed: 3.4 }),
      k([10, 18, 34], [5, 6, -10], { speed: 3 }),
      k([4.6, 22, 52], [4.6, 6, -10], { speed: 1 }),
    ],
  },
  santa: {
    label: "Santa's sleigh",
    holiday: true,
    // Christmas Eve, late, a clear night over the snow: you ride with Father Christmas, the sleigh's
    // front below you and the eight reindeer galloping on ahead (santa.js). In from the south,
    // high, down over the lit gate and up the drive over the fountain, up over the roofline and
    // round above the house, a swoop past the big tree on the lawn, and away up into the night
    lapse: { what: 'scenes', every: 1e9, fixed: true, scenes: [{ day: 357, hours: 21.5, weather: 'clear', boost: 1, santa: true }] },
    keys: [
      k([60, 70, 220], [32, 56, 150], { speed: 14 }),
      k([26, 48, 128], [10, 30, 62], { speed: 13 }),
      k([9, 26, 64], [5, 17, 28], { speed: 11 }),
      k([4.6, 17, 31], [4.6, 17, 2], { speed: 9 }),
      k([4.6, 19, 6], [3, 24, -20], { speed: 9 }),
      k([1, 25, -12], [-10, 26, -30], { speed: 9 }),
      k([-13, 27, -26], [-6, 27, -46], { speed: 9 }),
      k([2, 28, -44], [20, 27, -40], { speed: 9 }),
      k([22, 26, -32], [26, 20, -6], { speed: 9 }),
      k([24, 15, -2], [12, 9, 12], { speed: 8 }),
      k([8, 16, 20], [-12, 30, 50], { speed: 10 }),
      k([-14, 34, 52], [-50, 60, 110], { speed: 12 }),
      k([-46, 60, 104], [-90, 80, 170], { speed: 14 }),
    ],
  },
  newyear: {
    label: 'New Year',
    holiday: true,
    // 31 December, ten seconds to midnight, the clock running: still on the drive by the fountain
    // as the last seconds count down, then up into the midnight fireworks as "Happy New Year" and
    // the year are written in the sky, on towards them, through the year, then turning back to
    // circle the house from high up with the fireworks bursting over it
    // (years: the seconds into the flyby at which the year is written: just after midnight, and as
    // the camera comes up to where it hangs, so it flies through it)
    lapse: { what: 'scenes', every: 1e9, fixed: true, scenes: [{ day: 364, hours: 24 - 11 / 3600, weather: 'clear', run: true, boost: 2.2, years: [12.8, 27, 42.2] }] },
    keys: [
      k([4.6, 1.7, 18], [4.6, 5, -10], { speed: 0.34 }),
      k([4.6, 1.9, 14], [4.6, 8, -10], { speed: 0.4 }),
      k([4.6, 6, 11], [4.8, 26, -40], { speed: 3.5 }),
      k([4.7, 20, 7], [5, 36, -44], { speed: 4.5 }),
      k([4.9, 31, -2], [5, 36, -44], { speed: 2.2 }),
      k([5, 34.5, -22], [5, 36, -60], { speed: 1.6 }),
      k([5, 36, -44], [5, 40, -70], { speed: 2.6 }),
      // then turning back, and round the house from high up, the fireworks bursting over it
      k([-6, 40, -68], [7, 8, -21], { speed: 3.4 }),
      k([-40, 31, -54], [7, 8, -21], { speed: 4.2 }),
      k([-57, 27, -15], [7, 8, -21], { speed: 4.2 }),
      k([-42, 25, 26], [7, 8, -21], { speed: 4.2 }),
      k([-6, 23, 42], [7, 9, -21], { speed: 3.4 }),
      k([22, 21, 38], [8, 11, -24], { speed: 1 }),
    ],
  },
  hall: {
    label: 'The great hall',
    keys: [
      // (straight in: from the porch, the front door swinging open ahead of you)
      k([-1.85, 1.8, -3.5], [-1.85, 2.0, -14], { speed: 4 }),
      k([-1.85, 1.8, -10], [-1.85, 2.4, -20], { speed: 4.5 }),
      k([-1.6, 2.3, -13.8], [-3, 4.4, -22], { speed: 3.5 }),
      k([0.9, 3.4, -16.5], [-4, 4.4, -22], { speed: 3.2 }),
      k([2.2, 4.4, -19.5], [-4, 4, -18], { speed: 3 }),
      k([-1.5, 5.4, -22], [-4, 3, -14], { speed: 3 }),
      k([-5.4, 4.6, -18.5], [0, 3, -13], { speed: 3 }),
      k([-3.6, 3.0, -14], [0.7, 1.6, -24], { speed: 3 }),
      k([0.7, 1.8, -19], [0.7, 1.8, -27], { speed: 2.5 }),
      k([0.8, 1.7, -24.8], [6, 1.8, -27], { speed: 2.4 }),
      k([4.5, 1.7, -26.2], [11, 1.9, -26.5], { speed: 3 }),
      k([10.5, 1.8, -26.4], [-6, 2.2, -28], { speed: 1 }),
    ],
  },
  round: {
    label: 'Round the manor',
    keys: [
      k([-24, 17, 14], [6, 6, -20], { speed: 5 }),
      k([-35, 18, -12], [6, 6, -21], { speed: 11 }),
      k([-31, 19, -44], [6, 6, -21], { speed: 11 }),
      k([-6, 20, -60], [6, 6, -21], { speed: 11 }),
      k([24, 20, -58], [8, 6, -21], { speed: 11 }),
      k([44, 19, -38], [8, 6, -21], { speed: 11 }),
      k([47, 20, -10], [8, 5, -20], { speed: 11 }),
      k([32, 19.5, 14], [6, 5, -18], { speed: 10 }),
      k([8, 14, 24], [2, 6, -14], { speed: 6 }),
      k([-1.85, 17, 8], [-1.85, 9, -16], { speed: 2 }),
    ],
  },
  grounds: {
    label: 'The grounds',
    keys: [
      k([-38, 2.8, 36], [-10, 2.2, 26], { speed: 4 }),
      k([-14, 2.4, 27], [10, 2.2, 25], { speed: 9 }),
      k([8, 2.4, 25.5], [24, 2.6, 22], { speed: 9 }),
      k([21, 2.8, 25], [32, 3, 10], { speed: 9 }),
      k([30, 4.2, 18], [30, 2.6, -4], { speed: 9 }),
      k([27, 3, 2], [40, 3, -22], { speed: 9 }),
      k([40, 3.2, -18], [42, 3, -46], { speed: 9 }),
      k([42, 3.4, -46], [30, 4, -62], { speed: 9 }),
      k([30, 7, -60], [0, 3, -75], { speed: 9 }),
      k([2, 7.5, -92], [-20, 3, -70], { speed: 9 }),
      k([-30, 6, -66], [-34, 3, -40], { speed: 9 }),
      k([-36, 4, -46], [-36, 3, -20], { speed: 9 }),
      k([-37, 3.2, -24], [-30, 3, 0], { speed: 9 }),
      k([-37, 3.2, -6], [-10, 3, 6], { speed: 9 }),
      k([-16, 3.2, 2], [4.6, 2, 8.4], { speed: 8 }),
      k([-3, 4.5, 9], [-1.85, 5, -11], { speed: 6 }),
      k([-1.85, 13, 3], [-1.85, 9, -16], { speed: 2 }),
    ],
  },
  assault: {
    label: 'The assault course',
    keys: [
      k([30, 16, -38], [10, 2, -62], { speed: 4 }),
      k([22, 6, -56], [5, 2, -68], { speed: 10 }),
      k([11, 3.4, -68], [-4, 2, -76], { speed: 10 }),
      k([2, 3.6, -68], [-8, 2, -80], { speed: 10 }),
      k([-6, 4, -72], [-10, 2, -86], { speed: 10 }),
      k([-14, 6, -86], [0, 2, -90], { speed: 10 }),
      k([2, 7, -94], [14, 3, -78], { speed: 10 }),
      k([16, 9, -80], [10, 2, -60], { speed: 9 }),
      k([24, 18, -54], [4, 4, -24], { speed: 4 }),
    ],
  },
};

const FADE = 0.4; // seconds to black and back at a cut
const FLYBY_FOV = 68; // the flyby lens (the fisheye magnifies the middle a little)

/** One continuous camera move along keys, with a smoothly changing speed. */
class Move {
  constructor(keys) {
    this.keys = keys;
    this.pos = new THREE.CatmullRomCurve3(keys.map((key) => key.pos), false, 'centripetal');
    this.look = new THREE.CatmullRomCurve3(keys.map((key) => key.look), false, 'centripetal');
    const n = keys.length - 1;
    const per = 120;
    const lengths = this.pos.getLengths(n * per);
    this.length = lengths[lengths.length - 1];
    // per stretch: its length, speeds at both ends, and how long it takes
    this.parts = [];
    let t0 = 0;
    for (let i = 0; i < n; i++) {
      const L = Math.max(1e-3, lengths[(i + 1) * per] - lengths[i * per]);
      const v0 = keys[i].speed ?? 2;
      const v1 = keys[i + 1].speed ?? v0;
      const time = Math.abs(v1 - v0) < 1e-3 ? L / v0 : (L / (v1 - v0)) * Math.log(v1 / v0);
      this.parts.push({ s0: lengths[i * per], L, v0, v1, t0, time });
      t0 += time;
    }
    this.duration = t0;
  }

  /** Curve parameter (0..1) at `time` seconds into the move, and the key passed most recently. */
  at(time) {
    const parts = this.parts;
    let i = 0;
    while (i < parts.length - 1 && time > parts[i].t0 + parts[i].time) i++;
    const p = parts[i];
    const t = THREE.MathUtils.clamp(time - p.t0, 0, p.time);
    // speed changes linearly with distance: s(t) solves ds/dt = v0 + (v1 - v0) s / L
    const a = (p.v1 - p.v0) / p.L;
    const s = Math.abs(a) < 1e-6 ? p.v0 * t : (p.v0 * (Math.exp(a * t) - 1)) / a;
    const u = (p.s0 + Math.min(s, p.L)) / this.length;
    const local = Math.min(1, s / p.L);
    // the key you are coming up to counts from halfway along (for captions)
    return { u: this.pos.getUtoTmapping(u), key: local > 0.55 ? i + 1 : i };
  }
}

/**
 * Checks camera moves against the collision tree: a ball of `radius` swept along each
 * move must not pass through anything, nor through a tree's crown. Returns the places
 * where it would, so a bad key can be found and fixed.
 */
export async function checkPath(moves, bvh, skip, { radius = 0.2, step = 0.15, crowns = [], allow = [] } = {}) {
  const { moveSphere } = await import('./walk.js');
  const problems = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const moved = new THREE.Vector3();
  moves.forEach((move, mi) => {
    const n = Math.ceil(move.length / step);
    move.pos.getPoint(0, a);
    for (let i = 1; i <= n; i++) {
      move.pos.getPointAt(i / n, b);
      moved.copy(b);
      moveSphere(bvh, a, moved, radius, skip);
      const at = () => b.toArray().map((x) => Math.round(x * 100) / 100);
      // (allow: places a path squeezes through on purpose, like the 40 cm window over the front door)
      if (moved.distanceTo(b) > 0.05 && !allow.some((box) => box.containsPoint(b))) problems.push({ move: mi, at: at(), by: Math.round(moved.distanceTo(b) * 100) / 100 });
      for (const c of crowns) {
        if (b.y < c.y0 || b.y > c.y1 + radius) continue;
        const d = Math.hypot(b.x - c.x, b.z - c.z);
        if (d < c.r * 0.8 + radius) problems.push({ move: mi, at: at(), tree: [Math.round(c.x), Math.round(c.z)] });
      }
      a.copy(b);
    }
  });
  return problems;
}

export class Tour {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {(text: string) => void} onCaption
   * @param {(alpha: number) => void} onFade 0 clear .. 1 black
   */
  constructor(camera, onCaption, onFade) {
    this.camera = camera;
    this.onCaption = onCaption;
    this.onFade = onFade;
    this.running = false;
    this.flyby = false;
    this.rate = 1; // playback speed (0 holds the frame)
    this.fisheye = 0; // 0..1, read by the renderer
    this._look = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._qRoll = new THREE.Quaternion();
    this._axis = new THREE.Vector3(0, 0, 1);
    this.tourMoves = TOUR.map((shot) => new Move(shot.keys));
    this.flybyMoves = Object.fromEntries(Object.entries(FLYBYS).map(([id, f]) => [id, new Move(f.keys)]));
  }

  get total() {
    return this.moves ? this.moves.reduce((s, m) => s + m.duration, 0) : 0;
  }

  /** Starts the tour, or the flyby with this id. */
  start(flybyId = null) {
    this.flyby = !!flybyId;
    this.flybyId = flybyId;
    this.moves = flybyId ? [this.flybyMoves[flybyId]] : this.tourMoves;
    this.shot = 0;
    this.t = 0;
    this.running = true;
    this._caption = null;
    this._roll = 0;
    this._heading = null;
    this._fovBase = this.camera.fov;
    this.onFade?.(0);
    this.onCaption?.('');
    // a flyby starts with its lens on: the fisheye and the wider view from the first frame
    this.fisheye = this.flyby ? 1 : 0;
    if (this.flyby) {
      this.camera.fov = FLYBY_FOV;
      this.camera.updateProjectionMatrix();
    }
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.fisheye = 0;
    this.onCaption?.('');
    this.onFade?.(0);
    if (this._fovBase) {
      this.camera.fov = this._fovBase;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * The running flyby's time-lapse ({ what, from, to } or the scenes) and how far through it is
   * (0..1), or null. `lapseOver` lays one over a flyby that has none (or replaces its own).
   */
  get lapse() {
    if (!this.running || !this.flyby) return null;
    const l = this.lapseOver ?? FLYBYS[this.flybyId]?.lapse;
    if (!l) return null;
    const move = this.moves[0];
    return { ...l, progress: THREE.MathUtils.clamp(this.t / move.duration, 0, 1), seconds: this.t };
  }

  /** Returns false when it has ended. */
  update(dt) {
    if (!this.running) return false;
    this.t += dt * this.rate;
    let move = this.moves[this.shot];
    // (rewinding: back into the shot before, or held at the very start)
    while (this.t < 0) {
      if (this.shot === 0) {
        this.t = 0;
        break;
      }
      this.shot--;
      move = this.moves[this.shot];
      this.t += move.duration;
      this._heading = null;
    }
    if (this.t > move.duration) {
      if (this.shot === this.moves.length - 1) {
        this.stop();
        return false;
      }
      this.t -= move.duration;
      this.shot++;
      move = this.moves[this.shot];
      this._heading = null;
    }
    const { u, key } = move.at(this.t);
    this.camera.position.copy(move.pos.getPoint(u));
    this._look.copy(move.look.getPoint(u));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._look);

    // a dip to black at each cut between shots
    const last = this.shot === this.moves.length - 1;
    const first = this.shot === 0;
    let black = 0;
    if (!last) black = Math.max(black, 1 - (move.duration - this.t) / FADE);
    if (!first) black = Math.max(black, 1 - this.t / FADE);
    this.onFade?.(THREE.MathUtils.clamp(black, 0, 1));

    if (this.flyby) this._bank(dt, move, u);

    // captions: the most recent key that has one, within this shot
    let caption = '';
    for (let i = Math.min(key, move.keys.length - 1); i >= 0; i--) {
      if (move.keys[i].caption) {
        caption = move.keys[i].caption;
        break;
      }
    }
    if (this.flyby) caption = '';
    if (caption !== this._caption) {
      this._caption = caption;
      this.onCaption?.(caption);
    }
    return true;
  }

  /** Flyby camera: lean into turns like a banking aircraft, and bend the edges a little. */
  _bank(dt, move, u) {
    this.camera.getWorldDirection(this._fwd);
    const heading = Math.atan2(this._fwd.x, this._fwd.z);
    let turn = 0;
    if (this._heading !== null && dt > 0) {
      let dh = heading - this._heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      turn = dh / dt; // radians a second, positive turning left
    }
    this._heading = heading;
    // bank into the turn: turning left rolls the horizon clockwise (left wing down)
    const want = THREE.MathUtils.clamp(turn * 0.42, -0.42, 0.42);
    this._roll += (want - this._roll) * (1 - Math.exp(-dt * 2.2));
    // the roll is a rotation about the camera's own view axis, composed onto its orientation
    this._qRoll.setFromAxisAngle(this._axis, this._roll);
    this.camera.quaternion.multiply(this._qRoll);
    this.fisheye = 1;
  }

  /** Where the camera is looking right now (for handing over to orbit). */
  get target() {
    return this._look;
  }
}
