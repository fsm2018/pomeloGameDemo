const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const codeConfig = require('../../../../../shared/codeConfig');
const hall = require('../../../domain/hall/hall');
const config = require('../../../../../shared/config/config');
const com = require('../../../util/com');
const smsMgr = require('../../../util/smsMgr');
const httpUtil = require('../../../util/httpUtil');

const code = codeConfig.retCode;
const xlappId = '';
const xlappSecret = '';

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.channelUtil = app.get('channelUtil');
    this.channelService = app.get('channelService');
};
Handler.prototype.getUsersInfo = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let userIds = msg.userIds;
    if (!Array.isArray(userIds)) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let Infos = await this.mdb.get_users_baseInfo_by_userids(userIds);
    if (Infos) {
        let data = {};
        for (let i = 0; i < Infos.length; i++) {
            let info = Infos[i];
            data[info.userid] = {};
            data[info.userid].name = info.name;
            data[info.userid].sex = info.sex;
            data[info.userid].headImg = info.headimg;
            data[info.userid].gems = info.gems;
            data[info.userid].re_time = info.re_time;
            data[info.userid].agentLevel = info.agent_level;
            data[info.userid].sign = info.sign;
            let offline_time = info.offline_time;
            if (offline_time) {
                if (info.re_time >= offline_time) {
                    data[info.userid].onlineState = 1;
                } else {
                    data[info.userid].onlineState = 0;
                }
            } else {
                data[info.userid].onlineState = -1;
            }
        }
        next(null, {code: code.OK, data: data});
    } else {
        next(null, {code: code.FAIL, msg: '查询失败'});
    }
};
Handler.prototype.modifyUserInfo = async function (msg, session, next) {
    let uid = session.uid;
    let agent_level = session.get('agent_level');
    if (agent_level < 2) {
        next(null, {code: code.FAIL, msg: '不是代理不能设置个人签名'});
        return;
    }
    let type = msg.type;
    if (type == 1) {
        let sign = msg.sign || '';
        let ret = await this.mdb.set_user_sign_by_userid(uid, sign);
        if (ret) {
            next(null, {code: code.OK, data: {type, sign: ret.sign}});
        } else {
            next(null, {code: code.FAIL, msg: '设置签名失败'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '参数错误'});
    }
};
Handler.prototype.bindxl = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let xlcode = msg.code;
    if (!xlcode) {
        next(null, {code: code.FAIL, msg: '没有闲聊信息'});
        return;
    }
    let check = await hall.checkXlbind(uid);
    if (typeof (check) === 'boolean') {
        if (!check) {
            next(null, {code: code.FAIL, msg: '获取用户信息失败'});
            return;
        }
    } else {
        if (check === code.HALL.XL_BIND_HAD) {
            next(null, {code: code.FAIL, msg: '你已经绑定过闲聊了'});
            return;
        }
    }

    var xl_openid_pomelo;
    let data;
    data = await hall.getXlToken(xlcode, xlappId, xlappSecret);
    if (data) {
        let token = data.access_token;
        let data2 = await hall.getXlInfo(token);
        if (data2) {
            xl_openid_pomelo = data2.xl_openid_pomelo;
            let user = await this.mdb.get_user_data_by_xl_openid_pomelo(xl_openid_pomelo);
            if (user) {
                next(null, {code: code.FAIL, msg: '该闲聊号已经绑定过用户了'});
                return;
            }
            let ret = await hall.setXLOpenID(session.uid, xl_openid_pomelo);
            if (ret) {
                next(null, {
                    code: code.OK, data: {
                        xlOpenId: xl_openid_pomelo
                    }
                });
            } else {
                next(null, {code: code.FAIL, msg: '绑定失败'})
            }
        } else {
            next(null, {code: code.FAIL, msg: '获取闲聊信息失败-2'})
        }
    } else {
        next(null, {code: code.FAIL, msg: '获取闲聊信息失败-1'})
    }
};

