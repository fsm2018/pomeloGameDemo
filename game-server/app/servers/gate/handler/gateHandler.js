const codeConfig = require('../../../../../shared/codeConfig');

const code = codeConfig.retCode;

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
};


Handler.prototype.queryEntry = function (msg, session, next) {
    var connectors = this.app.getServersByType('connector');
    if (!connectors || connectors.length === 0) {
        next(null, {code: code.FAIL, msg: '没有可用服务器'});
        return;
    }
    let ServerState = this.app.get('ServerStateInfo').ServerState;
    if (ServerState === 1) {
        next(null, {code: code.MAINTAIN, msg: '服务器维护中...'});
        return;
    }
    let index = Math.round(Math.random() * (connectors.length - 1));
    var res = connectors[index];
    next(null, {code: code.OK, data: {host: res.host, port: res.clientPort}});
};
