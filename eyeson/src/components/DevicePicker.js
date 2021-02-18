import React from "react";
import { Select } from "@rmwc/select";
import "@material/select/dist/mdc.select.css";

const findDeviceUsedInStream = (devices, stream) => {
  if (devices.length === 0) {
    return { deviceId: "default" };
  }

  return (
    devices.find((device) => {
      if (!stream) return false;
      return Boolean(
        stream.getTracks().find((track) => track.label === device.label)
      );
    }) || { deviceId: devices[0].deviceId }
  );
};

const DevicePicker = ({
  icon,
  label,
  stream,
  sinkId = null,
  devices = [],
  heading = "",
  hasError = false,
  selected = null,
  disabled = false,
  children,
  onChange,
}) => {
  const getSelectedValue = () =>
    sinkId || selected || findDeviceUsedInStream(devices, stream).deviceId;

  const handleChange = (event) => {
    const device = devices.find((dev) => dev.deviceId === event.target.value);
    if (!device) return;
    onChange(Object.assign({ deviceLabel: device.label }, event));
  };

  if (!heading) {
    heading = "device";
  }

  return (
    <Select
      value={getSelectedValue()}
      onChange={handleChange}
      color="secondary"
      label={label}
      icon={icon}
      disabled={disabled || hasError || devices.length === 0}
    >
      {devices.map((device, index) => (
        <option key={index} value={device.deviceId || "default"}>
          {device.label === "System default"
            ? "Default"
            : device.label || `${heading} ${index + 1}`}
        </option>
      ))}
      {devices.length === 0 && (
        <option key={"no-device"} value={"default"}>
          No Device Found
        </option>
      )}
    </Select>
  );
};

export default DevicePicker;
