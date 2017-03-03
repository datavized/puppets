'use strict';

window.WebVRConfig = {
	// DEFER_INITIALIZATION: true,
	MOUSE_KEYBOARD_CONTROLS_DISABLED: true,
	ROTATE_INSTRUCTIONS_DISABLED: true,
	TOUCH_PANNER_DISABLED: false,
	BUFFER_SCALE: 1
};

const CHARACTER_SCALE = 1.5;
const WORLD_SHRINK_SCALE = 1 / 10;

const THREE = window.THREE = require('three');

// external dependencies
require('webvr-polyfill/src/main');
require('imports?THREE=three!three/examples/js/controls/VRControls');
require('imports?THREE=three!three/examples/js/effects/VREffect');
require('imports?THREE=three!three/examples/js/loaders/OBJLoader');
require('imports?THREE=three!three/examples/js/loaders/MTLLoader');
require('imports?THREE=three!three/examples/js/vr/ViveController');

import SoundEffect from './sound-effect';
import PuppetShow from './puppet-show';

// Setup three.js WebGL renderer. Note: Antialiasing is a big performance hit.
// Only enable it if you actually need to.
const renderer = new THREE.WebGLRenderer({
	antialias: true
});
const canvas = renderer.domElement;
renderer.autoClear = false;
renderer.setClearColor(0x000000, 1);
renderer.setPixelRatio(Math.floor(window.devicePixelRatio || 1));
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.enabled = true;

// Append the canvas element created by the renderer to document body element.
document.body.appendChild(renderer.domElement);

// Create a three.js scene.
const scene = new THREE.Scene();

const world = new THREE.Object3D();
scene.add(world);

// Create a three.js camera.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const screenCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
let windowCamera = screenCamera;

// Apply VR headset positional data to camera.
const controls = new THREE.VRControls(camera);
controls.standing = true;

// Apply VR stereo rendering to renderer.
const effect = new THREE.VREffect(renderer);
effect.setSize(window.innerWidth, window.innerHeight);

// set up environment
const floor = new THREE.Mesh(
	new THREE.PlaneBufferGeometry(1000, 1000),
	new THREE.MeshLambertMaterial({
		color: 0xAAAAAA
	})
);
floor.receiveShadow = true;
floor.rotation.x = -Math.PI / 2;
world.add(floor);

// sky is just a box for now, as long as it's a solid color
// might require a half-sphere later for a gradient or atmosphere
// todo: if we end up keeping a solid color, just use a clearColor and skip geometry
const room = new THREE.Mesh(
	new THREE.BoxBufferGeometry(1000, 1000, 1000),
	new THREE.MeshBasicMaterial({
		color: 0xCCCCCC,
		side: THREE.BackSide
	})
);
room.position.y = 490;
scene.add(room);

/*
Stage
- todo: for now, just using a rectangle, but let's create an arc
- share box geometry
*/

const stage = new THREE.Mesh(
	new THREE.BoxBufferGeometry(20, 0.5, 10),
	new THREE.MeshLambertMaterial({
		color: 0x999999
	})
);
stage.receiveShadow = true;
stage.position.set(0, 0.25, -7);
scene.add(stage);

let isPreviewing = false;
screenCamera.position.y = 1.5;
screenCamera.position.z = 2;

function updatePreviewing() {
	windowCamera = isPreviewing ? camera : screenCamera;
}

function togglePreview() {
	isPreviewing = !isPreviewing;
	updatePreviewing();
}

// editing state
let isEditing = false;
function updateEditingState() {
	const worldScale = isEditing ? WORLD_SHRINK_SCALE : 1;
	world.scale.set(worldScale, worldScale, worldScale);

	// todo: adjust this for kids!!
	world.position.y = isEditing ? 0.6 : 0;
}

function toggleEditing() {
	isEditing = !isEditing;
	updateEditingState();
}

// set up controllers
let controllerGeometryPromise;
const controllers = [];
const textureLoader = new THREE.TextureLoader();
for (let i = 0; i < 2; i++) {
	const controller = new THREE.ViveController(i);
	controller.standingMatrix = controls.getStandingMatrix();
	scene.add(controller);
	controllers.push(controller);

	controller.addEventListener('thumbpaddown', toggleEditing);
}

