const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const com = require('../../../util/com');
const codeConfig = require('../../../../../shared/codeConfig');
const code = codeConfig.retCode;
module.exports = function (app) {
    return new Handler(app);
};
var Handler = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.statusService = app.get('statusService');
};
Handler.prototype.getAgentInfo = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userInfo = await this.mdb.get_user_data_by_userid(uid);
    if (!userInfo) {
        next(null, {code: code.FAIL, msg: '获取个人信息失败'});
        return;
    }
    let data = {};
    data.userId = userInfo.userid;
    data.headImg = userInfo.headimg;
    data.name = userInfo.name;
    data.gems = userInfo.gems;
    data.sell_today = userInfo.record_gems.sell_today;
    data.sell_mon = userInfo.record_gems.sell_mon;
    data.sell_total = userInfo.record_gems.sell_total;
    next(null, {code: code.OK, data: data});
};
Handler.prototype.sellGems = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.sellgems + uid, async function () {
        let gems = msg.gems;
        let userId = msg.userId;
        if (userId === uid) {
            next(null, {code: code.FAIL, msg: '自己不能出售给自己'});
        }
        let ret = await self.mdb.deal_gems(uid, userId, gems, codeConfig.GemType.GEM);
        if (ret.code === code.OK) {
            next(null, {code: code.OK, data: ret});
        } else {
            next(null, {code: code.FAIL, msg: ret.msg});
        }
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '出售失败,请重试'});
    }
};
Handler.prototype.getSellRecord = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let start = msg.start;
    let step = msg.step;
    let ret = await this.mdb.get_deal_list(uid, null, start, step, codeConfig.GemType.GEM);
    if (ret) {
        next(null, {code: code.OK, data: ret});
    } else {
        next(null, {code: code.FAIL, msg: '获取失败'});
    }
};
Handler.prototype.getUserChargeRecord = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userid = uid;
    if (agent_level >= 100) {
        if (msg.userid) {
            userid = msg.userid;
            if (userid < 100000) {
                userid = null;
            }
        }
    }
    let startDate = msg.startdate;
    let endDate = msg.enddate;
    let start = com.isNumber(msg.start) ? msg.start : 0;
    let step = com.isNumber(msg.step) ? msg.step : 20;
    let ret = await this.mdb.get_orders_by_userid(userid, start, step, startDate, endDate);
    next(null, {code: code.OK, data: ret});
};
Handler.prototype.getSpreadUserInfo = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let userId = msg.userId;
    if (userId) {
        let ret = await this.mdb.get_spread_user_info_by_userid(userId);
        if (ret) {
            if (ret.ownerid === uid) {
                next(null, {code: code.OK, data: [ret]});
            } else {
                next(null, {code: code.FAIL, msg: '不是你的推广好友,无法查询'});
            }
        } else {
            next(null, {code: code.FAIL, msg: '查询失败'});
        }
    } else {
        let ret = await this.mdb.get_spread_users_info_by_ownerid(uid);
        next(null, {code: code.OK, data: ret});
    }
};
Handler.prototype.getRebate = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.rebate + uid, async function () {
        let rate = 10;
        let userId = msg.userId;
        if (userId) {
            let userInfo = await self.mdb.get_spread_user_info_by_userid(userId);
            if (userInfo.ownerid !== uid) {
                next(null, {code: code.FAIL, msg: '你不是该用户的邀请人,无法领取'});
                return;
            }
            let rebate = parseInt(userInfo.record_gems.buy_rebate / rate);
            if (rebate <= 0) {
                next(null, {code: code.FAIL, msg: '该用户已经没有可领取奖励了'});
            } else {
                let ret = await self.mdb.set_spread_user_buy_rebate_by_userid(userId, -rebate * rate);
                if (ret) {
                    let me = await self.mdb.addGems_by_userid(uid, rebate);
                    if (me) {
                        if (!await self.rdb.addRebate_Recevice_history(uid, rebate, userId, codeConfig.GemType.GEM)) {
                            let now = new Date();
                            logger.error(`用户:${uid},领取返利记录失败,${now} rebate:${rebate}`);
                        }
                        next(null, {code: code.OK, data: {}, msg: '领取成功'});
                    } else {
                        let r = await self.mdb.set_spread_user_buy_rebate_by_userid(userId, rebate * rate);
                        if (!r) {
                            logger.error(`getRebate回滚数据失败,userId:${userId},rebate:${rebate * rate}`);
                        }
                    }
                } else {
                    next(null, {code: code.FAIL, msg: '领取失败'});
                }
            }
        } else {
            let users = await self.mdb.get_spread_users_info_by_ownerid(uid);
            if (users.length <= 0) {
                next(null, {code: code.FAIL, msg: '没有推广好友,无法领取'});
                return;
            }
            let index = 0;
            while (index < users.length) {
                let user = users[index];
                let rebate = parseInt(user.record_gems.buy_rebate / rate);
                if (rebate > 0) {
                    let ret = await self.mdb.set_spread_user_buy_rebate_by_userid(user.userid, -rebate * rate);
                    if (ret) {
                        let me = await self.mdb.addGems_by_userid(uid, rebate);
                        if (me) {
                            if (!await self.rdb.addRebate_Recevice_history(uid, rebate, user.userid, codeConfig.GemType.GEM)) {
                                let now = new Date();
                                logger.error(`用户:${uid},领取返利记录失败,${now} rebate:${rebate}`);
                            }
                        } else {
                            let r = await self.mdb.set_spread_user_buy_rebate_by_userid(user.userid, rebate * rate);
                            if (!r) {
                                logger.error(`getRebate回滚数据失败,userId:${user.userid},rebate:${rebate * rate}`);
                            }
                        }
                    }
                }
                console.log(index);
                index++;
            }
            console.log("getRebate end");
            next(null, {code: code.OK, data: {}, msg: '领取成功'});
        }
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '领取失败,请重试'});
    }
};
Handler.prototype.getRebateHistroy = async function (msg, session, next) {
    let uid = session.uid;
    let start = com.isNumber(msg.start) ? msg.start : 0;
    let end = com.isNumber(msg.step) ? start + msg.step : -1;
    let ret = await this.rdb.getRebate_Recevice_history(uid, codeConfig.GemType.GEM, start, end);
    next(null, {code: code.OK, data: {history: ret}});
};
Handler.prototype.getStatistics = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let todayLogin = await this.rdb.getLoginOrRegister(codeConfig.Statistics.login.today);
    let yesterdayLogin = await this.rdb.getLoginOrRegister(codeConfig.Statistics.login.yesterday);
    let weekLogin = await this.rdb.getLoginOrRegister(codeConfig.Statistics.login.week);
    let lastweekLogin = await this.rdb.getLoginOrRegister(codeConfig.Statistics.login.lastweek);
    let monthLogin = await this.rdb.getLoginOrRegister(codeConfig.Statistics.login.month);
    let lastmonthLogin = await this.rdb.getLoginOrRegister(codeConfig.Statistics.login.lastmonth);

    let todayRegister = await this.rdb.getLoginOrRegister(codeConfig.Statistics.register.today);
    let yesterdayRegister = await this.rdb.getLoginOrRegister(codeConfig.Statistics.register.yesterday);
    let weekRegister = await this.rdb.getLoginOrRegister(codeConfig.Statistics.register.week);
    let lastweekRegister = await this.rdb.getLoginOrRegister(codeConfig.Statistics.register.lastweek);
    let monthRegister = await this.rdb.getLoginOrRegister(codeConfig.Statistics.register.month);
    let lastmonthRegister = await this.rdb.getLoginOrRegister(codeConfig.Statistics.register.lastmonth);

    let data = {};
    data.login = {};
    data.login.today = todayLogin;
    data.login.yesterday = yesterdayLogin;
    data.login.week = weekLogin;
    data.login.lastweek = lastweekLogin;
    data.login.month = monthLogin;
    data.login.lastmonth = lastmonthLogin;

    data.register = {};
    data.register.today = todayRegister;
    data.register.yesterday = yesterdayRegister;
    data.register.week = weekRegister;
    data.register.lastweek = lastweekRegister;
    data.register.month = monthRegister;
    data.register.lastmonth = lastmonthRegister;

    data.cost = {};
    let StatisticsGameTypeKeys = Object.keys(codeConfig.StatisticsGameType);
    let index = 0;
    while (index < StatisticsGameTypeKeys.length) {
        let key = StatisticsGameTypeKeys[index];
        let today = codeConfig.Statistics.cost.today + codeConfig.StatisticsGameType[key];
        let todayOld = codeConfig.Statistics.cost.yesterday + codeConfig.StatisticsGameType[key];
        let week = codeConfig.Statistics.cost.week + codeConfig.StatisticsGameType[key];
        let weekOld = codeConfig.Statistics.cost.lastweek + codeConfig.StatisticsGameType[key];
        let month = codeConfig.Statistics.cost.month + codeConfig.StatisticsGameType[key];
        let monthOld = codeConfig.Statistics.cost.lastmonth + codeConfig.StatisticsGameType[key];

        data.cost[codeConfig.StatisticsGameType[key]] = {};
        data.cost[codeConfig.StatisticsGameType[key]].today = await this.rdb.getCostCount(today);
        data.cost[codeConfig.StatisticsGameType[key]].yesterday = await this.rdb.getCostCount(todayOld);
        data.cost[codeConfig.StatisticsGameType[key]].week = await this.rdb.getCostCount(week);
        data.cost[codeConfig.StatisticsGameType[key]].lastweek = await this.rdb.getCostCount(weekOld);
        data.cost[codeConfig.StatisticsGameType[key]].month = await this.rdb.getCostCount(month);
        data.cost[codeConfig.StatisticsGameType[key]].lastmonth = await this.rdb.getCostCount(monthOld);
        index++;
    }

    data.realtimeCount = await this.rdb.getRealTimeCount();
    next(null, {code: code.OK, data});
};
Handler.prototype.getRoomInfo = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let roomId = msg.roomId;
    let dbroomInfo = await this.rdb.getRoomInfo(roomId);
    if (dbroomInfo) {
        try {
            let creator = JSON.parse(dbroomInfo.base_info).creator;
            if (uid !== creator && agent_level < 100) {
                next(null, {code: code.FAIL, msg: '不是你的房间,没有权限'});
                return;
            }
            let data = {};
            data.roomId = dbroomInfo.id;
            data.conf = dbroomInfo.base_info;
            data.create_time = dbroomInfo.create_time;
            data.seats = [];
            let max = parseInt(JSON.parse(dbroomInfo.base_info).peoplemax, 10);
            for (let j = 0; j < max; j++) {
                const s = {};
                s.userId = parseInt(dbroomInfo[`seat_${j}`], 10) || 0;
                s.name = dbroomInfo[`seat_name_${j}`] || "";
                s.headImg = dbroomInfo[`headimg_${j}`] || "";
                s.sex = parseInt(dbroomInfo[`sex_${j}`], 10) || 0;
                s.score = dbroomInfo[`seat_score_${j}`] ? dbroomInfo[`seat_score_${j}`] : 0;
                s.ip = dbroomInfo[`seat_ip_${j}`] ? dbroomInfo[`seat_ip_${j}`] : '';
                s.address = dbroomInfo[`seat_address_${j}`] ? dbroomInfo[`seat_address_${j}`] : '';
                s.online = dbroomInfo[`seat_online_${j}`] ? parseInt(dbroomInfo[`seat_online_${j}`], 10) : 0;
                s.ready = dbroomInfo[`seat_ready_${j}`] ? parseInt(dbroomInfo[`seat_ready_${j}`], 10) : 0;
                s.seatIndex = j;
                data.seats.push(s);
            }
            next(null, {code: code.OK, data});
        } catch (e) {
            next(null, {code: code.FAIL, msg: '房间数据错误,请直接删除房间'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '房间不存在'});
    }
};
Handler.prototype.kickUserOutRoom = async function (msg, session, next) {
    let uid = session.uid;
    let self = this;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let ServerState = this.app.get('ServerStateInfo').ServerState;
    if (ServerState === 1 || ServerState === 3) {
        next(null, {code: code.MAINTAIN, msg: '服务器维护中,暂时无法踢出房间'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let roomId = msg.roomId;
    let userId = msg.userId;
    let dbroomInfo = await this.rdb.getRoomInfo(roomId);
    if (!dbroomInfo) {
        next(null, {code: code.FAIL, msg: '房间不存在'});
        return;
    }
    let creator = JSON.parse(dbroomInfo.base_info).creator;
    if (uid !== creator && agent_level < 100) {
        next(null, {code: code.FAIL, msg: '不是你的房间,没有权限'});
        return;
    }
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        let serverId = dbroomInfo.serverId;
        session.set('gameServerId', serverId);
        session.pushAll(function () {
            self.app.rpc.game.gameRemote.kickUser(session, roomId, userId, function (ret) {
                session.set('gameServerId', '');
                session.pushAll(function () {
                    if (ret === 0) {
                        next(null, {code: code.OK, data: {}, msg: '踢出成功'});
                    } else if (ret === -1) {
                        next(null, {code: code.FAIL, msg: '房间不存在'});
                    } else if (ret === -2) {
                        next(null, {code: code.FAIL, msg: '用户不存在'});
                    } else if (ret === -3) {
                        next(null, {code: code.FAIL, msg: '游戏已经开始,无法踢出'});
                    } else if (ret === -4) {
                        next(null, {code: code.FAIL, msg: '踢出失败,请重试'});
                    } else {
                        next(null, {code: code.FAIL, msg: `未知错误-${ret}`});
                    }
                });
            });
        });
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '踢出失败,请重试'});
    }
};
Handler.prototype.dissolveRoom = async function (msg, session, next) {
    let uid = session.uid;
    let self = this;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let ServerState = this.app.get('ServerStateInfo').ServerState;
    if (ServerState === 1 || ServerState === 3) {
        next(null, {code: code.MAINTAIN, msg: '服务器维护中,暂时无法解散房间'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let roomId = msg.roomId;
    let dbroomInfo = await this.rdb.getRoomInfo(roomId);
    if (!dbroomInfo) {
        next(null, {code: code.FAIL, msg: '房间不存在'});
        return;
    }
    try {
        let creator = JSON.parse(dbroomInfo.base_info).creator;
        if (uid !== creator && agent_level < 100) {
            next(null, {code: code.FAIL, msg: '不是你的房间,没有权限'});
            return;
        }
        let serverId = dbroomInfo.serverId;
        session.set('gameServerId', serverId);
        session.pushAll(function () {
            self.app.rpc.game.gameRemote.delRoom(session, roomId, true, function (ret) {
                session.set('gameServerId', '');
                session.pushAll(function () {
                    if (ret) {
                        next(null, {code: code.OK, data: {}, msg: '解散成功'});
                    } else {
                        next(null, {code: code.FAIL, msg: '解散失败'});
                    }
                });
            });
        });
    } catch (e) {
        self.app.rpc.game.gameRemote.delRoom.toServer('*', roomId, true, function (ret) {
        });
        next(null, {code: code.OK, data: {}, msg: '解散成功'});
    }
};
Handler.prototype.getUserInfo = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userId = msg.userId;
    let userInfo = await this.mdb.get_user_data_by_userid(userId);
    if (userInfo) {
        let data = {};
        data.userId = userInfo.userid;
        data.name = userInfo.name;
        data.headImg = userInfo.headimg;
        data.ownerId = userInfo.ownerid;
        data.phone = userInfo.phone || '';
        data.agent_create_time = userInfo.create_time || '';
        data.gems = userInfo.gems;
        data.agent_level = userInfo.agent_level;
        data.re_time = userInfo.re_time;
        data.roomId = userInfo.roomid_p;
        next(null, {code: code.OK, data});
    } else {
        next(null, {code: code.FAIL, msg: '用户不存在'});
    }
};
Handler.prototype.addBanUser = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userId = msg.userId;
    let user = await this.mdb.get_user_data_by_userid(userId);
    if (!user) {
        next(null, {code: code.FAIL, msg: '用户不存在不需要查封'});
        return;
    }
    let ret = await this.mdb.addBanedUser(user.userid, user.unionid);
    if (ret) {
        next(null, {code: code.OK, data: ret, msg: '查封成功'});
    } else {
        next(null, {code: code.FAIL, msg: '查封失败'});
    }
};
Handler.prototype.removeBanUser = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userId = msg.userId;
    let ret = await this.mdb.delBanedUserByUserId(userId);
    if (ret) {
        next(null, {code: code.OK, data: {}, msg: '解除查封成功'});
    } else {
        next(null, {code: code.FAIL, msg: '解除查封失败'});
    }
};
Handler.prototype.changeAgentLevel = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userId = msg.userId;
    let agent_lv = msg.agent_level;
    if (!com.isNumber(agent_lv)) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    if (agent_lv >= agent_level) {
        next(null, {code: code.FAIL, msg: `你只能设置比你小的权限(<${agent_level})`});
        return;
    }
    let user = await this.mdb.get_user_data_by_userid(userId);
    if (!user) {
        next(null, {code: code.FAIL, msg: '用户不存在'});
        return;
    }
    if (agent_level <= user.agent_level) {
        next(null, {code: code.FAIL, msg: '对方权限等于或高于你,无法设置'});
        return;
    }
    let userInfo = await this.mdb.set_user_agent_level_by_userid(userId, agent_lv);
    if (userInfo) {
        next(null, {code: code.OK, data: {agent_level: userInfo.agent_level}});
    } else {
        next(null, {code: code.FAIL, msg: '用户不存在,设置失败'});
    }
};
Handler.prototype.getPlayerReportList = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let start = msg.start;
    let step = msg.step;
    let ret = await this.mdb.getPlayerReportList(start, step);
    next(null, {code: code.OK, data: ret});
};
Handler.prototype.getAgentRequestList = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let start = msg.start;
    let step = msg.step;
    let ret = await this.mdb.get_agent_request_list(start, step);
    next(null, {code: code.OK, data: ret});
};
Handler.prototype.optAgentRequest = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userId = msg.userId;
    let agree = msg.agree === 1 ? 1 : 0;
    let requsetInfo = await this.mdb.get_agent_request_one(userId);
    if (requsetInfo) {
        let ret = await this.mdb.del_agent_request_one(userId);
        if (!ret) {
            next(null, {code: code.FAIL, msg: '操作失败-1'});
            return;
        }
    } else {
        next(null, {code: code.FAIL, msg: '操作失败,没有该用户的申请'});
        return;
    }
    if (agree !== 0) {
        let ret = await this.mdb.set_user_agent_level_by_userid(userId, agree);
        if (!ret) {
            let rollback = await this.mdb.add_agent_request_list(requsetInfo.userid,
                requsetInfo.wx_account, requsetInfo.real_name, requsetInfo.phone);
            if (!rollback) {
                logger.error(`回滚失败:${requsetInfo}`);
            }
            next(null, {code: code.FAIL, msg: '操作失败-2'});
            return;
        }
    }
    next(null, {code: code.OK, data: {}});
};
Handler.prototype.createClub = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '权限不够,无法创建'});
        return;
    }
    if (agent_level < 100) {
        let userInfo = await this.mdb.get_user_data_by_userid(uid);
        let oclubs_limit = this.app.get('clubConfigs').oclubs_limit;
        if (userInfo.myclubs.length >= oclubs_limit) {
            next(null, {code: code.CLUB.LIMIT_CLUBS, msg: '拥有圈子数量达到上限,无法创建'});
            return;
        }
        let allClubs = userInfo.myclubs.concat(userInfo.clubs);
        let clubs_limit = this.app.get('clubConfigs').clubs_limit;
        if (allClubs.length >= clubs_limit) {
            next(null, {code: code.CLUB.LIMIT_CLUBS, msg: '圈子数量达到上限,无法创建'});
            return;
        }
    }
    let ownerId = msg.ownerId || uid;
    let clubId = '';
    if (msg.clubId) {
        clubId = msg.clubId;
    } else {
        let index = 0;
        while (index < 6) {
            clubId = com.generateSixId() + '';
            let club = await this.mdb.get_club_baseInfo_by_clubid(clubId);
            if (club) {
                clubId = '';
            } else {
                break;
            }
            index++;
        }
        if (clubId == '') {
            logger.error('牌友圈创建找不到合适的ID');
            next(null, {code: code.FAIL, msg: '创建失败请重试'});
            return;
        }
    }
    let name = msg.name ? msg.name : '新牌友圈';
    let gametype = msg.gametype || 3;
    clubId = clubId.replace(/\s*/g, "");
    const reg = "^[0-9]+$";
    const patt = new RegExp(reg);
    if (!com.isNumber(ownerId) || !patt.test(clubId)) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let clubInfo = await this.mdb.get_club_baseInfo_by_clubid(clubId);
    if (clubInfo) {
        let data = {};
        data.clubId = clubInfo.clubid;
        data.ownerId = clubInfo.ownerid;
        next(null, {
            code: code.GM.CLUB_HAS_OWNER, data,
            msg: `圈子:${data.clubId}的圈主ID为:${data.ownerId}`
        });
        return;
    }
    let user = await this.mdb.get_user_data_by_userid(ownerId);
    if (!user) {
        next(null, {code: code.FAIL, msg: '创建圈子失败,用户不存在'});
        return;
    }
    clubInfo = await this.mdb.create_club(clubId, ownerId, name, gametype);
    if (clubInfo) {
        let data = {};
        data.clubId = clubInfo.clubid;
        data.ownerId = clubInfo.ownerid;
        let ret = await this.mdb.add_user_myclubs_by_userid(clubInfo.ownerid, clubInfo.clubid);
        if (ret) {
            next(null, {code: code.OK, data});
        } else {
            next(null, {code: code.FAIL, msg: '圈子创建成功,用户圈子增加失败,请联系管理员'});
        }
        self.app.rpc.club.clubRemote.addClub.toServer('*', clubInfo.clubid, clubInfo, function () {
        });

        data.name = clubInfo.name;
        data.introduce = clubInfo.introduce;
        data.notice = clubInfo.notice;
        data.create_time = clubInfo.createTime;
        data.open_time = clubInfo.open_time;
        data.close_time = clubInfo.close_time;
        data.opening = clubInfo.opening;
        data.members = clubInfo.members;
        data.tables = clubInfo.tables;
        data.request_open = clubInfo.request_open;
        this.statusService.pushByUids([ownerId],
            'clubInfoNotify', data, function (err) {
                if (err)
                    logger.error(err);
            });
    } else {
        next(null, {code: code.FAIL, msg: '创建圈子失败'});
    }
};
Handler.prototype.optClub = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let type = msg.type;
    if (type === 1) {
        let clubId = msg.clubId;
        let ownerId = msg.ownerId;
        let ownerInfo = await this.mdb.get_user_data_by_userid(ownerId);
        if (!ownerInfo) {
            next(null, {code: code.FAIL, msg: '转让用户不存在'});
            return;
        }
        let clubInfo = await this.mdb.get_club_Info_by_clubid(clubId);
        // if (ownerId === clubInfo.ownerid) {
        //     next(null, {code: code.FAIL, msg: '该用户已经是该圈子的圈主'});
        //     return;
        // }
        if (clubInfo) {
            let userInfo = await this.mdb.get_user_data_by_userid(clubInfo.ownerid);
            if (userInfo) {//&& userInfo.myclubs.indexOf(clubId) !== -1) {
                let userInfo2 = await this.mdb.del_user_myclubs_by_userid(userInfo.userid, clubId);
                if (userInfo2) {
                    let club = await this.mdb.set_club_ownerid_by_clubid(clubId, ownerId);
                    if (club) {
                        let owner = await this.mdb.add_user_myclubs_by_userid(ownerId, clubId);
                        if (owner) {
                            this.mdb.del_user_clubs_by_userid(ownerId, clubId);
                            this.mdb.del_club_members(clubId, ownerId);
                            for (let i = 0; i < club.tables.length; i++) {
                                let roomId = club.tables[i].roomid;
                                self.app.rpc.game.gameRemote.delRoom.toServer('*', roomId, false, function (ret) {
                                });
                            }
                            next(null, {code: code.OK, data: {}, msg: '操作成功'});
                            this.statusService.getSidsByUid(clubInfo.ownerid, function (err, sids) {
                                if (err) {
                                    logger.error('optClub getSidsByUid', err);
                                }
                                if (sids && sids.length > 0) {
                                    self.app.rpc.club.clubRemote.logoutClub.toServer('*',
                                        clubInfo.ownerid, clubId, function () {
                                        });
                                }
                            });
                            this.statusService.pushByUids([clubInfo.ownerid], 'clubInfoModifyNotify',
                                {
                                    type: 100,
                                    clubId: clubId,
                                    ownerId: ownerId
                                }, function (err) {

                                });
                            this.app.rpc.club.clubRemote.pushMessageByClubId.toServer('*', 'clubInfoModifyNotify',
                                clubId,
                                {
                                    type: 100,
                                    clubId: clubId,
                                    ownerId: ownerId
                                }, function () {

                                });
                            this.statusService.pushByUids([ownerId],
                                'clubInfoNotify',
                                {
                                    clubId: clubId,
                                    ownerId: ownerId
                                }, function (err) {
                                    if (err)
                                        logger.error(err);
                                });
                        } else {
                            let ret = await this.mdb.set_club_ownerid_by_clubid(clubId, userInfo2.userid);
                            if (!ret) {
                                logger.error(`set_club_ownerid_by_clubid回滚用户:${userInfo2.userid},clubid:${clubId}失败`);
                            }
                            let ret1 = await this.mdb.add_user_myclubs_by_userid(userInfo2.userid, clubId);
                            if (!ret1) {
                                logger.error(`add_user_myclubs_by_userid回滚用户:${userInfo2.userid},myclubs:${clubId}失败`);
                            }
                            next(null, {code: code.FAIL, msg: '操作失败-4'});
                        }
                    } else {
                        let tempUser = await this.mdb.add_user_myclubs_by_userid(userInfo.userid, clubId);
                        if (!tempUser) {
                            logger.error(`add_user_myclubs_by_userid回滚用户:${userInfo.userid},myclubs:${clubId}失败`);
                        }
                        next(null, {code: code.FAIL, msg: '操作失败-3'});
                    }
                } else {
                    next(null, {code: code.FAIL, msg: '操作失败-2'});
                }
            } else {
                next(null, {code: code.FAIL, msg: '操作失败-1'});
                logger.error(userInfo);
            }
        } else {
            next(null, {code: code.FAIL, msg: '圈子不存在'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '参数错误'});
    }
};
Handler.prototype.getAllClub = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    logger.debug('getAllClub msg:', msg);
    let type = msg.type || 1;
    let start = msg.start || 0;
    let step = msg.step || 20;
    let data = [];
    if (type == 1) {
        data = await this.mdb.get_clubs(start, step);
    } else if (type == 2) {
        data = await this.mdb.get_allclubs();
    }
    next(null, {code: code.OK, data});
};
Handler.prototype.getServerInfo = async function (msg, session, next) {
    next(null, {code: code.FAIL, msg: '暂未开放'});
    return;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let ret = await this.rdb.getServerInfo();
    next(null, {code: code.OK, data: ret});
};
Handler.prototype.setServerInfo = async function (msg, session, next) {
    next(null, {code: code.FAIL, msg: '暂未开放'});
    return;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let type = msg.type;
    if (type === 1) {
        let AndroidVersion = msg.AndroidVersion;
        let ret = await this.rdb.setServerInfo('AndroidVersion', AndroidVersion);
        if (ret) {
            next(null, {code: code.OK, data: {AndroidVersion}});
        } else {
            next(null, {code: code.FAIL, msg: `设置AndroidVersion:${AndroidVersion}失败`});
        }
    } else if (type === 11) {
        let MinAndroidVersion = msg.MinAndroidVersion;
        let ret = await this.rdb.setServerInfo('MinAndroidVersion', MinAndroidVersion);
        if (ret) {
            next(null, {code: code.OK, data: {MinAndroidVersion}});
        } else {
            next(null, {code: code.FAIL, msg: `设置MinAndroidVersion:${MinAndroidVersion}失败`});
        }
    } else if (type === 2) {
        let IPhoneVersion = msg.IPhoneVersion;
        let ret = await this.rdb.setServerInfo('IPhoneVersion', IPhoneVersion);
        if (ret) {
            next(null, {code: code.OK, data: {IPhoneVersion}});
        } else {
            next(null, {code: code.FAIL, msg: `设置IPhoneVersion:${IPhoneVersion}失败`});
        }
    } else if (type === 21) {
        let MinIPhoneVersion = msg.MinIPhoneVersion;
        let ret = await this.rdb.setServerInfo('MinIPhoneVersion', MinIPhoneVersion);
        if (ret) {
            next(null, {code: code.OK, data: {MinIPhoneVersion}});
        } else {
            next(null, {code: code.FAIL, msg: `设置MinIPhoneVersion:${MinIPhoneVersion}失败`});
        }
    } else if (type === 111) {
        let ServerState = msg.ServerState;
        let ret = await this.rdb.setServerInfo('ServerState', ServerState);
        if (ret) {
            next(null, {code: code.OK, data: {ServerState}});
        } else {
            next(null, {code: code.FAIL, msg: `设置ServerState:${ServerState}失败`});
        }
    }
};
Handler.prototype.getRollingNotice = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let data = await this.rdb.getRollingNotice();
    next(null, {code: code.OK, data: data});
};
Handler.prototype.setRollingNotice = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let key = msg.key;
    let info = msg.info;
    let beginTime = msg.beginTime || '';
    let endTime = msg.endTime || '';
    if (beginTime !== '') {
        let beginTimes = beginTime.split(':');
        if (beginTimes.length > 1 && !Number.isNaN(parseInt(beginTimes[0])) && !Number.isNaN(parseInt(beginTimes[1]))) {
            beginTimes[0] = parseInt(beginTimes[0]) < 0 ? '0' : parseInt(beginTimes[0]) > 23 ? 23 : parseInt(beginTimes[0]);
            beginTimes[1] = parseInt(beginTimes[1]) < 0 ? '0' : parseInt(beginTimes[1]) > 59 ? 59 : parseInt(beginTimes[1]);
            beginTime = (beginTimes[0] < 10 ? '0' + beginTimes[0] : beginTimes[0]) + ':' + (beginTimes[1] < 10 ? '0' + beginTimes[1] : beginTimes[1]);
        } else {
            beginTime = '';
        }
    }
    if (endTime !== '') {
        let endTimes = endTime.split(':');
        if (endTimes.length > 1 && !Number.isNaN(parseInt(endTimes[0])) && !Number.isNaN(parseInt(endTimes[1]))) {
            endTimes[0] = parseInt(endTimes[0]) < 0 ? '0' : parseInt(endTimes[0]) > 23 ? 23 : parseInt(endTimes[0]);
            endTimes[1] = parseInt(endTimes[1]) < 0 ? '0' : parseInt(endTimes[1]) > 59 ? 59 : parseInt(endTimes[1]);
            endTime = (endTimes[0] < 10 ? '0' + endTimes[0] : endTimes[0]) + ':' + (endTimes[1] < 10 ? '0' + endTimes[1] : endTimes[1]);
        } else {
            endTime = '';
        }
    }
    if (key && info) {
        let ret = await this.rdb.setRollingNotice(key, info, beginTime, endTime);
        if (ret) {
            let data = await this.rdb.getRollingNotice();
            next(null, {code: code.OK, data: data});
        } else {
            next(null, {code: code.FAIL, msg: '设置失败'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '参数错误'});
    }
};
Handler.prototype.delRollingNotice = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let key = msg.key;
    if (key) {
        let ret = await this.rdb.delRollingNotice(key);
        if (ret) {
            let data = await this.rdb.getRollingNotice();
            next(null, {code: code.OK, data: data});
        } else {
            next(null, {code: code.FAIL, msg: '删除失败'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '参数错误'});
    }
};
Handler.prototype.getEclub = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let eclubs = await this.rdb.getAllExperienceClub();
    next(null, {code: code.OK, data: {eclubs}});
};
Handler.prototype.addEclub = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let clubId = msg.clubId;
    let priority = msg.priority ? msg.priority : 0;
    let clubInfo = await this.mdb.set_club_experience_by_clubid(clubId, 0, 0);
    if (clubInfo) {
        let ret = await this.rdb.addExperienceClub(clubId, priority);
        if (ret) {
            let eclubs = await this.rdb.getAllExperienceClub();
            next(null, {code: code.OK, data: {eclubs}, msg: '添加体验俱乐部成功'});
            this.app.rpc.club.clubRemote.pushMessageByClubId.toServer('*', 'clubInfoModifyNotify',
                clubInfo.clubid,
                {
                    type: 101,
                    clubtype: 0
                }, function () {
                });
            this.app.rpc.club.clubRemote.pushMessageByClubId.toServer('*', 'clubInfoModifyNotify',
                clubInfo.clubid,
                {
                    type: 6,
                    request_open: 0
                }, function () {
                });
        } else {
            next(null, {code: code.FAIL, msg: '体验俱乐部添加失败,请重试-2'});
        }
    } else {
        next(null, {code: code.OK, msg: '体验俱乐部添加失败,俱乐部可能不存在-1'});
    }
};
Handler.prototype.delEclub = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let clubInfo = await this.mdb.set_club_experience_by_clubid(clubId, 1, 1);
    if (clubInfo) {
        let ret = await this.rdb.delExperienceClub(clubId);
        if (ret) {
            let eclubs = await this.rdb.getAllExperienceClub();
            next(null, {code: code.OK, data: {eclubs}});
            this.app.rpc.club.clubRemote.pushMessageByClubId.toServer('*', 'clubInfoModifyNotify',
                clubInfo.clubid,
                {
                    type: 101,
                    clubtype: 1
                }, function () {
                });
            this.app.rpc.club.clubRemote.pushMessageByClubId.toServer('*', 'clubInfoModifyNotify',
                clubInfo.clubid,
                {
                    type: 6,
                    request_open: 1
                }, function () {
                });
        } else {
            next(null, {code: code.FAIL, msg: '体验俱乐部删除失败,请重试-2'});
        }
    } else {
        next(null, {code: code.OK, msg: '体验俱乐部删除失败,俱乐部可能不存在-1'});
    }
};
Handler.prototype.getUserTaskStateList = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let tasks = await this.mdb.get_tasks_by_condition({phone: {$ne: ''}});
    next(null, {code: code.OK, data: {tasks}});
};

