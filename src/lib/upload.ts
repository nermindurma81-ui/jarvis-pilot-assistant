import { supabase } from "@/integrations/supabase/client";

export async function uploadAnyFile(file: File): Promise<{ name: string; url: string; size: number; type: string; textPreview?: string }> {
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
  if (file.size < 256_000 && /^(text\/|application\/(json|xml|javascript|x-yaml))/.test(file.type || "")) {
    try { textPreview = (await file.text()).slice(0, 50_000); } catch {}
  } else if (file.size < 256_000 && /\.(txt|md|json|csv|tsv|js|ts|tsx|jsx|py|html|css|xml|yml|yaml|log|env)$/i.test(file.name)) {
    try { textPreview = (await file.text()).slice(0, 50_000); } catch {}
  }

  return { name: file.name, url: data.publicUrl, size: file.size, type: file.type || "application/octet-stream", textPreview };
}
