local userId = ARGV[1]
local name = ARGV[2]
local headimg = ARGV[3]
local sex = ARGV[4]
local address = ARGV[5]
local online = ARGV[6]
local ip = ARGV[7]
local ready = ARGV[8]
local forced = ARGV[9]
local seatIndex = ARGV[10]

local low = seatIndex
if (forced) then
    redis.call("hmset", KEYS[1],
            "seat_" .. low, userId, "seat_name_" .. low, name,
            "sex_" .. low, sex, "headimg_" .. low, headimg,
            "seat_address_" .. low, address, "seat_online_" .. low, online,
            "seat_ip_" .. low, ip, "seat_ready_" .. low, ready);
else
    local ret = redis.call("hgetall", KEYS[1])
    local roomInfo = {}
    for i = 1, #ret, 2 do
        roomInfo[ret[i]] = ret[i + 1]
    end
    local max = tonumber(cjson.decode(roomInfo['base_info'])["peoplemax"])
    for i = 1, max do
        local k = string.format("seat_%d", i - 1)
        if (roomInfo[k] ~= nil) then
            if (userId == roomInfo[k]) then
                low = i - 1
                break
                --return 0
            end
        elseif (low == -1) then
            low = i - 1
        end
    end

    if low == -1 then
        return 1
    end

    redis.call("hmset", KEYS[1],
            "seat_" .. low, userId, "seat_name_" .. low, name,
            "sex_" .. low, sex, "headimg_" .. low, headimg,
            "seat_address_" .. low, address, "seat_online_" .. low, online,
            "seat_ip_" .. low, ip, "seat_ready_" .. low, ready);
    return 0
end
