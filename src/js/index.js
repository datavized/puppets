'use strict';

window.WebVRConfig = {
	// DEFER_INITIALIZATION: true,
	MOUSE_KEYBOARD_CONTROLS_DISABLED: true,
	ROTATE_INSTRUCTIONS_DISABLED: true,
	TOUCH_PANNER_DISABLED: false,
	BUFFER_SCALE: 1
};

const CHARACTER_SCALE = 1.5;
const EDIT_WORLD_SCALE = 1 / 10;
const PLAY_WORLD_SCALE = 1 / 3;
const STAGE_HEIGHT = 1; // 1 for adults; 0.25 for kids? todo: adjustable

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
import PuppetShowRecorder from './puppet-show-recorder';

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
world.add(screenCamera);

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
stage.position.set(0, STAGE_HEIGHT, -7);
world.add(stage);

const stageBounds = new THREE.Box3();
stageBounds.setFromObject(stage);
stageBounds.min.y = stageBounds.max.y;
stageBounds.max.y = Infinity;

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

// set up controllers
let controllerGeometryPromise;
const controllers = [];
const textureLoader = new THREE.TextureLoader();
for (let i = 0; i < 2; i++) {
	const controller = new THREE.ViveController(i);
	controller.standingMatrix = controls.getStandingMatrix();
	scene.add(controller);
	controllers.push(controller);
}

/*
todo: we may remove this whole mess if we don't need the controllers
...unless we use controllers for playback control?
*/
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

const puppets = [];

