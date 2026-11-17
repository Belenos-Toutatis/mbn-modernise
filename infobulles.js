// MBN modernisé — infobulles de survol lisibles.
//
// Les infobulles des pages MBN sont celles du navigateur (attribut « title »).
// Sous Linux, Chrome les dessine avec les couleurs du thème du bureau, ce qui
// peut donner du blanc sur fond clair. Sur les pages MBN, on affiche donc
// notre propre infobulle (fond sombre, texte blanc) à la place.
//
// Le « title » est retiré le temps du survol, pour que le navigateur n'affiche
// pas la sienne en plus, puis remis tel quel dès que la souris quitte l'élément.
//
// En plus : un bouton ou un lien réduit à une icône, sans « title », affiche en
// infobulle le libellé que MBN réserve aux lecteurs d'écran.

(() => {
  const DELAI = 450; // ms de survol avant l'affichage
  let bulle = null;
  let cible = null;
  let libelle = '';
  let titreRetire = false;
  let retires = []; // éléments dont le « title » est retiré le temps du survol
  let minuterie = 0;
  let x = 0;
  let y = 0;

  const cacher = () => {
    clearTimeout(minuterie);
    if (bulle) bulle.style.display = 'none';
    for (const el of retires) {
      if (el.dataset.mbnTitre !== undefined && !el.hasAttribute('title')) {
        el.setAttribute('title', el.dataset.mbnTitre);
      }
      delete el.dataset.mbnTitre;
    }
    retires = [];
    cible = null;
    libelle = '';
    titreRetire = false;
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
    bulle.textContent = libelle;
    bulle.style.display = 'block';
    // Sous le pointeur, sans sortir de la fenêtre ; au-dessus s'il n'y a pas la place.
    const boite = bulle.getBoundingClientRect();
    const gauche = Math.max(4, Math.min(x + 12, window.innerWidth - boite.width - 8));
    let haut = y + 20;
    if (haut + boite.height > window.innerHeight - 4) haut = Math.max(4, y - boite.height - 10);
    bulle.style.left = gauche + 'px';
    bulle.style.top = haut + 'px';
  };

  // Libellé caché d'un bouton ou lien qui n'affiche qu'une icône.
  const libelleCache = (bouton) => {
    const cache = bouton.querySelector('.screen-reader-text, .visually-hidden');
    if (!cache) return '';
    const texte = cache.textContent.replace(/\s+/g, ' ').trim();
    const visible = bouton.textContent.replace(cache.textContent, '').replace(/\s+/g, ' ').trim();
    return texte && !visible ? texte : '';
  };

  document.addEventListener('mouseover', (e) => {
    if (!(e.target instanceof Element)) return;
    const avecTitre = e.target.closest('[title]');
    const bouton = avecTitre ? null : e.target.closest('a, button');
    const el = avecTitre || bouton;
    if (el === cible && cible) return;
    cacher();
    if (!el) return;

    if (avecTitre) {
      const texte = el.getAttribute('title');
      if (!texte || !texte.trim()) return;
      cible = el;
      libelle = texte;
      titreRetire = true;
      // Les « title » des éléments englobants sont retirés aussi : sinon le
      // navigateur afficherait le leur par-dessus notre infobulle.
      for (let parent = el; parent; parent = parent.parentElement && parent.parentElement.closest('[title]')) {
        parent.dataset.mbnTitre = parent.getAttribute('title');
        parent.removeAttribute('title');
        retires.push(parent);
      }
    } else {
      const texte = libelleCache(el);
      if (!texte) return;
      cible = el;
      libelle = texte;
    }
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
