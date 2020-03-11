const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const codeConfig = require('../../../../../shared/codeConfig');
const hall = require('../../../domain/hall/hall');
const com = require('../../../util/com');
const code = codeConfig.retCode;

module.exports = function (app) {
    return new Remote(app);
};

var Remote = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.channelUtil = app.get('channelUtil');
};

Remote.prototype.autoCreateClubRoom = async function (base_Info, cb) {
    let creator = base_Info.creator;
    let gametype = base_Info.gametype;
    let gamenums = base_Info.gamenums;
    let peoplemax = base_Info.peoplemax;
    let createtype = base_Info.createtype;
    let wanfa = base_Info.wanfa;
    let clubId = base_Info.clubId;
    let eachcost = base_Info.eachcost;
    if (!com.isNumber(eachcost)) eachcost = 1;
    let roomtype = base_Info.roomtype;
    let raise = base_Info.raise || 1;
    let conf = {
        gametype: gametype,
        creator: creator,
        gamenums: gamenums,
        peoplemax: peoplemax,
        createtype: createtype,
        wanfa: wanfa,
        clubId: clubId,
        eachcost: eachcost,
        roomtype: roomtype,
        raise: raise
    };
    let gameConfigs = this.app.get('gameConfigs');
    if (!gameConfigs) {
        cb({code: code.FAIL, msg: `${clubId}创建房间失败_json`});
        return false;
    }
    if (!gameConfigs.hasOwnProperty(gametype)) {
        cb({code: code.FAIL, msg: `${clubId}没有该游戏`});
        return;
    }
    let user = await this.mdb.get_user_data_by_userid(creator);
    if (user.gems <= 0) {
        if (gameConfigs[gametype].eachcost > 0) {
            cb({code: code.FAIL, msg: `${clubId}房卡不足`});
            return;
        }
    }
    if (createtype === codeConfig.createRoomType.club) {
        if (user.myclubs.indexOf(clubId) === -1) {
            cb({code: code.FAIL, msg: `${clubId}你不是圈主不能开房间`});
            return;
        }
        let eclubs = await this.rdb.getAllExperienceClub();
        if (eclubs) {
            eclubs = Object.keys(eclubs);
            if (eclubs.indexOf(clubId) !== -1) {
                conf.eachcost = 0;
                conf.roomtype = codeConfig.roomType.experience;
            } else {
                conf.eachcost = gameConfigs[gametype].eachcost;
                conf.roomtype = codeConfig.roomType.normal;
            }
        } else {
            conf.eachcost = gameConfigs[gametype].eachcost;
            conf.roomtype = codeConfig.roomType.normal;
        }
    } else {
        cb({code: code.FAIL, msg: `${clubId}参数错误`});
        return;
    }
    let roomid = await hall.createRoom(conf);
    if (roomid) {
        if (createtype === codeConfig.createRoomType.club) {
            let conf = {};
            conf.raise = raise;
            conf.gamenums = gamenums;
            let clubInfo = await this.mdb.add_club_tables(clubId, roomid, wanfa, conf);
            if (!clubInfo) {
                hall.delRoom(creator, roomid);
                cb({code: code.FAIL, msg: `${clubId}创建房间失败`});
                return;
            }
            let suc = false;
            clubInfo.tables.forEach(item => {
                if (item.roomid === roomid) {
                    suc = true;
                }
            });
            if (suc) {
                cb({code: code.OK, msg: '创建成功'});
                this.app.rpc.club.clubRemote.tableClubNotify.toServer('*', {
                    clubId: clubInfo.clubid,
                    roomId: roomid,
                    type: wanfa,
                    conf: JSON.stringify(conf)
                }, function () {
                });
            } else {
                hall.delRoom(creator, roomid);
                cb({code: code.FAIL, msg: `${clubId}创建房间失败`});
            }
            return;
        }
        hall.delRoom(creator, roomid);
        cb({code: code.FAIL, msg: `${clubId}参数错误`});
    } else {
        cb({code: code.FAIL, msg: `${clubId}创建房间失败`});
    }

};
