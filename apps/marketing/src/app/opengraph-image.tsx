import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#070A08",
        color: "#f5f7ef",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: 72,
        width: "100%"
      }}
    >
      <div
        style={{
          background: "#0D120F",
          border: "1px solid rgba(193,255,114,0.18)",
          borderRadius: 24,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 56,
          width: "100%"
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 20 }}>
          <div
            style={{
              alignItems: "center",
              background: "#C1FF72",
              borderRadius: 10,
              color: "#070A08",
              display: "flex",
              fontSize: 32,
              fontWeight: 800,
              height: 64,
              justifyContent: "center",
              width: 64
            }}
          >
            L
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Lumina</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#C1FF72",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 0,
              textTransform: "uppercase"
            }}
          >
            Invoice payment clarity for Nigerian SMEs
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: 0,
              lineHeight: 0.95,
              marginTop: 24,
              maxWidth: 880
            }}
          >
            Know what got paid—without the spreadsheet chase.
          </div>
          <div
            style={{
              alignItems: "center",
              color: "#aeb8a7",
              display: "flex",
              fontSize: 20,
              gap: 16,
              marginTop: 30
            }}
          >
            <span>Invoice</span><span style={{ color: "#C1FF72" }}>→</span>
            <span>Provider confirmation</span><span style={{ color: "#C1FF72" }}>→</span>
            <span>Matched</span><span style={{ color: "#C1FF72" }}>→</span>
            <span>Receipt</span>
          </div>
        </div>
      </div>
    </div>,
    size
  );
}
