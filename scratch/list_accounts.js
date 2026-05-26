import { supabase } from '../services/supabaseService.js';

async function listAccounts() {
  try {
    const { data, error } = await supabase.from('fb_accounts').select('*');
    if (error) throw error;

    console.log(`Total accounts: ${data.length}`);
    data.forEach((acc, i) => {
      console.log(`${i + 1}. [ID: ${acc.id}] [Name: ${acc.name}]`);
    });
  } catch (e) {
    console.error("Error:", e.message);
  }
}

listAccounts();
