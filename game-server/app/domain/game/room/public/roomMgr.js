const codeConfig = require('../../../../../../shared/codeConfig');
const pomelo = require('pomelo');
const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const com = require('../../../../util/com');

let gameMgr;
let config = {};
let rooms = {};
let userLocation = {};
let wanfa;
let mdb;
let rdb;
let base_roomId = 101;
let roomNum = 1;
exports.init = function (gamemgr) {
    gameMgr = gamemgr;
    mdb = pomelo.app.get('mdclient');
    rdb = pomelo.app.get('rdclient');
};
exports.getHallGameConfig = function () {
    return config;
};

async function constructRoom(roomid, b_roomId) {
    let roomId = roomid || wanfa + roomNum + base_roomId;
    const uuid = await pomelo.app.get('mdclient').getNewGameID();
    let gameConf = {
        gametype: config.gametype,
        creator: 0,
        gamenums: config.conf.gamenums,
        peoplemax: config.conf.peoplemax,
        createtype: codeConfig.createRoomType.hallgame,
        clubId: '',
        wanfa: parseInt(wanfa),
        eachcost: config.conf.eachcost,
        roomtype: codeConfig.roomType.normal
    };
    let now = new Date();
    let roomInfo = {
        uuid: uuid,
        id: roomId,
        base_roomId: b_roomId || base_roomId,
        numOfGames: 0,
        createTime: now.getTime(),
        currentTime: now.getTime(),
        nextButton: 0,
        seats: []
    };
    roomInfo.conf = gameConf;
    roomInfo.hallconf = config;
    roomInfo.turnInfo = {};
    for (let i = 0; i < gameConf.peoplemax; i++) {
        const s = {};
        s.userId = 0;
        s.name = "";
        s.headimg = "";
        s.sex = 0;
        s.score = 0;
        s.ready = 0;
        s.seatIndex = i;
        s.online = 0;
        s.fsid = -1;
        s.address = '';
        s.ip = '';
        s.gems = 0;
        roomInfo.seats[i] = s;

        if (s.userId > 0) {
            userLocation[s.userId] = {
                roomId: roomId,
                seatIndex: i,
            };
        }
    }
    roomInfo.exchanges = {};
    rooms[roomId] = roomInfo;
    gameMgr.checkAndCreateGame(roomInfo);
    if (!roomid)
        base_roomId++;
    roomNum++;
    return roomInfo;
}

exports.initConfig = async function (conf) {
    if (!conf) {
        logger.error(`初始化失败:${pomelo.app.curServer.id}`);
    }
    config = conf;
    wanfa = pomelo.app.curServer.wanfa.toString();

    const userMaxIndex = await mdb.get_base_userid();
    let userIndex = 100000;
    while (userIndex <= userMaxIndex) {
        let users = await mdb.getUsersByRange(userIndex, userIndex + 1000, {'roomid': {$ne: null}});
        const fun = async function (i) {
            if (i >= users.length)
                return;
            users[i].hallGamehallId = null;
            users[i].roomid = null;
            await users[i].save();
            i++;
            await fun(i);
        };
        await fun(0);
        userIndex += 1000;
    }

    let roomMax = config.roommax;
    let roomIndex = 0;
    while (roomIndex < roomMax) {
        await constructRoom();
        roomIndex++;
    }
};
exports.refreshConfig = async function (conf) {
    if (!config) {
        logger.error(`刷新配置失败:${pomelo.app.curServer.id}`);
    }
    config = conf;
    let roomMax = config.roommax;
    let had = Object.keys(rooms).length;
    for (let roomId in rooms) {
        let game = gameMgr.getGameByRoomID(roomId);
        if (game) {
            game.updateHallGameConf(conf);
        }
    }
    let need = roomMax - had;
    let roomIndex = 0;
    while (roomIndex < need) {
        await constructRoom();
        roomIndex++;
    }
};
exports.getRooms = function () {
    return rooms;
};
exports.getRoom = function (roomId) {
    return rooms[roomId];
};

async function storeHistory(roomInfo) {
    let max = roomInfo.conf.peoplemax;
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
    for (let i = 0; i < seats.length; i++) {
        let sd = seats[i];
        let hs = {};
        hs.userid = sd.userId;
        hs.name = sd.name;
        hs.score = sd.score;
        history.seats[i] = hs;
    }
    let i = 0;
    while (i < seats.length) {
        const s = seats[i];
        await rdb.addHallGameHistory(s.userId, wanfa, history);
        i++;
    }
}

