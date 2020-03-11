const db = require('mongoose');
const com = require('../util/com');
const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const code = require('../../../shared/codeConfig').retCode;
db.Promise = global.Promise;

db.set('useFindAndModify', false);


const Schema = db.Schema;


exports.init = function (app) {
    var config = app.get('mongodb');
    db.connect(config.url, {useNewUrlParser: true, autoIndex: false});
    const con = db.connection;
    con.on('error', () => {
        logger.error('mongodb 连接失败');
    });
    con.once('open', () => {
        //成功连接
        logger.info(`${app.curServer.id} mongodb 连接成功`);
    });
};


const IDsSchema = new Schema({
    _baseID: {type: Number, default: 100000},
    name: String,
});

class IDs {
    get baseID() {
        return this._baseID;
    }
}

IDsSchema.loadClass(IDs);

const IDsModel = db.model('IDsModel', IDsSchema);

IDsModel.findOne({name: 'userID'}).exec().then(async (doc) => {
    if (!doc) {
        IDsModel.create({name: 'userID'});
    }
}).catch((err) => {
    console.log(err);
});

async function getNewUserID() {
    try {
        const doc = await IDsModel.findOneAndUpdate({name: 'userID'}, {$inc: {_baseID: 1}}, {new: true});
        if(!doc.baseID){
            IDsModel.create({name: 'userID'});
        }
        return doc.baseID;
    } catch (error) {
        console.log(error);
        return false;
    }
}

exports.get_base_userid = () => IDsModel.findOne({name: 'userID'}).then(doc => doc.baseID, com.normalErr);

exports.addBaseID = c => IDsModel.findOneAndUpdate({name: 'userID'}, {$inc: {_baseID: c}}).then(doc => doc, com.normalErr);


const GameIDsSchema = new Schema({
    _baseID: {type: Number, default: 10000000},
    name: String,
});

class GameIDs {
    get baseID() {
        return this._baseID;
    }
}

GameIDsSchema.loadClass(GameIDs);

const GameIDsModel = db.model('GameIDsModel', GameIDsSchema);

GameIDsModel.findOne({name: 'GameID'}).exec().then(async (doc) => {
    if (!doc) {
        GameIDsModel.create({name: 'GameID'});
    }
}).catch((err) => {
    console.log(err);
});

async function getNewGameID() {
    try {
        const doc = await GameIDsModel.findOneAndUpdate({name: 'GameID'}, {$inc: {_baseID: 1}}, {new: true});
        return doc.baseID;
    } catch (error) {
        console.log(error);
        return false;
    }
}

exports.getNewGameID = getNewGameID;

//-----------------------GemsRecords---------------------
const GemsRecordSchema = new Schema({
    mon_cost: {type: Number, default: 0}, // 当月用户累计消耗房卡
    total_cost: {type: Number, default: 0}, // 用户累计消耗房卡

    final_buy_count: {type: Number, default: 0}, // 最后购卡数量
    final_buy_time: Date, // 最后购卡时间
    total_buy_count: {type: Number, default: 0}, // 累计购买数量
    total_buy_times: {type: Number, default: 0}, // 累计购买次数

    sell_total: {type: Number, default: 0}, // 总销售卡的数量
    sell_mon: {type: Number, default: 0}, // 当月售卡的数量
    sell_today: {type: Number, default: 0}, // 今日售卡的数量
    sell_last_mon: {type: Number, default: 0}, // 上月的反卡数量

    buy_mon: {type: Number, default: 0}, // 当月wx买卡的数量
    buy_total: {type: Number, default: 0}, // 总wx买卡的数量

    buy_mon_pomelo: {type: Number, default: 0}, // 当月wx买卡的数量
    buy_total_pomelo: {type: Number, default: 0}, // 总wx买卡的数量
    buy_rebate: {type: Number, default: 0} //给ownerid还有多少可以返利
});

