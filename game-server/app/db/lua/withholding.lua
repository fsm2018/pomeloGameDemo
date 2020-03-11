local type = ARGV[1]
local c = ARGV[2]
local flag = ARGV[3]

if (flag) then
    local ret = redis.call('hincrby', KEYS[1], type, c);
    return ret;
else
    local ret = redis.call('hmget', KEYS[1], type);
    return ret;
end