Handler.prototype.create_private_room = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let ServerState = this.app.get('ServerStateInfo').ServerState;
    if (ServerState === 1 || ServerState === 3) {
        next(null, {code: code.MAINTAIN, msg: '服务器维护中,暂时无法创建房间'});
        return;
    }
    let gametype = msg.gametype;
    let gamenums = msg.gamenums;
    let peoplemax = msg.peoplemax;
    let createtype = msg.createtype;
    let wanfa = msg.wanfa || -1;
    let clubId = msg.clubId || "";
    let raise = msg.raise || 1;
    let gameConfigs = this.app.get('gameConfigs');
    if (!gameConfigs) {
        next(null, {code: code.FAIL, msg: '创建房间失败_json'});
        return;
    }
    if (!gameConfigs.hasOwnProperty(gametype)) {
        next(null, {code: code.FAIL, msg: '没有该游戏'});
        return;
    }
    let eachcost = gameConfigs[gametype].eachcost;
    if (!com.isNumber(eachcost)) eachcost = 1;
    let roomtype = codeConfig.roomType.normal;
    let conf = {
        gametype: gametype,
        creator: uid,
        gamenums: gamenums,
        peoplemax: peoplemax,
        createtype: createtype,
        wanfa: wanfa,
        clubId: clubId,
        eachcost: eachcost,
        roomtype: roomtype,
        raise: raise,
    };
    if (gametype == null || gamenums == null || peoplemax == null || createtype == null || wanfa === -1) {
        next(null, {code: code.FAIL, msg: '协议错误'});
        return;
    }
    let user = await this.mdb.get_user_data_by_userid(uid);
    if (user.gems <= 0) {
        if (gameConfigs[gametype].eachcost > 0) {
            next(null, {code: code.FAIL, msg: '房卡不足'});
            return;
        }
    }
    if (createtype === codeConfig.createRoomType.normal) {

    } else if (createtype === codeConfig.createRoomType.empty) {
        if (user.agent_level < 2) {
            next(null, {code: code.FAIL, msg: '不是代理不能创建空房间'});
            return;
        }
        if (user.gems < 20) {
            next(null, {code: code.FAIL, msg: '少于20张房卡不能开空房间'});
            return;
        }
        const emptyRooms = await this.rdb.getEmptyRooms(uid);
        if (emptyRooms && (Object.keys(emptyRooms).length >= user.gems || Object.keys(emptyRooms).length >= 20)) {
            // 可以开的空房间已经超出上限
            next(null, {code: code.FAIL, msg: '可以开的空房间已经达到上限'});
            return;
        }
    } else if (createtype === codeConfig.createRoomType.club) {
        if (user.myclubs.indexOf(clubId) === -1) {
            next(null, {code: code.FAIL, msg: '你不是圈主不能开房间'});
            return;
        }
    } else {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    // 验证玩家状态
    const roomId = user.roomid_p;
    if (!roomId) {
        if (createtype === codeConfig.createRoomType.club) {
            let eclubs = await this.rdb.getAllExperienceClub();
            if (eclubs) {
                eclubs = Object.keys(eclubs);
                if (eclubs.indexOf(clubId) !== -1) {
                    conf.eachcost = 0;
                    conf.roomtype = codeConfig.roomType.experience;
                }
            }
        }
        let roomid = await hall.createRoom(conf);
        if (roomid) {
            if (createtype === codeConfig.createRoomType.normal) {
                let ret = await hall.enterRoom(uid, roomid, user.name, user.headimg, user.sex);
                logger.debug(`roomid:${roomid} create normal `, ret);
                if (ret === 1 || ret === false) {
                    next(null, {code: code.FAIL, data: {roomId: roomid}, msg: `房间创建成功(${roomid}),进房失败`});
                } else {
                    session.set('gameServerId', ret.serverId);
                    session.set('roomId', ret.roomId);
                    session.pushAll(function () {
                        next(null, {code: code.OK, data: {roomId: roomid}});
                    });
                }
                return;
            } else if (createtype === codeConfig.createRoomType.empty) {
                const addRet = await hall.addEmptyRoom(uid, roomid, conf);
                if (!addRet) {
                    logger.error('添加空房间失败');
                    let ret = hall.delRoom(uid, roomid);
                    if (!ret)
                        logger.error(uid, '删除房间失败', roomid);
                    next(null, {code: code.FAIL, msg: '添加空房间失败' + roomid});
                    return;
                }
                next(null, {code: code.OK, data: {}, msg: '创建空房间成功'});
                return;
            } else if (createtype === codeConfig.createRoomType.club) {
                let conf = {};
                conf.raise = raise;
                conf.gamenums = gamenums;
                let clubInfo = await this.mdb.add_club_tables(clubId, roomid, wanfa, conf);
                if (!clubInfo) {
                    hall.delRoom(uid, roomid);
                    next(null, {code: code.FAIL, msg: '创建房间失败'});
                    return;
                }
                let suc = false;
                clubInfo.tables.forEach(item => {
                    if (item.roomid === roomid) {
                        suc = true;
                    }
                });
                if (suc) {
                    next(null, {code: code.OK, data: {}, msg: '创建成功'});
                    this.app.rpc.club.clubRemote.tableClubNotify.toServer('*', {
                        clubId: clubInfo.clubid,
                        roomId: roomid,
                        type: wanfa,
                        conf: JSON.stringify(conf)
                    }, function () {
                    });
                } else {
                    hall.delRoom(uid, roomid);
                    next(null, {code: code.FAIL, msg: '创建房间失败'});
                }
                return;
            }
            hall.delRoom(uid, roomid);
            next(null, {code: code.FAIL, msg: '参数错误,创建房间失败'});
        } else {
            next(null, {code: code.FAIL, msg: '创建房间失败'});
        }
    } else {
        next(null, {code: code.HALL.HAD_IN_ROOM, msg: '你已经在房间了,房间号为:' + roomId});
    }
};
Handler.prototype.get_empty_rooms = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let emptys = await this.rdb.getEmptyRooms(uid);
    next(null, {code: code.OK, data: {emptys}});
};

