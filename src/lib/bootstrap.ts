// One-time boot: pulls remote skills, bulk-installs all marketplace presets if empty,
// rebuilds GOD skill, registers service worker for push.

import { useJarvis } from "@/store/jarvis";
import { SOURCE_PRESETS, fetchCatalog, fetchSkillsBulk } from "@/lib/skill-marketplace";
import { buildGodSkill, GOD_SKILL_ID } from "@/lib/god-skill";
import { pullAllSkills, pushSkillsBulk, subscribeSkills } from "@/lib/sync";

const BOOT_KEY = "jarvis-bootstrap-v2";

export async function bootstrapJarvis() {
  // 1) Wait for IDB hydration
  await useJarvis.getState().hydrateSkills();

  // 2) Register service worker (silent, no permission prompt yet)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  // 3) Pull remote skills (other devices)
  try {
    const remote = await pullAllSkills();
    if (remote.length) await useJarvis.getState().installSkillsBulk(remote);
  } catch {}

  // 4) First-run: bulk install all curated marketplace sources in background
  const alreadyBooted = localStorage.getItem(BOOT_KEY) === "done";
  if (!alreadyBooted) {
    // run async — don't block UI
    (async () => {
      try {
        for (const preset of SOURCE_PRESETS) {
          try {
            const catalog = await fetchCatalog(preset);
            const installable = catalog.filter((e) => e.kind !== "collection" && e.rawUrl);
            if (!installable.length) continue;
            const { ok } = await fetchSkillsBulk(installable.slice(0, 80));
            if (ok.length) {
              await useJarvis.getState().installSkillsBulk(ok);
            }
          } catch {}
        }
        // After all installs: rebuild GOD + push to cloud
        const all = useJarvis.getState().installedSkills.filter((x) => x.id !== GOD_SKILL_ID);
        const god = buildGodSkill(all);
        useJarvis.getState().installSkill(god);
        useJarvis.getState().setActiveSkill(GOD_SKILL_ID);
        try { await pushSkillsBulk([god, ...all]); } catch { }
        localStorage.setItem(BOOT_KEY, "done");
      } catch {}
    })();
  } else {
    // Always keep GOD up to date with current installed set
    const all = useJarvis.getState().installedSkills.filter((x) => x.id !== GOD_SKILL_ID);
    if (all.length) {
      const god = buildGodSkill(all);
      useJarvis.getState().installSkill(god);
    }
  }

  // 5) Subscribe to remote skill changes
  try {
    subscribeSkills(async () => {
      const remote = await pullAllSkills();
      if (remote.length) await useJarvis.getState().installSkillsBulk(remote);
    });
  } catch {}
}
