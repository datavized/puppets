'use strict';

const now = typeof performance === 'undefined' ? Date.now : function () {
	return performance.now();
};

export default now;