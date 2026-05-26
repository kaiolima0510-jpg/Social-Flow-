import { supabase } from '../services/supabaseService';

async function main() {
  console.log("Searching with flexible terms:");
  const terms = ["croch", "atel", "suceso", "vov"];
  
  for (const term of terms) {
    const { data, error } = await supabase
      .from('fb_pages')
      .select('id, name, fb_id, created_at')
      .or(`name.ilike.%${term}%,category.ilike.%${term}%`);
      
    if (error) {
      console.error(`Error searching for ${term}:`, error);
    } else {
      console.log(`\nSearch for "${term}" returned ${data?.length || 0} results:`);
      data?.forEach(p => {
        console.log(` - ID: ${p.id}, FB_ID: ${p.fb_id}, Name: ${p.name}, CreatedAt: ${p.created_at}`);
      });
    }
  }
}

main().catch(console.error);
