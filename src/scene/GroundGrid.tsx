import { Grid } from '@react-three/drei';

/**
 * The ground the design stands on: a grid ruled in real millimeters, so it
 * doubles as a ruler. One cell is a centimeter, one heavier section line is
 * five.
 */
const CELL_MM = 10;
const SECTION_MM = 50;

/**
 * How far from the camera's spot on the floor the grid fades out completely.
 * Orbit allows up to 1000mm of camera distance, so this has to reach well past
 * the biggest design to stop the floor ending in mid-air.
 */
const FADE_MM = 900;

/**
 * Just below the floor. Parts rest exactly on y=0, and the contact shadow sits
 * at y=-0.1; dropping the grid under both keeps it from z-fighting a flat
 * printed bottom and lets the shadow darken it rather than the reverse.
 */
const GRID_Y_MM = -0.2;

/**
 * A ruled floor under the design, so its size reads against something instead
 * of floating in empty space.
 *
 * Deliberately rendered outside the group the camera fits itself to — the grid
 * is scenery, and framing the view to it would zoom away from the design.
 */
export function GroundGrid() {
  return (
    <Grid
      position={[0, GRID_Y_MM, 0]}
      // Spans ±(1 + FADE_MM) because `infiniteGrid` scales the plane by that
      // factor: a 2x2 plane therefore reaches past where the fade has already
      // gone fully transparent, instead of ending in a visible square edge.
      args={[2, 2]}
      infiniteGrid
      fadeDistance={FADE_MM}
      fadeStrength={1.5}
      cellSize={CELL_MM}
      cellThickness={0.6}
      cellColor="#cfcabb"
      sectionSize={SECTION_MM}
      sectionThickness={1.1}
      sectionColor="#a39a8a"
    />
  );
}
