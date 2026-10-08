// Archivo de clave de IndexNow (Bing, Yandex y los buscadores que leen de Bing, como Copilot y
// ChatGPT search). El backend avisa al publicar o cerrar una búsqueda con
//   POST https://api.indexnow.org/indexnow
//   { host: "www.bbjobs.com.ar", key: INDEXNOW_KEY,
//     keyLocation: "https://www.bbjobs.com.ar/indexnow-key.txt", urlList: [...] }
// y el buscador verifica que esta URL devuelva exactamente la clave.
// Sin INDEXNOW_KEY → 404. La clave: 8 a 128 caracteres [a-zA-Z0-9-].
export const dynamic = "force-static";

export function GET() {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
