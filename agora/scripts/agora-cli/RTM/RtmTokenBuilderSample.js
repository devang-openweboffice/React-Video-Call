const RtmTokenBuilder = require("./src/RtmTokenBuilder").RtmTokenBuilder;
const RtmRole = require("./src/RtmTokenBuilder").Role;

module.exports.buildRTMToken = (
  appID,
  appCertificate,
  account,
  privilegeExpiredTs
) => {
  const token = RtmTokenBuilder.buildToken(
    appID,
    appCertificate,
    account,
    RtmRole,
    privilegeExpiredTs
  );
  return token;
};
