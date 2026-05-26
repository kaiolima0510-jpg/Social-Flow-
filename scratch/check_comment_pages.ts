import { supabase } from '../services/supabaseService';

async function main() {
  console.log("=== CHECKING PAGES FOR SCHEDULED COMMENTS ===");
  const { data: comments, error } = await supabase
    .from('scheduled_comments')
    .select('*')
    .order('scheduled_time', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error(error);
    return;
  }
  
  for (const c of comments || []) {
    const { data: page } = await supabase.from('fb_pages').select('name').eq('fb_id', c.page_id).maybeSingle();
    console.log(` - Comment ID: ${c.id}, PageID: ${c.page_id}, Page Name: "${page?.name || 'UNKNOWN'}", Status: ${c.status}, Time: ${c.scheduled_time}`);
  }
}

main().catch(console.error);
