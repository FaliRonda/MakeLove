-- Marco veneciano: URL canónica con PNG (asset en el cliente). Migra filas que aún usen .svg.
UPDATE public.shop_items
SET frame_overlay_url = '/shop/venetian-mask.png'
WHERE frame_overlay_url = '/shop/venetian-mask.svg';

UPDATE public.users
SET equipped_avatar_frame_url = '/shop/venetian-mask.png'
WHERE equipped_avatar_frame_url = '/shop/venetian-mask.svg';
