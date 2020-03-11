const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const httpUtil = require('../../../util/httpUtil');
const codeConfig = require('../../../../../shared/codeConfig');

const code = codeConfig.retCode;


module.exports = function (app) {
    return new Handler(app);
};
var Handler = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
    this.channelUtil = app.get('channelUtil');
    this.channelService = app.get('channelService');
    this.statusService = app.get('statusService');
    this.clubMgr = app.clubMgr;
};
Handler.prototype.loginClub = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let clubInfo = await this.mdb.get_club_Info_by_clubid(clubId);
    if (clubInfo) {
        if (uid === clubInfo.ownerid || clubInfo.members.indexOf(uid) !== -1) {
            let fsid = session.frontendId;
            let oldClubId = session.get('clubId');
            if (oldClubId) {
                let oldchannelname = this.channelUtil.getClubChannelName(oldClubId);
                let oldchannel = this.channelService.getChannel(oldchannelname);
                this.channelUtil.leaveChannel(oldchannel, uid);
                self.app.rpc.chat.chatRemote.leaveClub(session, uid, clubId, function () {
                });
            }
            let channelname = this.channelUtil.getClubChannelName(clubId);
            let channel = this.channelService.getChannel(channelname, true);
            this.channelUtil.addmember(channel, uid, fsid);
            self.app.rpc.chat.chatRemote.addClub(session, uid, fsid, clubId, function () {
            });
            session.set('clubId', clubId);
            session.pushAll(function () {
                next(null, {code: code.OK, data: {}});
            });
        } else {
            next(null, {code: code.CLUB.NOT_CLUB_MEMBER, msg: '你不是该牌友圈的成员'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '该牌友圈不存在'});
    }
};
Handler.prototype.logoutClub = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubId = session.get('clubId');
    let fsid = session.frontendId;
    let channelname = this.channelUtil.getClubChannelName(clubId);
    let channel = this.channelService.getChannel(channelname);
    this.channelUtil.leaveChannel(channel, uid);
    self.app.rpc.chat.chatRemote.leaveClub(session, uid, clubId, function () {
    });
    session.set('clubId', "");
    next(null, {code: code.OK, data: {}});
};
Handler.prototype.getUserInvitation = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubs = await this.mdb.get_user_req_clubs_by_userid(uid);
    next(null, {code: code.OK, data: {clubs: clubs.req_clubs}});
};
Handler.prototype.optUserInvitation = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let agree = msg.agree === 1 ? 1 : 0;
    let clubId = msg.clubId;
    let clubs = await this.mdb.get_user_req_clubs_by_userid(uid);
    if (clubs.req_clubs.indexOf(clubId) === -1) {
        next(null, {code: code.FAIL, msg: '没有该圈子的邀请'});
        return;
    }
    let ret = await this.mdb.del_user_req_clubs_by_userid(uid, clubId);
    if (session.get('agent_level') < 100) {
        let userClubs = await this.mdb.get_user_all_clubs_by_userid(uid);
        let allClubs = userClubs.myclubs.concat(userClubs.clubs);
        let clubs_limit = this.app.get('clubConfigs').clubs_limit;
        if (allClubs.length >= clubs_limit) {
            next(null, {code: code.CLUB.LIMIT_CLUBS, data: {requests: ret.req_clubs}, msg: '圈子数量达到上限,加入失败'});
            return;
        }
    }
    if (agree === 0) {
        next(null, {code: code.OK, data: {requests: ret.req_clubs}});
        return;
    } else if (agree === 1) {
        let user = await this.mdb.add_user_clubs_by_userid(uid, clubId);
        if (!user || user.clubs.indexOf(clubId) === -1) {
            await this.mdb.add_user_req_clubs_by_userid(uid, clubId);
            next(null, {code: code.FAIL, msg: '加入圈子失败'});
            return;
        }
        let club = await this.mdb.add_club_members(clubId, uid);
        if (club && club.members.indexOf(uid) !== -1) {
            let username = session.get('name');
            let channelname = this.channelUtil.getClubChannelName(club.clubid);
            let channel = this.channelService.getChannel(channelname);
            let info = `${username}(ID:${uid})加入牌友圈`;
            await this.mdb.add_club_infos_limit(club.clubid, info);
            if (channel) {
                channel.pushMessage('clubDynamicNotify',
                    {
                        clubId: club.clubid,
                        userId: uid,
                        state: 1,
                        info,
                    }, function (err) {
                        if (err)
                            logger.error(err);
                    });
            }
            next(null, {code: code.OK, data: {clubId: club.clubid, requests: ret.req_clubs}});
        } else {
            await this.mdb.add_user_req_clubs_by_userid(uid, clubId);
            await this.mdb.del_user_clubs_by_userid(uid, clubId);
            next(null, {code: code.FAIL, msg: '加入圈子失败'});
        }
        return;
    }
    next(null, {code: code.FAIL, msg: '参数错误'});
};
Handler.prototype.joinExperienceClub = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let user = await this.mdb.get_user_data_by_userid(uid);

    let ExperienceClub = await this.rdb.getAllExperienceClub();
    if (!ExperienceClub || ExperienceClub.length <= 0) {
        next(null, {code: code.FAIL, msg: '管理员还没有添加体验俱乐部'});
        return;
    }
    let ExperienceClubIds = Object.keys(ExperienceClub);
    let eclubs = user.clubs.filter(function (clubId) {
        return ExperienceClubIds.indexOf(clubId) !== -1;
    });
    let eclubs2 = user.myclubs.filter(function (clubId) {
        return ExperienceClubIds.indexOf(clubId) !== -1;
    });
    eclubs = eclubs.concat(eclubs2);
    if (eclubs && eclubs > 0) {
        next(null, {code: code.CLUB.HAD_ECLUB, data: {eclubs}, msg: '你已经在体验俱乐部了,\n不需要再次加入'});
        return;
    }
    if (user.qualification_eclub === 0) {
        next(null, {code: code.FAIL, msg: '你已经是老用户了,\n体验机会留给新人吧'});
        return;
    }

    ExperienceClub = ExperienceClubIds.sort(function (a, b) {
        return ExperienceClub[a] - ExperienceClub[b]
    });
    let clubInfo;
    let i = 0;
    let join = false;
    while (i < ExperienceClub.length) {
        let clubId = ExperienceClub[i];
        clubInfo = await this.mdb.get_club_Info_by_clubid(clubId);
        if (clubInfo && clubInfo.type === 0 && clubInfo.members.length < clubInfo.members_max && clubInfo.ownerid !== uid) {
            let ret = await this.mdb.add_club_members(clubInfo.clubid, uid);
            if (ret) {
                let ret1 = await this.mdb.add_user_clubs_by_userid(uid, clubInfo.clubid);
                if (ret1) {
                    join = true;
                    break;
                } else {
                    let ret2 = await this.mdb.del_club_members(clubInfo.clubid, uid);
                    if (!ret2) {
                        logger.error(`joinExperienceClub回滚数据失败:clubid:${clubInfo.clubid},userid:${uid}`);
                        next(null, {code: code.FAIL, msg: '加入体验俱乐部失败,数据错误'});
                        return;
                    }
                }
            }
        }
        i++;
    }
    if (!join) {
        next(null, {code: code.FAIL, msg: '没有可加入的体验俱乐部'});
        return;
    }
    next(null, {code: code.OK, data: {clubId: clubInfo.clubid}});
    let channelname = this.channelUtil.getClubChannelName(clubInfo.clubid);
    let channel = this.channelService.getChannel(channelname);
    let info = `${user.name}(ID:${uid})加入牌友圈`;
    await this.mdb.add_club_infos_limit(clubInfo.clubid, info);
    if (channel) {
        channel.pushMessage('clubDynamicNotify',
            {
                clubId: clubInfo.clubid,
                userId: uid,
                state: 1,
                info,
            }, function (err) {
                if (err)
                    logger.error(err);
            });
    }
    let data = {};
    data.clubId = clubInfo.clubid;
    data.ownerId = clubInfo.ownerid;
    data.type = clubInfo.type;
    data.gametype = clubInfo.gametype;
    data.name = clubInfo.name;
    data.introduce = clubInfo.introduce;
    data.notice = clubInfo.notice;
    data.create_time = clubInfo.createTime;
    data.open_time = clubInfo.open_time;
    data.close_time = clubInfo.close_time;
    data.opening = clubInfo.opening;
    data.members = clubInfo.members;
    data.tables = clubInfo.tables;
    data.request_open = clubInfo.request_open;
    this.statusService.pushByUids([uid],
        'clubInfoNotify', data, function (err) {
            if (err)
                logger.error(err);
        });
    let agentlist = await this.rdb.getExperienceAgentList();
    let index = 0;
    let text = user.name + ' 进入体验牌友圈';
    const env = this.app.get('env');
    let host = '';
    if (env == 'production') {
        host = 'www.hs327.com';
    } else {
        host = 'localhost';
    }
    while (index < agentlist.length) {
        let agentId = agentlist[index];
        let url = ``;
        url = encodeURI(url);
        let r = await httpUtil.get2(url, false, false)
            .then(ret => ret).catch(() => false);
        if (!r) {
            logger.error(`体验圈推送err:${r},agentId:${agentId}`);
        }
        index++;
    }
};
Handler.prototype.getUserClubs = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let data = await this.mdb.get_user_all_clubs_by_userid(uid);
    next(null, {code: code.OK, data: data});
};
Handler.prototype.getClubInfo = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let clubInfo = await this.mdb.get_club_Info_by_clubid(clubId);
    if (clubInfo.ownerid !== uid && clubInfo.members.indexOf(uid) === -1) {
        next(null, {code: code.CLUB.NOT_CLUB_MEMBER, msg: '你不是该牌友圈的成员'});
        return;
    }
    if (clubInfo) {
        let data = {};
        data.clubId = clubInfo.clubid;
        data.ownerId = clubInfo.ownerid;
        data.type = clubInfo.type;
        data.gametype = clubInfo.gametype;
        data.name = clubInfo.name;
        data.introduce = clubInfo.introduce;
        data.notice = clubInfo.notice;
        data.create_time = clubInfo.createTime;
        data.open_time = clubInfo.open_time;
        data.close_time = clubInfo.close_time;
        data.opening = clubInfo.opening;
        data.members = clubInfo.members;
        data.request_open = clubInfo.request_open;
        data.tables = [];
        for (let i = 0; i < clubInfo.tables.length; i++) {
            try {
                let table = clubInfo.tables[i];
                let tableInfo = {};
                tableInfo.roomId = table.roomid;
                tableInfo.type = table.type;
                tableInfo.conf = table.conf || "{}";
                tableInfo.seats = [];
                let dbroomInfo = await this.rdb.getRoomInfo(table.roomid);
                if (dbroomInfo) {
                    let max = parseInt(JSON.parse(dbroomInfo.base_info).peoplemax, 10);
                    for (let j = 0; j < max; j++) {
                        const s = {};
                        s.userId = parseInt(dbroomInfo[`seat_${j}`], 10) || 0;
                        s.name = dbroomInfo[`seat_name_${j}`] || "";
                        s.headimg = dbroomInfo[`headimg_${j}`] || "";
                        s.sex = parseInt(dbroomInfo[`sex_${j}`], 10) || 0;
                        s.score = dbroomInfo[`seat_score_${j}`] ? dbroomInfo[`seat_score_${j}`] : 0;
                        s.ip = dbroomInfo[`seat_ip_${j}`] ? dbroomInfo[`seat_ip_${j}`] : '';
                        s.address = dbroomInfo[`seat_address_${j}`] ? dbroomInfo[`seat_address_${j}`] : '';
                        s.online = dbroomInfo[`seat_online_${j}`] ? parseInt(dbroomInfo[`seat_online_${j}`], 10) : 0;
                        s.ready = dbroomInfo[`seat_ready_${j}`] ? parseInt(dbroomInfo[`seat_ready_${j}`], 10) : 0;
                        s.seatIndex = j;
                        tableInfo.seats.push(s);
                    }
                }
                data.tables.push(tableInfo);
            } catch (e) {
                logger.error(`${clubId} getClubInfo err: `,e);
            }
        }
        if (uid === clubInfo.ownerid) {
            data.requests = clubInfo.requests;
            data.infos = clubInfo.infos;
            data.baners = clubInfo.baners;
        }
        next(null, {code: code.OK, data: data});
    } else {
        next(null, {code: code.FAIL, msg: '该牌友圈不存在'});
    }
};
Handler.prototype.getClubsBaseInfo = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubIds = msg.clubIds;
    if (!Array.isArray(clubIds)) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let clubs = await this.mdb.get_clubs_baseInfo_by_clubids(clubIds);
    if (clubs) {
        let data = {};
        for (let i = 0; i < clubs.length; i++) {
            let club = clubs[i];
            data[club.clubid] = {};
            data[club.clubid].clubId = club.clubid;
            data[club.clubid].name = club.name;
            data[club.clubid].ownerId = club.ownerid;
            data[club.clubid].type = club.type;
            data[club.clubid].gametype = club.gametype;
            data[club.clubid].members = club.members;
        }
        next(null, {code: code.OK, data: data});
    } else {
        next(null, {code: code.FAIL, msg: '查询失败'});
    }
};
Handler.prototype.exitClub = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let club = await this.mdb.get_club_Info_by_clubid(clubId);
    if (!club) {
        next(null, {code: code.FAIL, msg: '圈子不存在'});
        return;
    }
    if (club.members.indexOf(uid) === -1) {
        next(null, {code: code.FAIL, msg: '你不是该圈子成员不需要退出'});
        return;
    }
    if (uid === club.ownerid) {
        next(null, {code: code.FAIL, msg: '圈主不能退出牌友圈'});
        return;
    }
    let clubInfo = await this.mdb.del_club_members(clubId, uid);
    if (clubInfo && clubInfo.members.indexOf(uid) === -1) {
        let ret = await this.mdb.del_user_clubs_by_userid(uid, clubInfo.clubid);
        if (!ret || ret.clubs.indexOf(clubInfo.clubid) !== -1) {
            await this.mdb.add_club_members(clubId, uid);
            next(null, {code: code.FAIL, msg: '退出失败'});
            return;
        }
        if (clubInfo.type === 0) {
            //取消用户体验资格
            let ret = await this.mdb.set_user_qualification_eclub_by_userid(uid, 0);
            if (!ret) {
                logger.error(`用户:${uid},取消体验资格失败`);
            }
        }
        let username = session.get('name');
        let channelname = this.channelUtil.getClubChannelName(clubInfo.clubid);
        let channel = this.channelService.getChannel(channelname);
        let info = `${username}(ID:${uid})退出牌友圈`;
        await this.mdb.add_club_infos_limit(clubInfo.clubid, info);
        let fsid = session.frontendId;
        if (channel) {
            this.channelUtil.leaveChannel(channel, uid);
            channel.pushMessage('clubDynamicNotify',
                {
                    clubId: clubInfo.clubid,
                    userId: uid,
                    state: 2,
                    info,
                }, function (err) {
                    if (err)
                        logger.error(err);
                });
        }
        self.app.rpc.chat.chatRemote.leaveClub(session, uid, clubInfo.clubid, function () {
        });
        next(null, {code: code.OK, data: {clubs: ret.clubs}, msg: '退出成功'})
    } else {
        next(null, {code: code.FAIL, msg: '退出失败'});
    }
};
Handler.prototype.requestClub = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    if (session.get('agent_level') < 100) {
        let userClubs = await this.mdb.get_user_all_clubs_by_userid(uid);
        let allClubs = userClubs.myclubs.concat(userClubs.clubs);
        let clubs_limit = this.app.get('clubConfigs').clubs_limit;
        if (allClubs.length >= clubs_limit) {
            next(null, {code: code.CLUB.LIMIT_CLUBS, msg: '圈子数量达到上限,申请失败'});
            return;
        }
    }
    let clubInfo = await this.mdb.get_club_Info_by_clubid(clubId);
    if (clubInfo) {
        if (uid === clubInfo.ownerid) {
            next(null, {code: code.FAIL, msg: '这是你的牌友圈，不需要再次加入'});
            return;
        }
        if (!clubInfo.request_open || clubInfo.baners.indexOf(uid) !== -1) {
            next(null, {code: code.FAIL, msg: '该牌友圈拒绝申请'});
            return;
        }
        if (clubInfo.requests.length >= 200) {
            next(null, {code: code.FAIL, msg: '该牌友圈申请列表已达上限'});
            return;
        }
        if (clubInfo.members.indexOf(uid) !== -1) {
            next(null, {code: code.FAIL, msg: '你已在该圈子'});
            return;
        }
        if (clubInfo.members.length >= clubInfo.members_max) {
            next(null, {code: code.FAIL, msg: '该圈子人数已满'});
            return;
        }
        if (clubInfo.requests.indexOf(uid) !== -1) {
            next(null, {code: code.FAIL, msg: '你已经申请过了，不需要再次申请'});
            return;
        }
        let ret = await this.mdb.add_club_requests(clubId, uid);
        if (ret && ret.requests.indexOf(uid) !== -1) {
            let ownerId = ret.ownerid;
            this.statusService.pushByUids([ownerId],
                'clubRequestNotify', {clubId: ret.clubid, userId: uid}, function (err) {
                    if (err)
                        logger.error(err);
                });
            next(null, {code: code.OK, data: {clubId}, msg: '请耐心等待圈主通过'});
        } else {
            next(null, {code: code.FAIL, msg: '申请失败，请稍后再试'});
        }
    } else {
        next(null, {code: code.FAIL, msg: '该牌友圈不存在'});
    }
};
Handler.prototype.optClubRequests = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let agree = msg.agree === 1 ? 1 : 0;
    let requestId = msg.requestId;
    let clubInfo = await this.mdb.get_club_Info_by_clubid(clubId);
    if (!clubInfo) {
        next(null, {code: code.FAIL, msg: '圈子不存在'});
        return;
    }

    if (uid !== clubInfo.ownerid) {
        next(null, {code: code.FAIL, msg: '不是圈主无法操作'});
        return;
    }
    let ret = await this.mdb.del_club_requests(clubInfo.clubid, requestId);
    if (agree === 0) {
        next(null, {code: code.OK, data: {requests: ret.requests}});
        return;
    } else if (agree === 1) {
        let requestUserInfoTemp = await this.mdb.get_user_data_by_userid(requestId);
        if (requestUserInfoTemp.agent_level < 100) {
            let allClubs = requestUserInfoTemp.myclubs.concat(requestUserInfoTemp.clubs);
            let clubs_limit = this.app.get('clubConfigs').clubs_limit;
            if (allClubs.length >= clubs_limit) {
                next(null, {code: code.CLUB.LIMIT_CLUBS, data: {requests: ret.requests}, msg: '用户圈子数量达到上限,加入失败'});
                return;
            }
        }
        let requestUserInfo = await this.mdb.add_user_clubs_by_userid(requestId, clubInfo.clubid);
        if (!requestUserInfo || requestUserInfo.clubs.indexOf(clubInfo.clubid) === -1) {
            await this.mdb.add_club_requests(clubInfo.clubid, requestId);
            next(null, {code: code.FAIL, msg: '成员加入失败'});
        } else {
            clubInfo = await this.mdb.add_club_members(clubId, requestId);
            if (!clubInfo || clubInfo.members.indexOf(requestUserInfo.userid) === -1) {
                await this.mdb.del_user_clubs_by_userid(requestId, clubInfo.clubid);
                await this.mdb.add_club_requests(clubInfo.clubid, requestId);
                next(null, {code: code.FAIL, msg: '成员加入失败'});
                return;
            }
            next(null, {code: code.OK, data: {requests: ret.requests}});
            let channelname = this.channelUtil.getClubChannelName(clubInfo.clubid);
            let channel = this.channelService.getChannel(channelname);
            let info = `${requestUserInfo.name}(ID:${requestUserInfo.userid})加入牌友圈`;
            await this.mdb.add_club_infos_limit(clubInfo.clubid, info);
            if (channel) {
                channel.pushMessage('clubDynamicNotify',
                    {
                        clubId: clubInfo.clubid,
                        userId: requestUserInfo.userid,
                        state: 1,
                        info,
                    }, function (err) {
                        if (err)
                            logger.error(err);
                    });
            }
            let data = {};
            data.clubId = clubInfo.clubid;
            data.ownerId = clubInfo.ownerid;
            data.name = clubInfo.name;
            data.gametype = clubInfo.gametype;
            data.type = clubInfo.type;
            data.introduce = clubInfo.introduce;
            data.notice = clubInfo.notice;
            data.create_time = clubInfo.createTime;
            data.open_time = clubInfo.open_time;
            data.close_time = clubInfo.close_time;
            data.opening = clubInfo.opening;
            data.members = clubInfo.members;
            data.tables = clubInfo.tables;
            data.request_open = clubInfo.request_open;
            this.statusService.pushByUids([requestUserInfo.userid],
                'clubInfoNotify', data, function (err) {
                    if (err)
                        logger.error(err);
                });
        }
        return;
    }
    next(null, {code: code.FAIL, msg: '参数错误'});
};
Handler.prototype.modifyClubInfo = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let type = msg.type;
    let data = {};
    data.type = type;
    let club = await this.mdb.get_club_Info_by_clubid(clubId);
    if (!club) {
        next(null, {code: code.FAIL, msg: '圈子不存在'});
        return;
    }
    if (uid !== club.ownerid) {
        next(null, {code: code.FAIL, msg: '不是圈主不能修改'});
        return;
    }
    if (type === 1) {
        let newClubname = msg.name ? msg.name : '';
        let clubInfo = await this.mdb.update_club_name_by_clubid(clubId, newClubname);
        if (clubInfo) {
            clubId = clubInfo.clubid;
            data.name = clubInfo.name;
            data.clubId = clubId;
            next(null, {code: code.OK, data});
        } else {
            next(null, {code: code.FAIL, msg: '设置失败'});
        }
    } else if (type === 2) {
        let newClubintroduce = msg.introduce ? msg.introduce : '';
        let clubInfo = await this.mdb.update_club_introduce_by_clubid(clubId, newClubintroduce);
        if (clubInfo) {
            clubId = clubInfo.clubid;
            data.introduce = clubInfo.introduce;
            data.clubId = clubId;
            next(null, {code: code.OK, data});
        } else {
            next(null, {code: code.FAIL, msg: '设置失败'});
        }
    } else if (type === 3) {
        let newClubnotice = msg.notice ? msg.notice : '';
        let clubInfo = await this.mdb.update_club_notice_by_clubid(clubId, newClubnotice);
        if (clubInfo) {
            clubId = clubInfo.clubid;
            data.notice = clubInfo.notice;
            data.clubId = clubId;
            next(null, {code: code.OK, data: data});
        } else {
            next(null, {code: code.FAIL, msg: '设置失败'});
        }
    } else if (type === 4) {
        let open_time = msg.open_time;
        let close_time = msg.close_time;
        if (!open_time || !close_time) {
            next(null, {code: code.FAIL, msg: '参数错误'});
            return;
        }
        let open_times = open_time.split(':');
        let close_times = close_time.split(':');
        if (open_times.length < 2 || close_times.length < 2) {
            next(null, {code: code.FAIL, msg: '参数错误'});
            return;
        }
        let openHours = Number.isNaN(parseInt(open_times[0])) ?
            -1 :
            parseInt(open_times[0]) < 0 ? 0 : parseInt(open_times[0]) > 23 ? 23 : parseInt(open_times[0]);
        let openMinutes = Number.isNaN(parseInt(open_times[1])) ?
            -1 :
            parseInt(open_times[1]) < 0 ? 0 : parseInt(open_times[1]) > 59 ? 59 : parseInt(open_times[1]);

        let closeHours = Number.isNaN(parseInt(close_times[0])) ?
            -1 :
            parseInt(close_times[0]) < 0 ? 0 : parseInt(close_times[0]) > 23 ? 23 : parseInt(close_times[0]);
        let closeMinutes = Number.isNaN(parseInt(close_times[1])) ?
            -1 :
            parseInt(close_times[1]) < 0 ? 0 : parseInt(close_times[1]) > 59 ? 59 : parseInt(close_times[1]);
        if (openHours < 0 || openMinutes < 0 || closeHours < 0 || closeMinutes < 0) {
            next(null, {code: code.FAIL, msg: '参数错误'});
            return;
        }
        let now = new Date();
        let nDate = now.getDate();
        let nHours = now.getHours();
        let nMinutes = now.getMinutes();
        let tempTime = new Date();
        tempTime.setHours(openHours);
        tempTime.setMinutes(openMinutes);
        tempTime.setSeconds(0);
        tempTime.setMilliseconds(0);
        if (nHours < openHours) {
            tempTime.setDate(nDate);
            this.clubMgr.set_rel_open_time(clubId, tempTime);
            this.mdb.update_club_rel_open_time_by_clubid(clubId, tempTime);
        } else if (nHours > openHours) {
            tempTime.setDate(nDate + 1);
            this.clubMgr.set_rel_open_time(clubId, tempTime);
            this.mdb.update_club_rel_open_time_by_clubid(clubId, tempTime);
        } else if (nHours == openHours) {
            if (nMinutes < openMinutes) {
                tempTime.setDate(nDate);
                this.clubMgr.set_rel_open_time(clubId, tempTime);
                this.mdb.update_club_rel_open_time_by_clubid(clubId, tempTime);
            } else {
                tempTime.setDate(nDate + 1);
                this.clubMgr.set_rel_open_time(clubId, tempTime);
                this.mdb.update_club_rel_open_time_by_clubid(clubId, tempTime);
            }
        }
        now = new Date();
        nDate = now.getDate();
        nHours = now.getHours();
        nMinutes = now.getMinutes();
        tempTime = new Date();
        tempTime.setHours(closeHours);
        tempTime.setMinutes(closeMinutes);
        tempTime.setSeconds(-1);
        tempTime.setMilliseconds(0);
        if (nHours < closeHours) {
            tempTime.setDate(nDate);
            this.clubMgr.set_rel_close_time(clubId, tempTime);
            this.mdb.update_club_rel_close_time_by_clubid(clubId, tempTime);
        } else if (nHours > closeHours) {
            tempTime.setDate(nDate + 1);
            this.clubMgr.set_rel_close_time(clubId, tempTime);
            this.mdb.update_club_rel_close_time_by_clubid(clubId, tempTime);
        } else if (nHours == closeHours) {
            if (nMinutes < closeMinutes) {
                tempTime.setDate(nDate);
                this.clubMgr.set_rel_close_time(clubId, tempTime);
                this.mdb.update_club_rel_close_time_by_clubid(clubId, tempTime);
            } else {
                tempTime.setDate(nDate + 1);
                this.clubMgr.set_rel_close_time(clubId, tempTime);
                this.mdb.update_club_rel_close_time_by_clubid(clubId, tempTime);
            }
        }
        open_time = openHours + ':' + openMinutes;
        close_time = closeHours + ':' + closeMinutes;
        this.clubMgr.set_open_time(clubId, open_time);
        this.clubMgr.set_close_time(clubId, close_time);

        let clubInfo = await this.mdb.update_club_open_close_time_by_clubid(clubId, open_time, close_time);
        if (clubInfo) {
            data.open_time = clubInfo.open_time;
            data.close_time = clubInfo.close_time;
            data.clubId = clubId;
            next(null, {code: code.OK, data: data});
        } else {
            next(null, {code: code.FAIL, msg: '设置失败'});
        }
    } else if (type === 5) {
        let uswitch = msg.uswitch;
        let now = new Date();
        now.setSeconds(0);
        now.setMilliseconds(0);
        let club = this.clubMgr.get_clubInfo(clubId);
        if (!club) {
            next(null, {code: code.FAIL, msg: '没有该牌友圈'});
            return;
        }
        if (uswitch === 0) {
            if (club.opening === 0) {
                next(null, {code: code.FAIL, msg: '该牌友圈打烊中,无需再次打烊'});
                return;
            }
            now.setSeconds(-1);
            this.clubMgr.set_rel_close_time(clubId, now);
            this.clubMgr.set_opening(clubId, 0);
            this.mdb.update_club_opening_by_clubid(clubId, 0);
            this.mdb.update_club_rel_close_time_by_clubid(clubId, now);

            let club_open_times = club.open_time.split(':');
            let tempTime = new Date();
            tempTime.setHours(club_open_times[0]);
            tempTime.setMinutes(club_open_times[1]);
            tempTime.setSeconds(0);
            tempTime.setMilliseconds(0);
            if (now < tempTime) {
            } else {
                tempTime.setDate(now.getDate() + 1);
            }
            this.clubMgr.set_rel_open_time(clubId, tempTime);
            this.mdb.update_club_rel_open_time_by_clubid(clubId, tempTime);

            let channelname = this.channelUtil.getClubChannelName(clubId);
            let channel = this.channelService.getChannel(channelname);
            if (channel) {
                channel.pushMessage('tableStateClubNotify', {
                    clubId,
                    opening: 0
                });
            }
        } else if (uswitch === 1) {
            if (club.opening === 1) {
                next(null, {code: code.FAIL, msg: '该牌友圈营业中,无需再次营业'});
                return;
            }
            this.clubMgr.set_rel_open_time(clubId, now);
            this.clubMgr.set_opening(clubId, 1);
            this.mdb.update_club_opening_by_clubid(clubId, 1);
            this.mdb.update_club_rel_open_time_by_clubid(clubId, now);

            let club_close_times = club.close_time.split(':');
            let tempTime = new Date();
            tempTime.setHours(club_close_times[0]);
            tempTime.setMinutes(club_close_times[1]);
            tempTime.setSeconds(-1);
            tempTime.setMilliseconds(0);
            if (now < tempTime) {
            } else {
                tempTime.setDate(now.getDate() + 1);
            }
            this.clubMgr.set_rel_close_time(clubId, tempTime);
            this.mdb.update_club_rel_close_time_by_clubid(clubId, tempTime);

            let channelname = this.channelUtil.getClubChannelName(clubId);
            let channel = this.channelService.getChannel(channelname);
            if (channel) {
                channel.pushMessage('tableStateClubNotify', {
                    clubId,
                    opening: 1
                });
            }
        } else {
            next(null, {code: code.FAIL, msg: '参数错误'});
            return;
        }
        data.clubId = clubId;
        data.opening = club.opening;
        next(null, {code: code.OK, data: {}});
    } else {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let channelname = this.channelUtil.getClubChannelName(clubId);
    let channel = this.channelService.getChannel(channelname);
    if (channel) {
        channel.pushMessage('clubInfoModifyNotify',
            data, function (err) {
                if (err)
                    logger.error(err);
            });
    }
};
Handler.prototype.inviteUser = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let inviteUserId = msg.inviteUserId;
    if (uid === inviteUserId) {
        next(null, {code: code.FAIL, msg: '自己不能邀请自己'});
        return;
    }
    let clubInfo = await this.mdb.get_club_Info_by_clubid(clubId);
    if (!clubInfo) {
        next(null, {code: code.FAIL, msg: '圈子不存在'});
        return;
    }
    if (uid !== clubInfo.ownerid) {
        next(null, {code: code.FAIL, msg: '不是圈主不能邀请'});
        return;
    }
    if (clubInfo.members.indexOf(inviteUserId) !== -1) {
        next(null, {code: code.FAIL, msg: '该用户已存在'});
    } else {
        let invUserInfo = await this.mdb.get_user_data_by_userid(inviteUserId);
        if (invUserInfo.agent_level < 100) {
            let allClubs = invUserInfo.myclubs.concat(invUserInfo.clubs);
            let clubs_limit = this.app.get('clubConfigs').clubs_limit;
            if (allClubs.length >= clubs_limit) {
                next(null, {code: code.CLUB.LIMIT_CLUBS, msg: '用户圈子数量达到上限,邀请失败'});
                return;
            }
        }
        let ret = await this.mdb.add_user_req_clubs_by_userid(inviteUserId, clubInfo.clubid);
        if (ret && ret.req_clubs.indexOf(clubInfo.clubid) !== -1) {
            next(null, {code: code.OK, data: {}, msg: '邀请成功'});
            this.statusService.pushByUids([inviteUserId],
                'inviteUserNotify', {
                    clubId: clubInfo.clubid,
                    ownerId: clubInfo.ownerid
                }, function (err) {
                    if (err)
                        logger.error(err);
                });
        } else {
            next(null, {code: code.FAIL, msg: '邀请失败'});
        }
    }
};
Handler.prototype.kickUser = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let kickUserId = msg.kickUserId;
    if (uid === kickUserId) {
        next(null, {code: code.FAIL, msg: '自己不能踢出自己'});
        return;
    }
    let clubInfo = await this.mdb.get_club_Info_by_clubid(clubId);
    if (!clubInfo) {
        next(null, {code: code.FAIL, msg: '圈子不存在'});
        return;
    }
    if (uid !== clubInfo.ownerid) {
        next(null, {code: code.FAIL, msg: '不是圈主不能踢出'});
        return;
    }
    if (clubInfo.members.indexOf(kickUserId) === -1) {
        next(null, {code: code.FAIL, msg: '用户不存在不需要踢出'});
    } else {
        let ret = await this.mdb.del_club_members(clubId, kickUserId);
        if (ret.members.indexOf(kickUserId) === -1) {
            let kickUser = await this.mdb.del_user_clubs_by_userid(kickUserId, clubId);
            if (kickUser.clubs.indexOf(ret.clubid) !== -1) {
                await this.mdb.add_club_members(clubId, kickUserId);
                next(null, {code: code.FAIL, msg: '踢出失败'});
                return;
            }
            if (clubInfo.type === 0) {
                //取消用户体验资格
                let ret = await this.mdb.set_user_qualification_eclub_by_userid(kickUserId, 0);
                if (!ret) {
                    logger.error(`用户:${kickUserId},取消体验资格失败`);
                }
            }
            next(null, {code: code.OK, data: {members: ret.members}});
            let channelname = this.channelUtil.getClubChannelName(ret.clubid);
            let channel = this.channelService.getChannel(channelname);
            this.channelUtil.leaveChannel(channel, kickUser.userid);
            self.app.rpc.chat.chatRemote.leaveClub.toServer('*', kickUser.userid, ret.clubid, function () {
            });
            let info = `${kickUser.name}(ID:${kickUser.userid})退出牌友圈`;
            await this.mdb.add_club_infos_limit(ret.clubid, info);
            if (channel) {
                channel.pushMessage('clubDynamicNotify',
                    {
                        clubId: ret.clubid,
                        userId: kickUser.userid,
                        state: 2,
                        info,
                    }, function (err) {
                        if (err)
                            logger.error(err);
                    });
            }
            this.statusService.pushByUids([kickUserId],
                'kickClubNotify', {
                    clubId: ret.clubid,
                    ownerId: ret.ownerid
                }, function (err) {
                    if (err)
                        logger.error(err);
                });
        } else {
            next(null, {code: code.FAIL, msg: '踢出失败'});
        }
    }
};
Handler.prototype.dissolveClub = async function (msg, session, next) {
    let self = this;
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let ServerState = this.app.get('ServerStateInfo').ServerState;
    if (ServerState === 1 || ServerState === 3) {
        next(null, {code: code.MAINTAIN, msg: '服务器维护中,暂时无法解散牌友圈'});
        return;
    }
    let clubId = msg.clubId;
    if (!clubId) {
        next(null, {code: code.FAIL, msg: '参数错误'});
        return;
    }
    let clubInfo = await this.mdb.get_club_Info_by_clubid(clubId);
    if (!clubInfo) {
        next(null, {code: code.FAIL, msg: '圈子不存在'});
        return;
    }
    if (uid !== clubInfo.ownerid) {
        next(null, {code: code.FAIL, msg: '不是圈主不能邀请'});
        return;
    }
    //删除桌子
    const deltable = async function (i) {
        if (i >= clubInfo.tables.length)
            return;
        self.app.rpc.game.gameRemote.delRoom.toServer('*', clubInfo.tables[i].roomid, false, async function () {
        });
        i++;
        await deltable(i);
    };
    await deltable(0);
    //删除成员
    const delmember = async function (i) {
        if (i >= clubInfo.members.length)
            return;
        await self.mdb.del_user_clubs_by_userid(clubInfo.members[i], clubId);
        i++;
        await delmember(i);
    };
    await delmember(0);
    let uids = [];
    for (let i = 0; i < clubInfo.members.length; i++) {
        uids.push(clubInfo.members[i]);
    }
    if (uids.length > 0) {
        this.statusService.pushByUids(uids,
            'kickClubNotify', {
                clubId: clubInfo.clubid,
                ownerId: clubInfo.ownerid
            }, function (err) {
                if (err)
                    logger.error(err);
            });
    }
    let channelname = this.channelUtil.getClubChannelName(clubId);
    let channel = this.channelService.getChannel(channelname);
    if (channel) {
        channel.destroy();
    }
    self.app.rpc.chat.chatRemote.destroyClubChannel.toServer('*', clubId, function () {
    });
    let ret = await this.mdb.del_club_by_clubid(clubId);
    if (!ret) {
        next(null, {code: code.FAIL, msg: '圈子删除失败'});
        return;
    }
    await this.mdb.del_user_myclubs_by_userid(uid, clubId);
    if (clubInfo.type === 0) {
        await this.rdb.delExperienceClub(clubId);
    }
    this.clubMgr.del_club(clubId);
    next(null, {code: code.OK, data: {clubId: clubInfo.clubid}});
};
Handler.prototype.getClubHistroy = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let type = msg.type === 2 ? 2 : 1;
    let clubId = msg.clubId;
    let gametype = msg.gametype;
    let hislist;
    if (type === 1) {
        hislist = await this.rdb.getClubAllHistory(clubId, gametype);
    } else if (type === 2) {
        hislist = await this.rdb.getClubAllOldHistory(clubId, gametype);
    }
    if (!hislist)
        hislist = [];
    next(null, {code: code.OK, data: {hislist}});
};
Handler.prototype.getBigWinerRank = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let type = msg.type;
    let clubId = msg.clubId;
    let gametype = msg.gametype;
    let rank;
    if (type === 1) {
        rank = await this.rdb.getClubBigWinerCountAll(clubId, gametype);
    } else if (type === 2) {
        rank = await this.rdb.getClubOldBigWinerCountAll(clubId, gametype);
    }
    next(null, {code: code.OK, data: {rank}});
};
Handler.prototype.getBattleCount = async function (msg, session, next) {
    let uid = session.uid;
    if (!uid) {
        next(null, {code: code.LOGIN_FIRST, msg: '请先登录'});
        return;
    }
    let type = msg.type;
    let clubId = msg.clubId;
    let gametype = msg.gametype;
    let battle;
    if (type === 1) {
        battle = await this.rdb.getClubBattleCountAll(clubId, gametype);
    } else if (type === 2) {
        battle = await this.rdb.getClubOldBattleCountAll(clubId, gametype);
    } else if (type === 10) {
        battle = await this.rdb.getClubBattleMonCountAll(clubId, gametype);
    } else if (type === 20) {
        battle = await this.rdb.getClubOldBattleMonCountAll(clubId, gametype);
    }
    next(null, {code: code.OK, data: {battle}});
};
