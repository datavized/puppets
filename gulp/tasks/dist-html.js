'use strict';

const htmlminOptions = {
	removeComments: true,
	removeCommentsFromCDATA: true,
	removeCDATASectionsFromCDATA: true,
	collapseWhitespace: true,
	collapseBooleanAttributes: true,
	removeAttributeQuotes: true,
	removeRedundantAttributes: true,
	useShortDoctype: true,
	removeEmptyAttributes: true,
	removeScriptTypeAttributes: true,
	// lint: true,
	caseSensitive: true,
	minifyJS: true,
	minifyCSS: true
};

module.exports = function () {
	const gulp = require('gulp');
	const nunjucksRender = require('gulp-nunjucks-render');
	const data = require('gulp-data');
	const htmlmin = require('gulp-htmlmin');

	const config = require('../../config');

	nunjucksRender.nunjucks.configure(['src/'], { watch: false });

	return gulp.src('src/html/index.html')
		.pipe(data(function (file) {
			const vars = {
				title: config.dev.title,
				scripts: [
					'index.js' //todo: use hash
				],
				ga: true
			};

			return vars;
		}))
		.pipe(nunjucksRender({
			path: 'src'
		}))
		.pipe(htmlmin(htmlminOptions))
		.pipe(gulp.dest('dist'));
};