Handler.prototype.del_private_room = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let ServerState = this.app.get('ServerStateInfo').ServerState;
    if (ServerState === 1 || ServerState === 3) {
        next(null, {code: code.MAINTAIN, msg: '服务器维护中,暂时无法删除房间'});
        return;
    }
    let roomId = msg.roomId;

    let ret = await hall.delRoom(uid, roomId);
    if (!ret || !ret.ret) {
        logger.error(uid, '删除房间失败', roomId);
        next(null, {code: code.FAIL, msg: '删除房间失败'});
        return;
    }
    let roomInfo = ret.roomInfo;
    let serverId = roomInfo.serverId;
    session.set('gameServerId', serverId);
    session.pushAll(async function () {
        let createtype = JSON.parse(roomInfo.base_info).createtype;
        if (createtype === codeConfig.createRoomType.empty) {
            let ret = await hall.delEmtyRoom(uid, roomId);
            logger.debug('del_private_room delEmtyRoom', ret);
        }
        self.app.rpc.game.gameRemote.delRoom(session, roomId, false, async function (ret) {
            session.set('gameServerId', '');
            session.pushAll(async function () {
            });
            if (createtype === codeConfig.createRoomType.club) {
                let clubId = JSON.parse(roomInfo.base_info).clubId;
                let ret = await self.mdb.del_club_tables_by_roomid(clubId, roomInfo.id);
                // logger.debug('del_private_room club', ret);
                self.app.rpc.club.clubRemote.tableDissolveClubNotify.toServer('*', {
                    clubId,
                    roomId
                }, function () {

                });
            }
        });
    });
    next(null, {code: code.OK, data: {}});
};

