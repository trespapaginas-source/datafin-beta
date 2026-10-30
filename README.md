# Datafin Beta — web

Sitio estático publicado en https://datafinbeta.com (GitHub → Cloudflare Pages).

## Cómo se arma
- **Textos y precios:** `contenido/*.json`. Se editan desde el panel (Pages CMS) con campos y límites; no hace falta tocar código.
- **Páginas:** `plantillas/` (HTML con huecos) + `contenido/` → `index.html` y `legal/**/index.html`, que se **generan solos**.
  No edites `index.html` ni `legal/**/index.html` a mano: se sobrescriben. Para cambiar la estructura o el diseño, edita `plantillas/`, `styles.css` o los `.js`.
- **Armador:** `node herramientas/construir.mjs` (o `--comprobar` para solo comparar). Lo ejecuta GitHub Actions al cambiar `contenido/`, `plantillas/` o `herramientas/`.
- **Candado:** `herramientas/palabras-prohibidas.json` frena frases que Meta puede leer como promesa engañosa («eliminamos», «garantizado», «100 %»…). Si falla, no se publica nada.
- **Panel:** `.pages.yml` define qué campos se pueden editar.

Las páginas legales (`legal/`) no se editan desde el panel; solo se actualizan solos los datos repetidos (precio, WhatsApp, correo, dirección).
