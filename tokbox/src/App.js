/* Let CRA handle linting for sample app */
import React, { Component, useEffect } from "react";
import ReactDOM from "react-dom";
import { Link, useLocation, BrowserRouter as Router } from "react-router-dom";

import Spinner from "react-spinner";
import classNames from "classnames";
import "bootstrap/dist/css/bootstrap.css";

import AccCore from "opentok-accelerator-core";
import "opentok-solutions-css";

import config from "./config.json";
import "./App.scss";

import {
  MDBPopover,
  MDBPopoverBody,
  MDBBtn,
  MDBIcon,
  MDBInput,
} from "mdbreact";

import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap-css-only/css/bootstrap.min.css";
import "mdbreact/dist/css/mdb.css";

let otCore;
const otCoreOptions = {
  credentials: {
    apiKey: config.apiKey,
    sessionId: config.sessionId,
    //token: config.users.moderator.token,
  },
  // A container can either be a query selector or an HTML Element
  streamContainers(pubSub, type, data, stream) {
    return {
      publisher: {
        camera: "#cameraPublisherContainer",
        // screen: "#screenPublisherContainer", // dont need to display for self (publisher)
      },
      subscriber: {
        camera: "#cameraSubscriberContainer",
        screen: "#screenSubscriberContainer",
      },
    }[pubSub][type];
  },
  controlsContainer: "#controls",
  packages: ["screenSharing", "annotation"],
  // packages: ["textChat", "screenSharing", "annotation"],
  communication: {
    callProperties: {
      name: "",
    }, // Using default
  },
  // textChat: {
  //   name: ["David", "Paul", "Emma", "George", "Amanda"][
  //     (Math.random() * 5) | 0
  //   ], // eslint-disable-line no-bitwise
  //   waitingMessage: "Messages will be delivered when other users arrive",
  //   container: "#chat",
  // },
  screenSharing: {
    extensionID: "plocfffmbcclpdifaikiikgplfnepkpo",
    annotation: false,
    externalWindow: false,
    dev: true,
    screenProperties: {
      insertMode: "append",
      width: "100%",
      height: "100%",
      showControls: false,
      style: {
        buttonDisplayMode: "on",
      },
      videoSource: "window",
      fitMode: "contain", // Using default
    },
  },
  annotation: {
    absoluteParent: {
      publisher: ".App-video-container",
      subscriber: ".App-video-container",
    },
  },
};

// let publisher;

/**
 * Build classes for container elements based on state
 * @param {Object} state
 */
const containerClasses = (state) => {
  const { active, meta, localAudioEnabled, localVideoEnabled } = state;

  const sharingScreen = meta ? !!meta.publisher.screen : false;
  const viewingSharedScreen = meta ? meta.subscriber.screen : false;
  const activeCameraSubscribers = meta ? meta.subscriber.camera : 0;
  const activeCameraSubscribersGt2 = activeCameraSubscribers > 2;
  const activeCameraSubscribersOdd = activeCameraSubscribers % 2;
  const screenshareActive = viewingSharedScreen || sharingScreen;

  return {
    controlClass: classNames("App-control-container", { hidden: !active }),
    localAudioClass: classNames("ots-video-control circle audio", {
      hidden: !active,
      muted: !localAudioEnabled,
    }),
    localVideoClass: classNames("ots-video-control circle video", {
      hidden: !active,
      muted: !localVideoEnabled,
    }),
    localCallClass: classNames("ots-video-control circle end-call", {
      hidden: !active,
    }),
    cameraPublisherClass: classNames("video-container", {
      hidden: !active,
      small: !!activeCameraSubscribers || screenshareActive,
      left: screenshareActive,
    }),
    screenPublisherClass: classNames("video-container", {
      hidden: !active || !sharingScreen,
    }),
    cameraSubscriberClass: classNames(
      "video-container",
      { hidden: !active || !activeCameraSubscribers },
      { "active-gt2": activeCameraSubscribersGt2 && !screenshareActive },
      { "active-odd": activeCameraSubscribersOdd && !screenshareActive },
      { small: screenshareActive }
    ),
    screenSubscriberClass: classNames("video-container", {
      hidden: !viewingSharedScreen || !active,
    }),
  };
};

const connectingMask = () => (
  <div className="App-mask">
    <Spinner />
    <div className="message with-spinner">Connecting</div>
  </div>
);