Handler.prototype.enter_private_room = async function (msg, session, next) {
    let self = this;
    let roomId = msg.roomId;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let ServerState = this.app.get('ServerStateInfo').ServerState;
    if (ServerState === 1 || ServerState === 3) {
        next(null, {code: code.MAINTAIN, msg: '服务器维护中,暂时无法加入房间'});
        return;
    }
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        let user = await self.mdb.get_user_data_by_userid(uid);
        if (user.roomid_p && user.roomid_p !== roomId) {
            next(null, {code: code.HALL.HAD_IN_ROOM, msg: '你已经在房间了,房间号为:' + user.roomid_p});
            return;
        }
        let ret = await hall.enterRoom(uid, roomId, user.name, user.headimg, user.sex);
        if (ret) {
            if (ret === code.HALL.ENTER_ROOM_FULL) {
                next(null, {code: code.HALL.ENTER_ROOM_FULL, msg: '房间已满'});
            } else if (ret === code.HALL.ENTER_ROOM_FAIL) {
                next(null, {code: code.HALL.ENTER_ROOM_FAIL, msg: '进房失败，请重试'});
            } else if (ret === code.HALL.ENTER_CLUB_ROOM_NOT_MEMBER) {
                next(null, {code: code.HALL.ENTER_CLUB_ROOM_NOT_MEMBER, msg: '进房失败，不是圈子成员'});
            } else if (ret === code.HALL.ENTER_CLUB_ROOM_CLOSEING) {
                next(null, {code: code.HALL.ENTER_CLUB_ROOM_CLOSEING, msg: '进房失败，圈子暂停营业'});
            } else {
                session.set('gameServerId', ret.serverId);
                session.pushAll(function () {
                    next(null, {code: code.OK, data: {roomId: ret.roomId}});
                });
            }
        } else {
            next(null, {code: code.FAIL, msg: '房间不存在'});
        }
    });
    if (!lockret) {
        next(null, {code: code.HALL.ENTER_ROOM_FAIL, msg: '进房失败，请重试'});
    }
};

Handler.prototype.getHistory = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let type = msg.type;
    if (!type) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let start = com.isNumber(msg.start) ? msg.start : 0;
    let step = com.isNumber(msg.step) ? msg.step : 20;
    let end = start + step;
    let hislist = await this.rdb.getHistory(uid, type, start, end);
    next(null, {code: code.OK, data: {hislist}});
};
Handler.prototype.getRecord = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let uuid = msg.uuid;
    let index = msg.index;
    let record;
    if (com.isNumber(index)) {
        record = await this.rdb.getGameByIndex(uuid, index);
    } else {
        record = await this.rdb.getGames(uuid);
    }
    this.mdb.set_game_id_of_user(uid, null);
    next(null, {code: code.OK, data: {record}});
};

Handler.prototype.getBigWinerRank = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let type = msg.type;
    if (!type) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let start = com.isNumber(msg.start) ? msg.start : 0;
    let step = com.isNumber(msg.step) ? msg.step : 20;
    let end = start + step;

    let rank = await this.rdb.getBigWinerBoard(type);
    next(null, {code: code.OK, data: {rank}});
};

