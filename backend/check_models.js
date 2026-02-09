const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Initialize the API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function checkAvailableModels() {
  console.log("Checking models for API Key ending in: ...", process.env.GEMINI_API_KEY.slice(-4));
  
  try {
    // This fetches the live list of models from Google
    // We explicitly use the v1beta endpoint which has the newest models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log("\n✅ SUCCESS! Here are the models you can use:\n");
    const validModels = data.models
      .filter(m => m.supportedGenerationMethods.includes("generateContent"))
      .map(m => m.name.replace("models/", ""));
      
    validModels.forEach(name => console.log(`"${name}"`));
    
    console.log("\n👉 Copy one of the names above exactly into your 'modelName' variable.");

  } catch (error) {
    console.error("❌ Failed to list models:", error.message);
  }
}

checkAvailableModels();