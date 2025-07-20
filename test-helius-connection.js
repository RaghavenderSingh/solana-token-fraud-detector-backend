const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.HELIUS_API_KEY;

async function testHeliusConnection() {
  console.log('🔍 Testing Helius API connection...');
  console.log('API Key:', API_KEY ? '✅ Present' : '❌ Missing');
  
  if (!API_KEY) {
    console.error('❌ HELIUS_API_KEY not found in environment variables');
    return;
  }

  // Test 1: Basic RPC call
  try {
    console.log('\n📡 Test 1: Basic RPC call...');
    const response = await axios.post(
      `https://mainnet.helius-rpc.com/?api-key=${API_KEY}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
      }
    );
    console.log('✅ RPC connection successful:', response.data);
  } catch (error) {
    console.error('❌ RPC connection failed:', error.response?.data || error.message);
  }

  // Test 2: Get Asset (DAS)
  try {
    console.log('\n📄 Test 2: Get Asset (DAS)...');
    const response = await axios.post(
      `https://mainnet.helius-rpc.com/?api-key=${API_KEY}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getAsset",
        params: { id: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
      }
    );
    console.log('✅ DAS call successful');
    if (response.data?.result) {
      console.log('Token name:', response.data.result.content?.metadata?.name);
      console.log('Token symbol:', response.data.result.content?.metadata?.symbol);
    }
  } catch (error) {
    console.error('❌ DAS call failed:', error.response?.data || error.message);
  }

  // Test 3: Enhanced API (v0)
  try {
    console.log('\n🔗 Test 3: Enhanced API (v0)...');
    const response = await axios.get(
      `https://api.helius.xyz/v0/addresses/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/transactions`,
      {
        params: {
          'api-key': API_KEY,
          limit: 1,
        }
      }
    );
    console.log('✅ Enhanced API call successful');
    console.log('Transactions found:', response.data?.length || 0);
  } catch (error) {
    console.error('❌ Enhanced API call failed:', error.response?.data || error.message);
  }
}

testHeliusConnection().catch(console.error); 