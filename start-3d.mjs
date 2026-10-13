import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.glb':'model/gltf-binary'};
const port = Number(process.env.PORT || 4173);
createServer(async(req,res)=>{
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400);res.end('Bad request');return;}
  const abs = resolve(root, `.${pathname}`);
  if(abs!==root && !abs.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}
  const path = (await stat(abs).catch(()=>null))?.isDirectory() ? resolve(abs,'index.html') : abs;
  const data=await readFile(path).catch(()=>null);
  if(!data){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
  res.end(data);
}).listen(port,'127.0.0.1',()=>console.log(`NUBYRA 3D: http://localhost:${port}/configurador-3d/`));
