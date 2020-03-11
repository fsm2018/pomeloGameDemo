const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const codeConfig = require('../../../../../shared/codeConfig');

module.exports = function (app) {
    return new Cron(app);
};

var Cron = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.channelUtil = app.get('channelUtil');
    this.channelService = app.get('channelService');
    this.clubMgr = app.clubMgr;
};

Cron.prototype.loadAllClubInfo = function () {
    this.clubMgr.loadAllClubInfo();
};

//{"id": 2, "time": "0 * * * * *", "action": "clubCron.checkClubtime"}
Cron.prototype.checkClubtime = function () {
    for (let clubId in this.clubMgr.clubInfos) {
        if (this.clubMgr.clubInfos.hasOwnProperty(clubId)) {
            let club = this.clubMgr.clubInfos[clubId];
            if (!club.open_time || !club.close_time)
                continue;
            let club_open_times = club.open_time.split(':');
            let club_close_times = club.close_time.split(':');
            let now = new Date();
            if (now >= club.rel_open_time) {
                if (club.opening === 0) {
                    this.clubMgr.set_opening(clubId,1);
                    this.mdb.update_club_opening_by_clubid(clubId, 1);
                    let channelname = this.channelUtil.getClubChannelName(clubId);
                    let channel = this.channelService.getChannel(channelname);
                    if (channel) {
                        channel.pushMessage('tableStateClubNotify', {
                            clubId,
                            opening: 1
                        });
                    }
                    let nextTime = new Date();
                    nextTime.setDate(now.getDate() + 1);
                    nextTime.setHours(parseInt(club_open_times[0], 10));
                    nextTime.setMinutes(parseInt(club_open_times[1], 10));
                    nextTime.setSeconds(0);
                    this.clubMgr.set_rel_open_time(clubId,nextTime);
                    this.mdb.update_club_rel_open_time_by_clubid(clubId, club.rel_open_time);

                    let tempTime = new Date();
                    tempTime.setHours(club_close_times[0]);
                    tempTime.setMinutes(club_close_times[1]);
                    tempTime.setSeconds(-1);
                    tempTime.setMilliseconds(0);
                    if (now < tempTime) {
                    } else {
                        tempTime.setDate(now.getDate() + 1);
                    }
                    this.clubMgr.set_rel_close_time(clubId,tempTime);
                    this.mdb.update_club_rel_close_time_by_clubid(clubId, club.rel_close_time);
                }
            }
            if (now > club.rel_close_time) {
                if (club.opening === 1) {
                    this.clubMgr.set_opening(clubId,0);
                    this.mdb.update_club_opening_by_clubid(clubId, 0);
                    let channelname = this.channelUtil.getClubChannelName(clubId);
                    let channel = this.channelService.getChannel(channelname);
                    if (channel) {
                        channel.pushMessage('tableStateClubNotify', {
                            clubId,
                            opening: 0
                        });
                    }

                    let nextTime = new Date();
                    nextTime.setDate(now.getDate() + 1);
                    nextTime.setHours(parseInt(club_close_times[0], 10));
                    nextTime.setMinutes(parseInt(club_close_times[1], 10));
                    nextTime.setSeconds(-1);
                    this.clubMgr.set_rel_close_time(clubId,nextTime);
                    this.mdb.update_club_rel_close_time_by_clubid(clubId, club.rel_close_time);

                    let tempTime = new Date();
                    tempTime.setHours(club_open_times[0]);
                    tempTime.setMinutes(club_open_times[1]);
                    tempTime.setSeconds(0);
                    tempTime.setMilliseconds(0);
                    if (now < tempTime) {
                    } else {
                        tempTime.setDate(now.getDate() + 1);
                    }
                    this.clubMgr.set_rel_open_time(clubId,tempTime);
                    this.mdb.update_club_rel_open_time_by_clubid(clubId, club.rel_open_time);
                }
            }
        }
    }
};
