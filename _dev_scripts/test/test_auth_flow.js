const axios = require('axios');

async function testAuth() {
  const BASE_URL = 'http://localhost:3000/api';
  console.log('--- Testing Auth Flow ---');

  try {
    // 1. Login
    console.log('1. Attempting login...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@sepcpower.com',
      password: 'Admin@1234'
    });
    
    console.log('   Login success!');
    const token = loginRes.data.data.accessToken;
    console.log('   Access Token length:', token.length);
    
    // Extract cookie from response
    const cookie = loginRes.headers['set-cookie'];
    console.log('   Refresh Cookie Set:', cookie ? 'YES' : 'NO');
    if (cookie) console.log('   Cookie details:', cookie[0]);

    // 2. Refresh
    console.log('\n2. Attempting refresh...');
    try {
      const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
        headers: {
          Cookie: cookie ? cookie[0] : ''
        }
      });
      console.log('   Refresh success!');
      console.log('   New Access Token length:', refreshRes.data.data.accessToken.length);
    } catch (e) {
      console.error('   Refresh FAILED:', e.response?.status, e.response?.data?.message || e.message);
    }

    // 3. Me
    console.log('\n3. Attempting /me...');
    try {
      const meRes = await axios.get(`${BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('   /me success! Welcome:', meRes.data.data.full_name);
    } catch (e) {
      console.error('   /me FAILED:', e.response?.status, e.response?.data?.message || e.message);
    }

  } catch (e) {
    console.error('   Error during test:', e.response?.status, e.response?.data?.message || e.message);
  }
}

testAuth();
