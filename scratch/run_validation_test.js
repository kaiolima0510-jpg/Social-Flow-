const FB_GRAPH_URL = "https://graph.facebook.com/v18.0";

const validateTokenAndFetchPages = async (token) => {
  try {
    const meRes = await fetch(`${FB_GRAPH_URL}/me?fields=name,id&access_token=${token}`);
    const meData = await meRes.json();
    if (meData.error) throw new Error(meData.error.message);

    const debugRes = await fetch(`${FB_GRAPH_URL}/me/permissions?access_token=${token}`);
    const debugData = await debugRes.json();
    const permissions = (debugData.data || []).filter((p) => p.status === 'granted').map((p) => p.permission);
    
    console.log("[Service] Granted Permissions:", permissions);
    
    const requiredPermissions = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'pages_messaging', 'pages_manage_metadata'];
    const missing = requiredPermissions.filter(p => !permissions.includes(p));

    let pages = [];
    let nextUrl = `${FB_GRAPH_URL}/me/accounts?fields=name,access_token,id,picture&limit=100&access_token=${token}`;
    
    // Suporte a paginação para buscar TODAS as páginas da conta (sem limite de 100)
    while (nextUrl) {
      try {
        const pagesRes = await fetch(nextUrl);
        const pagesData = await pagesRes.json();
        if (pagesData.error) throw new Error(pagesData.error.message);

        if (pagesData.data && pagesData.data.length > 0) {
          const mapped = pagesData.data.map((p) => ({
            fb_id: p.id, 
            name: p.name, 
            access_token: p.access_token,
            picture: p.picture?.data?.url || ""
          }));
          pages.push(...mapped);
        }
        
        nextUrl = pagesData.paging?.next || null;
      } catch (err) {
        console.error("[Service] Erro ao paginar páginas do Facebook:", err.message);
        nextUrl = null;
      }
    }

    // Caso o token seja de uma PÁGINA individual (Fallback)
    if (pages.length === 0) {
      try {
        const checkPageRes = await fetch(`${FB_GRAPH_URL}/${meData.id}?fields=name,access_token,picture&access_token=${token}`);
        const p = await checkPageRes.json();
        
        // Se p.access_token não vier (comum em tokens de página consultando a si mesmos),
        // usamos o próprio token fornecido, pois ele é o token da página!
        const tokenToUse = p.access_token || token;
        
        if (p.id && tokenToUse) {
           pages.push({
             fb_id: p.id,
             name: p.name,
             access_token: tokenToUse,
             picture: p.picture?.data?.url || ""
           });
        }
      } catch (err) {
        console.error("[Fallback Error]", err);
      }
    }

    return { 
      isValid: true, 
      pages, 
      userName: meData.name, 
      error: missing.length > 0 ? `Atenção: Faltam permissões (${missing.join(', ')}). Algumas funções podem falhar.` : undefined 
    };
  } catch (e) { 
    return { isValid: false, pages: [], error: e.message }; 
  }
};

const token = "EAAQ7uaX5tsABRkEWDBeRqEAacpJQEjPAMPX0njWjCg8rG8bCEDXWH64eGQNxG7GIbpnYbBGYmQNs3ksgdXoW7uLtzRBtfeEtoXp9wZBQ8smboH7Ox9kQT6iwZB0jcrmcAN8ZBQjYXRBK9pHheXBkmXjZCvi4mrAXGTdFJNPuMzocsaGMKaMjj4zdqPqfV479kZAfn79XZCj5CZAGOsMzIfZC";

validateTokenAndFetchPages(token).then(res => {
  console.log("\n--- RESULT ---");
  console.log(res);
});
