import { saveFullAccount, supabase } from '../services/supabaseService';

async function main() {
  console.log("=== TESTING SAVE FULL ACCOUNT ===");
  
  const mockAccount = {
    name: "Ateliê do Crochê Test Perfil",
    token: "EAAQ7uaX5tsABRmocktokenforateliedocroche1234567890",
    pages: [
      {
        fb_id: "999888777666555", // Simulated unique ID
        name: "Ateliê do Crochê (TEST)",
        access_token: "EAAQ7uaX5tsABRmockpagetokenforateliedocroche",
        category: "Art"
      }
    ]
  };

  try {
    const result = await saveFullAccount(mockAccount);
    console.log("SUCCESS! Result:", result);
    
    // Check if it was inserted
    const { data: page } = await supabase.from('fb_pages').select('*').eq('fb_id', "999888777666555").single();
    if (page) {
      console.log("Verified in DB:", page);
      // Clean up test page
      await supabase.from('fb_pages').delete().eq('fb_id', "999888777666555");
      console.log("Cleaned up test page from DB.");
    } else {
      console.log("Page was NOT found in DB despite success!");
    }
  } catch (err: any) {
    console.error("FAILED to save full account:", err);
  }
}

main().catch(console.error);
