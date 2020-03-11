if redis.call('hmget',KEYS[1],KEYS[2])[1] == '1' then
    return 0
else redis.call('hmset',KEYS[1],KEYS[2],1)
    return 1
end
