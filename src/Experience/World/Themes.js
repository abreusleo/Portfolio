/**
 * Style variants for the "modern basement" direction.
 * Switch with ?theme=mono (or oak / sand). Default: oak.
 */
export const themes = {
    // Warm, cosy modern: walnut slat wall, oak desk, 3000K light
    oak: {
        label: 'Oak — warm modern',
        plaster: '#6b655c',
        slatWood: '#6b4630',
        slatBack: '#1d1712',
        floor: '#3d3c3a',
        deskWood: '#a97e50',
        metal: '#131316',
        fabric: '#33322f',
        rug: '#2f2e2c',
        accent: '#ff8a3d',
        lightWarm: '#ffd3a6',
        lightNeutral: '#ffe6cd',
        lightMul: 1,
        envIntensity: 0.3,
        background: '#0d0e10',
        fog: [7, 24],
        exposure: 1.15,
    },

    // Monochrome studio: black slats, cool neutral light, no wood
    mono: {
        label: 'Mono — black & cool',
        plaster: '#5f6166',
        slatWood: '#26282c',
        slatBack: '#131417',
        floor: '#434548',
        deskWood: '#2e3034',
        metal: '#0f1012',
        fabric: '#2a2c30',
        rug: '#303237',
        accent: '#eef2f8',
        lightWarm: '#e8eefc',
        lightNeutral: '#f2f6ff',
        lightMul: 1.1,
        envIntensity: 0.34,
        background: '#0b0c0e',
        fog: [7, 24],
        exposure: 1.12,
    },

    // Brighter gallery basement: light plaster, pale oak, soft warm light
    sand: {
        label: 'Sand — bright plaster',
        plaster: '#9a9186',
        slatWood: '#a87c50',
        slatBack: '#4a3b2c',
        floor: '#67635e',
        deskWood: '#c0a077',
        metal: '#1a1a1c',
        fabric: '#4a4741',
        rug: '#57534c',
        accent: '#e2603a',
        lightWarm: '#ffe0bd',
        lightNeutral: '#fff0dd',
        lightMul: 1.35,
        envIntensity: 0.5,
        background: '#14140f',
        fog: [8, 28],
        exposure: 1.1,
    },
}

export function pickTheme()
{
    const name = new URLSearchParams(window.location.search).get('theme')
    return themes[name] ? { key: name, ...themes[name] } : { key: 'oak', ...themes.oak }
}
