import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'index.legacy.html');
if (!fs.existsSync(sourcePath)) {
  console.error('index.legacy.html introuvable — restaurez le monolithe original.');
  process.exit(1);
}
const raw = fs.readFileSync(sourcePath, 'utf8');
const lines = raw.split(/\r?\n/);

const styleStart = lines.findIndex((l) => l.trim() === '<style>') + 1;
const styleEnd = lines.findIndex((l, i) => i > styleStart && l.trim() === '</style>');
const css = lines.slice(styleStart, styleEnd).join('\n');

const planSection1Start = css.indexOf('/* PLANNING TABLE */');
const bodyIdx = css.indexOf('body {');
const historyIdx = css.indexOf('/* HISTORY FILTERS */');
const planSection2 = css.indexOf('/* PLANNING */');
const toastIdx = css.indexOf('/* TOAST */');

const mainCss =
  css.slice(0, planSection1Start).trim() + '\n\n' + css.slice(bodyIdx, historyIdx).trim();
const planningCss =
  css.slice(planSection1Start, bodyIdx).trim() + '\n\n' + css.slice(planSection2, toastIdx).trim();
const componentsCss = css.slice(historyIdx).trim();

fs.mkdirSync(path.join(root, 'src/styles'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/styles/main.css'), mainCss + '\n');
fs.writeFileSync(path.join(root, 'src/styles/planning.css'), planningCss + '\n');
fs.writeFileSync(path.join(root, 'src/styles/components.css'), componentsCss + '\n');
fs.writeFileSync(
  path.join(root, 'src/styles/index.css'),
  "@import './main.css';\n@import './planning.css';\n@import './components.css';\n"
);

const bodyStart = lines.findIndex((l) => l.includes('<div class="app">'));
const scriptDataStart = lines.findIndex(
  (l, i) => i > bodyStart && l.trim() === '<script>' && lines[i + 1]?.includes('DATA')
);
const htmlShell = lines.slice(bodyStart, scriptDataStart).join('\n');

fs.mkdirSync(path.join(root, 'src/views'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/views/app-shell.html'), htmlShell);

const uiScriptStart = lines.findIndex(
  (l, i) => l.trim() === '<script>' && lines[i + 1]?.includes('UTILS UI')
);
let uiEnd = uiScriptStart;
while (lines[uiEnd].trim() !== '</script>') uiEnd++;
const uiScript = lines.slice(uiScriptStart + 1, uiEnd).join('\n');

const dataScriptClose = lines.findIndex(
  (l, i) => i > scriptDataStart && l.trim() === '</script>'
);
if (dataScriptClose === -1) {
  console.error('Balise fermante </script> introuvable pour app.js');
  process.exit(1);
}
const dataScript = lines.slice(scriptDataStart + 1, dataScriptClose).join('\n');

const msalCommentIdx = lines.findIndex((l) => l.includes('MSAL.js v2'));
const authScriptStart = lines.findIndex(
  (l, i) => i > msalCommentIdx && l.trim() === '<script>' && !lines[i + 1]?.includes('src=')
);
let authEnd = authScriptStart;
while (lines[authEnd].trim() !== '</script>') authEnd++;
const authScript = lines.slice(authScriptStart + 1, authEnd).join('\n');

/** Retire les balises HTML parasites issues de l'extraction du monolithe. */
function cleanJs(code) {
  return code.replace(/^\s*<\/?script>\s*$/gm, '').trim();
}

const uiClean = cleanJs(uiScript);
const dataClean = cleanJs(dataScript);
const authClean = cleanJs(authScript);

fs.mkdirSync(path.join(root, 'src/legacy'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/legacy/ui.js'), uiClean + '\n');
fs.writeFileSync(path.join(root, 'src/legacy/app.js'), dataClean + '\n');
fs.writeFileSync(path.join(root, 'src/legacy/auth-api.js'), authClean + '\n');

// Bundle legacy scripts for classic script loading (onclick globals)
const legacyBundle = [uiClean, dataClean, authClean].join('\n\n');
fs.mkdirSync(path.join(root, 'public/js'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/js/legacy-bundle.js'), legacyBundle);

// Backup original monolith (une seule fois)
const legacyPath = path.join(root, 'index.legacy.html');
if (!fs.existsSync(legacyPath)) {
  const currentIndex = path.join(root, 'index.html');
  if (fs.existsSync(currentIndex) && fs.readFileSync(currentIndex, 'utf8').includes('screen-loading')) {
    fs.copyFileSync(currentIndex, legacyPath);
  }
}

console.log('OK', {
  mainCss: mainCss.split('\n').length,
  planningCss: planningCss.split('\n').length,
  componentsCss: componentsCss.split('\n').length,
  html: htmlShell.split('\n').length,
});
