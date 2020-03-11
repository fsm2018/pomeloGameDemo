const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const login = require('../../../domain/login/login');
const codeConfig = require('../../../../../shared/codeConfig');
const config = require('../../../../../shared/config/config');
const tokenMgr = require('../../../util/tokenMgr');
const com = require('../../../util/com');

const code = codeConfig.retCode;

const appId = '';
const appSecret = '';

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.statusService = app.get('statusService');
    this.sessionService = app.get('sessionService');
};


Handler.prototype.login = async function (msg, session, next) {
    let self = this;
    let ip = session.__session__.__socket__.remoteAddress.ip;
    let logintype = msg.logintype;
    let account = msg.account;
    let os = msg.os;
    let version = msg.version;
    let platform = msg.platform;

    let user, token, acc, nickname, sex, headimgurl, unionid;
    if (logintype === 1) {
        account = account.replace(/\s*/g, "");
        acc = `guest_${account}`;
        nickname = `游客_${account}`;
        sex = 0;
        headimgurl = '';
        unionid = acc;
        const reg = "^[0-9a-zA-Z]+$";
        const patt = new RegExp(reg);
        if (!patt.test(account)) {
            next(null, {code: code.FAIL, msg: '账号应由数字和字母组成'});
            return;
        }
    } else if (logintype === 2) {
        let data;
        data = await login.getAccesstoken(account, appId, appSecret);
        if (data) {
            const accessToken = data.access_token;
            const data2 = await login.getStateInfo(accessToken, data.openid);
            if (data2) {
                nickname = data2.nickname;
                sex = data2.sex;
                headimgurl = data2.headimgurl;
                unionid = data2.unionid;
                acc = `wx_${unionid}`;
                if (!unionid) {
                    next(null, {code: code.FAIL, msg: '获取微信信息失败-3'});
                    return;
                }
            } else {
                next(null, {code: code.FAIL, msg: '获取微信信息失败-2'});
                return;
            }
        } else {
            next(null, {code: code.FAIL, msg: '获取微信信息失败-1'});
            return;
        }
    } else if (logintype === 3) {
        let tokenData = tokenMgr.verify(account, os);
        if (!tokenData) {
            next(null, {code: code.CONNECTOR.TOKEN_EXPIRED, msg: '登录失效，请重新登录'});
            return;
        }
        acc = tokenData.account;
        token = account;
    } else if (logintype === 4) {
        ip = com.getfakeIP();
        account = account.replace(/\s*/g, "");
        acc = `guest_${account}`;
        const reg = "^[0-9a-zA-Z]+$";
        const patt = new RegExp(reg);
        if (!patt.test(account)) {
            next(null, {code: code.FAIL, msg: '账号应由数字和字母组成'});
            return;
        }
    } else {
        next(null, {code: code.FAIL, msg: '登录类型错误'});
        return;
    }
    session.set('ip', ip);
    session.pushAll(async function () {
        user = await login.checkAndcreateUser(session, acc, nickname, sex, headimgurl, unionid, logintype);
        if (await login.checkBanedUserByUserId(user.userid)) {
            next(null, {code: code.FAIL, msg: '网络错误-b'});
            return;
        }
        let AndroidVersion;
        let MinAndroidVersion;
        let IPhoneVersion;
        let MinIPhoneVersion;
        if (user) {
            let ServerInfo = self.app.get('ServerStateInfo');
            if (ServerInfo) {
                let ServerState = ServerInfo.ServerState;
                AndroidVersion = ServerInfo.AndroidVersion;
                MinAndroidVersion = ServerInfo.MinAndroidVersion;
                IPhoneVersion = ServerInfo.IPhoneVersion;
                MinIPhoneVersion = ServerInfo.MinIPhoneVersion;
                if (user.agent_level < 100) {
                    if (ServerState === 1) {
                        next(null, {code: code.MAINTAIN, msg: '服务器维护中...'});
                        return;
                    }
                    // if (platform === 1) {
                    //     if (version < MinAndroidVersion) {
                    //         next(null, {code: code.CONNECTOR.FORCE_UPDATE, msg: '需要更新最新版本'});
                    //         return;
                    //     }
                    // } else if (platform === 2) {
                    //     if (version < MinIPhoneVersion) {
                    //         next(null, {code: code.CONNECTOR.FORCE_UPDATE, msg: '需要更新最新版本'});
                    //         return;
                    //     }
                    // }
                }
            }
            self.statusService.getSidsByUid(user.userid, async (err, list) => {
                const func = function () {
                    session.bind(user.userid, (err, res) => {
                        if (err || res)
                            logger.debug(user.userid, 'session.bind', err, res);
                    });
                    if (user.roomid_p) {
                        session.set('roomId', user.roomid_p);
                    }
                    session.set('ip', ip);
                    session.set('name', user.name);
                    session.set('agent_level', user.agent_level);
                    session.on('closed', onUserLeave.bind(null, self.app));
                    session.pushAll(function () {
                        if (logintype !== 3)
                            token = tokenMgr.getNewToken(acc, os, version);
                        let MinVersion;
                        if (platform === 1) {
                            version = AndroidVersion;
                            MinVersion = MinAndroidVersion;
                        } else if (platform === 2) {
                            version = IPhoneVersion;
                            MinVersion = MinIPhoneVersion;
                        }
                        let data = login.buildcliInfo(user, token, version, MinVersion);
                        next(null, {code: code.OK, data: data});
                    });
                };
                if (!err) {
                    if (list && list.length > 0) {
                        self.statusService.pushByUids([user.userid], 'kickUser',
                            {
                                type: 1,
                                reason: '你的账号在其它地方登录'
                            }, function (err) {
                                if (err)
                                    logger.error(err);
                                if (list[0] == self.app.getServerId()) {
                                    self.sessionService.kick(user.userid, function () {
                                        func();
                                    });
                                } else {
                                    self.app.rpc.connector.conRemote.kickUser.toServer(list[0], user.userid, func());
                                }
                            });
                    } else {
                        func();
                    }
                } else {
                    next(null, {code: code.FAIL, msg: '登录失败_e'})
                }
            });
        } else {
            next(null, {code: code.FAIL, msg: '登录失败_f'})
        }
    });
};

const onUserLeave = function (app, session) {
    if (!session || !session.uid) {
        return;
    }
    let uid = session.uid;
    let fsid = session.frontendId;
    const func = function () {
        let roomId = session.get('roomId');
        logger.debug(`user leave:${uid}`);
        logger.debug(`user leave roomId:${roomId}`);
        if (roomId) {
            app.rpc.game.gameRemote.leaveRoom(session, uid, fsid, roomId, function () {
            });
            app.rpc.chat.chatRemote.leaveRoom(session, uid, roomId, function () {
            });
        }
        let clubId = session.get('clubId');
        if (clubId) {
            app.rpc.club.clubRemote.logoutClub(session, uid, clubId, function () {
            });
            app.rpc.chat.chatRemote.leaveClub(session, uid, clubId, function () {
            });
        }
        let hallGamehallId = session.get('hallGamehallId');
        if(hallGamehallId){
            // app.rpc.hallgame.gameRemote.logoutHallGameHall(session, uid, function () {
            // });
        }
        let hallgameId = session.get('hallgameId');
        if (hallgameId) {
            app.rpc.hallgame.gameRemote.leaveRoom(session, uid, fsid, hallgameId, function () {
            });
            app.rpc.chat.chatRemote.leaveRoom(session, uid, hallgameId, function () {
            });
        }
        app.get('mdclient').update_user_offline_time_by_userid(uid);
    };
    func();
};


