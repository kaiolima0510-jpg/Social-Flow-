import { supabase } from '../services/supabaseService';
import fetch from 'node-fetch';

async function testPageToken(name: string, fbId: string, token: string) {
  console.log(`\nTesting token for page "${name}" (FB_ID: ${fbId})...`);
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${fbId}?fields=name,fan_count&access_token=${token}`);
    const data: any = await res.json();
    console.log("Response:", data);
    if (data.error) {
      console.log(`❌ TOKEN IS EXPIRED OR INVALID: ${data.error.message} (Code: ${data.error.code}, Subcode: ${data.error.error_subcode})`);
    } else {
      console.log(`✅ TOKEN IS VALID AND WORKING!`);
    }
  } catch (e: any) {
    console.error("Fetch failed:", e.message);
  }
}

async function main() {
  console.log("=== VERIFYING TOKEN HEALTH FOR USER PAGES ===");
  
  const searchNames = ["Receitas de Sucesso", "Cozinha da Vovó"];
  for (const name of searchNames) {
    const { data: pages } = await supabase
      .from('fb_pages')
      .select('*')
      .ilike('name', `%${name}%`);
      
    if (pages && pages.length > 0) {
      for (const p of pages) {
        await testPageToken(p.name, p.fb_id, p.access_token);
      }
    } else {
      console.log(`Page "${name}" not found in database!`);
    }
  }
}

main().catch(console.error);
