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
      }
