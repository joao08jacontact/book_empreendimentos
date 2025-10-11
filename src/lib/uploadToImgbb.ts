// src/lib/uploadToImgbb.ts
// Envia imagens para o ImgBB e retorna a URL pública.
// Requer: defina VITE_IMGBB_KEY no .env (ou substitua abaixo).
const API_KEY = import.meta.env.VITE_IMGBB_KEY as string;

if (!API_KEY) {
  // Aviso em tempo de execução (não quebra build)
  console.warn("[ImgBB] VITE_IMGBB_KEY não definido. Defina no seu .env");
}

/** Extrai a parte base64 de um dataURL */
function dataURLtoBase64(dataURL: string): string {
  const i = dataURL.indexOf(",");
  return i >= 0 ? dataURL.slice(i + 1) : dataURL;
}

/** Faz upload para ImgBB e retorna a URL pública */
export async function uploadToImgBB(base64: string, name?: string): Promise<string> {
  const form = new FormData();
  form.append("key", API_KEY);
  form.append("image", base64);
  if (name) form.append("name", name);

  const resp = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: form });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`ImgBB upload falhou (${resp.status}): ${text}`);
  }
  const json = await resp.json();
  // Preferir 'display_url' que é a URL amigável (pode usar 'url' também)
  const url: string | undefined = json?.data?.display_url || json?.data?.url;
  if (!url) throw new Error("ImgBB não retornou URL.");
  return url;
}

/** Mantém a mesma assinatura usada no App para minimizar mudanças */
export async function uploadCapaFromDataURL(empreendimentoId: string, dataURL: string): Promise<string> {
  const base64 = dataURLtoBase64(dataURL);
  const url = await uploadToImgBB(base64, `capa_${empreendimentoId}`);
  return url;
}

export async function uploadFotoFromDataURL(empreendimentoId: string, fotoId: string, dataURL: string): Promise<string> {
  const base64 = dataURLtoBase64(dataURL);
  const url = await uploadToImgBB(base64, `foto_${empreendimentoId}_${fotoId}`);
  return url;
}
