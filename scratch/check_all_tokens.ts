import { supabase } from '../services/supabaseService';

async function main() {
  console.log("=== ANALYZING ALL TOKENS IN DATABASE ===");
  const { data: pages, error } = await supabase
    .from('fb_pages')
    .select('name, fb_id, access_token, created_at');
    
  if (error) {
    console.error(error);
    return;
  }
  
  let eaanCount = 0;
  let eaaqCount = 0;
  let otherCount = 0;
  const expiredPages: string[] = [];
  const activePages: string[] = [];

  pages?.forEach(p => {
    const token = p.access_token || "";
    if (token.startsWith("EAAN")) {
      eaanCount++;
      expiredPages.push(p.name);
    } else if (token.startsWith("EAAQ")) {
      eaaqCount++;
      activePages.push(p.name);
    } else {
      otherCount++;
    }
  });

  console.log(`\nTotal pages: ${pages?.length || 0}`);
  console.log(` - Tokens starting with EAAN (Expired App): ${eaanCount}`);
  console.log(` - Tokens starting with EAAQ (Active App): ${eaaqCount}`);
  console.log(` - Other tokens: ${otherCount}`);
  
  console.log("\nActive pages (EAAQ tokens):");
  activePages.forEach(name => console.log(` - ${name}`));
}

main().catch(console.error);
