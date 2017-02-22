'use strict';

const gulp = require('gulp');
const nunjucksRender = require('gulp-nunjucks-render');
const data = require('gulp-data');
 
module.exports = function () {

	// force reload of config
	delete require.cache[require.resolve('../../config')];
	const config = require('../../config');

	nunjucksRender.nunjucks.configure(['src/'], { watch: false });

	return gulp.src('src/html/index.html')
		.pipe(data(function (file) {
			return {
				title: config.dev.title,
				scripts: [
					'index.js'
				],
				ga: false
			};
		}))
		.pipe(nunjucksRender({
			path: 'src'
		}))
		.pipe(gulp.dest('dist'));
};