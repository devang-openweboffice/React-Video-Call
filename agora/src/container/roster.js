import React from "react";

function Roster({
  userName,
  audioEnable,
  videoEnable,
  main,
  sendMessageToPeerID,
  loginUserName,
  peerId,
}) {
  const handleToggle = (peerId, type) => {
    if (loginUserName === "moderator" && userName !== loginUserName && peerId) {
      console.log(userName + ": ICON CLICKED: " + type, peerId);
      sendMessageToPeerID(peerId, type);
    }
  };
  return (
    <p
      style={{
        display: "flex",
        justifyContent: "space-around",
        fontWeight: "bold",
        alignItems: "baseline",
        color: "#FFF",
        fontSize: 30,
      }}
    >
      <span style={{ fontSize: main ? 20 : 15 }}>{userName || "moderator"}</span>
      {!main && (
        <span className={
        loginUserName === "moderator"
          ? "ag-btn-sidenav"
          : "ag-btn-sidenav disabled"}>
          {audioEnable ? (
            <i
              className="ag-icon ag-icon-mic-off"
              onClick={() => handleToggle(peerId, "audio")}
            ></i>
          ) : (
            <i
              className="ag-icon ag-icon-mic"
              onClick={() => handleToggle(peerId, "audio")}
            ></i>
          )}
        </span>
      )}
      {!main && (
        <span className={
        loginUserName === "moderator"
          ? "ag-btn-sidenav"
          : "ag-btn-sidenav disabled"}>
          {videoEnable ? (
            <i
              className="ag-icon ag-icon-camera-off"
              onClick={() => handleToggle(peerId, "video")}
            ></i>
          ) : (
            <i
              className="ag-icon ag-icon-camera"
              onClick={() => handleToggle(peerId, "video")}
            ></i>
          )}
        </span>
      )}
    </p>
  );
}

export default Roster;
