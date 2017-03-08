'use strict';

import eventEmitter from 'event-emitter';

function SoundEffect(options) {
	const src = options.src;
	const context = options.context;

	let buffer = null;

	const sources = [];

	eventEmitter(this);

	// load audio file
	if (options.src instanceof window.AudioBuffer) {
		buffer = options.src;
		this.duration = buffer.duration;
		setTimeout(() => this.emit('load'), 0);
	} else if (src && typeof src === 'string') {
		// todo: load appropriate format based on browser support
		const xhr = new XMLHttpRequest();
		xhr.responseType = 'arraybuffer';
		xhr.onload = () => {
			context.decodeAudioData(xhr.response, decodedBuffer => {
				buffer = decodedBuffer;
				this.duration = buffer.duration;
				console.log('loaded buffer', src, buffer);
			});
		};
		xhr.onerror = e => {
			// keep trying
			console.warn('Error loading audio', src, e);
		};
		xhr.open('GET', src, true);
		xhr.send();
	} else {
		throw new Error('SoundEffect: missing src option');
	}

	let stopSource;
	function stopEvent(evt) {
		stopSource(evt.target);
	}

	stopSource = function (source) {
		try {
			source.removeEventListener('ended', stopEvent);
			source.disconnect(context.destination);
			source.stop(0);
		} catch (e) {}
		const i = sources.indexOf(source);
		if (i >= 0) {
			sources.splice(i, 1);
		}
	};

	this.play = offset => {
		if (buffer) {
			const source = context.createBufferSource();
			source.buffer = buffer;
			source.connect(context.destination);
			source.addEventListener('ended', stopEvent);
			source.start(0, offset || 0);
			sources.push(source);
		}
	};

	this.stop = () => {
		while (sources.length) {
			stopSource(sources[0]);
		}
	};

	this.name = options.name || 'Sound';

	this.duration = NaN;
}

export default SoundEffect;