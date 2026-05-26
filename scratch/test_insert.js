import { supabase } from '../services/supabaseService.js';

async function testInsert() {
  const account = {
    name: "Delícias do Dia",
    token: "EAAQ7uaX5tsABRkEWDBeRqEAacpJQEjPAMPX0njWjCg8rG8bCEDXWH64eGQNxG7GIbpnYbBGYmQNs3ksgdXoW7uLtzRBtfeEtoXp9wZBQ8smboH7Ox9kQT6iwZB0jcrmcAN8ZBQjYXRBK9pHheXBkmXjZCvi4mrAXGTdFJNPuMzocsaGMKaMjj4zdqPqfV479kZAfn79XZCj5CZAGOsMzIfZC",
    pages: [
      {
        fb_id: '570460092810059',
        name: 'Delícias do Dia',
        access_token: 'EAAQ7uaX5tsABRhjdaajyG0nvHhDKGL8aSEX2z3YHOD6lMrd1qgdlWT1NAnoIAFAQh3ZA8k2I1etR5x9ZCBKEpDcCpAoMJZAEN2Q6qQy2wuZChvaoH5ttave1RJrmsvRVFJtS1piZCFd8SdansdcYOFZBAppkru0lDX2ER5T6NJvHl0NJo8My6C8QxSQ1SvUOjCZALhDubw3ZC4jyYaAhwZCmjhHSB',
        picture: 'https://scontent.frbr1-1.fna.fbcdn.net/v/t39.30808-1/474857740_122100327812746787_5567988478423563256_n.jpg'
      }
    ]
  };

  // Usamos um account_id pré-existente e válido que já está na tabela de fb_pages de outras páginas!
  const accountId = 'e4f4c03e-f540-407e-ac94-64b6eb619e67';
  
  const pagesToInsert = account.pages.map(p => ({
    account_id: accountId,
    fb_id: p.fb_id,
    name: p.name,
    access_token: p.access_token,
    category: p.category || ""
  })).filter(p => !!p.access_token);

  try {
    console.log("Running custom page save logic with pre-existing accountId...");
    for (const page of pagesToInsert) {
      console.log(`Checking if page ${page.fb_id} exists...`);
      const { data: existing, error: fetchError } = await supabase
        .from('fb_pages')
        .select('id')
        .eq('fb_id', page.fb_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        console.log(`Page ${page.fb_id} exists. Updating...`);
        const { error: updateError } = await supabase
          .from('fb_pages')
          .update({
            name: page.name,
            access_token: page.access_token,
            category: page.category
          })
          .eq('fb_id', page.fb_id);
        
        if (updateError) throw updateError;
        console.log("Update SUCCESSFUL.");
      } else {
        console.log(`Page ${page.fb_id} is new. Inserting...`);
        const { error: insertError } = await supabase
          .from('fb_pages')
          .insert({
            id: crypto.randomUUID(),
            account_id: page.account_id,
            fb_id: page.fb_id,
            name: page.name,
            access_token: page.access_token,
            category: page.category
          });
        
        if (insertError) throw insertError;
        console.log("Insertion SUCCESSFUL.");
      }
    }
    console.log("All pages processed successfully!");
  } catch (e) {
    console.error("CRITICAL ERROR:", e.message);
  }
}

testInsert();
