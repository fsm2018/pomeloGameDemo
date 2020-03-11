exports.retCode = {
    OK: 0,
    FAIL: -1,
    LOGIN_FIRST: -110,
    MAINTAIN: -111,

    GATE: {},
    CONNECTOR: {
        TOKEN_EXPIRED: -2,
        HAD_UPDATE: -3,
        FORCE_UPDATE: -4
    },
    HALL: {
        XL_BIND_HAD: -2,

        HAD_IN_ROOM: -2,

        ENTER_ROOM_FULL: -2,
        ENTER_ROOM_FAIL: -3,
        ENTER_CLUB_ROOM_NOT_MEMBER: -4,
        ENTER_CLUB_ROOM_CLOSEING: -5
    },
    CLUB: {
        HAD_ECLUB: -2,
        LIMIT_CLUBS: -3,
        NOT_CLUB_MEMBER: -4
    },
    GM: {
        CLUB_HAS_OWNER: -2
    },
    TASK: {
        NEED_PHONE: -2
    }
};

exports.gameRetCode = {
    OK: 0,
    FAIL: -1,
};

exports.gameType = {
    mj_hz: 3,
    d_buckle_hz: 2,
    pushing_hz: 4
};
exports.StatisticsGameType = {
    mj2_hz: 32,
    mj4_hz: 34,
    dbuckle4_hz: 24,
    pushing3_hz: 43,
    pushing4_hz: 44
};

exports.createRoomType = {
    normal: 1,
    empty: 2,
    club: 3,
    hallgame: 4
};
exports.roomType = {
    experience: 0,
    normal: 1,
};
exports.GemType = {
    GEM: 'gems',
    VGEM: 'vgems',
};

exports.Statistics = {
    register: {
        today: 'TodayRegister',
        yesterday: 'YesterdayRegister',
        week: 'WeekRegister',
        lastweek: 'LastweekRegister',
        month: 'MonthRegister',
        lastmonth: 'LastmonthRegister'
    },
    login: {
        today: 'TodayLogin',
        yesterday: 'YesterdayLogin',
        week: 'WeekLogin',
        lastweek: 'LastweekLogin',
        month: 'MonthLogin',
        lastmonth: 'LastmonthLogin'
    },
    cost: {
        today: 'TodayCost',
        yesterday: 'YesterdayCost',
        week: 'WeekCost',
        lastweek: 'LastweekCost',
        month: 'MonthCost',
        lastmonth: 'LastmonthCost'
    }
};

exports.lock_key = {
    room: 'Room_',
    task: 'task_',
    rebate: 'rebate_',
    sellgems: 'sellgems_',
    mail:'mail_'
};

exports.rollingnotice_key = {
    hg1: "hg1", //大厅游戏胜利条件
    hzmj3201: "hzmj3201"
};

exports.mailtype = {
    notice:'notice',
    hallgame_hzmj3201_reward:'hallgame_hzmj3201_reward'
};