Handler.prototype.suggest = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let content = msg.content;
    let phone = msg.phone;
    content = content.replace(/\s*/g, "");
    if (content == '') {
        next(null, {code: code.FAIL, msg: '请输入内容'});
        return;
    }
    const reg = "^[0-9]+$";
    const patt = new RegExp(reg);
    if (!patt.test(phone) || phone.length < 11) {
        next(null, {code: code.FAIL, msg: '请输入正确的手机号'});
        return;
    }
    let ret = await this.mdb.addPlayerReports(uid, phone, content);
    if (ret) {
        next(null, {code: code.OK, data: {}});
    } else {
        next(null, {code: code.FAIL, msg: '反馈失败,请稍后再试'});
    }
};
Handler.prototype.getVerifyCode = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let phone = msg.phone;
    const reg = "^[0-9]+$";
    const patt = new RegExp(reg);
    if (!patt.test(phone) || phone.length < 11) {
        next(null, {code: code.FAIL, msg: '请输入正确的手机号'});
        return;
    }
    let ret = await smsMgr.sendCheckPhoneMSG(phone);
    if (ret) {
        next(null, {code: code.OK, data: {}, msg: '发送成功'});
    } else {
        next(null, {code: code.FAIL, msg: '发送失败'});
    }
};
Handler.prototype.certify = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let type = msg.type;
    let phone = msg.phone;
    let vcode = msg.code;
    let ret = await smsMgr.verity(phone, vcode);
    if (ret === 0) {
        if (type === 1) {
            let user = await this.mdb.get_user_data_by_userid(uid);
            if (user.phone && user.phone.length > 0) {
                next(null, {code: code.FAIL, msg: '已经认证过了,不需要再次认证'});
                return;
            }
            user.phone = phone;
            user.save();
            if (user.ownerid) {
                this.mdb.addGems_by_userid(user.ownerid, 2);
            }
            next(null, {code: code.OK, data: {phone}, msg: '认证成功'});
        } else if (type === 2) {
            let ret = await this.mdb.set_tasks_phone_by_userid(uid, phone);
            if (ret) {
                next(null, {code: code.OK, data: {phone}, msg: '手机号确认成功'});
            } else {
                next(null, {code: code.FAIL, msg: '手机号确认失败'});
            }
        } else {
            next(null, {code: code.FAIL, msg: '参数错误'});
        }
    } else if (ret === 1) {
        next(null, {code: code.FAIL, msg: '认证失败,验证码过期'});
    } else if (ret === 2) {
        next(null, {code: code.FAIL, msg: '认证失败,验证码错误'});
    } else {
        next(null, {code: code.FAIL, msg: '认证失败,手机号错误'});
    }
};
Handler.prototype.getRollingNotice = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let ret = await this.rdb.getRollingNotice();
    let now = new Date();
    let nhours = now.getHours();
    let nminutes = now.getMinutes();
    let nowString = (nhours < 10 ? '0' + nhours : nhours) + ':' + (nminutes < 10 ? '0' + nminutes : nminutes);
    let data = {};
    if (ret) {
        for (let k in ret) {
            if (ret.hasOwnProperty(k)) {
                let Ritem = JSON.parse(ret[k]);
                if (Ritem.beginTime === '' || Ritem.endTime === '') {
                    data[k] = Ritem.info;
                } else {
                    if (nowString >= Ritem.beginTime && nowString < Ritem.endTime) {
                        data[k] = Ritem.info;
                    }
                }
            }
        }
    }
    next(null, {code: code.OK, data: data});
};
Handler.prototype.bindOwner = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let onwerId = msg.onwerId;
    let onwerInfo = await this.mdb.get_user_data_by_userid(ownerId);
    if (onwerInfo) {
        let userInfo = await this.mdb.set_user_ownerid_by_userid(uid, ownerId);
        if (userInfo) {
            if (userInfo.ownerid === onwerId) {
                next(null, {code: code.OK, data: {ownerId: userInfo.ownerid}});
            } else {
                next(null, {code: code.FAIL, msg: `绑定失败-${userInfo.ownerid}`});
            }
        } else {
            next(null, {code: code.FAIL, msg: '绑定失败'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '用户不存在,无法绑定'});
    }
};

Handler.prototype.payResult = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let type = msg.type;
    if (type === 1) {
        let receiptString = msg.receipt;
        const verifyReceipt_IAP = async function (url) {
            return await httpUtil.verifyReceipt_IAP(url, null, '/verifyReceipt', {'receipt-data': receiptString}, true)
                .then(ret => ret).catch(() => false);
        };
        let url = "buy.itunes.apple.com";
        let ret = await verifyReceipt_IAP(url);
        if (ret && ret.status === 0) {
            let rt;
            if (ret.receipt.in_app.length > 0) {
                switch (ret.receipt.in_app[0].product_id) {
                    case 'p_card_01':
                        rt = await this.mdb.addGems_by_userid(uid, 5);
                        break;
                    case 'p_card_02':
                        rt = await this.mdb.addGems_by_userid(uid, 10);
                        break;
                    case 'p_card_03':
                        rt = await this.mdb.addGems_by_userid(uid, 20);
                        break;
                }
            }
            if (rt) {
                next(null, {code: code.OK, data: {}, msg: '充值成功'});
            } else {
                next(null, {code: code.FAIL, msg: '支付成功,充值失败'});
            }
        } else if (ret && ret.status === 21007) {
            url = "sandbox.itunes.apple.com";
            let ret = await verifyReceipt_IAP(url);
            if (ret.status === 0) {
                let rt;
                if (ret.receipt.in_app.length > 0) {
                    switch (ret.receipt.in_app[0].product_id) {
                        case 'p_card_01':
                            rt = await this.mdb.addGems_by_userid(uid, 5);
                            break;
                        case 'p_card_02':
                            rt = await this.mdb.addGems_by_userid(uid, 10);
                            break;
                        case 'p_card_03':
                            rt = await this.mdb.addGems_by_userid(uid, 20);
                            break;
                    }
                }
                if (rt) {
                    next(null, {code: code.OK, data: {}, msg: '充值成功'});
                } else {
                    next(null, {code: code.FAIL, msg: '支付成功,充值失败'});
                }
            } else {
                next(null, {code: code.FAIL, msg: '充值验证失败'});
            }

        } else {
            next(null, {code: code.FAIL, msg: '充值验证失败'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '参数错误'});
    }
};

