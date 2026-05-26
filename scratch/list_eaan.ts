import { supabase } from '../services/supabaseService';

async function main() {
  const { data: pages } = await supabase
    .from('fb_pages')
    .select('name, fb_id, access_token')
    .like('access_token', 'EAAN%');
    
  console.log("=== EXPIRED EAAN PAGES ===");
  pages?.forEach(p => {
    console.log(` - Page Name: "${p.name}", FB_ID: ${p.fb_id}`);
  });
}

main().catch(console.error);
