var redis = require('redis');

var client = null;

exports.init = function (config) {
    client = redis.createClient(config.PORT, config.HOST, config.options);
    client.on('error', (error) => {
        console.error('redis 连接失败', error);
    });

    client.on('ready', (err) => {
        console.log('redis : ready', err);
    });

    client.on('connect', () => {
        console.log('redis : connect');
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
        if (field) {
            client.hmget(key, field, (err, ret) => {
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
        if (key && field) {
            client.hincrby(key, field, c, (err, ret) => {
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
}

function sadd(key, m) {
    return new Promise((resolve, reject) => {
        if (key && m) {
            client.sadd(key, m, (err, ret) => {
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
}

function smembers(key) {
    return new Promise((resolve, reject) => {
        if (key) {
            client.smembers(key, (err, ret) => {
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
}

function sismember(key, m) {
    return new Promise((resolve, reject) => {
        if (key && m) {
            client.sismember(key, m, (err, ret) => {
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
}

function expire(key, s) {
    return new Promise((resolve, reject) => {
        if (key) {
            client.expire(key, s, (err, ret) => {
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


// 设置临时订单
function setOrderWxp(data, s) {
    const key = `wxp_${data.order}`;
    let time = s;
    if (!time) time = 60 * 60 * 24;
    return hmset(key, data).then(() => expire(key, time)).then(() => true).catch((err) => {
        console.log(err);
        return false;
    });
}

exports.setOrderWxp = setOrderWxp;

// 获取临时订单
function getOrderWxpByField(order, field) {
    const key = `wxp_${order}`;
    return hmget(key, field).then(ret => ret).catch((err) => {
        console.log(err);
        return false;
    });
}

exports.getOrderWxpByField = getOrderWxpByField;

exports.delOrderWxp = (order) => {
    const key = `wxp_${order}`;
    return del(key).then(ret => ret).catch(() => false);
};


// 获取代理的反卡数据
function getAgentProfit(ownerid, t) {
    const key = `agent_${ownerid}_${t}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        console.log(err);
        return false;
    });
}

exports.getAgentProfit = getAgentProfit;


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


function getRoomInfo(roomId) {
    const key = `Room_${roomId}`;
    return hgetall(key).then(ret => ret).catch((err) => {
        logger.error('getRoomInfo:', err);
        return false;
    });
}

exports.getRoomInfo = getRoomInfo;

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
exports.clearKeys = async (prefix) => {
    let keys = await getkeys(prefix + '*').then(ret => ret).catch(() => false);
    if (keys) {
        let cmds = Commonds('del', keys);
        return execMultiCommands(cmds).then(ret => ret).catch(() => false);
    } else {
        return false;
    }
};
exports.addnewAgent = (userid) => {
    let now = new Date();
    let date = `${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`;
    let key = `newagent${date}`;
    let data = {};
    data.userid = userid;
    return lpush(key, JSON.stringify(data)).then(ret => ret).catch(() => false);
};