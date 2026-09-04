import * as THREE from 'three'
import gsap from 'gsap'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import Experience from './Experience.js'
import { WIRE_LAYER } from './World/Wireframe.js'
import { quality } from './Utils/flags.js'

/**
 * Entry reveal + vignette + film grain, applied after tone mapping.
 *
 * The reveal is a mosaic dissolve: the frame starts as coarse blocks on black,
 * blocks pop in one by one, the block size halves in steps down to a single
 * pixel, and colour rises out of greyscale. Driven by a single uReveal in [0,1].
 */
const FinalShader = {
    uniforms: {
        tDiffuse: { value: null },
        tWire: { value: null },
        uTime: { value: 0 },
        uVignette: { value: 0.34 },
        uGrain: { value: 0.018 },
        uReveal: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main()
        {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform sampler2D tWire;
        uniform float uTime;
        uniform float uVignette;
        uniform float uGrain;
        uniform float uReveal;
        uniform vec2 uResolution;
        varying vec2 vUv;

        float hash(vec2 p)
        {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main()
        {
            float r = clamp(uReveal, 0.0, 1.0);

            // Block size steps down 64, 32, 16, 8, 4, 2, 1 as the reveal advances
            float level = floor(mix(6.0, 0.0, pow(r, 1.9)) + 0.0001);
            float blockPx = pow(2.0, level);

            vec2 grid = max(uResolution / blockPx, vec2(1.0));
            vec2 cell = floor(vUv * grid);
            vec2 blockUv = (cell + 0.5) / grid;

            // Snap to block centres early on, back to full detail at the end
            vec2 sampleUv = mix(blockUv, vUv, smoothstep(0.84, 1.0, r));
            vec4 color = texture2D(tDiffuse, sampleUv);

            // Each block has its own moment of appearing; lit blocks come first
            float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            float threshold = hash(cell + level * 41.0) * 0.92 - min(luma, 0.6) * 0.3;
            float appear = smoothstep(threshold, threshold + 0.12, r);
            appear = mix(appear, 1.0, smoothstep(0.9, 1.0, r));
            color.rgb *= appear;

            // Colour rises out of greyscale
            float grey = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
            color.rgb = mix(vec3(grey), color.rgb, smoothstep(0.35, 1.0, r));

            // The room is drawn as white edges first, then the lines fade out
            float wire = (1.0 - smoothstep(0.2, 0.72, r)) * step(0.001, 1.0 - r);
            color.rgb += texture2D(tWire, vUv).rgb * wire;

            vec2 p = vUv - 0.5;
            float d = length(p * vec2(1.15, 1.0));
            float vig = smoothstep(0.85, 0.25, d);
            color.rgb *= mix(1.0, vig, uVignette);

            float g = hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5;
            color.rgb += g * uGrain;

            gl_FragColor = color;
        }
    `,
}

const SAMPLES = 2

export default class Renderer
{
    constructor()
    {
        this.experience = new Experience()
        this.canvas = this.experience.canvas
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.camera = this.experience.camera
        this.time = this.experience.time
        this.debug = this.experience.debug
        this.theme = this.experience.theme
        this.world = null
        this.wantsReport = new URLSearchParams(window.location.search).has('mem')

        this.setInstance()
        this.setEnvironment()
        this.setPostProcessing()
        this.setSleep()
        this.setDebug()
    }

    /**
     * Hands the framebuffer back while the tab is in the background.
     *
     * The two composer targets are the largest allocation the app makes and
     * they are worth nothing to a tab nobody is looking at: rAF is already
     * stopped, so the pixels they hold are the last frame the visitor saw,
     * which the compositor has its own copy of. Shrinking them to a pixel
     * releases the video memory for as long as the tab is away.
     *
     * Resize rather than dispose, and go through the same call the window
     * resize uses. A program is keyed on the format it renders into and not
     * on the size, so this cannot cost a recompile — where tearing the
     * composer down and building a new one would risk exactly that, and a
     * recompile on the frame the visitor comes back is worse than the memory.
     */
    setSleep()
    {
        this.asleep = false

        document.addEventListener('visibilitychange', () =>
        {
            if (document.hidden) this.sleep()
            else this.wake()
        })
    }

    sleep()
    {
        // Never mid-load. Everything before the first frame is built against
        // these targets, prewarm included; the gain is not worth reasoning
        // about a resize landing in the middle of that.
        if (this.asleep || !this.world?.dressed) return
        this.asleep = true

        this.composer.setPixelRatio(1)
        this.composer.setSize(1, 1)
        if (!this.revealReleased) this.wireTarget.setSize(1, 1)
    }

    wake()
    {
        if (!this.asleep) return
        this.asleep = false

        // resize() already restores every one of them from sizes, including
        // the wire target and the uResolution the final pass reads.
        this.resize()
    }

    /** Soft image-based ambient so PBR surfaces read like a modern render. */
    setEnvironment()
    {
        const pmrem = new THREE.PMREMGenerator(this.instance)
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        this.scene.environmentIntensity = this.theme.envIntensity
        pmrem.dispose()
    }

    setInstance()
    {
        this.instance = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false, // MSAA happens on the composer target
            powerPreference: 'high-performance',
        })
        this.instance.setSize(this.sizes.width, this.sizes.height)
        this.instance.setPixelRatio(this.sizes.pixelRatio)
        this.instance.shadowMap.enabled = true
        this.instance.shadowMap.type = THREE.PCFSoftShadowMap
        // Static room: the maps are rendered when something actually
        // changes, not sixty times a second for an identical result.
        this.instance.shadowMap.autoUpdate = false
        this.instance.shadowMap.needsUpdate = true
        this.instance.toneMapping = THREE.ACESFilmicToneMapping
        this.instance.toneMappingExposure = this.theme.exposure

        RectAreaLightUniformsLib.init()
    }

    setPostProcessing()
    {
        const target = new THREE.WebGLRenderTarget(
            this.sizes.width * this.sizes.pixelRatio,
            this.sizes.height * this.sizes.pixelRatio,
            // Two samples rather than four. The composer allocates this target
            // twice and multisamples both, so the sample count is a multiplier
            // on the single biggest allocation in the app, paid twice. The
            // difference between 2x and 4x on these surfaces is not worth what
            // 4x costs.
            { type: THREE.HalfFloatType, samples: quality.samples ?? SAMPLES },
        )

        this.composer = new EffectComposer(this.instance, target)
        this.composer.setPixelRatio(this.sizes.pixelRatio)
        this.composer.setSize(this.sizes.width, this.sizes.height)

        this.renderPass = new RenderPass(this.scene, this.camera.instance)
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.sizes.width, this.sizes.height),
            0.32,  // strength
            0.55,  // radius
            0.95,  // threshold (HDR: only emissives above this bloom)
        )
        this.outputPass = new OutputPass()
        this.finalPass = new ShaderPass(FinalShader)
        this.finalPass.uniforms.uResolution.value.set(
            this.sizes.width * this.sizes.pixelRatio,
            this.sizes.height * this.sizes.pixelRatio,
        )

        // Separate target for the wireframe overlay, composited in the final
        // pass. It exists only for the opening seconds; see releaseReveal().
        this.wireTarget = new THREE.WebGLRenderTarget(
            this.sizes.width * this.sizes.pixelRatio,
            this.sizes.height * this.sizes.pixelRatio,
        )
        this.finalPass.uniforms.tWire.value = this.wireTarget.texture

        this.composer.addPass(this.renderPass)
        if (quality.bloom) this.composer.addPass(this.bloomPass)
        this.composer.addPass(this.outputPass)
        this.composer.addPass(this.finalPass)
    }

    setDebug()
    {
        if (!this.debug.active) return

        const f = this.debug.ui.addFolder('Renderer')
        f.add(this.instance, 'toneMappingExposure').min(0).max(3).step(0.01).name('Exposure')
        f.add(this.bloomPass, 'strength').min(0).max(2).step(0.01).name('Bloom strength')
        f.add(this.bloomPass, 'radius').min(0).max(1).step(0.01).name('Bloom radius')
        f.add(this.bloomPass, 'threshold').min(0).max(2).step(0.01).name('Bloom threshold')
        f.add(this.finalPass.uniforms.uVignette, 'value').min(0).max(1).step(0.01).name('Vignette')
        f.add(this.finalPass.uniforms.uGrain, 'value').min(0).max(0.3).step(0.005).name('Grain')
        f.add(this.finalPass.uniforms.uReveal, 'value').min(0).max(1).step(0.005).name('Reveal')
    }

    /** Mosaic dissolve: blocks pop in, sharpen, and colour rises from greyscale. */
    reveal(duration = 2.6, delay = 0.15)
    {
        const u = this.finalPass.uniforms.uReveal

        // `?reveal=0.4` (or the older `?sat=`) pins the value, for screenshots
        const params = new URLSearchParams(window.location.search)
        const forced = params.get('reveal') ?? params.get('sat')
        if (forced !== null && !Number.isNaN(parseFloat(forced)))
        {
            u.value = parseFloat(forced)
            return Promise.resolve()
        }

        if (duration <= 0)
        {
            u.value = 1
            return Promise.resolve()
        }
        return new Promise((resolve) =>
        {
            gsap.to(u, { value: 1, duration, delay, ease: 'power1.inOut', onComplete: resolve })
        })
    }

    resize()
    {
        this.instance.setSize(this.sizes.width, this.sizes.height)
        this.instance.setPixelRatio(this.sizes.pixelRatio)
        this.composer.setPixelRatio(this.sizes.pixelRatio)
        this.composer.setSize(this.sizes.width, this.sizes.height)
        this.finalPass.uniforms.uResolution.value.set(
            this.sizes.width * this.sizes.pixelRatio,
            this.sizes.height * this.sizes.pixelRatio,
        )
        // Once the reveal has handed this back, a resize must not grow it
        // again: nothing draws into it any more.
        if (!this.revealReleased)
        {
            this.wireTarget.setSize(
                this.sizes.width * this.sizes.pixelRatio,
                this.sizes.height * this.sizes.pixelRatio,
            )
        }
    }

    /**
     * Every program and texture the room can ask for, made ready before
     * anything is drawn.
     *
     * Left to itself the renderer compiles a shader the first time an object
     * is drawn, on the main thread, and with a dozen lights in every fragment
     * shader one compile is a third of a second here. Drawn as it was built,
     * the room paid that one material at a time behind the loader — twenty
     * seconds of frozen frames — and paid it again for whatever the arrival
     * view could not see, on the frame the camera first turned that way.
     * Everything is compiled here instead, in parallel where the driver
     * allows, and update() draws nothing until it has.
     *
     * The compile has to see the composer's target. A program is keyed on
     * what it renders into: output colour space and tone mapping both change
     * between the screen and a float target, and compiled against the wrong
     * one the whole set is useless.
     */
    async prewarm()
    {
        const renderer = this.instance
        const camera = this.camera.instance
        const started = performance.now()

        renderer.setRenderTarget(this.composer.readBuffer)
        const compiled = renderer.compileAsync(this.scene, camera)
        renderer.setRenderTarget(null)

        try
        {
            await compiled
        }
        catch (error)
        {
            console.warn('[renderer] shader prewarm failed', error)
        }

        const seen = new Set()
        this.scene.traverse((object) =>
        {
            if (!object.isMesh) return
            const materials = Array.isArray(object.material) ? object.material : [object.material]
            for (const material of materials)
            {
                if (!material) continue
                for (const value of Object.values(material))
                {
                    if (!value || !value.isTexture || seen.has(value)) continue
                    seen.add(value)
                    renderer.initTexture(value)
                }
            }
        })

        this.prewarmMs = Math.round(performance.now() - started)
    }

    /** Shoots the layer-1 wireframe into its own target while it is still visible. */
    renderWireframe()
    {
        const camera = this.camera.instance
        camera.layers.set(WIRE_LAYER)
        this.instance.setRenderTarget(this.wireTarget)
        this.instance.setClearColor(0x000000, 1)
        this.instance.clear()
        this.instance.render(this.scene, camera)
        this.instance.setRenderTarget(null)
        camera.layers.set(0)
    }

    /**
     * What the framebuffer actually costs, behind `?mem`.
     *
     * Worth having as a switch rather than a one-off: this scene's memory is
     * dominated by buffers whose size nobody can read off the code, because it
     * depends on the window and the display. Guessing at it was how half a
     * gigabyte went unnoticed.
     */
    report()
    {
        const { memory, render } = this.instance.info
        const px = this.sizes.width * this.sizes.pixelRatio * this.sizes.height * this.sizes.pixelRatio
        const mb = (bytes) => Math.round(bytes / 1048576)

        // Two half-float targets, multisampled, plus the bloom pyramid.
        const composer = px * 8 * SAMPLES * 2
        const bloom = px * 0.25 * 8 * 3

        console.log(
            `[mem] ${Math.round(px / 1e6)} MP at dpr ${this.sizes.pixelRatio.toFixed(2)}`,
            `· composer ~${mb(composer)} MB`,
            `· bloom ~${mb(bloom)} MB`,
            `· wire ${this.revealReleased ? 'released' : `~${mb(px * 4)} MB`}`,
        )
        console.log(
            `[mem] ${memory.geometries} geometries · ${memory.textures} textures`,
            `· ${render.calls} draw calls · ${render.triangles.toLocaleString()} triangles`,
            `· ${this.instance.info.programs.length} programs, prewarmed in ${this.prewarmMs ?? '?'} ms`,
            performance.memory ? `· js heap ${mb(performance.memory.usedJSHeapSize)} MB` : '',
        )
    }

    /**
     * Hands back what the opening sequence was using.
     *
     * The wireframe is a one-shot: a full-screen target plus a merged buffer of
     * every edge in the room, both dead weight for the rest of the session. The
     * target is resized to a single pixel rather than disposed, because the
     * final shader still samples it and a disposed texture would have to be
     * guarded on every frame instead.
     */
    releaseReveal()
    {
        if (this.revealReleased) return
        this.revealReleased = true

        this.wireTarget.setSize(1, 1)

        const wireframe = this.world?.wireframe?.object
        if (wireframe)
        {
            wireframe.removeFromParent()
            wireframe.geometry.dispose()
            wireframe.material.dispose()
        }
    }

    update()
    {
        // Nothing is drawn until the room is dressed. The loader covers the
        // canvas until then, and drawing earlier is what compiled every
        // shader on the main thread; see prewarm().
        if (!this.world?.dressed) return

        // Belt and braces: visibilitychange fires before rAF resumes, so this
        // should never be true here. It is cheaper than a frame drawn into a
        // one-pixel target if that order ever stops holding.
        if (this.asleep) return

        this.finalPass.uniforms.uTime.value = this.time.elapsed

        if (this.finalPass.uniforms.uReveal.value < 0.75) this.renderWireframe()
        else this.releaseReveal()

        this.composer.render()

        if (this.wantsReport && !this.reported && this.world?.dressed)
        {
            this.reported = true
            this.report()
        }
    }
}
