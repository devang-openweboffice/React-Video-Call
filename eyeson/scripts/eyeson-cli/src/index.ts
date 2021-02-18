import Axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.AUTHORIZATION_KEY) {
  throw new Error("AUTHORIZATION_KEY is not found in .env");
}

const argv = require("minimist")(process.argv.slice(2));
const users: any[] = [];
const room = argv.r || argv.room || "on24";

// Push all arguments with -u
if (Array.isArray(argv.u)) {
  argv.u?.map((user: any) => {
    users.push(user);
  });
} else if (argv.u) {
  users.push(argv.u);
}

// Push all arguments with --user
if (Array.isArray(argv.user)) {
  argv.user?.map((user: any) => {
    users.push(user);
  });
} else if (argv.user) {
  users.push(argv.user);
}

const promises: Promise<AxiosResponse<any>>[] = [];
const usersData: any = {};

async function main() {
  users.map((user) => {
    const future = generateToken(room, user);
    promises.push(future);
  });

  const responses = await Promise.all(promises);
  responses.map((response) => {
    usersData[response.data.user.name] = {
      // id: response.data.user.id,
      accessKey: response.data["access_key"],
      roomName: response.data.room.name,
      // roomId: response.data.room.id,
      // userName: response.data.user.name,
      // links: response.data.links,
    };
  });
  const finalJSON = {
    secrets: {
      authorizationKey: process.env.AUTHORIZATION_KEY,
    },
    users: usersData,
  };
  console.log(JSON.stringify(finalJSON, null, 2));
}

async function generateToken(
  roomName: String,
  userName: String
) {
  const config: AxiosRequestConfig = {
    method: "post",
    url: "https://api.eyeson.team/rooms",
    headers: {
      Authorization: process.env.AUTHORIZATION_KEY,
    },
    params: {
      "user[name]": userName,
      "user[id]": userName,
      id: roomName,
      name: roomName,
      "options[guest_token_available]": "false"
    },
  };
  return Axios(config);
}

main();
