'use strict';

import Recorder from 'recorderjs';
import eventEmitter from 'event-emitter';
import now from './now';

function PuppetShowRecorder(options) {
	/*
	todo:
	- record puppet positions
	- record sound effects
	- record background switches
	- handle missing gUM implementation or no devices
	- append recording

	- save events and assets to puppetShow
	- release microphone when page is in backround and not presenting?
	*/

	eventEmitter(this);

	const me = this;

	const {
		puppetShow,
		audioContext
	} = options;

	const recordConstraints = {
		audio: {
			channelCount: 1
		}
	};

	const audioInputDevices = [];

	// state
	let ready = false;
	let recording = false;
	let startTime = 0;
	let endTime = 0;

	let audioInputDevice = null;
	let audioStream = null;
	let audioSource = null;
	let audioRecorder = null;

	function getAudioStream() {
		navigator.mediaDevices.getUserMedia(recordConstraints).then(stream => {
			console.log('Accessed Microphone');
			// todo: update UI to show recording state

			audioSource = audioContext.createMediaStreamSource(stream);

			// need to connect to a destination. otherwise it won't process
			// const zeroGain = audioContext.createGain();
			// zeroGain.gain.value = 0.0;
			// audioSource.connect(zeroGain);
			// zeroGain.connect(audioContext.destination);

			if (audioRecorder) {
				audioRecorder.stop();
				audioRecorder.clear();
				// todo: what happens if we're recording?
			}

			audioRecorder = new Recorder(audioSource, {
				numChannels: 1
			});

			const wasReady = ready;
			ready = true;
			if (!wasReady) {
				me.emit('ready');
			}
		}).catch(err => {
			console.error('Cannot access microphone', err);
			// todo: fire error event; set state to not ready
			me.emit('error', err);
		});
	}

	this.init = () => {
		navigator.mediaDevices.enumerateDevices().then(devices => {
			audioInputDevices.length = 0;
			devices.forEach(dev => {
				if (dev.kind === 'audioinput') {
					audioInputDevices.push(dev);

					// todo: prioritize Vive or Rift mic
					if (dev.deviceId === 'default' || !audioInputDevice) {
						audioInputDevice = dev;
					}
				}
			});

			recordConstraints.audio.deviceId = audioInputDevice.deviceId;
			// todo: get audio stream only if device changed and not recording
			getAudioStream();
		});
	};

	this.start = () => {
		if (recording) {
			// todo: throw error? or emit error event?
			return;
		}

		if (!ready) {
			throw new Error('PuppetShowRecorder: Not ready to record');
		}

		// todo: allow appending
		this.reset();

		recording = true;
		startTime = now();
		audioRecorder.record();

		this.emit('start');
	};

	this.stop = () => {
		if (!recording) {
			// todo: throw error? or emit error event?
			return;
		}

		recording = false;
		endTime = now();
		audioRecorder.stop();

		// todo: save audio asset to puppetShow if not being cleared?

		this.emit('stop');
	};

	this.reset = () => {
		this.stop();

		if (!this.currentTime) {
			return;
		}

		if (audioRecorder) {
			audioRecorder.clear();
		}
		startTime = 0;
		endTime = 0;

		// todo: clear data out of puppetShow

		this.emit('reset');
	};

	// todo: query recording devices
	// todo: select audio recording device

	this.init();

	Object.defineProperties(this, {
		ready: {
			get: () => ready
		},
		currentTime: {
			get: () => ((recording ? now() : endTime) - startTime) / 1000
		},
		recording: {
			get: () => recording
		}
	});
}

export default PuppetShowRecorder;