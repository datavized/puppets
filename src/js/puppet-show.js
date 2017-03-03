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

const eventEmitter = require('event-emitter');

const firebase = require('firebase');
const ServerValue = firebase.database.ServerValue;
firebase.initializeApp({
	apiKey: 'AIzaSyCkvi50P1OfJTHTw0xs4G8D_ca6C8Bv2z4',
	authDomain: 'vr-puppet-show-dev.firebaseapp.com',
	databaseURL: 'https://vr-puppet-show-dev.firebaseio.com',
	storageBucket: 'vr-puppet-show-dev.appspot.com',
	messagingSenderId: '38391551003'
});

const showsRef = firebase.database().ref('shows');

function PuppetShow() {
	let showId = '';
	let showRef = null;
	let title = '';
	let loaded = false;
	/*
	todo:
	- set/get methods for metadata (arbitrary key/value)
	- methods for reading/creating/deleting events
	- method for full reset/erase (should have confirmation in UI)
	*/

	eventEmitter(this);

	this.create = () => {
		this.unload();

		showId = showsRef.push().key;

		showRef = showsRef.child(showId);
		showRef.set({
			id: showId,
			title: '', // todo: set random words if not provided?

			// todo: any additional metadata
			// todo: see if Firebase can set time stamps on server?
			createTime: ServerValue.TIMESTAMP,
			modifyTime: ServerValue.TIMESTAMP

			// todo: empty lists for assets and events (or have firebase do it?)
		});

		loaded = true;
		this.emit('load', showId);
	};

	this.unload = () => {
		const id = showId;
		const wasLoaded = loaded;

		showId = '';
		showRef = null;
		loaded = false;
		/*
		todo:
		- clear show id
		- reset metadata
		- disable saving to or loading from Firebase
		- stop playing (if we handle playback in here?)
		- remove all events from list
		- unload any audio or other media
		*/

		if (wasLoaded) {
			this.emit('unload', id);
		}
	};

	this.load = id => {
		this.unload();
		console.log('loading show', id);

		showId = id;
		showRef = showsRef.child(showId);

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

	Object.defineProperties(this, {
		id: {
			get: () => showId
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