const initState = {
  connected: false,
  active: false,
  publishers: null,
  subscribers: null,
  meta: null,
  localAudioEnabled: true,
  localVideoEnabled: true,
  popoverOpen: false,
  videoInputDevices: [],
  audioInputDevices: [],
  audioOutputDevices: [],
  userName: "",
  cameraPublishers: null,
  audioOutputSelect: true,
  userConnected: {},
  activityState: {},
  subscribedScreenShare: false,
  layoutType: "default",
  userError: "",
};

const resetState = {
  connected: false,
  active: false,
  publishers: null,
  subscribers: null,
  meta: null,
  localAudioEnabled: true,
  localVideoEnabled: true,
  popoverOpen: false,
  //reset except following
  //videoInputDevices: [],
  //audioInputDevices: [],
  //audioOutputDevices: [],
  userName: "",
  cameraPublishers: null,
  audioOutputSelect: true,
  userConnected: {},
  activityState: {},
  subscribedScreenShare: false,
  layoutType: "default",
  userError: "",
};

class App extends Component {

  constructor(props) {
    super(props);
    this.state = initState;
    this.startCall = this.startCall.bind(this);
    this.endCall = this.endCall.bind(this);
    this.toggleLocalAudio = this.toggleLocalAudio.bind(this);
    this.toggleLocalVideo = this.toggleLocalVideo.bind(this);
    this.toggle = this.toggle.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.showPeopleList = this.showPeopleList.bind(this);
    this.closePeopleList = this.closePeopleList.bind(this);
    this.handleAudioInDeviceChange = this.handleAudioInDeviceChange.bind(this);
    this.handleAudioOutDeviceChange = this.handleAudioOutDeviceChange.bind(
      this
    );
    this.handleVideoDeviceChange = this.handleVideoDeviceChange.bind(this);
    this.loadAudioOutputDevices = this.loadAudioOutputDevices.bind(this);

    this.updateVideoDevice = this.updateVideoDevice.bind(this);
    this.updateAudioOutDevice = this.updateAudioOutDevice.bind(this);
    this.updateAudioInDevice = this.updateAudioInDevice.bind(this);
    this.handleLayoutType = this.handleLayoutType.bind(this);

    this.audioInDeviceSelected = null;
    this.audioOutDeviceSelected = null;
    this.videoDeviceSelected = null;
    this.cycleMicrophone;
    let query = new URLSearchParams(window.location.search);
    if(config.users[query.get("username")]) {
      this.state.userName = query.get("username"),
      this.startCall();
    }
  }

  loadAudioOutputDevices(deviceInfos) {
    let audioOutputs = deviceInfos.filter(
      (deviceInfo) => deviceInfo.kind === "audiooutput"
    );
    this.setState({ audioOutDeviceSelected: audioOutputs[0].deviceId });
    this.setState({ audioOutputDevices: audioOutputs });
  }

  handleError(error) {
    console.log(
      "navigator.MediaDevices.getUserMedia error: ",
      error.message,
      error.name
    );
  }

  componentDidMount() {
    const audioOutputSelectedEnable = "sinkId" in HTMLMediaElement.prototype;
    this.setState({ audioOutputSelect: audioOutputSelectedEnable });

    if (audioOutputSelectedEnable) {
      /* Audio out use native library no support in OT */
      navigator.mediaDevices
        .enumerateDevices()
        .then(this.loadAudioOutputDevices)
        .catch(this.handleError);
    }

    let audioInputs;
    let videoInputs;

    OT.getDevices((err, devices) => {
      audioInputs = devices.filter((device) => device.kind === "audioInput");
      videoInputs = devices.filter((device) => device.kind === "videoInput");

      this.setState({
        audioInputDevices: audioInputs,
        videoInputDevices: videoInputs,
      });

      this.setState({ audioInDeviceSelected: audioInputs[0].deviceId });
      this.setState({ videoDeviceSelected: videoInputs[0].deviceId });
    });
  }

  toggle() {
    this.setState({ popoverOpen: true });
  }

  handleChange(e) {
    this.setState({
      userName: e.target.value,
      userError: "",
    });
  }

  handleLayoutType = (layoutType) => {
    this.setState({
      layoutType: layoutType,
    });
  };

