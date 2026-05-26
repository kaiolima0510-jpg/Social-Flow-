import fetch from 'node-fetch';

const token = "EAAQ7uaX5tsABRi8MKfaLfco2EKUHMacbYaW4U5f19CoyiXZAPyuE4ML1Lq8A2GPwZBV3JfQX3pYvMjuyF7LbCuRdfhme4feZBZBkEO0l8B1rpJ0dtmHipnwGfvPUUlsHS8hfVZBS9N6ROY1YfZAjDf7Vu5xwK60Y6xqcJwPcS2GrBKVT5o1JKNTzqIxNNGDYdmMBu9J5m9cqYcyZC4hazilr9NJ";

async function main() {
  console.log("Validating new token with Facebook Graph API...");
  try {
    // 1. Check me
    const meRes = await fetch(`https://graph.facebook.com/v18.0/me?fields=name,id&access_token=${token}`);
    const meData: any = await meRes.json();
    console.log("Me Response:", meData);
    
    if (meData.error) {
      console.log("Error in /me request:", meData.error);
      return;
    }
    
    // 2. Check permissions
    const permissionsRes = await fetch(`https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`);
    const permissionsData: any = await permissionsRes.json();
    console.log("Permissions Response:", permissionsData);

    // 3. Check accounts
    const accountsRes = await fetch(`https://graph.facebook.com/v18.0/me/accounts?fields=name,access_token,id,picture&limit=100&access_token=${token}`);
    const accountsData: any = await accountsRes.json();
    console.log("Accounts Response:", accountsData);
    
  } catch (e: any) {
    console.error("Fetch failed:", e);
  }
}

main();
