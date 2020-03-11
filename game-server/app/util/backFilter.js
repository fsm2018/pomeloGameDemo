var logger = require('pomelo-logger').getLogger('m-debug',__filename);
const pomelo = require('pomelo');
const codeConfig = require('../../../shared/codeConfig');

const code = codeConfig.retCode;

module.exports = function (app) {
    return new Filter(app);
};


var Filter = function (app) {
    this.app = app;
};

Filter.prototype.before = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(new Error('请先登录'), {code: code.LOGIN_FIRST, msg: '请先登录'});
        this.app.backendSessionService.kickBySid(session.frontendId, session.id, function () {
        });
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level >= 0 && agent_level < 50) {
        let ip = session.get('ip');
        let ret = this.app.blackList.addConnect(ip);
        if (ret === -1) {
            next(new Error('服务器连接失败'), {code: code.FAIL, msg: '服务器连接失败'});
            this.app.backendSessionService.kickByUid(session.frontendId, session.uid, function () {
                self.app.blackList.clearTempConnect(ip);
            });
        } else if (ret === -2) {
            next(new Error('服务器连接失败'), {code: code.FAIL, msg: '服务器连接失败'});
            this.app.rpc.connector.conRemote.addBlacklist.toServer('*', ip, function () {
            });
            this.app.rpc.gate.gateRemote.addBlacklist.toServer('*', ip, function () {
            });
            this.app.backendSessionService.kickByUid(session.frontendId, session.uid, function () {
            });
        } else {
            next();
        }
    } else {
        next();
    }
};
Filter.prototype.after = function (err, msg, session, resp, next) {
    next(err);
};
