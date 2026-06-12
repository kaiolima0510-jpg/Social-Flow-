import { supabase } from "../services/supabaseService";

async function main() {
  const { data, error } = await supabase
    .from('scheduled_comments')
    .select('*')
    .eq('page_id', '122208281030575678')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Recent comments for Sabores Autênticos:");
  data?.forEach(c => {
    console.log(` - ID: ${c.id}, Status: ${c.status}, FB_PostID: ${c.fb_post_id}, Error: ${c.error_message}, Text: "${c.comment_text?.substring(0, 30)}..."`);
  });
}

main().catch(console.error);
