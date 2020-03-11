const pomelo = require('pomelo');
const status = require('pomelo-status-plugin');
const globalChannel = require('pomelo-globalchannel-plugin');
const logger = require('pomelo-logger').getLogger('m-debug', __filename);

const watchUtils = require('./app/util/watchUtils');
const frontFilter = require('./app/util/frontFilter');
const backFilter = require('./app/util/backFilter');
const gameFilter = require('./app/servers/game/filter/gameFilter');

const channelUtil = require('./app/util/channelUtil');
const routeMgr = require('./app/util/routeMgr');
const blackList = require('./app/util/blackList');

const errorHandler = require('./app/util/errorHandler');

const roomMgr = require('./app/domain/game/room/private/roomMgr');
const gameMgr = require('./app/domain/game/room/private/gameMgr');

const roomMgr_hallgame = require('./app/domain/game/room/public/roomMgr');
const gameMgr_hallgame = require('./app/domain/game/room/public/gameMgr');

const ClubMgr = require('./app/domain/club/clubMgr');

const codeConfig = require('../shared/codeConfig');

const fs = require('fs');

/**
 * Init app for client.
 */
const AppName = 'HSGAME';
const app = pomelo.createApp();
app.set('name', AppName);

// app configuration
app.configure('production|development|test', function () {

    app.loadConfig('ServerStateInfo', app.getBase() + '/../shared/config/ServerStateInfo.json');
    watchUtils.watchFile(app.getBase() + '/../shared/config/ServerStateInfo.json', function () {
        fs.readFile(app.getBase() + '/../shared/config/ServerStateInfo.json', 'utf8', function (err, data) {
            if (!err) {
                try {
                    app.set('ServerStateInfo', JSON.parse(data)[app.env]);
                } catch (e) {
                    logger.error(`set ServerStateInfo fail:${e}`);
                }
            } else {
                logger.error(`readFile ServerStateInfo fail:${err}`);
            }
        });
    });

    app.loadConfig('mongodb', app.getBase() + '/../shared/config/mongodb.json');
    const mdclient = require('./app/db/mongoose_db');
    mdclient.init(app);
    app.set('mdclient', mdclient);
    const MongodbConfigs = app.get('mongodb');

    app.loadConfig('redis', app.getBase() + '/../shared/config/redis.json');
    const rdclient = require('./app/db/redis_db');
    rdclient.init(app);
    app.set('rdclient', rdclient);
    const RedisConfigs = app.get('redis');

    const env = app.get('env');
    const serverType = app.serverType;
    if (serverType == 'master') {
        rdclient.cleanWithholding();
    }
    let statusConf = {};
    let globalChannelConf = {};
    if (env == 'development' || env == 'test') {
        statusConf = {
            host: RedisConfigs.host,
            port: RedisConfigs.port,
            cleanOnStartUp: serverType == 'master',
            db: RedisConfigs.options.db,
            prefix: `${AppName}:STATUS`
        };
        globalChannelConf = {
            host: RedisConfigs.host,
            port: RedisConfigs.port,
            cleanOnStartUp: serverType == 'master',
            db: RedisConfigs.options.db,
            prefix: `${AppName}:CHANNEL`
        };
    } else if (env === 'production') {
        statusConf = {
            host: RedisConfigs.host,
            port: RedisConfigs.port,
            cleanOnStartUp: serverType == 'master',
            db: RedisConfigs.options.db,
            auth_pass: RedisConfigs.options.password,
            prefix: `${AppName}:STATUS`
        };
        globalChannelConf = {
            host: RedisConfigs.host,
            port: RedisConfigs.port,
            cleanOnStartUp: serverType == 'master',
            db: RedisConfigs.options.db,
            auth_pass: RedisConfigs.options.password,
            prefix: `${AppName}:CHANNEL`
        };
        //     app.set('ssh_config_params', ['-p 1214']);
    }

    app.use(status, {
        status: statusConf
    });
    app.use(globalChannel, {
        globalChannel: globalChannelConf
    });

    app.set('channelUtil', channelUtil);

    //待验证
    // app.set('proxyConfig', {
    //     timeout: 1000 * 20
    // });

    app.set('errorHandler', errorHandler);

    app.route('game', routeMgr.gameRoute);
    app.route('hallgame', routeMgr.hallGameRoute);
    app.blackList = blackList;
    app.blackList.init(app);

    // app.filter(pomelo.filters.serial());
});
app.configure('production|development|test', 'gate|connector', function () {
    app.filter(frontFilter(app));

    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            useDict: true,
            useProtobuf: true,
            // useHostFilter: true,
            // blacklistFun: blackList.blackListFun,
            // useCrypto:true,
            // heartbeat : 3,
        });
});
app.configure('production|development|test', 'connector', function () {
    setInterval(function () {
        let s = app.components.__connection__;
        let c = s.getStatisticsInfo();
        app.get('rdclient').setRealTimeCount(`${app.serverId}`, {logined: c.loginedCount});
    }, 30000);
});
app.configure('production|development|test', 'hall', function () {
    app.filter(backFilter(app));

    app.loadConfig('gameConfigs', app.getBase() + '/../shared/config/gameConfigs.json');
    watchUtils.watchFile(app.getBase() + '/../shared/config/gameConfigs.json', function () {
        fs.readFile(app.getBase() + '/../shared/config/gameConfigs.json', 'utf8', function (err, data) {
            if (!err) {
                try {
                    app.set('gameConfigs', JSON.parse(data)[app.env]);
                } catch (e) {
                    logger.error(`set gameConfigs fail:${e}`);
                }
            } else {
                logger.error(`readFile gameConfigs fail:${err}`);
            }
        });
    });


    app.loadConfig('hallGameConfigs', app.getBase() + '/../shared/config/hallGameConfigs.json');
    watchUtils.watchFile(app.getBase() + '/../shared/config/hallGameConfigs.json', function () {
        fs.readFile(app.getBase() + '/../shared/config/hallGameConfigs.json', 'utf8', function (err, data) {
            if (!err) {
                try {
                    app.set('hallGameConfigs', JSON.parse(data)[app.env]);
                } catch (e) {
                    logger.error(`set hallGameConfigs fail:${e}`);
                }
            } else {
                logger.error(`readFile hallGameConfigs fail:${err}`);
            }
        });
    });
});
app.configure('production|development|test', 'game', function () {
    app.filter(backFilter(app));

    app.filter(gameFilter(app));
    app.roomMgr = roomMgr;
    app.gameMgr = gameMgr;

    app.roomMgr.init(app.gameMgr);
    app.gameMgr.init(app.roomMgr);

    app.loadConfig('gameConfigs', app.getBase() + '/../shared/config/gameConfigs.json');
    watchUtils.watchFile(app.getBase() + '/../shared/config/gameConfigs.json', function () {
        fs.readFile(app.getBase() + '/../shared/config/gameConfigs.json', 'utf8', function (err, data) {
            if (!err) {
                try {
                    app.set('gameConfigs', JSON.parse(data)[app.env]);
                } catch (e) {
                    logger.error(`set gameConfigs fail:${e}`);
                }
            } else {
                logger.error(`readFile gameConfigs fail:${err}`);
            }
        });
    });

    setInterval(function () {
        let games = app.gameMgr.getGames();
        let mj_hz2_games = 0;
        let mj_hz4_games = 0;
        let dbuckle_hz4_games = 0;
        let mj_hz_pushing_games = 0;
        let mj_hz_pushing_games_ma = 0;
        for (let id in games) {
            let game = games[id];
            if (game.game.isPlaying) {
                if (game.game.conf.gametype === codeConfig.gameType.mj_hz) {
                    if (game.max === 2) {
                        mj_hz2_games++;
                    } else if (game.max === 4) {
                        mj_hz4_games++;
                    }
                } else if (game.game.conf.gametype === codeConfig.gameType.d_buckle_hz) {
                    if (game.max === 4) {
                        dbuckle_hz4_games++;
                    }
                } else if (game.game.conf.gametype === codeConfig.gameType.pushing_hz) {
                    if (game.wanfa % 4300 == 2 || game.wanfa % 4400 == 2) {
                        mj_hz_pushing_games_ma++;
                    } else {
                        mj_hz_pushing_games++;
                    }
                }
            }
        }
        if (app.curServer.gametype == codeConfig.gameType.mj_hz) {
            app.get('rdclient').setRealTimeCount(`${app.serverId}`,
                {mj_hz2_games, mj_hz4_games});
        } else if (app.curServer.gametype == codeConfig.gameType.d_buckle_hz) {
            app.get('rdclient').setRealTimeCount(`${app.serverId}`,
                {dbuckle_hz4_games});
        } else if (app.curServer.gametype == codeConfig.gameType.pushing_hz) {
            app.get('rdclient').setRealTimeCount(`${app.serverId}`,
                {mj_hz_pushing_games, mj_hz_pushing_games_ma});
        }
    }, 30000);
});
app.configure('production|development|test', 'chat', function () {
    app.filter(backFilter(app));

});
app.configure('production|development|test', 'club', function () {
    app.filter(backFilter(app));

    app.clubMgr = new ClubMgr();
    app.clubMgr.loadAllClubInfo();

    app.loadConfig('clubConfigs', app.getBase() + '/../shared/config/clubConfigs.json');
    watchUtils.watchFile(app.getBase() + '/../shared/config/clubConfigs.json', function () {
        fs.readFile(app.getBase() + '/../shared/config/clubConfigs.json', 'utf8', function (err, data) {
            if (!err) {
                try {
                    app.set('clubConfigs', JSON.parse(data)[app.env]);
                } catch (e) {
                    logger.error(`set clubConfigs fail:${e}`);
                }
            } else {
                logger.error(`readFile clubConfigs fail:${err}`);
            }
        });
    });
});
app.configure('production|development|test', 'gm', function () {
    app.filter(backFilter(app));

    app.loadConfig('clubConfigs', app.getBase() + '/../shared/config/clubConfigs.json');
    watchUtils.watchFile(app.getBase() + '/../shared/config/clubConfigs.json', function () {
        fs.readFile(app.getBase() + '/../shared/config/clubConfigs.json', 'utf8', function (err, data) {
            if (!err) {
                try {
                    app.set('clubConfigs', JSON.parse(data)[app.env]);
                } catch (e) {
                    logger.error(`set clubConfigs fail:${e}`);
                }
            } else {
                logger.error(`readFile clubConfigs fail:${err}`);
            }
        });
    });
});

// start app
app.start();

process.on('uncaughtException', function (err) {
    console.error(' Caught exception: ' + err.stack);
});
