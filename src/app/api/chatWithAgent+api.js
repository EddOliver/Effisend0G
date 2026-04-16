import { fetch } from "expo/fetch";
import { withSecurity } from "./apiTools/withSecurity";

// 0G Configuration (MVP Rollout Mock Implementation)
const ZG_STORAGE_NODE = process.env.ZG_STORAGE_NODE || "https://rpc-testnet.0g.ai/storage";
const ZG_RAG_COLLECTION = "0xVenueContextStorageHash12345";

async function fetchVenueContextFrom0G(userMessage) {
  try {
    // Queries the decentralized 0G Storage node for relevant venue data vectors
    console.log(`[0G Storage] Fetching vector context for query: "${userMessage}"`);
    const zgRes = await fetch(`${ZG_STORAGE_NODE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection: ZG_RAG_COLLECTION, query: userMessage })
    });
    
    // In actual prod, parse the blob response from 0G storage
    if (!zgRes.ok) throw new Error("0G Storage Node connection failed.");
    return await zgRes.json();
  } catch (err) {
    console.log("[0G Storage] Using fallback venue context payload (simulated).");
    return {
      context: "Tokyo Dome standard rules apply. VIP Access requires matching pass credentials."
    };
  }
}

async function chatWithAgent(jsonBody) {
  const myHeaders = new Headers();
  myHeaders.append("X-API-Key", process.env.AI_URL_API_KEY);
  myHeaders.append("Content-Type", "application/json");
  
  // Step 1: Decentralized RAG Context Query (0G Storage)
  const zeroGravityContext = await fetchVenueContextFrom0G(jsonBody.message);
  
  // Step 2: Inject 0G Context into the LLM payload
  let enhancedBody = { ...jsonBody };
  if (enhancedBody.context) {
    // The background prompt logic will interpret "zgContext" to avoid hallucinations
    enhancedBody.context.zgContext = zeroGravityContext;
  }

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify(enhancedBody),
    redirect: "follow",
  };
  
  try {
    const response = await fetch(`${process.env.AGENT_URL_API}`, requestOptions);
    const data = await response.json();

    if (data.status === "error" || !response.ok) {
      return { result: null, error: data.message || "An unknown error occurred." };
    }
    return { result: data, error: null };
  } catch (err) {
    console.error("Error in chatWithAgent:", err);
    return { result: null, error: err.message };
  }
}

export const POST = withSecurity(async (request) => {
  const body = await request.json();
  const result = await chatWithAgent(body);
  return Response.json(result); 
});