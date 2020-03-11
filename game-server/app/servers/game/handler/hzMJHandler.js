const logger = require('pomelo-logger').getLogger('m-debug', __filename);
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
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let game = session.game;
    if (!game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    let pai = msg.pai;
    if (typeof pai !== "number") {
        next(null, {code: code.FAIL, msg: '出哪张牌'});
        return;
    }
    game.chupai(uid, pai);
    next();
};
Handler.prototype.chi = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let game = session.game;
    if (!game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    if (game.game.conf.gametype == codeConfig.gameType.pushing_hz) {
        next(null, {code: code.FAIL, msg: '该游戏不能吃'});
        return;
    }
    let cards = msg.pai;
    if (!Array.isArray(cards) || cards.length < 3) {
        next(null, {code: code.FAIL, msg: '吃牌数目不对'});
        return;
    }
    game.chi(uid, cards[0], cards[1], cards[2]);
    next();
};
Handler.prototype.peng = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let game = session.game;
    if (!game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    let lockret = await this.rdb.redlockkey(codeConfig.lock_key.room + game.roomId, async function () {
        game.peng(uid);
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '操作失败,请重试'});
        return;
    }
    next();
};
Handler.prototype.gang = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let game = session.game;
    if (!game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    let pai = msg.pai;
    let lockret = await this.rdb.redlockkey(codeConfig.lock_key.room + game.roomId, async function () {
        game.gang(uid, pai);
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '操作失败,请重试'});
        return;
    }
    next();
};
Handler.prototype.hu = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let game = session.game;
    if (!game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    let lockret = await this.rdb.redlockkey(codeConfig.lock_key.room + game.roomId, async function () {
        game.hu(uid);
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '操作失败,请重试'});
        return;
    }
    next();
};
Handler.prototype.guo = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let game = session.game;
    if (!game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    let lockret = await this.rdb.redlockkey(codeConfig.lock_key.room + game.roomId, async function () {
        game.guo(uid);
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '操作失败,请重试'});
        return;
    }
    next();
};
