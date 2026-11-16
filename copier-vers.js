// MBN modernisé — page « Copier vers » du cahier de textes.
// La mise en page est dans copier-vers.css ; ce script ajoute quatre commodités :
//  - les classes en boutons colorés, à la place du long menu déroulant ;
//  - « Tout cocher / Tout décocher » pour les contenus à copier ;
//  - un clic dans le champ de la séance ouvre le choix de la séance (d'origine,
//    il faut viser l'icône de calendrier de 16 px) ;
//  - un compteur des séances de destination choisies, la limite étant de cinq.
// Il ne fait qu'actionner les cases et l'icône de MBN, sur votre clic.

(() => {
  const destination = document.getElementById('copier_vers');
  const contenus = document.getElementById('activite_seance_copie_vers');
  if (!destination) return;
  const LIMITE = 5;

  const outils = (apres) => {
    const bloc = document.createElement('div');
    bloc.className = 'mbn-copie-outils';
    apres.after(bloc);
    return bloc;
  };

  // ---- Tout cocher / tout décocher ----
  if (contenus) {
    const cases = () => [...contenus.querySelectorAll('li.seance_contenu > input[type="checkbox"]')].filter((c) => !c.disabled);
    const legende = contenus.querySelector('legend');
    if (legende && cases().length > 1) {
      const bloc = outils(legende);
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'mbn-copie-bouton';
      const compte = document.createElement('span');
      compte.className = 'mbn-copie-compte';
      const libeller = () => {
        const toutes = cases();
        const cochees = toutes.filter((c) => c.checked).length;
        bouton.textContent = cochees === toutes.length ? 'Tout décocher' : 'Tout cocher';
        compte.textContent = `${cochees} sur ${toutes.length} à copier`;
      };
      bouton.addEventListener('click', () => {
        const toutes = cases();
        const cocher = !toutes.every((c) => c.checked);
        // click() et non « checked = » : MBN réagit ainsi comme à un vrai clic.
        for (const c of toutes) if (c.checked !== cocher) c.click();
        libeller();
      });
      contenus.addEventListener('change', libeller);
      bloc.append(bouton, compte);
      libeller();
    }
  }

  // ---- Clic dans le champ de la séance : ouvre le choix ----
  destination.addEventListener('click', (e) => {
    if (!document.documentElement.classList.contains('mbn-moderne')) return;
    const champ = e.target instanceof Element ? e.target.closest('input.libelle_seance_remise') : null;
    if (!champ) return;
    const icone = champ.parentElement.querySelector('img[id^="img_seance_remise"]');
    if (icone) icone.click();
  });
  const preparer = () => {
    for (const champ of destination.querySelectorAll('input.libelle_seance_remise')) {
      if (!champ.placeholder) champ.placeholder = 'Cliquez pour choisir la séance';
    }
  };

  // ---- Choix de la classe par boutons ----
  // Avec plus de dix classes et des groupes, le menu déroulant est long à
  // parcourir. Chaque classe devient un bouton, à la couleur de son niveau :
  // un clic la place dans la première ligne de destination encore libre, puis
  // ouvre le choix de la séance. Le script ne fait que régler le menu de MBN.
  const INDEFINI = /^\s*(ind[ée]fini|$)/i;
  const propre = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const menus = () => [...destination.querySelectorAll('select.selecteur-groupe-cdt')];
  const libelleDe = (menu) => propre((menu.options[menu.selectedIndex] || {}).text);
  const libre = (menu) => !menu.disabled && INDEFINI.test(libelleDe(menu));
  const seanceDe = (menu) => {
    const numero = (menu.id.match(/\d+$/) || [''])[0];
    return {
      id: document.getElementById('ID_SEANCE_COPIE' + numero),
      icone: document.getElementById('img_seance_remise' + numero),
    };
  };
  // « PHYSIQUE-CHIMIE/5D » → matière « PHYSIQUE-CHIMIE », classe « 5D ».
  const decouper = (texte) => {
    const i = texte.lastIndexOf('/');
    return i > 0 ? { matiere: propre(texte.slice(0, i)), classe: propre(texte.slice(i + 1)) } : { matiere: '', classe: texte };
  };

  const panneau = document.createElement('div');
  panneau.className = 'mbn-copie-classes';
  let boutons = []; // { b, texte }
  let signature = '';
  const construire = () => {
    const premier = menus()[0];
    if (!premier) return;
    const choix = [...premier.options].map((o) => propre(o.text)).filter((t) => t && !INDEFINI.test(t));
    const cle = choix.join('|');
    if (cle === signature) return;
    signature = cle;
    panneau.textContent = '';
    boutons = [];
    if (choix.length < 2) { panneau.hidden = true; return; }
    panneau.hidden = false;
    const aide = document.createElement('p');
    aide.className = 'mbn-copie-classes__aide';
    aide.textContent = 'Cliquez sur une classe : elle s’ajoute aux destinations et le choix de la séance s’ouvre.';
    panneau.append(aide);

    const groupes = new Map();
    for (const texte of choix) {
      const { matiere, classe } = decouper(texte);
      if (!groupes.has(matiere)) groupes.set(matiere, []);
      groupes.get(matiere).push({ texte, classe });
    }
    const ordre = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
    const couleurs = globalThis.mbnCouleurs;
    for (const [matiere, classes] of groupes) {
      classes.sort((a, b) => ordre.compare(a.classe, b.classe));
      const rangee = document.createElement('div');
      rangee.className = 'mbn-copie-classes__groupe';
      if (matiere && groupes.size > 1) {
        const nom = document.createElement('span');
        nom.className = 'mbn-copie-classes__matiere';
        nom.textContent = matiere;
        nom.title = matiere;
        rangee.append(nom);
      }
      let niveau = null;
      for (const c of classes) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mbn-copie-classe';
        b.textContent = c.classe;
        b.title = c.texte;
        const n = (c.classe.match(/^\d/) || [''])[0];
        if (niveau !== null && n !== niveau) b.classList.add('mbn-copie-classe--saut');
        niveau = n;
        const teinte = couleurs && couleurs.pour ? couleurs.pour(c.classe) : null;
        if (teinte) {
          b.style.setProperty('--mbn-pale', teinte.pale);
          b.style.setProperty('--mbn-bord', teinte.bord);
          b.style.setProperty('--mbn-fond', teinte.fond);
          b.style.setProperty('--mbn-texte', teinte.texte);
        }
        b.addEventListener('click', () => choisirClasse(c.texte));
        rangee.append(b);
        boutons.push({ b, texte: c.texte });
      }
      panneau.append(rangee);
    }
  };

  const choisirClasse = (texte) => {
    // Première ligne sans classe ; à défaut, dernière ligne dont la séance n'est pas choisie.
    const tous = menus();
    const cible = tous.find(libre) || [...tous].reverse().find((m) => { const s = seanceDe(m); return s.id && !s.id.value.trim(); });
    if (!cible) return;
    const option = [...cible.options].find((o) => propre(o.text) === texte);
    if (!option) return;
    cible.value = option.value;
    option.selected = true;
    cible.dispatchEvent(new Event('change', { bubbles: true }));
    // Puis le choix de la séance, comme un clic sur l'icône de calendrier.
    setTimeout(() => {
      const { id, icone } = seanceDe(cible);
      if (icone && id && !id.value.trim() && icone.getClientRects().length) icone.click();
      compter();
    }, 350);
  };

  const marquerClasses = () => {
    construire();
    const tous = menus();
    const pris = tous.map(libelleDe);
    const complet = tous.length >= LIMITE && !tous.some(libre) && tous.every((m) => { const s = seanceDe(m); return !s.id || s.id.value.trim(); });
    for (const { b, texte } of boutons) {
      b.setAttribute('aria-pressed', String(pris.includes(texte)));
      b.disabled = complet;
    }
  };

  // ---- Compteur des séances choisies ----
  const legende = destination.querySelector('legend');
  let compte = null;
  if (legende) {
    compte = document.createElement('span');
    compte.className = 'mbn-copie-compte';
    const bloc = outils(legende);
    bloc.append(compte);
    bloc.after(panneau);
  }
  let vu = '';
  const compter = () => {
    preparer();
    marquerClasses();
    if (!compte) return;
    const choisies = [...destination.querySelectorAll('input[id^="ID_SEANCE_COPIE"]')].filter((i) => i.value.trim()).length;
    const texte = choisies === 0 ? `Aucune séance choisie — ${LIMITE} au maximum`
      : `${choisies} séance${choisies > 1 ? 's' : ''} choisie${choisies > 1 ? 's' : ''} sur ${LIMITE} au maximum`;
    if (texte === vu) return;
    vu = texte;
    compte.textContent = texte;
    compte.classList.toggle('mbn-copie-compte--plein', choisies >= LIMITE);
  };
  compter();
  new MutationObserver(compter).observe(destination, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
  setInterval(compter, 700); // la valeur d'un champ caché change sans prévenir
})();
