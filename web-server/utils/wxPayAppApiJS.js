const request = require("request");
const crypto = require('crypto');
const fs = require('fs');
const configs = require('../../shared/config/config');
const key = configs.wechat().Wpp.key;
const appId = configs.wechat().Wpp.appId;

const WxPay = {
    getXMLNodeValue: function (node_name, xml) {
        var tmp = xml.split("<" + node_name + ">");
        var _tmp = tmp[1].split("</" + node_name + ">");
        return _tmp[0];
    },

    raw: function (args) {
        var keys = Object.keys(args);
        keys = keys.sort();
        var newArgs = {};
        keys.forEach(function (key) {
            newArgs[key] = args[key];
        });
        var string = '';
        for (var k in newArgs) {
            string += '&' + k + '=' + newArgs[k];
        }
        string = string.substr(1);
        return string;
    },
    paysignjs: function (appid, nonceStr, package, timeStamp) {
        var ret = {
            appId: appid,
            nonceStr: nonceStr,
            package: package,
            signType: "MD5",
            timeStamp: timeStamp
        };
        var string = this.raw(ret);
        string = string + '&key=' + key;
        var sign = crypto.createHash('md5').update(string, 'utf8').digest('hex');
        return sign.toUpperCase();
    },

    paysignjsapi: function (appid, attach, body, mch_id, nonce_str, notify_url, openid, out_trade_no, spbill_create_ip, total_fee, trade_type) {
        var ret = {
            appid: appid,
            attach: attach,
            body: body,
            mch_id: mch_id,
            nonce_str: nonce_str,
            notify_url: notify_url,
            openid: openid,
            out_trade_no: out_trade_no,
            spbill_create_ip: spbill_create_ip,
            total_fee: total_fee,
            trade_type: trade_type
        };
        var string = this.raw(ret);
        string = string + '&key=' + key; //key为在微信商户平台(pay.weixin.qq.com)-->账户设置-->API安全-->密钥设置
        // console.log(string);
        var crypto = require('crypto');
        var sign = crypto.createHash('md5').update(string, 'utf8').digest('hex');
        return sign.toUpperCase();
    },

    // 随机字符串产生函数
    createNonceStr: function () {
        return Math.random().toString(36).substr(2, 15);
    },

    // 时间戳产生函数
    createTimeStamp: function () {
        return parseInt(new Date().getTime() / 1000) + '';
    }, // 此处的attach不能为空值 否则微信提示签名错误
    order: function (attach, body, mch_id, openid, ip, bookingNo, total_fee, notify_url) {
        var appid = appId;
        var nonce_str = this.createNonceStr();
        var timeStamp = this.createTimeStamp();
        var url = "https://api.mch.weixin.qq.com/pay/unifiedorder";
        var formData = "<xml>";
        formData += "<appid>" + appid + "</appid>"; //appid
        formData += "<attach>" + attach + "</attach>"; //附加数据
        formData += "<body>" + body + "</body>";
        formData += "<mch_id>" + mch_id + "</mch_id>"; //商户号
        formData += "<nonce_str>" + nonce_str + "</nonce_str>"; //随机字符串，不长于32位。
        formData += "<notify_url>" + notify_url + "</notify_url>";
        formData += "<openid>" + openid + "</openid>";
        formData += "<out_trade_no>" + bookingNo + "</out_trade_no>";
        formData += "<spbill_create_ip>" + ip + "</spbill_create_ip>";
        formData += "<total_fee>" + total_fee + "</total_fee>";
        formData += "<trade_type>JSAPI</trade_type>";
        formData += "<sign>" + this.paysignjsapi(appid, attach, body, mch_id, nonce_str, notify_url, openid, bookingNo, ip, total_fee, 'JSAPI') + "</sign>";
        formData += "</xml>";
        var self = this;
        // console.log(formData);
        return new Promise((resolve, reject) => {
            request({
                url: url,
                method: 'POST',
                body: formData
            }, function (err, response, body) {
                if (!err && response.statusCode == 200) {
                    console.log(body);
                    var prepay_id = self.getXMLNodeValue('prepay_id', body.toString("utf-8"));
                    // console.log(prepay_id);
                    var tmp = prepay_id.split('[');
                    // console.log(tmp);
                    var tmp1 = tmp[2].split(']');
                    // console.log(tmp1);
                    //签名
                    var _paySignjs = self.paysignjs(appid, nonce_str, 'prepay_id=' + tmp1[0], timeStamp);
                    var args = {
                        appId: appid,
                        timeStamp: timeStamp,
                        nonceStr: nonce_str,
                        signType: "MD5",
                        package: 'prepay_id=' + tmp1[0],
                        paySign: _paySignjs
                    };
                    // console.log(args);
                    resolve(args);
                } else {
                    console.log(body);
                    reject(err);
                }
            });
        });
    },

    //支付回调通知
    notify: function (obj) {
        var output = "";
        if (obj.return_code == "SUCCESS") {
            var reply = {
                return_code: "SUCCESS",
                return_msg: "OK"
            };

        } else {
            var reply = {
                return_code: "FAIL",
                return_msg: "FAIL"
            };
        }

        //output = ejs.render(messageTpl, reply);
        return output;
    },
    sendredpacksign: function (act_name, client_ip, mch_billno, mch_id,
                               nonce_str, re_openid, remark, scene_id, send_name,
                               total_amount, total_num, wishing, wxappid) {
        var ret = {
            act_name,
            client_ip,
            mch_billno,
            mch_id,
            nonce_str,
            re_openid,
            remark,
            scene_id,
            send_name,
            total_amount,
            total_num,
            wishing,
            wxappid
        };
        var string = this.raw(ret);
        string = string + '&key=' + key; //key为在微信商户平台(pay.weixin.qq.com)-->账户设置-->API安全-->密钥设置
        // console.log(string);
        var crypto = require('crypto');
        var sign = crypto.createHash('md5').update(string, 'utf8').digest('hex');
        return sign.toUpperCase();
    },
    sendredpack: function (mch_billno, mch_id, send_name, re_openid,
                           total_amount, total_num, wishing, client_ip,
                           act_name, remark) {
        var wxappid = appId;
        var scene_id = 'PRODUCT_3';
        var nonce_str = this.createNonceStr();
        var url = "https://api.mch.weixin.qq.com/mmpaymkttransfers/sendredpack";
        var formData = "<xml>";
        formData += "<act_name>" + act_name + "</act_name>"; //活动名称
        formData += "<client_ip>" + client_ip + "</client_ip>"; //Ip地址
        formData += "<mch_billno>" + mch_billno + "</mch_billno>"; //商户订单号
        formData += "<mch_id>" + mch_id + "</mch_id>"; //商户号
        formData += "<nonce_str>" + nonce_str + "</nonce_str>"; //随机字符串，不长于32位
        formData += "<re_openid>" + re_openid + "</re_openid>"; //用户openid
        formData += "<remark>" + remark + "</remark>"; //备注
        formData += "<scene_id>" + scene_id + "</scene_id>"; //场景id
        formData += "<send_name>" + send_name + "</send_name>"; //商户名称
        formData += "<total_amount>" + total_amount + "</total_amount>"; //付款金额
        formData += "<total_num>" + total_num + "</total_num>"; //红包发放总人数
        formData += "<wishing>" + wishing + "</wishing>"; //红包祝福语
        formData += "<wxappid>" + wxappid + "</wxappid>"; //公众账号appid
        formData += "<sign>" + this.sendredpacksign(act_name, client_ip, mch_billno, mch_id,
            nonce_str, re_openid, remark, scene_id, send_name,
            total_amount, total_num, wishing, wxappid) + "</sign>"; //签名
        formData += "</xml>";
        var self = this;
        return new Promise((resolve, reject) => {
            request({
                url: url,
                method: 'POST',
                body: formData,
                key: fs.readFileSync('../../configs/cer/apiclient_key.pem'), //将微信生成的证书放入 cert目录
                cert: fs.readFileSync('../../configs/cer/apiclient_cert.pem')
            }, function (err, response, body) {
                if (!err && response.statusCode == 200) {
                    console.log(body);
                    var return_msg = self.getXMLNodeValue('return_msg', body.toString("utf-8"));
                    return_msg = return_msg.replace('<![CDATA[', '')
                        .replace(']]', '')
                        .replace('>', '');
                    var result_code = self.getXMLNodeValue('result_code', body.toString("utf-8"));
                    result_code = result_code.replace('<![CDATA[', '')
                        .replace(']]', '')
                        .replace('>', '');
                    if (result_code === 'FAIL') {
                        return_msg = self.getXMLNodeValue('err_code', body.toString("utf-8"));
                        return_msg = return_msg.replace('<![CDATA[', '')
                            .replace(']]', '')
                            .replace('>', '');
                    }
                    resolve({result_code, return_msg});
                } else {
                    console.log(body);
                    reject(err);
                }
            });
        });
    },
    companiespaysign: function (amount, check_name, desc, mch_appid, mchid, nonce_str, openid,
                                partner_trade_no, re_user_name, spbill_create_ip) {
        var ret = {
            amount, check_name, desc, mch_appid, mchid, nonce_str, openid,
            partner_trade_no, re_user_name, spbill_create_ip
        };
        var string = this.raw(ret);
        string = string + '&key=' + key; //key为在微信商户平台(pay.weixin.qq.com)-->账户设置-->API安全-->密钥设置
        // console.log(string);
        var crypto = require('crypto');
        var sign = crypto.createHash('md5').update(string, 'utf8').digest('hex');
        return sign.toUpperCase();
    },
    companiespay: function (amount, check_name, desc, mchid, openid, partner_trade_no, re_user_name, spbill_create_ip) {
        var nonce_str = this.createNonceStr();
        var mch_appid = appId;
        var url = "https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers";
        var formData = "<xml>";
        formData += "<amount>" + amount + "</amount>"; //金额
        formData += "<check_name>" + check_name + "</check_name>"; //校验用户姓名选项
        formData += "<desc>" + desc + "</desc>"; //企业付款备注
        formData += "<mch_appid>" + mch_appid + "</mch_appid>"; //活动名称
        formData += "<mchid>" + mchid + "</mchid>"; //商户号
        formData += "<nonce_str>" + nonce_str + "</nonce_str>"; //随机字符串，不长于32位
        formData += "<openid>" + openid + "</openid>"; //用户openid
        formData += "<partner_trade_no>" + partner_trade_no + "</partner_trade_no>"; //商户订单号
        formData += "<re_user_name>" + re_user_name + "</re_user_name>"; //收款用户姓名
        formData += "<spbill_create_ip>" + spbill_create_ip + "</spbill_create_ip>"; //Ip地址
        formData += "<sign>" + this.companiespaysign(amount, check_name, desc, mch_appid, mchid, nonce_str, openid,
            partner_trade_no, re_user_name, spbill_create_ip) + "</sign>"; //签名
        formData += "</xml>";
        var self = this;
        return new Promise((resolve, reject) => {
            request({
                url: url,
                method: 'POST',
                body: formData,
                key: fs.readFileSync('../../configs/cer/apiclient_key.pem'), //将微信生成的证书放入 cert目录
                cert: fs.readFileSync('../../configs/cer/apiclient_cert.pem')
            }, function (err, response, body) {
                if (!err && response.statusCode == 200) {
                    console.log(body);
                    var return_msg = self.getXMLNodeValue('return_msg', body.toString("utf-8"));
                    return_msg = return_msg.replace('<![CDATA[', '')
                        .replace(']]', '')
                        .replace('>', '');
                    var result_code = self.getXMLNodeValue('result_code', body.toString("utf-8"));
                    result_code = result_code.replace('<![CDATA[', '')
                        .replace(']]', '')
                        .replace('>', '');
                    if (result_code === 'FAIL') {
                        return_msg = self.getXMLNodeValue('err_code', body.toString("utf-8"));
                        return_msg = return_msg.replace('<![CDATA[', '')
                            .replace(']]', '')
                            .replace('>', '');
                    }
                    resolve({result_code, return_msg});
                } else {
                    console.log(err);
                    reject(err);
                }
            });
        });
    }
};
module.exports = WxPay;
