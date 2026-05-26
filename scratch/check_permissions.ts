import fetch from 'node-fetch';

const token = "EAAQ7uaX5tsABRkEWDBeRqEAacpJQEjPAMPX0njWjCg8rG8bCEDXWH64eGQNxG7GIbpnYbBGYmQNs3ksgdXoW7uLtzRBtfeEtoXp9wZBQ8smboH7Ox9kQT6iwZB0jcrmcAN8ZBQjYXRBK9pHheXBkmXjZCvi4mrAXGTdFJNPuMzocsaGMKaMjj4zdqPqfV479kZAfn79XZCj5CZAGOsMzIfZC";

async function main() {
  console.log("Checking permissions for page token...");
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`);
    const data: any = await res.json();
    console.log("Permissions response:", data);
  } catch (e) {
    console.error(e);
  }
}

main();
