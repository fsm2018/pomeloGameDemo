const logger = require('pomelo-logger').getLogger('m-debug',__filename);
module.exports = function (app) {
    return new Remote(app);
};
var Remote = function (app) {
    this.app = app;
    this.channelService = app.get('channelService');
    this.channelUtil = app.get('channelUtil');
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.clubMgr = app.clubMgr;
};

Remote.prototype.logoutClub = function (uid, clubId, cb) {
    let channelname = this.channelUtil.getClubChannelName(clubId);
    let channel = this.channelService.getChannel(channelname);
    this.channelUtil.leaveChannel(channel, uid);
    cb();
};
Remote.prototype.addClub = function (clubId, club, cb) {
    this.clubMgr.add_club(clubId, club);
    cb();
};
Remote.prototype.tableClubNotify = function (data, cb) {
    let channelname = this.channelUtil.getClubChannelName(data.clubId);
    let channel = this.channelService.getChannel(channelname);
    if (channel) {
        channel.pushMessage('tableClubNotify',
            data, function (err) {
                if (err)
                    logger.error(err);
            });
    }
    cb();
};
Remote.prototype.tableDissolveClubNotify = function (data, cb) {
    let clubId = data.clubId;
    let channelname = this.app.get('channelUtil').getClubChannelName(clubId);
    let channel = this.channelService.getChannel(channelname);
    if (channel) {
        channel.pushMessage('tableDissolveClubNotify',
            data, function (err) {
                if (err)
                    logger.error(err);
            });
    }
    cb();
};
Remote.prototype.tableEnterClubNotify = function (data, cb) {
    let clubId = data.clubId;
    let channelname = this.channelUtil.getClubChannelName(clubId);
    let channel = this.channelService.getChannel(channelname);
    if (channel) {
        channel.pushMessage('tableEnterClubNotify',
            data, function (err) {
                if (err)
                    logger.error(err);
            });
    }
    cb();
};
Remote.prototype.tableExitClubNotify = function (data, cb) {
    let clubId = data.clubId;
    let channelname = this.channelUtil.getClubChannelName(clubId);
    let channel = this.channelService.getChannel(channelname);
    if (channel) {
        channel.pushMessage('tableExitClubNotify',
            data, function (err) {
                if (err)
                    logger.error(err);
            });
    }
    cb();
};
Remote.prototype.onlineState = function (data, cb) {
    let clubId = data.clubId;
    let channelname = this.channelUtil.getClubChannelName(clubId);
    let channel = this.channelService.getChannel(channelname);
    if (channel) {
        channel.pushMessage('onlineState',
            data, function (err) {
                if (err)
                    logger.error(err);
            });
    }
    cb();
};
Remote.prototype.gameReady = function (data, cb) {
    let clubId = data.clubId;
    let channel = this.channelService.getChannel(this.channelUtil.getClubChannelName(clubId));
    if (channel) {
        channel.pushMessage('gameReady', data);
    }
    cb();
};
Remote.prototype.pushMessageByClubId = function (route, clubId, data, cb) {
    let channelname = this.channelUtil.getClubChannelName(clubId);
    let channel = this.channelService.getChannel(channelname);
    if (channel) {
        channel.pushMessage(route,
            data, function (err) {
                if (err)
                    logger.error(err);
            });
    }
    cb();
};
