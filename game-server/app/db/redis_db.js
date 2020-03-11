const pomelo = require('pomelo');
var redis = require('redis');
const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const com = require('../util/com');
const fs = require('fs');
const Redlock = require('redlock');

var client = null;
var redlock = null;
exports.init = function (app) {
    var configs = app.get('redis');
    client = redis.createClient(configs.port, configs.host, configs.options);
    client.on('error', (error) => {
        logger.error('redis 连接失败', error);
    });

    client.on('ready', async (err) => {
        logger.info(`${app.curServer.id} redis : ready`, err);
        if (!err) {
            let luakeys = Object.keys(luaScript);
            let luaReadIndex = 0;
            while (luaReadIndex < luakeys.length) {
                try {
                    let lua = luaScript[luakeys[luaReadIndex]];
                    let luasc = fs.readFileSync(lua.path, 'utf8');
                    let sha1 = await exports.loadluaScript(luasc);
                    if (sha1) {
                        lua.sha1 = sha1;
                        luaReadIndex++;
                    }
                } catch (e) {
                    logger.error(luakeys[luaReadIndex], e);
                    pomelo.app.stop(true);
                }
            }
        }
    });

    client.on('connect', () => {
        logger.info(`${app.curServer.id} redis : connect`);
    });

    redlock = new Redlock([client], {retryCount: 4, retryDelay: 150});
    redlock.on('clientError', function (err) {
        logger.error('redlock A redis error has occurred:', err);
    });
};


