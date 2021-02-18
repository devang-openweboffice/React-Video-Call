import React, { Component, Fragment } from "react";
import { TextField } from "@rmwc/textfield";
import { IconButton } from "@rmwc/icon-button";
import { Button } from "@rmwc/button";
import { Tooltip } from "@rmwc/tooltip";
import { ThemeProvider } from "@rmwc/theme";
import { Grid, GridCell } from "@rmwc/grid";
import { LinearProgress } from "@rmwc/linear-progress";
import { Typography } from "@rmwc/typography";
import { Select } from "@rmwc/select";
import eyeson, { StreamHelpers, DeviceManager } from "eyeson";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
// import Toolbar from "./Toolbar";
import Video from "./Video";
import "./App.css";
import config from "./config.json";
import DeviceSettings from "./components/DeviceSettings";

import Axios from "axios";
import Roster from "./components/Roster";

const ACCESS_KEY_LENGTH = 24;
const sideNavRef = React.createRef();
const mainRef = React.createRef();
const deviceManager = new DeviceManager();
const initState = {
  local: null,
  stream: null,
  connecting: false,
  audio: true,
  video: true,
  screen: false,
  roomName: "on24",
  userName: "user1",
  error: "",
  isShowPopover: false,
  participants: [],
  openSideBar: false,
  podium: [],
  voiceActivity: [],
  layoutType: "auto",
  userDemoLink: null,
  isScreenShareDiabled: false,
};

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

class App extends Component {
  state = {
    local: null,
    stream: null,
    connecting: false,
    audio: true,
    video: true,
    screen: false,
    roomName: "on24",
    userName: "user1",
    error: "",
    isShowPopover: false,
    participants: [],
    openSideBar: false,
    podium: [],
    voiceActivity: [],
    userDemoLink: null,
    layoutType: "auto",
    isScreenShareDiabled: false,
  };

