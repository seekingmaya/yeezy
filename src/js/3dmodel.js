import { hideLoader } from "./loading";

const THREE = window.THREE = require('three');


require('three/examples/js/loaders/GLTFLoader');
require('three/examples/js/loaders/DDSLoader');
require('three/examples/js/controls/OrbitControls');
require('three/examples/js/loaders/RGBELoader');
require('three/examples/js/loaders/HDRCubeTextureLoader');
require('three/examples/js/pmrem/PMREMGenerator');
require('three/examples/js/pmrem/PMREMCubeUVPacker');


let animationID;
let idleAnimation;
let timerId;



const DEFAULT_CAMERA = '[default]';

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
        this.controls.screenSpacePanning = true

        this.animFolder = null;
        this.animCtrls = [];
        this.morphFolder = null;
        this.morphCtrls = [];
        this.skeletonHelpers = [];
        this.gridHelper = null;
        this.axesHelper = null;

        this.animate = this.animate.bind(this);
        this.resize();

        this.setControlsListener();
        window.addEventListener('resize', this.resize.bind(this), false);

    }

    setControlsListener() {
        this.controls.addEventListener("change", () => {
            restartTimer();
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
            let manager = new THREE.LoadingManager();

            manager.onLoad = function () {

                hideLoader();

            };

            const loader = new THREE.GLTFLoader(manager);
            loader.setCrossOrigin('anonymous');

            loader.load(url, (gltf) => {

                const scene = gltf.scene || gltf.scenes[0];
                const clips = gltf.animations || [];

                this.setContent(scene, clips);

                resolve(gltf);

            });

        });

    }

    /**
     * @param {THREE.Object3D} object
     * @param {Array<THREE.AnimationClip} clips
     */
    setContent(object, clips) {

        console.dir(object)

        this.clear();

        object.updateMatrixWorld();
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        this.size = size;


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
        this.activeCamera.lookAt(center);

        // this.controls.saveState();
        this.controls.object = this.activeCamera;
        this.controls.maxZoom = 7;
        this.controls.update();

        this.scene.add(this.content);

        this.scene.add(this.activeCamera);

        this.state.addLights = true;
        this.content.traverse((node) => {
            if (node.isLight) {
                this.state.addLights = true;
            }
        });

        this.setClips(clips);

        this.updateLights(center);

        this.updateTextureEncoding();
        this.updateDisplay();
        this.activeCamera.updateProjectionMatrix();
        window.content = this.content;
        this.el.appendChild(this.renderer.domElement);
        this.resize();


        let render = this.render.bind(this);

        idleAnimation = function () {


            animationID = requestAnimationFrame(function animation(time) {

                object.rotation.y += Math.PI / 5000;

                render();

                animationID = requestAnimationFrame(animation);


            });
        }

        idleAnimation();
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

        // var light = new THREE.DirectionalLight(0xffffff, 1, 0.4);
        // light.position.set(0, this.size / 2, 0);
        // light.castShadow = true;
        // light.target.position.set(0, -1.4, 0);
        // this.scene.add(light);
        // this.scene.add(light.target);
        // this.light = light;



        // light.shadow.mapSize.width = 1024;
        // light.shadow.mapSize.height = 1024;
        // light.shadow.camera.near = 0.5;
        // light.shadow.camera.far = 5;
        // light.shadow.camera.left = -4;
        // light.shadow.camera.right = 4;
        // light.shadow.camera.bottom = -4;
        // light.shadow.camera.top = 4;
        // light.radius = 0.0039;
        // light.bias = 0.0001;

        // var helper = new THREE.CameraHelper(light.shadow.camera);
        // this.scene.add(helper);

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

function restartTimer() {
    cancelAnimationFrame(animationID);
    clearTimeout(timerId);
    timerId = setTimeout(() => {
        idleAnimation();
    }, 3000);
}

export function stopAnimation() {
    cancelAnimationFrame(animationID);
    clearTimeout(timerId);
}

export { idleAnimation };

let el = document.querySelector(".canvas");
let viewer = new Viewer(el);

viewer.load("../assets/model.glb").catch(e => console.log(e)).then(gltf => console.log('Done ', gltf));




