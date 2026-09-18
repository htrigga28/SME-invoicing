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
        background: "#FAFAF7",
        color: "#17211C",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: 48,
        width: "100%"
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCE2DC",
          borderRadius: 24,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 56,
          width: "100%"
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 16 }}>
          <div
            style={{
              alignItems: "center",
              background: "#245C46",
              borderRadius: 10,
              color: "#FFFFFF",
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
              color: "#245C46",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase"
            }}
          >
            Receivables for growing businesses
          </div>
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 0.95,
              marginTop: 20,
              maxWidth: 880
            }}
          >
            Turn every invoice into predictable cash.
          </div>
          <div
            style={{
              alignItems: "center",
              color: "#4F5F56",
              display: "flex",
              fontSize: 20,
              gap: 14,
              marginTop: 28
            }}
          >
            <span>Invoice</span><span style={{ color: "#245C46" }}>→</span>
            <span>Pay</span><span style={{ color: "#245C46" }}>→</span>
            <span>Reconcile</span><span style={{ color: "#245C46" }}>→</span>
            <span>Know</span>
          </div>
        </div>
      </div>
    </div>,
    size
  );
}
