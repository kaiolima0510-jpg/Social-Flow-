import { supabase } from '../services/supabaseService.js';

async function checkPages() {
  try {
    const { data, error } = await supabase.from('fb_pages').select('*');
    if (error) throw error;

    console.log(`Total pages in database: ${data.length}`);
    console.log("Pages List:");
    data.forEach((p, i) => {
      console.log(`${i + 1}. [ID: ${p.fb_id}] [Name: ${p.name}] [Account: ${p.account_id}]`);
    });

    const targetPageId = '570460092810059';
    const exists = data.find(p => p.fb_id === targetPageId);
    console.log(`\nDoes 'Delícias do Dia' (${targetPageId}) exist in DB?`, !!exists);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

checkPages();
