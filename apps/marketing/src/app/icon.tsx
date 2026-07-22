import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#C1FF72",
        color: "#0B0B0B",
        display: "flex",
        fontSize: 20,
        fontWeight: 900,
        height: "100%",
        justifyContent: "center",
        width: "100%"
      }}
    >
      L
    </div>,
    size
  );
}
