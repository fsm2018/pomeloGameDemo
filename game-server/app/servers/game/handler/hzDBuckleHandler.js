const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const codeConfig = require('../../../../../shared/codeConfig');

const code = codeConfig.retCode;


module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
    this.channelService = app.get('channelService');
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.roommgr = app.roomMgr;
    this.gamemgr = app.gameMgr;
};

Handler.prototype.chupai = function (msg, session, next) {
    let uid = session.uid;
    let game = session.game;
    if (!game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    let pai = msg.pai;
    if (pai.length <= 0) {
        next(null, {code: code.FAIL, msg: '出哪张牌'});
        return;
    }
    game.chupai(uid, pai, function (ret) {
        next(null, ret);
    });
};

Handler.prototype.guo = function (msg, session, next) {
    let uid = session.uid;
    let game = session.game;
    if (!game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    game.guo(uid, function (ret) {
        next(null, ret);
    });
};
