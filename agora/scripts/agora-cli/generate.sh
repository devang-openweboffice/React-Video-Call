#!/bin/bash -xe

HOUR_1=$((60*60))
HOUR_24=$((HOUR_1*24))
DAYS=${1:-1}
TTL=$((HOUR_24*DAYS))
node index.js -u user1:p -u user2:p -u user3:p -u user4:p -u user5:p -u user6:p -u moderator:p -c on24 --ttl $TTL --screen-id 10000 > config.json
cp config.json ../../src/
