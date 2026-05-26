async function testToken() {
  const token = "EAAQ7uaX5tsABRkEWDBeRqEAacpJQEjPAMPX0njWjCg8rG8bCEDXWH64eGQNxG7GIbpnYbBGYmQNs3ksgdXoW7uLtzRBtfeEtoXp9wZBQ8smboH7Ox9kQT6iwZB0jcrmcAN8ZBQjYXRBK9pHheXBkmXjZCvi4mrAXGTdFJNPuMzocsaGMKaMjj4zdqPqfV479kZAfn79XZCj5CZAGOsMzIfZC";
  try {
    console.log("Checking /me/permissions...");
    const permRes = await fetch(`https://graph.facebook.com/v18.0/me/permissions?access_token=${token}`);
    const permData = await permRes.json();
    console.log("permData:", permData);
  } catch (e) {
    console.error("Error:", e.message);
  }
}

testToken();
