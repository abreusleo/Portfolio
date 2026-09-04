import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

import EventEmitter from './EventEmitter.js'
import Experience from '../Experience.js'

/**
 * Asset pipeline. Ready for GLB (Draco), KTX2 lightmaps and plain textures.
 * Sources are described in ../sources.js as { name, type, path }.
 * type: 'gltfModel' | 'texture' | 'ktx2Texture'
 */
export default class Resources extends EventEmitter
{
    constructor(sources)
    {
        super()

        this.experience = new Experience()
        this.renderer = this.experience.renderer.instance

        this.sources = sources
        this.items = {}
        this.toLoad = this.sources.length
        this.loaded = 0
        // 'ready' fires once. Anything built after it has to be able to ask.
        this.ready = false
        this.progress = 0

        this.setLoaders()
        this.startLoading()
    }

    setLoaders()
    {
        const base = import.meta.env.BASE_URL

        this.loaders = {}

        this.loaders.draco = new DRACOLoader()
        this.loaders.draco.setDecoderPath(`${base}draco/`)

        this.loaders.ktx2 = new KTX2Loader()
        this.loaders.ktx2.setTranscoderPath(`${base}basis/`)
        this.loaders.ktx2.detectSupport(this.renderer)

        this.loaders.gltf = new GLTFLoader()
        this.loaders.gltf.setDRACOLoader(this.loaders.draco)
        this.loaders.gltf.setKTX2Loader(this.loaders.ktx2)
        // Meshopt for geometry: it decodes on the main thread, where Draco
        // spins up a worker. Same order of compression, and it is the only one
        // of the two that can be verified in a headless screenshot.
        this.loaders.gltf.setMeshoptDecoder(MeshoptDecoder)

        this.loaders.texture = new THREE.TextureLoader()
    }

    startLoading()
    {
        if (this.toLoad === 0)
        {
            // Let listeners attach first
            setTimeout(() => { this.ready = true; this.trigger('ready') }, 0)
            return
        }

        for (const source of this.sources)
        {
            // Every load counts, including the ones that fail. Without the
            // error branch a single missing file leaves the counter short of
            // 100% and the visitor stuck on the loading gate forever, which is
            // a far worse outcome than the blockout it would have replaced.
            const failed = (error) =>
            {
                console.warn(`[resources] ${source.name} did not load from ${source.path}`, error)
                this.sourceLoaded(source, null)
            }

            switch (source.type)
            {
                case 'gltfModel':
                    this.loaders.gltf.load(source.path, (file) => this.sourceLoaded(source, file), undefined, failed)
                    break
                case 'texture':
                    this.loaders.texture.load(source.path, (file) => this.sourceLoaded(source, file), undefined, failed)
                    break
                case 'ktx2Texture':
                    this.loaders.ktx2.load(source.path, (file) => this.sourceLoaded(source, file), undefined, failed)
                    break
                default:
                    console.warn(`Unknown source type "${source.type}" for ${source.name}`)
                    this.sourceLoaded(source, null)
            }
        }
    }

    sourceLoaded(source, file)
    {
        this.items[source.name] = file
        this.loaded++
        this.progress = this.loaded / this.toLoad
        this.trigger('progress', this.progress)

        if (this.loaded === this.toLoad)
        {
            this.ready = true
            this.trigger('ready')
        }
    }
}
