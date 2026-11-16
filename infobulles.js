// MBN modernisé — infobulles de survol lisibles.
//
// Les infobulles des pages MBN sont celles du navigateur (attribut « title »).
// Sous Linux, Chrome les dessine avec les couleurs du thème du bureau, ce qui
// peut donner du blanc sur fond clair. Sur les pages MBN, on affiche donc
// notre propre infobulle (fond sombre, texte blanc) à la place.
//
// Le « title » est retiré le temps du survol, pour que le navigateur n'affiche
// pas la sienne en plus, puis remis tel quel dès que la souris quitte l'élément.

(() => {
  const DELAI = 450; // ms de survol avant l'affichage
  let bulle = null;
  let cible = null;
  let minuterie = 0;
  let x = 0;
  let y = 0;

  const cacher = () => {
    clearTimeout(minuterie);
    if (bulle) bulle.style.display = 'none';
    if (cible) {
      if (cible.dataset.mbnTitre !== undefined && !cible.hasAttribute('title')) {
        cible.setAttribute('title', cible.dataset.mbnTitre);
      }
      delete cible.dataset.mbnTitre;
      cible = null;
    }
  };

  const montrer = () => {
    if (!cible || !cible.isConnected) { cacher(); return; }
    if (!bulle) {
      bulle = document.createElement('div');
      bulle.setAttribute('role', 'tooltip');
      bulle.style.cssText = 'position:fixed;z-index:2147483647;max-width:min(440px,90vw);' +
        'padding:5px 9px;border-radius:6px;background:#1f2933;color:#fff;' +
        'font:12.5px/1.4 system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;' +
        'box-shadow:0 2px 10px rgba(31,41,51,.35);pointer-events:none;display:none;';
      document.documentElement.appendChild(bulle);
    }
    bulle.textContent = cible.dataset.mbnTitre;
    bulle.style.display = 'block';
    // Sous le pointeur, sans sortir de la fenêtre ; au-dessus s'il n'y a pas la place.
    const boite = bulle.getBoundingClientRect();
    const gauche = Math.max(4, Math.min(x + 12, window.innerWidth - boite.width - 8));
    let haut = y + 20;
    if (haut + boite.height > window.innerHeight - 4) haut = Math.max(4, y - boite.height - 10);
    bulle.style.left = gauche + 'px';
    bulle.style.top = haut + 'px';
  };

  document.addEventListener('mouseover', (e) => {
    const el = e.target instanceof Element ? e.target.closest('[title]') : null;
    if (el === cible && cible) return;
    cacher();
    if (!el) return;
    const texte = el.getAttribute('title');
    if (!texte || !texte.trim()) return;
    cible = el;
    el.dataset.mbnTitre = texte;
    el.removeAttribute('title');
    minuterie = setTimeout(montrer, DELAI);
  }, true);

  document.addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; }, { capture: true, passive: true });

  document.addEventListener('mouseout', (e) => {
    if (cible && !(e.relatedTarget instanceof Node && cible.contains(e.relatedTarget))) cacher();
  }, true);

  for (const type of ['mousedown', 'keydown', 'wheel']) {
    document.addEventListener(type, cacher, { capture: true, passive: true });
  }
  window.addEventListener('blur', cacher);
})();
