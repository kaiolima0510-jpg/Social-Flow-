import { supabase } from '../services/supabaseService.js';

async function testInsertAccountOnly() {
  const accountId = crypto.randomUUID();
  try {
    console.log("Attempting basic insert into fb_accounts...");
    const { data, error } = await supabase
      .from('fb_accounts')
      .insert({
        id: accountId,
        name: "Test Account",
        token: "EAAQ7uaX5tsABRkEWDBeRqEAacpJQEjPAMPX0njWjCg8rG8bCEDXWH64eGQNxG7GIbpnYbBGYmQNs3ksgdXoW7uLtzRBtfeEtoXp9wZBQ8smboH7Ox9kQT6iwZB0jcrmcAN8ZBQjYXRBK9pHheXBkmXjZCvi4mrAXGTdFJNPuMzocsaGMKaMjj4zdqPqfV479kZAfn79XZCj5CZAGOsMzIfZC"
      })
      .select();

    if (error) throw error;
    console.log("SUCCESS! Created account in DB:", data);
  } catch (e) {
    console.error("FAILED:", e.message);
  }
}

testInsertAccountOnly();
