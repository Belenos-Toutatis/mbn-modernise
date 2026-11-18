// Capture anonymisée de la structure d'une page.
//
// Ce qui est relevé : balises, identifiants et classes CSS, position et taille
// des blocs, quelques propriétés de mise en page.
// S'y ajoutent les règles de style d'impression de la page (@page, @media
// print), adresses et textes masqués.
// Ce qui n'est JAMAIS relevé : le texte de la page (remplacé par sa longueur),
// les adresses des liens, images et documents, les valeurs des champs.
// Seule exception : les libellés d'interface de la liste MOTS ci-dessous
// (« Objet », « Dossier »…), qui servent à repérer les colonnes.

globalThis.__mbnCapture = function () {
  const MOTS = new Set([
    'objet', 'sujet', 'dossier', 'dossiers', 'taille', 'reçu', 'reçu le', 'reçus', 'date',
    'de', 'à', 'expéditeur', 'expéditeurs', 'destinataire', 'destinataires',
    'pièces jointes', 'pièce jointe', 'messagerie', 'boîte de réception', 'envoyés',
    'brouillons', 'corbeille', 'nouveau message', 'répondre', 'transférer', 'supprimer',
    'rechercher', 'aperçu', 'télécharger', 'fermer', 'imprimer', 'actions', 'trier par',
  ]);
  const IGNORER = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'HEAD', 'TEMPLATE', 'BR']);
  const SANS_ENFANTS = new Set(['SVG', 'SELECT', 'TEXTAREA', 'CANVAS', 'VIDEO', 'AUDIO', 'PICTURE']);
  const ATTRIBUTS = ['role', 'colspan', 'rowspan', 'width', 'height', 'align', 'valign',
    'cellpadding', 'cellspacing', 'border', 'scrolling'];
  const MAX_LIGNES = 5000;
  const EXEMPLAIRES = 3; // nombre d'éléments semblables détaillés avant d'abréger

  const lignes = [];
  let tronque = false;

  // Les longues suites de chiffres peuvent être des identifiants : on les masque.
  const masquer = (s) => s.replace(/\d{3,}/g, '#').slice(0, 60);

  const classes = (el) => (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean);

  const nom = (el, avecId = true) => {
    let s = el.tagName.toLowerCase();
    if (avecId && el.id) s += '#' + masquer(el.id);
    for (const c of classes(el).slice(0, 8)) s += '.' + masquer(c);
    return s;
  };

  const texte = (el) => {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    t = t.replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return MOTS.has(t.toLowerCase()) ? ` "${t}"` : ` txt:${t.length}`;
  };

  const attributs = (el) => {
    let s = '';
    for (const a of ATTRIBUTS) {
      const v = el.getAttribute(a);
      if (v !== null && /^[\w%.\- ]{1,20}$/.test(v)) s += ` ${a}=${v}`;
    }
    if (el.tagName === 'INPUT') {
      const t = el.getAttribute('type');
      if (t && /^[a-z]+$/.test(t)) s += ` type=${t}`;
    }
    if (/^(IFRAME|EMBED|OBJECT)$/.test(el.tagName)) {
      const src = el.getAttribute('src') || el.getAttribute('data') || '';
      const type = el.getAttribute('type') || '';
      if (/pdf/i.test(src + type)) s += ' (pdf)';
      if (/^blob:/.test(src)) s += ' (blob)';
    }
    const style = el.getAttribute('style');
    if (style) {
      const propre = style
        .replace(/url\([^)]*\)/gi, 'url(…)')
        .replace(/["'][^"']*["']/g, '"…"')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
      s += ` style="${propre}"`;
    }
    return s;
  };

  const styles = (el, cs) => {
    const p = [];
    const ajouter = (prop, defaut) => {
      const v = cs.getPropertyValue(prop);
      if (v && v !== defaut) p.push(`${prop}:${v}`);
    };
    p.push(`display:${cs.display}`);
    ajouter('position', 'static');
    ajouter('float', 'none');
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') p.push(`overflow:${cs.overflowX}/${cs.overflowY}`);
    ajouter('max-height', 'none');
    ajouter('max-width', 'none');
    ajouter('min-width', '0px');
    ajouter('padding-left', '0px');
    ajouter('padding-right', '0px');
    ajouter('margin-left', '0px');
    ajouter('text-align', 'start');
    ajouter('white-space', 'normal');
    if (cs.boxSizing === 'border-box') p.push('border-box');
    if (el.tagName === 'TABLE') {
      p.push(`table-layout:${cs.tableLayout}`);
      p.push(`border-collapse:${cs.borderCollapse}`);
    }
    if (/grid/.test(cs.display)) p.push(`colonnes:${cs.gridTemplateColumns.slice(0, 120)}`);
    const parent = el.parentElement;
    if (parent && /flex/.test(getComputedStyle(parent).display)) {
      p.push(`flex:${cs.flexGrow} ${cs.flexShrink} ${cs.flexBasis}`);
    }
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') p.push(`fond:${cs.backgroundColor.replace(/\s/g, '')}`);
    if (cs.fontWeight !== '400') p.push(`graisse:${cs.fontWeight}`);
    // Décors ::before / ::after : leur présence et leur taille, jamais leur contenu.
    for (const pseudo of ['::before', '::after']) {
      const d = getComputedStyle(el, pseudo);
      if (d.content && d.content !== 'none' && d.content !== 'normal') {
        const fond = d.backgroundColor !== 'rgba(0, 0, 0, 0)' ? ` fond:${d.backgroundColor.replace(/\s/g, '')}` : '';
        p.push(`${pseudo}(${d.display} ${d.position} ${d.width}×${d.height}${fond})`);
      }
    }
    return ` {${p.join('; ')}}`;
  };

  const visiter = (el, profondeur) => {
    if (lignes.length >= MAX_LIGNES) { tronque = true; return; }
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const boite = ` [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}]`;
    const retrait = '  '.repeat(profondeur);

    if (cs.display === 'none') {
      lignes.push(`${retrait}${nom(el)} (caché)`);
      return;
    }
    lignes.push(retrait + nom(el) + attributs(el) + boite + styles(el, cs) + texte(el));
    if (SANS_ENFANTS.has(el.tagName.toUpperCase())) return;

    const vus = new Map();
    let omis = 0;
    for (const enfant of el.children) {
      if (IGNORER.has(enfant.tagName)) continue;
      // Les lignes de liste sont regroupées par classes : une ligne « non lue »
      // ou « sélectionnée » est ainsi détaillée même si elle arrive tard.
      // Un bloc vide et sans hauteur ne compte pas parmi les exemplaires : sinon
      // trois conteneurs vides suffisaient à faire abréger celui qui est rempli
      // (l'arborescence des dossiers de la messagerie, par exemple).
      const vide = enfant.children.length === 0 && enfant.getBoundingClientRect().height === 0;
      const signature = nom(enfant, false) + (vide ? ' (vide)' : '');
      const n = (vus.get(signature) || 0) + 1;
      vus.set(signature, n);
      // Les cellules d'une ligne de tableau sont toutes détaillées : ce sont
      // les colonnes, dont on veut justement comparer l'alignement.
      if (n <= EXEMPLAIRES || el.tagName === 'TR') visiter(enfant, profondeur + 1);
      else omis++;
    }
    if (omis) lignes.push(`${retrait}  … ${omis} élément(s) semblable(s) non détaillé(s)`);
  };

  // Adresse de la page : chemin masqué, et seulement les paramètres PROC/ACTION
  // (qui désignent le service MBN affiché, pas une personne).
  const parametres = [];
  for (const [cle, valeur] of new URLSearchParams(location.search)) {
    const visible = /^(PROC|ACTION)$/i.test(cle) && /^[A-Za-z_]{1,40}$/.test(valeur);
    parametres.push(`${masquer(cle)}=${visible ? valeur : '…'}`);
  }

  const entete = [
    '# Capture MBN anonymisée (structure seule, sans le texte de la page)',
    `# page : ${masquer(location.pathname)}${parametres.length ? ' ?' + parametres.join('&') : ''}`,
    `# cadre : ${window === window.top ? 'page principale' : 'cadre intégré (iframe)'}`,
    `# fenêtre : ${window.innerWidth}×${window.innerHeight}, zoom écran ${window.devicePixelRatio}`,
    '# format : balise#id.classes [gauche,haut largeur×hauteur] {mise en page} txt:longueur',
    '',
  ];

  if (document.body) visiter(document.body, 0);
  if (tronque) lignes.push(`# capture tronquée à ${MAX_LIGNES} lignes`);

  // Règles d'impression de la page (@page et @media print) : elles expliquent
  // une page blanche ou un élément en trop à l'impression. Ce sont des règles
  // de style, sans donnée de la page ; adresses et textes y sont masqués.
  const MAX_REGLES = 120;
  const regles = [];
  const nettoyer = (css) => css.replace(/url\([^)]*\)/g, 'url(…)').replace(/"[^"]*"|'[^']*'/g, '"…"').replace(/\s+/g, ' ').slice(0, 300);
  const relever = (liste, dansImpression) => {
    for (const regle of liste) {
      if (regles.length >= MAX_REGLES) return;
      if (regle instanceof CSSPageRule) regles.push('  ' + nettoyer(regle.cssText));
      else if (regle instanceof CSSMediaRule) relever(regle.cssRules, dansImpression || /\bprint\b/.test(regle.conditionText));
      else if (regle instanceof CSSSupportsRule) relever(regle.cssRules, dansImpression);
      else if (dansImpression && regle.cssText) regles.push('  ' + nettoyer(regle.cssText));
    }
  };
  let illisibles = 0;
  for (const feuille of document.styleSheets) {
    try { relever(feuille.cssRules, /\bprint\b/.test(feuille.media.mediaText)); } catch { illisibles += 1; }
  }
  if (regles.length || illisibles) {
    lignes.push('', `# règles d'impression (${regles.length}${regles.length >= MAX_REGLES ? ', liste tronquée' : ''}${illisibles ? `, ${illisibles} feuille(s) illisible(s)` : ''})`);
    lignes.push(...regles);
  }
  return entete.concat(lignes).join('\n');
};

globalThis.__mbnCapture();
