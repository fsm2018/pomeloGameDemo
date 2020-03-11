const watch = require('node-watch');


exports.watchFile = function (path, update) {
    watch(path, function (evt, name) {
        if (evt == 'update') {
            if (typeof update == 'function') {
                update();
            }
        }
    });
};
