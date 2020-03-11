const codeConfig = require('../../../../../../shared/codeConfig');
const pomelo = require('pomelo');
const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const com = require('../../../../util/com');

var gameMgr;
var mdb;
var rdb;

const rooms = {};
const userLocation = {};
let totalRooms = 0;

exports.init = function (gamemgr) {
    gameMgr = gamemgr;
    mdb = pomelo.app.get('mdclient');
    rdb = pomelo.app.get('rdclient');
};

function constructRoomFromDb(dbdata) {
    const roomInfo = {
        uuid: dbdata.uuid,
        id: dbdata.id,
        numOfGames: parseInt(dbdata.num_of_games, 10),
        createTime: dbdata.create_time,
        currentTime: dbdata.current_time,
        nextButton: parseInt(dbdata.next_button, 10),
        seats: [],
    };
    roomInfo.conf = JSON.parse(dbdata.base_info);
    roomInfo.turnInfo = JSON.parse(dbdata.turn_info);
    let max = parseInt(roomInfo.conf.peoplemax, 10);
    roomInfo.seats = new Array(max);

    const roomId = roomInfo.id;

    for (let i = 0; i < max; i += 1) {
        const s = {};
        s.userId = parseInt(dbdata[`seat_${i}`], 10) || 0;
        s.name = dbdata[`seat_name_${i}`] || "";
        s.headimg = dbdata[`headimg_${i}`] || "";
        s.sex = parseInt(dbdata[`sex_${i}`], 10) || 0;
        s.score = dbdata[`seat_score_${i}`];
        s.score = (s.score) ? parseInt(s.score) : 0;
        s.ready = 0;
        s.seatIndex = i;
        s.online = 0;
        s.fsid = -1;
        s.address = '';
        s.ip = '';
        roomInfo.seats[i] = s;

        if (s.userId > 0) {
            userLocation[s.userId] = {
                roomId,
                seatIndex: i,
            };
        }
    }
    roomInfo.exchanges = {};
    rooms[roomId] = roomInfo;
    totalRooms += 1;
    return roomInfo;
}

async function storeHistory(roomInfo) {
    let clubId = roomInfo.conf.clubId;
    let max = roomInfo.conf.peoplemax;
    let gametype = roomInfo.conf.gametype;
    const seats = roomInfo.seats;
    let relpeople = 0;
    for (let i = 0; i < seats.length; i++) {
        let sd = seats[i];
        if (sd.userId > 0) {
            relpeople++;
        }
    }
    if (relpeople != max) {
        return;
    }
    const history = {
        uuid: roomInfo.uuid,
        id: roomInfo.id,
        time: com.timest(true),//roomInfo.createTime,
        conf: roomInfo.conf,
        seats: new Array(max),
    };
    let type = '';
    if (gametype === codeConfig.gameType.mj_hz) {
        type = max === 2 ? codeConfig.StatisticsGameType.mj2_hz : codeConfig.StatisticsGameType.mj4_hz;
    } else if (gametype === codeConfig.gameType.d_buckle_hz) {
        type = codeConfig.StatisticsGameType.dbuckle4_hz;
    } else if (gametype === codeConfig.gameType.pushing_hz) {
        type = max === 3 ? codeConfig.StatisticsGameType.pushing3_hz : codeConfig.StatisticsGameType.pushing4_hz;
    } else {
        return;
    }
    for (let i = 0; i < seats.length; i++) {
        let sd = seats[i];
        let hs = {};
        hs.userid = sd.userId;
        hs.name = sd.name;
        hs.score = sd.score;
        history.seats[i] = hs;
        if (clubId !== '') {
            await rdb.incrClubBattleCount(sd.userId, clubId, type);
            await rdb.incrClubBattleMonCount(sd.userId, clubId, type);
        }
    }
    for (let i = 0; i < seats.length; i += 1) {
        const s = seats[i];
        await rdb.addHistory(s.userId, type, history);
    }
    if (clubId !== '') {
        await rdb.addClubHistory(clubId, type, history);
    }
}

