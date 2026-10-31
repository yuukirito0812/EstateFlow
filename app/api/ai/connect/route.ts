import { json,identity,validOrigin,apiKey } from '@/lib/server';
export const dynamic='force-dynamic';
export const maxDuration=60;
function providerError(status:number){return status===429?'Gemini quota is unavailable for this project. Check quotas in Google AI Studio or retry later.':status===401||status===403?'Google rejected the key. Check Generative Language API access and key restrictions.':status===404?'This model is unavailable for your project. Try reconnecting.':'Google could not complete the connection check. Try again.';}
export async function POST(req:Request){
  if(!validOrigin(req))return json({error:'Origin not allowed.'},403);
  if(!(await identity(req)))return json({error:'Sign in to connect AI.'},401);
  const key=apiKey(req);if(key.length<20||key.length>256)return json({error:'Enter a valid Google AI Studio API key.'},400);
  try{
    const headers={'Content-Type':'application/json','x-goog-api-key':key};
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers,signal:AbortSignal.timeout(12000)});
    if(!response.ok)return json({error:providerError(response.status)},response.status===429?429:400);
    const data=await response.json() as {models?:{name:string;supportedGenerationMethods?:string[]}[]};
    const models=(data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')&&/gemini.*flash/.test(m.name)&&!/image|tts|audio|live|robotics/.test(m.name)).map(m=>m.name.replace('models/',''));
    const model=models.find(m=>m==='gemini-2.5-flash-lite')||models.find(m=>m==='gemini-2.5-flash')||models.find(m=>!m.includes('preview'))||models[0];
    if(!model)return json({error:'No text-capable Gemini Flash model is available for this key.'},400);
    const check=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{method:'POST',headers,body:JSON.stringify({contents:[{role:'user',parts:[{text:'Reply with exactly OK.'}]}],generationConfig:{maxOutputTokens:128,...(model.startsWith('gemini-2.5-')?{thinkingConfig:{thinkingBudget:0}}:{})}}),signal:AbortSignal.timeout(18000)});
    if(!check.ok)return json({error:providerError(check.status)},check.status===429?429:400);
    const result=await check.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]};
    if(!result.candidates?.some(c=>c.content?.parts?.some(p=>p.text)))return json({error:'Google accepted the key but returned no response. Check your model access and retry.'},502);
    return json({connected:true,model});
  }catch{return json({error:'Google did not respond in time. Retry when your connection is stable.'},502);}
}
