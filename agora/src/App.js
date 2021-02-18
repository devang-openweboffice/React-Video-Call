import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";
import AgoraRTC from "agora-rtc-sdk-ng";
import AgoraRTM from "agora-rtm-sdk";
import { PopoverBody, Button, UncontrolledPopover } from "reactstrap";

import $ from "jquery";

import "./App.css";
import { rtc, rtcScreenShare } from "./constants";
import config from "./config.json";

import "./assets/fonts/css/icons.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bulma/css/bulma.css";

import Roster from "./container/roster";

let RTMClient = null;
let screenShareId = null;
let controlPanelTimer = null;

function setScreenShareId(ssid) {
  screenShareId = ssid;
}

const App = () => {
  AgoraRTC.setLogLevel(3);
  const sideNavRef = useRef(null);
  const controlPanelRef = useRef(null);
  const mainRef = useRef(null);
  const [channel, setChannel] = useState("");
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [channelError, setChannelError] = useState("");
  const [layoutType, setLayoutType] = useState("default");
  const [readyState, setReadyState] = useState(false);

  const [isVideoMuted, setVideoMuted] = useState(false);
  const [isAudioMuted, setAudioMuted] = useState(false);

  const [openNavbar, setOpenNavbar] = useState(false);
  const [controlPanelBar, setControlPanelBar] = useState(true);

  const [remoteUsers, setRemoteUsers] = useState([]);

  const [currentUser, setCurrentUser] = useState(null);

  const handleChannel = (e) => {
    setChannel(e.target.value);
    setChannelError("");
  };

  const handleChangeUserName = (e) => {
    setUserName(e.target.value);
    const currentUser = config.users[e.target.value];
    if (currentUser) {
      currentUser.uid = +currentUser.uid;
      setCurrentUser(currentUser);
    }
    setError("");
  };

  // function attachSinkId(element, sinkId) {
  //   if (typeof element.sinkId !== "undefined") {
  //     element
  //       .setSinkId(sinkId)
  //       .then(() => {
  //         console.log(`ON24: Success, audio output device attached: ${sinkId}`);
  //       })
  //       .catch((error) => {
  //         let errorMessage = error;
  //         if (error.name === "SecurityError") {
  //           errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
  //         }
  //         console.error(
  //           "ON24: failed to set audio output device",
  //           sinkId,
  //           errorMessage
  //         );
  //       });
  //   } else {
  //     console.warn("ON24: Browser does not support output device selection.");
  //   }
  // }

  // function updateAudioOutDevice(audioOutDeviceId) {
  //   console.log("ON24: localAudioTrack", rtc.localAudioTrack);
  //   console.log("ON24: localVideoTrack", rtc.localVideoTrack);
  //   document
  //     .querySelectorAll("video")
  //     .forEach((element) => attachSinkId(element, audioOutDeviceId));
  // }

  const handleAudioOutDeviceChange = async (e) => {
    console.log("ON24", "POC: selected audio out:", e.target, e.target.value);
    // await rtc.localAudioTrack.setPlaybackDevice(e.target.value);

    // console.log("set audio for remote users:",remoteUsers);
    remoteUsers.forEach(async (user) => {
      await user.audioTrack.setPlaybackDevice(e.target.value);
    })
  };

  const handleAudioInDeviceChange = async (e) => {
    console.log("ON24: selected Audio In", e.target, e.target.value);
    await rtc.localAudioTrack.setDevice(e.target.value);
  };

  const handleVideoInDeviceChange = async (e) => {
    console.log("ON24: selected Video In", e.target, e.target.value);
    await rtc.localVideoTrack.setDevice(e.target.value);
  };

  const removeRemoteUser = async (user) => {
    const playerContainer = document.getElementById(`play-${user.uid}`);
    playerContainer && playerContainer.remove(); // fixed bug re-join created problem
  };

  const removeRemoteLeftUser = async (user) => {
    const playerContainer = document.getElementById(`play-${user.uid}`);
    // Destroy the container
    console.log("remove user container:", user.uid);
    if (user.uid === screenShareId) {
      setScreenShareId(null);
    }
    playerContainer && playerContainer.remove(); // fixed bug re-join created problem
    const publisherWrapper = document.getElementById("local-stream");
    const subscriberWrapper = document.getElementById("remote-stream");
    if (publisherWrapper && !publisherWrapper.hasChildNodes()) {
      if (subscriberWrapper.hasChildNodes()) {
        const currentTalkDiv = subscriberWrapper.removeChild(
          subscriberWrapper.childNodes[0]
        );
        publisherWrapper.appendChild(currentTalkDiv);
      }
    }
    const remoteUsers = await rtc.client.remoteUsers;
    setRemoteUsers([...remoteUsers]);
  };

  const loadAudioOutputDevices = async (deviceInfos) => {
    let audioOutputs = deviceInfos.filter(
      (deviceInfo) => deviceInfo.kind === "audiooutput"
    );

    rtc.audioOutputDevices = audioOutputs;
    console.log("ON24: audioOutputDevices==>", rtc.audioOutputDevices);

    if (rtc.audioOutputDevices.length > 0) {
      const currentSpeaker = rtc.audioOutputDevices[0];
      $(".audio-out").val(currentSpeaker.deviceId);
    } else {
      console.log("ON24", "POC: error audio out not found");
    }
  };

  let activity = null;
  let console_count = 0;

  const volumeIndicator = (evt) => {
    if (screenShareId) {
      activity = null;
      return;
    }

    if (evt.length > 0) {
      var now = Date.now();

      const highVolume = evt.reduce(function (prev, current) {
        // console.log(current.uid, currentUser.uid, typeof current.uid, typeof currentUser.uid, current.level > prev.level);
        return current.uid !== currentUser.uid && current.level > prev.level
          ? current
          : prev;
      });

      if (activity && activity.uid === highVolume.uid) {
        activity.timestamp = now;
      } else if (!activity || activity.uid !== highVolume.uid) {
        activity = {
          ...highVolume,
          timestamp: now,
          talking: true,
        };

        let talkDiv = document.getElementById(`play-${highVolume.uid}`);

        const publisherWrapper = document.getElementById("local-stream");
        const subscriberWrapper = document.getElementById("remote-stream");

        if (talkDiv !== null) {
          if (publisherWrapper !== null && publisherWrapper.hasChildNodes()) {
            let currentTalkDiv = publisherWrapper.removeChild(
              publisherWrapper.childNodes[0]
            );
            subscriberWrapper.appendChild(currentTalkDiv);

            let newTalkDiv = subscriberWrapper.removeChild(talkDiv);
            publisherWrapper.appendChild(newTalkDiv);
          } else if (
            publisherWrapper !== null &&
            !publisherWrapper.hasChildNodes()
          ) {
            publisherWrapper.appendChild(talkDiv); // Screen share stop and render the div
          }
        }
      }

      if (console_count++ % 5 === 0) {
        console.log(console_count, screenShareId, "talking", activity);
      }
    }
  };

  const addRemoteUser = async (user, mediaType, callback) => {
    console.log("ON24: addRemoteUser:", user, mediaType);
    await rtc.client.subscribe(user, mediaType);

    const userName = Object.keys(config.users).find(
      (key) => +config.users[key].uid === user.uid
    );

    // Dynamically create a container in the form of a DIV element for playing the remote video track.
    var playerContainer = document.getElementById(`play-${user.uid}`);
    if (!playerContainer) {
      console.log("creating playerContainer", playerContainer);
      playerContainer = React.createElement(
        "div",
        {
          id: `play-${user.uid}`,
          className: "stream",
        },
        React.createElement("div", { className: "user-label" }, userName)
      );
      var temp = document.createElement("div");
      ReactDOM.render(playerContainer, temp);

      document
        .getElementById("remote-stream")
        .appendChild(temp.querySelector(`#play-${user.uid}`));
    }

    if (mediaType === "video" || mediaType === "all") {
      // Get `RemoteVideoTrack` in the `user` object.
      const remoteVideoTrack = user.videoTrack;
      console.log(`ON24: remoteVideoTrack ${remoteVideoTrack}`);

      console.log(`ON24: play-${user.uid}`);

      user.videoTrack.play(`play-${user.uid}`);
    }

    if (mediaType === "audio" || mediaType === "all") {
      // Get `RemoteAudioTrack` in the `user` object.
      const remoteAudioTrack = user.audioTrack;
      const audioOutDeviceId = rtc.audioOutputDevices[0];
      console.log(
        "ON24",
        "POC: audioOutDeviceId:",
        audioOutDeviceId,
        remoteAudioTrack
      );
      // Play the audio track. Do not need to pass any DOM element
      remoteAudioTrack.play();
    }
    const remoteUsers = await rtc.client.remoteUsers;
    setRemoteUsers([...remoteUsers]);
    if (user.uid > config.screenId && callback) {
      callback();
    }
  };

  async function handleSubmit() {
    console.log(currentUser, userName, config.users);

    if (!currentUser) {
      setError(`${userName} not found`);
      return;
    }

    try {
      rtc.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      const uid = await rtc.client.join(
        config.secrets.appId,
        channel,
        currentUser.token,
        currentUser.uid
      );

      RTMClient = AgoraRTM.createInstance(config.secrets.appId);

      RTMClient.login({
        token: currentUser.rtmToken,
        uid: currentUser.uid.toString(),
      })
        .then(() => {
          console.log("ON24: AgoraRTM client login success");
        })
        .catch((err) => {
          console.log("ON24: AgoraRTM client login failure", err);
        });

      setJoined(true);
      // Create an audio track from the audio captured by a microphone
      rtc.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      // Create a video track from the video captured by a camera
      rtc.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

      rtc.audioInputDevices = await AgoraRTC.getMicrophones();
      rtc.videoInputDevices = await AgoraRTC.getCameras();

      const audioOutputSelectedEnable = "sinkId" in HTMLMediaElement.prototype;
      if (audioOutputSelectedEnable) {
        /* Audio out use native library no support in OT */
        navigator.mediaDevices.enumerateDevices().then(loadAudioOutputDevices);
      }

      // const audioInputDevices = await AgoraRTC.getMicrophones();
      const currentMic = rtc.audioInputDevices[0];
      $(".audio-in").val(currentMic.deviceId);

      const videoInputDevices = await AgoraRTC.getCameras();
      const currentCam = videoInputDevices[0];
      $(".video-in").val(currentCam.deviceId);

      console.log("ON24: client", rtc.client, AgoraRTC);
      AgoraRTC.getDevices().then((device) =>
        console.log("ON24: devices", device)
      );

      console.log("ON24: video devices", rtc.videoInputDevices);
      console.log("ON24: audio devices", rtc.audioInputDevices);

      const userName = Object.keys(config.users).find(
        (key) => +config.users[key].uid === uid
      );

      const LocalPlayerContainer = React.createElement(
        "div",
        {
          id: `play-${uid}`,
          className: "stream",
        },
        React.createElement("div", { className: "user-label" }, userName)
      );
      console.log("creating playerContainer", LocalPlayerContainer);

      ReactDOM.render(
        LocalPlayerContainer,
        document.getElementById("local-stream")
      );

      rtc.localVideoTrack.play(`play-${uid}`);

      // Triggers the "volume-indicator" callback event every two seconds.
      rtc.client.enableAudioVolumeIndicator();
      // let activity = null;

      rtc.client.on("volume-indicator", volumeIndicator);

      // Enable dual-stream mode.
      const remoteUsers = await rtc.client.remoteUsers;
      setRemoteUsers([...remoteUsers]);
      console.log("ON24: current RemoteUsers", remoteUsers);

      rtc.client.remoteUsers.forEach((user) => {
        // Destroy the dynamically created DIV container
        if (user.hasAudio) addRemoteUser(user, "audio");
        if (user.hasVideo) {
          addRemoteUser(user, "video", () => {
            changeTheFocusForSharedScreen(user);
          });
        }
      });

      rtc.client.on("user-published", (user, mediaType) => {
        // Subscribe to a remote user
        console.log(
          "ON24: event:user-published",
          user,
          mediaType,
          screenShareId
        );
        if (screenShareId !== user.uid) {
          // I dont want to look the shared screen for myself
          addRemoteUser(user, mediaType || "all", () => {
            console.log("user-published called", screenShareId);
            changeTheFocusForSharedScreen(user);
          });
        }
      });

      rtc.client.on("user-left", (user, leftReason) => {
        console.log("event:user-left", user, leftReason);
        removeRemoteLeftUser(user);
      });

      rtc.client.on(
        "connection-state-change",
        (curState, prevState, disconnecReason) => {
          console.log(
            "event:connection-state-change",
            "curState",
            curState,
            "prevState",
            prevState,
            "disconnectReason",
            disconnecReason
          );
          // setJoined(curState !== "DISCONNECTED");
          if (curState === "DISCONNECTED") {
            setOpenNavbar(false);
            setVideoMuted(false);
            setAudioMuted(false);
            setUserName(null);
            setCurrentUser(null);
            setRemoteUsers([]);
            setScreenShareId(null);
            setJoined(false);
          }
        }
      );

      rtc.client.on("user-unpublished", async (user) => {
        // Get the dynamically created DIV container
        console.log(
          "ON24: event:user-unpublished",
          user,
          user.hasVideo,
          user.hasAudio
        );
        const remoteUsers = await rtc.client.remoteUsers;
        setRemoteUsers([...remoteUsers]);
      });

      rtc.client.on("user-info-updated", async () => {
        const remoteUsers = await rtc.client.remoteUsers;
        setRemoteUsers([...remoteUsers]);
      });

      // Publish the local audio and video tracks to the channel
      await rtc.client.publish([rtc.localAudioTrack, rtc.localVideoTrack]);

      RTMClient.on("MessageFromPeer", ({ text }, peerId) => {
        console.log("Get MessageFromPeer", text, peerId);
        if (config.usermap[peerId] === "moderator") {
          console.log("command from moderator", text, peerId);
          const peerMessage = JSON.parse(text);
          if (peerMessage?.type === "video") {
            handleCamera();
          } else if (peerMessage?.type === "audio") {
            handleMic();
          }
        }
      });

      setReadyState(true);
      setControlPanelBar(false);
      console.log("ON24: publish success!");
    } catch (error) {
      setJoined(false);
      const message = error.message.split(":")[1];
      console.error(`:${message}:`);
      if (message.match("dynamic key expired")) setChannelError(message);
      else setChannelError("Verify room name and username ");
    }
  }

  const handleLeave = async () => {
    try {
      const localContainer = document.getElementById("local-stream");

      rtc.localAudioTrack.close();
      rtc.localVideoTrack.close();

      setJoined(false);
      setOpenNavbar(false);
      setVideoMuted(false);
      setAudioMuted(false);
      setUserName(null);
      setCurrentUser(null);
      localContainer.textContent = "";

      // Traverse all remote users
      rtc.client.remoteUsers.forEach((user) => {
        // Destroy the dynamically created DIV container
        removeRemoteUser(user);
      });
      setRemoteUsers([]);
      if (screenShareId) endScreenShare();

      RTMClient.logout();
      // Leave the channel
      await rtc.client.leave();
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessageToPeerID = (peerId, toggleType) => {
    const message = JSON.stringify({
      command: "toggle-mute",
      type: toggleType,
      userId: peerId,
    });
    console.log("sending message to peer:", message);
    RTMClient.sendMessageToPeer({ text: message }, peerId.toString())
      .then((sendResult) => {
        if (sendResult.hasPeerReceived) {
          console.log(`ON24: Message Send To perrID ${peerId}`, sendResult);
          /* Your code for handling the event that the remote user receives the message. */
        } else {
          /* Your code for handling the event that the message is received by the server but the remote user cannot be reached. */
        }
      })
      .catch((error) => {
        console.log("ON24: error", error);
        /* Your code for handling the event of a message send failure. */
      });
  };

  const handleSwithDisplay = () => {
    console.log("ON24: handleSwithDisplay current:", layoutType);
    setLayoutType(layoutType === "default" ? "horizontal" : "default");
  };

  useEffect(() => {
    let canvas = document.querySelector("#ag-canvas");
    let btnGroup = document.querySelector(".ag-btn-group");
    if (canvas !== null) {
      canvas.addEventListener("mousemove", () => {
        if (global._toolbarToggle) {
          clearTimeout(global._toolbarToggle);
        }
        btnGroup.classList.add("active");
        global._toolbarToggle = setTimeout(function () {
          btnGroup.classList.remove("active");
        }, 2000);
      });
    }
    // window.addEventListener("keypress", (e) => {
    //   e.keyCode === 13 && handleSubmit();
    // });
  }, []);

  const handleCamera = async (e) => {
    if (rtc?.localVideoTrack) {
      const { _enabled } = rtc?.localVideoTrack;
      await rtc.localVideoTrack.setEnabled(!_enabled);
      _enabled
        ? rtc.localVideoTrack.stop()
        : rtc.localVideoTrack.play(`play-${currentUser.uid}`);
      console.log("POC: handleCamera.isPlaying", _enabled);
      setVideoMuted(_enabled);
    }
  };

  const handleMic = async (e) => {
    if (rtc?.localAudioTrack) {
      const { _enabled } = rtc?.localAudioTrack;
      await rtc.localAudioTrack.setEnabled(!_enabled);
      console.log("POC: handleMic._enabled", _enabled);
      setAudioMuted(_enabled);
    }
  };

  const videoControlBtn = (
    // this.props.attendeeMode === "video" ? (
    <span
      onClick={handleCamera}
      className="ag-btn"
      title="Enable/Disable Video"
    >
      {isVideoMuted ? (
        <i className="ag-icon ag-icon-camera-off"></i>
      ) : (
        <i className="ag-icon ag-icon-camera"></i>
      )}
    </span>
  );

  const audioControlBtn = (
    <span onClick={handleMic} className="ag-btn" title="Enable/Disable Audio">
      {isAudioMuted ? (
        <i className="ag-icon ag-icon-mic-off"></i>
      ) : (
        <i className="ag-icon ag-icon-mic"></i>
      )}
    </span>
  );

  const switchDisplayBtn = (
    <span
      onClick={handleSwithDisplay}
      className={
        remoteUsers.length > 4
          ? "ag-btn displayModeBtn disabled"
          : "ag-btn displayModeBtn"
      }
      title="Switch Display Mode"
    >
      <i className="ag-icon ag-icon-switch-display"></i>
    </span>
  );
  // const hideRemoteBtn = (
  //   <span
  //     // className={
  //     //   this.state.streamList.length > 4 || this.state.displayMode !== "pip"
  //     //     ? "ag-btn disableRemoteBtn disabled"
  //     //     : "ag-btn disableRemoteBtn"
  //     // }
  //     className={"ag-btn disableRemoteBtn"}
  //     // onClick={this.hideRemote}
  //     title="Hide Remote Stream"
  //   >
  //     <i className="ag-icon ag-icon-remove-pip"></i>
  //   </span>
  // );

  const exitBtn = (
    <span
      onClick={handleLeave}
      className={readyState ? "ag-btn exitBtn" : "ag-btn exitBtn disabled"}
      // className={"ag-btn exitBtn"}
      title="Exit"
    >
      <i className="ag-icon ag-icon-leave"></i>
    </span>
  );

  const handleNavBar = () => {
    setOpenNavbar((prev) => !prev);
  };

  useEffect(() => {
    if (openNavbar) {
      sideNavRef.current.style.width = "300px";
      mainRef.current.style.marginRight = "300px";
    } else {
      sideNavRef.current.style.width = "0";
      mainRef.current.style.marginRight = "0";
    }
  }, [openNavbar]);

  useEffect(() => {
    if (controlPanelRef.current) {
      // console.log("controlPanelBar:",controlPanelBar);
      if (controlPanelBar) {
        controlPanelRef.current.style.height = "60px";
      } else {
        controlPanelRef.current.style.height = "15px";
      }
    }
  }, [controlPanelBar]);

  let audioOutputSelectBox = <div></div>;
  // const audioOutputSelectedEnable = "sinkId" in HTMLMediaElement.prototype;
  // if (audioOutputSelectedEnable) {
  //   audioOutputSelectBox = (
  //     <select
  //       className="audio-out browser-default custom-select"
  //       onChange={handleAudioOutDeviceChange}
  //     >
  //       {rtc.audioOutputDevices.map((option, i) => (
  //         <option key={i} value={option.deviceId}>
  //           Audio Output: {option.label}
  //         </option>
  //       ))}
  //     </select>
  //   );
  // }

  const endScreenShare = async () => {
    if (rtcScreenShare.localScreenTrack) {
      rtcScreenShare.localScreenTrack.close();
      await rtcScreenShare.client.leave();
    }
    setScreenShareId(null);
  };

  const startScreenCall = async () => {
    if (screenShareId) return;
    setScreenShareId(config.screenId + currentUser.uid);

    rtcScreenShare.client = AgoraRTC.createClient({
      mode: "rtc",
      codec: "vp8",
    });

    try {
      rtcScreenShare.localScreenTrack = await AgoraRTC.createScreenVideoTrack();

      await rtcScreenShare.client.join(
        config.secrets.appId,
        channel,
        currentUser.screenToken,
        config.screenId + currentUser.uid
      );

      await rtcScreenShare.client.publish(rtcScreenShare.localScreenTrack);
      rtcScreenShare.localScreenTrack.getMediaStreamTrack().onended = () => {
        endScreenShare();
      };
    } catch (error) {
      console.log(error);
      endScreenShare();
    }
    console.log(
      "currentUser.uid",
      currentUser.uid,
      "screenShareId",
      screenShareId
    );
  };

  const changeTheFocusForSharedScreen = (user) => {
    if (
      !screenShareId &&
      user.uid > config.screenId &&
      screenShareId !== user.uid
    ) {
      setScreenShareId(user.uid);
      let playerContainer = document.getElementById(`play-${user.uid}`);

      const publisherWrapper = document.getElementById("local-stream");
      const subscriberWrapper = document.getElementById("remote-stream");

      if (publisherWrapper !== null && publisherWrapper.hasChildNodes()) {
        let currentPublisher = publisherWrapper.removeChild(
          publisherWrapper.childNodes[0]
        );
        subscriberWrapper.appendChild(currentPublisher);
      }

      if (playerContainer !== null) {
        let currentTalkdiv = subscriberWrapper.removeChild(playerContainer);
        publisherWrapper.appendChild(currentTalkdiv);
      }
    }
  };

  const screenShareBtn = (
    <span
      className={
        screenShareId && screenShareId !== currentUser?.uid + config.screenId
          ? "ag-btn disableRemoteBtn disabled"
          : "ag-btn disableRemoteBtn"
      }
      style={{
        pointerEvents:
          screenShareId && screenShareId !== currentUser?.uid + config.screenId
            ? "none"
            : "all",
      }}
      onClick={
        screenShareId && screenShareId === currentUser?.uid + config.screenId
          ? endScreenShare
          : startScreenCall
      }
      title="Screenshare"
    >
      <i className="ag-icon ag-icon-screen-share"></i>
    </span>
  );

  return (
    <>
      <div className="full" ref={mainRef}>
        {!joined && (
          <div className="wrapper index">
            <div className="ag-header"></div>
            <div className="ag-main">
              <section className="login-wrapper">
                <div className="login-header">
                  <img src={require("./assets/images/ag-logo.png")} alt="" />
                </div>
                <div className="login-body">
                  <div className="columns">
                    <div className="column is-12">
                      <div className="channel-wrapper control has-icons-left">
                        <input
                          onChange={handleChannel}
                          id="channel"
                          className={"user-input ag-rounded input"}
                          type="text"
                          placeholder="Enter the room name"
                        />
                        <span className="icon is-small is-left">
                          <img
                            src={require("./assets/images/ag-login.png")}
                            alt=""
                          />
                        </span>
                        {channelError !== "" && (
                          <div className="validate-msg">{channelError}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="columns">
                    <div className="column is-12">
                      <div className="channel-wrapper control has-icons-left">
                        <input
                          onInput={handleChangeUserName}
                          id="userid"
                          className={`user-input ag-rounded input ${
                            error !== "" ? "is-danger" : ""
                          }`}
                          type="text"
                          placeholder="Enter the username"
                        />
                        <span className="icon is-small is-left">
                          <img
                            src={require("./assets/images/ag-login.png")}
                            alt=""
                          />
                        </span>
                        {error !== "" && (
                          <div className="validate-msg">{error}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="login-footer">
                  <input
                    type="button"
                    onClick={handleSubmit}
                    disabled={channel === "" || userName === ""}
                    className="ag-rounded button is-info"
                    value={"Join"}
                  />
                </div>
              </section>
            </div>
          </div>
        )}
        {joined ? (
          <>
            <div className="wrapper meeting">
              {/* <div className="ag-header">
                <div className="ag-header-lead">
                  <img
                    className="header-logo"
                    src={require("./assets/images/ag-logo.png")}
                    alt=""
                  />
                  <span>AgoraWeb</span>
                </div>
                <div className="ag-header-msg">
                  Room:&nbsp;<span id="room-name">{channel}</span>
                </div>
                <div className="ag-header-msg">
                  <span
                    style={{ fontSize: 30, cursor: "pointer" }}
                    onClick={handleNavBar}
                  >
                    &#9776;
                  </span>
                </div>
              </div> */}
              <div className="ag-main">
                <div className="ag-container">
                  <div id="ag-canvas">
                    <div
                      className="ag-btn-group active controlPanelRef"
                      ref={controlPanelRef}
                      onMouseEnter={() => {
                        clearInterval(controlPanelTimer);
                        setControlPanelBar(true);
                      }}
                      onMouseLeave={() => {
                        controlPanelTimer = setTimeout(
                          () => controlPanelBar && setControlPanelBar(false),
                          1500
                        );
                      }}
                    >
                      {controlPanelBar && (
                        <>
                          <div className={"setting-icon-wrapper"}>
                            <Button id="PopoverLegacy" type="button">
                              <img
                                alt="settings"
                                src={require("./assets/images/settings.svg")}
                                width="40px"
                              />
                            </Button>
                            <UncontrolledPopover
                              trigger="legacy"
                              placement="auto"
                              target="PopoverLegacy"
                            >
                              <PopoverBody>
                                {" "}
                                <div className="popover-wrapper">
                                  {audioOutputSelectBox}
                                  <select
                                    className="audio-in browser-default custom-select"
                                    onChange={handleAudioOutDeviceChange}
                                  >
                                    {rtc.audioOutputDevices.map((option, i) => (
                                      <option key={i} value={option.deviceId}>
                                        Audio Output: {option.label}
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    className="audio-in browser-default custom-select"
                                    onChange={handleAudioInDeviceChange}
                                  >
                                    {rtc.audioInputDevices.map((option, i) => (
                                      <option key={i} value={option.deviceId}>
                                        Audio Input: {option.label}
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    className="video-in browser-default custom-select"
                                    onChange={handleVideoInDeviceChange}
                                  >
                                    {rtc.videoInputDevices.map((option, i) => (
                                      <option key={i} value={option.deviceId}>
                                        Video Input: {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </PopoverBody>
                            </UncontrolledPopover>
                          </div>

                          {exitBtn}
                          {videoControlBtn}
                          {audioControlBtn}
                          {switchDisplayBtn}
                          {/*hideRemoteBtn*/}
                          {screenShareBtn}
                          <div className="ag-btn ag-header-msg">
                            <span
                              style={{ fontSize: 30, cursor: "pointer" }}
                              onClick={handleNavBar}
                            >
                              &#9776;
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div id="local-stream" className="local-stream stream"></div>
                  <div
                    id="remote-stream"
                    // ref={remoteRef}
                    className={`remote-stream ${layoutType}`}
                  ></div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
      <div className="sidenav" ref={sideNavRef}>
        {/* <a
          href="javascript:void(0)"
          className="closebtn"
          onClick={handleNavBar}
        >
          &times;
        </a> */}
        {rtc?.client && (
          <>
            <Roster
              userName={userName}
              audioEnable={isAudioMuted}
              videoEnable={isVideoMuted}
              main={true}
              sendMessageToPeerID={sendMessageToPeerID}
              loginUserName={userName}
            />
            <hr />
          </>
        )}
        {remoteUsers.map((item) => {
          if (item.uid > config.screenId) {
            return null;
          } else {
            return (
              <Roster
                key={item.uid}
                userName={config.usermap[item.uid]}
                audioEnable={!item.hasAudio}
                videoEnable={!item.hasVideo}
                sendMessageToPeerID={sendMessageToPeerID}
                loginUserName={userName}
                peerId={item.uid}
              />
            );
          }
        })}
      </div>
    </>
  );
};

export default App;