  handleChangeLayout = (layoutType) => {
    switch (layoutType) {
      case "horizontal":
        return "horizontal";
      case "vertical":
        return "vertical";
      default:
        return "default";
    }
  };

  updateAudioInDevice() {
    const { cameraPublishers, audioInDeviceSelected } = this.state;
    console.log("updating audio in", audioInDeviceSelected);
    cameraPublishers
      .setAudioSource(audioInDeviceSelected)
      .then(() => console.log("Audio source updated"))
      .catch(this.handleError);
  }

  async handleAudioInDeviceChange(e) {
    const deviceId = e.target.value;
    this.setState({ audioInDeviceSelected: deviceId }, () =>
      this.updateAudioInDevice()
    );
  }

  updateAudioOutDevice() {
    const { audioOutDeviceSelected } = this.state;
    console.log("updating audio out", audioOutDeviceSelected);
    document
      .querySelectorAll("video")
      .forEach((element) => this.attachSinkId(element, audioOutDeviceSelected));
  }

  async handleAudioOutDeviceChange(e) {
    const deviceId = e.target.value;
    this.setState({ audioOutDeviceSelected: deviceId }, () =>
      this.updateAudioOutDevice()
    );
  }

  async updateVideoDevice() {
    const { cameraPublishers, videoDeviceSelected } = this.state;
    let updateDeviceId;

    do {
      await cameraPublishers
        .cycleVideo()
        .then(
          ({ videoDeviceSelected }) => (updateDeviceId = videoDeviceSelected)
        );
    } while (videoDeviceSelected != updateDeviceId && --max_camera);
  }

  handleVideoDeviceChange(e) {
    let max_camera = 3;
    const deviceId = e.target.value;

    this.setState({ videoDeviceSelected: deviceId }, () =>
      this.updateVideoDevice()
    );
  }

  attachSinkId(videoElement, sinkId) {
    // console.log(videoElement.sinkId, sinkId);
    if (typeof videoElement.sinkId !== "undefined") {
      videoElement
        .setSinkId(sinkId)
        .then(() => {
          console.log(`Success, audio output device attached: ${sinkId}`);
        })
        .catch((error) => {
          let errorMessage = error;
          if (error.name === "SecurityError") {
            errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
          }
          console.error(errorMessage);
        });
    } else {
      console.warn("Browser does not support output device selection.");
    }
  }

