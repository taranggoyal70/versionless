import { ImageResponse } from "next/og";

export const alt = "Versionless - proof for every agent-written change";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "58px 64px",
        color: "#121621",
        backgroundColor: "#f3f5f8",
        backgroundImage:
          "linear-gradient(#e1e5ec 1px, transparent 1px), linear-gradient(90deg, #e1e5ec 1px, transparent 1px)",
        backgroundSize: "38px 38px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: 30, fontWeight: 700 }}>
          <div
            style={{
              width: 46,
              height: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              backgroundColor: "#121621",
              borderBottom: "6px solid #635bff",
              fontSize: 25,
              fontWeight: 800,
            }}
          >
            V
          </div>
          versionless
        </div>
        <div
          style={{
            display: "flex",
            padding: "10px 14px",
            color: "#ffffff",
            backgroundColor: "#0d9f68",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          BEHAVIOR FIRST
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: "54px" }}>
        <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
          <div style={{ color: "#635bff", fontSize: 20, fontWeight: 700, letterSpacing: "0.12em" }}>
            VERIFICATION LAYER FOR CODING AGENTS
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 18, fontSize: 68, fontWeight: 800, lineHeight: 0.98, letterSpacing: "-0.045em" }}>
            <span>AI wrote the patch.</span>
            <span>Proof decides if it ships.</span>
          </div>
        </div>

        <div
          style={{
            width: 365,
            display: "flex",
            flexDirection: "column",
            padding: "26px",
            backgroundColor: "#ffffff",
            border: "2px solid #d9dee8",
            boxShadow: "10px 10px 0 #635bff",
          }}
        >
          <div style={{ color: "#667085", fontSize: 16, fontWeight: 700, letterSpacing: "0.1em" }}>
            THE TRUST MODEL
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 24, fontSize: 21, fontWeight: 700 }}>
            <span style={{ color: "#635bff", marginRight: 14 }}>01</span>
            <span>Lock expected behavior</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 15, fontSize: 21, fontWeight: 700 }}>
            <span style={{ color: "#635bff", marginRight: 14 }}>02</span>
            <span>Constrain the agent</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 15, fontSize: 21, fontWeight: 700 }}>
            <span style={{ color: "#635bff", marginRight: 14 }}>03</span>
            <span>Replay from clean state</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 23,
              padding: "14px",
              color: "#aeb6c5",
              backgroundColor: "#111620",
              fontFamily: "monospace",
              fontSize: 16,
            }}
          >
            proof before merge
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", color: "#667085", fontSize: 18 }}>
        <span>Behavior first. Diff second.</span>
        <span>versionless-navy.vercel.app</span>
      </div>
    </div>,
    size,
  );
}
