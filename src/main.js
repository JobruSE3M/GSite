/**
 * Point d'entrée Vite — Phase 5
 */
import './styles/index.css';
import appShell from './views/app-shell.html?raw';
import * as XLSX from 'xlsx-js-style';
import { registerWindowHandlers } from './modules/register-window.js';
import { initUi } from './modules/ui.js';
import { startApp } from './modules/bootstrap.js';

window.XLSX = XLSX;

function showBootError(message) {
  var mount = document.getElementById('app');
  if (!mount) return;
  mount.innerHTML =
    '<div style="padding:24px;font-family:Segoe UI,sans-serif;max-width:520px;margin:40px auto;">' +
    '<h2 style="color:#c0392b;margin-bottom:12px;">Erreur de démarrage</h2>' +
    '<p style="color:#555;line-height:1.5;">' + message + '</p>' +
    '<p style="color:#888;font-size:13px;margin-top:16px;">Ouvrez la console (F12) pour plus de détails.</p></div>';
}

async function boot() {
  var mount = document.getElementById('app');
  if (!mount) {
    throw new Error('Élément #app introuvable — lancez via npm run dev');
  }

  mount.innerHTML = appShell;

  registerWindowHandlers();
  initUi();
  await startApp();

  if (import.meta.env.DEV) {
    console.info('[gestion-de-site] Phase 5 — analytics + dashboard chargés', window.location.origin);
  }
}

boot().catch(function (err) {
  console.error('[gestion-de-site] Boot error:', err);
  showBootError(err.message || String(err));
});
