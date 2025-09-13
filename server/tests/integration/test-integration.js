const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';
const API_KEY = 'g5u~~a4DJfaBiPuw38';

const testSecuADRAPI = async () => {
  console.log('🧪 Starting SecuADR API Integration Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data.message);

    // Test 2: Authentication Endpoint
    console.log('\n2. Testing Authentication...');
    const authResponse = await axios.post(`${API_BASE_URL}/api/authenticate`, {
      username: 'testuser',
      cnnConfidence: 0.8,
      dollarScore: 0.75,
      metadata: {
        timestamp: Date.now(),
        deviceType: 'test',
        userAgent: 'integration-test'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    });
    
    console.log('✅ Authentication Response:', {
      success: authResponse.data.success,
      method: authResponse.data.method,
      finalScore: authResponse.data.finalScore
    });

    console.log('\n🎉 All integration tests passed!');
    
  } catch (error) {
    console.error('\n❌ Integration Test Failed:');
    console.error('Error:', error.response?.data?.message || error.message);
  }
};

testSecuADRAPI();
