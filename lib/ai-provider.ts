import { geminiResponseSchema } from './assistant.ts';
export type AIProvider='gemini'|'groq';
type Fetcher=typeof fetch;
type Turn={role:'user'|'assistant';text:string};
export class AIProviderError extends Error{
  status:number;code:string;
  constructor(message:string,status=502,code='provider_error'){super(message);this.name='AIProviderError';this.status=status;this.code=code;}
}
export const providerName=(provider:AIProvider)=>provider==='groq'?'Groq':'Gemini';
export function geminiCandidates(models:{name:string;supportedGenerationMethods?:string[]}[]){
  const available=models.filter(m=>m.supportedGenerationMethods?.includes('generateContent')&&/^models\/gemini-/.test(m.name)&&/flash/.test(m.name)&&!/image|tts|audio|live|robot|omni/.test(m.name)).map(m=>m.name.replace('models/',''));
  const preferred=['gemini-3.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-flash-lite','gemini-2.5-flash'];
  return [...new Set([...preferred.filter(m=>available.includes(m)),...available.filter(m=>/flash-lite/.test(m)&&!m.includes('preview')).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))])];
}
async function providerFailure(response:Response,provider:AIProvider){
  const body=await response.json().catch(()=>({})) as {error?:{message?:string;code?:string;status?:string}},raw=body.error?.message||'',name=providerName(provider);
  if(response.status===401)return new AIProviderError(name+' rejected the API key. Create a key in the provider’s console and paste it again.',401,'invalid_key');
  if(response.status===403)return new AIProviderError(name+' blocked this key. Check API restrictions, project access, and regional availability.',403,'access_denied');
  if(response.status===429)return new AIProviderError(name+' has no available quota right now. Check the project’s free-tier limits or retry later. Built-in email tools still work.',429,'quota');
  if(response.status===404||response.status===410||/model.*(?:not.found|decommission|not.support|not.exist)/i.test(raw))return new AIProviderError('This '+name+' model is unavailable for your project.',404,'model_unavailable');
  if(response.status===400&&/api.key|API_KEY_INVALID/i.test(raw))return new AIProviderError('This API key is invalid. Copy a new key from '+(provider==='gemini'?'Google AI Studio.':'Groq Console.'),400,'invalid_key');
  if(response.status===400&&/token|context|too.large/i.test(raw))return new AIProviderError('This conversation is too large for the selected model. Start a new chat or focus on one lead.',400,'context_limit');
  return new AIProviderError(name+(response.status>=500?' is temporarily unavailable. Retry or use built-in tools.':' could not process this request. Check model access and try again.'),502,'provider_error');
}
function headers(key:string,provider:AIProvider):Record<string,string>{return provider==='gemini'?{'Content-Type':'application/json','x-goog-api-key':key}:{'Content-Type':'application/json',Authorization:'Bearer '+key};}
async function listModels(key:string,provider:AIProvider,signal:AbortSignal,fetcher:Fetcher){
  const response=await fetcher(provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000':'https://api.groq.com/openai/v1/models',{headers:headers(key,provider),signal:AbortSignal.any([signal,AbortSignal.timeout(9000)]),cache:'no-store'});
  if(!response.ok)throw await providerFailure(response,provider);
  const data=await response.json();
  if(provider==='gemini')return geminiCandidates(data.models||[]);
  const available=new Set((data.data||[]).map((m:{id:string})=>m.id));
  return ['openai/gpt-oss-20b','openai/gpt-oss-120b','qwen/qwen3.8-27b','llama-3.3-70b-versatile','llama-3.1-8b-instant'].filter(m=>available.has(m));
}
async function requestModel(key:string,provider:AIProvider,model:string,system:string,turns:Turn[],structured:boolean,signal:AbortSignal,fetcher:Fetcher){
  const body=provider==='gemini'?{
    systemInstruction:{parts:[{text:system}]},contents:turns.map(t=>({role:t.role==='assistant'?'model':'user',parts:[{text:t.text}]})),
    generationConfig:{maxOutputTokens:structured?5000:1024,...(structured?{responseMimeType:'application/json',responseSchema:geminiResponseSchema,temperature:0.3}:{}),...(model.startsWith('gemini-2.5-')?{thinkingConfig:{thinkingBudget:0}}:{})}
  }:{model,messages:[{role:'system',content:system},...turns.map(t=>({role:t.role,content:t.text}))],max_completion_tokens:structured?3000:1024,...(structured?{response_format:{type:'json_object'}}:{}),...(model.startsWith('openai/gpt-oss')?{reasoning_effort:'low'}:{temperature:0.3})};
  const response=await fetcher(provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent':'https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:headers(key,provider),body:JSON.stringify(body),signal});
  if(!response.ok)throw await providerFailure(response,provider);
  const data=await response.json(),candidate=provider==='gemini'?data.candidates?.[0]:data.choices?.[0];
  if((provider==='gemini'?candidate?.finishReason:candidate?.finish_reason)===(provider==='gemini'?'MAX_TOKENS':'length'))throw new AIProviderError('The response was too long. Ask for one shorter email or answer at a time.',502,'truncated');
  const text=provider==='gemini'?candidate?.content?.parts?.filter((p:{thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text||'').join('').trim():candidate?.message?.content?.trim();
  if(!text)throw new AIProviderError(providerName(provider)+' returned no answer. Rephrase the request and retry.',502,'empty_response');
  return text as string;
}
export async function connectProvider(key:string,provider:AIProvider,signal:AbortSignal,fetcher:Fetcher=fetch){
  const candidates=await listModels(key,provider,signal,fetcher);
  if(!candidates.length)throw new AIProviderError('No supported '+providerName(provider)+' text model is available for this key. Check project access or try the other provider.',400,'no_models');
  let failure:AIProviderError|undefined,quotaFailure:AIProviderError|undefined;const attempts:{model:string;code:string}[]=[];
  for(const model of candidates.slice(0,4)){
    try{await requestModel(key,provider,model,'Reply with OK only.',[{role:'user',text:'Connection check.'}],false,AbortSignal.any([signal,AbortSignal.timeout(9000)]),fetcher);return {connected:true,provider,model};}
    catch(error){if(signal.aborted)throw error;failure=error instanceof AIProviderError?error:new AIProviderError('The model did not respond in time.',504,'timeout');if(failure.code==='quota')quotaFailure=failure;attempts.push({model,code:failure.code});if(['invalid_key','access_denied'].includes(failure.code))throw failure;}
  }
  failure=quotaFailure||failure;
  throw new AIProviderError((failure?.message||'No model responded.')+' Tried '+attempts.map(a=>a.model).join(', ')+'.',failure?.status||502,failure?.code);
}
export async function generateProvider(options:{key:string;provider:AIProvider;model:string;system:string;turns:Turn[];signal:AbortSignal},fetcher:Fetcher=fetch){
  const {key,provider,model,system,turns,signal}=options;
  try{return {text:await requestModel(key,provider,model,system,turns,true,signal,fetcher),model};}
  catch(error){
    if(!(error instanceof AIProviderError)||error.code!=='model_unavailable')throw error;
    const candidates=(await listModels(key,provider,signal,fetcher)).filter(m=>m!==model);let last:unknown=error;
    for(const replacement of candidates.slice(0,2)){try{return {text:await requestModel(key,provider,replacement,system,turns,true,signal,fetcher),model:replacement};}catch(next){last=next;if(next instanceof AIProviderError&&['invalid_key','access_denied','quota'].includes(next.code))throw next;}}
    throw last;
  }
}
