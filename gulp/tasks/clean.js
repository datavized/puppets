'use strict';

var del = require('del');

module.exports = function (cb) {
	del([
		// don't delete anything in data for now, until we straighten that out
		'dist/**/*',
		'dist/**/.*'
	], cb);
};
