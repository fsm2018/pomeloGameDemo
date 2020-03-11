const http = require('http');
const https = require('https');
const qs = require('querystring');

String.prototype.format = function (args) {
  let result = this;
  if (arguments.length > 0) {
    if (arguments.length == 1 && typeof (args) === 'object') {
      for (const key in args) {
        if (args[key] != undefined) {
          var reg = new RegExp(`({${key}})`, 'g');
          result = result.replace(reg, args[key]);
        }
      }
    }		else {
      for (let i = 0; i < arguments.length; i++) {
        if (arguments[i] != undefined) {
					// var reg = new RegExp("({[" + i + "]})", "g");//这个在索引大于9时会有问题，谢谢何以笙箫的指出
          var reg = new RegExp(`({)${i}(})`, 'g');
          result = result.replace(reg, arguments[i]);
        }
      }
    }
  }
  return result;
};

exports.post = function (host, port, path, data, callback) {
  const content = qs.stringify(data);
  const options = {
    hostname: host,
    port,
    path: `${path}?${content}`,
    method: 'GET',
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
			// console.log('BODY: ' + chunk);
      callback(chunk);
    });
  });

  req.on('error', (e) => {
    console.log(`problem with request: ${e.message}`);
  });

  req.end();
};

exports.get2 = function (uri, data, safe) {
  let url = uri;
  if (data) {
    const content = qs.stringify(data);
    url = `${url}?${content}`;
  }

  let proto = http;
  if (safe) {
    proto = https;
  }

  return new Promise((resolve, reject) => {
    // console.log(url);
    const req = proto.get(url, (res) => {
			// console.log('STATUS: ' + res.statusCode);
			// console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      let ch = '';
      res.on('data', (chunk) => {
				// console.log('BODY: ' + chunk);
        ch += chunk;
      });

      res.on('end', () => {
        const a = JSON.parse(ch);
        resolve(a);
      });
    });

    req.on('error', (e) => {
      console.log(`problem with request: ${e.message}`);
      reject(e);
    });

    req.end();
  });
};

exports.get = function (host, port, path, data, callback, safe) {
  const content = qs.stringify(data);
  const options = {
    hostname: host,
    path: `${path}?${content}`,
    method: 'GET',
  };
  if (port) {
    options.port = port;
  }
  let proto = http;
  if (safe) {
    proto = https;
  }

  return new Promise((resolve, reject) => {
    const req = proto.request(options, (res) => {
			// console.log('STATUS: ' + res.statusCode);
			// console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
				// console.log('BODY: ' + chunk);
        try {
          const json = JSON.parse(chunk);
          resolve(json);
        } catch (e) {
          console.log(`problem with Json parse: ${chunk}`);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.log(`problem with request: ${e.message}`);
      reject(e);
    });

    req.end();
  });
};
