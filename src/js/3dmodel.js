import "../assets/modelDraco.glb";
// import "../lib/draco/draco_decoder.js";
// import "../lib/draco/draco_decoder.wasm";
// import "../lib/draco/draco_wasm_wrapper";


const THREE = window.THREE = require('three');


require('three/examples/js/loaders/GLTFLoader');
require('three/examples/js/loaders/DRACOLoader');
require('three/examples/js/loaders/DDSLoader');
require('three/examples/js/controls/OrbitControls');
require('three/examples/js/loaders/RGBELoader');
require('three/examples/js/loaders/HDRCubeTextureLoader');
require('three/examples/js/pmrem/PMREMGenerator');
require('three/examples/js/pmrem/PMREMCubeUVPacker');

let animationID;
let idleAnimation;

THREE.DRACOLoader.setDecoderPath('../lib/draco/');
// THREE.DRACOLoader.setDecoderConfig({ type: 'js' });
// THREE.DRACOLoader.getDecoderModule();

const DEFAULT_CAMERA = '[default]';

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// glTF texture types. `envMap` is deliberately omitted, as it's used internally
// by the loader but not part of the glTF format.
const MAP_NAMES = [
    'map',
    'aoMap',
    'emissiveMap',
    'glossinessMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
    'specularMap',
];

// const Preset = { ASSET_GENERATOR: 'assetgenerator' };

class Viewer {

    constructor(el) {
        this.el = el;
        // this.options = options;

        this.lights = [];
        this.content = null;
        this.mixer = null;
        this.clips = [];
        // this.gui = null;

        this.state = {
            // environment: options.preset === Preset.ASSET_GENERATOR
            //     ? 'Footprint Court (HDR)'
            //     : environments[1].name,
            // background: false,
            playbackSpeed: 1.0,
            actionStates: {},
            camera: DEFAULT_CAMERA,
            wireframe: false,
            skeleton: false,
            grid: false,

            // Lights
            addLights: true,
            exposure: 1.0,
            textureEncoding: 'sRGB',
            ambientIntensity: 0.3,
            ambientColor: 0xFFFFFF,
            directIntensity: 0.8 * Math.PI,
            directColor: 0xFFFFFF,
            bgColor1: '#ffffff',
            bgColor2: '#353535'
        };

        this.prevTime = 0;

        this.scene = new THREE.Scene();

        // const fov = options.preset === Preset.ASSET_GENERATOR
        //     ? 0.8 * 180 / Math.PI
        //     : 60;
        const fov = 60;
        this.defaultCamera = new THREE.PerspectiveCamera(fov, el.clientWidth / el.clientHeight, 0.01, 1000);
        this.activeCamera = this.defaultCamera;

        this.renderer = window.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.physicallyCorrectLights = true;
        this.renderer.gammaOutput = true;
        this.renderer.gammaFactor = 2.2;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0xffffff);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(el.clientWidth, el.clientHeight);

        this.controls = new THREE.OrbitControls(this.activeCamera, this.renderer.domElement);
        this.controls.autoRotate = false;
        this.controls.autoRotateSpeed = -10;
        this.controls.screenSpacePanning = true;

        // this.background = createVignetteBackground({
        //   aspect: this.defaultCamera.aspect,
        //   grainScale: IS_IOS ? 0 : 0.001, // mattdesl/three-vignette-background#1
        //   colors: [this.state.bgColor1, this.state.bgColor2]
        // });

        this.el.appendChild(this.renderer.domElement);

        this.cameraCtrl = null;
        this.cameraFolder = null;
        this.animFolder = null;
        this.animCtrls = [];
        this.morphFolder = null;
        this.morphCtrls = [];
        this.skeletonHelpers = [];
        this.gridHelper = null;
        this.axesHelper = null;

        // this.addGUI();
        // if (options.kiosk) this.gui.close();

        this.animate = this.animate.bind(this);
        this.resize();
        this.render();

