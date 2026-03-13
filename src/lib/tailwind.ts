import postcss from "postcss";
import tailwindcss from "tailwindcss";

const TAILWIND_INPUT = `
@tailwind base;
@tailwind components;
@tailwind utilities;
`;

export async function buildCandidateCss(candidateHtml: string, candidateCss: string) {
  const result = await postcss([
    tailwindcss({
      content: [{ raw: candidateHtml, extension: "html" }],
      corePlugins: {
        preflight: false
      }
    })
  ]).process(TAILWIND_INPUT, {
    from: undefined
  });

  return [result.css.trim(), candidateCss.trim()].filter(Boolean).join("\n\n");
}