function set(key, data) {
    return new Promise((resolve, reject) => {
        client.set(key, data, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function get(key) {
    return new Promise((resolve, reject) => {
        client.get(key, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function evalsha(strSHA1, keys, args) {
    return new Promise((resolve, reject) => {
        let arr;
        if (args) {
            arr = [strSHA1, keys.length].concat(keys).concat(args);
        } else {
            arr = [strSHA1, keys.length].concat(keys);
        }
        client.evalsha(arr, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function lrange(key, start, end) {
    return new Promise((resolve, reject) => {
        client.lrange(key, start, end, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function lpush(key, value) {
    return new Promise((resolve, reject) => {
        client.lpush(key, value, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function rpop(key) {
    return new Promise((resolve, reject) => {
        client.rpop(key, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function llen(key) {
    return new Promise((resolve, reject) => {
        client.llen(key, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function del(key) {
    return new Promise((resolve, reject) => {
        client.del(key, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function hdel(key, field) {
    return new Promise((resolve, reject) => {
        client.hdel(key, field, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function hmset(key, data) {
    return new Promise((resolve, reject) => {
        client.hmset(key, data, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function hmget(key, field) {
    return new Promise((resolve, reject) => {
        client.hmget(key, field, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function hgetall(key) {
    return new Promise((resolve, reject) => {
        client.hgetall(key, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function hincrby(key, field, c) {
    return new Promise((resolve, reject) => {
        client.hincrby(key, field, c, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function sadd(key, m) {
    return new Promise((resolve, reject) => {
        client.sadd(key, m, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function smembers(key) {
    return new Promise((resolve, reject) => {
        client.smembers(key, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function sismember(key, m) {
    return new Promise((resolve, reject) => {
        client.sismember(key, m, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function srem(key, m) {
    return new Promise((resolve, reject) => {
        client.srem(key, m, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function exists(key) {
    return new Promise((resolve, reject) => {
        client.exists(key, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function rename(key, newkey) {
    return new Promise((resolve, reject) => {
        exists(key).then(ret => {
            if (ret) {
                client.rename(key, newkey, (err, ret) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(ret);
                    }
                });
            } else {
                reject(false);
            }
        });
    });
}

//设置key失效时间(秒)
function expire(key, times) {
    return new Promise((resolve, reject) => {
        client.expire(key, times, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

//设置key失效时间(毫秒)
function pexpire(key, times) {
    return new Promise((resolve, reject) => {
        client.pexpire(key, times, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

//设置key失效时间戳(秒)
function expireat(key, timestamp) {
    return new Promise((resolve, reject) => {
        client.expireat(key, timestamp, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

//设置key失效时间戳(毫秒)
function pexpireat(key, timestamp) {
    return new Promise((resolve, reject) => {
        client.pexpireat(key, timestamp, (err, ret) => {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function getkeys(prefix) {
    return new Promise((resolve, reject) => {
        client.keys(prefix, function (err, list) {
            if (err) {
                reject(err);
            } else {
                resolve(list);
            }
        });
    });
}

function Commonds(cmd, keys, data) {
    let cmds = [];
    for (let i = 0; i < keys.length; i++) {
        if (data) {
            cmds.push([cmd, keys[i], data]);
        } else {
            cmds.push([cmd, keys[i]]);
        }
    }
    return cmds;
}

function execMultiCommands(cmds) {
    return new Promise((resolve, reject) => {
        client.multi(cmds).exec(function (err, replies) {
            if (err) {
                reject(err);
            } else {
                resolve(replies);
            }
        });
    });
}

function watch(key) {
    return new Promise((resolve, reject) => {
        client.watch(key, function (err, ret) {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function setnx(key, value) {
    return new Promise((resolve, reject) => {
        client.setnx(key, value, function (err, ret) {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

function script(cmd, script) {
    return new Promise((resolve, reject) => {
        client.script(cmd, script, function (err, ret) {
            if (err) {
                reject(err);
            } else {
                resolve(ret);
            }
        });
    });
}

exports.redlockkey = function (k, cb) {
    let key = `${k}_lock`;
    let ttl = 5000;
    return redlock.lock(key, ttl).then(async function (lock) {
        await cb();
        return lock.unlock().then(() => true)
            .catch(function (err) {
                logger.error(key, 'unlock err:', err);
                return false;
            });
    }).catch((err) => {
        logger.error('redlockkey:' + key, err);
        return false
    });
};

const luaScript = {};
luaScript.creatingRoom = {
    path: pomelo.app.getBase() + '/app/db/lua/creatingRoom.lua',
    sha1: '',
};
luaScript.updateRoomInfoSeat = {
    path: pomelo.app.getBase() + '/app/db/lua/updateRoomInfoSeat.lua',
    sha1: ''
};
luaScript.withholding = {
    path: pomelo.app.getBase() + '/app/db/lua/withholding.lua',
    sha1: ''
};

exports.loadluaScript = function (st) {
    return script('load', st).then(ret => ret).catch(err => {
        logger.error('loadluaScript:', err);
        return false;
    });
};

exports.existsluaScript = function (sha) {
    return script('exists', sha).then(ret => ret).catch(err => {
        logger.error('loadluaScript:', err);
        return false;
    });
};

function creatingRoom(roomId) {
    return evalsha(luaScript.creatingRoom.sha1, ['CreatingRooms', roomId]).then(ret => ret).catch((err) => {
        logger.error('creatingRoom:', err);
        return false;
    });
}

exports.creatingRoom = creatingRoom;

function delCreatingRoom(key) {
    return hdel('CreatingRooms', key).then(ret => ret).catch((err) => {
        logger.error('delCreatingRoom:', err);
        return false;
    });
}

exports.delCreatingRoom = delCreatingRoom;

function createRoomInfo(roomId, conf, uuid, serverId) {
    const baseInfo = JSON.stringify(conf);
    const turnInfo = JSON.stringify({});

    const data = {};
    data.uuid = uuid;
    data.base_info = baseInfo;
    data.turn_info = turnInfo;
    data.create_time = Math.ceil(Date.now() / 1000);
    data.current_time = new Date();
    data.id = roomId;
    data.num_of_games = 0;
    data.next_button = 0;
    data.serverId = serverId;

    const key = `Room_${roomId}`;

    return hmset(key, data).then(() => uuid).catch((err) => {
        logger.error('createRoomInfo:', err);
        return false;
    });
}

exports.createRoomInfo = createRoomInfo;

async function updateRoomInfoSeat(roomId, userId, name, headimg, sex,
                                  address = '', online = 1, ip = '',
                                  ready = 0, forced = false, seatIndex = -1) {
    const key = `Room_${roomId}`;
    return evalsha(luaScript.updateRoomInfoSeat.sha1, [key],
        [userId, name, headimg, sex, address, online, ip, ready, forced, seatIndex])
        .then(ret => ret).catch((err) => {
            logger.error('updateRoomInfoSeat:', err);
            return false;
        });
}

exports.updateRoomInfoSeat = updateRoomInfoSeat;


function updateRoomInfoSeats(roomId, seats) {
    const key = `Room_${roomId}`;
    const data = {};
    for (let i = 0; i < seats.length; i += 1) {
        data[`seat_${i}`] = seats[i].userId;
        data[`seat_name_${i}`] = seats[i].name;
        data[`headimg_${i}`] = seats[i].headimg;
        data[`sex_${i}`] = seats[i].sex;
        data[`seat_score_${i}`] = seats[i].score;
        data[`seat_ip_${i}`] = seats[i].ip;
        data[`seat_address_${i}`] = seats[i].address;
        data[`seat_online_${i}`] = seats[i].online;
        data[`seat_ready_${i}`] = seats[i].ready;
    }

    return hmset(key, data).then(() => true).catch((err) => {
        logger.error('updateRoomInfoSeats:', err);
        return false;
    });
}

exports.updateRoomInfoSeats = updateRoomInfoSeats;

async function updateRoomInfo(roomId, d) {
    const key = `Room_${roomId}`;
    const data = d;
    data.current_time = new Date();

    let cmds = Commonds('hmset', [key], data);
    return execMultiCommands(cmds).then(() => true).catch((err) => {
        logger.error('updateRoomInfo:', err);
        return false;
    });
}

exports.updateRoomInfo = updateRoomInfo;

function getRoomInfo(roomId) {
    const key = `Room_${roomId}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getRoomInfo:', err);
        return false;
    });
}

exports.getRoomInfo = getRoomInfo;

async function delRoomInfo(roomId) {
    const key = `Room_${roomId}`;
    let cmds = Commonds('del', [key]);
    return execMultiCommands(cmds).then(() => true).catch((err) => {
        logger.error('delRoomInfo:', err);
        return false;
    });
}

exports.delRoomInfo = delRoomInfo;

function addEmptyRoom(userId, roomId, c) {
    const key = `Empty_Room_${userId}`;
    const data = {};
    const conf = c;
    conf.time = new Date();
    data[roomId] = JSON.stringify(conf);
    return hmset(key, data).then(() => true).catch(() => false);
}

exports.addEmptyRoom = addEmptyRoom;

function delEmtyRoom(userId, roomId) {
    const key = `Empty_Room_${userId}`;
    return hdel(key, roomId).then(() => true).catch(() => false);
}

exports.delEmtyRoom = delEmtyRoom;

function getEmptyRooms(userId) {
    const key = `Empty_Room_${userId}`;
    return hgetall(key).then(ret => ret).catch(() => false);
}

exports.getEmptyRooms = getEmptyRooms;

function delGame(uuid) {
    const key = `Game_${uuid}`;
    return del(key).then(ret => ret).catch((err) => {
        logger.error('delGame', err);
        return false;
    });
}

exports.delGame = delGame;

function createGame(data) {
    const key = `Game_${data.uuid}`;
    const obj = {};
    obj[data.game_index] = JSON.stringify(data);
    return hmset(key, obj).then(() => {
        let time = 86400 * 3;//172800;//三天
        expire(key, time).then(() => {
        }).catch((err) => {
            logger.error('expire', err);
        });
        return true
    }).catch((err) => {
        logger.error('createGame', err);
        return false;
    });
}

exports.createGame = createGame;

function getGames(uuid) {
    const key = `Game_${uuid}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getGames', err);
        return false;
    });
}

exports.getGames = getGames;

function getGameByIndex(uuid, index) {
    const key = `Game_${uuid}`;
    return hmget(key, index).then(ret => ret[0]).catch((err) => {
        logger.error('getGameByIndex', err);
        return false;
    });
}

exports.getGameByIndex = getGameByIndex;

function addHistory(userId, type, data) {
    const key = `History_${userId}_${type}`;
    return lpush(key, JSON.stringify(data)).then(() => true).catch((err) => {
        logger.error('addHistory', err);
        return false;
    });
}

exports.addHistory = addHistory;

function getHistory(userId, type, start, end) {
    const key = `History_${userId}_${type}`;
    if (!com.isNumber(start) || !com.isNumber(end))
        return false;
    return lrange(key, start, end).then(ret => ret).catch((err) => {
        logger.error('getHistory', err);
        return false;
    });
}

exports.getHistory = getHistory;

function checkAndDelRecord(userId, type) {
    const key = `History_${userId}_${type}`;
    return llen(key).then((ret) => {
        if (ret >= 20) {
            return rpop(key);
        }
        return false;
    }).then(ret => JSON.parse(ret)).catch((err) => {
        logger.error('checkAndDelRecord', err);
        return false;
    });
}

exports.checkAndDelRecord = checkAndDelRecord;


exports.incrBigWinerCount = (userId, t) => {
    let key = 'BigWinerCount';
    if (t) key = `${key}_${t}`;
    return hincrby(key, userId, 1).then(() => true).catch(() => false);
};

exports.deleteBigWinerCount = (t) => {
    let key = 'BigWinerCount';
    if (t) key = `${key}_${t}`;
    return del(key).then(() => true).catch(() => false);
};
exports.getBigWinerCount = (userId, t) => {
    let key = 'BigWinerCount';
    if (t) key = `${key}_${t}`;
    return hmget(key, userId).then(ret => ret).catch((err) => {
        logger.error('getBigWinerCount', err);
        return false;
    });
};
exports.getBigWinerCountAll = (t) => {
    let key = 'BigWinerCount';
    if (t) key = `${key}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getBigWinerCountAll', err);
        return false;
    });
};
exports.setBigWinerBoard = (data, t) => {
    let key = 'BigWinerBoard';
    if (t) key = `${key}_${t}`;
    return hmset(key, data).then(() => true).catch(() => false);
};

exports.getBigWinerBoard = (t) => {
    let key = 'BigWinerBoard';
    if (t) key = `${key}_${t}`;
    return hgetall(key).then(ret => ret).catch(() => false);
};
exports.deleteBigWinerBoard = (t) => {
    let key = 'BigWinerBoard';
    if (t) key = `${key}_${t}`;
    return del(key).then(() => true).catch(() => false);
};
//------------------------club start------------------------
exports.getLRangeLen = function (key) {
    return llen(key).then(ret => ret).catch((err => {
        logger.error(key, err);
        return false;
    }));
};
exports.addClubHistory = function (clubId, type, data) {
    const key = `ClubHistory_${clubId}_${type}`;
    return lpush(key, JSON.stringify(data)).then(() => true).catch((err) => {
        logger.error('addClubHistory', err);
        return false;
    });
};
exports.getClubHistory = function (clubId, type, start, end) {
    const key = `ClubHistory_${clubId}_${type}`;
    if (!com.isNumber(start) || !com.isNumber(end))
        return false;
    return lrange(key, start, end).then(ret => ret).catch((err) => {
        logger.error('getClubHistory', err);
        return false;
    });
};
exports.getClubAllHistory = async function (clubId, type) {
    const key = `ClubHistory_${clubId}_${type}`;
    return lrange(key, 0, -1).then(ret => ret).catch((err) => {
        logger.error('getClubAllHistory', err);
        return false;
    });
};
exports.renameClubHistoryToOld = async function (clubId, type) {
    let key = `ClubHistory`;
    let newkey = `ClubOldHistory`;
    if (clubId) {
        key = `${key}_${clubId}_${type}`;
        newkey = `${newkey}_${clubId}_${type}`;
    }
    let flag = await exists(key).then((ret) => {
        return ret
    }).catch((err => {
        logger.error('exists', err);
        return false;
    }));
    if (flag) {
        return rename(key, newkey).then(() => true).catch((err) => {
            logger.error('renameClubHistoryToClubOldHistory', err);
            return false;
        });
    } else {
        return del(newkey).then(() => true).catch((err) => {
            logger.error(`del:${newkey}`, err);
            return false;
        });
    }
};
exports.getClubOldHistory = function (clubId, type, start, end) {
    const key = `ClubOldHistory_${clubId}_${type}`;
    if (!com.isNumber(start) || !com.isNumber(end))
        return false;
    return lrange(key, start, end).then(ret => ret).catch((err) => {
        logger.error('getClubOldHistory', err);
        return false;
    });
};
exports.getClubAllOldHistory = async function (clubId, type) {
    const key = `ClubOldHistory_${clubId}_${type}`;
    return lrange(key, 0, -1).then(ret => ret).catch((err) => {
        logger.error('getClubAllOldHistory', err);
        return false;
    });
};
exports.incrClubBigWinerCount = (userId, clubId, t) => {
    let key = `ClubBigWinerCount`;
    if (clubId) key = `${key}_${clubId}_${t}`;
    return hincrby(key, userId, 1).then(() => true).catch(() => false);
};
exports.getClubBigWinerCountAll = (clubId, t) => {
    let key = 'ClubBigWinerCount';
    if (clubId) key = `${key}_${clubId}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getClubBigWinerCountAll', err);
        return false;
    });
};
exports.renameClubBigWinerCountToOld = async (clubId, t) => {
    let key = `ClubBigWinerCount`;
    let newkey = `ClubOldBigWinerCount`;
    if (clubId) {
        key = `${key}_${clubId}_${t}`;
        newkey = `${newkey}_${clubId}_${t}`;
    }
    let flag = await exists(key).then((ret) => {
        return ret
    }).catch((err => {
        logger.error('exists', err);
        return false;
    }));
    if (flag) {
        return rename(key, newkey).then(() => true).catch((err) => {
            logger.error('renameClubHistoryToClubOldHistory', err);
            return false;
        });
    } else {
        return del(newkey).then(() => true).catch((err) => {
            logger.error(`del:${newkey}`, err);
            return false;
        });
    }
};
exports.getClubOldBigWinerCountAll = (clubId, t) => {
    let key = 'ClubOldBigWinerCount';
    if (clubId) key = `${key}_${clubId}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getClubOldBigWinerCountAll', err);
        return false;
    });
};
exports.incrClubBattleCount = (userId, clubId, t) => {
    let key = 'ClubBattleCount';
    if (clubId) key = `${key}_${clubId}_${t}`;
    return hincrby(key, userId, 1).then(() => true).catch(() => false);
};
exports.getClubBattleCountAll = (clubId, t) => {
    let key = 'ClubBattleCount';
    if (clubId) key = `${key}_${clubId}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getClubBattleCountAll', err);
        return false;
    });
};
exports.renameClubBattleCountToOld = async (clubId, t) => {
    let key = `ClubBattleCount`;
    let newkey = `ClubOldBattleCount`;
    if (clubId) {
        key = `${key}_${clubId}_${t}`;
        newkey = `${newkey}_${clubId}_${t}`;
    }
    let flag = await exists(key).then((ret) => {
        return ret
    }).catch((err => {
        logger.error('exists', err);
        return false;
    }));
    if (flag) {
        return rename(key, newkey).then(() => true).catch((err) => {
            logger.error('renameClubBattleCountToOld', err);
            return false;
        });
    } else {
        return del(newkey).then(() => true).catch((err) => {
            logger.error(`del:${newkey}`, err);
            return false;
        });
    }
};
exports.getClubOldBattleCountAll = (clubId, t) => {
    let key = 'ClubOldBattleCount';
    if (clubId) key = `${key}_${clubId}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getClubOldBattleCountAll', err);
        return false;
    });
};
exports.incrClubBattleMonCount = (userId, clubId, t) => {
    let key = 'ClubBattleMonCount';
    if (clubId) key = `${key}_${clubId}_${t}`;
    return hincrby(key, userId, 1).then(() => true).catch(() => false);
};
exports.getClubBattleMonCountAll = (clubId, t) => {
    let key = 'ClubBattleMonCount';
    if (clubId) key = `${key}_${clubId}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getClubBattleMonCountAll', err);
        return false;
    });
};
exports.renameClubBattleMonCountToOld = async (clubId, t) => {
    let key = `ClubBattleMonCount`;
    let newkey = `ClubOldBattleMonCount`;
    if (clubId) {
        key = `${key}_${clubId}_${t}`;
        newkey = `${newkey}_${clubId}_${t}`;
    }
    let flag = await exists(key).then((ret) => {
        return ret
    }).catch((err => {
        logger.error('exists', err);
        return false;
    }));
    if (flag) {
        return rename(key, newkey).then(() => true).catch((err) => {
            logger.error('renameClubBattleMonCountToOld', err);
            return false;
        });
    } else {
        return del(newkey).then(() => true).catch((err) => {
            logger.error(`del:${newkey}`, err);
            return false;
        });
    }
};
exports.getClubOldBattleMonCountAll = (clubId, t) => {
    let key = 'ClubOldBattleMonCount';
    if (clubId) key = `${key}_${clubId}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getClubOldBattleMonCountAll', err);
        return false;
    });
};
//------------------------club end------------------------


exports.addBanServer = (serverType, serverId) => {
    let key = serverType;
    return sadd(key, serverId).then(() => true).catch(() => false);
};
exports.remBanServer = (serverType, serverId) => {
    let key = serverType;
    return srem(key, serverId).then(() => true).catch(() => false);
};
exports.getBanServers = (serverType) => {
    let key = serverType;
    return smembers(key).then(ret => ret).catch(() => false);
};
exports.checkBanServer = (serverType, serverId) => {
    let key = serverType;
    return sismember(key, serverId).then(ret => ret).catch(() => false);
};

//---------------------测试牌 start----------------
exports.setTestCards = (data, t) => {
    let key = `testCards_${t}`;
    return hmset(key, data).then(() => true).catch(() => false);
};
exports.delTestCards = (t) => {
    let key = `testCards_${t}`;
    return del(key).then(() => true).catch(() => false);
};
exports.getTestCards = (t) => {
    let key = `testCards_${t}`;
    return hgetall(key).then(ret => ret).catch(() => false);
};

//----------------------测试牌 end-------------

function addPhoneCode(phone, code, time) {
    const key = `pc_${phone}`;
    return hmset(key, {time, code}).then(() => true).catch((err) => {
        logger.error('addPhoneCode', err);
        return false;
    });
}

exports.addPhoneCode = addPhoneCode;

function getPhoneCode(phone) {
    const key = `pc_${phone}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getPhoneCode', err);
        return false;
    });
}

exports.getPhoneCode = getPhoneCode;

function delPhoneCode(phone) {
    const key = `pc_${phone}`;
    return del(key).then(() => true).catch((err) => {
        logger.error('delPhoneCode', err);
        return false;
    });
}

exports.delPhoneCode = delPhoneCode;

exports.setRollingNotice = (k, info, beginTime, endTime) => {
    let key = `RollingNotice`;
    let data = {};
    let d = {};
    d.info = info;
    d.beginTime = beginTime;
    d.endTime = endTime;
    data[k] = JSON.stringify(d);
    return hmset(key, data).then(() => true).catch((err) => {
        logger.error('setRollingNotice', err);
        return false;
    });
};
exports.delRollingNotice = (k) => {
    let key = `RollingNotice`;
    return hdel(key, k).then(() => true).catch((err) => {
        logger.error('delRollingNotice', err);
        return false;
    });
};
exports.getRollingNotice = () => {
    let key = `RollingNotice`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getRollingNotices', err);
        return false;
    });
};

//----------------------统计-------------------------------
//登录/活跃/注册
exports.addLoginOrRegister = (key, userId) => {
    return sadd(key, userId).then(() => true).catch((err) => {
        logger.error(err);
        return false;
    });
};
exports.getLoginOrRegister = (key) => {
    return smembers(key).then(ret => ret).catch((err) => {
        logger.error(err);
        return false;
    });
};
exports.renameLoginOrRegisterToNewKey = async (key, newkey) => {
    let flag = await exists(key).then((ret) => {
        return ret
    }).catch((err => {
        logger.error('exists', err);
        return false;
    }));
    if (flag) {
        return rename(key, newkey).then(() => true).catch((err) => {
            logger.error('renameTodayLoginToYesterday', err);
            return false;
        });
    } else {
        return del(newkey).then(() => true).catch((err) => {
            logger.error(`del:${newkey}`, err);
            return false;
        });
    }
};

//房卡消耗
exports.incrCostCount = (key, t, c) =>
    hincrby(key, t, c).then(() => true).catch(() => false);
exports.getCostCount = (key) =>
    hgetall(key).then(ret => ret).catch(() => false);
exports.renameCostCountToNewKey = async (key, newkey) => {
    let flag = await exists(key).then((ret) => {
        return ret
    }).catch((err => {
        logger.error('exists', err);
        return false;
    }));
    if (flag) {
        return rename(key, newkey).then(() => true).catch((err) => {
            logger.error('renameCostCountToNewKey', err);
            return false;
        });
    } else {
        return del(newkey).then(() => true).catch((err) => {
            logger.error(`del:${newkey}`, err);
            return false;
        });
    }
};
exports.setRealTimeCount = (k, d) => {
    let key = 'GameRealTimeCount'; //实时统计
    let data = {};
    data[k] = JSON.stringify(d);
    return hmset(key, data).then(ret => ret).catch(() => false);
};
exports.getRealTimeCount = () => {
    let key = 'GameRealTimeCount'; //实时统计
    return hgetall(key).then(ret => ret).catch(() => false);
};

// 体验俱乐部
exports.addExperienceClub = (clubId, priority) => {
    let key = 'ExperienceClub';
    let data = {};
    data[clubId] = com.isNumber(priority) ? Math.abs(priority) : 0;
    return hmset(key, data).then(() => true).catch(() => false);
};
exports.getAllExperienceClub = () => {
    let key = 'ExperienceClub';
    return hgetall(key).then(ret => ret).catch(() => false);
};
exports.delExperienceClub = (clubId) => {
    let key = 'ExperienceClub';
    return hdel(key, clubId).then(() => true).catch(() => false);
};
// exports.delAllExperienceClub = () => {
//     let key = 'ExperienceClub';
//     return del(key).then(() => true).catch(() => false);
// };

exports.addExperienceAgentList = (userId) => {
    let key = 'ExperienceAgentList';
    return sadd(key, userId).then(ret => ret).catch(() => false);
};
exports.remExperienceAgentList = (userId) => {
    let key = 'ExperienceAgentList';
    return srem(key, userId).then(ret => ret).catch(() => false);
};
exports.getExperienceAgentList = () => {
    let key = 'ExperienceAgentList';
    return smembers(key).then(ret => ret).catch(() => false);
};

exports.addClubChatHistory = (clubId, chat) => {
    let key = `ClubChatHistory_${clubId}`;
    return lpush(key, chat).then(ret => ret).catch(() => false);
};
exports.getClubChatHistory = (clubId, start, end) => {
    let key = `ClubChatHistory_${clubId}`;
    if (!com.isNumber(start) || !com.isNumber(end))
        return false;
    return lrange(key, start, end).then(ret => ret).catch(() => false);
};
exports.checkAndDelClubChatHistory = (clubId) => {
    let key = `ClubChatHistory_${clubId}`;
    return llen(key).then(ret => {
        if (ret >= 50) {
            return rpop(key).then(ret => ret).catch(() => false);
        }
        return false;
    }).catch(() => false);
};
exports.addPersonChatHistory = (userId, chat) => {
    let key = `PersonChatHistory_${userId}`;
    return lpush(key, chat).then(ret => ret).catch(() => false);
};
exports.getPersonChatHistory = (userId, start, end) => {
    let key = `PersonChatHistory_${userId}`;
    if (!com.isNumber(start) || !com.isNumber(end))
        return false;
    return lrange(key, start, end).then(ret => ret).catch(() => false);
};
exports.delPersonChatHistory = (userId) => {
    let key = `PersonChatHistory_${userId}`;
    return del(key).then(ret => ret).catch(() => false);
};

exports.incrWithholding = (userId, type, c) => {
    // let key = `withholding_${userId}`;
    // return evalsha(luaScript.withholding.sha1, [key], [type, c, 1])
    //     .then(ret => ret).catch(() => false);
};
exports.getWithholding = (userId, type) => {
    let key = `withholding_${userId}`;
    return evalsha(luaScript.withholding.sha1, [key], [type, 0, 0])
        .then(ret => ret).catch(() => false);
};

exports.cleanWithholding = async () => {
    let keys = await getkeys('withholding_*').then(ret => ret).catch(() => false);
    if (keys) {
        let cmds = Commonds('del', keys);
        return execMultiCommands(cmds).then(ret => ret).catch(() => false);
    } else {
        return false;
    }
};

exports.addRebate_Recevice_history = (userId, rebate, receiver, t) => {
    let key = `rebate_rec_history_${userId}_${t}`;
    let data = {};
    let now = new Date();
    data.date = now;
    data.rebate = rebate;
    data.receiver = receiver; //被领取者
    return llen(key).then(async ret => {
        if (ret >= 500) {
            await rpop(key).then(ret => ret).catch(() => false);
        }
        return lpush(key, JSON.stringify(data)).then(ret => ret).catch(() => false);
    }).catch(() => false);
};
exports.getRebate_Recevice_history = (userId, t, start, end) => {
    let key = `rebate_rec_history_${userId}_${t}`;
    if (!com.isNumber(start) || !com.isNumber(end))
        return false;
    return lrange(key, start, end).then(ret => ret).catch(() => false);
};

exports.getnewAgent = (date, start, end) => {
    let key = `newagent${date}`;
    return lrange(key, start, end)
        .then(ret => ret).catch(() => false);
};
//----------------------hall game start-----------------
exports.incrHallGameCount = (userId, t) => {
    let key = 'HallGameCount';
    let now = new Date();
    let d = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
    key = `${key}_${d}`;
    if (t) key = `${key}_${t}`;
    return hincrby(key, userId, 1).then((ret) => {
        let time = 86400 * 7;//86400;//一周
        expire(key, time).then(() => {
        }).catch((err) => {
            logger.error('expire', err);
        });
        return ret;
    }).catch(() => false);
};
exports.getHallGameCount = (userId, t, date) => {
    let key = 'HallGameCount';
    let now = new Date();
    let d = date || `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
    key = `${key}_${d}`;
    if (t) key = `${key}_${t}`;
    return hmget(key, userId).then(ret => ret).catch((err) => {
        logger.error('getHallGameCount', err);
        return false;
    });
};
exports.getHallGameCountAll = (t, date) => {
    let key = 'HallGameCount';
    let now = new Date();
    let d = date || `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
    key = `${key}_${d}`;
    if (t) key = `${key}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getHallGameCountAll', err);
        return false;
    });
};
exports.incrHallGameWinerCount = (userId, t) => {
    let key = 'HallGameWinerCount';
    let now = new Date();
    let d = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
    key = `${key}_${d}`;
    if (t) key = `${key}_${t}`;
    return hincrby(key, userId, 1).then((ret) => {
        let time = 86400 * 7;//86400;//一周
        expire(key, time).then(() => {
        }).catch((err) => {
            logger.error('expire', err);
        });
        return ret;
    }).catch(() => false);
};
exports.getHallGameWinerCount = (userId, t, date) => {
    let key = 'HallGameWinerCount';
    let now = new Date();
    let d = date || `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
    key = `${key}_${d}`;
    if (t) key = `${key}_${t}`;
    return hmget(key, userId).then(ret => ret).catch((err) => {
        logger.error('getHallGameWinerCount', err);
        return false;
    });
};
exports.getHallGameWinerCountAll = (t, date) => {
    let key = 'HallGameWinerCount';
    let now = new Date();
    let d = date || `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
    key = `${key}_${d}`;
    if (t) key = `${key}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getHallGameWinerCountAll', err);
        return false;
    });
};
exports.setHallGameWiner = (userId, t) => {
    let key = 'HallGameWiner';
    let now = new Date();
    let d = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
    key = `${key}_${d}`;
    if (t) key = `${key}_${t}`;
    let data = {};
    data.userId = userId;
    data.time = now.getTime();
    return setnx(key, JSON.stringify(data)).then((ret) => {
        let time = 86400 * 7;//86400;//一周
        expire(key, time).then(() => {
        }).catch((err) => {
            logger.error('expire', err);
        });
        return ret;
    }).catch(() => false);
};
exports.getHallGameWiner = (t, date) => {
    let key = 'HallGameWiner';
    let now = new Date();
    let d = date || `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
    key = `${key}_${d}`;
    if (t) key = `${key}_${t}`;
    return get(key).then(ret => ret).catch(() => false);
};
exports.addHallGameWinerReward = (userId, gems_before, gems_after) => {
    let key = 'HallGameWinerReward';
    let now = new Date();
    let date = now.getTime();
    let data = {};
    data.userId = userId;
    data.gems_before = gems_before;
    data.gems_after = gems_after;
    data.time = date;
    return lpush(key, JSON.stringify(data)).then(ret => ret).catch(() => false);
};
exports.getHallGameWinerReward = (start, end) => {
    let key = 'HallGameWinerReward';
    return lrange(key, start, end).then(ret => ret).catch(() => false);
};

exports.addHallGameHistory = function (userId, hallId, data) {
    const key = `HallGameHistory_${userId}_${hallId}`;
    return lpush(key, JSON.stringify(data)).then(() => true).catch((err) => {
        logger.error('addHallGameHistory', err);
        return false;
    });
};
exports.getHallGameHistory = function (userId, hallId, start, end) {
    const key = `HallGameHistory_${userId}_${hallId}`;
    if (!com.isNumber(start) || !com.isNumber(end))
        return false;
    return lrange(key, start, end).then(ret => ret).catch((err) => {
        logger.error('getHallGameHistory', err);
        return false;
    });
};

//----------------------hall game end-----------------


exports.clearKeys = async (prefix) => {
    let keys = await getkeys(prefix + '*').then(ret => ret).catch(() => false);
    if (keys) {
        let cmds = Commonds('del', keys);
        return execMultiCommands(cmds).then(ret => ret).catch(() => false);
    } else {
        return false;
    }
};