//------------------------Users----------------------
const UserSchema = new Schema({
    userid: {type: Number, required: true},
    account: {type: String, required: true},
    unionid: String,
    openid: String,
    ownerid: {type: Number, default: 0},
    name: String,
    sex: {type: Number, default: 0},
    headimg: String,
    lv: {type: Number, default: 0},
    exp: {type: Number, default: 0},
    coins: {type: Number, default: 0},
    gems: {type: Number, default: 0}, // 普通房卡
    vgems: {type: Number, default: 0}, // VIP房卡
    rmb: {type: Number, default: 0},
    roomid: String, //当前房间号
    roomid_p: String,//当前房间号pomelo
    gameid: String, //当前回放码
    create_time: Date, // 推广人创建时间
    mCreate_time: Date,//角色创建时间
    re_time: Date, // 最后登录时间
    offline_time: Date,//离线时间
    agent_level: {type: Number, default: 0}, // 代理权限
    wx_account: String, // 微信号
    real_name: String, // 真实姓名
    phone: String, // 手机号
    verifyCount_week: {type: Number, default: 0}, // 周认证
    verifyCount_mon: {type: Number, default: 0}, // 月认证
    verifyCount_quarter: {type: Number, default: 0}, // 季度认证
    subscribe_time: Date, // 关注时间
    record_gems: GemsRecordSchema, // 统计房卡
    record_vgems: GemsRecordSchema, // 统计v卡
    route_game: String,
    first_charge: {type: Number, default: 0}, //首充
    first_login: {type: Number, default: 1},  //绑定代理后 首次登录 0:未登录 1:已经登录过
    myclubs: [],//我拥有的clubs
    req_clubs: [],//邀请我的clubs
    clubs: [],//我加入的clubs
    qualification_eclub: {type: Number, default: 0}, //体验club资格 0:没有 1:有
    xl_openid_pomelo: String,
    sign: {type: String, default: ''},
    hallGamehallId: {type: String, default: ''}
});

const Users = db.model('users', UserSchema);
exports.findAllUsers = () => Users.find().then(doc => doc, com.normalErr);
exports.createUser = async (account, name, sex, headimg, unionid, openid) => {
    const obj = {};
    obj.userid = await getNewUserID();
    if (!obj.userid) return false;
    obj.account = account;
    obj.name = name || `用户:${obj.userid}`;
    obj.sex = sex || 0;
    obj.headimg = headimg || '';
    obj.unionid = unionid || '';
    if (openid) obj.openid = openid;
    obj.gems = 3;
    obj.mCreate_time = new Date();
    obj.re_time = new Date();
    obj.record_gems = {};
    obj.record_vgems = {};
    obj.first_login = 0;
    obj.qualification_eclub = 1;
    return Users.create(obj).then(doc => doc, com.normalErr);
};
exports.get_user_data_by_account = account => Users.findOne({account}).then(doc => doc, com.normalErr);

exports.get_user_data_by_userid = (userid) => Users.findOne({userid}).then(doc => doc, com.normalErr);

exports.get_user_data_by_xl_openid_pomelo = (xl_openid_pomelo) => Users.findOne({xl_openid_pomelo}).then(doc => doc, com.normalErr);

exports.getUsersByRange = (start, end, q) => Users.find(Object.assign({
    userid: {
        $gte: start,
        $lt: end
    }
}, q)).then(doc => doc, com.normalErr);

exports.setXLOpenID = (userid, xl_openid_pomelo) => Users.findOneAndUpdate({userid}, {$set: {xl_openid_pomelo}})
    .then(() => true, com.normalErr);
exports.get_users_baseInfo_by_userids = userids => Users.find({userid: {$in: userids}})
    .select('userid name sex headimg gems re_time agent_level sign offline_time').then((doc) => {
        if (!doc) return doc;
        return doc;
    }, com.normalErr);
exports.update_user_offline_time_by_userid = userid => Users.findOneAndUpdate({userid}, {$set: {offline_time: new Date()}})
    .then(() => true, com.normalErr);
exports.set_user_agent_level_by_userid = (userid, agent_level) =>
    Users.findOneAndUpdate({userid}, {$set: {agent_level}}).then(doc => doc, com.normalErr);