Promise.all([
	loadModel('models/chr_lady2.obj'),
	loadModel('models/chr_beardo1.obj')/*,
	loadModel('models/chr_goth1.obj'),
	loadModel('models/chr_headphones.obj')*/
]).then(results => {
	results.forEach(model => {
		const bbox = new THREE.Box3();
		bbox.setFromObject(model);

		// todo: set appropriate scale of puppet objects
		// console.log(bbox.getSize());
		model.scale.multiplyScalar(CHARACTER_SCALE);

		model.position.y = -bbox.min.y * CHARACTER_SCALE;
		model.rotation.y = Math.PI;

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

		const puppet = new THREE.Object3D();
		puppet.add(model);

		puppet.visible = false;
		puppets.push(puppet);

		world.add(puppet);
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

const playButton = document.getElementById('play');
const timecode = document.getElementById('timecode');
const editingCheckbox = document.getElementById('editing');

/*
Set up sound effects
todo: provide multiple formats
todo: wake up audio context on first touch event on mobile
*/
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();

const puppetShow = new PuppetShow({
	audioContext
});

const recordedSounds = new Map();
const currentSounds = new Set();
const sfx = new Map();
[
	'sounds/bark.wav',
	'sounds/laugh.wav'
].forEach(src => {
	const name = src.replace(/^.*\/([a-z]+)\.wav/, '$1');
	const effect = new SoundEffect({
		src,
		context: audioContext,
		name
	});
	sfx.set(name, effect);
});


// editing state
let isEditing = false;
let editorInitialized = false;
let puppetShowRecorder;

function updateButtons() {
	document.getElementById('edit-buttons').style.display = isEditing ? '' : 'none';
	document.getElementById('sound-effects').style.display = isEditing ? '' : 'none';
	document.getElementById('editing-label').style.display = puppetShow.isCreator ? '' : 'none';

	playButton.disabled = !puppetShow.ready;
	playButton.innerText = puppetShow.playing ? 'Pause' : 'Play';

	if (isEditing) {
		const recordButton = document.getElementById('record');
		recordButton.disabled = !(puppetShowRecorder && puppetShowRecorder.ready);

		if (puppetShowRecorder && puppetShowRecorder.recording) {
			recordButton.innerText = 'Stop';
		} else if (puppetShow.duration === 0) {
			recordButton.innerText = 'Record';
		} else {
			recordButton.innerText = 'Reset';
		}
	}
}

function initializeEditor() {
	if (editorInitialized) {
		return;
	}

	/*
	Set up recording
	todo: nicer interface
	todo: drop-down to select microphone/input if there's more than one (i.e. Vive)

	todo: maybe load recorder code in a separate chunk, only on supported devices
	*/
	puppetShowRecorder = new PuppetShowRecorder({
		puppetShow,
		audioContext
	});

	const recordButton = document.getElementById('record');
	recordButton.disabled = true;
	puppetShowRecorder
		.on('ready', updateButtons)
		.on('error', () => {
			updateButtons();
			// todo: report error. try again?
		})
		.on('start', () => {
			recordButton.innerHTML = 'Stop';
			updateButtons();
			sfx.forEach(e => e.stop());
		})
		.on('stop', updateButtons)
		.on('reset', () => {
			updateButtons();
			timecode.innerText = '0';
			sfx.forEach(e => e.stop());
		});
	// todo: don't enable record button until puppetShow has loaded
	// todo: if puppetShow already has data, skip recording

	// todo: enable this button once authenticated
	recordButton.addEventListener('click', () => {
		if (!puppetShow.isCreator) {
			console.warn('Cannot edit show. Not the creator.');
			return;
		}
		if (puppetShowRecorder.recording) {
			puppetShowRecorder.stop();
		} else if (!puppetShow.duration) {
			puppetShowRecorder.start();
		} else {
			// todo: require confirmation?
			puppetShowRecorder.reset();
		}
	});

	// sound effect buttons
	const soundButtonContainer = document.querySelector('#sound-effects');
	sfx.forEach(effect => {
		const name = effect.name;
		/*
		todo: Use better-looking button design #8
		*/
		const button = document.createElement('button');
		button.appendChild(document.createTextNode(name || 'Sound'));
		soundButtonContainer.appendChild(button);

		button.addEventListener('click', () => {
			effect.play();
			if (puppetShowRecorder.recording) {
				puppetShowRecorder.recordEvent('sound', {
					name
				}, null, effect.duration);
			}
		});
	});

	editorInitialized = true;
}

function updateEditingState() {
	/*
	3D Scene adjustments for editing
	*/
	const worldScale = isEditing ? EDIT_WORLD_SCALE : PLAY_WORLD_SCALE;
	world.scale.set(worldScale, worldScale, worldScale);

	// todo: adjust this for kids!!
	world.position.y = isEditing ? 0.6 : 0;
	world.position.z = isEditing ? 7 * worldScale : 0;

	/*
	DOM and interactions for editing
	*/

	if (isEditing) {
		initializeEditor();
		puppetShowRecorder.enable();
	} else if (puppetShowRecorder) {
		puppetShowRecorder.disable();
	}

	// temp
	editingCheckbox.checked = isEditing;
	updateButtons();
}

function togglePlaying() {
	if (puppetShowRecorder && puppetShowRecorder.recording) {
		return;
	}

	if (puppetShow.playing) {
		puppetShow.pause();
	} else {
		puppetShow.play();
	}
}

function toggleEditing() {
	isEditing = !isEditing && puppetShow.isCreator;
	updateEditingState();
}

function startEditing() {
	isEditing = puppetShow.isCreator;
	updateEditingState();
}

function stopEditing() {
	isEditing = false;
	updateEditingState();
}

function playSoundEvent(event) {
	if (!puppetShow.playing) {
		// don't play sounds while we're paused
		return true;
	}

	// todo: add to list of currently active audio tracks so we can resume

	const name = event.params.name;
	const time = event.time;
	const duration = event.duration;
	const currentTime = puppetShow.currentTime;

	const timeLeft = Math.max(0, time + duration - currentTime);
	if (timeLeft > 0) {
		const effect = sfx.get(name) || recordedSounds.get(name);
		if (!effect) {
			console.warn('Unknown sound effect', name, event);
			return false;
		}

		effect.play(Math.max(0, currentTime - time));
		return true;
	}

	return false;
}

puppetShow
	.on('load', () => {
		console.log('loaded puppet show', puppetShow.id);
		// todo: set stage and force redraw

		isEditing = puppetShow.isCreator;
		updateEditingState();

		window.location.hash = '#' + puppetShow.id;
	})
	.on('unload', id => {
		console.log('unloaded puppet show', id);
		// todo: clear stage and force redraw
	})
	.on('error', id => {
		console.log('error loading puppet show', id);
		// todo: clear stage, force redraw and report error
	})
	.on('play', () => {
		currentSounds.forEach(soundEvent => {
			const isCurrent = playSoundEvent(soundEvent);
			if (!isCurrent) {
				currentSounds.delete(soundEvent);
			}
		});
		updateButtons();
	})
	.on('pause', () => {
		recordedSounds.forEach(e => e.stop());
		sfx.forEach(e => e.stop());
		updateButtons();
	})
	.on('ready', () => {
		puppetShow.audioAssets.forEach(asset => {
			const effect = new SoundEffect({
				src: asset.buffer,
				context: audioContext,
				name: asset.id
			});
			recordedSounds.set(asset.id, effect);
		});
		updateButtons();
	})
	.on('unready', () => {
		currentSounds.clear();
		recordedSounds.forEach(s => s.stop());
		recordedSounds.clear();
		updateButtons();
	})
	.on('event', event => {
		if (puppetShowRecorder && puppetShowRecorder.recording) {
			return;
		}

		if (event.type === 'puppet') {
			const puppet = puppets[event.index];
			if (!puppet) {
				console.warn('Puppet index out of range', event);
				return;
			}

			puppet.position.copy(event.params.position);

			const rot = event.params.rotation;
			puppet.rotation.set(rot.x, rot.y, rot.z);

			// todo: move this out somewhere
			puppet.visible = true;
			return;
		}

		if (event.type === 'sound') {
			const isCurrent = playSoundEvent(event);
			if (isCurrent) {
				currentSounds.add(event);
			}
			return;
		}
	});

// Request animation frame loop function
let vrDisplay = null;
let lastRender = 0;
function animate(timestamp) {
	// const delta = Math.min(timestamp - lastRender, 500);
	lastRender = timestamp;

	// Update VR headset position and apply to camera.
	controls.update();

	const isRecording = puppetShowRecorder && puppetShowRecorder.recording;
	controllers.forEach((c, i) => {
		c.update();

		if (c.visible && isEditing) {
			if (!c.userData.gamepad) {
				c.userData.gamepad = c.getGamepad();
				loadController().then(obj => {
					c.add(i ? obj.clone() : obj);
				});
			}

			let puppet = c.userData.puppet;
			if (!puppet && puppets[i]) {
				puppet = puppets[i];
				c.userData.puppet = puppet;
				puppet.visible = true;
			}

			if (puppet && !puppetShow.playing) {
				// apply standing matrix
				c.matrix.decompose(c.position, c.quaternion, c.scale);

				// copy rotation
				puppet.rotation.copy(c.rotation);

				// copy position; adjust for world scale/position; constrain to stage
				puppet.position.copy(c.position).sub(world.position).divide(world.scale);
				puppet.position.clamp(stageBounds.min, stageBounds.max);
				// todo: constrain puppet on all sides, not just bottom

				if (isRecording) {
					const pos = puppet.position;
					const rot = puppet.rotation;
					puppetShowRecorder.recordEvent('puppet', {
						position: {
							x: pos.x,
							y: pos.y,
							z: pos.z
						},
						rotation: {
							x: rot.x,
							y: rot.y,
							z: rot.z
						}
					}, i);
				}
			}
		}
	});

	if (!isRecording || puppetShow.playing) {
		puppetShow.update();
	}

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

	// todo: format time properly w/ duration
	// todo: show progress bar?
	if (puppetShowRecorder && puppetShowRecorder.recording) {
		timecode.innerText = puppetShowRecorder.currentTime.toFixed(2);
	} else {
		timecode.innerText = puppetShow.currentTime.toFixed(2);
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
		togglePlaying();
	} else if (event.keyCode === 86) { // v
		togglePreview();
	}
}, true);

playButton.addEventListener('click', togglePlaying);

// load from URL or create a new one
const showIdResults = /^#([a-z0-9\-_]+)/i.exec(window.location.hash);
if (showIdResults && showIdResults[1]) {
	puppetShow.load(showIdResults[1]);

	// todo: handle not found or other error
} else {
	puppetShow.authenticate().then(() => puppetShow.create());
}

document.getElementById('new-show').addEventListener('click', () => {
	puppetShow.authenticate().then(() => puppetShow.create());
});

editingCheckbox.addEventListener('change', () => {
	isEditing = puppetShow.isCreator && editingCheckbox.checked;
	updateEditingState();
});

controllers.forEach(controller => {
	controller.addEventListener('triggerdown', toggleEditing);
	controller.addEventListener('thumbpaddown', togglePlaying);
});

updateEditingState();