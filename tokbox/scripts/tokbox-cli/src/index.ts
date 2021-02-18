import OpenTok, { Role, Session } from "opentok";
import dotenv from "dotenv";

const argv = require("minimist")(process.argv.slice(2));

dotenv.config();
if (!process.env.API_KEY || !process.env.API_SECRET) {
  throw new Error("credentials not found");
}
const opentok = new OpenTok(process.env.API_KEY, process.env.API_SECRET);
const finalJson: any = {
  apiKey: process.env.API_KEY,
};

async function main() {
  // Media mode

  let mediaMode: "routed" | "relayed" = argv["media-mode"];
  if (mediaMode != "routed" && mediaMode != "relayed") {
    mediaMode = "routed";
  }
  const ttl = (new Date().getTime()/1000) + (parseInt(argv["ttl"]) || 60*60*24) //1hour
  // Setting session id
  const sessionId =
    argv["session-id"] ||
    argv["s"] ||
    (await createSession(mediaMode)).sessionId;
  finalJson["sessionId"] = sessionId;
  finalJson["users"] = {};

  // Setting users
  const users = [];
  if (Array.isArray(argv.u)) {
    argv.u?.map((user: any) => {
      const splitResult = user.split(":");
      const userName = String(splitResult[0]);
      const role = getRole(String(splitResult[1]));
      users.push({ userName, role });
    });
  } else if (argv.u) {
    const splitResult = argv.u.split(":");
    const userName = String(splitResult[0]);
    const role = getRole(String(splitResult[1]));
    users.push({ userName, role });
  }

  users.map((user) => {
    const token = opentok.generateToken(sessionId, {
      data: `name=${user.userName}`,
      role: user.role,
      expireTime: ttl
    });
    finalJson["users"][user.userName] = { token };
  });
  console.log(JSON.stringify(finalJson, null, 4));
}

function createSession(mediaMode: "relayed" | "routed"): Promise<Session> {
  return new Promise((resolve, reject) => {
    opentok.createSession({ mediaMode }, (err: Error, session: Session) => {
      if (err) {
        reject(err);
      }
      resolve(session);
    });
  });
}
function getRole(role: string): Role {
  if (role == "mod") {
    return "moderator";
  } else if (role == "pub") {
    return "publisher";
  }
  return "subscriber";
}
main();
