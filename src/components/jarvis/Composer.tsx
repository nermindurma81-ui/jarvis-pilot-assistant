import { useRef, useState } from "react";
import { Paperclip, Send, X, Loader2 } from "lucide-react";
import { useJarvis } from "@/store/jarvis";
import { uploadAnyFile } from "@/lib/upload";
import { toast } from "sonner";

type Props = { onSend: (text: string) => void };

export const Composer = ({ onSend }: Props) => {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { isAgentBusy, msgQueue, uploads, addUpload, removeUpload, drainQueue } = useJarvis();

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      try {
        const u = await uploadAnyFile(f);
        addUpload(u);
        toast.success(`Uploaded ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
      } catch (e: any) {
        toast.error(`Upload failed: ${f.name} — ${e.message}`);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="border-t border-primary/20 bg-background-elev/80 backdrop-blur-xl p-2.5 flex-shrink-0 relative">
      {msgQueue.length > 0 && (
        <button
          onClick={() => {
            const next = drainQueue();
            if (next) toast.info(`Dequeued: ${next.slice(0, 60)}`);
          }}
          className="absolute -top-7 right-3 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-primary bg-primary/15 text-primary glow-border animate-pulse"
        >
          ⏳ QUEUE {msgQueue.length}
        </button>
      )}

      {uploads.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {uploads.map((u) => (
            <span key={u.url} className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary">
              📎 {u.name}
              <button onClick={() => removeUpload(u.name)} className="text-primary/60 hover:text-destructive">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="p-2 rounded border border-primary/25 hover:border-primary hover:bg-primary/10 text-primary transition disabled:opacity-50"
          title="Upload bilo koji fajl (any size, any type)"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={isAgentBusy ? "Agent radi… pošalji dodatno pitanje (queue)" : "Pošalji JARVIS-u…"}
          className="flex-1 resize-none bg-background-elev2 border border-primary/30 rounded-lg px-3 py-2 text-[14px] text-foreground placeholder:text-foreground-dim/60 focus:outline-none focus:border-primary focus:shadow-glow font-mono max-h-32"
          style={{ minHeight: "40px" }}
        />

        <button
          onClick={send}
          disabled={!text.trim()}
          className="p-2 rounded bg-primary text-primary-foreground hover:bg-primary-glow transition disabled:opacity-30 disabled:cursor-not-allowed shadow-glow"
          title={isAgentBusy ? "Dodat će se u queue" : "Pošalji"}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
