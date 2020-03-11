let configs;
// 从配置文件获取服务器信息
console.log('conf file :');

if (process.argv[2]) {
    console.log(process.argv[2]);
    configs = require(process.argv[2]);
} else {
    console.log(process.env.conf);
    configs = require(process.env.conf);
}

exports.getConf = () => {
    return configs;
};
