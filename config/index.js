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

	const THREE = require('three');
	const externals = {
		firebase: 'firebase'
	};

	// don't use external three.js if running a dev version
	if (/^[0-9]+$/.test(THREE.REVISION)) {
		externals.three = 'THREE';
	} else {
		console.warn('Building with three.js r' + THREE.REVISION);
	}

	const common = {
		module: {
			rules: [
			// preLoaders
				{
					test: /\.js$/,
					exclude: /node_modules/,
					loader: 'jshint-loader',
					enforce: 'pre',
					options: assign({
						failOnHint: true,
						emitErrors: true
					}, pkg.jshintConfig)
				},
				{
					test:	/\.js$/,
					exclude: /node_modules/,
					loader: 'jscs-loader',
					enforce: 'pre',
					options: {
						failOnHint: true,
						emitErrors: true,

						preset: 'crockford',
						validateIndentation: '\t',
						requireLineFeedAtFileEnd: null,
						validateQuoteMarks: '\'',
						requireMultipleVarDecl: false
					}
				},

				// main loaders
				{
					test: /\.js$/,
					exclude: /node_modules/,
					use: [
						{
							loader: 'babel-loader',
							options: {
								presets: ['es2015'],
								cacheDirectory: true
							}
						},
						{
							loader: 'exports-loader'
						}
					]
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
					options: {
						limit: 8192,
						name: 'images/[name].[ext]'
					}
				},
				{
					/*
					todo: look into optimizing image files
					maybe this https://github.com/tcoopman/image-webpack-loader
					*/
					test: /\.(obj|dae)$/,
					loader: 'url-loader',
					options: {
						limit: 1,
						name: 'models/[name].[ext]'
					}
				}
			]
		},

		resolveLoader: {
			alias: {
				exports: 'exports-loader',
				imports: 'imports-loader'
			},
			modules: [
				'node_modules'
			]
		},

		plugins: [
			new CopyWebpackPlugin([
				{
					from: 'src/root'
				}
			], {
				ignore: ['.DS_Store']
			})
		]
	};

	function filterModuleRules(module, ruleFilter) {
		function fixRule(rule) {
			if (Array.isArray(rule.use)) {
				const use = rule.use.map(fixRule);
				rule = assign({}, rule, {
					use
				});
			}
			if (!rule.loader) {
				return rule;
			}
			return ruleFilter(rule);
		}
		const rules = module.rules.map(fixRule);
		return assign({}, module, {
			rules
		});
	}

	const exports = {
		title
	};

	exports.dev = assign({}, common, {
		module: filterModuleRules(common.module, rule => {
			if (rule.loader === 'jshint-loader') {
				const options = assign({
					failOnHint: false,
					emitErrors: false
				}, pkg.jshintConfig);
				rule = assign({}, rule, {
					options
				});
			}
			return rule;
		}),
		devtool: 'inline-source-map',
		output: {
			filename: 'index.js',
			// pathInfo: true
		},
		plugins: common.plugins.concat([
			new webpack.DefinePlugin({
				DEBUG: true
			})
		])
	});

	exports.production = assign({}, common, {
		output: {
			filename: 'index.js',
			sourceMapFilename: '[file].map'
		},
		externals,
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
				sourceMap: true,
				compress: {
					warnings: false
				}
			}),
			new webpack.BannerPlugin({
				banner
			})
		])
	});

	return exports;
}());