exports.destroy = async function (roomId, clubCreate = true, kickNotify = true, withholding = true) {
    let roomInfo = rooms[roomId];
    // if (roomInfo == null) {
    const dbdata = await rdb.getRoomInfo(roomId);
    if (!roomInfo && !dbdata)
        return false;
    if (dbdata) {
        try {
            roomInfo = constructRoomFromDb(dbdata);
        } catch (e) {
            logger.error(`删除房间,重新构造房间(${roomId})db数据错误,继续删除操作`, e);
        }
    }
    // }
    try {
        if (withholding && roomInfo.numOfGames < 1 && gameMgr.isGameRunning(roomId)) {
            let conf = roomInfo.conf;
            rdb.incrWithholding(conf.creator, codeConfig.GemType.GEM, -conf.eachcost);
        }
    } catch (e) {
    }
    try {
         storeHistory(roomInfo);
    } catch (e) {
        logger.error('对局历史保存错误: ', e);
    }
    let channelName = pomelo.app.get('channelUtil').getRoomChannelName(roomId);
    let channel = pomelo.app.get('channelService').getChannel(channelName);
    try {
        for (let i = 0; i < roomInfo.seats.length; i += 1) {
            const userId = roomInfo.seats[i].userId;
            if (userId > 0) {
                if (channel && kickNotify)
                    channel.pushMessage('kickRoom', {roomId, userId});
                delete userLocation[userId];
                mdb.set_room_id_of_user(userId, null);
            }
        }
    } catch (e) {
        logger.error('删除房间 房间位置信息错误:', e);
    }

    delete rooms[roomId];
    totalRooms -= 1;
    rdb.delRoomInfo(roomId);
    try {
        rdb.delEmtyRoom(roomInfo.conf.creator, roomId);
    } catch (e) {
    }

    gameMgr.deleteGame(roomId);
    pomelo.app.rpc.chat.chatRemote.destroyRoomChannel.toServer('*', roomId, function () {
    });
    if (channel)
        channel.destroy();
//俱乐部操作
    try {
        let clubId = roomInfo.conf.clubId;
        if (clubId) {
            let ret = await mdb.del_club_tables_by_roomid(clubId, roomId);
            if (!ret)
                logger.error('del_club_tables_by_roomid err:', ret);
            pomelo.app.rpc.club.clubRemote.tableDissolveClubNotify.toServer('*', {
                clubId,
                roomId
            }, function () {
            });
            if (clubCreate) {
                let hallServers = pomelo.app.getServersByType('hall');
                if (hallServers.length > 0) {
                    let randomIndex = Math.floor(Math.random() * hallServers.length);
                    pomelo.app.rpc.hall.hallRemote.autoCreateClubRoom.toServer(hallServers[randomIndex].id, roomInfo.conf, function (data) {
                        if (data.code !== codeConfig.retCode.OK) {
                            logger.error(`牌友圈自动创建房间:code:${data.code} msg:${data.msg}`);
                        }
                    });
                } else {
                    logger.error(`牌友圈自动创建房间失败,没有可用大厅服务器`);
                }
            }
        }
    } catch (e) {
        logger.error('删除房间 俱乐部操作错误: ', e);
    }
    return true;
};
exports.kickUser = async function (roomId, userid) {
    let roomInfo = rooms[roomId];
    if (roomInfo == null) {
        const dbdata = await rdb.getRoomInfo(roomId);
        if (!dbdata)
            return -1;
        roomInfo = constructRoomFromDb(dbdata);
    }
    let isPlaying = gameMgr.isGameRunning(roomId);
    if (isPlaying) {
        //游戏开始状态不能踢出
        return -3;
    }

    let clubId = roomInfo.conf.clubId;
    let channelName = pomelo.app.get('channelUtil').getRoomChannelName(roomId);
    let channel = pomelo.app.get('channelService').getChannel(channelName);
    for (let i = 0; i < roomInfo.seats.length; i += 1) {
        const user = roomInfo.seats[i];
        const userId = user.userId;
        if (userId === userid) {
            if (channel) {
                channel.pushMessage('kickRoom', {roomId, userId});
                pomelo.app.get('channelUtil').leaveChannel(channel, userId);
            }
            user.userId = 0;
            user.name = '';
            user.headimg = '';
            user.sex = 0;
            user.ready = 0;
            user.online = 0;
            user.address = '';
            user.ip = '';
            user.fsid = -1;
            let seatIndex = userLocation[userId].seatIndex;
            await rdb.updateRoomInfoSeat(roomId, user.userId, user.name, user.headimg, user.sex,
                user.address, user.online, user.ip, user.ready, true, user.seatIndex);
            delete userLocation[userId];
            await mdb.set_room_id_of_user(userId, null);
            if (clubId) {
                pomelo.app.rpc.club.clubRemote.tableExitClubNotify.toServer('*', {
                    clubId,
                    roomId,
                    userId
                }, function () {
                });
            }
            return 0;
        }
    }
    return -2;
};
exports.getTotalRooms = function () {
    return totalRooms;
};

