// The eight ivy OBJs come centred on the origin, to be placed by hand (TRJTA placed
// them in Lumion). These spots are plain brick found by scanning the facades with rays.
// Each piece grows towards its local +z, so `face` is the wall's outward direction.

const SPOTS = {
  Ivy_Far_Left: { x: -12, z: -17.91, face: 'south' },
  Ivy_Left: { x: -8.6, z: -11.77, face: 'south' },
  Ivy_Right: { x: 5.4, z: -11.75, face: 'south' },
  Ivy_Right_on_House: { x: 13.4, z: -10.66, face: 'south' },
  Ivy_Far_Right: { x: 20.75, z: -13.91, face: 'south' },
  Ivy_Right_on_Pool: { x: 25.5, z: -21.69, face: 'south' },
  Ivy_Chimney: { x: 4.1, z: -31.69, face: 'north' },
  Ivy_Under_Balcony: { x: -11.6, z: -26.48, face: 'north' },
};

export function placeIvy(model) {
  const ivy = model.getObjectByName('Ivy');
  if (!ivy) return 0;
  let placed = 0;
  for (const piece of ivy.children) {
    const key = piece.name.replace(/[^A-Za-z_]/g, '_');
    const spot = SPOTS[key] ?? SPOTS[Object.keys(SPOTS).find((k) => key.includes(k.replace('Ivy_', '')))];
    if (!spot) continue;
    // the leaves' back face sits about 0.18 m behind the piece's origin
    const out = spot.face === 'south' ? 1 : -1;
    piece.position.set(spot.x, 0.04, spot.z + out * 0.2);
    piece.rotation.set(0, spot.face === 'south' ? 0 : Math.PI, 0);
    piece.updateMatrixWorld(true);
    placed++;
  }
  return placed;
}