  async startCall(event) {
    console.log("login as...", this.state.userName);
    if(event) event.preventDefault();
    if (!config.users[this.state.userName]) {
      this.setState({ userError: `user ${this.state.userName} not found` });
      return;
    }

    const newOtCoreOptions = Object.assign(otCoreOptions);
    newOtCoreOptions.credentials.token =
      config.users[this.state.userName].token;

    newOtCoreOptions.communication.callProperties.name = this.state.userName;

    otCore = new AccCore(newOtCoreOptions);

    console.log(otCore.getOptions());

    // We request access to Microphones and Cameras so we can get the labels
    OT.getUserMedia().then((stream) => {
      // Stop the tracks so that we stop using this camera and microphone
      // If you don't do this then cycleVideo does not work on some Android devices
      stream.getTracks().forEach((track) => track.stop());
    });

    otCore.on("connectionCreated", async (event) => {
      const { userConnected } = this.state;
      let connectedUser = { ...userConnected };
      const { connectionId, data, permissions } = event.connection;

      console.log(event);
      if(this.state.myConnection !== undefined && (this.state.myConnection.data === data)) {
        if(this.state.connected) { // user page will be reloaded to avoid loopback event for the same user
          console.log("Disconnecting User:", data, "joined in another session");
          window.location.reload();
          // setTimeout(window.location.reload.bind(window.location),1000);
        }
        return;
      }

      //console.log("userConnected", this.state.userConnected);
      connectedUser[connectionId] = { data, permissions };
      this.setState({ userConnected: connectedUser });
      //console.log("userConnected", this.state.userConnected);
    });

    otCore.on("connectionDestroyed", (event) => {
      const { userConnected, activityState } = this.state;
      const { connectionId } = event.connection;
      let connectedUser = { ...userConnected };

      let _activityState = { ...activityState };

      console.log(_activityState);
      let activity = null;
      if (_activityState[connectionId]) {
        activity = { ..._activityState[connectionId] };
      }

      console.log("disconnecting activity:", activity);
      if (activity && activity.active) {
        console.log(
          "disconnected: stopped Talking",
          connectedUser[connectionId].data
        );
        delete _activityState[connectionId];
        this.setState({ activityState: _activityState });

        const publisherWrapper = document.getElementById(
          "cameraPublisherContainer"
        );
        const subscriberWrapper = document.getElementById(
          "cameraSubscriberContainer"
        );

        if (publisherWrapper !== null && publisherWrapper.hasChildNodes()) {
          console.log(
            "disconnecting... talk",
            activity.dom,
            publisherWrapper.childNodes[0]
          );
          if (activity.dom === publisherWrapper.childNodes[0]) {
            //remove if only the disconnected active dom
            publisherWrapper.removeChild(publisherWrapper.childNodes[0]);
          }
        }

        console.log("disconnect:subscriberWrapper", subscriberWrapper, subscriberWrapper.hasChildNodes());
        if (subscriberWrapper !== null && subscriberWrapper.hasChildNodes()) {
          let currentTalkdiv = subscriberWrapper.removeChild(
            subscriberWrapper.childNodes[0]
          );
          publisherWrapper.appendChild(currentTalkdiv);
        }
      }
      //const updatedUserConnected = Object.keys(userConnected)
      //  .filter((key) => key !== connectionId)
      //  .reduce((res, key) => ((res[key] = userConnected[key]), res), {});
      delete connectedUser[connectionId];

      // this.setState({ userConnected: updatedUserConnected });
      this.setState({ userConnected: connectedUser });
    });

    otCore.on("signal", (event) => {
      console.log("signal got with event: ", event);
      if (
        event.type == "signal:toggle-mute" &&
        event.from.connectionId !== this.state.myConnection.connectionId
      ) {
        const data = JSON.parse(event.data);
        const { type } = data;
        console.log("received command:", data);

        if (type == "audio") {
          this.toggleLocalAudio();
        } else if (type === "video") {
          this.toggleLocalVideo();
        } else {
          console.log("unknown mute type ");
        }
      }
    });

    otCore.connect().then(() => {
      const _this = this;

      const events = [
        "subscribeToCamera",
        "unsubscribeFromCamera",
        "subscribeToScreen",
        "unsubscribeFromScreen",
        "startScreenShare",
        "endScreenShare",
        "streamPropertyChanged",
      ];

      events.forEach((event) =>
        otCore.on(event, ({ publishers, subscribers, meta, ..._event }) => {
          if (
            event === "subscribeToScreen" ||
            event === "unsubscribeFromScreen"
          ) {
            const publisherWrapper = document.getElementById(
              "cameraPublisherContainer"
            );
            publisherWrapper.style.display =
              event === "subscribeToScreen" ? "none" : "";
            this.setState({
              subscribedScreenShare: event === "subscribeToScreen",
            });
          }
          if (event === "subscribeToCamera") {
            const { userConnected } = this.state;
            const { streamMap, streams } = _event;
            // const streamIds = Object.keys(streams);
            let connectedUser = { ...userConnected };
            console.log("subscribeToCamera", _event);

            Object.keys(streamMap).map((strm) => {
              let streamDiv = document.getElementById(streamMap[strm]);
              let nameEle = streamDiv.getElementsByClassName("OT_name")[0];

              let userStream = streams[strm];

              if (
                userStream !== undefined &&
                userStream.connection !== undefined &&
                userStream.connection.data
              ) {
                const name = userStream.connection.data.split("=");
                nameEle.innerHTML = name[1];
              } else {
                nameEle.innerHTML = this.state.userName;
              }
            });

            for (const [key, value] of Object.entries(streams)) {
              const streamId = key;
              const connectionId = streams[streamId].connection.connectionId;

              if (connectedUser[connectionId]["stream"] === undefined) {
                const session = otCore.getSession();

                var subscriber = session.subscribe(streams[streamId], {
                  insertDefaultUI: false,
                });
                console.log("subscriber", subscriber);

                let console_count = 0;
                subscriber.on("audioLevelUpdated", function (event) {
                  const { activityState, subscribedScreenShare } = _this.state;
                  let _activityState = { ...activityState };
                  let _connectionId =
                    event.target.stream.connection.connectionId;

                  if (subscribedScreenShare) return; // subscribed screen share will be focused
                  let activity = null;
                  if (_activityState[_connectionId]) {
                    activity = { ..._activityState[_connectionId] };
                  }
                  var now = Date.now();

                  if (event.audioLevel > 0.1 && event.target.stream.hasAudio) {
                    if ((console_count % 2) == 0) {
                      console.log(
                        console_count,
                        "event",
                        connectedUser[_connectionId].data,
                        activity,
                        event.audioLevel,
                        event.target.stream.hasAudio
                      );
                    }
                    console_count++ ;

                    if (!activity) {
                      activity = { timestamp: now, talking: false, active: false };
                      _activityState[_connectionId] = activity;
                      _this.setState({ activityState: _activityState });
                    } else if (activity.talking) {
                      // activityState[_connectionId].timestamp = now;
                      // this.setState({ activityState: _activityState });
                      activity.timestamp = now;
                      _activityState[_connectionId] = activity;
                      _this.setState({ activityState: _activityState });
                    } else if (now - activity.timestamp > 1000) {
                      // detected audio activity for more than 1s
                      // for the first time.
                      Object.keys(_activityState).forEach((_cId) => {
                        console.log(_activityState[_cId], _connectionId);
                        if (_activityState[_cId] != _connectionId) {
                          _activityState[_cId].talking = { timestamp: now, talking: false, active: false };
                        }
                      });
                      activity.talking = true;
                      activity.active = true;
                      // console.log('started talking', event.target.stream.connection.connectionId);

                      // console.log(
                      //   "start Talking",
                      //   connectedUser[_connectionId].data
                      // );
                      console.log(
                        console_count,
                        "event:start",
                        connectedUser[_connectionId].data,
                        activity,
                        event.audioLevel,
                        event.target.stream.hasAudio
                      );

                      let talkingSubID = streamMap[event.target.stream.id];
                      let talkDiv = document.getElementById(talkingSubID);

                      const publisherWrapper = document.getElementById(
                        "cameraPublisherContainer"
                      );
                      const subscriberWrapper = document.getElementById(
                        "cameraSubscriberContainer"
                      );

                      // publisherWrapper.innerHTML = '';

                      if (
                        publisherWrapper !== null &&
                        publisherWrapper.hasChildNodes()
                      ) {
                        let currentPublisher = publisherWrapper.removeChild(
                          publisherWrapper.childNodes[0]
                        );
                        subscriberWrapper.appendChild(currentPublisher);
                      }

                      if (talkDiv !== null) {
                        let currentTalkdiv = subscriberWrapper.removeChild(
                          talkDiv
                        );
                        publisherWrapper.appendChild(currentTalkdiv);
                        activity.dom = currentTalkdiv;
                        console.log(activity.dom);
                      }

                      _activityState[_connectionId] = activity;
                      _this.setState({ activityState: _activityState });
                      // console.log("publisherNodes",publisherWrapper.childNodes);
                      // console.log("subscriberNodes",subscriberWrapper.childNodes);
                    }
                  } else if (activity && now - activity.timestamp > 2000) {
                    // detected low audio activity for more than 3s
                    if (activity.talking) {
                      // console.log(
                      //   "stopped Talking",
                      //   connectedUser[_connectionId].data
                      // );
                      activity.timestamp = now;
                      activity.talking = false;
                      _activityState[_connectionId] = activity;
                      _this.setState({ activityState: _activityState });
                        console.log(
                          console_count,
                          "event:stop",
                          connectedUser[_connectionId].data,
                          activity,
                          event.audioLevel,
                          event.target.stream.hasAudio
                        );
                    } 
                    // else {
                    //   if ((console_count % 100) == 0) {
                    //     console.log(
                    //       console_count,
                    //       "event",
                    //       connectedUser[_connectionId].data,
                    //       activity,
                    //       event.audioLevel,
                    //       event.target.stream.hasAudio
                    //     );
                    //   }
                    //   console_count++ ;
                    // }
                  }
                });
              }

              connectedUser[connectionId]["stream"] = streams[streamId];
            }

            this.setState({ userConnected: connectedUser });
            this.setState({ streamMap });
            this.updateAudioOutDevice();
          }

          if (event === "unsubscribeFromCamera") {
            const { activityState } = _this.state;
            let _activityState = { ...activityState };

            console.log("unsubscribeFromCamera");
          }

          if (event !== "streamPropertyChanged") {
            this.setState({ publishers, subscribers, meta });
          }

          if (event === "streamPropertyChanged") {
            const { userConnected } = this.state;
            const { stream } = _event;
            // const streamIds = Object.keys(streams);
            let connectedUser = { ...userConnected };
            console.log("streamPropertyChanged", _event);

            const connectionId = stream.connection.connectionId;
            connectedUser[connectionId]["stream"].audio = stream.audio;
            connectedUser[connectionId]["stream"].video = stream.video;

            this.setState({ userConnected: connectedUser });
          }
        })
      );

      otCore
        .startCall()
        .then(({ publishers, subscribers, meta }) => {
          const { userConnected } = this.state;

          let connectedUser = { ...userConnected };
          let publisher;

          const session = otCore.getSession();

          this.setState({ myConnection: session.connection });
          this.setState({ otherConnections: session.connections });

          this.setState({ publishers, subscribers, meta, active: true });

          for (const [key, value] of Object.entries(publishers.camera)) {
            this.setState({ cameraPublishers: value });
            publisher = value;
          }
          const connectionId = publisher.stream.connection.connectionId;
          //const streamId = publisher.streamId ;
          connectedUser[connectionId]["stream"] = publisher.stream;

          this.setState({ userConnected: connectedUser });
        })
        .catch((error) => console.log(error));
      this.setState({ connected: true });
    }).catch((error) => this.setState({userError: error.message}));
  }