  constructor(props) {
    super(props);
    // this.start = this.start.bind(this);
    this.handleEvent = this.handleEvent.bind(this);
    this.toggleAudio = this.toggleAudio.bind(this);
    this.toggleVideo = this.toggleVideo.bind(this);
    this.toggleScreen = this.toggleScreen.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);
    this.handleCheckboxSelect = this.handleCheckboxSelect.bind(this);
    this.deviceManager = new DeviceManager();
  }

  componentDidUpdate(prevProps, prevState) {
    const { participants, audio } = this.state;
    if (prevState.participants.length !== participants.length && !audio) {
      this.sendMessageToRoom([eyeson.user.sipId], "audio", false, true);
    }
  }

  componentWillUnmount() {
    deviceManager.stop();
  }

  handleEvent(event) {
    console.log("handleEvent,", event);
    if (
      event.type === "connection" &&
      event.connectionStatus === "access_denied"
    ) {
      this.setState({ error: "access token expired, try again!!!" });
      setTimeout(() => this.setState({ ...initState }), 1000);
      // this.connectEyeson();
    } else if (event.type === "presentation_ended") {
      eyeson.send({
        type: "start_stream",
        audio: this.state.audio,
        video: this.state.video,
      });
      this.setState({ screen: false }, () => {
        const videoEle = document.querySelector("video");
        videoEle.style.display = "block";
      });
      return;
    } else if (event.type === "add_user") {
      console.debug("add_user", event.user);
      if (event.user.apiId !== this.state.userName) {
        this.setState((prevState) => {
          return {
            participants: [
              ...prevState.participants,
              { ...event.user, selected: true },
            ],
          };
        });
      }
      const { voiceActivity, userName } = this.state;
      if (userName === "moderator" && voiceActivity.length > 0) {
        const userid = voiceActivity.reduce((accumulator, currentValue) => {
          if (!currentValue.audioMuted) {
            const userId = currentValue.id;
            accumulator.push(userId);
          }
          return accumulator;
        }, []);
        if (userid.length > 0) {
          this.sendMessageToRoom(userid, "audio", false, true);
        }
      }
      return;
    } else if (event.type === "remove_user") {
      console.debug("remove_user", event.user);
      const { participants } = this.state;
      const index = participants.findIndex((i) => i.id === event.user.id);
      if (index !== -1) {
        participants.splice(index, 1);
        this.setState({ participants: [...participants] });
      }
      return;
    } else if (event.type === "podium") {
      console.debug("podium", event.sources);
      const isScreenShareDiabled = !event.isPresenter && event.presenter;
      const podium = event.videoSources
        .map((item) => {
          return event.sources[item]?.split("@integrations.visocon.com")[0];
        })
        .filter((i) => i);
      const voiceActivity = event.sources.map((item) => {
        const id = item.split("@integrations.visocon.com")[0];
        const idIndex = this.state.voiceActivity.findIndex((i) => i.id === id);
        if (idIndex !== -1) {
          return {
            id,
            audioMuted: this.state.voiceActivity[idIndex]["audioMuted"],
          };
        } else {
          return { id, audioMuted: true };
        }
      });
      this.setState({ podium, voiceActivity, isScreenShareDiabled });
      return;
    } else if (event.type === "voice_activity") {
      console.debug("voice_activity", event.on, event.user);
      const { podium } = this.state;
      const voiceActivity = podium.map((id) =>
        id === event.user.id
          ? { id, audioMuted: event.on }
          : { id, audioMuted: true }
      );
      // this.setState({ voiceActivity }); // Use while check voice activity of the user
      return;
    } else if (event.type === "change_stream") {
      console.debug("change_stream", event);
      return;
    } else if (event.type === "track_unmuted") {
      console.debug("track_unmuted", event);
      return;
    } else if (event.type === "chat") {
      console.debug("chat", event);
      const content = JSON.parse(event.content);
      const command = content.command;
      const useridArray = content.userid;
      if (useridArray === eyeson.user.sipId && command === "disconnect") {
        eyeson.send({ type: command });
        this.handleLeave();
      } else {
        const resend = content.resend;
        useridArray.forEach((element) => {
          const isMe = element === eyeson.user.sipId;
          if (content.type === "video") {
            if (isMe) {
              this.toggleVideo();
            }
          } else {
            const voiceActivityTmp = this.state.voiceActivity.map((item) => {
              if (item.id === element && !resend) {
                return { ...item, audioMuted: !item.audioMuted };
              } else if (item.id === element && resend) {
                return { ...item, audioMuted: false };
              } else {
                return { ...item };
              }
            });
            this.setState({ voiceActivity: [...voiceActivityTmp] }, () => {
              if (!content.clickByself && isMe && !resend) {
                this.toggleAudio();
              }
            });
          }
        });
      }
      return;
    }
    if (event.type === "error" && event.name === "session_in_use") {
      const msg = JSON.stringify({
        command: "disconnect",
        userid: eyeson.user.sipId,
      });
      eyeson.send({
        type: "send_chat",
        content: msg,
      });
      setTimeout(() => {
        eyeson.send({ type: "disconnect" });
        this.handleLeave(() => this.handleSubmit());
      }, 3000);
    }
    if (event.type !== "accept") {
      console.debug("[App]", "Ignore received event:", event.type);
      return;
    }

    this.setState({
      local: event.localStream,
      stream: event.remoteStream,
      connecting: false,
    });
  }

  toggleAudio(isUser) {
    const audioEnabled = !this.state.audio;
    if (audioEnabled) {
      StreamHelpers.enableAudio(this.state.local);
    } else {
      StreamHelpers.disableAudio(this.state.local);
    }
    eyeson.send({
      type: "change_stream",
      stream: this.state.local,
      video: this.state.video,
      audio: audioEnabled,
    });
    this.setState({ audio: audioEnabled }, () => {
      if (isUser) this.sendMessageToRoom([eyeson.user.sipId], "audio", true);
    });
  }

  toggleVideo() {
    eyeson.send({
      type: "change_stream",
      stream: this.state.local,
      video: !this.state.video,
      audio: this.state.audio,
    });
    this.setState({ video: !this.state.video });
  }

  toggleScreen() {
    if (!this.state.screen) {
      eyeson.send({
        type: "start_screen_capture",
        audio: this.state.audio,
        screenStream: null,
        screen: true,
      });
      this.setState({ screen: true }, () => {
        if (this.state.screen) {
          const videoEle = document.querySelector("video");
          videoEle.style.display = "none";
        }
      });
    } else {
      eyeson.send({ type: "stop_presenting" });
    }
  }

  // start(event) {
  //   const key = event.target.value.trim();
  //   if (key.length !== ACCESS_KEY_LENGTH) {
  //     return;
  //   }
  //   this.setState({ connecting: true });
  //   eyeson.start(key);
  // }

  handleCheckboxSelect(id, isSelected) {
    const { participants } = this.state;

    const index = participants.findIndex((i) => i.id === id);

    if (index !== -1) {
      participants[index].selected = isSelected;
      this.setState({ participants: [...participants] }, () =>
        this.applyLayout()
      );
    }
  }

  onDragEnd(result) {
    // dropped outside the list
    if (!result.destination) {
      return;
    }

    // console.log(this.state.participants);

    const participants = reorder(
      this.state.participants,
      result.source.index,
      result.destination.index
    );

    // console.log("participant bnew order", participants);

    this.setState({ participants }, () => this.applyLayout());
  }

  handleChangeLayout = (e) => {
    this.setState(
      {
        layoutType: e.target.value,
      },
      () => this.applyLayout()
    );
  };

  userLimit = (layoutType) => {
    switch (layoutType) {
      case "one":
        return 1;
      case "two":
        return 2;
      case "four":
        return 4;
      default:
        return 0;
    }
  };

  userSelectedLayout = (layoutUsers) => {
    const layoutUsersCount = layoutUsers !== null ? layoutUsers.length : "auto";

    switch (layoutUsersCount) {
      case 1:
        return "one";
      case 2:
        return "two";
      case 4:
        return "four";
      default:
        return "auto";
    }
  };

  applyLayout = async () => {
    const allUsers = config.users;
    const userName = this.state.userName;

    const currentUser = allUsers[userName];

    const { participants } = this.state;

    // console.log("layoutUsers", participants);

    // const selectedUser = participants.filter((item) => item.selected === true);

    let userIds = participants.map((a) => a.apiId);

    let layoutParams = {
      layout: "auto",
      users: userIds,
    };

    if (this.state.layoutType !== "auto") {
      let userList = userIds.slice(0, this.userLimit(this.state.layoutType));

      let layoutUsers = Array(this.userLimit(this.state.layoutType))
        .join(".")
        .split(".");
      layoutUsers.splice(0, userList.length);

      let arrOfUsers = userList.concat(layoutUsers);

      layoutParams = {
        layoutType: this.state.layoutType,
        users: arrOfUsers,
      };
    }

    const request = {
      method: "post",
      url: `https://api.eyeson.team/rooms/${currentUser.accessKey}/layout`,
      headers: {
        Authorization: process.env.REACT_APP_AUTHORIZATION_KEY,
      },
      params: layoutParams,
    };
    const future = Axios(request);
    await future.then((response) => {
      console.log("set_layout: response", response);
    });
  };

  connectEyeson = async () => {
    const allUsers = config.users;
    const userName = this.state.userName;
    const roomName = this.state.roomName;

    const currentUser = allUsers[userName];
    // eyeson.onEvent("add_user", (data) => console.log("data"));
    if (currentUser === undefined) {
      this.setState({ error: `${this.state.userName} not found` });
      return;
    }

    const request = {
      method: "post",
      url: "https://api.eyeson.team/rooms",
      headers: {
        Authorization: process.env.REACT_APP_AUTHORIZATION_KEY,
      },
      params: {
        "user[name]": userName,
        "user[id]": userName,
        id: roomName,
        name: roomName,
        "options[guest_token_available]": "false",
      },
    };
    const future = Axios(request);
    await future.then((response) => {
      currentUser.accessKey = response.data["access_key"];
      const links = response.data["links"];
      this.setState({
        userDemoLink: links.gui,
        layoutType: this.userSelectedLayout(response.data.options.layout_users),
      });

      console.log("responce123456", response.data.options.layout_users);
      // userSelectedLayout
    });
    if (currentUser.accessKey.length !== ACCESS_KEY_LENGTH) {
      console.error("wrong access key length");
      return;
    }

    this.setState({ connecting: true });
    try {
      // console.log("accessKey:", currentUser.accessKey);
      eyeson.start(currentUser.accessKey);
      // console.log("start completed", eyeson);
    } catch (error) {
      console.error("unable to login:", error);
      this.setState({ connecting: false });
    }
  };

  handleSubmit = () => {
    eyeson.onEvent(this.handleEvent);
    this.connectEyeson();
  };

  handleLeave = (cb) => {
    sideNavRef.current.style.width = "0";
    mainRef.current.style.marginRight = "0";
    eyeson.destroy();
    deviceManager.stop();
    eyeson.offEvent(this.handleEvent);
    this.setState({ ...initState });
    if (cb) {
      cb();
    } else {
      window.location = window.location.href;
    }
  };

  handleSideBar = () => {
    const { openSideBar } = this.state;
    this.setState({ openSideBar: !openSideBar }, () => {
      if (this.state.openSideBar) {
        sideNavRef.current.style.width = "300px";
        mainRef.current.style.marginRight = "300px";
      } else {
        sideNavRef.current.style.width = "0";
        mainRef.current.style.marginRight = "0";
      }
    });
  };

  sendMessageToRoom = (peerId, type, clickByself, resend) => {
    const msg = JSON.stringify({
      command: "toggle-mute",
      type: type,
      userid: peerId,
      clickByself: clickByself,
      resend: resend,
    });
    eyeson.send({
      type: "send_chat",
      content: msg,
    });
    // eyeson.send({ type: "request_stfu" });
  };

  handleClick = (e) => {
    if (e) {
      e.preventDefault();
    }
  };

  render() {
    // console.log("eyeson", eyeson);
    const {
      roomName,
      userName,
      participants,
      audio,
      video,
      podium,
      voiceActivity,
      userDemoLink,
      screen,
      isScreenShareDiabled,
    } = this.state;
    return (
      <ThemeProvider options={{ primary: "#9e206c", secondary: "#6d6d6d" }}>
        {/* <Toolbar title="React App" /> */}
        <div className="App" ref={mainRef}>
          {!this.state.stream && (
            <div className="login-container">
              <Grid>
                <GridCell span="12">
                  <h1>Eyeson</h1>
                </GridCell>
                <GridCell span="12">
                  {this.state.connecting && (
                    <LinearProgress determinate={false} />
                  )}
                </GridCell>

                <Fragment>
                  <GridCell span="12">
                    <TextField
                      label="Enter the room name"
                      onChange={(e) =>
                        this.setState({ roomName: e.target.value })
                      }
                      value={roomName}
                      disabled={this.state.connecting}
                    />
                  </GridCell>
                  <GridCell span="12">
                    <TextField
                      label="Enter the username"
                      onChange={(e) =>
                        this.setState({ userName: e.target.value, error: "" })
                      }
                      value={userName}
                      disabled={this.state.connecting}
                    />

                    {this.state.error && (
                      <span className="error">{this.state.error}</span>
                    )}

                    {/* <TextFieldHelperText>
                      Get an user access key from starting a meeting via the API or
                      use one from an active meeting.
                    </TextFieldHelperText> */}
                  </GridCell>
                  <GridCell span="12">
                    <Button
                      onClick={this.handleSubmit}
                      disabled={roomName === "" || userName === ""}
                      raised
                    >
                      JOIN
                    </Button>
                  </GridCell>
                </Fragment>
              </Grid>
            </div>
          )}
          {this.state.stream && (
            <div className="stream-container">
              <Grid>
                <GridCell span="12" className="video-wrapper">
                  {this.state.stream && <Video src={this.state.stream} />}
                  {screen && (
                    <div className="screen-share-text">
                      <Typography use="headline1">
                        Presentation active
                      </Typography>
                    </div>
                  )}
                </GridCell>
                <GridCell span="1" className="App-sidebar">
                  {this.state.stream && (
                    <Fragment>
                      <div>
                        <Tooltip
                          content={
                            <DeviceSettings
                              onChange={(error) =>
                                console.log("onChange called", error)
                              }
                              deviceManager={deviceManager}
                            />
                          }
                          open={this.state.isShowPopover}
                        >
                          <IconButton
                            icon="settings"
                            onClick={() =>
                              this.setState({
                                isShowPopover: !this.state.isShowPopover,
                              })
                            }
                            onMouseDown={this.handleClick}
                          />
                        </Tooltip>
                      </div>
                      <div>
                        <IconButton
                          checked={this.state.audio}
                          onClick={() => this.toggleAudio(true)}
                          label="Toggle audio"
                          icon={this.state.audio ? "mic" : "mic_off"}
                          onMouseDown={this.handleClick}
                        />
                        <IconButton
                          checked={this.state.video}
                          onClick={this.toggleVideo}
                          label="Toggle video"
                          icon={this.state.video ? "videocam" : "videocam_off"}
                          onMouseDown={this.handleClick}
                        />
                        <IconButton
                          icon="phone_disabled"
                          onClick={() => this.handleLeave()}
                          onMouseDown={this.handleClick}
                        />
                      </div>
                      <div className="user-action-btn">
                        {userName === "moderator" && (
                          <div className="layout-wrapper">
                            <Select
                              value={this.state.layoutType}
                              onChange={this.handleChangeLayout}
                              color="secondary"
                              defaultValue={this.state.layoutType}
                            >
                              <option
                                key={"no-device"}
                                value={"default"}
                                disabled
                              >
                                Select
                              </option>
                              {["auto", "one", "two", "four"].map((type, i) => (
                                <option key={i} value={type}>
                                  {type}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}

                        <IconButton
                          checked={this.state.screen}
                          onClick={this.toggleScreen}
                          label="Share screen"
                          icon={
                            this.state.video
                              ? "screen_share"
                              : "stop_screen_share"
                          }
                          onMouseDown={this.handleClick}
                          disabled={isScreenShareDiabled}
                        />
                        <IconButton
                          icon={"supervisor_account"}
                          onClick={this.handleSideBar}
                          onMouseDown={this.handleClick}
                        />
                      </div>
                    </Fragment>
                  )}
                </GridCell>
              </Grid>
            </div>
          )}
        </div>
        <div className="sidenav" ref={sideNavRef}>
          {userName && (
            <>
              <Roster
                userName={userName}
                audioEnable={audio}
                videoEnable={video}
                main={true}
                loginUserName={userName}
                userDemoLink={userDemoLink}
              />
              <hr />
            </>
          )}

          {userName === "moderator" ? (
            <DragDropContext onDragEnd={this.onDragEnd}>
              <Droppable droppableId="droppable">
                {(provided, snapshot) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {participants.map((item, index) => (
                      <Draggable
                        key={`${item.id}-${index}`}
                        draggableId={item.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            // style={getItemStyle(
                            //   snapshot.isDragging,
                            //   provided.draggableProps.style
                            // )}
                          >
                            <Roster
                              key={item.id}
                              userName={item.name}
                              audioEnable={true}
                              videoEnable={true}
                              loginUserName={userName}
                              podium={podium}
                              voiceActivity={voiceActivity}
                              peerId={item.id}
                              sendMessageToRoom={this.sendMessageToRoom}
                              selected={item.selected}
                              handleCheckboxSelect={this.handleCheckboxSelect}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <div>
              {participants.map((item, index) => (
                <Roster
                  key={item.id}
                  userName={item.name}
                  audioEnable={true}
                  videoEnable={true}
                  loginUserName={userName}
                  podium={podium}
                  voiceActivity={voiceActivity}
                  peerId={item.id}
                  sendMessageToRoom={this.sendMessageToRoom}
                  selected={item.selected}
                  handleCheckboxSelect={this.handleCheckboxSelect}
                />
              ))}
            </div>
          )}
        </div>
      </ThemeProvider>
    );
  }
}

export default App;
