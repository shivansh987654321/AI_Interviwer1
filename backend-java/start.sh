#!/bin/bash
# Start the Java Spring Boot backend
# Usage: ./start.sh

# Parse .env safely — strips quotes and skips comments
while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    value="${value%\"}"
    value="${value#\"}"
    export "$key=$value"
done < .env

echo "------------------------------------------------"
echo "🚀 STARTING JAVA BACKEND..."
echo "🔑 OPENAI_API_KEY:    $([ -n "$OPENAI_API_KEY" ] && echo '✅ LOADED' || echo '❌ NOT SET')"
echo "🔑 GROQ_API_KEY:      $([ -n "$GROQ_API_KEY" ] && echo '✅ LOADED' || echo '❌ NOT SET')"
echo "🎙️ ELEVENLABS_API_KEY:$([ -n "$ELEVENLABS_API_KEY" ] && echo '✅ LOADED' || echo '⚠️  NOT SET (TTS fallback active)')"
echo "🗄️ MONGODB_URI:       $([ -n "$MONGODB_URI" ] && echo '✅ CONFIGURED' || echo '⚠️  NOT SET (file-based fallback)')"
echo "🌐 HTTP API:          http://localhost:5001"
echo "🔌 Socket.io:         http://localhost:5002"
echo "------------------------------------------------"

mvn spring-boot:run
