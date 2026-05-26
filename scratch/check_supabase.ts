import { supabase } from '../services/supabaseService';

async function main() {
  console.log("Checking Supabase tables...");
  
  const { data: accounts, error: accError } = await supabase.from('fb_accounts').select('*');
  if (accError) {
    console.error("Error fetching fb_accounts:", accError);
  } else {
    console.log(`Found ${accounts?.length || 0} accounts in fb_accounts:`);
    accounts?.forEach(acc => {
      console.log(` - ID: ${acc.id}, Name: ${acc.name}, Token: ${acc.token?.substring(0, 15)}...`);
    });
  }

  const { data: pages, error: pageError } = await supabase.from('fb_pages').select('*');
  if (pageError) {
    console.error("Error fetching fb_pages:", pageError);
  } else {
    console.log(`\nFound ${pages?.length || 0} pages in fb_pages:`);
    pages?.forEach(page => {
      console.log(` - PageID: ${page.id}, FB_ID: ${page.fb_id}, Name: ${page.name}, AccountID: ${page.account_id}, Token: ${page.access_token?.substring(0, 15)}...`);
    });
  }
}

main().catch(console.error);
