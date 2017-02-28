'use strict';

function SoundEffect(options) {
	const buttonContainer = typeof options.buttonContainer === 'string' ?
		document.querySelector(options.buttonContainer) :
		options.buttonContainer;

	const src = options.src;
	const context = options.context;

	let buffer = null;

	const sources = [];

	// load audio file
	// todo: load appropriate format based on browser support
	const xhr = new XMLHttpRequest();
	xhr.responseType = 'arraybuffer';
	xhr.onload = () => {
		context.decodeAudioData(xhr.response, decodedBuffer => {
			buffer = decodedBuffer;
			console.log('loaded buffer', src, buffer);
		});
	};
	xhr.onerror = e => {
		// keep trying
		console.warn('Error loading audio', src, e);
	};
	xhr.open('GET', src, true);
	xhr.send();

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

	this.play = () => {
		if (buffer) {
			const source = context.createBufferSource();
			source.buffer = buffer;
			source.connect(context.destination);
			source.addEventListener('ended', stopEvent);
			source.start(0);
			sources.push(source);
		}
	};

	this.stop = () => {
		while (sources.length) {
			stopSource(sources[0]);
		}
	};

	/*
	Use better-looking button design #8
	*/
	const button = document.createElement('button');
	button.appendChild(document.createTextNode(options.name || 'Sound'));
	button.addEventListener('click', this.play);
	buttonContainer.appendChild(button);
}

export default SoundEffect;