function loadController() {
	if (!controllerGeometryPromise) {
		const promises = [];
		promises.push(new Promise(resolve => {
			const objLoader = new THREE.OBJLoader();
			objLoader.load(require('../models/vive-controller/vr_controller_vive_1_5.obj'), object => {
				resolve(object.children[0]);
			});
		}));

		promises.push(new Promise(resolve => {
			textureLoader.load(require('../models/vive-controller/onepointfive_texture.png'), tex => resolve(tex));
		}));

		promises.push(new Promise(resolve => {
			textureLoader.load(require('../models/vive-controller/onepointfive_spec.png'), tex => resolve(tex));
		}));

		controllerGeometryPromise = Promise.all(promises).then(results => {
			const controller = results[0];
			controller.material.map = results[1];
			controller.material.specularMap = results[2];
			controller.castShadow = true;

			return controller;
		});
	}

	return controllerGeometryPromise;
}

// instantiate a loader
const mtlLoader = new THREE.MTLLoader();
mtlLoader.setTexturePath('models/'); // todo: get this from mtl file url
function loadModel(src) {
	const mtlUrl = src.replace(/\.obj$/i, '.mtl');
	return new Promise(resolve => {
		mtlLoader.load(
			mtlUrl,
			materials => {
				const objLoader = new THREE.OBJLoader();
				objLoader.setMaterials(materials);
				objLoader.load(
					src,
					obj => resolve(obj)
				);
			}
		);
	});
}

Promise.all([
	loadModel('models/chr_lady2.obj'),
	loadModel('models/chr_beardo1.obj'),
	loadModel('models/chr_goth1.obj'),
	loadModel('models/chr_headphones.obj')
]).then(results => {
	results.forEach((model, index) => {
		const bbox = new THREE.Box3();
		bbox.setFromObject(model);

		// todo: set appropriate scale of puppet objects
		// console.log(bbox.getSize());
		model.scale.multiplyScalar(CHARACTER_SCALE);

		// for now, set puppet on the floor where we can see it.
		model.position.set(CHARACTER_SCALE * 1.1 * (index - results.length / 2), -bbox.min.y * CHARACTER_SCALE, -3);
		model.rotation.y = Math.PI;

		/*
		placing model on stage
		todo: make a "stage" sub-scene or something
		*/
		model.position.y += 0.5;

		model.traverse(obj => {
			if (obj.geometry) {
				obj.castShadow = true;
				obj.receiveShadow = true;
			}
			if (obj.material) {
				obj.material.shading = THREE.SmoothShading;
				const tex = obj.material.map;
				if (tex) {
					tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
					tex.minFilter = THREE.LinearFilter;
					tex.magFilter = THREE.NearestFilter;
				}
			}
		});
		world.add(model);
	});
});

const light = new THREE.DirectionalLight(0xffffff);
light.position.set(0, 10, 0);
scene.add(light);

light.castShadow = true;

light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;

/*
todo: update shadow size dynamically
- union of bounding box of scene and VR standing room
- scale for size of user?
*/
light.shadow.camera.left = -4;
light.shadow.camera.right = 4;
light.shadow.camera.top = 4;
light.shadow.camera.bottom = -4;

light.shadow.camera.far = 11;
light.shadow.camera.near = 1;

// scene.add(new THREE.CameraHelper(light.shadow.camera));

scene.add(new THREE.AmbientLight(0x666666));

/*
Set up sound effects
todo: provide multiple formats
todo: wake up audio context on first touch event on mobile
*/
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const sfx = {};
[
	'sounds/bark.wav',
	'sounds/laugh.wav'
].forEach(src => {
	const key = src.replace(/^.*\/([a-z]+)\.wav/, '$1');
	sfx[key] = new SoundEffect({
		src,
		buttonContainer: '#sound-effects',
		context: audioContext,
		name: key
	});
});

const puppetShow = new PuppetShow();
puppetShow
	.on('load', () => {
		console.log('loaded puppet show', puppetShow.id);
		// todo: set stage and force redraw

		window.location.hash = '#' + puppetShow.id;
	})
	.on('unload', id => {
		console.log('unloaded puppet show', id);
		// todo: clear stage and force redraw
	})
	.on('error', id => {
		console.log('error loading puppet show', id);
		// todo: clear stage, force redraw and report error
	});

