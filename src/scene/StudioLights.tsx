/**
 * How far from the light's aim the shadow map reaches, in millimeters.
 *
 * Three.js defaults a directional light's shadow camera to a 10mm box, which on
 * a design measured in hundreds of millimeters means a patch the size of a
 * fingernail is the only place shadows exist at all — and a piece dragged into
 * that patch grows one out of nowhere. This covers the largest design either
 * product can make: a quarter-metre of lettering, three lines of it, and picks
 * below that.
 *
 * It is a fixed box rather than one fitted to the design because the shadow map
 * is a fixed number of texels either way, and a box that resized as you typed
 * would change how sharp every shadow is while you worked.
 */
const SHADOW_EXTENT_MM = 420;

/**
 * Where the key light sits.
 *
 * Only the *direction* of this reaches the shading — it is a directional light,
 * so the position merely says where its shadow camera stands. It stands a good
 * way back, because that camera has to have the whole design in front of it and
 * the tallest one reaches further from the origin than a close light would be.
 */
const KEY_LIGHT_POSITION: [number, number, number] = [240, 420, 360];

/**
 * The studio's lighting, the same in both themes.
 *
 * Only the room changes with the theme, never the light: the job here is to
 * show what a filament will actually look like, and a design that shifted
 * colour when the UI theme did would be lying about the thing being printed.
 *
 * One key light casting shadows, one fill from behind and below to keep the
 * unlit faces from going flat, and enough ambient that nothing is ever black.
 * The key light's shadow is what makes an inlay read as inlaid — the name
 * stands a couple of millimeters proud of the initial, and without a shadow
 * that is a colour change rather than a step.
 */
export function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight
        position={KEY_LIGHT_POSITION}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_EXTENT_MM}
        shadow-camera-right={SHADOW_EXTENT_MM}
        shadow-camera-top={SHADOW_EXTENT_MM}
        shadow-camera-bottom={-SHADOW_EXTENT_MM}
        shadow-camera-near={1}
        shadow-camera-far={1100}
        // Against shadow acne at this scale: one texel of that box is a shade
        // over 0.4mm, so the depth comparison needs about that much slack.
        // Nudging along the surface normal rather than in depth keeps the
        // inlay's own shadow attached to it instead of floating off.
        shadow-normalBias={0.45}
      />
      <directionalLight position={[-100, 60, -80]} intensity={0.35} />
    </>
  );
}
