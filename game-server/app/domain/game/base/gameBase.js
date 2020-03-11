const pomelo = require('pomelo');
const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const codeConfig = require('../../../../../shared/codeConfig');
const gameRetCode = codeConfig.gameRetCode;


class GameBase {
    constructor(roomData) {
        this.gameState = {
            idle: -1,
            begin: 0,
            playing: 1,
            ask: 2
        };

        this.game = {
            roomInfo: roomData,
            isPlaying: false,
            conf: roomData.conf, //base_info
            gameIndex: roomData.numOfGames,
            button: roomData.nextButton, //庄/第一个出牌人
            state: this.gameState.idle,
            gameSeats: [],
            turn: -1,//顺序
            actionRecord: [],
            actionList: [],
            raise: roomData.conf.raise || 1,
        };

        this.roomId = roomData.id;
        this.max = this.game.conf.peoplemax;
        this.wanfa = this.game.conf.wanfa;

        this.dissolveInfo = {users: {}, endTime: -1};
        this.gameSeatsOfUsers = {};
        this.statusService = pomelo.app.get('statusService');
        this.channelService = pomelo.app.get('channelService');
        this.channel = this.channelService.getChannel(pomelo.app.get('channelUtil').getRoomChannelName(this.roomId), true);
        this.roomMgr = pomelo.app.roomMgr;
        this.gameMgr = pomelo.app.gameMgr;
        this.mdb = pomelo.app.get('mdclient');
        this.rdb = pomelo.app.get('rdclient');
        this.eachcost = this.game.conf.eachcost;
        this.roomtype = this.game.conf.roomtype;
        this.dissolveInterval = null;
        if (this.game.roomInfo.numOfGames > 0) {
            for (let i = 0; i < this.max; i += 1) {
                let seat = this.game.roomInfo.seats[i];
                this.initSeat(seat.userId, i, seat.fsid);
                this.initDissolveInfo(seat.userId);
            }
        }
    }

    initSeat(userId, i, fsid) {
        logger.error('initSeat 子类中要实现此方法');
    }

    initDissolveInfo(userId) {
        this.dissolveInfo.users[userId] = {agree: -1};
    }

    //多个前端服务器时，用户每次重新进入游戏fsid要更新
    updateSeatData_fsid(userId, fsid) {
        if (this.gameSeatsOfUsers[userId] && fsid) {
            this.gameSeatsOfUsers[userId].fsid = fsid;
        }
    }

    async checkGems() {
        let self = this;
        //检测房卡
        if (this.eachcost > 0) {
            let creator = this.game.roomInfo.conf.creator;
            let creatorInfo = await this.mdb.get_users_baseInfo_by_userids([creator]);
            if (creatorInfo.length > 0) {
                creatorInfo = creatorInfo[0];
            } else {
                logger.error(`checkGems get Creator Info Fail, creator:${creator} ,roomId:${this.roomId}`);
                return false;
            }
            let withholding = await this.rdb.getWithholding(creator, codeConfig.GemType.GEM);
            let remaining = creatorInfo.gems - withholding;
            if (remaining <= 0) {
                this.channel.pushMessage('gameNotice', {msg: '由于房主房卡不足,\n本房间将于5秒后解散'},
                    function () {
                    });
                let flag = this.channel.getMember(creator);
                if (!flag) {
                    this.statusService.pushByUids([creator], 'gameNotice',
                        {msg: `由于房卡不足,\n房间(${self.roomId})自动解散`}, function (err) {
                            if (err)
                                logger.error(err);
                        });
                }
                setTimeout(function () {
                    self.roomMgr.destroy(self.roomId, true, true, false);
                }, 6000);
                return true;
            }
            this.rdb.incrWithholding(creator, codeConfig.GemType.GEM, this.eachcost);
            if (pomelo.app.get('env') == 'development')
                console.log('1.请注意在未扣房卡前解散,注意减少预扣数量;\n' +
                    '2.请注意在扣完房卡后,注意减少预扣数量');
        }
    }

    async begin(testData) {
        logger.error('begin 子类中要实现此方法');
    }

    async again(testData) {
        logger.error('again 子类中要实现此方法');
    }

    async doGameOver(seatData, forceEnd) {
        logger.error('doGameOver 子类中要实现此方法');
    }

