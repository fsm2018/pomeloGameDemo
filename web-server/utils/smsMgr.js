const sms = require('aliyunsms');
const com = require('./com');
const redisDB = require('../db/redis_db');

const config = {};
config.accessKeyID = 'LTAI0OlGtzSLEHQm';
config.accessKeySecret = 'W39bnXpHrDTOtBAPihiGq2DXr79l5Z';

async function addPhone(phone) {
  try {
    const pc = await redisDB.getPhoneCode(phone);
    const now = com.timest(true);
    if (pc && (now - parseInt(pc.time, 10)) <= 60) {
      return false;
    }
    const code = com.generateSixId();
    await redisDB.addPhoneCode(phone, code, now);
    return code;
  } catch (error) {
    return false;
  }
}

async function delPhone(phone, vcode) {
  try {
    const pc = await redisDB.getPhoneCode(phone);
    if (!pc) return false;

    const old = parseInt(pc.time, 10);
    const now = com.timest(true);

    if ((now - old) > 60) {
      return 1;
    } else if (vcode !== pc.code) {
      return 2;
    }
    redisDB.delPhoneCode(phone);
    return 0;
  } catch (error) {
    return 2;
  }
}

async function sendCheckPhoneMSG(phone) {
  const code = await addPhone(phone);
  if (!code) {
    return false;
  }

  const conf = {};
  conf.accessKeyID = config.accessKeyID;
  conf.accessKeySecret = config.accessKeySecret;
  conf.recNum = [];
  conf.recNum.push(phone);
  conf.paramString = { code, product: '手机号码验证' };
  conf.signName = '鸿时游戏';
  conf.templateCode = 'SMS_25580008';

  return sms.send(conf).then(() => true).catch(() => false);
}
exports.sendCheckPhoneMSG = sendCheckPhoneMSG;

async function verity(phone, vcode) {
  const ret = await delPhone(phone, vcode);

  return ret;
}
exports.verity = verity;
