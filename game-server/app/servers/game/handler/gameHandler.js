const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const codeConfig = require('../../../../../shared/codeConfig');
const com = require('../../../util/com');


const code = codeConfig.retCode;


module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
    this.channelService = app.get('channelService');
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.channelUtil = app.get('channelUtil');
    this.roommgr = app.roomMgr;
    this.gamemgr = app.gameMgr;
};

Handler.prototype.enter_game = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let user = await this.mdb.get_user_data_by_userid(uid);
    let roomId = user.roomid_p;
    if (roomId) {
        let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
            let newUser = await self.roommgr.getRoomSeatByUserId(uid) === null;
            let ret = await self.roommgr.enterRoom(roomId, uid, user.name);
            if (ret === 2) {
                logger.error(`${roomId}房间不存在,uid:${uid}`);
                self.mdb.set_room_id_of_user(uid, null);
                next(null, {code: code.FAIL, msg: `${roomId}房间不存在`});
            } else if (ret === 1) {
                logger.error('房间已满:', roomId);
                self.mdb.set_room_id_of_user(uid, null);
                next(null, {code: code.FAIL, msg: '房间已满'});
            } else {
                let fsid = session.frontendId;
                // logger.debug(uid, '加入游戏', roomId);
                let ip = session.get('ip');
                await self.roommgr.updateRoomInfo(roomId, uid, user.name, user.headimg, user.sex, fsid, ip);
                await self.roommgr.setUserOnline(uid, 1);
                let roomInfo = self.roommgr.getRoom(roomId);
                let game = await self.gamemgr.checkAndCreateGame(roomInfo);
                if (!game) {
                    next(null, {code: code.FAIL, msg: '游戏房间构建失败'});
                    return;
                }
                game.updateSeatData_fsid(uid, fsid);
                let channel = self.channelService.getChannel(self.channelUtil.getRoomChannelName(roomId), true);
                self.channelUtil.addmember(channel, uid, fsid);
                self.app.rpc.chat.chatRemote.addRoom(session, uid, fsid, roomId, function () {
                });
                session.set('roomId', roomId);
                session.pushAll(function () {
                    let clidt = {
                        roomId: roomInfo.id,
                        numOfGames: roomInfo.numOfGames,
                        conf: roomInfo.conf,
                        seats: roomInfo.seats
                    };
                    self.channelService.pushMessageByUids('enterGame',
                        clidt, [{uid, sid: fsid}], function (err) {
                            if (err)
                                logger.error('enterGame:', err);
                        });

                    let otherSeats = [];
                    let userSeat = {};
                    for (let i = 0; i < roomInfo.seats.length; i++) {
                        let seat = roomInfo.seats[i];
                        if (seat.userId !== uid && seat.userId > 0 && seat.fsid !== -1) {
                            otherSeats.push({uid: seat.userId, sid: seat.fsid});
                        }
                        if (seat.userId === uid) {
                            userSeat = seat;
                        }
                    }
                    if (newUser) {
                        if (otherSeats.length > 0) {
                            self.channelService.pushMessageByUids('enterUser',
                                userSeat, otherSeats, function (err) {
                                    if (err)
                                        logger.error('enterUser:', err);
                                });
                        }
                        let clubId = roomInfo.conf.clubId;
                        if (clubId !== '') {
                            self.app.rpc.club.clubRemote.tableEnterClubNotify.toServer('*', {
                                roomId,
                                clubId,
                                seat: userSeat
                            }, function () {

                            });
                        }
                    } else {
                        if (otherSeats.length > 0) {
                            self.channelService.pushMessageByUids('onlineState',
                                {userId: uid, online: 1, roomId}, otherSeats, function (err) {
                                    if (err)
                                        logger.error('onlineState:', err);
                                });
                        }
                        let clubId = roomInfo.conf.clubId;
                        if (clubId !== '') {
                            self.app.rpc.club.clubRemote.onlineState.toServer('*', {
                                userId: uid,
                                online: 1,
                                clubId,
                                roomId
                            }, function () {
                            });
                        }
                    }
                    if (game.game.isPlaying) {
                        game.sync(uid);
                    }
                    game.dissolveSync(uid);
                    next(null, {code: code.OK, data: {}});
                });
            }
        });
        if (!lockret) {
            next(null, {code: code.FAIL, msg: '进入房间失败,请重试'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '你不在房间'});
    }
};
Handler.prototype.changeSeat = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!session.game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    let roomId = session.get('roomId');
    if (!roomId) {
        next(null, {code: code.FAIL, msg: '你不在房间'});
        return;
    }
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        let hopeIndex = msg.hopeIndex;
        let RoomInfo = self.roommgr.getRoom(roomId);
        if (RoomInfo.numOfGames > 0) {
            next(null, {code: code.FAIL, msg: '游戏中,不能交换'});
            return;
        }
        if (!RoomInfo || hopeIndex >= RoomInfo.seats.length) {
            next(null, {code: code.FAIL, msg: '参数错误'});
            return;
        }
        let oldIndex = self.roommgr.getUserSeatIndex(uid);
        if (oldIndex === hopeIndex) {
            next(null, {code: code.FAIL, msg: '在该位置,不需要换位置'});
            return;
        }
        let hopeSeat = self.roommgr.getRoomSeatByIndex(roomId, hopeIndex);
        if (hopeSeat !== null) {
            if (hopeSeat.ready) {
                next(null, {code: code.FAIL, msg: '对方已经准备'});
                return;
            }
            let mSeat = self.roommgr.getRoomSeatByUserId(uid);
            if (!mSeat) {
                next(null, {code: code.FAIL, msg: '获取座位信息失败'});
                return;
            }
            if (mSeat.ready) {
                next(null, {code: code.FAIL, msg: '请先取消准备'});
                return;
            }
            if (hopeSeat.userId === 0) {
                //如果有换位置请求则先取消掉
                let Exchange = RoomInfo.exchanges[uid];
                if (Exchange) {
                    let other = 0;
                    for (let userId in Exchange) {
                        if (Exchange.hasOwnProperty(userId)) {
                            let temp = parseInt(userId);
                            if (temp !== uid) {
                                other = temp;
                            }
                        }
                    }
                    let otherSeat = self.roommgr.getRoomSeatByUserId(other);
                    if (otherSeat) {
                        let data = {};
                        data.seats = [];
                        data.seats.push({userId: uid, agree: 0});
                        data.seats.push({userId: other, agree: Exchange[other]});
                        self.channelService.pushMessageByUids('gameExchangeSeat', data,
                            [{uid: uid, sid: session.frontendId},
                                {uid: otherSeat.userId, sid: otherSeat.fsid}], function (err) {
                                if (err)
                                    logger.error('gameExchangeSeat:', err);
                            });
                        delete RoomInfo.exchanges[uid];
                        delete RoomInfo.exchanges[other];
                    }
                }

                self.roommgr.setRoomSeatByIndex(roomId, hopeIndex, mSeat);
                self.roommgr.setRoomSeatByIndex(roomId, oldIndex, hopeSeat);
                await self.rdb.updateRoomInfoSeats(roomId, RoomInfo.seats);
                let clubId = RoomInfo.conf.clubId;
                let data = {
                    seats: [
                        {index: oldIndex, userId: hopeSeat.userId},
                        {index: hopeIndex, userId: mSeat.userId}
                    ],
                    roomId: roomId,
                    clubId: clubId
                };
                let channel = self.channelService.getChannel(self.channelUtil.getRoomChannelName(roomId));
                if (channel) {
                    channel.pushMessage('gameChangeSeat',
                        data, function (err) {
                            if (err)
                                logger.error(err);
                        });
                }
                if (clubId !== '') {
                    self.app.rpc.club.clubRemote.pushMessageByClubId.toServer('*',
                        'gameChangeSeat',
                        clubId, data, function () {
                        });
                }
                next(null, {code: code.OK, data: {}});
            } else {
                if (hopeSeat.online === 0) {
                    next(null, {code: code.FAIL, msg: '对方不在线'});
                    return;
                }
                let hopeExchange = RoomInfo.exchanges[hopeSeat.userId];
                if (hopeExchange) {
                    next(null, {code: code.FAIL, msg: '对方正在交换请稍后'});
                    return;
                }
                let mExchange = RoomInfo.exchanges[uid];
                if (mExchange) {
                    next(null, {code: code.FAIL, msg: '你正在交换'});
                    return;
                }
                hopeExchange = {};
                hopeExchange[uid] = 1;
                hopeExchange[hopeSeat.userId] = -1;
                RoomInfo.exchanges[hopeSeat.userId] = hopeExchange;
                mExchange = {};
                mExchange[uid] = 1;
                mExchange[hopeSeat.userId] = -1;
                RoomInfo.exchanges[uid] = mExchange;
                let data = {};
                data.seats = [];
                data.seats.push({userId: uid, agree: 1});
                data.seats.push({userId: hopeSeat.userId, agree: -1});
                self.channelService.pushMessageByUids('gameExchangeSeat', data,
                    [{uid: mSeat.userId, sid: mSeat.fsid},
                        {uid: hopeSeat.userId, sid: hopeSeat.fsid}], function (err) {
                        if (err)
                            logger.error('gameExchangeSeat:', err);
                    });
                next(null, {code: code.OK, data: {}});
            }
        } else {
            next(null, {code: code.FAIL, msg: '没有找到该位置'});
        }
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '换座位失败,请重试'});
    }
};
Handler.prototype.optExchangeSeat = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!session.game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    let roomId = session.get('roomId');
    if (!roomId) {
        next(null, {code: code.FAIL, msg: '你不在房间'});
        return;
    }
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        let agree = msg.agree === 1 ? 1 : 0;
        let RoomInfo = self.roommgr.getRoom(roomId);
        if (RoomInfo.numOfGames > 0) {
            RoomInfo.exchanges = {};
            next(null, {code: code.FAIL, msg: '游戏中,不能交换'});
            return;
        }
        let other = 0;
        let Exchange = RoomInfo.exchanges[uid];
        if (!Exchange) {
            next(null, {code: code.FAIL, msg: '你没有交换请求'});
            return;
        }
        for (let userId in Exchange) {
            if (Exchange.hasOwnProperty(userId)) {
                let temp = parseInt(userId);
                if (temp !== uid) {
                    other = temp;
                }
            }
        }
        let mSeat = self.roommgr.getRoomSeatByUserId(uid);
        if (!mSeat) {
            next(null, {code: code.FAIL, msg: '获取座位信息失败'});
            return;
        }
        let otherSeat = self.roommgr.getRoomSeatByUserId(other);
        if (!otherSeat) {
            next(null, {code: code.FAIL, msg: '获取座位信息失败'});
            return;
        }
        if (agree) {
            let mIndex = mSeat.seatIndex;
            let oIndex = otherSeat.seatIndex;
            self.roommgr.setRoomSeatByIndex(roomId, oIndex, mSeat);
            self.roommgr.setRoomSeatByIndex(roomId, mIndex, otherSeat);
            await self.rdb.updateRoomInfoSeats(roomId, RoomInfo.seats);
            let clubId = RoomInfo.conf.clubId;
            let data = {
                seats: [
                    {index: oIndex, userId: mSeat.userId},
                    {index: mIndex, userId: otherSeat.userId}
                ],
                roomId: roomId,
                clubId: clubId
            };
            let channel = self.channelService.getChannel(self.channelUtil.getRoomChannelName(roomId));
            if (channel) {
                channel.pushMessage('gameChangeSeat',
                    data, function (err) {
                        if (err)
                            logger.error(err);
                    });
            }
            if (clubId !== '') {
                self.app.rpc.club.clubRemote.pushMessageByClubId.toServer('*',
                    'gameChangeSeat',
                    clubId, data, function () {
                    });
            }
            next(null, {code: code.OK, data: {}});
        } else {
            next(null, {code: code.OK, data: {}});
        }
        let data = {};
        data.seats = [];
        data.seats.push({userId: uid, agree: agree});
        data.seats.push({userId: other, agree: Exchange[other]});
        self.channelService.pushMessageByUids('gameExchangeSeat', data,
            [{uid: mSeat.userId, sid: mSeat.fsid},
                {uid: otherSeat.userId, sid: otherSeat.fsid}], function (err) {
                if (err)
                    logger.error('gameExchangeSeat:', err);
            });
        delete RoomInfo.exchanges[uid];
        delete RoomInfo.exchanges[other];
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '操作换位置失败,请重连并重试'});
    }
};
Handler.prototype.ready = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    if (!session.game) {
        next(null, {code: code.FAIL, msg: '没有游戏'});
        return;
    }
    let roomId = self.roommgr.getUserRoomId(uid);
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        let ready = msg.ready === 1 ? 1 : 0;
        try {
            if (ready && self.roommgr.isReady(uid) && self.gamemgr.getGameByRoomID(roomId)) {
                logger.debug(`Aready Ready : ${uid}`);
                next(null, {code: code.OK, data: {}});
            } else {
                const game = await self.gamemgr.setReady(uid, ready);
                if (game) {
                    let channel = self.channelService.getChannel(self.channelUtil.getRoomChannelName(roomId));
                    if (channel)
                        channel.pushMessage('gameReady', {'userId': uid, 'ready': ready});
                    let clubId = game.game.conf.clubId;
                    if (clubId !== '') {
                        self.app.rpc.club.clubRemote.gameReady.toServer('*', {
                            userId: uid,
                            ready: ready,
                            clubId: clubId,
                            roomId
                        }, function () {

                        });
                    }
                    next(null, {code: code.OK, data: {}});
                } else {
                    next(null, {code: code.FAIL, msg: '找不到房间'});
                }
            }
        } catch (e) {
            next(null, {code: code.FAIL, msg: '准备失败'});
        }
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '准备失败,请重试'});
    }
};
Handler.prototype.doraise = function (msg, session, next) {
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
    let raise = com.isNumber(msg.raise) ? msg.raise : 0;
    let ret = game.doRaise(uid, raise);
    if (ret.code === -1) {
        next(null, {code: code.FAIL, msg: ret.msg});
        return;
    }
    next(null, {code: code.OK, data: ret.data});
};
Handler.prototype.exit = async function (msg, session, next) {
    let self = this;
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
    let roomId = session.get('roomId');
    if (!roomId) {
        next(null, {code: code.FAIL, msg: '你不在房间'});
        return;
    }
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        let RoomInfo = self.roommgr.getRoom(roomId);
        let can = self.roommgr.canExitRoom(roomId);
        if (!can) {
            next(null, {code: code.FAIL, msg: '游戏开始,不能离开房间'});
            return;
        }
        let clubId = game.game.conf.clubId;
        let creator = game.game.conf.creator;
        let ret = await self.roommgr.exitRoom(uid);
        if (ret) {
            let fsid = session.frontendId;
            let channel = self.channelService.getChannel(self.channelUtil.getRoomChannelName(roomId));
            if (channel) {
                channel.pushMessage('exitNotify', {'userId': uid});
                self.channelUtil.leaveChannel(channel, uid);
                self.app.rpc.chat.chatRemote.leaveRoom(session, uid, roomId, function () {

                });
            }
            session.set('gameServerId', '');
            session.set('roomId', '');
            session.pushAll(function () {
                next(null, {code: code.OK, data: {}});
            });
            if (clubId) {
                self.app.rpc.club.clubRemote.tableExitClubNotify.toServer('*', {
                    clubId,
                    roomId,
                    userId: uid
                }, function () {
                });
            }
            let Exchange = RoomInfo.exchanges[uid];
            if (Exchange) {
                let other = 0;
                for (let userId in Exchange) {
                    if (Exchange.hasOwnProperty(userId)) {
                        let temp = parseInt(userId);
                        if (temp !== uid) {
                            other = temp;
                        }
                    }
                }
                let otherSeat = self.roommgr.getRoomSeatByUserId(other);
                if (otherSeat) {
                    let data = {};
                    data.seats = [];
                    data.seats.push({userId: uid, agree: 0});
                    data.seats.push({userId: other, agree: Exchange[other]});
                    self.channelService.pushMessageByUids('gameExchangeSeat', data,
                        [{uid: uid, sid: fsid},
                            {uid: otherSeat.userId, sid: otherSeat.fsid}], function (err) {
                            if (err)
                                logger.error('gameExchangeSeat:', err);
                        });
                    delete RoomInfo.exchanges[uid];
                    delete RoomInfo.exchanges[other];
                }
            }
            if (creator === uid) {
                game.dissolveRequest(uid);
            }
        } else {
            next(null, {code: code.FAIL, msg: '退房失败,请重试'});
        }
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '退房失败,请重试'});
    }
};
Handler.prototype.dissolveRequest = async function (msg, session, next) {
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
        game.dissolveRequest(uid);
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '操作失败,请重试'});
        return;
    }
    next();
};
Handler.prototype.dissolveAgree = async function (msg, session, next) {
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
    let agree = msg.agree;
    if (typeof agree !== "number") {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let lockret = await this.rdb.redlockkey(codeConfig.lock_key.room + game.roomId, async function () {
        game.dissolveAgree(uid, agree);
    });
    if (!lockret) {
        next(null, {code: code.FAIL, msg: '操作失败,请重试'});
        return;
    }
    next();
};

Handler.prototype.updateAddress = async function (msg, session, next) {
    let self = this;
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
    let address = msg.address;
    let roomId = session.get('roomId');
    if (!roomId) {
        next(null, {code: code.FAIL, msg: '你不在房间'});
        return;
    }
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        let ret = await self.roommgr.setUserAddress(uid, address);
        if (ret) {
            let channel = self.channelService.getChannel(self.channelUtil.getRoomChannelName(ret.roomId));
            if (channel)
                channel.pushMessage('gameUpdateAddress', {userId: uid, address: ret.address});
        }
        next();
    });
    if (!lockret) {
        next();
    }
};
