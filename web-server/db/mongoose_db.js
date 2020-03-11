const db = require('mongoose');
const com = require('../utils/com');
db.Promise = global.Promise;

db.set('useFindAndModify', false);

const Schema = db.Schema;

exports.init = function (config) {
    db.connect(config.url, {useNewUrlParser: true, autoIndex: false});
    const con = db.connection;
    con.on('error', () => {
        console.error('mongodb 连接失败');
    });
    con.once('open', () => {
        //成功连接
        console.debug('mongodb 连接成功');
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
        return doc.baseID;
    } catch (error) {
        console.log(error);
        return false;
    }
}

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
    first_login: {type: Number, default: 1}, //绑定代理后 首次登录 0:未登录 1:已经登录过
    myclubs: [],//我拥有的clubs
    req_clubs: [],//邀请我的clubs
    clubs: [],//我加入的clubs
    qualification_eclub: {type: Number, default: 0}, //体验club资格 0:没有 1:有
    xl_openid_pomelo: String,
    sign: {type: String, default: ''}
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
exports.get_user_data_by_unionid = unionid => Users.findOne({unionid}).then((doc) => {
    if (!doc) return doc;
    return doc;
}, com.normalErr);
exports.update_user_openid_by_unionid = (unionid, openid) =>
    Users.findOneAndUpdate({unionid}, {$set: {openid}}, {new: true})
        .then(doc => doc, com.normalErr);

exports.get_user_data_by_userid = (userid) => Users.findOne({userid}).then(doc => doc, com.normalErr);

exports.update_user_agent = (userid, ownerid, createTime, gems) => {
    if (!com.isNumber(gems)) return false;
    return Users.findOneAndUpdate({userid},
        {$set: {ownerid, create_time: createTime}, $inc: {gems}},
        {new: true}).then(doc => doc, com.normalErr);
};

exports.updateVerifyCount = async (userid, c) => {
    const count = c || 1;
    Users.findOneAndUpdate({userid},
        {$inc: {verifyCount_week: count, verifyCount_mon: count, verifyCount_quarter: count}},
        {new: true}).then(doc => doc, com.normalErr);
};
exports.getUserByXLOpenID = (xl_openid_pomelo) => Users.findOne({xl_openid_pomelo}).then(doc => doc, com.normalErr);

exports.get_clist = (ownerid, userid, index, limit, t) => {
    const q = {};
    q.ownerid = ownerid;
    if (userid) q.userid = userid;
    return Users.find(q)
        .select(`userid name gems create_time record_${t}.mon_cost record_${t}.buy_mon_pomelo re_time`)
        .sort({create_time: -1})
        .skip(index)
        .limit(limit)
        .lean()
        .then((doc) => {
            if (!doc) return doc;
            return doc;
        }, com.normalErr);
};

exports.wxpay_result = async (userid, out_trade_no, ownerid, cost, gems, code, create_time, pay_time) => {
    if (!com.isNumber(gems)) return false;
    try {
        const user = await exports.get_user_data_by_userid(userid);
        if (!user) return false;
        let isFirst = false;
        if (!user.first_charge || user.first_charge === 0) {
            isFirst = true;
        }

        const ret = await addOrder(userid, out_trade_no, ownerid, cost, gems, user.gems, code, create_time, pay_time);
        if (ret) {
            if (!await wxPayResult(userid, cost, gems, code, isFirst)) {
                console.log('user数据保存失败');
                if (!await ret.remove()) {
                    console.log('数据库操作异常，无法删除订单数据');
                }
                return false;
            }
            return true;
        }
        return false;
    } catch (error) {
        console.log(error);
    }
};

function wxPayResultGold(userid, rmb, gold) {
    const query = {};
    query.rmb = rmb;
    // 充值直接到银行
    query.gold_bank = gold;
    return Users.findOneAndUpdate({userid},
        {$inc: query, $set: {first_charge: 1}},
        {new: true})
        .then(doc => doc, com.normalErr);
}

function wxPayResult(userid, rmb, gems, code, isFirst) {
    const t = code.substr(0, 3);

    // 金币充值直接走金币结算
    if (t === 'god') {
        return wxPayResultGold(userid, rmb, gems);
    }

    const query = {};
    query.rmb = rmb;
    if (t === 'vip') {
        query.vgems = gems;
        query['record_vgems.buy_mon'] = gems;
        query['record_vgems.buy_total'] = gems;
    } else {
        query.gems = gems;
    }

    if (t === 'jsp') {
        query['record_gems.buy_mon_pomelo'] = gems;
        // if (isFirst) {
        //     // 首充翻倍计算充值房卡，结算时再按10%计算结果则首充赠送20%的房卡
        //     query['record_gems.buy_mon'] = parseInt(gems * 2, 10);
        // }
        query['record_gems.buy_total_pomelo'] = gems;
        query['record_gems.buy_rebate'] = gems;
    }

    return Users.findOneAndUpdate({userid},
        {$inc: query, $set: {first_charge: 1}},
        {new: true})
        .then(doc => doc, com.normalErr);
}

exports.getOwnerBuyMon = (ownerid) => {
    const o = {};
    o.query = {ownerid, 'record_gems.buy_mon': {$gt: 0}};
    o.map = function () {
        emit(this.ownerid, this.record_gems.buy_mon);
    };
    o.reduce = function (k, vals) {
        return Array.sum(vals);
    };

    return Users.mapReduce(o).then((docs) => {
        if (docs.length) {
            return docs[0].value;
        }
        return 0;
    }, com.normalErr);
};

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

function addOrder(userid, order, ownerid, cost, gems, gems_before, code, create_time, pay_time) {
    return Orders.create({
        userid,
        order,
        ownerid,
        cost,
        gems,
        gems_before,
        code,
        create_time,
        pay_time
    }).then(doc => doc, com.normalErr);
}

function delOrder(out_trade_no) {
    return Orders.remove({order: out_trade_no}).then(doc => true).catch((err) => {
        console.log(err);
        return false;
    });
}

exports.get_orders = (userid, index, limit) => Orders.find({userid})
    .sort({create_time: -1})
    .skip(index)
    .limit(limit)
    .lean()
    .then((doc) => {
        if (!doc) return doc;
        return doc;
    }, com.normalErr);

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
exports.get_alltasks = () => Tasks.find().then(doc => doc, com.normalErr);
