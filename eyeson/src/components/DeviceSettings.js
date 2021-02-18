import React, { Fragment, useState, useEffect } from "react";
import { FeatureDetector } from "eyeson";
import DevicePicker from "./DevicePicker";

const canChangeMicrophone = FeatureDetector.canChangeMicrophone();

// const deviceManager = new DeviceManager();
const DeviceSettings = ({ onChange, deviceManager }) => {
  const [devices, setDevices] = useState({
    cameras: deviceManager.cameras,
    speakers: deviceManager.speakers,
    microphones: deviceManager.microphones,
  });

  const [stream, setStream] = useState(null);
  const [sinkId, setSinkId] = useState(deviceManager.sinkId);
  const [applyDisabled, setApplyDisabled] = useState(false);

  useEffect(() => {
    const handleChange = (event) => {
      const { error, stream, sinkId } = event;
      if (error) {
        setApplyDisabled(true);
        onChange({
          type: "warning",
          name: "error_" + error.name,
          message: error.message,
        });
        return;
      }
      setApplyDisabled(false);
      if (stream) {
        setStream(event.stream);
        return;
      }
      if (sinkId) {
        setSinkId(sinkId);
        return;
      }
      setDevices(event);
    };

    deviceManager.onChange(handleChange);
    deviceManager.start();

    return () => {
      deviceManager.removeListener(handleChange);
      deviceManager.stop();
    };
  }, [onChange]);

  const handleError = ({ name, message }) =>
    onChange({ type: "warning", name: "error_" + name, message: message });

  const handlePlayAudio = (event) =>
    onChange({ type: "audio_output_play_preview", details: event });

  const handleVideoInputChange = (event) => {
    if (!event.target.value) {
      return;
    }
    onChange({ type: "video_input_change", details: event.deviceLabel });
    deviceManager.setVideoInput(event.target.value);
    handleSave();
  };

  const handleAudioInputChange = (event) => {
    if (!event.target.value) {
      return;
    }
    onChange({ type: "audio_input_change", details: event.deviceLabel });
    deviceManager.setAudioInput(event.target.value);
    handleSave();
  };

  const handleAudioOutputChange = (event) => {
    if (!event.target.value) {
      return;
    }
    onChange({ type: "audio_output_change", details: event.deviceLabel });
    deviceManager.setAudioOutput(event.target.value);
    handleSave();
  };

  const handleSave = () => {
    deviceManager.storeConstraints();
    onChange({ type: "device_update", sinkId: sinkId });
  };

  return (
    <div className="popover-wrapper">
      <DevicePicker
        icon="videocam"
        label="CAMERA"
        stream={stream}
        devices={devices.cameras}
        onChange={handleVideoInputChange}
        disabled={devices.cameras.length === 0}
      />
      <DevicePicker
        icon="keyboard_voice"
        label="MICROPHONE"
        stream={stream}
        devices={devices.microphones}
        onChange={handleAudioInputChange}
        disabled={!canChangeMicrophone}
      />

      <DevicePicker
        icon="volume_up"
        label="SPEAKER"
        sinkId={sinkId}
        devices={devices.speakers}
        onChange={handleAudioOutputChange}
      />
    </div>
  );
};

export default DeviceSettings;
