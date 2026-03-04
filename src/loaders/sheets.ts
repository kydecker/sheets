import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Loader } from "astro/loaders";

const TITLE_REGEX = /title\s*=\s*"([^"]+)"/;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractTitle(lyContent: string, fallback: string): string {
  const match = lyContent.match(TITLE_REGEX);
  return match ? match[1].trim() : fallback;
}

export function sheetsLoader(): Loader {
  return {
    name: "sheets-loader",
    load: async ({ config, store, parseData }) => {
      const root = fileURLToPath(config.root);
      const sheetsDir = join(root, "public", "sheets");

      try {
        const entries = readdirSync(sheetsDir, { withFileTypes: true });
        const folders = entries.filter((e) => e.isDirectory());

        for (const folder of folders) {
          const folderName = folder.name;
          const folderPath = join(sheetsDir, folderName);
          const files = readdirSync(folderPath);

          const lyFile = files.find((f) => f.endsWith(".ly"));
          if (!lyFile) continue;

          const baseName = lyFile.replace(/\.ly$/, "");
          const pdfFile = `${baseName}.pdf`;

          const hasPdf = files.includes(pdfFile);

          if (!hasPdf) continue;

          const pngFiles = files
            .filter(
              (f) => f.startsWith(`${baseName}-page`) && f.endsWith(".png"),
            )
            .sort((a, b) => {
              const numA = parseInt(a.match(/-page(\d+)/)?.[1] ?? "0", 10);
              const numB = parseInt(b.match(/-page(\d+)/)?.[1] ?? "0", 10);
              return numA - numB;
            });

          const lyPath = join(folderPath, lyFile);
          const lyContent = readFileSync(lyPath, "utf-8");
          const title = extractTitle(lyContent, folderName);
          const slug = slugify(folderName);

          const sheetBase = `/sheets/${slug}`;
          const pngUrls = pngFiles.map((f) => `${sheetBase}/${f}`);

          const pdfUrl = `${sheetBase}/${pdfFile}`;

          const data = {
            title,
            slug,
            folderName,
            baseName,
            pdfUrl,
            pngUrls,
          };

          const parsed = await parseData({ id: slug, data });
          if (parsed) {
            store.set({ id: slug, data: parsed });
          }
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          throw err;
        }
      }
    },
  };
}