//--------------------------hallgame start----------------------------
Handler.prototype.getHallGameConfigs = function (msg, session, next) {
    let hallGameConfigs = this.app.get('hallGameConfigs');
    next(null, {code: code.OK, data: {hallGameConfigs}});
};
Handler.prototype.enterHallGameHall = async function (msg, session, next) {
    let uid = session.uid;
    let hallGamehallId = msg.hallGamehallId;
    let ret = await this.mdb.set_user_hallGamehallId_by_userid(uid, hallGamehallId);
    if (ret) {
        next(null, {code: code.OK, data: {hallGamehallId}});
    } else {
        next(null, {code: code.FAIL, msg: '请重试'});
    }
};
Handler.prototype.getHallGameCountAll = async function (msg, session, next) {
    let hallGamehallId = msg.hallGamehallId;
    let date = msg.date;
    let list = await this.rdb.getHallGameCountAll(hallGamehallId, date);
    next(null, {code: code.OK, data: {list}});
};
Handler.prototype.getHallGameWinerCountAll = async function (msg, session, next) {
    let hallGamehallId = msg.hallGamehallId;
    let date = msg.date;
    let list = await this.rdb.getHallGameWinerCountAll(hallGamehallId, date);
    next(null, {code: code.OK, data: {list}});
};
//--------------------------hallgame end----------------------------

//--------------------------mail start-----------------------------
Handler.prototype.getMails = async function (msg, session, next) {
    let uid = session.uid;
    let mails = await this.mdb.get_mails_by_userId(uid);
    next(null, {code: code.OK, data: {mails}});
};
Handler.prototype.readMail = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    let id = msg.id;
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.mail + uid, async function () {
        let mail = await self.mdb.get_mail_by_id(id);
        if (mail.to != uid) {
            next(null, {code: code.FAIL, msg: '不是你的邮件无法操作'});
            return;
        }
        if (mail.state && mail.accessory.gems > 0) {
            next(null, {code: code.FAIL, msg: '你已经领取过了'});
            return;
        }
        mail = await self.mdb.set_mail_state_by_id(id, 1);
        if (mail) {
            if (mail.accessory.gems > 0) {
                if (mail.type == codeConfig.mailtype.hallgame_hzmj3201_reward) {
                    let gems_before = await self.mdb.get_gems_by_userid(mail.to);
                    let reward_after = await self.mdb.addGems_by_userid(mail.to, mail.accessory.gems);
                    if (reward_after) {
                        self.rdb.addHallGameWinerReward(mail.to, gems_before, reward_after.gems);
                        next(null, {code: code.OK, data: {}, msg: '领取成功'});
                        return;
                    } else {
                        logger.error(`邮件 领取奖励失败 uid : ${mail.to} , reward: ${mail.accessory.gems}`);
                        let mail2 = await self.mdb.set_mail_state_by_id(id, 0);
                        if (!mail2) {
                            logger.error(`邮件 回滚 ${id} 失败`);
                        }
                        next(null, {code: code.FAIL, msg: '领取失败,请重试'});
                        return;
                    }
                }
            }
            next(null, {code: code.OK, data: {}});
        } else {
            next(null, {code: code.FAIL, msg: '邮件读取失败,请重试'});
        }
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '邮件读取失败,请重试'});
    }
};
Handler.prototype.delMail = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    let id = msg.id;
    let ret = await self.mdb.del_mail_by_useIdAndid(uid, id);
    if (ret) {
        next(null, {code: code.OK, data: {}});
    } else {
        next(null, {code: code.FAIL, msg: '请重试'});
    }
};
//--------------------------mail end-------------------------------