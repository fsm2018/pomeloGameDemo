var http = require('http');
var https = require('https');
var qs = require('querystring');
const logger = require('pomelo-logger').getLogger('m-debug',__filename);

exports.get2 = function (uri, data, safe) {
    let url = uri;
    if (data) {
        let content = qs.stringify(data);
        url = url + '?' + content;
    }

    var proto = http;
    if (safe) {
        proto = https;
    }
    return new Promise((resolve, reject) => {
        logger.info('get2 url:' + url);
        var req = proto.get(url,function (res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                logger.info('chunk' + chunk);
                var json = JSON.parse(chunk);
                resolve(json);
            });
        });

        req.on('error', function (e) {
            logger.error('problem with request: ' + e.message);
            reject(e);
        });

        req.end();
    });
};

exports.verifyReceipt_IAP = function (uri, port, path, data, safe) {
    let url = uri;
    let content;
    if (data) {
        content = JSON.stringify(data);
    }

    var proto = http;
    if (safe) {
        proto = https;
    }

    var options = {
        host: url,
        port: port,
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': content.length
        }
    };

    return new Promise((resolve, reject) => {

        var req = proto.request(options, function (res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                if (res.statusCode === 200) {
                    var json = JSON.parse(chunk);
                    resolve(json);
                } else {
                    reject();
                }
            });
        });

        req.on('error', function (e) {
            console.log('problem with request: ' + e.message);
            reject();
        });

// write data to request body
        req.write(content);

        req.end();
    });
};
