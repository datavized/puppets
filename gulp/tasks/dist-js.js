'use strict';

const consoleOptions = {
	colors: true,
	chunks: false
};

module.exports = function (callback) {
	const webpack = require('webpack');
	const assign = require('object-assign');

	const config = require('../../config');
	const prodConfig = assign({}, config.production, {
		entry: './src/js/index.js',
		output: assign({}, config.dev.output, {
			path: __dirname + '/../../dist'
		})
	});

	const compiler = webpack(prodConfig);
	compiler.run(function (err, stats) {
		if (err) {
			callback(err);
		} else {
			console.log(stats.toString(consoleOptions));
			callback();
		}
	});
};