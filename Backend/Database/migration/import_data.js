
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NEW Supabase Credentials (passed via env or hardcoded placeholder)
const NEW_SUPABASE_URL = 'https://spb-ks0bkv1uqa7cgru8.supabase.opentrust.net';
const NEW_SUPABASE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTc1MjY4NjE0NSwiZXhwIjozMzMwNDQ2MTQ1fQ.hrUIhc8UrXzTl2RhF05hjAZzcAMNTNnTPEb1VQBNZ1s'; // Anon Key

if (!NEW_SUPABASE_KEY) {
    console.error('Error: NEW_SUPABASE_KEY environment variable is required (Service Role Key).');
    process.exit(1);
}

const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

const dumpFile = path.join(__dirname, 'data', 'old_db_dump.json');
const dump = JSON.parse(fs.readFileSync(dumpFile, 'utf8'));

// Order matters for data import due to FKs
const importOrder = [
    'otto_user',
    'otto_role',
    'otto_customer',
    'otto_project', // depends on customer, user
    'otto_travelentry', // depends on user, project
    'otto_invoices', // depends on travelentry
    'otto_tr_h', // depends on user
    'otto_tr_t', // depends on tr_h, invoices
    'otto_userrole', // depends on user, role
    't_loginsessions' // depends on user (logical)
];

async function importData() {
    console.log('Starting data import to ' + NEW_SUPABASE_URL);

    for (const table of importOrder) {
        if (!dump[table]) continue;
        const { data } = dump[table];
        if (!data || data.length === 0) continue;

        console.log(`Importing ${data.length} rows into ${table}...`);
        
        // Batch insert to avoid payload limits
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const { error } = await supabase.from(table).upsert(batch);
            
            if (error) {
                console.error(`Error importing batch ${i} for ${table}:`, error);
                // Continue with next batch or stop?
                // process.exit(1); 
            }
        }
    }
    console.log('Import completed.');
}

importData().catch(console.error);
