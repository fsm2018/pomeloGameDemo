exports.TOKEN_KEY = 'GKkBWfw9zD9xxB1u';


exports.redis = function () {
    return {
        HOST: 'localhost',
        PORT: 6379,
        options: {
            db: 0
        }
    }
};

exports.mongodb = function () {
    return {
        url: "mongodb://localhost:27017/mj_hz"
    }
};
