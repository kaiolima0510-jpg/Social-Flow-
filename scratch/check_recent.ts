import { supabase } from '../services/supabaseService';

async function main() {
  console.log("=== SUPABASE RECENT ACTIVITY ===");
  
  // Count accounts and pages
  const { count: accCount } = await supabase.from('fb_accounts').select('*', { count: 'exact', head: true });
  const { count: pageCount } = await supabase.from('fb_pages').select('*', { count: 'exact', head: true });
  
  console.log(`Total accounts: ${accCount}`);
  console.log(`Total pages in fb_pages: ${pageCount}`);

  // Fetch the 5 most recently modified pages in fb_pages
  // Since fb_pages might have a 'created_at' or 'updated_at' column, let's fetch and sort.
  // We don't know the exact schema, so let's select all and check keys.
  const { data: pages, error } = await supabase
    .from('fb_pages')
    .select('*')
    .limit(10);
    
  if (error) {
    console.error("Error fetching pages:", error);
    return;
  }
  
  if (pages && pages.length > 0) {
    console.log("\nSample pages and their columns:");
    console.log("Columns present:", Object.keys(pages[0]));
    
    // Sort pages if they have created_at/updated_at/last_sync or similar
    const hasCreatedAt = 'created_at' in pages[0];
    const hasUpdatedAt = 'updated_at' in pages[0];
    
    let query = supabase.from('fb_pages').select('*');
    if (hasUpdatedAt) {
      query = query.order('updated_at', { ascending: false });
    } else if (hasCreatedAt) {
      query = query.order('created_at', { ascending: false });
    }
    
    const { data: recentPages } = await query.limit(5);
    console.log("\nRecently updated/created pages in fb_pages:");
    recentPages?.forEach(p => {
      console.log(` - ID: ${p.id}, FB_ID: ${p.fb_id}, Name: ${p.name}, Account_ID: ${p.account_id}, CreatedAt: ${p.created_at || 'N/A'}, UpdatedAt: ${p.updated_at || 'N/A'}, Token: ${p.access_token ? p.access_token.substring(0, 20) + '...' : 'NONE'}`);
    });
  }
}

main().catch(console.error);
