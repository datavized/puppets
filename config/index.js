module.exports = (function () {
	'use strict';

	//configuration
	const title = 'Mozilla VR Work in Progress';

	const assign = require('object-assign');
	const webpack = require('webpack');
	const pkg = require('../package.json');
	const CompressionPlugin = require('compression-webpack-plugin');
	const CopyWebpackPlugin = require('copy-webpack-plugin');
	const path = require('path');

	const banner = [
		pkg.name + ' - ' + pkg.description,
		'@version v' + pkg.version,
		'@link ' + pkg.homepage,
		'@license ' + pkg.license
	].join('\n');

	const common = {
		module: {
			preLoaders: [
				{
					test: /\.js$/,
					exclude: /node_modules/,
					loader: 'jshint-loader'
				},
				{
					test:	/\.js$/,
					exclude: /node_modules/,
					loader: 'jscs-loader'
				}
			],
			loaders: [
				{
					test: /\.js$/,
					exclude: /node_modules/,
					loader: 'babel?presets[]=es2015&cacheDirectory=true'
				},
				{
					test: /\.js$/,
					exclude: /node_modules/,
					loader: 'exports-loader'
				},
				{
					test: /\.html$/,
					exclude: /node_modules/,
					loader: 'html-loader'
				},
				{
					/*
					todo: look into optimizing image files
					maybe this https://github.com/tcoopman/image-webpack-loader
					*/
					test: /\.(jpg|png)$/,
					loader: 'url-loader',
					query: {
						limit: 8192,
						name: 'images/[name].[ext]'
					}
				},
				{
					/*
					todo: look into optimizing image files
					maybe this https://github.com/tcoopman/image-webpack-loader
					*/
					test: /\.(dae)$/,
					loader: 'url-loader',
					query: {
						limit: 1,
						name: 'models/[name].[ext]'
					}
				}
			]
		},

		resolveLoader: {
			root: path.join(__dirname, '../src/loaders')
		},

		resolve: {
			modulesDirectories: ['node_modules']
		},

		plugins: [
			new CopyWebpackPlugin([
				{
					from: 'src/root'
				}
			], {
				ignore: ['.DS_Store']
			})
		],

		jshint: assign({
			failOnHint: true,
			emitErrors: true
		}, pkg.jshintConfig),

		jscs: {
			failOnHint: true,
			emitErrors: true,

			preset: 'crockford',
			validateIndentation: '\t',
			validateLineBreaks: 'LF',
			requireLineFeedAtFileEnd: null,
			validateQuoteMarks: '\'',
			requireMultipleVarDecl: false
		}
	};

	const exports = {
		title
	};

	exports.dev = assign({}, common, {
		title: title,
		debug: true,
		devtool: 'inline-source-map',
		output: {
			filename: 'index.js',
			pathInfo: true
		},
		jshint: assign({}, common.jshint, {
			unused: false
		}),
		plugins: common.plugins.concat([
			new webpack.DefinePlugin({
				DEBUG: true
			})
		])
	});

	exports.production = assign({}, common, {
		debug: false,
		output: {
			filename: 'index.js',
			sourceMapFilename: '[file].map'
		},
		plugins: common.plugins.concat([
			// new webpack.DefinePlugin({
			// 	DEBUG: false,
			// 	'process.env': {
			// 		// This has effect on the react lib size
			// 		'NODE_ENV': JSON.stringify('production')
			// 	}
			// }),
			new webpack.optimize.DedupePlugin(),
			new webpack.optimize.UglifyJsPlugin({
				compress: {
					warnings: false
				}
			}),
			new webpack.BannerPlugin(banner)
		])
	});

	return exports;
}());