exports.getRoom = function (roomId) {
    return rooms[roomId];
};


exports.isCreator = function (roomId, userId) {
    const roomInfo = rooms[roomId];
    if (roomInfo == null) {
        return false;
    }
    return roomInfo.conf.creator === userId;
};

exports.enterRoom = async function (roomId, userId, userName) {
    const fnTakeSeat = async function (data) {
        const room = data;
        if (exports.getUserRoomId(userId) === roomId) {
            // 已存在
            return 0;
        }

        for (let i = 0; i < room.seats.length; i += 1) {
            const seat = room.seats[i];
            if (!seat.userId || seat.userId <= 0 || seat.userId === userId) {
                seat.userId = userId;
                seat.name = userName;
                if (!room.turnInfo[userId])
                    room.turnInfo[userId] = 0;
                userLocation[userId] = {
                    roomId,
                    seatIndex: i,
                };
                return 0;
            }
        }
        // 房间已满
        return 1;
    };
    let room = rooms[roomId];
    if (room) {
        return fnTakeSeat(room);
    }

    const dbdata = await rdb.getRoomInfo(roomId);
    if (!dbdata)
        return 2;
    room = constructRoomFromDb(dbdata);
    return fnTakeSeat(room);
};

exports.setReady = async function (userId, value) {
    const roomId = exports.getUserRoomId(userId);
    if (roomId == null) {
        return;
    }

    const room = exports.getRoom(roomId);
    if (room == null) {
        return;
    }

    const seatIndex = exports.getUserSeatIndex(userId);
    if (seatIndex == null) {
        return;
    }

    const s = room.seats[seatIndex];
    s.ready = value;
    await rdb.updateRoomInfoSeat(roomId, s.userId, s.name, s.headimg, s.sex,
        s.address, s.online, s.ip, s.ready, true, s.seatIndex);
};

exports.isReady = function (userId) {
    const roomId = exports.getUserRoomId(userId);
    if (roomId == null) {
        return null;
    }

    const room = exports.getRoom(roomId);
    if (room == null) {
        return null;
    }

    const seatIndex = exports.getUserSeatIndex(userId);
    if (seatIndex == null) {
        return null;
    }

    const s = room.seats[seatIndex];
    return s.ready;
};


exports.getUserRoomId = function (userId) {
    const location = userLocation[userId];
    if (location != null) {
        return location.roomId;
    }
    return null;
};

exports.getUserRoomInfo = function (userId) {
    const roomId = exports.getUserRoomId(userId);
    if (roomId == null) {
        return null;
    }
    const roomInfo = exports.getRoom(roomId);
    return roomInfo;
};

exports.getUserSeatIndex = function (userId) {
    const location = userLocation[userId];
    if (location != null) {
        return location.seatIndex;
    }
    return null;
};

exports.setUserSeatIndex = function (userId, seatIndex) {
    const location = userLocation[userId];
    if (!location)
        return;
    location.seatIndex = seatIndex;
    let seatdata = exports.getRoomSeatByUserId(userId);
    if (seatdata !== null)
        seatdata.seatIndex = seatIndex;
};

exports.getUserLocations = function () {
    return userLocation;
};
exports.getRoomSeatByUserId = function (userId) {
    let roomInfo = exports.getUserRoomInfo(userId);
    if (roomInfo != null) {
        for (let i = 0; i < roomInfo.seats.length; i++) {
            let seat = roomInfo.seats[i];
            if (seat.userId === userId) {
                return seat;
            }
        }
    }
    return null;
};
exports.getRoomSeatByIndex = function (roomId, index) {
    const roomInfo = exports.getRoom(roomId);
    if (roomInfo != null) {
        if (index < roomInfo.seats.length) {
            return roomInfo.seats[index];
        }
    }
    return null;
};
exports.setRoomSeatByIndex = function (roomId, index, seat) {
    const roomInfo = exports.getRoom(roomId);
    if (roomInfo != null) {
        if (index < roomInfo.seats.length) {
            seat.seatIndex = index;
            roomInfo.seats[index] = seat;
            if (seat.userId !== 0)
                userLocation[seat.userId].seatIndex = index;
            return roomInfo.seats[index];
        }
    }
    return null;
};
exports.setUserOnline = async function (userId, online) {
    let seat = exports.getRoomSeatByUserId(userId);
    if (seat != null)
        seat.online = online;
    else
        return;
    const data = {};
    let roomId = exports.getUserRoomId(userId);
    if (roomId) {
        await rdb.updateRoomInfoSeat(roomId, seat.userId, seat.name, seat.headimg, seat.sex,
            seat.address, seat.online, seat.ip, seat.ready, true, seat.seatIndex);
    }
};

