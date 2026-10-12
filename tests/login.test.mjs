import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const file = new URL('../src/login.js', import.meta.url);
const source = (await readFile(file, 'utf8')).replace("import { createClient } from '@supabase/supabase-js';", '');
const valid = { supabaseUrl: 'https://review.supabase.co', supabasePublishableKey: 'sb_publishable_test_only', callbackUrl: 'https://nubyra.es/acceso.html' };
const session = { access_token: 'test-only' };
const flush = async () => { for (let i=0; i<5; i++) await new Promise(setImmediate); };

async function harness(options={}) {
  let href = options.href ?? valid.callbackUrl;
  const ids = ['auth-status', 'auth-detail', 'auth-role', 'auth-login', 'auth-retry', 'auth-logout'];
  const nodes = Object.fromEntries(ids.map(id=>[id,{ textContent:'', hidden:true, disabled:false, listeners:{}, addEventListener(type,fn){this.listeners[type]=fn;} }]));
  const root = { dataset:{}, events:[], dispatchEvent(event){this.events.push(event.type);} };
  const events = {};
  const calls = { client:0, session:0, rpc:0, oauth:[], signout:[] };
  let listener;
  let response = options.response ?? {data:{status:'active',role:'lector'},error:null};
  const client = {
    auth: {
      initialize: async()=> {
        if(options.exchangeSuccess) { const u=new URL(href);u.searchParams.delete('code');href=u.href; }
        return { error: options.initializeError ?? null };
      },
      getSession: async()=>{calls.session++;return {data:{session:options.session ?? null},error:options.sessionError ?? null};},
      signInWithOAuth: async(value)=>{calls.oauth.push(value);return {error:options.oauthError ?? null};},
      signOut: async(value)=>{calls.signout.push(value);return {error:options.signoutError ?? null};},
      onAuthStateChange: fn=>{listener=fn;return {};}
    },
    rpc: async(name)=>{calls.rpc++;assert.equal(name,'resolve_my_access');return options.rpc ? options.rpc() : response;}
  };
  const context = vm.createContext({
    URL, URLSearchParams, queueMicrotask,
    CustomEvent: class {constructor(type){this.type=type;}},
    createClient:()=>{calls.client++;return client;},
    document:{ querySelector:()=>root, getElementById:id=>nodes[id], visibilityState:'visible', addEventListener:(name,fn)=>{events[name]=fn;} },
    window:{
      NUBYRA_AUTH_CONFIG:options.config ?? valid,
      get location(){return {href,origin:new URL(href).origin,pathname:new URL(href).pathname};},
      history:{replaceState:(_a,_b,value)=>{href=new URL(value,href).href;}},
      addEventListener:(name,fn)=>{events[name]=fn;},
      setTimeout:()=>0
    }
  });
  vm.runInContext(source, context, {filename:'src/login.js'});
  await flush();
  return {
    root,nodes,calls,get href(){return href;},
    response:value=>{response=value;},
    emit:async(name)=>{if(['SIGNED_OUT','SIGNED_IN','TOKEN_REFRESHED','INITIAL_SESSION'].includes(name))listener(name);else events[name]();await flush();},
    click:async(id)=>{await nodes[id].listeners.click();await flush();}
  };
}

