import { saveFullAccount } from '../services/supabaseService';

async function main() {
  const token = "EAAQ7uaX5tsABRi8MKfaLfco2EKUHMacbYaW4U5f19CoyiXZAPyuE4ML1Lq8A2GPwZBV3JfQX3pYvMjuyF7LbCuRdfhme4feZBZBkEO0l8B1rpJ0dtmHipnwGfvPUUlsHS8hfVZBS9N6ROY1YfZAjDf7Vu5xwK60Y6xqcJwPcS2GrBKVT5o1JKNTzqIxNNGDYdmMBu9J5m9cqYcyZC4hazilr9NJ";
  
  console.log("Inserting Ateliê do Crochê into database...");
  
  try {
    const result = await saveFullAccount({
      name: "Ateliê do Crochê",
      token: token,
      pages: [
        {
          fb_id: "432601196610565",
          name: "Ateliê do Crochê",
          access_token: token,
          category: "Art"
        }
      ]
    });
    
    console.log("SUCCESS:", result);
  } catch (err: any) {
    console.error("FAILED:", err.message);
  }
}

main().catch(console.error);
