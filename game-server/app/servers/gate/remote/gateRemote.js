const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const fs = require('fs');
module.exports = function (app) {
    return new Remote(app);
};
var Remote = function (app) {
    this.app = app;
};

Remote.prototype.addBlacklist = function (ip, cb) {
    if (this.app.components.__connector__.blacklist.indexOf(ip) === -1) {
        this.app.components.__connector__.blacklist.push(ip);
        let str = `${ip},`;
        fs.writeFile(this.app.getBase() + `/logs/blacklist-${this.app.getServerId()}.txt`, str, {flag: 'a'}, function (err) {
            if (err) {
                logger.error(`write blacklist err:${err}`);
            } else {
                logger.debug(`write blacklist success:${str}`);
            }
        });
    }
    cb();
};
