/** NUBYRA · importador de glTF/GLB local. No sube ni publica el modelo comercial. */
import { inspectGltfJson } from './model-audit.mjs';

export const MODEL_LIMITS = Object.freeze({
  maxGlbBytes: 35 * 1024 * 1024,
  maxGltfBytes: 4 * 1024 * 1024,
  maxTotalBytes: 90 * 1024 * 1024,
});
const allowedResource = /\.(bin|png|jpe?g|webp|ktx2)$/i;
function leaf(path) { return String(path).replaceAll('\\','/').split('/').at(-1); }
function safeResourceURI(uri) {
  if (typeof uri !== 'string' || !uri.length) throw new Error('URI de recurso vacía');
  if (uri.startsWith('data:')) return null;
  let value;
  try { value = decodeURIComponent(uri.replaceAll('\\','/')); }
  catch { throw new Error('URI con caracteres codificados inválidos'); }
  if (!value || value.startsWith('/') || value.includes('?') || value.includes('#') ||
      /^[a-z][\w+.-]*:/i.test(value) ||
      value.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('Referencia externa/no segura en glTF: '+uri.slice(0,100));
  }
  return leaf(value).toLowerCase();
}

export function chooseModelFiles(files, limits = MODEL_LIMITS) {
  const items = Array.from(files || []);
  if (!items.length) throw new Error('Selecciona un GLB o un glTF con sus recursos');
  const sum = items.reduce((n, f) => n + Number(f.size || 0), 0);
  if (sum > limits.maxTotalBytes) throw new Error('El paquete excede el límite de 90 MB');
  const models = items.filter(f => /\.(glb|gltf)$/i.test(String(f.name||'')));
  if (models.length !== 1) throw new Error('Selecciona exactamente un GLB o glTF principal');
  const model = models[0], isGlb = /\.glb$/i.test(model.name);
  if (isGlb && model.size > limits.maxGlbBytes) throw new Error('El GLB supera 35 MB');
  if (!isGlb && model.size > limits.maxGltfBytes) throw new Error('El JSON glTF supera 4 MB');
  const resources = new Map();
  for(const file of items) {
    if(file === model) continue;
    if(isGlb || !allowedResource.test(file.name||'')) throw new Error('Recurso no válido para este modelo: '+file.name);
    const key = String(file.name).toLowerCase();
    if(resources.has(key)) throw new Error('Ficheros con nombre duplicado: '+key);
    resources.set(key,file);
  }
  return { format:isGlb ? 'glb':'gltf', model, resources, totalBytes:sum };
}

export function inspectLocalGltf(text, resources) {
  let doc;
  try { doc=JSON.parse(String(text)); }
  catch { throw new Error('El archivo glTF no contiene JSON válido'); }
  const audit=inspectGltfJson(doc);
  const refs=[...(doc.buffers||[]),...(doc.images||[])].flatMap(x=>x.uri===undefined?[]:[x.uri]);
  const required = new Set(), missing=[];
  for(const uri of refs) {
    const key=safeResourceURI(uri);
    if (!key) continue;
    if (!resources.has(key)) missing.push(leaf(uri));
    else required.add(key);
  }
  if(missing.length) throw new Error('Faltan recursos glTF: '+[...new Set(missing)].join(', '));
  return {document:doc, audit, required:[...required], unused:[...resources.keys()].filter(x=>!required.has(x))};
}

export function resolveLocalResource(uri, resources, objectURLs) {
  const key=safeResourceURI(uri);
  if (!key) return uri;
  if (!resources.has(key)) throw new Error('Dependencia del modelo no seleccionada: '+key);
  if (!objectURLs.has(key)) objectURLs.set(key, URL.createObjectURL(resources.get(key)));
  return objectURLs.get(key);
}

export const MODEL_PROVENANCE = Object.freeze({
  vendor:'ClothingAxis', product:'Girls Sleeveless Basketball Tshirt - 07',
  uri:'https://www.cgtrader.com/3d-models/character/clothing/girls-sleeveless-basketball-tshirt-07',
  purchased:false, redistributionAuthorized:false, publicEmbeddingAuthorized:false
});
