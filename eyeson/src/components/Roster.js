import React from "react";
import { IconButton } from "@rmwc/icon-button";
import { Button } from "@rmwc/button";
import { Checkbox } from "@rmwc/checkbox";

function Roster({
  userName,
  audioEnable,
  videoEnable,
  main,
  loginUserName,
  podium,
  peerId,
  voiceActivity,
  sendMessageToRoom,
  userDemoLink,
  onMouseDown,
  selected,
  handleCheckboxSelect,
}) {
  // console.log("peerId", peerId);
  const handleToggle = (type) => {
    console.log(userName + ": ICON CLICKED: " + type);
    if (loginUserName === "moderator" && userName !== loginUserName && peerId) {
      sendMessageToRoom([peerId], type);
    }
  };
  const onPodium = (id) => {
    return podium.indexOf(id) !== -1;
  };
  const onAudioEnable = (id) => {
    const index = voiceActivity.findIndex((i) => i.id === id);
    if (index !== -1) {
      return voiceActivity[index]["audioMuted"];
    } else {
      return true;
    }
  };
  const handleClick = (link) => {
    if (link) {
      window.open(link);
    }
  };
  const user_name = userName || "moderator";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-around",
        fontWeight: "bold",
        alignItems: "center",
        color: "#FFF",
        fontSize: 30,
      }}
    >
      <span
        style={{ fontSize: main ? 20 : 15 }}
        onClick={() => handleClick(userDemoLink)}
      >
        {main ? <Button label={user_name} /> : user_name}
      </span>
      {!main && (
        <IconButton
          checked={audioEnable}
          onClick={() => handleToggle("audio")}
          label="Toggle audio"
          icon={onAudioEnable(peerId) ? "mic" : "mic_off"}
          disabled={loginUserName !== "moderator"}
          onMouseDown={onMouseDown}
        />
      )}
      {!main && (
        <IconButton
          checked={videoEnable}
          onClick={() => handleToggle("video")}
          label="Toggle video"
          icon={onPodium(peerId) ? "videocam" : "videocam_off"}
          disabled={loginUserName !== "moderator"}
          onMouseDown={onMouseDown}
        />
      )}
      {/* {(!main && loginUserName === "moderator") && (
        <Checkbox
        checked={selected}
        onChange={evt => handleCheckboxSelect(peerId, !!evt.currentTarget.checked)}
      />
      )} */}
    </div>
  );
}

export default Roster;
