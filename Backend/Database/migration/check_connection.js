import { createClient } from '@supabase/supabase-js';

const NEW_SUPABASE_URL = 'https://spb-ks0bkv1uqa7cgru8.supabase.opentrust.net';
const NEW_SUPABASE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTc1MjY4NjE0NSwiZXhwIjozMzMwNDQ2MTQ1fQ.hrUIhc8UrXzTl2RhF05hjAZzcAMNTNnTPEb1VQBNZ1s';

const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function testConnection() {
    console.log('Testing connection to:', NEW_SUPABASE_URL);

    // 1. Try a simple SELECT from a non-existent table (should be 404 or 401)
    // If it's "Invalid authentication credentials", then the key/URL combo is wrong.
    const { data, error } = await supabase.from('non_existent_table').select('*').limit(1);

    if (error) {
        console.log('Connection Result:', error.message);
        console.log('Full Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Connection Successful (Unexpectedly found table?)');
    }
}

testConnection();
