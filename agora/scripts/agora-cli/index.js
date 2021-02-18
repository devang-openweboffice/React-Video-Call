"use strict";
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
const dotenv = require("dotenv");
const { buildRTMToken } = require("./RTM/RtmTokenBuilderSample");
dotenv.config();

const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

const argv = require("minimist")(process.argv.slice(2));
const users = [];

// Push all arguments with -u
if (Array.isArray(argv.u)) {
  argv.u?.map((user) => {
    users.push(user);
  });
} else if (argv.u) {
  users.push(argv.u);
}

// Push all arguments with --user
if (Array.isArray(argv.user)) {
  argv.user?.map((user) => {
    users.push(user);
  });
} else if (argv.user) {
  users.push(argv.user);
}

// Use default channel if no channel is provided
const channelName = argv.channel || argv.c || "on24";
const userMapping = {};
const screenId = argv["screen-id"] || 500;
const ttl = argv.ttl || 3600;
const currentTime = Math.floor(Date.now() / 1000);
const privilegeExpireTime = currentTime + ttl;
const userTokens = {};

users.map((user) => {
  const [name, roleString] = user.split(":");

  let role = RtcRole.SUBSCRIBER;
  if (roleString === "p") {
    role = RtcRole.PUBLISHER;
  }
  let uid = name.split(/([0-9]+)/)[1] || Math.floor(Math.random() * 1000 + 1);
  if (name === "moderator") {
    uid = "9999";
  }

  const screenUid = screenId + +uid;
  userMapping[uid] = name;

  const videoToken = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    role,
    privilegeExpireTime
  );
  const screenToken = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    screenUid,
    role,
    privilegeExpireTime
  );

  const rtmToken = buildRTMToken(
    APP_ID,
    APP_CERTIFICATE,
    uid,
    privilegeExpireTime
  );
  userTokens[name] = {
    uid,
    token: videoToken,
    screenToken,
    rtmToken,
  };
  //   // return the token
  //   return resp.json({ token: token });
});

const finalJson = {
  secrets: {
    appId: APP_ID,
    appCertificate: APP_CERTIFICATE,
  },
  usermap: userMapping,
  screenId,
  users: userTokens,
};
console.log(JSON.stringify(finalJson, null, 4));
