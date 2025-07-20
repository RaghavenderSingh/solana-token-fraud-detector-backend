# Helius API Endpoint Explorer
# Let's test different endpoints to see what's available

API_KEY="38841987-ca89-46e8-99ec-f1d5f20184a8"
BASE_URL="https://api.helius.xyz/v0"

echo "🔍 Testing Helius API Endpoints..."
echo "================================="

# 1. Test addresses endpoint (we know this works)
echo -e "\n✅ 1. Testing addresses/transactions endpoint:"
curl -s "${BASE_URL}/addresses/So11111111111111111111111111111111111111112/transactions?api-key=${API_KEY}&limit=1" | jq '.[] | {signature, type, timestamp}' 2>/dev/null || echo "❌ Failed"

# 2. Test token metadata via different endpoint
echo -e "\n🔍 2. Testing token-metadata endpoint:"
curl -s "${BASE_URL}/token-metadata?api-key=${API_KEY}&mint=So11111111111111111111111111111111111111112" | jq . 2>/dev/null || echo "❌ Method not found"

# 3. Test webhooks endpoint (to see available endpoints)
echo -e "\n🔍 3. Testing webhooks endpoint (for available methods):"
curl -s "${BASE_URL}/webhooks?api-key=${API_KEY}" | jq . 2>/dev/null || echo "❌ Method not found"

# 4. Test RPC method for token account info
echo -e "\n🔍 4. Testing RPC getAccountInfo:"
curl -s -X POST "https://mainnet.helius-rpc.com/?api-key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getAccountInfo",
    "params": [
      "So11111111111111111111111111111111111111112",
      {
        "encoding": "jsonParsed"
      }
    ]
  }' | jq . 2>/dev/null || echo "❌ Failed"

# 5. Test RPC method for SPL token supply
echo -e "\n🔍 5. Testing RPC getTokenSupply:"
curl -s -X POST "https://mainnet.helius-rpc.com/?api-key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getTokenSupply",
    "params": [
      "So11111111111111111111111111111111111111112"
    ]
  }' | jq . 2>/dev/null || echo "❌ Failed"

# 6. Test enhanced transactions endpoint
echo -e "\n🔍 6. Testing enhanced transactions:"
curl -s -X POST "${BASE_URL}/transactions?api-key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": ["4toDdjt8vHReuJNhBxySWfT2azgFTjed2K87FbecSPDx19657UqhVnuksQ1XzU6KZS3sR9b4rqy7kCPhiAakRJHz"]
  }' | jq . 2>/dev/null || echo "❌ Failed"

# 7. Test addresses balances
echo -e "\n🔍 7. Testing addresses/balances:"
curl -s "${BASE_URL}/addresses/vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg/balances?api-key=${API_KEY}" | jq . 2>/dev/null || echo "❌ Failed"

# 8. Test DAS (Digital Asset Standard) API
echo -e "\n🔍 8. Testing DAS getAsset:"
curl -s -X POST "https://mainnet.helius-rpc.com/?api-key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "getAsset",
    "params": {
      "id": "So11111111111111111111111111111111111111112"
    }
  }' | jq . 2>/dev/null || echo "❌ Failed"

echo -e "\n🎉 Endpoint exploration complete!"
echo "================================="