exports.setUserAddress = async function (userId, address) {
    let seat = exports.getRoomSeatByUserId(userId);
    if (seat != null)
        seat.address = address;
    else
        return false;
    const data = {};
    let roomId = exports.getUserRoomId(userId);
    if (roomId) {
        await rdb.updateRoomInfoSeat(roomId, seat.userId, seat.name, seat.headimg, seat.sex,
            seat.address, seat.online, seat.ip, seat.ready, true, seat.seatIndex);
        return {roomId, address};
    }
    return false;
};

exports.isPlaying = function (roomId) {
    const room = rooms[roomId];

    if (room.numOfGames > 0) {
        return true;
    }
    return false;
};

exports.canExitRoom = function (roomId) {
    const room = rooms[roomId];
    let count = 0;

    let max = parseInt(room.conf.peoplemax, 10);
    for (let i = 0; i < max; i += 1) {
        if (room.seats[i].userId > 0 && room.seats[i].ready === 1 && room.seats[i].online === 1) {
            count += 1;
        }
    }

    if (count === max) {
        return false;
    }
    return true;
};

exports.exitRoom = async function (userId) {
    const location = userLocation[userId];
    if (location == null) return false;

    const roomId = location.roomId;
    const seatIndex = location.seatIndex;
    const room = rooms[roomId];

    if (exports.isPlaying(roomId)) {
        return false;
    }

    delete userLocation[userId];
    if (room == null || seatIndex == null) {
        return false;
    }

    const seat = room.seats[seatIndex];
    seat.userId = 0;
    seat.name = '';
    seat.headimg = "";
    seat.sex = 0;
    seat.score = 0;
    seat.ready = 0;
    seat.online = 0;
    seat.fsid = -1;
    seat.address = '';
    seat.ip = '';

    let numOfPlayers = 0;
    for (let i = 0; i < room.seats.length; i += 1) {
        if (room.seats[i].userId > 0) {
            numOfPlayers += 1;
        }
    }
    await rdb.updateRoomInfoSeat(roomId, seat.userId, seat.name, seat.headimg, seat.sex,
        seat.address, seat.online, seat.ip, seat.ready, true, seatIndex);
    if (numOfPlayers === 0 && room.conf.createtype === codeConfig.createRoomType.normal) {
        exports.destroy(roomId);
    }
    await mdb.set_room_id_of_user(userId, null);
    return true;
};

exports.clearRooms = () => {
    // const list = Object.values(rooms);
    // const ctime = new Date();
    // const today = ctime.getDay();
    // const hour = ctime.getHours();
    // list.forEach((roomInfo) => {
    //     const t = new Date(roomInfo.currentTime);
    //     const d = t.getDay();
    //     const h = t.getHours();
    //     if (gameMgr.isGameRunning(roomInfo.id)) {
    //
    //     } else {
    //         // 过期房间
    //         if (d > today && h > hour) {
    //             exports.destroy(roomInfo.id);
    //         }
    //     }
    // });
};

exports.updateRoomInfo = async (roomId, userId, username, headimg, sex, fsid, ip) => {
    const room = rooms[roomId];
    if (room) {
        const location = userLocation[userId];
        if (location == null) {
            logger.error('更新房间座位信息,找不到location', roomId, userId);
            return;
        }
        const seat = room.seats[location.seatIndex];
        seat.name = username;
        seat.headimg = headimg;
        seat.sex = sex;
        seat.fsid = fsid;
        seat.ip = ip;
        await rdb.updateRoomInfoSeat(roomId, seat.userId, seat.name, seat.headimg,
            seat.sex, seat.address, seat.online, seat.ip, seat.ready, true, seat.seatIndex);
    } else {
        logger.error('更新房间座位信息,roomMgr找不到room', roomId);
    }
};
