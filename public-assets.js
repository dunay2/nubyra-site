'use strict';
/**
 * Public NUBYRA imagery. No auth key is needed for publicly readable objects.
 * Upload paths must match the relative asset paths under assets/nubyra/.
 * Local GitHub Pages copies are intentionally kept as read-only fallback.
 */
(() => {
  const PUBLIC_BASE = 'https://vyeebvzuxarekfaisfdy.supabase.co/storage/v1/object/public/nubyra-web/';
  const LOCAL_BASE = './assets/nubyra/';
  const SAFE_IMAGE_PATH = /^(?:01_print_recursos|02_catalogo_recursos)\/[a-z0-9-]+\.(?:png|jpe?g|webp|avif)$/;

  function validatePath(relativePath) {
    if (typeof relativePath !== 'string' || !SAFE_IMAGE_PATH.test(relativePath)) {
      throw new TypeError('Ruta de imagen pública no válida');
    }
    return relativePath;
  }

  function publicUrl(relativePath) {
    return PUBLIC_BASE + validatePath(relativePath);
  }

  function localUrl(relativePath) {
    return LOCAL_BASE + validatePath(relativePath);
  }

  function setImage(img, relativePath) {
    const remote = publicUrl(relativePath);
    if (!img || !img.dataset) throw new TypeError('Se requiere una imagen');
    if (img.dataset.nubyraAsset === relativePath) return;
    img.dataset.nubyraAsset = relativePath;
    img.dataset.nubyraSource = 'supabase';
    img.src = remote;
  }

  function onImageError(event) {
    const img = event && event.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset) return;
    const relativePath = img.dataset.nubyraAsset;
    if (!relativePath || img.dataset.nubyraSource === 'fallback') return;
    if (!SAFE_IMAGE_PATH.test(relativePath)) return;
    const requestedSrc = img.src || '';
    if (!requestedSrc.startsWith(PUBLIC_BASE)) return;
    img.dataset.nubyraSource = 'fallback';
    img.src = localUrl(relativePath);
  }

  // Install the capturing listener in <head>, before the browser parses images.
  if (typeof document !== 'undefined') {
    document.addEventListener('error', onImageError, true);
  }

  const scope = typeof window === 'undefined' ? globalThis : window;
  scope.NUBYRA_ASSETS = Object.freeze({ publicUrl, localUrl, setImage, onImageError });
})();
