#!/bin/bash -xe

HOUR_1=$((60*60))
HOUR_24=$((HOUR_1*24))
DAYS=${1:-1}
TTL=$((HOUR_24*DAYS))
./node_modules/.bin/tsc
node dist/index.js -u user1 -u user2 -u user3 -u user4 -u user5 -u user6  -u moderator --room on24 > config.json
cp config.json ../../src/
cp .env ../../.env
source .env
echo AUTHORIZATION_KEY=$AUTHORIZATION_KEY > ../../.env
echo REACT_APP_AUTHORIZATION_KEY=$AUTHORIZATION_KEY >> ../../.env
