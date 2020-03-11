var logger = require('pomelo-logger').getLogger('m-debug',__filename);

module.exports = function (app) {
    return new Filter(app);
};


var Filter = function (app) {
    this.app = app;
};

Filter.prototype.before = async function (msg, session, next) {
    let ip = session.__session__.__socket__.remoteAddress.ip;
    let ret = this.app.blackList.addConnect(ip);
    if (ret === -1) {
        session.__session__.__socket__.disconnect();
        this.app.blackList.clearTempConnect(ip);
    } else if (ret === -2) {
        this.app.components.__connector__.blacklist.push(ip);
        session.__session__.__socket__.disconnect();
    }else {
        next();
    }
};
Filter.prototype.after = function (err, msg, session, resp, next) {
    next(err);
};
