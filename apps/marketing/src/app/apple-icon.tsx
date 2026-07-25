import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#0B0B0B",
        color: "#C1FF72",
        display: "flex",
        fontSize: 108,
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
