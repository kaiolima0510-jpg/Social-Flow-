import { supabase } from '../services/supabaseService';

async function main() {
  console.log("=== CHECKING RECENT POSTS AND PUBLICATIONS ===");
  
  // 1. Fetch recent entries in post_history
  const { data: history, error: histError } = await supabase
    .from('post_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (histError) {
    console.error("Error fetching post_history:", histError);
  } else {
    console.log(`\nFound ${history?.length || 0} recent post history entries:`);
    history?.forEach(h => {
      console.log(` - ID: ${h.id}, Caption: "${h.main_caption?.substring(0, 30)}...", Type: ${h.post_type}, CreatedAt: ${h.created_at}`);
    });
  }

  // 2. Fetch recent entries in publications
  const { data: pubs, error: pubError } = await supabase
    .from('publications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(15);
    
  if (pubError) {
    console.error("Error fetching publications:", pubError);
  } else {
    console.log(`\nFound ${pubs?.length || 0} recent publication attempts:`);
    for (const p of pubs || []) {
      // Get the page name from fb_pages
      const { data: page } = await supabase.from('fb_pages').select('name').eq('fb_id', p.page_id).maybeSingle();
      const pageName = page?.name || p.page_id;
      console.log(` - Time: ${p.created_at}, Page: "${pageName}", Status: ${p.status}, FB_PostID: ${p.fb_post_id}, Error: "${p.error_message || 'OK'}"`);
    }
  }

  // 3. Check for scheduled comments
  const { data: comments, error: cmtError } = await supabase
    .from('scheduled_comments')
    .select('*')
    .order('scheduled_time', { ascending: false })
    .limit(10);
    
  if (cmtError) {
    console.error("Error fetching scheduled_comments:", cmtError);
  } else {
    console.log(`\nFound ${comments?.length || 0} recent scheduled comments:`);
    comments?.forEach(c => {
      console.log(` - Time: ${c.scheduled_time}, Status: ${c.status}, FB_PostID: ${c.fb_post_id}, Text: "${c.comment_text?.substring(0, 30)}..."`);
    });
  }
}

main().catch(console.error);
