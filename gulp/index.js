'use strict';

var fs = require('fs');
var taskFiles = fs.readdirSync('./gulp/tasks');
var gulp = require('gulp');
var tasks = {};

taskFiles.forEach(function(task) {
	var fn;

	if (!/\.js$/.test(task)) {
		return;
	}

	task = task.replace(/\.js$/, '');

	fn = require('./tasks/' + task);
	if (typeof fn === 'function') {
		tasks[task] = fn;
	}
	gulp.task(task, fn);
});

gulp.task('dev', ['dev-js', 'dev-html']);//, tasks['dev-sw']);
gulp.task('dist', ['dist-js', 'dist-html', 'manifest']);//, tasks['dist-sw']);

/*
todo: use this when js file name has a hash
gulp.task('dev', ['dev-js'], tasks['dev-html']);
gulp.task('dist', ['dist-js'], tasks['dist-html']);
*/

gulp.task('watch', ['dev-html'], function () {
	tasks.watch();
});

gulp.task('default', ['dev']);
