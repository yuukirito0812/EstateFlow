import { json,identity,validOrigin,apiKey,rateLimit } from '@/lib/server';
import { AIProviderError,connectProvider,type AIProvider } from '@/lib/ai-provider';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(req:Request){
  if(!validOrigin(req))return json({error:'Origin not allowed.'},403);
  const user=await identity(req);if(!user)return json({error:'Sign in to connect live AI. Built-in email tools work without a key.'},401);
  const provider=(req.headers.get('x-ai-provider')||'gemini') as AIProvider;
  if(!['gemini','groq'].includes(provider))return json({error:'Choose Gemini or Groq.'},400);
  const key=apiKey(req);if(key.length<20||key.length>256)return json({error:'Enter a valid API key for the selected provider.'},400);
  if(!(await rateLimit(user)))return json({error:'Too many connection attempts. Try again in a minute.'},429);
  try{return json(await connectProvider(key,provider,AbortSignal.any([req.signal,AbortSignal.timeout(48000)])));}
  catch(error){return error instanceof AIProviderError?json({error:error.message,code:error.code},error.status):json({error:'The connection check timed out. Retry or use the built-in email tools.',code:'timeout'},504);}
}
