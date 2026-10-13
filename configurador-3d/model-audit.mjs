/** Auditoría estática de GLB 2.0 sin ejecutar código ni extraer imágenes. */
const MAGIC = 0x46546c67; // ASCII glTF little-endian
const JSON_CHUNK = 0x4e4f534a;
const decoder = new TextDecoder('utf-8', { fatal: true });

export function inspectGlb(bytes, { maxBytes = 20 * 1024 * 1024, maxTriangles = 250_000 } = {}) {
  const source = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  if (!(source instanceof Uint8Array)) throw new TypeError('Se requiere ArrayBuffer o Uint8Array');
  if (source.byteLength < 20 || source.byteLength > maxBytes) throw new Error('GLB vacío, truncado o demasiado grande');
  const data = new DataView(source.buffer, source.byteOffset, source.byteLength);
  if (data.getUint32(0, true) !== MAGIC) throw new Error('El archivo no tiene cabecera GLB');
  if (data.getUint32(4, true) !== 2) throw new Error('Solo se admiten modelos GLB 2.0');
  if (data.getUint32(8, true) !== source.byteLength) throw new Error('Longitud GLB inconsistente');
  const jsonLength = data.getUint32(12, true);
  if (data.getUint32(16, true) !== JSON_CHUNK || jsonLength <= 0 || jsonLength > 2_000_000 || 20 + jsonLength > source.byteLength) {
    throw new Error('Bloque JSON de GLB no válido');
  }
  let gltf;
  try { gltf = JSON.parse(decoder.decode(source.subarray(20, 20 + jsonLength))); }
  catch { throw new Error('Metadatos GLB ilegibles'); }
  if (gltf.asset?.version !== '2.0') throw new Error('glTF 2.0 obligatorio');
  const unsupported = (gltf.extensionsRequired || []).filter(x =>
    ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(x));
  if (unsupported.length) throw new Error(`Modelo comprimido sin descodificador: ${unsupported.join(', ')}`);
  const primitives = (gltf.meshes || []).flatMap(m => m.primitives || []);
  if (!primitives.length || !primitives.some(p => p.attributes && Number.isInteger(p.attributes.POSITION))) {
    throw new Error('El GLB no contiene malla de camiseta identificable');
  }
  const accessors = gltf.accessors || [];
  let triangles = 0;
  let uvPrimitives = 0;
  let missingNormals = 0;
  for (const p of primitives) {
    const count = p.indices === undefined ? accessors[p.attributes?.POSITION]?.count : accessors[p.indices]?.count;
    if (!Number.isInteger(count) || count < 3) throw new Error('Accesorio de geometría sin índice válido');
    if (p.mode !== undefined && p.mode !== 4) throw new Error('Solo se admite geometría triangulada');
    triangles += Math.floor(count / 3);
    if (Number.isInteger(p.attributes?.TEXCOORD_0)) uvPrimitives++;
    if (!Number.isInteger(p.attributes?.NORMAL)) missingNormals++;
  }
  if (triangles > maxTriangles) throw new Error(`Malla de ${triangles.toLocaleString('es-ES')} triángulos: optimizar a ${maxTriangles.toLocaleString('es-ES')} antes de importar`);
  return Object.freeze({
    generator: String(gltf.asset.generator || 'no indicado').slice(0,120),
    meshes: (gltf.meshes || []).length,
    primitives: primitives.length,
    triangles,
    uvPrimitives,
    uvCoverage: uvPrimitives / primitives.length,
    missingNormals,
    materials: (gltf.materials || []).length,
    textures: (gltf.textures || []).length,
    warnings: [
      ...(uvPrimitives !== primitives.length ? ['UV no presentes en todas las mallas; se usará proyección provisional.'] : []),
      ...(missingNormals ? ['Faltan normales: comprobar iluminación y tejidos.'] : []),
      'Las UV originales NO demuestran que un marcaje tenga medidas de impresión industriales.',
    ],
  });
}

/** Coordenadas de atlas [0,.5] frente y [.5,1] espalda. Eje Y ascendente. */
export function projectedAtlasUV({ x, y, z }, { minX, maxX, minY, maxY }, side = z >= 0 ? 'front' : 'back') {
  const width = maxX - minX, height = maxY - minY;
  if (!(width > 0 && height > 0)) throw new Error('Límites inválidos para proyección');
  const u = Math.max(0, Math.min(1, (x - minX) / width));
  const v = Math.max(0, Math.min(1, (y - minY) / height));
  return side === 'front' ? [u / 2, v] : [1 - u / 2, v];
}
