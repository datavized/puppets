'use strict';

import Recorder from 'recorderjs';
import eventEmitter from 'event-emitter';
import now from './now';

const hmdLabelRegex = /vive/i;

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
	let enabled = false;
	let ready = false;
	let recording = false;
	let startTime = 0;
	let endTime = 0;

	let audioInputDevice = null;
	// let audioStream = null;
	let audioSource = null;
	let audioRecorder = null;

	function destroyAudioRecorder() {
		if (audioRecorder) {
			audioRecorder.stop();
			audioRecorder.clear();

			try {
				if (audioSource) {
					audioSource.disconnect(audioRecorder.node);
				}
				audioRecorder.node.connect(audioContext.destination);
			} catch (e) {}

			audioRecorder = null;
		}
	}

	function getAudioStream() {
		navigator.mediaDevices.getUserMedia(recordConstraints).then(stream => {
			if (!enabled) {
				return;
			}

			console.log('Accessed Microphone');
			// todo: update UI to show recording state

			audioSource = audioContext.createMediaStreamSource(stream);

			// need to connect to a destination. otherwise it won't process
			// const zeroGain = audioContext.createGain();
			// zeroGain.gain.value = 0.0;
			// audioSource.connect(zeroGain);
			// zeroGain.connect(audioContext.destination);

			// todo: what happens if we're recording?
			destroyAudioRecorder();

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

	this.enable = () => {
		if (enabled) {
			return;
		}

		navigator.mediaDevices.enumerateDevices().then(devices => {
			const hmdGroupIds = {};
			devices.forEach(dev => {
				if (dev.kind === 'audioinput') {
					audioInputDevices.push(dev);

					// select default device
					if (dev.deviceId === 'default' || !audioInputDevice) {
						audioInputDevice = dev;
					}
				}

				if (hmdLabelRegex.test(dev.label)) {
					hmdGroupIds[dev.groupId] = true;
				}
			});

			// if a microphone device is in the same group as a HMD output, use it
			audioInputDevices.forEach(dev => {
				if (hmdGroupIds[dev.groupId]) {
					audioInputDevice = dev;
				}
			});

			recordConstraints.audio.deviceId = audioInputDevice.deviceId;
			// todo: get audio stream only if device changed and not recording
			getAudioStream();
		});

		enabled = true;
	};

	this.disable = () => {
		if (!enabled) {
			return;
		}

		this.stop();

		// clean up audioRecorder
		destroyAudioRecorder();

		// turn off microphone
		if (audioSource) {
			audioSource.mediaStream.getTracks().forEach(track => track.stop());
			audioSource = null;
		}

		enabled = false;
	};

	this.start = () => {
		if (recording || !enabled) {
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
		if (!recording || !enabled) {
			// todo: throw error? or emit error event?
			return;
		}

		puppetShow.pause();

		recording = false;
		endTime = now();
		audioRecorder.stop();

		const duration = (endTime - startTime) / 1000;

		// todo: save audio asset to puppetShow if not being cleared?
		audioRecorder.exportWAV(blob => {
			// todo: add time when we allow appending
			puppetShow.addAudio(blob, duration);
		});

		this.emit('stop');
	};

	this.reset = () => {
		this.stop();

		// if (!this.currentTime) {
		// 	return;
		// }

		puppetShow.pause();
		puppetShow.rewind();

		if (audioRecorder) {
			audioRecorder.clear();
		}
		startTime = 0;
		endTime = 0;

		// clear data out of puppetShow
		puppetShow.erase();

		this.emit('reset');
	};

	this.recordEvent = (eventType, params, index, dur) => {
		if (!enabled) {
			return;
		}

		puppetShow.addEvent(eventType, params, index, dur, this.currentTime);
	};

	// todo: allow querying of recording devices
	// todo: allow select audio recording device

	Object.defineProperties(this, {
		enabled: {
			get: () => ready
		},
		ready: {
			get: () => enabled && ready
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