  endCall() {
    this.setState({ ...resetState }, () => {
      this.closePeopleList();
      otCore.disconnect();
      try {
        otCore.endCall();
      } catch (err) {
        console.log(err);
      }
    });
  }

  handleRemoteToggle(connection, toggleType) {
    const session = otCore.getSession();
    console.log("sending command:", toggleType, connection);
    session.signal(
      {
        type: "toggle-mute",
        data: JSON.stringify({ type: toggleType }),
        to: connection,
      },
      function (error) {
        if (error) {
          console.log("Error sending signal:", error.name, error.message);
        }
      }
    );
  }

  toggleLocalAudio() {
    otCore.toggleLocalAudio(!this.state.localAudioEnabled);
    this.setState({ localAudioEnabled: !this.state.localAudioEnabled });
  }

  toggleLocalVideo() {
    console.log("localvideo enabled:", this.state.localVideoEnabled);
    otCore.toggleLocalVideo(!this.state.localVideoEnabled);
    this.setState({ localVideoEnabled: !this.state.localVideoEnabled });
  }

  showPeopleList() {
    document.getElementsByClassName("subscriber-wrapper")[0].style.width =
      "320px";
    document.getElementById("video-section").style.marginRight = "320px";
  }

  closePeopleList() {
    document.getElementsByClassName("subscriber-wrapper")[0].style.width =
      "0px";
    document.getElementById("video-section").style.marginRight = "0px";
  }

