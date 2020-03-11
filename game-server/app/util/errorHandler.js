var logger = require('pomelo-logger').getLogger('m-debug',__filename);

module.exports = function (err, msg, resp, session, cb) {
    return new errorHandler(err, msg, resp, session, cb);
};


var errorHandler = function (err, msg, resp, session, cb) {
    cb(null, resp);
};
