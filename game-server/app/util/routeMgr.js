const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const pomelo = require('pomelo');
const codeConfig = require('../../../shared/codeConfig');

const code = codeConfig.retCode;

exports.gameRoute = async function (session, msg, app, cb) {
    const rdb = app.get('rdclient');
    var gameServers = app.getServersByType('game');
    let serverId = gameServers[0].id;
    let userServerId = session.get('gameServerId');
    logger.debug(`uid:${session.uid},gameRoute start userServerId:${userServerId}`);
    if (userServerId) {
        serverId = userServerId;
        cb(null, serverId);
    } else {
        let roomId = session.get('roomId');
        let roomInfo = await rdb.getRoomInfo(roomId);
        serverId = roomInfo ? roomInfo.serverId : null;
        if (!serverId) {
            logger.error('gameServers' + JSON.stringify(gameServers));
            logger.error(`uid:${session.uid},没有可用的游戏服务器,roomid:${session.get('roomId')},roomInfo.serverId:${serverId}`);
            cb(new Error('找不到房卡游戏服务器'));
            return;
        }
        session.set('gameServerId', serverId);
        session.pushAll(function () {
            cb(null, serverId);
        });
    }
    logger.debug(`uid:${session.uid},gameRoute end gameServerId:${serverId}`);

};

exports.hallGameRoute = async function (session, msg, app, cb) {
    let uid = session.uid;
    const mdb = app.get('mdclient');
    const hallGameServers = app.getServersByType('hallgame');
    let hallGamehallId = session.get('hallGamehallId');
    let hallServerId;
    if (!hallGamehallId) {
        let user = await mdb.get_user_hallGamehallId_by_userid(uid);
        hallGamehallId = user.hallGamehallId;
    }
    for (let i = 0; i < hallGameServers.length; i++) {
        let server = hallGameServers[i];
        if (server.wanfa == hallGamehallId) {
            hallServerId = server.id;
            break;
        }
    }
    if (hallServerId) {
        cb(null, hallServerId);
    } else {
        logger.error('hallGameServers' + JSON.stringify(hallGameServers));
        logger.error(`uid:${uid},没有可用的大厅游戏服务器,hallGamehallId:${hallGamehallId}`);
        cb(new Error('找不到大厅游戏服务器'));
    }

};