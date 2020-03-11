const logger = require('pomelo-logger').getLogger('m-debug',__filename);
const pomelo = require('pomelo');

class ClubMgr {
    constructor() {
        this.rdb = pomelo.app.get('rdclient');
        this.mdb = pomelo.app.get('mdclient');
        this.clubInfos = {};
    }

    async loadAllClubInfo() {
        let allclubs = await this.mdb.get_allclubs();
        this.clubInfos = {};
        for (let i = 0; i < allclubs.length; i++) {
            let club = allclubs[i];
            this.clubInfos[club.clubid] = club;
        }
    }

    add_club(clubId, club) {
        this.clubInfos[clubId] = club;
    }

    del_club(clubId) {
        let club = this.clubInfos[clubId];
        if (club)
            delete this.clubInfos[clubId];
    }

    get_clubInfo(clubId) {
        let club = this.clubInfos[clubId];
        if (club) {
            return club;
        }
        return false;
    }

    set_opening(clubId, opening) {
        let club = this.clubInfos[clubId];
        if (club) {
            club.opening = opening;
        }
    }

    set_open_time(clubId, time) {
        let club = this.clubInfos[clubId];
        if (club) {
            club.open_time = time;
        }
    }

    set_close_time(clubId, time) {
        let club = this.clubInfos[clubId];
        if (club) {
            club.close_time = time;
        }
    }

    set_rel_open_time(clubId, time) {
        let club = this.clubInfos[clubId];
        if (club) {
            club.rel_open_time = time;
        }
    }

    set_rel_close_time(clubId, time) {
        let club = this.clubInfos[clubId];
        if (club) {
            club.rel_close_time = time;
        }
    }
}

module.exports = ClubMgr;