  render() {
    const {
      connected,
      active,
      videoInputDevices,
      audioInputDevices,
      audioOutputDevices,
      audioOutputSelect,
    } = this.state;
    const {
      localAudioClass,
      localVideoClass,
      localCallClass,
      controlClass,
      cameraPublisherClass,
      screenPublisherClass,
      cameraSubscriberClass,
      screenSubscriberClass,
    } = containerClasses(this.state);

    let audioOutputSelectBox = <div></div>;
    if (audioOutputSelect) {
      audioOutputSelectBox = (
        <select
          className="browser-default custom-select"
          onChange={this.handleAudioOutDeviceChange}
        >
          {audioOutputDevices.map((option, i) => (
            <option key={i} value={option.deviceId}>
              Audio Output: {option.label}
            </option>
          ))}
        </select>
      );
    }

    const isMultipleUser = Object.keys(this.state.userConnected).length > 1;

    return (
      <div className="App">
        <div className="App-main">
          <div
            className={`App-video-container ${active ? "video-wrapper" : ""}`}
          >
            <div
              className={`video-section ${this.handleChangeLayout(
                this.state.layoutType
              )} `}
              id="video-section"
            >
              {/* {!connected && connectingMask()} */}
              {!active && (
                <div className="App-mask start-call-wrapper">
                  <form onSubmit={this.startCall}>
                    <MDBInput
                      label="Enter your username"
                      icon="user"
                      onChange={(e) => this.handleChange(e)}
                    />
                    {this.state.userError !== "" && (
                      <p className={"error"}>{this.state.userError}</p>
                    )}
                    <button
                      className="message button clickable"
                      // onClick={this.startCall}
                      type="submit"
                      disabled={this.state.userName === ""}
                    >
                      Click to Start Call{" "}
                    </button>
                  </form>
                </div>
              )}

              <div className="layout-container">
                <div
                  id="cameraPublisherContainer"
                  className={cameraPublisherClass}
                />
                <div
                  id="cameraSubscriberContainer"
                  className={cameraSubscriberClass}
                />

                <div
                  id="screenSubscriberContainer"
                  className={screenSubscriberClass}
                />
              </div>
            </div>

            <div className="subscriber-wrapper">
              <div className="title-sec">
                <h3>{this.state.userName}</h3>
                <i className="fas fa-times" onClick={this.closePeopleList}></i>
              </div>
              {this.state.userConnected &&
                Object.keys(this.state.userConnected).length > 0 && (
                  <ul className="user-list-wrapper">
                    {Object.values(this.state.userConnected).map(
                      (element, i) => {
                        if (
                          element.data !==
                          (this.state.myConnection !== undefined &&
                            this.state.myConnection.data)
                        ) {
                          return (
                            <li key={i}>
                              <p>{element.data.split("=")[1]}</p>
                              {this.state.myConnection !== undefined &&
                                this.state.myConnection.data ===
                                  "name=moderator" && (
                                  <div className={"user-action"}>
                                    <div
                                      className={`ots-video-control circle audio ${
                                        element.stream &&
                                        element.stream.hasAudio === false
                                          ? "muted"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        this.handleRemoteToggle(
                                          element.stream &&
                                            element.stream.connection,
                                          "audio"
                                        )
                                      }
                                    />

                                    <div
                                      className={`ots-video-control circle video ${
                                        element.stream &&
                                        element.stream.hasVideo === false
                                          ? "muted"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        this.handleRemoteToggle(
                                          element.stream &&
                                            element.stream.connection,
                                          "video"
                                        )
                                      }
                                    />
                                  </div>
                                )}
                            </li>
                          );
                        }
                      }
                    )}
                  </ul>
                )}
            </div>
          </div>
          <div className="control-wrapper">
            <div id="controls1" className={controlClass}>
              <MDBPopover placement="top" popover clickable id="popper1">
                <MDBBtn tag="a" size="lg" floating className="setting-btn">
                  <MDBIcon icon="cog" />
                </MDBBtn>
                <div>
                  <MDBPopoverBody>
                    <div className="popover-wrapper">
                      {audioOutputSelectBox}
                      <select
                        className="browser-default custom-select"
                        onChange={this.handleAudioInDeviceChange}
                      >
                        {audioInputDevices.map((option, i) => (
                          <option key={i} value={option.deviceId}>
                            Audio Input: {option.label}
                          </option>
                        ))}
                      </select>

                      <select
                        className="browser-default custom-select"
                        onChange={this.handleVideoDeviceChange}
                      >
                        {videoInputDevices.map((option, i) => (
                          <option key={i} value={option.deviceId}>
                            Video Input: {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </MDBPopoverBody>
                </div>
              </MDBPopover>
            </div>
            <div id="controls2" className={controlClass}>
              <div
                className={localAudioClass}
                onClick={this.toggleLocalAudio}
              />
              <div
                className={localVideoClass}
                onClick={this.toggleLocalVideo}
              />
              <div className={localCallClass} onClick={this.endCall} />
            </div>
            <div className={controlClass}>
              {isMultipleUser && (
                <div className="layout-btn-wrapper">
                  <button
                    type="button"
                    className="btn btn-primary btn-floating"
                    onClick={() => this.handleLayoutType("horizontal")}
                  >
                    <i className="fas fa-columns"></i>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-floating"
                    onClick={() => this.handleLayoutType("default")}
                  >
                    <i className="fas fa-columns vertical"></i>
                  </button>
                  {/* <button
                    type="button"
                    className="btn btn-primary btn-floating"
                    onClick={() => this.handleLayoutType("default")}
                  >
                    <i className="fas fa-align-center"></i>
                  </button> */}
                </div>
              )}
              <div id="controls"></div>
              <div className="user-control" onClick={this.showPeopleList}>
                <MDBIcon icon="users" className={controlClass} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
