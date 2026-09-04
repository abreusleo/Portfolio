/**
 * Camera stations (basement.studio-style navigation).
 * Each station is a fixed framing the camera travels to.
 * Step 2 adds one per hotspot (monitor, board, credenza, door...).
 * Later these will be read from named empties in the Blender GLB.
 */
export default {
    intro:    { position: [-2.75, 1.85, 2.35], target: [0.85, 1.2, -2.8], fov: 54 },
    overview: { position: [-2.15, 1.66, 1.6], target: [0.95, 1.16, -2.85], fov: 49 },
    tv:       { position: [1.75, 1.72, -0.28], target: [3.45, 1.76, -0.3], fov: 44, parallax: 0.2 },
    desk:     { position: [1.62, 1.25, -1.5], target: [1.66, 1.16, -2.8], fov: 46, parallax: 0.12 },
}
