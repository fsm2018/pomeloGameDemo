const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const codeConfig = require('../../../../../shared/codeConfig');
module.exports = function (app) {
    return new Remote(app);
};
var Remote = function (app) {
    this.app = app;
    this.channelService = app.get('channelService');
    this.channelUtil = app.get('channelUtil');
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.roommgr = app.roomMgr;
    this.gamemgr = app.gameMgr;
};

Remote.prototype.leaveRoom = async function (uid, fsid, roomId, cb) {
    let self = this;
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        self.roommgr.setUserOnline(uid, 0);
        let game = self.gamemgr.getGameByUserID(uid);
        if (!game) {
            cb();
            return;
        }
        if (game && !game.game.isPlaying)
            await self.roommgr.setReady(uid, 0);
        let channel = self.channelService.getChannel(self.channelUtil.getRoomChannelName(roomId));
        if (channel) {
            self.channelUtil.leaveChannel(channel, uid);
            channel.pushMessage('onlineState', {userId: uid, online: 0, roomId});
            if (!game.game.isPlaying)
                channel.pushMessage('gameReady', {userId: uid, ready: 0});
        }
        let RoomInfo = self.roommgr.getRoom(roomId);
        if (RoomInfo.numOfGames <= 0) {
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
        }
        let clubId = game.game.conf.clubId;
        if (clubId !== '') {
            self.app.rpc.club.clubRemote.onlineState.toServer('*', {
                userId: uid,
                online: 0,
                clubId: clubId,
                roomId
            }, function () {

            });
            if (!game.game.isPlaying)
                self.app.rpc.club.clubRemote.gameReady.toServer('*', {
                    userId: uid,
                    ready: 0,
                    clubId: clubId,
                    roomId
                }, function () {

                });
        }
    });
    cb();
};
Remote.prototype.kickUser = async function (roomId, userId, cb) {
    let self = this;
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        let ret = await self.roommgr.kickUser(roomId, userId);
        cb(ret);
    });
    if (!lockret) {
        cb(-4);
    }
};

Remote.prototype.delRoom = async function (roomId, c, cb) {
    let self = this;
    let lockret = await self.rdb.redlockkey(codeConfig.lock_key.room + roomId, async function () {
        let ret = await self.roommgr.destroy(roomId, c);
        cb(ret);
    });
    if (!lockret) {
        cb(false);
    }
};
