'use strict';

const consoleOptions = {
	colors: true,
	chunks: false
};

const configPath = '../../config';

module.exports = function () {
	const path = require('path');
	const gulp = require('gulp');
	const webpack = require('webpack');
	const assign = require('object-assign');

	let compiler, watcher;

	function watchWebpack() {
		// force reload of config
		delete require.cache[require.resolve(configPath)];

		const config = require(configPath);
		const devConfig = assign({}, config.dev, {
			entry: './src/js/index.js',
			output: assign({}, config.dev.output, {
				path: 'dist'
			})
		});

		// watch using webpack
		compiler = webpack(devConfig);
		watcher = compiler.watch({}, function (err, stats) {
			console.log('watch', err, stats.toString(consoleOptions));
		});
	}

	// if config changes, restart watcher
	gulp.watch(['config/*', 'package.json'], function () {
		if (watcher) {
			watcher.close(function () {
				compiler.run(watchWebpack);
			});
		} else {
			watchWebpack();
		}
	});

	// rebuild html if template or config changes
	gulp.watch(['src/**/*.html', 'config/*', 'package.json'], ['dev-html']);

	watchWebpack();
};