exports.get_spread_users_info_by_ownerid = ownerid => Users.find({ownerid})
    .select('userid name sex headimg gems re_time ownerid create_time record_gems.mon_cost record_gems.buy_mon_pomelo record_gems.buy_total_pomelo record_gems.buy_rebate')
    .then(doc => doc, com.normalErr);
exports.get_spread_user_info_by_userid = userid => Users.findOne({userid})
    .select('userid name sex headimg gems re_time ownerid create_time record_gems.mon_cost record_gems.buy_mon_pomelo record_gems.buy_total_pomelo record_gems.buy_rebate')
    .then(doc => doc, com.normalErr);
exports.set_spread_user_buy_rebate_by_userid = (userid, buy_rebate) =>
    Users.findOneAndUpdate({userid}, {$inc: {'record_gems.buy_rebate': buy_rebate}}, {new: true})
        .then(doc => doc, com.normalErr);
exports.set_user_ownerid_by_userid = (userid, ownerid) =>
    Users.findOneAndUpdate({userid}, {$set: {ownerid}}, {new: true})
        .then(doc => doc, com.normalErr);
exports.set_user_route_game_by_userid = (userid, route_game) =>
    Users.findOneAndUpdate({userid}, {$set: {route_game}}).then(() => true, com.normalErr);
exports.get_user_route_game_by_userid = userid => Users.findOne({userid}).select('route_game').then((doc) => {
    if (!doc) return doc;
    return doc;
}, com.normalErr);
exports.get_room_id_of_user = userid => Users.findOne({userid}).select('roomid_p').then((doc) => {
    if (!doc) return doc;
    return doc.roomid_p;
}, com.normalErr);

exports.set_room_id_of_user = (userid, roomid) => Users.findOneAndUpdate({userid}, {$set: {roomid_p: roomid}})
    .then(() => true, com.normalErr);
exports.set_hallroom_id_of_user = (userid, roomid) => Users.findOneAndUpdate({userid}, {$set: {roomid: roomid}})
    .then(() => true, com.normalErr);
exports.set_game_id_of_user = (userid, gameid) => Users.findOneAndUpdate({userid}, {$set: {gameid: gameid}})
    .then(() => true, com.normalErr);
exports.set_user_qualification_eclub_by_userid = (userid, qualification_eclub) => {
    qualification_eclub = qualification_eclub === 1 ? 1 : 0;
    return Users.findOneAndUpdate({userid}, {$set: {qualification_eclub}}).then(() => true, com.normalErr);
};
exports.get_gems_by_userid = userid => Users.findOne({userid}).select('gems').then((doc) => {
    if (!doc) return doc;
    return doc.gems;
}, com.normalErr);

exports.addGems_by_userid = (userid, gems) => {
    if (!com.isNumber(gems)) return false;
    return Users.findOneAndUpdate({userid},
        {$inc: {gems}},
        {new: true})
        .then(doc => doc, com.normalErr);
};
exports.cost_gems = (userid, gems) => {
    if (!com.isNumber(gems)) return false;
    return Users.findOneAndUpdate({userid},
        {$inc: {gems: -gems, 'record_gems.mon_cost': gems, 'record_gems.total_cost': gems}},
        {new: true}).then(doc => doc, com.normalErr);
};
exports.get_user_all_clubs_by_userid = userid => Users.findOne({userid}).select('myclubs clubs').then(
    doc => doc, com.normalErr);
