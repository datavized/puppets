'use strict';

module.exports = function () {
	const gulp = require('gulp');
	const webpack = require('webpack-stream');
	const config = require('../../config');

	return gulp.src('src/js/index.js')
		.pipe(webpack(config.dev))
		.pipe(gulp.dest('dist'));
};