        // requestAnimationFrame(this.animate);
        this.setControlsListener();
        window.addEventListener('resize', this.resize.bind(this), false);

    }

    setControlsListener() {
        this.controls.addEventListener("change", () => {
            this.render();
        });
    }


    animate(time) {

        requestAnimationFrame(this.animate);

        const dt = (time - this.prevTime) / 1000;

        this.controls.update();

        this.mixer && this.mixer.update(dt);
        this.render();

        this.prevTime = time;

    }

    render() {

        this.renderer.render(this.scene, this.activeCamera);

    }

    resize() {

        const { clientHeight, clientWidth } = this.el.parentElement;

        this.activeCamera.aspect = clientWidth / clientHeight;
        this.activeCamera.updateProjectionMatrix();
        this.renderer.setSize(clientWidth, clientHeight);


        if (clientWidth < 768) {
            this.defaultCamera.zoom = 1.5;
            this.defaultCamera.updateProjectionMatrix();
        }

        else if (clientWidth < 1025) {
            this.defaultCamera.zoom = 2;
            this.defaultCamera.updateProjectionMatrix();
        }

        this.render();
    }

    load(url) {

        // Load.
        return new Promise((resolve, reject) => {


            const loader = new THREE.GLTFLoader();
            loader.setCrossOrigin('anonymous');
            loader.setDRACOLoader(new THREE.DRACOLoader());
            const blobURLs = [];

            loader.load(url, (gltf) => {

                const scene = gltf.scene || gltf.scenes[0];
                const clips = gltf.animations || [];
                this.setContent(scene, clips);

                // blobURLs.forEach(URL.revokeObjectURL);

                // See: https://github.com/google/draco/issues/349
                THREE.DRACOLoader.releaseDecoderModule();

                resolve(gltf);

            }, undefined, reject);

        });

    }

    /**
     * @param {THREE.Object3D} object
     * @param {Array<THREE.AnimationClip} clips
     */
    setContent(object, clips) {

        this.clear();

        object.updateMatrixWorld();
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        this.size = size;

        // this.controls.reset();
        console.log(object.position.x, "object.position.x", object.position.y, object.position.z)
        console.log(object.position.x - center.x, "(object.position.x - center.x)", object.position.y - center.y, object.position.z - center.z)
        object.position.x += (object.position.x - center.x);
        object.position.y += (object.position.y - center.y);
        object.position.z += (object.position.z - center.z);
        object.rotation.y += Math.PI;

        this.controls.maxDistance = size * 10;
        this.defaultCamera.near = size / 100;
        this.defaultCamera.far = size * 100;
        this.defaultCamera.updateProjectionMatrix();

        //  add zoom
        this.defaultCamera.zoom = 3;


        this.defaultCamera.position.copy(center);
        this.defaultCamera.position.x = -20;
        this.defaultCamera.position.y = 0;
        this.defaultCamera.position.z = 0;

        this.content = object;

        this.setCamera(center);
        // this.activeCamera.position.copy(center);
        // this.activeCamera.position.x += size / 2.0;
        // this.activeCamera.position.y += size / 5.0;
        // this.activeCamera.position.z += size / 2.0;
        this.activeCamera.lookAt(center);

        // this.controls.saveState();
        this.controls.object = this.activeCamera;
        this.controls.update();
        this.scene.add(object);

        this.scene.add(this.activeCamera);

        const planeGeometry = new THREE.PlaneGeometry(10, 10);
        planeGeometry.rotateX(- Math.PI / 2);

        const planeMaterial = new THREE.ShadowMaterial();
        planeMaterial.opacity = 0.7;

        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.position.y = this.content.position.y - size * 2.17;
        plane.receiveShadow = true;
        this.plane = plane;
        this.scene.add(plane);

        this.state.addLights = true;
        this.content.traverse((node) => {
            if (node.isLight) {
                this.state.addLights = true;
            }
        });

        this.setClips(clips);

        this.updateLights(center);
        // this.updateGUI();
        // this.updateEnvironment();
        this.updateTextureEncoding();
        this.updateDisplay();
        this.activeCamera.updateProjectionMatrix();
        window.content = this.content;
        // this.render();
        this.resize();
        // console.info('[glTF Viewer] THREE.Scene exported as `window.content`.');
        // this.printGraph(this.content);

        let render = this.render.bind(this);

        idleAnimation = function () {

            animationID = requestAnimationFrame(function animation(time) {

                object.rotation.y += Math.PI / 1440;
                render();

                animationID = requestAnimationFrame(animation);


            });
        }

        setTimeout(idleAnimation, 2000);
    }

    printGraph(node) {

        console.group(' <' + node.type + '> ' + node.name);
        node.children.forEach((child) => this.printGraph(child));
        console.groupEnd();

    }

    /**
     * @param {Array<THREE.AnimationClip} clips
     */
    setClips(clips) {
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.mixer.getRoot());
            this.mixer = null;
        }

        clips.forEach((clip) => {
            if (clip.validate()) clip.optimize();
        });

        this.clips = clips;
        if (!clips.length) return;

        this.mixer = new THREE.AnimationMixer(this.content);
    }

    playAllClips() {
        this.clips.forEach((clip) => {
            this.mixer.clipAction(clip).reset().play();
            this.state.actionStates[clip.name] = true;
        });
    }

    /**
     * @param {string} name
     */
    setCamera(center) {

        this.content.traverse((node) => {
            if (node instanceof THREE.PerspectiveCamera) {
                this.activeCamera = node;
                console.log(this.activeCamera.position);
                console.log(this.activeCamera);
                this.activeCamera.castShadow = true;
                // this.activeCamera.position.x += (this.activeCamera.position.x - center.x);
                // this.activeCamera.position.y += (this.activeCamera.position.y - center.y);
                // this.activeCamera.position.z += (this.activeCamera.position.z - center.z);

            }
            if (node instanceof THREE.Mesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        const { clientHeight, clientWidth } = this.el.parentElement;

        this.activeCamera.aspect = clientWidth / clientHeight;

        // this.activeCamera = this.defaultCamera;

    }

    updateTextureEncoding() {
        const encoding = this.state.textureEncoding === 'sRGB'
            ? THREE.sRGBEncoding
            : THREE.LinearEncoding;
        traverseMaterials(this.content, (material) => {
            if (material.map) material.map.encoding = encoding;
            if (material.emissiveMap) material.emissiveMap.encoding = encoding;
            if (material.map || material.emissiveMap) material.needsUpdate = true;
        });
    }

    updateLights(center) {
        // const state = this.state;
        // const lights = this.lights;

        // if (state.addLights && !lights.length) {
        //     this.addLights();
        // } else if (!state.addLights && lights.length) {
        //     this.removeLights();
        // }

        // this.renderer.toneMappingExposure = state.exposure;

        // if (lights.length === 2) {
        //     lights[0].intensity = state.ambientIntensity;
        //     lights[0].color.setHex(state.ambientColor);
        //     lights[1].intensity = state.directIntensity;
        //     lights[1].color.setHex(state.directColor);
        // }

        var light = new THREE.DirectionalLight(0xffffff, 1, 0.8);
        light.position.set(this.content.position.x, this.content.position.y - this.size * 1.5, this.content.position.z);
        light.castShadow = true;
        light.target.position.set(0, 0, 1.1);
        this.scene.add(light);
        this.scene.add(light.target);




        light.shadow.mapSize.width = 32;
        light.shadow.mapSize.height = 32;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 10;
        light.shadow.camera.left = -6;
        light.shadow.camera.right = 6;
        light.shadow.camera.bottom = -6;
        light.shadow.camera.top = 6;
        light.radius = 0.0039;
        light.bias = 0.0001;

        var helper = new THREE.CameraHelper(light.shadow.camera);
        this.scene.add(helper);

        //light illuminate from above

        // var dlight = new THREE.DirectionalLight(0xffffff, 0.7);
        // dlight.position.set(20, 194, 0);
        // this.scene.add(dlight);
    }

    addLights() {
        const state = this.state;

        // if (this.options.preset === Preset.ASSET_GENERATOR) {
        //     const hemiLight = new THREE.HemisphereLight();
        //     hemiLight.name = 'hemi_light';
        //     this.scene.add(hemiLight);
        //     this.lights.push(hemiLight);
        //     return;
        // }

        // const light1 = new THREE.AmbientLight(state.ambientColor, state.ambientIntensity);
        // light1.name = 'ambient_light';
        // this.activeCamera.add(light1);

        // const light2 = new THREE.DirectionalLight(state.directColor, state.directIntensity);
        // light2.position.set(0.5, 0, 0.866); // ~60º
        // light2.name = 'main_light';
        // this.activeCamera.add(light2);

        // this.lights.push(light1, light2);


    }

    removeLights() {

        this.lights.forEach((light) => light.parent.remove(light));
        this.lights.length = 0;

    }

    // updateEnvironment() {

    //     // const environment = environments.filter((entry) => entry.name === this.state.environment)[0];

    //     this.getCubeMapTexture(environment).then(({ envMap, cubeMap }) => {

    //         //   if ((!envMap || !this.state.background) && this.activeCamera === this.defaultCamera) {
    //         //     this.scene.add(this.background);
    //         //   } else {
    //         //     this.scene.remove(this.background);
    //         //   }

    //         traverseMaterials(this.content, (material) => {
    //             if (material.isMeshStandardMaterial || material.isGLTFSpecularGlossinessMaterial) {
    //                 material.envMap = envMap;
    //                 material.needsUpdate = true;
    //             }
    //         });

    //         this.scene.background = this.state.background ? cubeMap : null;

    //     });

    // }

    getCubeMapTexture(environment) {
        const { path, format } = environment;

        // no envmap
        if (!path) return Promise.resolve({ envMap: null, cubeMap: null });

        const cubeMapURLs = [
            path + 'posx' + format, path + 'negx' + format,
            path + 'posy' + format, path + 'negy' + format,
            path + 'posz' + format, path + 'negz' + format
        ];

        // hdr
        if (format === '.hdr') {

            return new Promise((resolve) => {

                new THREE.HDRCubeTextureLoader().load(THREE.UnsignedByteType, cubeMapURLs, (hdrCubeMap) => {

                    var pmremGenerator = new THREE.PMREMGenerator(hdrCubeMap);
                    pmremGenerator.update(this.renderer);

                    var pmremCubeUVPacker = new THREE.PMREMCubeUVPacker(pmremGenerator.cubeLods);
                    pmremCubeUVPacker.update(this.renderer);

                    resolve({
                        envMap: pmremCubeUVPacker.CubeUVRenderTarget.texture,
                        cubeMap: hdrCubeMap
                    });

                });

            });

        }

        // standard
        const envMap = new THREE.CubeTextureLoader().load(cubeMapURLs);
        envMap.format = THREE.RGBFormat;
        return Promise.resolve({ envMap, cubeMap: envMap });

    }

    updateDisplay() {
        if (this.skeletonHelpers.length) {
            this.skeletonHelpers.forEach((helper) => this.scene.remove(helper));
        }

        traverseMaterials(this.content, (material) => {
            material.wireframe = this.state.wireframe;
        });

        this.content.traverse((node) => {
            if (node.isMesh && node.skeleton && this.state.skeleton) {
                const helper = new THREE.SkeletonHelper(node.skeleton.bones[0].parent);
                helper.material.linewidth = 3;
                this.scene.add(helper);
                this.skeletonHelpers.push(helper);
            }
        });

        if (this.state.grid !== Boolean(this.gridHelper)) {
            if (this.state.grid) {
                this.gridHelper = new THREE.GridHelper();
                this.axesHelper = new THREE.AxesHelper();
                this.axesHelper.renderOrder = 999;
                this.axesHelper.onBeforeRender = (renderer) => renderer.clearDepth();
                this.scene.add(this.gridHelper);
                this.scene.add(this.axesHelper);
            } else {
                this.scene.remove(this.gridHelper);
                this.scene.remove(this.axesHelper);
                this.gridHelper = null;
                this.axesHelper = null;
            }
        }
    }

    updateBackground() {
        // this.background.style({colors: [this.state.bgColor1, this.state.bgColor2]});
    }

    // addGUI() {

    //     const gui = this.gui = new dat.GUI({ autoPlace: false, width: 260, hideable: true });

    //     // Display controls.
    //     const dispFolder = gui.addFolder('Display');
    //     const envBackgroundCtrl = dispFolder.add(this.state, 'background');
    //     envBackgroundCtrl.onChange(() => this.updateEnvironment());
    //     const wireframeCtrl = dispFolder.add(this.state, 'wireframe');
    //     wireframeCtrl.onChange(() => this.updateDisplay());
    //     const skeletonCtrl = dispFolder.add(this.state, 'skeleton');
    //     skeletonCtrl.onChange(() => this.updateDisplay());
    //     const gridCtrl = dispFolder.add(this.state, 'grid');
    //     gridCtrl.onChange(() => this.updateDisplay());
    //     dispFolder.add(this.controls, 'autoRotate');
    //     dispFolder.add(this.controls, 'screenSpacePanning');
    //     const bgColor1Ctrl = dispFolder.addColor(this.state, 'bgColor1');
    //     const bgColor2Ctrl = dispFolder.addColor(this.state, 'bgColor2');
    //     bgColor1Ctrl.onChange(() => this.updateBackground());
    //     bgColor2Ctrl.onChange(() => this.updateBackground());

    //     // Lighting controls.
    //     const lightFolder = gui.addFolder('Lighting');
    //     const encodingCtrl = lightFolder.add(this.state, 'textureEncoding', ['sRGB', 'Linear']);
    //     encodingCtrl.onChange(() => this.updateTextureEncoding());
    //     lightFolder.add(this.renderer, 'gammaOutput').onChange(() => {
    //         traverseMaterials(this.content, (material) => {
    //             material.needsUpdate = true;
    //         });
    //     });
    //     const envMapCtrl = lightFolder.add(this.state, 'environment', environments.map((env) => env.name));
    //     envMapCtrl.onChange(() => this.updateEnvironment());
    //     [
    //         lightFolder.add(this.state, 'exposure', 0, 2),
    //         lightFolder.add(this.state, 'addLights').listen(),
    //         lightFolder.add(this.state, 'ambientIntensity', 0, 2),
    //         lightFolder.addColor(this.state, 'ambientColor'),
    //         lightFolder.add(this.state, 'directIntensity', 0, 4), // TODO(#116)
    //         lightFolder.addColor(this.state, 'directColor')
    //     ].forEach((ctrl) => ctrl.onChange(() => this.updateLights()));

    //     // Animation controls.
    //     this.animFolder = gui.addFolder('Animation');
    //     this.animFolder.domElement.style.display = 'none';
    //     const playbackSpeedCtrl = this.animFolder.add(this.state, 'playbackSpeed', 0, 1);
    //     playbackSpeedCtrl.onChange((speed) => {
    //         if (this.mixer) this.mixer.timeScale = speed;
    //     });
    //     this.animFolder.add({ playAll: () => this.playAllClips() }, 'playAll');

    //     // Morph target controls.
    //     this.morphFolder = gui.addFolder('Morph Targets');
    //     this.morphFolder.domElement.style.display = 'none';

    //     // Camera controls.
    //     this.cameraFolder = gui.addFolder('Cameras');
    //     this.cameraFolder.domElement.style.display = 'none';

    //     // Stats.
    //     const perfFolder = gui.addFolder('Performance');
    //     const perfLi = document.createElement('li');
    //     // this.stats.dom.style.position = 'static';
    //     // perfLi.appendChild(this.stats.dom);
    //     // perfLi.classList.add('gui-stats');
    //     perfFolder.__ul.appendChild(perfLi);

    //     const guiWrap = document.createElement('div');
    //     this.el.appendChild(guiWrap);
    //     guiWrap.classList.add('gui-wrap');
    //     guiWrap.appendChild(gui.domElement);
    //     gui.open();

    // }

    // updateGUI() {
    //     this.cameraFolder.domElement.style.display = 'none';

    //     this.morphCtrls.forEach((ctrl) => ctrl.remove());
    //     this.morphCtrls.length = 0;
    //     this.morphFolder.domElement.style.display = 'none';

    //     this.animCtrls.forEach((ctrl) => ctrl.remove());
    //     this.animCtrls.length = 0;
    //     this.animFolder.domElement.style.display = 'none';

    //     const cameraNames = [];
    //     const morphMeshes = [];
    //     this.content.traverse((node) => {
    //         if (node.isMesh && node.morphTargetInfluences) {
    //             morphMeshes.push(node);
    //         }
    //         if (node.isCamera) {
    //             node.name = node.name || `VIEWER__camera_${cameraNames.length + 1}`;
    //             cameraNames.push(node.name);
    //         }
    //     });

    //     if (cameraNames.length) {
    //         this.cameraFolder.domElement.style.display = '';
    //         if (this.cameraCtrl) this.cameraCtrl.remove();
    //         const cameraOptions = [DEFAULT_CAMERA].concat(cameraNames);
    //         this.cameraCtrl = this.cameraFolder.add(this.state, 'camera', cameraOptions);
    //         this.cameraCtrl.onChange((name) => this.setCamera(name));
    //     }

    //     if (morphMeshes.length) {
    //         this.morphFolder.domElement.style.display = '';
    //         morphMeshes.forEach((mesh) => {
    //             if (mesh.morphTargetInfluences.length) {
    //                 const nameCtrl = this.morphFolder.add({ name: mesh.name || 'Untitled' }, 'name');
    //                 this.morphCtrls.push(nameCtrl);
    //             }
    //             for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
    //                 const ctrl = this.morphFolder.add(mesh.morphTargetInfluences, i, 0, 1, 0.01).listen();
    //                 Object.keys(mesh.morphTargetDictionary).forEach((key) => {
    //                     if (key && mesh.morphTargetDictionary[key] === i) ctrl.name(key);
    //                 });
    //                 this.morphCtrls.push(ctrl);
    //             }
    //         });
    //     }

    //     if (this.clips.length) {
    //         this.animFolder.domElement.style.display = '';
    //         const actionStates = this.state.actionStates = {};
    //         this.clips.forEach((clip, clipIndex) => {
    //             // Autoplay the first clip.
    //             let action;
    //             if (clipIndex === 0) {
    //                 actionStates[clip.name] = true;
    //                 action = this.mixer.clipAction(clip);
    //                 action.play();
    //             } else {
    //                 actionStates[clip.name] = false;
    //             }

    //             // Play other clips when enabled.
    //             const ctrl = this.animFolder.add(actionStates, clip.name).listen();
    //             ctrl.onChange((playAnimation) => {
    //                 action = action || this.mixer.clipAction(clip);
    //                 action.setEffectiveTimeScale(1);
    //                 playAnimation ? action.play() : action.stop();
    //             });
    //             this.animCtrls.push(ctrl);
    //         });
    //     }
    // }

    clear() {

        if (!this.content) return;

        this.scene.remove(this.content);

        // dispose geometry
        this.content.traverse((node) => {

            if (!node.isMesh) return;

            node.geometry.dispose();

        });

        // dispose textures
        traverseMaterials(this.content, (material) => {

            MAP_NAMES.forEach((map) => {

                if (material[map]) material[map].dispose();

            });

        });

    }

};

function traverseMaterials(object, callback) {
    object.traverse((node) => {
        if (!node.isMesh) return;
        const materials = Array.isArray(node.material)
            ? node.material
            : [node.material];
        materials.forEach(callback);
    });
}

let el = document.querySelector(".canvas");
let viewer = new Viewer(el);

viewer.load("../assets/model.glb").catch(e => console.log(e)).then(gltf => console.log('Done ', gltf));




