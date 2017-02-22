'use strict';

window.WebVRConfig = {
	BUFFER_SCALE: 1.0
};

const THREE = window.THREE = require('three');

require('webvr-polyfill/src/main');
require('imports?THREE=three!three/examples/js/controls/VRControls');
require('imports?THREE=three!three/examples/js/effects/VREffect');
require('imports?THREE=three!three/examples/js/loaders/ColladaLoader');

// Setup three.js WebGL renderer. Note: Antialiasing is a big performance hit.
// Only enable it if you actually need to.
const renderer = new THREE.WebGLRenderer({
	antialias: false
});
renderer.setPixelRatio(Math.floor(window.devicePixelRatio || 1));

// Append the canvas element created by the renderer to document body element.
document.body.appendChild(renderer.domElement);

// Create a three.js scene.
const scene = new THREE.Scene();

// Create a three.js camera.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

// Apply VR headset positional data to camera.
const controls = new THREE.VRControls(camera);
controls.standing = true;

// Apply VR stereo rendering to renderer.
const effect = new THREE.VREffect(renderer);
effect.setSize(window.innerWidth, window.innerHeight);

// Add a repeating grid as a skybox.
const boxWidth = 5;
const texLoader = new THREE.TextureLoader();
texLoader.load('img/box.png', texture => {
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(boxWidth, boxWidth);

	const geometry = new THREE.BoxGeometry(boxWidth, boxWidth, boxWidth);
	const material = new THREE.MeshBasicMaterial({
		map: texture,
		color: 0x01BE00,
		side: THREE.BackSide
	});

	const skybox = new THREE.Mesh(geometry, material);
	scene.add(skybox);
});

// Create 3D objects.
const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const material = new THREE.MeshNormalMaterial();
const cube = new THREE.Mesh(geometry, material);

// Position cube mesh
cube.position.set(0, 1.5, -1);

// Add cube mesh to your three.js scene
// scene.add(cube);

// instantiate a loader
const colladaLoader = new THREE.ColladaLoader();
colladaLoader.load(
	// resource URL
	require('../models/alien_infected3.dae'),
	// Function when resource is loaded
	collada => {
		collada.scene.scale.multiplyScalar(0.2);
		collada.scene.position.set(0, 1.5, -1);
		scene.add(collada.scene);
	},
	// Function called when download progresses
	xhr => {
		console.log(xhr.loaded / xhr.total * 100 + '% loaded');
	}
);

const light = new THREE.DirectionalLight(0xffffff);
light.position.set(1, 1, 1).normalize();
scene.add(light);

// Request animation frame loop function
let vrDisplay = null;
let lastRender = 0;
function animate(timestamp) {
	const delta = Math.min(timestamp - lastRender, 500);
	lastRender = timestamp;

	// Apply rotation to cube mesh
	cube.rotation.y += delta * 0.0006;

	// Update VR headset position and apply to camera.
	controls.update();

	// Render the scene.
	effect.render(scene, camera);

	// Keep looping.
	if (vrDisplay && vrDisplay.isPresenting) {
		vrDisplay.requestAnimationFrame(animate);
	} else {
		window.requestAnimationFrame(animate);
	}
}

// Get the VRDisplay and save it for later.
navigator.getVRDisplays().then(displays => {
	if (displays.length > 0) {
		vrDisplay = displays[0];

		// Kick off the render loop.
		vrDisplay.requestAnimationFrame(animate);
	}
});

function onResize() {
	console.log('Resizing to %s x %s.', window.innerWidth, window.innerHeight);
	effect.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
}

function onVRDisplayPresentChange() {
	console.log('onVRDisplayPresentChange');
	onResize();
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
document.querySelector('button#vr').addEventListener('click', () => {
	vrDisplay.requestPresent([{source: renderer.domElement}]);
});
// document.querySelector('button#reset').addEventListener('click', () => {
// 	vrDisplay.resetPose();
// });

