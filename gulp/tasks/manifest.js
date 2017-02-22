'use strict';

const gulp = require('gulp');
const assign = require('object-assign');
const fs = require('fs');

module.exports = function (cb) {
	const pkg = require('../../package.json');
	const config = require('../../config');

	const manifest = {
		name: config.title || pkg.name,
		display: 'fullscreen',
		orientation: 'landscape'
	};

	fs.readFile('src/manifest.json', function (err, contents) {
		if (!err && contents) {
			const srcManifest = JSON.parse(contents);
			assign(manifest, srcManifest);
		}

		fs.writeFile('dist/manifest.json', JSON.stringify(manifest, null, 2), cb);
	});
	//todo: figure out if it's easier to use gulp to get file that may not exist
};