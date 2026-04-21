// scripts/supabase-db-check.js
// Usage: node scripts/supabase-db-check.js
// This script adds a test customer to Supabase, verifies it, and deletes it.

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const vendorId = process.env.TEST_VENDOR_ID || '00000000-0000-0000-0000-000000000000'; // Set a real vendor id for your test

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const testPhone = `+234000${Date.now()}`;
  const testCustomer = {
    vendor_id: vendorId,
    name: 'Test Automation',
    phone: testPhone,
    email: 'test-automation@example.com',
    address: 'Automation Lane',
  };

  // 1. Insert test customer
  const { data: insertData, error: insertError } = await supabase
    .from('customers')
    .insert([testCustomer])
    .select();
  if (insertError) {
    console.error('Insert error:', insertError);
    process.exit(1);
  }
  const inserted = insertData[0];
  console.log('Inserted:', inserted);

  // 2. Query for the customer
  const { data: queryData, error: queryError } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', testPhone)
    .single();
  if (queryError) {
    console.error('Query error:', queryError);
    process.exit(1);
  }
  console.log('Queried:', queryData);

  // 3. Delete the test customer
  await supabase.from('customers').delete().eq('id', inserted.id);
  console.log('Cleanup complete.');
}

main();
