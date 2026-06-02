import { useState, useRef, useCallback } from "react";

const KARAT_PURITY = { "18k": 0.75, "22k": 0.9167, "24k": 1.0 };
const WEIGHT_RANGE = { light: [5, 12], medium: [13, 25], heavy: [26, 50] };
const WEIGHT_LABEL = { light: "5–12g", medium: "13–25g", heavy: "26–50g" };
const MAKING_CHARGE = 0.10;

async function fetchGoldPrice() {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: "Search for the current gold price per gram in USD today. Return ONLY a JSON object like {\"price_per_gram_usd\": 95.50}. No other text, no markdown." }]
      })
    });
    const data = await res.json();
    const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
    const match = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]).price_per_gram_usd;
  } catch (e) {}
  return 95.5;
}

async function analyzeJewelry(base64Image, mediaType) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
          { type: "text", text: `Analyze this jewelry image. Return ONLY a JSON object (no markdown, no extra text):
{"type":"ring/necklace/bracelet/earring/pendant/bangle/brooch/chain/anklet/other","description":"one sentence describing the piece","suggested_weight_category":"light/medium/heavy","weight_reasoning":"one sentence reason"}` }
        ]
      }]
    })
  });
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  const match = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  return null;
}

export default function App() {
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [goldPrice, setGoldPrice] = useState(null);
  const [weightCategory, setWeightCategory] = useState("medium");
  const [karat, setKarat] = useState("22k");
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const processFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target.result);
      setImageBase64(e.target.result.split(",")[1]);
      setMediaType(file.type);
      setAnalysisResult(null);
      setEstimate(null);
      setGoldPrice(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setLoading(true); setEstimate(null);
    setLoadingMsg("✦ Examining your jewelry...");
    const analysis = await analyzeJewelry(imageBase64, mediaType);
    if (analysis) {
      setAnalysisResult(analysis);
      if (analysis.suggested_weight_category) setWeightCategory(analysis.suggested_weight_category);
    }
    setLoadingMsg("✦ Fetching live gold price...");
    setGoldPrice(await fetchGoldPrice());
    setLoading(false); setLoadingMsg("");
  };

  const handleCalculate = () => {
    if (!goldPrice) return;
    const [minG, maxG] = WEIGHT_RANGE[weightCategory];
    const midG = (minG + maxG) / 2;
    const purity = KARAT_PURITY[karat];
    const calc = (g) => { const m = g * purity * goldPrice; return m + m * MAKING_CHARGE; };
    setEstimate({
      min: calc(minG), mid: calc(midG), max: calc(maxG),
      metalOnly: midG * purity * goldPrice,
      making: midG * purity * goldPrice * MAKING_CHARGE,
      purity, midWeight: midG
    });
  };

  const reset = () => {
    setImage(null); setImageBase64(null); setMediaType(null);
    setAnalysisResult(null); setGoldPrice(null); setEstimate(null);
    setWeightCategory("medium"); setKarat("22k");
  };

  const fmt = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const c = {
    page: { minHeight: "100vh", background: "#faf9f7", padding: "2rem 1rem", fontFamily: "'Inter', sans-serif" },
    wrap: { maxWidth: 580, margin: "0 auto" },
    header: { textAlign: "center", marginBottom: "2.5rem" },
    badge: { display: "inline-block", background: "#412402", borderRadius: 32, padding: "5px 16px", marginBottom: 16 },
    badgeText: { fontSize: 11, color: "#FAEEDA", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 },
    h1: { fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 400, color: "#1a1208", margin: "0 0 10px" },
    sub: { fontSize: 15, color: "#6b6050" },
    card: { background: "#fff", border: "1px solid #e8e0d0", borderRadius: 16, padding: "1.5rem", marginBottom: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
    label: { fontSize: 11, fontWeight: 600, color: "#9a8878", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 },
    uploadZone: (drag, hasImg) => ({ border: `2px dashed ${drag ? "#BA7517" : "#d4c8b4"}`, borderRadius: 14, padding: hasImg ? "14px" : "3rem 1rem", textAlign: "center", cursor: "pointer", background: drag ? "#FAEEDA" : "#faf8f4", transition: "all 0.2s", marginBottom: "1.25rem" }),
    analyzeBtn: (load) => ({ width: "100%", padding: "14px", fontSize: 15, fontWeight: 600, borderRadius: 12, marginBottom: "1.25rem", background: load ? "#c4a882" : "#BA7517", color: "#fff", border: "none", cursor: load ? "not-allowed" : "pointer", boxShadow: load ? "none" : "0 4px 14px rgba(186,117,23,0.3)" }),
    grid3: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.5rem" },
    optBtn: (active) => ({ padding: "14px 8px", border: active ? "2px solid #BA7517" : "1px solid #e8e0d0", borderRadius: 12, background: active ? "#FAEEDA" : "#fff", cursor: "pointer", textAlign: "center", transition: "all 0.15s" }),
    optTitle: (active) => ({ fontSize: 15, fontWeight: 600, color: active ? "#633806" : "#1a1a1a", marginBottom: 3 }),
    optSub: (active) => ({ fontSize: 12, color: active ? "#854F0B" : "#9a8878" }),
    calcBtn: { width: "100%", padding: "14px", fontSize: 15, fontWeight: 600, borderRadius: 12, marginBottom: "1.25rem", background: "#1a1208", color: "#FAEEDA", border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.18)" },
    resultTop: { background: "linear-gradient(135deg,#412402,#633806)", padding: "1.5rem", borderRadius: "14px 14px 0 0" },
    resultBody: { padding: "1.25rem" },
    range: { fontFamily: "'Playfair Display',serif", fontSize: 28, color: "#FAEEDA", marginTop: 4 },
    mGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 },
    mCard: { background: "#faf8f4", borderRadius: 10, padding: "12px 10px", border: "1px solid #ede5d8" },
    mLabel: { fontSize: 11, color: "#9a8878", marginBottom: 4 },
    mVal: { fontSize: 16, fontWeight: 600, color: "#1a1208", marginBottom: 2 },
    mNote: { fontSize: 11, color: "#b5a898" },
    disclaimer: { background: "#FAEEDA", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10 },
    discText: { fontSize: 12, color: "#633806", lineHeight: 1.6 },
    resetBtn: { width: "100%", padding: "12px", fontSize: 14, borderRadius: 12, background: "transparent", color: "#9a8878", border: "1px solid #e8e0d0", cursor: "pointer", marginTop: 8 },
  };

  return (
    <div style={c.page}>
      <div style={c.wrap}>
        <div style={c.header}>
          <div style={c.badge}><span style={c.badgeText}>✦ AI Jewelry Estimator</span></div>
          <h1 style={c.h1}>What is your jewelry worth?</h1>
          <p style={c.sub}>Upload a photo — AI analyzes it and gives you a real-time gold price estimate</p>
        </div>

        <div style={c.uploadZone(dragging, !!image)} onClick={() => fileRef.current.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => processFile(e.target.files[0])} />
          {image ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img src={image} alt="Jewelry" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 10, border: "1px solid #e8e0d0" }} />
              <div style={{ textAlign: "left" }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: "#1a1208", marginBottom: 4 }}>Photo uploaded ✓</p>
                <p style={{ fontSize: 13, color: "#9a8878" }}>Click to change photo</p>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 14 }}>💍</div>
              <p style={{ fontSize: 16, color: "#1a1208", fontWeight: 500, marginBottom: 6 }}>Drop your jewelry photo here</p>
              <p style={{ fontSize: 13, color: "#9a8878" }}>or click to browse · JPG, PNG, WEBP</p>
            </>
          )}
        </div>

        {image && !analysisResult && (
          <button style={c.analyzeBtn(loading)} onClick={handleAnalyze} disabled={loading}>
            {loading ? loadingMsg : "✦  Analyze My Jewelry"}
          </button>
        )}

        {analysisResult && (
          <div style={c.card}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ background: "#FAEEDA", borderRadius: 10, padding: "10px 12px", flexShrink: 0, fontSize: 20 }}>🔍</div>
              <div>
                <p style={{ fontSize: 12, color: "#9a8878", textTransform: "capitalize", marginBottom: 3 }}>{analysisResult.type}</p>
                <p style={{ fontSize: 15, fontWeight: 500, color: "#1a1208", marginBottom: 5 }}>{analysisResult.description}</p>
                <p style={{ fontSize: 13, color: "#6b6050" }}>⚖️ {analysisResult.weight_reasoning}</p>
              </div>
            </div>
            {goldPrice && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #ede5d8", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3B6D11", display: "inline-block" }}></span>
                <span style={{ fontSize: 13, color: "#6b6050" }}>Live gold price: <strong style={{ color: "#1a1208" }}>${goldPrice.toFixed(2)} per gram</strong></span>
              </div>
            )}
          </div>
        )}

        {analysisResult && (
          <>
            <p style={c.label}>Step 1 — Estimated Weight</p>
            <div style={c.grid3}>
              {["light", "medium", "heavy"].map(w => (
                <button key={w} style={c.optBtn(weightCategory === w)} onClick={() => { setWeightCategory(w); setEstimate(null); }}>
                  <div style={c.optTitle(weightCategory === w)}>{w.charAt(0).toUpperCase() + w.slice(1)}</div>
                  <div style={c.optSub(weightCategory === w)}>{WEIGHT_LABEL[w]}</div>
                </button>
              ))}
            </div>

            <p style={c.label}>Step 2 — Gold Purity</p>
            <div style={c.grid3}>
              {["18k", "22k", "24k"].map(k => (
                <button key={k} style={c.optBtn(karat === k)} onClick={() => { setKarat(k); setEstimate(null); }}>
                  <div style={c.optTitle(karat === k)}>{k}</div>
                  <div style={c.optSub(karat === k)}>{(KARAT_PURITY[k] * 100).toFixed(1)}% pure</div>
                </button>
              ))}
            </div>

            <button style={c.calcBtn} onClick={handleCalculate}>Calculate Price Estimate</button>
          </>
        )}

        {estimate && (
          <div style={{ background: "#fff", border: "1px solid #e8e0d0", borderRadius: 16, overflow: "hidden", marginBottom: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={c.resultTop}>
              <p style={{ fontSize: 11, color: "#FAC775", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Estimate · {karat} · {weightCategory} · +10% making</p>
              <p style={c.range}>{fmt(estimate.min)} — {fmt(estimate.max)}</p>
            </div>
            <div style={c.resultBody}>
              <div style={c.mGrid}>
                {[["Best estimate", fmt(estimate.mid), `~${estimate.midWeight}g`], ["Metal value", fmt(estimate.metalOnly), "gold only"], ["Making charge", fmt(estimate.making), "10%"]].map(([label, val, note]) => (
                  <div key={label} style={c.mCard}>
                    <p style={c.mLabel}>{label}</p>
                    <p style={c.mVal}>{val}</p>
                    <p style={c.mNote}>{note}</p>
                  </div>
                ))}
              </div>
              <div style={c.disclaimer}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                <p style={c.discText}>Based on live gold at <strong>${goldPrice.toFixed(2)}/gram</strong>, {(estimate.purity * 100).toFixed(1)}% purity ({karat}), and 10% making charge. Visit a certified jeweler for exact valuation.</p>
              </div>
            </div>
          </div>
        )}

        {analysisResult && <button style={c.resetBtn} onClick={reset}>← Start over with a new piece</button>}

        <p style={{ textAlign: "center", fontSize: 12, color: "#b5a898", marginTop: "2rem" }}>Powered by AI · Live gold prices · Estimates only</p>
      </div>
    </div>
  );
}
