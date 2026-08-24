import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL;
const OLD_SUPABASE_KEY = process.env.OLD_SUPABASE_KEY;

if (!OLD_SUPABASE_URL || !OLD_SUPABASE_KEY) {
    throw new Error('OLD_SUPABASE_URL and OLD_SUPABASE_KEY must be set');
}

const supabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

const tables = [
    'otto_user',
    'otto_role',
    'otto_userrole',
    'otto_customer',
    'otto_project',
    'otto_travelentry',
    'otto_invoices',
    'otto_tr_h',
    'otto_tr_t',
    't_loginsessions'
];

async function exportData() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    console.log('Starting data export...');

    for (const table of tables) {
        console.log(`Fetching table: ${table}`);
        const { data, error } = await supabase
            .from(table)
            .select('*');

        if (error) {
            console.error(`Error fetching ${table}:`, error);
            continue;
        }

        const filePath = path.join(dataDir, `${table}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Saved ${data.length} rows to ${filePath}`);
    }

    console.log('Export completed.');
}

exportData().catch(console.error);
