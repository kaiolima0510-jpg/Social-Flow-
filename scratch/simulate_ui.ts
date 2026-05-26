import { fetchAccountsFromCloud, supabase } from '../services/supabaseService';

async function main() {
  console.log("=== SIMULATING UI LOAD ===");
  const accounts = await fetchAccountsFromCloud();
  console.log(`fetchAccountsFromCloud returned ${accounts.length} accounts.`);
  
  let totalUIPages = 0;
  const pageFbIds = new Set<string>();
  const duplicates = new Map<string, number>();

  accounts.forEach((acc: any) => {
    console.log(`Account Card: "${acc.name}" (ID: ${acc.id}) has ${acc.pages?.length || 0} pages.`);
    acc.pages?.forEach((p: any) => {
      totalUIPages++;
      if (pageFbIds.has(p.fb_id)) {
        duplicates.set(p.fb_id, (duplicates.get(p.fb_id) || 1) + 1);
      } else {
        pageFbIds.add(p.fb_id);
      }
    });
  });

  console.log(`\nTotal Pages in UI: ${totalUIPages}`);
  console.log(`Distinct FB IDs in UI: ${pageFbIds.size}`);
  
  if (duplicates.size > 0) {
    console.log(`\nFound ${duplicates.size} duplicate FB IDs in the UI grouping:`);
    for (const [fbId, count] of duplicates.entries()) {
      const { data: matchingPages } = await supabase.from('fb_pages').select('id, name, account_id').eq('fb_id', fbId);
      console.log(` - FB_ID: ${fbId} occurs ${count} times:`);
      matchingPages?.forEach(p => {
        console.log(`   * Page ID: ${p.id}, Name: ${p.name}, Account ID: ${p.account_id}`);
      });
    }
  }

  // Check if any pages in fb_pages are NOT returned in accounts
  const { data: allDbPages } = await supabase.from('fb_pages').select('id, fb_id, name');
  const dbPageIds = new Set(allDbPages?.map(p => p.id) || []);
  
  console.log(`\nTotal pages in fb_pages table: ${allDbPages?.length || 0}`);
}

main().catch(console.error);
