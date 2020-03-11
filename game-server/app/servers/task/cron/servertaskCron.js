const logger = require('pomelo-logger').getLogger('m-debug', __filename);
const codeConfig = require('../../../../../shared/codeConfig');
const com = require('../../../util/com');

const serverTask = require('../../../domain/task/serverTask');

module.exports = function (app) {
    return new Cron(app);
};

var Cron = function (app) {
    this.app = app;
    this.mdb = app.get('mdclient');
    this.rdb = app.get('rdclient');
};

//每日刷新排行榜
Cron.prototype.updateBigWinerRank = async function () {
    logger.info('updateBigWinerRank start');
    let StatisticsGameTypeKeys = Object.keys(codeConfig.StatisticsGameType);
    let index = 0;
    while (index < StatisticsGameTypeKeys.length) {
        let key = StatisticsGameTypeKeys[index];
        let countlist = await this.rdb.getBigWinerCountAll(codeConfig.StatisticsGameType[key]);
        if (countlist)
            await serverTask.updateBigWinerRank(countlist, codeConfig.StatisticsGameType[key]);
        index++;
    }
    logger.info('updateBigWinerRank end');
};

//每日任务
Cron.prototype.DailyTask = async function () {
    logger.info('DailyTask start');
    let nowtime = com.custimest(1);
    let StatisticsGameTypeKeys = Object.keys(codeConfig.StatisticsGameType);
    let self = this;
//每日统计任务
    let todayLogins = await this.rdb.getLoginOrRegister(codeConfig.Statistics.login.today);
    const login = async function (i) {
        if (i >= todayLogins.length) {
            return;
        }
        await self.rdb.addLoginOrRegister(codeConfig.Statistics.login.week, todayLogins[i]);
        await self.rdb.addLoginOrRegister(codeConfig.Statistics.login.month, todayLogins[i]);
        i++;
        await login(i);
    };
    await login(0);

    let todayRegisters = await this.rdb.getLoginOrRegister(codeConfig.Statistics.register.today);
    const register = async function (i) {
        if (i >= todayRegisters.length) {
            return;
        }
        await self.rdb.addLoginOrRegister(codeConfig.Statistics.register.week, todayRegisters[i]);
        await self.rdb.addLoginOrRegister(codeConfig.Statistics.register.month, todayRegisters[i]);
        i++;
        await register(i);
    };
    await register(0);

    let costIndex = 0;
    while (costIndex < StatisticsGameTypeKeys.length) {
        let key = StatisticsGameTypeKeys[costIndex];
        let cost_today = codeConfig.Statistics.cost.today + codeConfig.StatisticsGameType[key];
        let cost_week = codeConfig.Statistics.cost.week + codeConfig.StatisticsGameType[key];
        let cost_month = codeConfig.Statistics.cost.month + codeConfig.StatisticsGameType[key];
        let todaycosts = await this.rdb.getCostCount(cost_today);
        if (todaycosts && todaycosts[codeConfig.GemType.GEM]) {
            await this.rdb.incrCostCount(cost_week, codeConfig.GemType.GEM, todaycosts[codeConfig.GemType.GEM]);
            await this.rdb.incrCostCount(cost_month, codeConfig.GemType.GEM, todaycosts[codeConfig.GemType.GEM]);
        }
        costIndex++;
    }

    await this.rdb.renameLoginOrRegisterToNewKey(codeConfig.Statistics.login.today, codeConfig.Statistics.login.yesterday);
    await this.rdb.renameLoginOrRegisterToNewKey(codeConfig.Statistics.register.today, codeConfig.Statistics.register.yesterday);
    let oldcostIndex = 0;
    while (oldcostIndex < StatisticsGameTypeKeys.length) {
        let key = StatisticsGameTypeKeys[oldcostIndex];
        let now = codeConfig.Statistics.cost.today + codeConfig.StatisticsGameType[key];
        let old = codeConfig.Statistics.cost.yesterday + codeConfig.StatisticsGameType[key];
        await this.rdb.renameCostCountToNewKey(now, old);
        oldcostIndex++;
    }

    //用户日清理
    const maxIndex = await this.mdb.get_base_userid();
    let index = 100000;
    while (index <= maxIndex) {
        let users = await this.mdb.getUsersByRange(index, index + 1000, {'record_gems.sell_today': {$gt: 0}});
        const fun = async function (i) {
            if (i >= users.length)
                return;
            users[i].record_gems.sell_today = 0;
            await users[i].save();
            i++;
            await fun(i);
        };
        await fun(0);
        index += 1000;
    }

    logger.info('daily updateClubHistoryAndBigWinerCount');
    let allclubs = await this.mdb.get_allclubs();
    let clubIndex = 0;
    while (clubIndex < allclubs.length) {
        let club = allclubs[clubIndex];
        let toOldIndex = 0;
        while (toOldIndex < StatisticsGameTypeKeys.length) {
            let key = codeConfig.StatisticsGameType[StatisticsGameTypeKeys[toOldIndex]];
            await this.rdb.renameClubHistoryToOld(club.clubid, key);
            await this.rdb.renameClubBigWinerCountToOld(club.clubid, key);
            await this.rdb.renameClubBattleCountToOld(club.clubid, key);
            toOldIndex++;
        }
        clubIndex++;
    }

    let rollingKeys = Object.keys(codeConfig.rollingnotice_key);
    let rollingIndex = 0;
    while (rollingIndex < rollingKeys.length) {
        let key = rollingKeys[rollingIndex];
        if (key != codeConfig.rollingnotice_key.hg1) {
            await this.rdb.delRollingNotice(codeConfig.rollingnotice_key[key]);
        }
        rollingIndex++;
    }

    logger.info('开始清理邮件');
    let mails = await this.mdb.get_all_mails();
    let mailIndex = 0;
    while (mailIndex < mails.length) {
        let mail = mails[mailIndex];
        let failure = nowtime - parseInt(mail.create_time) >= 86400 * 1000 * 30;
        if (failure) {
            await this.mdb.del_mail_by_id(mail._id);
        }
        mailIndex++;
    }
    logger.info('DailyTask end');
};
//每周任务
Cron.prototype.WeeklyTask = async function () {
    logger.info('WeeklyTask start');
    let StatisticsGameTypeKeys = Object.keys(codeConfig.StatisticsGameType);
//每周统计任务
    await this.rdb.renameLoginOrRegisterToNewKey(codeConfig.Statistics.login.week, codeConfig.Statistics.login.lastweek);
    await this.rdb.renameLoginOrRegisterToNewKey(codeConfig.Statistics.register.week, codeConfig.Statistics.register.lastweek);

    let costIndex = 0;
    while (costIndex < StatisticsGameTypeKeys.length) {
        let key = StatisticsGameTypeKeys[costIndex];
        let cost = codeConfig.Statistics.cost.week + codeConfig.StatisticsGameType[key];
        let cost_old = codeConfig.Statistics.cost.lastweek + codeConfig.StatisticsGameType[key];
        await this.rdb.renameCostCountToNewKey(cost, cost_old);
        costIndex++;
    }

    logger.info('  开始数据清理');
    await this.rdb.clearKeys('History_');
    await this.rdb.clearKeys('BigWinerCount_');
    await this.rdb.clearKeys('BigWinerBoard_');
    logger.info('  结束数据清理');

    logger.info('WeeklyTask end');
};
//每月任务
Cron.prototype.MonthlyTask = async function () {
    logger.info('MonthlyTask start');
    let StatisticsGameTypeKeys = Object.keys(codeConfig.StatisticsGameType);
//每月统计任务
    await this.rdb.renameLoginOrRegisterToNewKey(codeConfig.Statistics.login.month, codeConfig.Statistics.login.lastmonth);
    await this.rdb.renameLoginOrRegisterToNewKey(codeConfig.Statistics.register.month, codeConfig.Statistics.register.lastmonth);

    let costIndex = 0;
    while (costIndex < StatisticsGameTypeKeys.length) {
        let key = StatisticsGameTypeKeys[costIndex];
        let cost = codeConfig.Statistics.cost.month + codeConfig.StatisticsGameType[key];
        let cost_old = codeConfig.Statistics.cost.lastmonth + codeConfig.StatisticsGameType[key];
        await this.rdb.renameCostCountToNewKey(cost, cost_old);
        costIndex++;
    }

    //用户月清理
    const maxIndex = await this.mdb.get_base_userid();
    let index = 100000;
    while (index <= maxIndex) {
        let users = await this.mdb.getUsersByRange(index, index + 1000,
            {
                $or: [
                    {'record_gems.buy_mon_pomelo': {$gt: 0}},
                    {'record_gems.mon_cost': {$gt: 0}},
                    {'record_gems.sell_mon': {$gt: 0}}
                ]
            });
        const fun = async function (i) {
            if (i >= users.length)
                return;
            // users[i].record_gems.sell_last_mon = users[i].record_gems.sell_mon;
            users[i].record_gems.mon_cost = 0;
            users[i].record_gems.buy_mon_pomelo = 0;
            users[i].record_gems.sell_mon = 0;
            await users[i].save();
            i++;
            await fun(i);
        };
        await fun(0);
        index += 1000;
    }

    logger.info('mon updateClubHistoryAndBigWinerCount');
    let allclubs = await this.mdb.get_allclubs();
    let clubIndex = 0;
    while (clubIndex < allclubs.length) {
        let club = allclubs[clubIndex];
        let toOldIndex = 0;
        while (toOldIndex < StatisticsGameTypeKeys.length) {
            let key = codeConfig.StatisticsGameType[StatisticsGameTypeKeys[toOldIndex]];
            await this.rdb.renameClubBattleMonCountToOld(club.clubid, key);
            toOldIndex++;
        }
        clubIndex++;
    }

    logger.info('MonthlyTask end');
};
