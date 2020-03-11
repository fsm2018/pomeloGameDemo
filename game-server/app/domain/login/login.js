const http = require('../../util/httpUtil');
const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const codeConfig = require('../../../../shared/codeConfig');
const pomelo = require('pomelo');

exports.getAccesstoken = async function (code, appid, secret) {
    const data = {
        appid,
        secret,
        code,
        grant_type: 'authorization_code',
    };
    try {
        return await http.get2('https://api.weixin.qq.com/sns/oauth2/access_token', data, true)
            .then(ret => ret).catch(() => false);
    } catch (err) {
        logger.error('getAccesstoken' + err);
        return false;
    }
};


exports.getStateInfo = async function (accessToken, openid) {
    const data = {
        access_token: accessToken,
        openid,
    };

    try {
        return await http.get2('https://api.weixin.qq.com/sns/userinfo', data, true)
            .then(ret => ret).catch(() => false);
    } catch (err) {
        logger.error('getStateInfo' + err);
        return false;
    }
};

exports.checkAndcreateUser = async function (session, account, name, sex, headimgurl, unionid, logintype) {
    let ip = session.get('ip');
    if (logintype !== 3 && logintype !== 4 && !unionid) {
        logger.debug('unionid is null');
        return false;
    }

    try {
        let user = await pomelo.app.get('mdclient').get_user_data_by_account(account);
        if (user) {
            if (logintype !== 3 && logintype !== 4) {
                user.name = name;
                user.sex = sex;
                user.headimg = headimgurl;
                user.unionid = unionid;
            }
            user.re_time = new Date();
            user = await user.save();
        } else {
            user = await pomelo.app.get('mdclient').createUser(account, name, sex, headimgurl, unionid);
            pomelo.app.get('rdclient').addLoginOrRegister(codeConfig.Statistics.register.today, user.userid);
        }
        pomelo.app.get('rdclient').addLoginOrRegister(codeConfig.Statistics.login.today, user.userid);
        if (user.first_login === 0 && user.ownerid !== 0) {
            user.first_login = 1;
            await user.save();
            let dbtasks = await pomelo.app.get('mdclient').get_tasks_by_userid(user.ownerid);
            if (dbtasks) {
            } else {
            }
        }
        return user;
    } catch (err) {
        logger.error('checkAndcreateUser' + err);
        return false;
    }
};

exports.buildcliInfo = function (user, token, cliversion, minversion) {
    return {
        ownerId: user.ownerid,
        userId: user.userid,
        name: user.name,
        lv: user.lv,
        gems: user.gems,
        roomId: user.roomid_p,
        hallgameId: user.roomid,
        gameId: user.gameid,
        openId: user.openid || '',
        sex: user.sex,
        vgems: user.vgems,
        agentLevel: user.agent_level,
        version: cliversion || '',
        minversion: minversion || '',
        xlOpenId: user.xl_openid_pomelo || '',
        myClubs: user.myclubs || [],
        clubs: user.clubs || [],
        qualification_eclub: user.qualification_eclub,
        requests: user.req_clubs || [],
        headImg: user.headimg || '',
        phone: user.phone || '',
        sign: user.sign || '',
        token: token
    }
};
exports.checkBanedUserByUserId = async function (userid) {
    return pomelo.app.get('mdclient').getBanedUserByUserId(userid);
};
