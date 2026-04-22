import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 50 * 1024 * 1024; // 50MB hard cap (matches storage bucket)

export async function uploadAnyFile(file: File): Promise<{ name: string; url: string; size: number; type: string; textPreview?: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error(`Fajl ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) prelazi limit od 50MB.`);
  }
  const safeName = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const path = `uploads/${safeName}`;
  const { error } = await supabase.storage.from("jarvis-uploads").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("jarvis-uploads").getPublicUrl(path);

  let textPreview: string | undefined;
  const isTextLike =
    /^(text\/|application\/(json|xml|javascript|x-yaml))/.test(file.type || "") ||
    /\.(txt|md|json|csv|tsv|js|ts|tsx|jsx|py|html|css|xml|yml|yaml|log|env|sh|sql)$/i.test(file.name);
  if (isTextLike && file.size < 512_000) {
    try { textPreview = (await file.text()).slice(0, 100_000); } catch {}
  }

  return { name: file.name, url: data.publicUrl, size: file.size, type: file.type || "application/octet-stream", textPreview };
}
