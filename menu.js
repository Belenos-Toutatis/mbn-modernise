// MBN modernisé — menu latéral réduit qui se déplie au survol.
//
// Quand le menu de gauche est réduit à ses icônes, le survoler le déplie
// par-dessus la page, sans la décaler ; il se replie quand la souris le quitte.
// Le script pose simplement sur le menu la classe que MBN utilise lui-même
// pour le menu déplié (« menu--expanded »), sans toucher à celle du contenu :
// c'est donc l'affichage de MBN, mais en surimpression.
// Un menu que vous avez déplié vous-même (bouton « Menu ») n'est pas concerné.

(() => {
  if (window !== window.top) return;
  const menu = document.querySelector('nav.menu.js-menu');
  if (!menu) return;

  const OUVRIR = 140;  // ms de survol avant de déplier (évite les ouvertures au passage)
  const FERMER = 280;  // ms après la sortie avant de replier
  let minuterie = 0;

  const actif = () => document.documentElement.classList.contains('mbn-menu-survol');
  const survole = () => menu.classList.contains('mbn-menu-deplie');
  // Déplié par l'utilisateur : la classe est là sans que nous l'ayons posée.
  const epingle = () => menu.classList.contains('menu--expanded') && !survole();

  const deplier = () => {
    if (!actif() || epingle()) return;
    clearTimeout(fin);
    if (survole()) { menu.classList.remove('mbn-menu-repli'); return; } // revenu pendant le repli
    menu.classList.add('mbn-menu-deplie', 'menu--expanded');
  };
  // Repli en deux temps : la largeur glisse d'abord (menu.css), puis les
  // classes sont retirées. « tout de suite » sert quand MBN doit reprendre la main.
  const GLISSEMENT = 230; // ms, un peu plus que la transition de menu.css
  let fin = 0;
  const replier = (toutDeSuite) => {
    if (!survole()) return;
    clearTimeout(fin);
    const terminer = () => menu.classList.remove('mbn-menu-deplie', 'mbn-menu-repli', 'menu--expanded');
    if (toutDeSuite === true || matchMedia('(prefers-reduced-motion: reduce)').matches) { terminer(); return; }
    menu.classList.add('mbn-menu-repli');
    fin = setTimeout(terminer, GLISSEMENT);
  };

  menu.addEventListener('mouseenter', () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(deplier, OUVRIR);
  });
  menu.addEventListener('mouseleave', () => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => replier(), FERMER);
  });
  // Clavier : le menu se déplie aussi quand on y entre avec Tab.
  menu.addEventListener('focusin', (e) => { if (e.target.matches(':focus-visible')) deplier(); });
  menu.addEventListener('focusout', (e) => {
    if (!menu.contains(e.relatedTarget) && !menu.matches(':hover')) replier();
  });
  // Clic sur le bouton « Menu » pendant le survol : on rend d'abord la main à MBN.
  document.addEventListener('mousedown', (e) => {
    if (survole() && e.target instanceof Element && e.target.closest('.js-trigger-menu') && !menu.contains(e.target)) replier(true);
  }, true);
  addEventListener('blur', () => replier());
})();
