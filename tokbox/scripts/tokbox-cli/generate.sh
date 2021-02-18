#!/bin/bash -xe
HOUR_1=$((60*60))
HOUR_24=$((HOUR_1*24))
DAYS=${1:-1}
TTL=$((HOUR_24*DAYS))
./node_modules/.bin/tsc
node ./dist/index.js -u moderator:mod -u user1:pub -u user2:pub -u user3:pub -u user4:pub -u user5:pub -u user6:pub  --ttl $TTL > config.json
cp config.json ../../src/
