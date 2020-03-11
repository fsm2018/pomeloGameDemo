const http = require('../../util/httpUtil');
const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const pomelo = require('pomelo');
const codeConfig = require('../../../../shared/codeConfig');
const com = require('../../util/com');

const code = codeConfig.retCode;

exports.getXlToken = async function (code, appid, secret) {
    try {
        const uri = `https://ssgw.updrips.com/oauth2/accessToken?appid=${appid}&appsecret=${secret}&code=${code}&grant_type=authorization_code`;
        let d = await http.get2(uri, false, true).then(ret => ret).catch(() => false);
        if (!d || d.err_code !== 0) {
            logger.error(`d: `, d);
            logger.error(`getXlToken code: ${d.err_code} msg: ${d.err_msg}`);
            return false;
        }
        return {
            access_token: d.data.access_token,
            refresh_token: d.data.refresh_token,
        };
    } catch (err) {
        logger.error('getXlToken' + err);
        return false;
    }
};

exports.getXlInfo = async function (token) {

    try {
        const uri = `https://ssgw.updrips.com/resource/user/getUserInfo?access_token=${token}`;
        let d = await http.get2(uri, false, true).then(ret => ret).catch(() => false);
        if (!d || d.err_code !== 0) {
            logger.error(`d: `, d);
            logger.error(`code: ${d.err_code} msg: ${d.err_msg}`);
            logger.error(`url: ${url}`);
            logger.error(`token: ${token}`);
            return false;
        }
        return {
            xl_openid_pomelo: d.data.openId
        }
    } catch (err) {
        logger.error('getXlInfo' + err);
        return false;
    }
};

exports.setXLOpenID = async function (userId, openId) {
    return await pomelo.app.get('mdclient').setXLOpenID(userId, openId);
};

exports.checkXlbind = async function (userID) {
    const user = await pomelo.app.get('mdclient').get_user_data_by_userid(userID);
    if (!user) {
        logger.error('getXlToken get_user_data_by_userid err ' + userID);
        return false;
    }
    if (user.xl_openid_pomelo) {
        return code.HALL.XL_BIND_HAD;
    }
    return true;
};

function generateRoomId() {
    let roomId = '';
    for (let i = 0; i < 6; i += 1) {
        roomId += Math.floor(Math.random() * 10);
    }
    return roomId;
}

async function chooseGameServerId(gametype) {
    let gameServers = pomelo.app.getServersByType('game');
    let validservers = [];
    for (let key in gameServers) {
        let server = gameServers[key];
        if (server.gametype === gametype) {
            let ret = await pomelo.app.get('rdclient').checkBanServer('game', server.id);
            if (ret === 0) {
                validservers.push(server.id);
            }
        }
    }
    logger.debug(`validservers len : ${validservers.length} , ${validservers} `);
    if (validservers.length > 0) {
        let random = Math.floor(Math.random() * validservers.length);
        let chooseGameServerId = validservers[random];
        logger.debug(`chooseGameServerId : ${chooseGameServerId}`);
        return chooseGameServerId;
    }
    return null;
}

exports.createRoom = async function (roomConf) {
    async function createFunc(roomId) {
        const ret = await pomelo.app.get('rdclient').creatingRoom(roomId);
        if (!ret) {
            return false;
        }
        if (await pomelo.app.get('rdclient').getRoomInfo(roomId)) {
            await pomelo.app.get('rdclient').delCreatingRoom(roomId);
            return false;
        }
        return true;
    }

    let roomId;
    for (let i = 0; i < 5; i += 1) {
        const roomid = generateRoomId();
        const ret = await createFunc(roomid);
        if (ret) {
            roomId = roomid;
            break;
        }
    }
    let serverId = await chooseGameServerId(roomConf.gametype);
    if (!serverId) {
        logger.error('创建房间没有可用游戏服务器');
        return false;
    }
    if (roomId) {
        // 写入数据库
        const conf = roomConf;
        const uuid = await pomelo.app.get('mdclient').getNewGameID();
        if (!uuid) {
            return false;
        }
        const ret = await pomelo.app.get('rdclient').createRoomInfo(roomId, conf, uuid, serverId);
        pomelo.app.get('rdclient').delCreatingRoom(roomId);
        if (ret) {
            return roomId;
        }
        return false;
    }
    return false;
};

exports.delRoom = async function (userId, roomId) {
    let roomInfo = await pomelo.app.get('rdclient').getRoomInfo(roomId);
    if (roomInfo) {
        let conf = JSON.parse(roomInfo.base_info);
        if (!conf.creator || conf.creator !== userId) {
            logger.debug(userId, '要删除房间，可惜不是自己的房间', roomId);
            return false;
        }
    }
    let ret = await pomelo.app.get('rdclient').delRoomInfo(roomId);
    return {
        roomInfo,
        ret
    }
};


async function updateRoom(userId, roomId, roomInfo, name, headimg, sex) {
    const room = await pomelo.app.get('rdclient').getRoomInfo(roomId);//roomInfo;
    const conf = JSON.parse(room.base_info);
    let max = parseInt(conf.peoplemax, 10);
    if (!max) max = 4;
    for (let i = 0; i < max; i += 1) {
        // 防止重复进入房间
        if (room[`seat_${i}`]) {
            const uid = parseInt(room[`seat_${i}`], 10);
            if (userId === uid) {
                return 0;
            }
        }
    }

    // 不在房间里面,进入房间
    let i = 0;
    while (i < max) {
        if (!room[`seat_${i}`] || room[`seat_${i}`] === '0') {
            await pomelo.app.get('rdclient').updateRoomInfoSeat(roomId, i, userId, name, headimg, sex);
            return 0;
        }
        i++;
    }
    // 房间已满
    return 1;
}

exports.enterRoom = async function (userId, roomId, name, headimg, sex) {
    const roomInfo = await pomelo.app.get('rdclient').getRoomInfo(roomId);
    if (roomInfo) {
        let base_Info = JSON.parse(roomInfo.base_info);
        if (base_Info.clubId !== '') {
            let clubInfo = await pomelo.app.get('mdclient').get_club_Info_by_clubid(base_Info.clubId);
            if (clubInfo) {
                if (clubInfo.ownerid !== userId && clubInfo.members.indexOf(userId) === -1) {
                    return code.HALL.ENTER_CLUB_ROOM_NOT_MEMBER;
                }
                let opening = clubInfo.opening;
                if (opening === 0) {
                    return code.HALL.ENTER_CLUB_ROOM_CLOSEING;
                }
            } else {
                return code.HALL.ENTER_ROOM_FAIL;
            }
        }
        const ret = await pomelo.app.get('mdclient').set_room_id_of_user(userId, roomId);
        if (!ret)
            return false;
        const cd = await pomelo.app.get('rdclient').updateRoomInfoSeat(roomId, userId, name, headimg, sex);
        // const cd = await updateRoom(userId, roomId, roomInfo, name, headimg, sex);
        if (cd === 1) {
            pomelo.app.get('mdclient').set_room_id_of_user(userId, null);
            return code.HALL.ENTER_ROOM_FULL;
        } else {
            let data = {};
            data.roomId = roomId;
            data.serverId = roomInfo.serverId;
            return data;
        }
    } else {
        logger.debug('hall enterRoom : no room', roomId);
        return false;
    }
};

exports.addEmptyRoom = async function (uid, roomId, conf) {
    return await pomelo.app.get('rdclient').addEmptyRoom(uid, roomId, conf);
};
exports.delEmtyRoom = async function (uid, roomId) {
    return await pomelo.app.get('rdclient').delEmtyRoom(uid, roomId);
};