// load from URL or create a new one
const showIdResults = /^#([a-z0-9\-_]+)/i.exec(window.location.hash);
if (showIdResults && showIdResults[1]) {
	puppetShow.load(showIdResults[1]);

	// todo: handle not found or other error
} else {
	puppetShow.create();
}

document.getElementById('new-show').addEventListener('click', () => {
	puppetShow.create();
});

// Request animation frame loop function
let vrDisplay = null;
let lastRender = 0;
function animate(timestamp) {
	// const delta = Math.min(timestamp - lastRender, 500);
	lastRender = timestamp;

	// Update VR headset position and apply to camera.
	controls.update();

	controllers.forEach(c => {
		c.update();
		if (c.visible && !c.userData.gamepad) {
			c.userData.gamepad = c.getGamepad();
			loadController().then(obj => c.add(obj.clone()));
		}
	});

	// render shadows once per cycle (not for each eye)
	renderer.shadowMap.needsUpdate = true;

	const isPresenting = vrDisplay && vrDisplay.isPresenting;

	const pixelRatio = renderer.getPixelRatio();
	const width = canvas.width / pixelRatio;
	const height = canvas.height / pixelRatio;
	if (isPresenting) {
		// Render the scene in stereo
		renderer.clear();
		renderer.setViewport(0, 0, width / 2, height);
		effect.render(scene, camera);
	}

	if (!isPresenting || vrDisplay.capabilities.hasExternalDisplay) {
		renderer.clear();
		renderer.setViewport(0, 0, width, height);
		renderer.render(scene, windowCamera);
	}

	// Keep looping.
	if (isPresenting) {
		vrDisplay.requestAnimationFrame(animate);
	} else {
		window.requestAnimationFrame(animate);
	}
}

function onResize() {
	console.log('Resizing to %s x %s.', window.innerWidth, window.innerHeight);
	effect.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	screenCamera.aspect = window.innerWidth / window.innerHeight;
	screenCamera.updateProjectionMatrix();
}

const vrButton = document.querySelector('button#vr');
function onVRDisplayPresentChange() {
	console.log('onVRDisplayPresentChange');
	onResize();
	if (!vrDisplay) {
		vrButton.style.display = 'none';
	} else {
		vrButton.style.display = '';
		if (vrDisplay.isPresenting) {
			vrButton.innerHTML = 'Exit VR';
		} else {
			vrButton.innerHTML = 'Enter VR';
		}
	}
}

function enterFullscreen(el) {
	if (el.requestFullscreen) {
		el.requestFullscreen();
	} else if (el.mozRequestFullScreen) {
		el.mozRequestFullScreen();
	} else if (el.webkitRequestFullscreen) {
		el.webkitRequestFullscreen();
	} else if (el.msRequestFullscreen) {
		el.msRequestFullscreen();
	}
}

document.addEventListener('touchmove', e => e.preventDefault());

// Resize the WebGL canvas when we resize and also when we change modes.
window.addEventListener('resize', onResize);
window.addEventListener('vrdisplaypresentchange', onVRDisplayPresentChange);

// Button click handlers.
document.querySelector('button#fullscreen').addEventListener('click', () => {
	enterFullscreen(renderer.domElement);
});
vrButton.addEventListener('click', () => {
	if (vrDisplay.isPresenting) {
		vrDisplay.exitPresent();
	} else {
		vrDisplay.requestPresent([{source: renderer.domElement}]);
	}
});
// document.querySelector('button#reset').addEventListener('click', () => {
// 	vrDisplay.resetPose();
// });

// Get the VRDisplay and save it for later.
navigator.getVRDisplays().then(displays => {
	if (displays.length > 0) {
		vrDisplay = displays[0];
	}
	onVRDisplayPresentChange();
});

// Kick off the render loop.
requestAnimationFrame(animate);

onVRDisplayPresentChange();

window.addEventListener('keydown', event => {
	if (vrDisplay) {
		if (event.keyCode === 13) { // enter
			vrDisplay.requestPresent([{source: renderer.domElement}]);
		} else if (event.keyCode === 27) { // escape
			vrDisplay.exitPresent();
		}
	}
	if (event.keyCode === 32) { // space
		toggleEditing();
	} else if (event.keyCode === 86) { // v
		togglePreview();
	}
}, true);