exports.destroy = async function (roomId, kickNotify = true) {
    let roomInfo = exports.getRoom(roomId);
    if (!roomInfo)
        return;
    delete rooms[roomId];
    gameMgr.deleteGame(roomId);
    let channelName = pomelo.app.get('channelUtil').getRoomChannelName(roomId);
    let channel = pomelo.app.get('channelService').getChannel(channelName);
    try {
        for (let i = 0; i < roomInfo.seats.length; i += 1) {
            const userId = roomInfo.seats[i].userId;
            if (userId > 0) {
                if (channel && kickNotify)
                    channel.pushMessage('kickRoom', {roomId, userId});
                delete userLocation[userId];
                mdb.set_hallroom_id_of_user(userId, null);
            }
        }
    } catch (e) {
        logger.error('删除房间 房间位置信息错误:', e);
    }
    try {
        await storeHistory(roomInfo);
    } catch (e) {
        logger.error('对局历史保存错误: ', e);
    }
    pomelo.app.rpc.chat.chatRemote.destroyRoomChannel.toServer('*', roomId, function () {
    });
    if (channel)
        channel.destroy();
    let hallGameHallchannel = pomelo.app.get('channelService').getChannel(pomelo.app.get('channelUtil').getHallGameHallChannelName(wanfa));
    hallGameHallchannel.pushMessage('tableDissolveHallGameHallNotify', {
        hallGamehallId: wanfa,
        roomId,
    });
    let room_pos = roomInfo.base_roomId % 100; //parseInt(roomInfo.id.substr(roomInfo.id.length - 5));
    if (room_pos <= config.roommax) {
        let rId = wanfa + roomNum + roomInfo.base_roomId;
        let newRoonInfo = await constructRoom(rId, roomInfo.base_roomId);
        if (newRoonInfo) {
            hallGameHallchannel.pushMessage('tableHallGameHallNotify', {
                hallGamehallId: wanfa,
                roomId: newRoonInfo.id,
                type: parseInt(wanfa),
                conf: JSON.stringify(newRoonInfo.conf)
            });
        }
    }
    return true;
};
exports.enterRoom = function (roomId, userId, userName, seatIndex) {
    let room = rooms[roomId];
    if (!room) {
        return -1;
    }
    if (com.isNumber(seatIndex)) {
        let sI = exports.getUserSeatIndex(userId);
        if (com.isNumber(sI) && sI != seatIndex) {
            return 0;
        }
        if (seatIndex < room.seats.length) {
            const seat = room.seats[seatIndex];
            if (!seat.userId || seat.userId <= 0 || seat.userId == userId) {
                seat.userId = userId;
                seat.name = userName;
                if (!room.turnInfo[userId])
                    room.turnInfo[userId] = 0;
                userLocation[userId] = {
                    roomId,
                    seatIndex: seatIndex,
                };
                return 0;
            }
        }
        return -3;
    } else {
        for (let i = 0; i < room.seats.length; i++) {
            const seat = room.seats[i];
            if (!seat.userId || seat.userId <= 0 || seat.userId == userId) {
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
    }
    return -2;
};

exports.setReady = function (userId, value) {
    let roomId = exports.getUserRoomId(userId);
    if (!roomId) {
        return -1;
    }
    const room = exports.getRoom(roomId);
    if (room == null) {
        return -1;
    }
    const seatIndex = exports.getUserSeatIndex(userId);
    if (seatIndex == null) {
        return -1;
    }

    const s = room.seats[seatIndex];
    s.ready = value;
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
exports.getUserRoomInfo = function (userId) {
    const roomId = exports.getUserRoomId(userId);
    if (roomId == null) {
        return null;
    }
    return exports.getRoom(roomId);
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
exports.setUserOnline = function (userId, online) {
    let seat = exports.getRoomSeatByUserId(userId);
    if (seat != null)
        seat.online = online;
};
exports.getUserOnline = function (userId) {
    let seat = exports.getRoomSeatByUserId(userId);
    if (!seat)
        return 0;
    return seat.online;
};
exports.isPlaying = function (roomId) {
    const room = rooms[roomId];

    return room.numOfGames > 0;

};
exports.setUserAddress = async function (userId, address) {
    let seat = exports.getRoomSeatByUserId(userId);
    if (seat != null)
        seat.address = address;
};
exports.canExitRoom = function (roomId) {
    return !gameMgr.isGameRunning(roomId);
};
exports.exitRoom = async function (userId) {
    const location = userLocation[userId];
    if (location == null) return false;

    const roomId = location.roomId;
    const seatIndex = location.seatIndex;
    const room = rooms[roomId];
    if (gameMgr.isGameRunning(roomId)) {
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

    await mdb.set_hallroom_id_of_user(userId, null);
    return true;
};
exports.getUserSeatIndex = function (userId) {
    const location = userLocation[userId];
    if (location != null) {
        return location.seatIndex;
    }
    return null;
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
    return exports.getRoom(roomId);
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
exports.updateRoomInfo = (roomId, userId, username, headimg, sex, fsid, ip, gems) => {
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
        seat.gems = gems;
    } else {
        logger.error('更新房间座位信息,roomMgr找不到room', roomId);
    }
};