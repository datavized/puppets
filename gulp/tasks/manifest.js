'use strict';

const path = require('path');

const gulp = require('gulp');
const assign = require('object-assign');
const fs = require('fs');

const DIST_DIR = path.join(__dirname, '..', '..', 'dist');

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

		fs.stat(DIST_DIR, function (err) {
			if (err) {
				if (err.code === 'ENOENT') {
					fs.mkdir(DIST_DIR, function (err) {
						if (err) {
							throwError(err);
						} else {
							writeManifest(DIST_DIR);
						}
					});
				} else {
					throwError(err);
				}
			} else {
				writeManifest(DIST_DIR);
			}
		});
	});

	const writeManifest = function () {
		fs.writeFile(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), cb);
	};

	const throwError = function (err) {
		throw err;
		cb(err);
	};

	//todo: figure out if it's easier to use gulp to get file that may not exist
};