Handler.prototype.optUserTaskState = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userId = msg.userId;
    let state = msg.state || 0;
    let ret = await this.mdb.set_tasks_state_by_userid(userId, state);
    if (ret) {
        next(null, {code: code.OK, data: ret});
    } else {
        next(null, {code: code.FAIL, msg: '状态更改失败'});
    }
};

Handler.prototype.addExperienceAgentList = async function (msg, session, next) {
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userId = msg.userId;
    let ret = await this.rdb.addExperienceAgentList(userId);
    if (ret) {
        next(null, {code: code.OK, data: {userId}});
    } else {
        next(null, {code: code.FAIL, msg: '添加失败'});
    }
};
Handler.prototype.getExperienceAgentList = async function (msg, session, next) {
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let ret = await this.rdb.getExperienceAgentList();
    if (ret) {
        next(null, {code: code.OK, data: ret});
    } else {
        next(null, {code: code.FAIL, msg: '获取失败'});
    }
};
Handler.prototype.remExperienceAgentList = async function (msg, session, next) {
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let userId = msg.userId;
    let ret = await this.rdb.remExperienceAgentList(userId);
    if (ret) {
        next(null, {code: code.OK, data: {userId}});
    } else {
        next(null, {code: code.FAIL, msg: '删除失败'});
    }
};
Handler.prototype.getNewAgent = async function (msg, session, next) {
    let agent_level = session.get('agent_level');
    if (agent_level < 100) {
        next(null, {code: code.FAIL, msg: '没有权限'});
        return;
    }
    let date = msg.date;
    let start = msg.start || 0;
    let end = msg.step ? start + msg.step : -1;
    let list = await this.rdb.getnewAgent(date, start, end);
    if (list) {
        next(null, {code: code.OK, data: {list}});
    } else {
        next(null, {code: code.FAIL, msg: '获取失败'});
    }
};
Handler.prototype.dissolveHallGameRoom = async function (msg, session, next) {
    let self = this;
    let hallGamehallId = msg.hallGamehallId;
    let roomId = msg.roomId;
    const hallGameServers = self.app.getServersByType('hallgame');
    let hasServer = false;
    for (let i = 0; i < hallGameServers.length; i++) {
        let server = hallGameServers[i];
        if (server.id == hallGamehallId) {
            hasServer = true;
            break;
        }
    }
    if (!hasServer) {
        next(null, {code: code.FAIL, msg: '没有该游戏大厅'});
        return;
    }
    session.set('hallGamehallId', hallGamehallId);
    session.pushAll(function () {
        self.app.rpc.hallgame.gameRemote.delHallGameRoom(session, roomId, function (ret) {
            session.set('hallGamehallId', '');
            session.pushAll(function () {
                if (ret) {
                    next(null, {code: code.OK, data: {}, msg: '解散成功'});
                } else {
                    next(null, {code: code.FAIL, msg: '解散出现错误'});
                }
            });
        });
    });
};