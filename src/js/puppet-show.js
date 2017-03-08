'use strict';

/*
Stores the entire script of a puppet show
- Handles saving and loading on Firebase server
- Stores general metadata about show (for now just ID)
  - showId
  - creation time stamp
  - modification time stamp
  - Title
  - Authors?
  - Description?
  - any playback stats?
- Stores all events and media
- Only one show loaded at a time
*/

/*
todo: get Firebase credentials from config?
todo: replace with production credentials
todo: move metadata into a sub-structure
*/

import now from './now';
import eventEmitter from 'event-emitter';
import firebase from 'firebase';

const ServerValue = firebase.database.ServerValue;
firebase.initializeApp({
	apiKey: 'AIzaSyCkvi50P1OfJTHTw0xs4G8D_ca6C8Bv2z4',
	authDomain: 'vr-puppet-show-dev.firebaseapp.com',
	databaseURL: 'https://vr-puppet-show-dev.firebaseio.com',
	storageBucket: 'vr-puppet-show-dev.appspot.com',
	messagingSenderId: '38391551003'
});

/*
Firebase anonymous authorization
*/
const auth = firebase.auth();
const authCallbacks = [];
let currentUser = auth.currentUser;
let userId = currentUser && currentUser.uid || '';
let signInRequested = true;

function attemptSignIn() {
	if (!signInRequested) {
		signInRequested = true;
		auth.signInAnonymously().catch(err => {
			console.warn('Failed to sign in anonymously', err.code, err.message);
			signInRequested = false;
		});
	}
}

auth.onAuthStateChanged(user => {
	signInRequested = false;
	if (user === currentUser) {
		if (!user && authCallbacks.length) {
			attemptSignIn();
		}

		// no change
		return;
	}

	currentUser = user;
	if (user) {
		console.log('User authenticated', user.toJSON());
		userId = user.uid;

		while (authCallbacks.length) {
			const cb = authCallbacks.shift();
			cb(user);
		}
	} else {
		console.log('User signed out');
		userId = '';
	}
});

function authenticate() {
	return new Promise(resolve => {
		if (currentUser) {
			resolve(currentUser);
			return;
		}

		authCallbacks.push(resolve);
		attemptSignIn();
	});
}

const showsRef = firebase.database().ref('shows');

const storage = firebase.storage();
const audioStorageRef = storage.ref().child('audio');

function sortEvents(a, b) {
	return a.time - b.time;
}

