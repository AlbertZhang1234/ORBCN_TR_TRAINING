import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL;
const OLD_SUPABASE_KEY = process.env.OLD_SUPABASE_KEY;

if (!OLD_SUPABASE_URL || !OLD_SUPABASE_KEY) {
    throw new Error('OLD_SUPABASE_URL and OLD_SUPABASE_KEY must be set');
}

const supabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

async function introspect() {
    console.log('Connecting to old Supabase...');

    // Try to query information_schema.tables directly (usually works with service_role)
    // Supabase PostgREST exposes public schema by default, but information_schema might be hidden.
    // However, if we use the service key, we might be able to query tables.
    
    // Let's first try to list known tables to verify connection.
    const knownTables = [
        'otto_user', 'otto_role', 'otto_userrole', 
        'otto_customer', 'otto_project', 
        'otto_travelentry', 'otto_invoices', 
        'otto_tr_h', 'otto_tr_t', 
        't_loginsessions'
    ];

    const schemaData = {};

    for (const table of knownTables) {
        console.log(`Introspecting table: ${table}`);
        
        // Fetch one row to check structure
        const { data: sampleData, error: sampleError } = await supabase
            .from(table)
            .select('*')
            .limit(1);

        if (sampleError) {
            console.error(`Error accessing table ${table}:`, sampleError.message);
            continue;
        }

        // Fetch all data
        const { data: allData, error: dataError } = await supabase
            .from(table)
            .select('*');

        if (dataError) {
            console.error(`Error fetching data for ${table}:`, dataError.message);
        } else {
            console.log(`Fetched ${allData.length} rows from ${table}`);
            schemaData[table] = {
                columns: sampleData.length > 0 ? Object.keys(sampleData[0]) : [],
                data: allData
            };
        }
    }

    // Save schema and data
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    fs.writeFileSync(path.join(dataDir, 'old_db_dump.json'), JSON.stringify(schemaData, null, 2));
    console.log('Dump completed to data/old_db_dump.json');
}

introspect().catch(console.error);
