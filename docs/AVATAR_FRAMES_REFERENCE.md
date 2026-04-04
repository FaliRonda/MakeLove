# Referencia: marcos de avatar (`avatar_frame`)

Documento para humanos y agentes que trabajen en **marcos de perfil** (ítems `avatar_frame` en tienda / recompensas de historia).

## Qué es un “marco” en esta app

- Es una **imagen o SVG con transparencia** que se dibuja **encima** de la foto circular del usuario.
- El estilo objetivo es el de **apps sociales / juegos**: aro brillante, bordes con volumen, y **adornos que sobresalen** del círculo base (plumas, alas, sombreros, joyas, etc.), no solo un anillo plano dentro del círculo.
- **Temática veneciana**: filigrana dorada, encaje, plumas largas, gemas, terciopelo (rojo/negro/oro), siluetas tipo **Colombina / Bauta / Arlequín** (rombos discretos), remates simétricos a los lados.

## Referencias visuales compartidas por el equipo

El usuario aportó **láminas de referencia** (PNG) con rejillas de marcos estilo “premium casual”: círculo central hueco para la cara, borde grueso con brillo interior, elementos que rompen la silueta circular. Esas imágenes pueden guardarse en el repo bajo:

`docs/references/avatar-frames/` (crear la carpeta si hace falta y añadir los PNG allí).

Los nombres exactos en el almacenamiento local de Cursor pueden variar; si no están en el repo, este texto describe el contrato visual igualmente.

## Contrato técnico en código

1. **Capas**  
   - Capa inferior: foto (o iniciales) **recortada en círculo**.  
   - Capa superior: `frame_overlay_url` resuelto con `resolveFrameOverlayUrl` (ver abajo).

2. **Contenedor**  
   - Si hay marco, el **wrapper exterior** debe permitir **bleed** (`overflow: visible`) y ser **un poco más grande** que el círculo de la foto, para no recortar plumas u orejas.  
   - Implementación: `src/components/Avatar.tsx` (clases `frameShellClasses` / foto centrada).

3. **Resolución de URL**  
   - Rutas tipo `/shop/venetian-mask.png` o `.svg` se resuelven al **PNG empaquetado** (`import …?url`) en `src/lib/resolveFrameOverlayUrl.ts`, para que nunca falle por SPA `/*` → HTML.

4. **Assets**  
   - Marco principal: `src/assets/shop/venetian-mask.png` (copia en `public/shop/` al regenerar). `python scripts/prep_venetian_mask_frame.py [ruta.png]`: hueco facial (transparente/negro/blanco), recorte al contenido; **mantiene aspecto** (p. ej. algo más alto que ancho tras recortar). Marcos viejos con esquinas navy siguen limpiándose por flood-fill en bordes.

5. **UI**  
   - Cabecera / perfil: enlaces o botones alrededor del avatar **no** deben usar `overflow-hidden` si lleva marco, o el bleed se corta.

## Añadir un marco nuevo

1. Añadir el archivo a `src/assets/shop/` (y opcionalmente `public/shop/`).  
2. Si la BD guarda una ruta bajo `/shop/...`, añade el archivo y extiende `resolveFrameOverlayUrl.ts` (patrón `venetian-mask` + `import ... ?url`) o usa una URL absoluta estable.  
3. Probar en header, perfil, ranking, tarjeta de tienda y modal de detalle.