function PuppetShow(options) {
	const me = this;
	const {audioContext} = options;

	let showId = '';
	let showRef = null;
	let showCreatorId = '';
	let audioAssetsRef = null;
	let title = '';
	let loaded = false; // loaded = data loaded, enough to edit
	let ready = false; // ready = ready to play
	let duration = 0;
	let assetsToLoad = 0;

	// playback state
	let playStartTime = 0;
	let playEndTime = 0;
	let playing = 0;
	let lastUpdateTime = 0;
	let playEventIndex = 0;
	const currentEventsByType = new Map();
	const previousEventsByType = new Map();
	/*
	todo:
	- set/get methods for metadata (arbitrary key/value)
	- track status of unsaved data and fire events accordingly
	*/

	/*
	Audio assets stored as decoded buffers.
	Each audio asset has a start time
	For now, we don't foresee the need for other types of assets

	maybe this is fine as a set?
	*/
	const audioAssets = new Map();
	const events = [];

	function checkReady() {
		if (!ready && !assetsToLoad && loaded) {
			ready = true;
			me.emit('ready');
		}
	}

	eventEmitter(this);

	this.authenticate = authenticate;

	this.create = () => {
		if (!userId) {
			console.warn('Cannot create a new show if not authenticated');
			return;
		}

		this.unload();

		showId = showsRef.push().key;
		showCreatorId = userId;

		showRef = showsRef.child(showId);
		showRef.set({
			id: showId,
			title: '', // todo: set random words if not provided?

			// todo: any additional metadata
			createTime: ServerValue.TIMESTAMP,
			modifyTime: ServerValue.TIMESTAMP,
			creator: userId
		});

		audioAssetsRef = audioStorageRef.child(showId);

		loaded = true;
		this.emit('load', showId);
	};

	this.unload = () => {
		const id = showId;
		const wasLoaded = loaded;
		const wasReady = ready;

		showId = '';
		showCreatorId = '';
		showRef = null;
		loaded = false;
		ready = false;
		assetsToLoad = 0;
		duration = 0;
		/*
		todo:
		- reset metadata
		- disable saving to or loading from Firebase
		- stop playing (if we handle playback in here?)
		*/

		audioAssets.clear();
		events.length = 0;

		if (wasReady) {
			this.emit('unready');
		}

		if (wasLoaded) {
			this.emit('unload', id);
		}
	};

	this.load = id => {
		this.unload();
		console.log('loading show', id);

		showId = id;
		showRef = showsRef.child(showId);
		audioAssetsRef = audioStorageRef.child(showId);

		showRef.once('value', snapshot => {
			if (id !== showId) {
				// we've since unloaded this show
				return;
			}

			if (!snapshot.exists()) {
				console.error('show not found', id);
				this.emit('error', id); // todo: add reason
				this.unload();
				return;
			}

			const showVal = snapshot.val();
			console.log('loaded', showId, showVal);

			title = showVal.title || '';
			showCreatorId = showVal.creator;
			duration = Math.max(duration, showVal.duration || 0);

			events.push.apply(events,
				Object.keys(showVal.events || {})
					.map(key => showVal.events[key])
					.sort(sortEvents)
			);

			// start loading recorded audio files
			Object.keys(showVal.audio || {}).forEach(audioId => {
				const audioObject = {
					buffer: null,
					time: showVal.audio[audioId],
					id: audioId
				};

				audioAssets.set(audioId, audioObject);

				/*
				Abort at each step if audio asset is no longer valid
				*/

				function isInvalid() {
					return id !== showId || !audioAssets.has(audioId);
				}

				const audioFileRef = audioAssetsRef.child(audioId + '.wav');
				audioFileRef.getDownloadURL().then(url => {
					// todo: load this as a SoundEffect?
					// todo: adjust playable state?

					if (isInvalid()) {
						return;
					}

					const xhr = new XMLHttpRequest();
					xhr.responseType = 'arraybuffer';
					xhr.onload = () => {
						if (isInvalid()) {
							return;
						}
						audioContext.decodeAudioData(xhr.response, decodedBuffer => {
							audioObject.buffer = decodedBuffer;
							console.log('loaded buffer', url, decodedBuffer);

							duration = Math.max(duration, audioObject.time + decodedBuffer.duration);

							assetsToLoad--;
							checkReady();
						});
					};
					xhr.onerror = e => {
						// keep trying
						console.warn('Error loading audio', url, e);
					};
					xhr.open('GET', url, true);
					xhr.send();
				}).catch(err => {
					console.error('Error accessing file', err, auth.currentUser);
				});

				assetsToLoad++;
			});

			loaded = true;

			this.emit('load', showId);
		});
		/*
		todo:
		- set any metadata
		- enable saving to Firebase once done loading event list
		- add all events to list
		- request audio and other media

		- fire event on success and/or return a promise?
		- fire event on error (w/ reason?)
		*/
	};

	/*
	This is destructive and permanent. Do not call this without UI confirmation.
	*/
	this.erase = () => {
		if (!showRef) {
			return;
		}

		if (!userId || userId !== showCreatorId) {
			console.warn('Cannot erase show if not authenticated as creator');
			return;
		}

		this.pause();
		this.rewind();

		// clear events and assets from local memory
		audioAssets.clear();
		events.length = 0;
		duration = 0;
		assetsToLoad = 0;

		// erasing all media assets and events from server
		showRef.child('duration').set(0);
		showRef.child('events').remove();
		showRef.child('audio').remove();
		audioAssetsRef.delete()
			.then(() => console.log('deleted audio files'))
			.catch(err => console.log('error deleting audio files', err));
		/*
		Erasing audio files from Firebase will fail without proper authentication
		or appropriate configuration.
		*/
	};

	this.addEvent = (type, params, index, dur, time) => {
		if (!showRef) {
			return;
		}

		if (!userId || userId !== showCreatorId) {
			console.warn('Cannot edit show if not authenticated as creator');
			return;
		}

		const event = {
			time,
			type,
			params
		};

		if (index !== undefined) {
			event.index = index;
		}

		if (dur > 0) {
			event.duration = dur;
		}

		events.push(event);
		showRef.child('events').push(event);

		duration = Math.max(duration, time + (dur || 0));
		showRef.child('duration').set(duration);
		showRef.child('modifyTime').set(ServerValue.TIMESTAMP);
	};

	this.addAudio = (encodedBlob, time) => {
		if (!loaded) {
			// todo: either wait to finish loading or throw error
			return;
		}

		if (!userId || userId !== showCreatorId) {
			console.warn('Cannot edit show if not authenticated as creator');
			return;
		}

		if (!time) {
			time = 0;
		}

		const id = showRef.child('audio').push().key;
		const assetRef = showRef.child('audio/' + id);
		assetRef.set(time);

		const audioObject = {
			buffer: null,
			time,
			id
		};

		// todo: update ready-to-play state?

		audioAssets.set(id, audioObject);

		const wasReady = ready;
		ready = false;
		assetsToLoad++;

		// todo: Decode and add to audioObject.buffer
		const fileReader = new FileReader();
		fileReader.onloadend = () => {
			if (!audioAssets.has(id)) {
				// in case asset has been removed
				return;
			}
			audioContext.decodeAudioData(fileReader.result).then(decodedBuffer => {

				audioObject.buffer = decodedBuffer;
				// todo: set up audio source or whatever
				console.log('decoded audio');

				duration = Math.max(duration, audioObject.time + decodedBuffer.duration);
				showRef.child('duration').set(duration);

				assetsToLoad--;
				checkReady();
			});
		};
		fileReader.readAsArrayBuffer(encodedBlob);

		/*
		todo: monitor upload status
		- see https://firebase.google.com/docs/storage/web/upload-files#manage_uploads
		- cancel upload if puppetShow gets cleared before it's done
		- fire event when file complete
		- fire event when all pending uploads are complete
		- do not cancel upload if a new show is loaded
		- report error. Maybe try again?
		*/
		const audioFileRef = audioAssetsRef.child(id + '.wav');
		audioFileRef.put(encodedBlob).then(snapshot => {
			console.log('saved audio file', id, snapshot);
		});

		// showRef.child('modifyTime').set(ServerValue.TIMESTAMP);
		// todo: add to list of events

		if (wasReady) {
			this.emit('unready');
		}
	};

	this.play = () => {
		if (!ready) {
			console.error('Cannot play show. Not fully loaded yet.');
			return;
		}

		if (playing) {
			return;
		}

		if (this.currentTime >= duration) {
			this.rewind();
		}

		playing = true;
		playStartTime = now();

		// todo: adjust playStartTime for resuming

		this.emit('play');
		this.update();
	};

	this.pause = () => {
		if (!playing) {
			return;
		}

		playEndTime = now();
		playing = false;

		this.emit('pause');
		this.update();
	};

	this.rewind = () => {
		playStartTime = playEndTime = now();
		// currentEventsByType.clear();
		this.update();
	};

	this.update = () => {
		// find any current events of each type/index and fire an event
		// we assume the event handler will take care of ending the event
		const currentTime = this.currentTime;
		let index = currentTime >= lastUpdateTime ? playEventIndex : 0;

		currentEventsByType.forEach(map => map.clear());

		while (index < events.length) {
			const event = events[index];
			if (event.time > currentTime) {
				break;
			}

			if (event.duration) {
				// events with durations can happen simultaneously
				this.emit('event', event);
			} else {
				// events w/o duration are one at a time, so only fire the latest
				const type = event.type;
				let currentEventsByIndex = currentEventsByType.get(type);
				if (!currentEventsByIndex) {
					currentEventsByIndex = new Map();
					currentEventsByType.set(type, currentEventsByIndex);
				}
				currentEventsByIndex.set(event.index, event);
			}
			// const previous = previousEventsByIndex.get(event.index || null);
			index++;
		}

		currentEventsByType.forEach(map => {
			map.forEach(event => this.emit('event', event));
		});

		playEventIndex = index;
		lastUpdateTime = currentTime;

		if (currentTime >= duration) {
			this.pause();
		}
	};

	Object.defineProperties(this, {
		id: {
			get: () => showId
		},
		loaded: {
			get: () => loaded
		},
		ready: {
			get: () => ready
		},
		duration: {
			get: () => duration
		},
		isCreator: {
			get: () => !!showId && !!userId && userId === showCreatorId
		},
		userId: {
			get: () => userId
		},
		showCreatorId: {
			get: () => showCreatorId
		},
		events: {
			value: events
		},

		playing: {
			get: () => playing
		},
		currentTime: {
			get: () => Math.min(duration, ((playing ? now() : playEndTime) - playStartTime) / 1000)
		},

		title: {
			get: () => title,
			set: newTitle => {
				if (loaded && newTitle !== title) {
					title = newTitle;
					showRef.update({
						title,
						modifyTime: ServerValue.TIMESTAMP
					});
				}
			}
		}
	});
}

export default PuppetShow;