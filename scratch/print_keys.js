import { supabase } from '../services/supabaseService.js';

async function printKeys() {
  try {
    const { data, error } = await supabase.from('fb_pages').select('*').limit(1);
    if (error) throw error;
    console.log("Sample row:", data[0]);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

printKeys();