exports.add_user_myclubs_by_userid = (userid, clubid) => {
    return Users.findOneAndUpdate({userid}, {$addToSet: {myclubs: clubid}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.del_user_myclubs_by_userid = (userid, clubid) => {
    return Users.findOneAndUpdate({userid}, {$pull: {myclubs: clubid}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.add_user_clubs_by_userid = (userid, clubid) => {
    return Users.findOneAndUpdate({userid}, {$addToSet: {clubs: clubid}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.del_user_clubs_by_userid = (userid, clubid) => {
    return Users.findOneAndUpdate({userid}, {$pull: {clubs: clubid}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.add_user_req_clubs_by_userid = (userid, clubid) => {
    return Users.findOneAndUpdate({userid}, {$addToSet: {req_clubs: clubid}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.del_user_req_clubs_by_userid = (userid, clubid) => {
    return Users.findOneAndUpdate({userid}, {$pull: {req_clubs: clubid}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.get_user_req_clubs_by_userid = userid => Users.findOne({userid}).select('req_clubs').then(
    (doc) => doc, com.normalErr);
exports.set_user_sign_by_userid = (userid, sign) => {
    return Users.findOneAndUpdate({userid}, {$set: {sign}}, {new: true})
        .then(doc => doc, com.normalErr);
};
exports.set_user_hallGamehallId_by_userid = (userid, hallGamehallId) => {
    return Users.findOneAndUpdate({userid}, {$set: {hallGamehallId}}, {new: true})
        .then(doc => doc, com.normalErr);
};
exports.get_user_hallGamehallId_by_userid = userid => Users.findOne({userid}).select('hallGamehallId').then(
    doc => doc, com.normalErr);
// -------------------------- BanedUsers --------------------------
const BanedUsersSchema = new Schema({
    userid: {type: Number, required: true},
    createTime: {type: Date, required: true},
    unionid: {type: String, required: true},
});
const BanedUsers = db.model('banedusers', BanedUsersSchema);

exports.addBanedUser = (userid, unionid) => {
    const createTime = new Date();
    return BanedUsers.create({userid, createTime, unionid}).then(doc => doc, com.normalErr);
};

exports.delBanedUserByUserId = userid => BanedUsers.findOneAndRemove({userid}, {new: true}).then(() => true).catch((err) => {
    logger.error('delBanedUser', err);
    return false;
});
exports.getBanedUserByUserId = userid => BanedUsers.findOne({userid})
    .then(doc => doc, com.normalErr);

//------------------------------- Clubs ----------------------------------
const clubsSchema = new Schema({
    clubid: {type: String, required: true},
    ownerid: {type: Number, required: true},
    type: {type: Number, default: 1}, //0:体验 1:普通
    gametype: {type: Number, default: 3}, //圈子游戏类型默认为3(杭州麻将)
    name: {type: String, default: ''},
    introduce: {type: String, default: ''},
    notice: {type: String, default: ''},
    createTime: Date,
    open_time: {type: String, default: '08:00'},
    close_time: {type: String, default: '00:00'},
    opening: {type: Number, default: 1},
    rel_open_time: Date,
    rel_close_time: Date,
    request_open: {type: Number, default: 1},
    requests: [],
    members: [],
    members_max: {type: Number, default: 500},
    infos: [],
    tables: [],
    baners: []
});

const clubs = db.model('clubs', clubsSchema);
exports.get_allclubs = () => {
    return clubs.find().sort({createTime: -1}).then(doc => doc, com.normalErr);
};
exports.get_clubs = (index, limit) => {
    return clubs.find().sort({createTime: -1}).skip(index)
        .limit(limit).then(doc => doc, com.normalErr);
};
exports.create_club = (clubid, ownerid, name, gametype) => {
    let obj = {};
    obj.clubid = clubid;
    obj.ownerid = ownerid;
    obj.name = name;
    obj.type = 1; //0:体验 1:普通
    obj.gametype = gametype || 3;
    obj.createTime = new Date();
    obj.open_time = '08:00';
    obj.close_time = '00:00';
    obj.rel_open_time = new Date();
    let temp = new Date();
    temp.setHours(0);
    temp.setSeconds(-1);
    temp.setDate(new Date().getDate() + 1);
    obj.rel_close_time = temp;
    return clubs.create(obj).then(doc => doc, com.normalErr);
};
exports.del_club_by_clubid = clubid => clubs.findOneAndRemove({clubid}, {new: true})
    .then(() => true).catch((err) => {
        logger.error('delclubs', err);
        return false;
    });
exports.get_club_Info_by_clubid = clubid => clubs.findOne({clubid}).then(doc => doc, com.normalErr);

exports.get_club_baseInfo_by_clubid = clubid => clubs.findOne({clubid})
    .select('clubid ownerid type name members gametype').then(doc => doc, com.normalErr);

exports.get_clubs_baseInfo_by_clubids = clubids => clubs.find({clubid: {$in: clubids}}).select('clubid ownerid type name members gametype').then((doc) => {
    if (!doc) return doc;
    return doc;
}, com.normalErr);
exports.set_club_type_by_clubid = (clubid, type) =>
    clubs.findOneAndUpdate({clubid}, {$set: {type}}, {new: true}).then(doc => doc, com.normalErr);
exports.set_club_experience_by_clubid = (clubid, type, request_open) => {
    type = type === 1 ? 1 : 0;
    request_open = request_open === 1 ? 1 : 0;
    return clubs.findOneAndUpdate({clubid}, {$set: {type, request_open}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.set_club_ownerid_by_clubid = (clubid, ownerid) =>
    clubs.findOneAndUpdate({clubid}, {$set: {ownerid}}, {new: true}).then(doc => doc, com.normalErr);
exports.update_club_name_by_clubid = (clubid, name) => {
    return clubs.findOneAndUpdate({clubid}, {$set: {name}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.update_club_introduce_by_clubid = (clubid, introduce) => {
    return clubs.findOneAndUpdate({clubid}, {$set: {introduce}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.update_club_notice_by_clubid = (clubid, notice) => {
    return clubs.findOneAndUpdate({clubid}, {$set: {notice}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.update_club_open_close_time_by_clubid = (clubid, open_time, close_time) => {
    return clubs.findOneAndUpdate({clubid}, {
        $set: {
            open_time,
            close_time
        }
    }, {new: true}).then(doc => doc, com.normalErr);
};
exports.update_club_opening_by_clubid = (clubid, opening) => {
    return clubs.findOneAndUpdate({clubid}, {$set: {opening: parseInt(opening)}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.update_club_rel_open_time_by_clubid = (clubid, rel_open_time) => {
    return clubs.findOneAndUpdate({clubid}, {$set: {rel_open_time: rel_open_time}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.update_club_rel_close_time_by_clubid = (clubid, rel_close_time) => {
    return clubs.findOneAndUpdate({clubid}, {$set: {rel_close_time: rel_close_time}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.add_club_requests = (clubid, userid) => {
    return clubs.findOneAndUpdate({clubid}, {$addToSet: {requests: parseInt(userid)}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.del_club_requests = (clubid, userid) => {
    return clubs.findOneAndUpdate({clubid}, {$pull: {requests: parseInt(userid)}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.add_club_members = (clubid, userid) => {
    return clubs.findOneAndUpdate({clubid}, {$addToSet: {members: parseInt(userid)}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.del_club_members = (clubid, userid) => {
    return clubs.findOneAndUpdate({clubid}, {$pull: {members: parseInt(userid)}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.add_club_infos_limit = (clubid, info) => {
    clubs.findOne({clubid}).then(async doc => {
        if (!doc)
            return doc;
        const club = doc;
        club.infos.push(info);
        let limit = 10;
        if (club.infos.length > limit) {
            let i = club.infos.length - limit;
            while (i >= 0) {
                await exports.del_club_infos(clubid, club.infos[i]);
                i--;
            }
        }
        return await exports.add_club_infos(clubid, info);
    }, com.normalErr);
};
exports.add_club_infos = (clubid, info) => {
    return clubs.findOneAndUpdate({clubid}, {$push: {infos: info}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.del_club_infos = (clubid, info) => {
    return clubs.findOneAndUpdate({clubid}, {$pull: {infos: info}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.add_club_tables = (clubid, roomid, type, conf) => {
    let table = {};
    table.roomid = roomid;
    table.type = parseInt(type);
    table.conf = JSON.stringify(conf);
    return clubs.findOneAndUpdate({clubid}, {$addToSet: {tables: table}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.del_club_tables_by_roomid = (clubid, roomid) => {
    return clubs.findOneAndUpdate({clubid}, {$pull: {tables: {roomid}}}, {new: true}).then(doc => doc, com.normalErr);
};

exports.add_club_baners = (clubid, baner) => {
    return clubs.findOneAndUpdate({clubid}, {$addToSet: {baners: parseInt(baner)}}, {new: true}).then(doc => doc, com.normalErr);
};
exports.del_club_baners = (clubid, baner) => {
    return clubs.findOneAndUpdate({clubid}, {$pull: {baners: parseInt(baner)}}, {new: true}).then(doc => doc, com.normalErr);
};

//-------------------------------Deals---------------------------------
const DealsSchema = new Schema({
    userid: {type: Number, required: true},
    ownerid: {type: Number, required: false},
    name: {type: String, required: true},
    gems: {type: Number, required: true},
    gems_before: {type: Number, required: true},
    create_time: {type: Date, required: true},
    type: String,
});

const Deals = db.model('Deals', DealsSchema);

function addDeal(data) {
    return Deals.create(data).then(doc => doc).catch((err) => {
        console.log(err);
        return false;
    });
}

exports.get_deal_list = (ownerid, userid, index, limit, t) => {
    const q = {};
    q.ownerid = ownerid;
    if (userid) q.userid = userid;
    if (!t) return false;
    q.type = t;
    return Deals.find(q)
        .sort({create_time: -1})
        .skip(index)
        .limit(limit)
        .lean()
        .then((doc) => {
            if (!doc) return doc;
            return doc;
        }, com.normalErr);
};

function addDealGems(userid, gems, t) {
    if (!com.isNumber(gems) && gems > 0) return false;
    // 累计购买次数
    const inc = {total_buy_times: 1};
    // 累计购买数量
    inc[`record_${t}.total_buy_count`] = gems;
    // 房卡
    inc[t] = gems;
    // 最后购买时间
    const set = {};
    // 最后购买数量
    set[`record_${t}.final_buy_time`] = new Date();
    set[`record_${t}.final_buy_count`] = gems;

    return Users.findOneAndUpdate({userid},
        {
            $inc: inc,
            $set: set
        },
        {new: true}).then(doc => doc, com.normalErr);
}

function resetDealGems(userid, gems, userData, t) {
    if (!com.isNumber(gems) && gems > 0) return false;

    // 累计购买次数
    const inc = {total_buy_times: -1};
    // 累计购买数量
    inc[`record_${t}.total_buy_count`] = -gems;
    // 房卡
    inc[t] = -gems;
    // 最后购买时间
    const set = {};
    set[`record_${t}.final_buy_time`] = userData.final_buy_time;
    // 最后购买数量
    set[`record_${t}.final_buy_count`] = userData.final_buy_count;

    return Users.findOneAndUpdate({userid},
        {
            $inc: inc,
            $set: set
        },
        {new: true}).then(doc => doc, com.normalErr);
}

function ownerDealGems(userid, gems, t) {
    if (!com.isNumber(gems) && gems > 0) return false;
    const inc = {};
    // 总销售卡的数量
    inc[`record_${t}.sell_total`] = gems;
    // 月销售卡的数量
    inc[`record_${t}.sell_mon`] = gems;
    // 今日销售卡数量
    inc[`record_${t}.sell_today`] = gems;
    // 房卡
    inc[t] = -gems;
    return Users.findOneAndUpdate({userid},
        {$inc: inc},
        {new: true}).then(doc => doc, com.normalErr);
}

exports.deal_gems = async (ownerid, userid, gems, t) => {
    if (!com.isNumber(gems)) return false;

    let user = await exports.get_user_data_by_userid(userid);
    if (!user) return {code: code.FAIL, msg: '用户无效'};
    let owner = await exports.get_user_data_by_userid(ownerid);
    if (!owner) return {code: code.FAIL, msg: '权限错误'};
    if (owner[t] < gems) return {code: code.FAIL, msg: '房卡不足，请充值'};

    let create_time = new Date();
    let gems_before = user[t];
    const deal = await addDeal({
        userid,
        ownerid,
        name: user.name,
        gems,
        gems_before,
        create_time,
        type: t
    });
    if (!deal) return {code: code.FAIL, msg: '网络错误'};

    const typeName = `record_${t}`;
    const userData = {};
    userData.final_buy_count = user[typeName].final_buy_count;
    userData.final_buy_time = user[typeName].final_buy_time;

    user = await addDealGems(user.userid, gems, t);
    if (!user) {
        deal.remove().catch((err) => {
            logger.error('回滚数据操作异常: 售卡记录 ', err);
        });
        return {code: code.FAIL, msg: '网络错误'};
    }

    owner = await ownerDealGems(owner.userid, gems, t);
    if (!owner) {
        user = await resetDealGems(user.userid, gems, userData, t);
        if (!user) {
            logger.error('回滚数据操作异常: 用户数据');
        }
        deal.remove().catch((err) => {
            logger.error('回滚数据操作异常: 售卡记录');
        });

        return {code: code.FAIL, msg: '网络错误'};
    }

    return {
        code: code.OK,
        gems: owner[t],
        sell_total: owner[typeName].sell_total,
        sell_mon: owner[typeName].sell_mon,
        sell_today: owner[typeName].sell_today,
        sell_record: {
            userid,
            ownerid,
            name: user.name,
            gems,
            gems_before,
            create_time,
            type: t
        }
    };
};
//-----------------------PlayerReports-------------------------
const PlayerReportsSchema = new Schema({
    userid: {type: Number, required: true},
    createTime: {type: Date, required: true},
    phone: String, // 手机号
    txt: {type: String, required: true},
});

const PlayerReports = db.model('PlayerReports', PlayerReportsSchema);
exports.addPlayerReports = (userid, phone, txt) => {
    const createTime = new Date();
    return PlayerReports.create({userid, createTime, phone, txt}).then(doc => doc, com.normalErr);
};

exports.delPlayerReport = _id => PlayerReports.findOneAndRemove({_id}, {new: true}).then(() => true).catch((err) => {
    console.log(err);
    return false;
});

exports.getPlayerReport = userid => PlayerReports.findOne({userid})
    .then(doc => doc, com.normalErr);

exports.getPlayerReportList = (index, limit) => PlayerReports.find({})
    .sort({createTime: -1})
    .skip(index).limit(limit)
    .lean()
    .then(doc => doc, com.normalErr);

//------------------------------- AgentRequests --------------------------------------
const AgentRequestSchema = new Schema({
    userid: {type: Number, required: true},
    wx_account: String, // 微信号
    real_name: String, // 真实姓名
    phone: String, //手机号
    name: {type: String, default: ''}
});

const AgentRequests = db.model('AgentRequests', AgentRequestSchema);

exports.add_agent_request_list = async (userid, wx_account, real_name, phone, name) => {
    let doc = await exports.get_agent_request_one(userid);
    if (doc) {
        await exports.update_agent_request_one(userid, wx_account, real_name, phone, name);
        return doc;
    } else {
        return AgentRequests.create(
            {userid, wx_account, real_name, phone, name}).then(doc => doc, com.normalErr);
    }
};

exports.update_agent_request_one = (userid, wx_account, real_name, phone, name) =>
    AgentRequests.findOneAndUpdate({userid}, {$set: {wx_account, real_name, phone, name}})
        .then(doc => doc, com.normalErr);

exports.get_agent_request_one = userid => AgentRequests.findOne({userid})
    .then(doc => doc, com.normalErr);
exports.del_agent_request_one = userid => AgentRequests.findOneAndRemove({userid}, {new: true})
    .then(() => true).catch((err) => {
        logger.error(err);
        return false;
    });
exports.get_agent_request_list = (index, limit) => AgentRequests.find({})
    .sort({_id: -1})
    .skip(index)
    .limit(limit)
    .lean()
    .then(doc => doc, com.normalErr);

//---------------------------------Tasks -----------------------------
const TaskSchema = new Schema({
    userid: {type: Number, required: true},
    tasks: {type: String, required: true},
    phone: {type: String, default: ''},
    state: {type: Number, default: 0} //0:未处理 1:已处理
});

const Tasks = db.model('tasks', TaskSchema);

exports.createTask = (userid, tasks) => Tasks.create(
    {userid, tasks: JSON.stringify(tasks)}).then(doc => doc, com.normalErr);
exports.get_tasks_by_userid = userid => Tasks.findOne({userid})
    .then(doc => doc, com.normalErr);
exports.set_tasks_by_userid = (userid, tasks) => Tasks.findOneAndUpdate({userid},
    {$set: {tasks}}, {new: true}).then(doc => doc, com.normalErr);
exports.set_tasks_phone_by_userid = (userid, phone) =>
    Tasks.findOneAndUpdate({userid}, {$set: {phone}}, {new: true})
        .then((doc) => doc, com.normalErr);
exports.set_tasks_state_by_userid = (userid, state) =>
    Tasks.findOneAndUpdate({userid}, {$set: {state}}, {new: true})
        .select('userid phone state').then((doc) => doc, com.normalErr);
exports.get_tasks_by_range = (start, step) =>
    Tasks.find().skip(start).limit(step).then(doc => doc, com.normalErr);
exports.get_tasks_by_condition = (condition) =>
    Tasks.find(condition).select('userid phone state').then(doc => doc, com.normalErr);
// --------------------------- Orders ---------------------------
const OrdersSchema = new Schema({
    userid: {type: Number, required: true},
    order: {type: String, required: true},
    ownerid: {type: Number, required: false},
    cost: {type: Number, required: true},
    gems: {type: Number, required: true},
    gems_before: {type: Number, required: true},
    code: {type: String, required: true},
    create_time: {type: Date, required: true},
    pay_time: {type: Date, required: true},
});

const Orders = db.model('Orders', OrdersSchema);

exports.get_orders_by_userid = (userid, index, limit, startDate, endDate) => {
    let data = {};
    if (userid) {
        data.userid = userid;
    }
    if (startDate && !Number.isNaN(parseInt(startDate)) &&
        endDate && !Number.isNaN(parseInt(endDate))) {
        data.create_time = {$gte: new Date(parseInt(startDate)), $lt: new Date(parseInt(endDate))};
    }
    return Orders.find(data)
        .sort({create_time: -1})
        .skip(index)
        .limit(limit)
        .lean()
        .then((doc) => {
            if (!doc) return doc;
            return doc;
        }, com.normalErr);
};
//-----------------------------Mail--------------------------------
const accessorySchema = new Schema({
    gems: {type: Number, default: 0}
});
const MailSchema = new Schema({
    type: {type: String, required: true},
    title: {type: String, default: ''},
    des: {type: String, default: ''},
    from: {type: Number, default: -1},
    to: {type: Number, required: true},
    state: {type: Number, default: 0}, //0:未读 1：已读
    accessory: accessorySchema,
    create_time: {type: String, required: true}
});

const Mail = db.model('Mail', MailSchema);

exports.create_mail = (type, title, des, from, to, gems) => {
    let data = {};
    data.type = type;
    if (title)
        data.title = title;
    if (des)
        data.des = des;
    if (from)
        data.from = from;
    data.to = to;
    data.state = 0;
    data.accessory = {};
    if (gems)
        data.accessory.gems = gems;
    data.create_time = com.custimest(1);
    return Mail.create(data).then(doc => doc, com.normalErr);
};

exports.get_all_mails = () =>
    Mail.find().then(doc => doc, com.normalErr);

exports.get_mails_by_userId = userId =>
    Mail.find({to: userId}).then(doc => doc, com.normalErr);
exports.get_mail_by_id = (id) => {
    let _id = db.mongo.ObjectId(id);
    return Mail.findOne({_id}).then(doc => doc, com.normalErr);
};
exports.set_mail_state_by_id = (id, state) => {
    let _id = db.mongo.ObjectId(id);
    return Mail.findOneAndUpdate({_id}, {state}, {new: true}).then(doc => doc, com.normalErr);
};

exports.del_mail_by_id = (id) => {
    let _id = db.mongo.ObjectId(id);
    return Mail.findOneAndRemove({_id}).then(doc => doc, com.normalErr);
};
exports.del_mail_by_useIdAndid = (userId, id) => {
    let _id = db.mongo.ObjectId(id);
    return Mail.findOneAndRemove({to: userId, _id}).then(doc => doc, com.normalErr);
};