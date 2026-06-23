const { createClient } = require('@supabase/supabase-js');

const url = 'https://sehriehyqluuoyhkgdcs.supabase.co';
const key1 = 'sb_publishable_pGLiV73Ewaasl05xFxeW3A_cbKzQ-Yz';
const key2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlaHJpZWh5cWx1dW95aGtnZGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExOTg0NDgsImV4cCI6MjA5Njc3NDQ0OH0.GsZtasKEvKX-9mi1Q32mRe8rmRIiOI6VDyZysDTzMYM';

async function test() {
  console.log('Testing signUp with key1...');
  try {
    const supabase = createClient(url, key1);
    const { data, error } = await supabase.auth.signUp({
      email: 'test_node_signup1@bondmann.com.br',
      password: 'SenhaTeste123!',
    });
    if (error) {
      console.log('key1 signUp Error:', error.message, error);
    } else {
      console.log('key1 signUp Success! User:', data.user?.id);
    }
  } catch (err) {
    console.error('key1 Request Failed:', err.message);
  }

  console.log('Testing signUp with key2...');
  try {
    const supabase = createClient(url, key2);
    const { data, error } = await supabase.auth.signUp({
      email: 'test_node_signup2@bondmann.com.br',
      password: 'SenhaTeste123!',
    });
    if (error) {
      console.log('key2 signUp Error:', error.message, error);
    } else {
      console.log('key2 signUp Success! User:', data.user?.id);
    }
  } catch (err) {
    console.error('key2 Request Failed:', err.message);
  }
}

test();
