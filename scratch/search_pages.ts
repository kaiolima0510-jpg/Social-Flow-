import { supabase } from '../services/supabaseService';

async function main() {
  console.log("Searching for pages in fb_pages:");
  const searchNames = ["Receitas de Sucesso", "Ateliê do Crochê", "Cozinha da Vovó"];
  
  for (const name of searchNames) {
    const { data, error } = await supabase
      .from('fb_pages')
      .select('*')
      .ilike('name', `%${name}%`);
      
    if (error) {
      console.error(`Error searching for ${name}:`, error);
    } else {
      console.log(`\nSearch for "${name}" returned ${data?.length || 0} results:`);
      data?.forEach(p => {
        console.log(` - ID: ${p.id}, FB_ID: ${p.fb_id}, Name: ${p.name}, CreatedAt: ${p.created_at}, Token: ${p.access_token ? p.access_token.substring(0, 15) + '...' : 'NONE'}`);
      });
    }
  }
}

main().catch(console.error);
