#!/usr/bin/env node
/* Datafin Beta — armador de la web.
   Lee los textos de contenido/*.json, los coloca en plantillas/**.html y escribe las páginas finales.
   Si algo no cuadra (campo vacío, palabra prohibida, enlace roto, etiqueta sin cerrar) NO escribe nada y termina con error:
   así la web publicada queda como estaba. Sin dependencias; solo necesita Node.
   Uso:  node herramientas/construir.mjs            -> genera
         node herramientas/construir.mjs --comprobar -> solo compara con lo que ya existe (no escribe) */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOLO_COMPROBAR = process.argv.includes('--comprobar');
const errores = [], avisos = [];
const falla = (m) => errores.push(m);

// ---------- contenido ----------
const C = {};
for (const f of readdirSync(join(RAIZ, 'contenido')).filter((f) => f.endsWith('.json')).sort()) {
  try { C[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(RAIZ, 'contenido', f), 'utf8')); }
  catch (e) { falla(`contenido/${f}: no es un JSON válido (${e.message})`); }
}
const obtener = (obj, ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

// ---------- validación del contenido ----------
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const reglas = JSON.parse(readFileSync(join(RAIZ, 'herramientas', 'palabras-prohibidas.json'), 'utf8'));
const compilar = (l) => l.map((r) => ({ re: new RegExp(r.patron, 'i'), porque: r.porque }));
const bloquean = compilar(reglas.bloquean), avisan = compilar(reglas.avisan);

function recorrer(valor, ruta, fn) {
  if (typeof valor === 'string') fn(valor, ruta);
  else if (Array.isArray(valor)) valor.forEach((v, i) => recorrer(v, `${ruta}[${i + 1}]`, fn));
  else if (valor && typeof valor === 'object') for (const [k, v] of Object.entries(valor)) recorrer(v, ruta ? `${ruta}.${k}` : k, fn);
}
for (const [archivo, datos] of Object.entries(C)) {
  recorrer(datos, `contenido/${archivo}.json`, (texto, ruta) => {
    if (archivo === 'ajustes') return;                        // datos, no frases
    if (!texto.trim()) falla(`${ruta}: está vacío`);
    const largo = /(titulo|titular|etiqueta|pregunta)$/.test(ruta) ? 140 : 700;
    if (texto.length > largo) falla(`${ruta}: es demasiado largo (${texto.length} caracteres; máximo ${largo})`);
    if (/[<>]/.test(texto)) falla(`${ruta}: no puede llevar los signos < ni > (el panel no admite código)`);
    const plano = sinTildes(texto);
    for (const r of bloquean) { const m = plano.match(r.re); if (m) falla(`${ruta}: «${m[0].trim()}» ${r.porque}. Cámbialo antes de publicar`); }
    for (const r of avisan) { const m = plano.match(r.re); if (m) avisos.push(`${ruta}: «${m[0].trim()}» ${r.porque}`); }
  });
}
const aj = C.ajustes || {};
if (!/^\d{10,15}$/.test(String(aj.whatsapp ?? ''))) falla('contenido/ajustes.json: whatsapp debe ser solo números con indicativo (ej. 573127045885)');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aj.correo ?? '')) falla('contenido/ajustes.json: el correo no parece válido');
for (const k of ['precio_consulta_general', 'precio_historial']) {
  if (!Number.isInteger(aj[k]) || aj[k] < 1000 || aj[k] > 5000000) falla(`contenido/ajustes.json: ${k} debe ser un número entero entre 1.000 y 5.000.000`);
}
for (const k of ['instagram', 'tiktok', 'facebook']) if (!/^https:\/\/[^\s"<>]+$/.test(aj[k] ?? '')) falla(`contenido/ajustes.json: ${k} debe ser un enlace que empiece con https://`);
if (!Array.isArray(C.faq?.preguntas) || C.faq.preguntas.length < 1 || C.faq.preguntas.length > 20) falla('contenido/faq.json: debe haber entre 1 y 20 preguntas');

// ---------- formatos ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const precio = (n) => '$' + miles(n);
const fichas = (s) => s.replace(/\[precio_general\]/g, precio(aj.precio_consulta_general)).replace(/\[precio_historial\]/g, precio(aj.precio_historial));
const urlSegura = (u) => /^(https:\/\/|http:\/\/|mailto:|tel:|#|legal\/|\.\.\/legal\/)[^\s"<>]*$/.test(u);
const grad = (s) => esc(fichas(s)).replace(/\*\*(.+?)\*\*/g, '<span class="grad-text">$1</span>');
const md = (s) => esc(fichas(s))
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => { u = u.replace(/&amp;/g, '&'); if (urlSegura(u)) return `<a href="${esc(u)}">${t}</a>`; falla(`enlace no permitido: ${u}`); return t; })
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
const h1 = (s) => fichas(s).split('\n').map((l) => `<span class="ln">${grad(l)}</span>`).join(' ');
const wa = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const FILTROS = { md, grad, h1, wa, precio };

// ---------- plantillas ----------
function pintar(tpl, ctx, donde) {
  tpl = tpl.replace(/\{\{#each ([a-z0-9_.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, ruta, cuerpo) => {
    const lista = obtener(C, ruta);
    if (!Array.isArray(lista)) { falla(`${donde}: «${ruta}» no es una lista`); return ''; }
    return lista.map((item) => pintar(cuerpo, item, donde)).join('');
  });
  return tpl.replace(/\{\{\s*(?:([a-z0-9]+):)?(\.?[a-z0-9_.]+)\s*\}\}/g, (_, filtro, ruta) => {
    const valor = ruta.startsWith('.') ? obtener(ctx, ruta.slice(1)) : obtener(C, ruta);
    if (valor === undefined || valor === null || valor === '') { falla(`${donde}: falta el campo «${ruta}»`); return ''; }
    if (filtro) { if (!FILTROS[filtro]) { falla(`${donde}: filtro desconocido «${filtro}»`); return ''; } return FILTROS[filtro](valor); }
    return esc(fichas(String(valor)));
  });
}
const archivos = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? archivos(p) : [p]; });
const salidas = [];
for (const p of archivos(join(RAIZ, 'plantillas')).filter((p) => p.endsWith('.html'))) {
  const rel = relative(join(RAIZ, 'plantillas'), p).split(sep).join('/');
  salidas.push({ rel, html: pintar(readFileSync(p, 'utf8'), {}, `plantillas/${rel}`) });
}

// ---------- revisión de la página ya armada ----------
for (const { rel, html } of salidas) {
  if (/\{\{|\}\}/.test(html)) falla(`${rel}: quedó un campo sin llenar`);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="#([^"]+)"/g)) if (!ids.has(m[1])) falla(`${rel}: el enlace #${m[1]} no lleva a ninguna parte`);
  for (const t of ['section', 'div', 'details', 'ul', 'ol', 'li', 'p', 'a', 'span', 'strong', 'h1', 'h2', 'h3', 'header', 'footer', 'main']) {
    const a = (html.match(new RegExp(`<${t}[\\s>]`, 'g')) || []).length, b = (html.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (a !== b) falla(`${rel}: etiquetas <${t}> sin cerrar (${a} abren, ${b} cierran)`);
  }
  if (rel === 'index.html') for (const id of ['inicio', 'consulta', 'como-funciona', 'resultados', 'servicios', 'nosotros', 'faq', 'contacto', 'steps', 'caseDialog']) if (!ids.has(id)) falla(`index.html: falta la sección #${id}`);
}

// ---------- resultado ----------
if (errores.length) {
  console.error('\n❌ NO SE PUBLICA. Hay que corregir esto:\n' + errores.map((e) => '  • ' + e).join('\n') + '\n');
  process.exit(1);
}
let cambiados = 0;
for (const { rel, html } of salidas) {
  const destino = join(RAIZ, rel), actual = existsSync(destino) ? readFileSync(destino, 'utf8') : null;
  if (actual === html) continue;
  cambiados++;
  if (SOLO_COMPROBAR) { console.log(`≠ ${rel} (difiere de lo que hay)`); continue; }
  mkdirSync(dirname(destino), { recursive: true }); writeFileSync(destino, html);
  console.log(`✓ ${rel} actualizado`);
}
if (avisos.length) console.log('\n⚠ Avisos (se publica igual):\n' + avisos.map((a) => '  • ' + a).join('\n'));
console.log(cambiados ? `\n${cambiados} página(s) ${SOLO_COMPROBAR ? 'distinta(s)' : 'actualizada(s)'}.` : '\nSin cambios: las páginas ya coinciden con el contenido.');
process.exit(SOLO_COMPROBAR && cambiados ? 2 : 0);
