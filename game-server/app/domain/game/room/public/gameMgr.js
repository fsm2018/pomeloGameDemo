const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const pomelo = require('pomelo');
const codeConfig = require('../../../../../../shared/codeConfig');
let roomMgr;

let test = {};

const games = {};
const gameMod_dbuckle_hz = require('../../double_buckle/hz/db_bk_hz');

exports.getGames = function () {
    return games;
};

function getGameByUserID(userId) {
    const roomId = roomMgr.getUserRoomId(userId);
    if (roomId == null) {
        return null;
    }
    const game = games[roomId];
    return game;
}

exports.getGameByUserID = getGameByUserID;

function getGameByRoomID(roomId) {
    if (!games[roomId]) {
        return false;
    }

    return games[roomId];
}

exports.getGameByRoomID = getGameByRoomID;

function deleteGame(roomId) {
    if (!games[roomId]) {
        return false;
    }

    delete games[roomId];
}

exports.deleteGame = deleteGame;

function createNewGame(roomInfo) {
    let game = null;
    if (roomInfo.conf.gametype === codeConfig.gameType.mj_hz) {
        game = new gameMod_mj_hz(roomInfo);
    } else if (roomInfo.conf.gametype === codeConfig.gameType.d_buckle_hz) {
        game = new gameMod_dbuckle_hz(roomInfo);
    } else if (roomInfo.conf.gametype === codeConfig.gameType.pushing_hz) {
        game = new gameMod_pushing_hz(roomInfo);
    }

    if (game === null) {
        return false;
    }
    games[roomInfo.id] = game;
    return game;
}

function checkAndCreateGame(roomInfo) {
    const game = getGameByRoomID(roomInfo.id);
    if (!game) {
        return createNewGame(roomInfo);
    }
    return game;
}

exports.checkAndCreateGame = checkAndCreateGame;

async function startGame(roomInfo) {
    const game = getGameByRoomID(roomInfo.id);
    if (game) {
        // 初始化一局游戏
        const testData = {};
        let env = pomelo.app.get('env');
        if (env != 'production') {
            if (roomInfo.conf.gametype === codeConfig.gameType.mj_hz ||
                roomInfo.conf.gametype == codeConfig.gameType.pushing_hz) {
                testData.testCards = await test.getMJTestCard(roomInfo.conf);
            } else if (roomInfo.conf.gametype === codeConfig.gameType.d_buckle_hz) {
                testData.testCards = await test.getDBuckleTestCard();
            }
        }
        roomInfo.exchanges = {};
        try {
            let ret;
            if (game.game.roomInfo.numOfGames > 0) {
                ret = await game.again(testData);
            } else {
                ret = await game.begin(testData);
            }
            return ret;
        } catch (error) {
            logger.error('startGame err:', error);
            return false;
        }
    } else {
        return null;
    }
}

exports.isGameRunning = (roomId) => {
    const game = getGameByRoomID(roomId);
    if (game) {
        return game.game.isPlaying;
    }
    return false;
};

function stopGame(roomId) {
    const game = getGameByRoomID(roomId);
    if (game) {
        game.game.isPlaying = false;
    }
}

exports.stopGame = stopGame;

exports.setReady = async function (userId, ready) {
    const roomInfo = roomMgr.getUserRoomInfo(userId);
    if (roomInfo == null) {
        return -1;
    }

    await roomMgr.setReady(userId, ready);

    let game = getGameByUserID(userId);
    if (!game) {
        game = checkAndCreateGame(roomInfo);
    }

    if (!game.game.isPlaying) {
        for (let i = 0; i < roomInfo.seats.length; ++i) {
            const s = roomInfo.seats[i];
            if (s.userId <= 0 || s.ready === 0) {
                return game;
            }
        }

        let delay = 500;
        if (roomInfo.numOfGames == 0) {
            // delay = 3000;
        }

        // 人到齐了，并且都准备好了，则开始新的一局
        game.game.isPlaying = true;
        setTimeout(async () => {
            const ret = await startGame(roomInfo);
            if (!ret) {
                logger.error(`游戏开始失败:[${roomInfo.id}]`);
                game.game.isPlaying = false;
                roomMgr.destroy(roomInfo.id);
            }
        }, delay);

        return game;
    } else {
        // try {
        //     if (game.sync(userId)) return game;
        // } catch (error) {
        //     console.log(error);
        //     return false;
        // }
        // return false;
        logger.error(roomInfo.id + '游戏已经开始，玩家还没准备吗？' + userId);
    }
};

exports.init = function (roommgr) {
    roomMgr = roommgr;
    try {
        test = require('../testLogic');
    } catch (error) {
        console.log('testLogic', error);
    }
};
