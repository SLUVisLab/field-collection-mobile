/**
 * Refuse to ship an opencv.js that still evaluates strings.
 *
 * The renderer's CSP drops `'unsafe-eval'` on the strength of this check, so it
 * runs twice: inside the build that makes the claim, before the artifact ever
 * leaves the image, and again from the test suite against the committed bytes.
 * The first catches a build that quietly ignored `-sDYNAMIC_EXECUTION=0`; the
 * second catches an artifact that was replaced or edited afterwards.
 *
 * Matching is deliberately blunt. `new Function` and `eval(` in the emitted glue
 * are what the browser's CSP will refuse, reachable or not.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PATTERNS = [
  { name: 'new Function', re: /new\s+Function\s*\(/g },
  // `eval(` but not `.eval(`, and not the word inside a longer identifier such
  // as `evaluate` — those are neither the CSP's concern nor ours.
  { name: 'eval(', re: /(?<![.\w$])eval\s*\(/g },
];

/** @returns {{ name: string, line: number, context: string }[]} */
export const findDynamicExecution = (source) => {
  const sites = [];
  for (const { name, re } of PATTERNS) {
    for (const match of source.matchAll(re)) {
      sites.push({
        name,
        line: source.slice(0, match.index).split('\n').length,
        context: source.slice(Math.max(0, match.index - 90), match.index + 90).replace(/\n/g, ' '),
      });
    }
  }
  return sites;
};

// Run directly by the Dockerfile, where there is no test runner; imported by
// the test suite, where there is. Compared as resolved URLs rather than by
// basename: a basename check that guessed wrong in the image would turn the
// build's central assertion into a no-op, and say nothing while doing it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file] = process.argv.slice(2);
  const source = readFileSync(file, 'utf8');
  const sites = findDynamicExecution(source);
  for (const site of sites) console.error(`${file}:${site.line}  ${site.name}\n    …${site.context}…`);
  if (sites.length > 0) {
    console.error(
      `\n${sites.length} dynamic-execution site(s) in ${file}. The build did not honour ` +
        "-sDYNAMIC_EXECUTION=0, so the renderer cannot drop 'unsafe-eval'."
    );
    process.exit(1);
  }
  console.log(`no eval or new Function in ${file} (${(source.length / 1024 / 1024).toFixed(2)} MB)`);
}