test('vacant config stays closed, creates no client, removes callback query',async()=>{
  const h=await harness({config:{...valid,supabaseUrl:'',supabasePublishableKey:''},href:valid.callbackUrl+'?code=bad&error=bad&keep=1'});
  assert.equal(h.root.dataset.state,'error');assert.equal(h.calls.client,0);assert.equal(h.calls.rpc,0);
  assert.equal(h.nodes['auth-login'].hidden,true);assert.equal(h.nodes['auth-retry'].hidden,true);
  assert.equal(h.href,valid.callbackUrl+'?keep=1');
});
test('wrong origin or callback path stays closed',async()=>{
  for(const href of ['https://www.nubyra.es/acceso.html','https://nubyra.es/otra.html']){
    const h=await harness({href});assert.equal(h.calls.client,0);assert.equal(h.nodes['auth-login'].hidden,true);
  }
});
test('secret-like API key is rejected',async()=>{
  const h=await harness({config:{...valid,supabasePublishableKey:'sb_secret_test_only'}});assert.equal(h.calls.client,0);
});
test('no session exposes Google login but makes no access RPC',async()=>{
  const h=await harness();assert.equal(h.root.dataset.state,'loggedOut');assert.equal(h.calls.rpc,0);assert.equal(h.nodes['auth-login'].hidden,false);
  await h.click('auth-login');assert.equal(h.calls.oauth[0].provider,'google');assert.equal(h.calls.oauth[0].options.redirectTo,valid.callbackUrl);
});
test('approved role only comes from access RPC',async()=>{
  const h=await harness({session});assert.equal(h.root.dataset.state,'active');assert.equal(h.nodes['auth-role'].textContent,'Rol: lector');assert.equal(h.calls.rpc,1);
});
test('pending and denied hide private state',async()=>{
  for(const status of ['pending','denied']){
    const h=await harness({session,response:{data:{status,role:null},error:null}});
    assert.equal(h.root.dataset.state,status);assert.equal(h.nodes['auth-role'].hidden,true);assert.equal(h.nodes['auth-logout'].hidden,false);
  }
});
test('unknown roles, malformed responses and RPC errors fail closed',async()=>{
  for(const response of [{data:{status:'active',role:'owner'},error:null},{data:{status:'pending',role:'admin'},error:null},{data:null,error:Error('offline')}]){
    const h=await harness({session,response});assert.equal(h.root.dataset.state,'error');assert.equal(h.nodes['auth-role'].hidden,true);
  }
});
test('OAuth error does not reuse a previous session after focus or retry',async()=>{
  const h=await harness({session,href:valid.callbackUrl+'?error=access_denied&error_description=bad'});
  assert.equal(h.root.dataset.state,'error');assert.equal(h.calls.session,0);assert.equal(h.calls.rpc,0);
  await h.emit('focus');await h.emit('SIGNED_IN');assert.equal(h.calls.rpc,0);
  await h.click('auth-retry');await h.emit('focus');assert.equal(h.root.dataset.state,'loggedOut');assert.equal(h.calls.rpc,0);
});
test('OAuth error in fragment also blocks an existing session and cleans callback',async()=>{
  const h=await harness({session,href:valid.callbackUrl+'#error=access_denied&error_code=identity_already_exists&error_description=bad'});
  assert.equal(h.root.dataset.state,'error');assert.equal(h.calls.rpc,0);
  assert.equal(new URL(h.href).hash,'');
});
test('all OAuth error fields block prior sessions in query and fragment',async()=>{
  for(const delimiter of ['?','#']){
    for(const field of ['error','error_code','error_description']){
      const h=await harness({session,href:valid.callbackUrl+delimiter+field+'=denied'});
      assert.equal(h.root.dataset.state,'error');assert.equal(h.calls.session,0);assert.equal(h.calls.rpc,0);
      await h.emit('INITIAL_SESSION');await h.emit('TOKEN_REFRESHED');await h.emit('focus');
      assert.equal(h.root.dataset.state,'error');assert.equal(h.calls.rpc,0);
      await h.click('auth-retry');await h.emit('focus');assert.equal(h.root.dataset.state,'loggedOut');assert.equal(h.calls.rpc,0);
      assert.equal(h.href,valid.callbackUrl);
    }
  }
});
test('callback cleanup preserves unrelated query parameters and fragments',async()=>{
  const h=await harness({href:valid.callbackUrl+'?error=denied&keep=1#section'});
  assert.equal(h.href,valid.callbackUrl+'?keep=1#section');
  const fragment=await harness({href:valid.callbackUrl+'#error=denied&error_description=bad&keep=1'});
  assert.equal(fragment.href,valid.callbackUrl+'#keep=1');
  const closed=await harness({config:{...valid,supabaseUrl:'',supabasePublishableKey:''},href:valid.callbackUrl+'?code=bad#state=old&sb_flow_id=old&error=denied'});
  assert.equal(closed.href,valid.callbackUrl);assert.equal(closed.calls.client,0);
});
test('initialization errors cannot fall back to previous session without a code',async()=>{
  const h=await harness({session,initializeError:Error('callback error')});
  assert.equal(h.root.dataset.state,'error');assert.equal(h.calls.session,0);assert.equal(h.calls.rpc,0);
  await h.emit('focus');assert.equal(h.calls.rpc,0);
});
test('PKCE without verifier cannot silently reuse old session',async()=>{
  const h=await harness({session,href:valid.callbackUrl+'?code=bad'});
  assert.equal(h.root.dataset.state,'error');assert.equal(h.calls.rpc,0);assert.equal(new URL(h.href).searchParams.has('code'),false);
  await h.emit('focus');assert.equal(h.calls.rpc,0);
});
test('PKCE exchange error remains closed with prior session',async()=>{
  const h=await harness({session,href:valid.callbackUrl+'?code=bad',initializeError:Error('invalid verifier')});
  assert.equal(h.root.dataset.state,'error');assert.equal(h.calls.rpc,0);
});
test('successful PKCE callback validates through access RPC and clears code',async()=>{
  const h=await harness({session,href:valid.callbackUrl+'?code=good',exchangeSuccess:true});
  assert.equal(h.root.dataset.state,'active');assert.equal(h.calls.rpc,1);assert.equal(new URL(h.href).searchParams.has('code'),false);
});
test('revocation on focus clears role and private view',async()=>{
  const h=await harness({session});const cleared=h.root.events.length;
  h.response({data:{status:'denied',role:null},error:null});await h.emit('focus');
  assert.equal(h.root.dataset.state,'denied');assert.equal(h.nodes['auth-role'].textContent,'');assert.ok(h.root.events.length>cleared);
});
test('late RPC result cannot restore access after SIGNED_OUT',async()=>{
  let resolve;const pending=new Promise(r=>{resolve=r;});const h=await harness({session,rpc:()=>pending});
  await h.emit('SIGNED_OUT');resolve({data:{status:'active',role:'admin'},error:null});await flush();
  assert.equal(h.root.dataset.state,'loggedOut');assert.equal(h.nodes['auth-role'].hidden,true);
});
test('logout succeeds locally and failure does not display private view',async()=>{
  const h=await harness({session});await h.click('auth-logout');assert.equal(h.root.dataset.state,'loggedOut');assert.equal(h.calls.signout[0].scope,'local');
  const failed=await harness({session,signoutError:Error('failure')});await failed.click('auth-logout');assert.equal(failed.root.dataset.state,'error');assert.equal(failed.nodes['auth-role'].hidden,true);
});
