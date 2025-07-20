// test-helius.js - Simple Node.js script to test Helius integration
require('dotenv').config();
const axios = require('axios');

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const BASE_URL = 'https://api.helius.xyz/v0';

if (!HELIUS_API_KEY) {
  console.error('❌ Please set HELIUS_API_KEY in your .env file');
  process.exit(1);
}

// Test different Helius endpoints with various tokens
async function testHeliusAPIs() {
  console.log('🚀 Testing Helius API Integration');
  console.log('='.repeat(50));

  // Test tokens - mix of safe and potentially risky
  const testTokens = [
    {
      name: 'Wrapped SOL',
      address: 'So11111111111111111111111111111111111111112',
      expected: 'safe'
    },
    {
      name: 'USDC',
      address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      expected: 'safe'
    },
    {
      name: 'BONK',
      address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      expected: 'established'
    }
  ];

  for (const token of testTokens) {
    console.log(`\n🎯 Testing: ${token.name} (${token.address})`);
    console.log('-'.repeat(70));

    try {
      // 1. Test Token Metadata API
      console.log('\n📄 1. Token Metadata:');
      const metadataResponse = await axios.get(`${BASE_URL}/tokens`, {
        params: {
          'api-key': HELIUS_API_KEY,
          addresses: token.address,
          include: 'all'
        }
      });

      if (metadataResponse.data?.tokens?.length > 0) {
        const tokenData = metadataResponse.data.tokens[0];
        console.log(`   Name: ${tokenData.name || 'N/A'}`);
        console.log(`   Symbol: ${tokenData.symbol || 'N/A'}`);
        console.log(`   Decimals: ${tokenData.decimals || 'N/A'}`);
        console.log(`   Supply: ${tokenData.supply || 'N/A'}`);
        console.log(`   Mint Authority: ${tokenData.mintAuthority || 'N/A'}`);
        console.log(`   Freeze Authority: ${tokenData.freezeAuthority || 'N/A'}`);
        console.log(`   Description: ${tokenData.description || 'N/A'}`);
        
        // Log full response for first token to see structure
        if (token.address === testTokens[0].address) {
          console.log('\n🔍 Full metadata structure:');
          console.log(JSON.stringify(tokenData, null, 2));
        }
      } else {
        console.log('   ❌ No metadata found');
      }

      // 2. Test Transactions API
      console.log('\n📊 2. Recent Transactions:');
      const txResponse = await axios.get(`${BASE_URL}/addresses/${token.address}/transactions`, {
        params: {
          'api-key': HELIUS_API_KEY,
          limit: 5
        }
      });

      if (txResponse.data && Array.isArray(txResponse.data)) {
        console.log(`   Found ${txResponse.data.length} recent transactions`);
        
        if (txResponse.data.length > 0) {
          const latestTx = txResponse.data[0];
          console.log(`   Latest: ${latestTx.signature}`);
          console.log(`   Type: ${latestTx.type || 'N/A'}`);
          console.log(`   Timestamp: ${new Date(latestTx.timestamp * 1000).toISOString()}`);
          console.log(`   Description: ${latestTx.description || 'N/A'}`);
          
          // Log full transaction structure for first token
          if (token.address === testTokens[0].address) {
            console.log('\n🔍 Full transaction structure:');
            console.log(JSON.stringify(latestTx, null, 2));
          }
        }
      } else {
        console.log('   ❌ No transactions found');
      }

      // 3. Test Balance API (if we can find a holder)
      if (txResponse.data?.length > 0 && txResponse.data[0].feePayer) {
        console.log('\n💰 3. Token Balances (Sample Wallet):');
        const sampleWallet = txResponse.data[0].feePayer;
        
        try {
          const balanceResponse = await axios.get(`${BASE_URL}/addresses/${sampleWallet}/balances`, {
            params: {
              'api-key': HELIUS_API_KEY
            }
          });

          if (balanceResponse.data?.tokens) {
            console.log(`   Wallet ${sampleWallet.slice(0, 8)}... holds ${balanceResponse.data.tokens.length} different tokens`);
            
            // Show tokens with this specific token
            const relevantTokens = balanceResponse.data.tokens.filter(t => 
              t.mint === token.address || t.amount > 0
            );
            
            if (relevantTokens.length > 0) {
              console.log(`   Relevant token holdings: ${relevantTokens.length}`);
            }
          }
        } catch (balanceError) {
          console.log('   ⚠️ Could not fetch balance data');
        }
      }

      // Basic risk assessment
      console.log('\n⚠️ 4. Basic Risk Assessment:');
      const risks = [];
      
      const tokenData = metadataResponse.data?.tokens?.[0];
      if (tokenData) {
        if (tokenData.mintAuthority && tokenData.mintAuthority !== '11111111111111111111111111111111') {
          risks.push('Mint authority not revoked');
        }
        if (tokenData.freezeAuthority && tokenData.freezeAuthority !== '11111111111111111111111111111111') {
          risks.push('Freeze authority active');
        }
        if (!tokenData.name || !tokenData.symbol) {
          risks.push('Missing basic metadata');
        }
        if (txResponse.data?.length < 10) {
          risks.push('Low transaction activity');
        }
      }

      if (risks.length === 0) {
        console.log('   ✅ No major red flags detected');
      } else {
        console.log('   ⚠️ Risk factors found:');
        risks.forEach((risk, i) => {
          console.log(`      ${i + 1}. ${risk}`);
        });
      }

      // Wait between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Error testing ${token.name}:`, error.message);
    }
  }

  // 4. Test connection with a simple API call
  console.log('\n🔌 Testing API Connection:');
  try {
    const testResponse = await axios.get(`${BASE_URL}/addresses/vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg/transactions`, {
      params: {
        'api-key': HELIUS_API_KEY,
        limit: 1
      }
    });
    
    if (testResponse.status === 200) {
      console.log('✅ Helius API connection successful');
      console.log(`✅ API response time: ${testResponse.headers['x-response-time'] || 'N/A'}`);
    }
  } catch (error) {
    console.error('❌ API connection test failed:', error.message);
  }

  console.log('\n🎉 Helius API testing complete!');
  console.log('='.repeat(50));
}

// Run the tests
testHeliusAPIs().catch(console.error);