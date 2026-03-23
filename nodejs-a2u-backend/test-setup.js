// Test script to verify Pi Network A2U setup
import { loadEnv } from "./config/loadEnv.js";

loadEnv();

console.log("=== Pi Network A2U Setup Verification ===");
console.log("Environment Variables:");
console.log("- PI_API_KEY:", process.env.PI_API_KEY ? "✅ Set" : "❌ Missing");
console.log("- PI_WALLET_PRIVATE_SEED:", process.env.PI_WALLET_PRIVATE_SEED ? 
  (process.env.PI_WALLET_PRIVATE_SEED.length === 56 ? "✅ 56 chars" : `❌ ${process.env.PI_WALLET_PRIVATE_SEED.length} chars`) : "❌ Missing");
console.log("- PORT:", process.env.PORT || "3000 (default)");
console.log("- NODE_ENV:", process.env.NODE_ENV || "development");

if (process.env.PI_WALLET_PRIVATE_SEED) {
  const seed = process.env.PI_WALLET_PRIVATE_SEED;
  console.log("\nSeed Analysis:");
  console.log("- Starts with S_:", seed.startsWith("S_") ? "✅" : "❌");
  console.log("- Length:", `${seed.length}/56 chars`, seed.length === 56 ? "✅" : "❌");
}

console.log("\n=== Required Actions ===");
if (!process.env.PI_API_KEY) console.log("❌ Add PI_API_KEY to .env");
if (!process.env.PI_WALLET_PRIVATE_SEED || process.env.PI_WALLET_PRIVATE_SEED.length !== 56) {
  console.log("❌ Add correct 56-character PI_WALLET_PRIVATE_SEED to .env");
}
if (process.env.PI_API_KEY && process.env.PI_WALLET_PRIVATE_SEED?.length === 56) {
  console.log("✅ All environment variables are correct!");
  console.log("🚀 You can now start the backend with: npm run dev");
}
