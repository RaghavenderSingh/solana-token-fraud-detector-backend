// Test script for Helius Service
require('dotenv').config();

// Import the service (using require since it's a .js file)
const { HeliusService, exploreTokenData } = require('./dist/services/heliusService.js');

async function testHeliusService() {
  console.log('🚀 Testing Helius Service...\n');
  
  // Check if API key is available
  const apiKey = process.env.HELIUS_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️  No HELIUS_API_KEY found in environment variables');
    console.log('📝 Please set your Helius API key in a .env file:');
    console.log('   HELIUS_API_KEY=your_api_key_here');
    console.log('\n🔗 Get your API key from: https://dev.helius.xyz/');
    return;
  }

  try {
    // Test the service
    await exploreTokenData();
  } catch (error) {
    console.error('❌ Error running test:', error);
  }
}

// Run the test
testHeliusService(); 