    doRaise(userId, raise) {
        // const seatData = this.gameSeatsOfUsers[userId];
        // if (seatData.seatIndex !== this.game.button) {
        //     return -1;
        // }
        // if (raise === 1) {
        //     this.game.raise = 2;
        // } else {
        //     this.game.raise = 1;
        // }
        // this.channel.pushMessage('gameRaise', {raise: this.game.raise});
        return {code: 0, data: {}};
    }

    doDissolve(roomId) {
        const roomInfo = this.roomMgr.getRoom(roomId);
        if (roomInfo !== null) {
            this.doGameOver(roomInfo.seats[0], true);
        }
    }

    dissolveRequest(userId) {
        if (userId !== this.game.roomInfo.conf.creator) {
            return -1;
        }
        if (this.game.isPlaying || this.game.roomInfo.numOfGames > 0) {
            this.dissolveAgree(userId, 1);
            return;
        }
        this.channel.pushMessage('dissolveNotify', {}, function (err) {
            if (err)
                logger.error('dissolveNotify', err);
        });
        this.roomMgr.destroy(this.game.roomInfo.id);
    }

    dissolveAgree(userId, agree) {
        if (this.game.roomInfo.numOfGames <= 0) {
            return;
        }
        let user = this.dissolveInfo.users[userId];
        if (!user) {
            logger.error(`dissolveInfo.users:${userId} 不存在,无法申请解散`);
            return;
        }

        user.agree = agree;

        const sendCli = function (dissolveInfo, channel) {
            let clidata = {};
            clidata.users = [];
            for (let userId in dissolveInfo.users) {
                let u = dissolveInfo.users[userId];
                let user = {
                    userId: userId,
                    agree: u.agree
                };
                clidata.users.push(user);
            }
            let tempTime = dissolveInfo.endTime - Date.now();
            clidata.time = tempTime < 0 ? -1 : tempTime * 0.001;
            channel.pushMessage('dissolveAgreeNotify', clidata);
        };
        if (this.dissolveInterval === true)
            return;
        if (agree === 1) {
            if (this.dissolveInterval == null) {
                this.dissolveInfo.endTime = Date.now() + 60000;
                this.dissolveInterval = setInterval(this.dissolveUpdate.bind(this), 1000);
            }
            sendCli(this.dissolveInfo, this.channel);
        } else {
            sendCli(this.dissolveInfo, this.channel);
            for (let userId in this.dissolveInfo.users) {
                let u = this.dissolveInfo.users[userId];
                u.agree = -1;
            }
            this.mClearInterval();
        }
    }

    mClearInterval() {
        if (this.dissolveInterval) {
            try {
                clearInterval(this.dissolveInterval);
            }catch (e) {
                logger.error('clearInterval(this.dissolveInterval) err', e);
            }
            this.dissolveInterval = null;
        }
        this.dissolveInfo.endTime = -1;
    }

    dissolveUpdate() {
        let dissolve = true;
        for (let key in this.dissolveInfo.users) {
            let u = this.dissolveInfo.users[key];
            if (u.agree === 0 || u.agree === -1) {
                dissolve = false;
            }
        }
        if (dissolve) {
            this.doDissolve(this.game.roomInfo.id);
            this.mClearInterval();
            this.dissolveInterval = true;
        } else {
            if (Date.now() > this.dissolveInfo.endTime) {
                this.doDissolve(this.game.roomInfo.id);
                this.mClearInterval();
                this.dissolveInterval = true;
            }
        }
    }

    dissolveSync(userId) {
        const seatData = this.gameSeatsOfUsers[userId];
        if (this.game.roomInfo.numOfGames <= 0) {
            return;
        }
        if (!seatData) {
            logger.error('dissolveSync: no user ', userId);
            return;
        }
        let clidata = {};
        clidata.users = [];
        for (let userId in this.dissolveInfo.users) {
            let u = this.dissolveInfo.users[userId];
            let user = {
                userId: userId,
                agree: u.agree
            };
            clidata.users.push(user);
        }
        let tempTime = this.dissolveInfo.endTime - Date.now();
        clidata.time = tempTime < 0 ? -1 : tempTime * 0.001;
        if (seatData.fsid === -1) {
            seatData.fsid = this.game.roomInfo.seats[seatData.seatIndex].fsid;
        }
        this.channelService.pushMessageByUids('dissolveAgreeNotify',
            clidata, [{uid: seatData.userId, sid: seatData.fsid}], function (err) {
                if (err)
                    logger.error(err);
            });
    }

    sync(userId) {
        logger.error('sync 子类中要实现此方法');
    }
}

module.exports = GameBase;
