const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const pomelo = require('pomelo');


exports.updateBigWinerRank = async function (bigWinerCountList, rankType) {
    let mdb = pomelo.app.get('mdclient');
    let rdb = pomelo.app.get('rdclient');
    let arr_count = [];
    for (let userId in bigWinerCountList) {
        let data = {};
        data.userId = userId;
        data.count = bigWinerCountList[userId];
        arr_count.push(data);
    }
    arr_count.sort((a, b) => {
        return -(a.count - b.count);
    });

    let data = {};
    let boards = arr_count;
    for (let i = 0; i < boards.length; i++) {
        data[i + 1] = JSON.stringify(boards[i]);
    }
    if (!await rdb.setBigWinerBoard(data, rankType)) {
        logger.error('生成排行榜失败!');
    }
};
