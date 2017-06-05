'use strict';

module.exports = function (callback) {
	const webpack = require('webpack');
	const assign = require('object-assign');
	const config = require('../../config');
	const devConfig = assign({}, config.dev, {
		entry: './src/js/index.js',
		output: assign({}, config.dev.output, {
			path: __dirname + '/../../dist'
		})
	});

	const compiler = webpack(devConfig);
	compiler.run(function (err, stats) {
		if (err) {
			callback(err);
			return;
		}

		console.log(stats.toString({
			colors: true,
			chunks: false
		}));
		callback();
	});
};