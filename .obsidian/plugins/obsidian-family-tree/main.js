const { Plugin, PluginSettingTab, Setting, MarkdownRenderer, parseYaml } = require("obsidian");

// --- INLINED GENEALOGY GRAPH ENGINE & OBSIDIAN BASES PROVIDER ---
/**
 * genealogy_graph_engine.js
 * ==============================================================================
 * Universal High-Performance N-Generation Genealogy Graph & Pedigree Engine
 * Supports:
 *   1. Gramps Compact Bracket Pedigree (Stacked Columns, zero horizontal bloat, 100% responsive)
 *   2. Gramps Radial Fan Chart (Concentric color-coded generational arcs, fluid SVG viewBox)
 *   3. Mermaid Flowchart Hourglass (Auto-scaled viewBox, multi-citizenship flags)
 * Compatible with:
 *   - Obsidian Native (app.metadataCache / app.vault — zero Dataview reliance)
 *   - Headless Web / Publisher engines (JSON / FastAPI / SQLite DAG index)
 *   - Node.js & Playwright CLI Test Suites
 * ==============================================================================
 */

class GenealogyGraphEngine {
  constructor(dataProvider, options = {}) {
    this.dataProvider = dataProvider;
    this.cache = new Map();
    this.options = {
      defaultDepthUp: 2,
      defaultDepthDown: 2,
      includeSpouses: true,
      includeDates: true,
      direction: 'TD',
      viewMode: 'pedigree', // 'pedigree', 'fan', 'hourglass'
      maxNodes: 150,
      ...options
    };
  }

  static escapeText(str) {
    if (!str) return '';
    return String(str)
      .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
      .replace(/"/g, '#quot;')
      .replace(/[\r\n]+/g, ' ')
      .trim();
  }

  static sanitizeId(key) {
    if (!key) return 'node_unknown';
    const clean = key.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
    const slug = clean.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return `n_${slug.slice(0, 48)}`;
  }

  static extractYear(dateStr) {
    if (!dateStr) return null;
    const match = String(dateStr).match(/\b(1[4-9]\d\d|20[0-2]\d)\b/);
    return match ? match[1] : null;
  }

  static formatVitalDates(birthDate, deathDate) {
    const bYear = GenealogyGraphEngine.extractYear(birthDate);
    const dYear = GenealogyGraphEngine.extractYear(deathDate);
    if (bYear && dYear) return `(${bYear}–${dYear})`;
    if (bYear) return `(b. ${bYear})`;
    if (dYear) return `(d. ${dYear})`;
    return '';
  }

  static normalizeGender(sex) {
    if (!sex || String(sex).trim() === '' || String(sex).trim().toLowerCase() === 'null') return 'U';
    const s = String(sex).trim().toLowerCase();
    if (s === 'x' || s === 'non-binary' || s === 'nonbinary' || s === 'other') return 'X';
    if (s.startsWith('m') || s === 'male' || s === 'hombre' || s === 'varon') return 'M';
    if (s.startsWith('f') || s === 'female' || s === 'mujer' || s === 'hembra') return 'F';
    if (s === 'u' || s === 'unknown' || s === 'desconocido' || s === 'blank') return 'U';
    return 'U';
  }

  static get FEMALE_NAMES() {
    return new Set([
      'lisa', 'maria', 'michelle', 'luisa', 'esther', 'shirley', 'ana', 'elena', 'eva', 'isabel',
      'bobbi', 'concepcion', 'carmen', 'pilar', 'teresa', 'rosa', 'dolores', 'mercedes',
      'francisca', 'antonia', 'josefa', 'juana', 'lucia', 'beatriz', 'ines', 'catalina',
      'clara', 'angela', 'patricia', 'barbara', 'mary', 'elizabeth', 'ann', 'anne', 'jane',
      'sarah', 'margaret', 'emily', 'jennifer', 'jessica', 'amanda', 'victoria', 'laura',
      'carolina', 'claudia', 'sofia', 'valeria', 'camila', 'natalia', 'gabriela', 'daniela',
      'paula', 'andrea', 'monica', 'adriana', 'veronica', 'silvia', 'sandra', 'susana',
      'alicia', 'marta', 'raquel', 'irene', 'nuria', 'sonia', 'olga', 'rocio', 'miriam',
      'lorena', 'alba', 'julia', 'emma', 'olivia', 'ava', 'charlotte', 'amelia', 'harper',
      'evelyn', 'abigail', 'dorothy', 'helen', 'ruth', 'betty', 'doris', 'mildred',
      'virginia', 'frances', 'joan', 'judith'
    ]);
  }

  static get MALE_NAMES() {
    return new Set([
      'jose', 'luis', 'andres', 'alfonso', 'eduardo', 'alister', 'sean', 'adrian', 'carlos',
      'manuel', 'antonio', 'francisco', 'juan', 'pedro', 'miguel', 'fernando', 'javier',
      'rafael', 'diego', 'alvaro', 'enrique', 'jorge', 'ignacio', 'ramon', 'pablo',
      'guillermo', 'john', 'william', 'robert', 'james', 'charles', 'george', 'thomas',
      'richard', 'edward', 'david', 'michael', 'joseph', 'daniel', 'matthew', 'anthony',
      'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua', 'kenneth', 'kevin', 'brian',
      'timothy', 'ronald', 'jason', 'jeffrey', 'ryan', 'jacob', 'gary', 'nicholas', 'eric',
      'jonathan', 'stephen', 'larry', 'justin', 'scott', 'brandon', 'benjamin', 'samuel',
      'gregory', 'alexander', 'frank', 'patrick', 'raymond', 'jack', 'dennis', 'jerry',
      'tyler', 'aaron', 'adam', 'nathan', 'henry', 'douglas', 'zachary', 'peter', 'kyle',
      'walter', 'ethan', 'jeremy', 'harold', 'keith', 'christian', 'roger', 'noah', 'gerald',
      'carl', 'terry', 'austin', 'arthur', 'lawrence', 'jesse', 'dylan', 'bryan', 'joe',
      'jordan', 'billy', 'albert', 'bruce', 'willie', 'gabriel', 'logan', 'alan', 'wayne',
      'roy', 'ralph', 'randy', 'eugene', 'vincent', 'russell', 'louis', 'philip', 'bobby',
      'johnny', 'bradley', 'wr'
    ]);
  }

  static extractFirstName(rawName) {
    if (!rawName) return '';
    let s = String(rawName).split(' - URN-GEN')[0].trim();
    if (s.includes(',')) {
      const parts = s.split(',');
      let firstPart = parts[1].replace(/\b\d{4}(-\d{2})*(-\d{2})*\b/g, '').trim();
      const tokens = (firstPart.match(/[A-Za-z]+/g) || []).map(t => t.toLowerCase());
      if (tokens.length >= 2 && tokens[0] === 'jose' && tokens[1] === 'luis') return 'jose';
      if (tokens.length >= 2 && tokens[0] === 'maria' && ['luisa', 'esther', 'isabel', 'elena', 'del'].includes(tokens[1])) return 'maria';
      if (tokens.length > 0) return tokens[0];
    }
    const tokens = (s.match(/[A-Za-z]+/g) || []).map(t => t.toLowerCase());
    return tokens.length > 0 ? tokens[0] : '';
  }

  static isMaleNode(node) {
    if (!node) return null;
    const sex = String(node.sex || node.gender || '').trim().toLowerCase();
    if (sex === 'm' || sex === 'male') return true;
    if (sex === 'f' || sex === 'female') return false;

    const nameStr = node.displayName || node.name || node.file_path || '';
    const first = GenealogyGraphEngine.extractFirstName(nameStr);
    if (GenealogyGraphEngine.FEMALE_NAMES.has(first)) return false;
    if (GenealogyGraphEngine.MALE_NAMES.has(first)) return true;
    return null;
  }

  static classifyParents(parentNodes, childNode = null) {
    if (!parentNodes || parentNodes.length === 0) return { father: null, mother: null };
    if (parentNodes.length === 1) {
      const isM = GenealogyGraphEngine.isMaleNode(parentNodes[0]);
      return isM === false ? { father: null, mother: parentNodes[0] } : { father: parentNodes[0], mother: null };
    }
    const p1 = parentNodes[0];
    const p2 = parentNodes[1];
    const p1Male = GenealogyGraphEngine.isMaleNode(p1);
    const p2Male = GenealogyGraphEngine.isMaleNode(p2);

    if (p1Male === true && p2Male === false) {
      return { father: p1, mother: p2 };
    }
    if (p1Male === false && p2Male === true) {
      return { father: p2, mother: p1 };
    }
    if (p1Male === false && p2Male === null) return { father: p2, mother: p1 };
    if (p2Male === false && p1Male === null) return { father: p1, mother: p2 };
    if (p1Male === true && p2Male === null) return { father: p1, mother: p2 };
    if (p2Male === true && p1Male === null) return { father: p2, mother: p1 };

    return { father: p1, mother: p2 };
  }

  static isDeceased(node) {
    if (node.death_date && String(node.death_date).trim() !== '' && String(node.death_date).toLowerCase() !== 'living') {
      return true;
    }
    if (node.death_place && String(node.death_place).trim() !== '') {
      return true;
    }
    if (node.is_living === false || node.living === false || node.is_deceased === true) {
      return true;
    }
    const bYear = GenealogyGraphEngine.extractYear(node.birth_date);
    if (bYear && (new Date().getFullYear() - parseInt(bYear, 10)) > 110) {
      return true;
    }
    return false;
  }

  static getCitizenshipFlags(node) {
    if (!node) return '';

    const COUNTRY_REGISTRY = [
      { flag: '🇺🇸', keys: ['usa', 'united states', 'us_citizen', 'american', 'u.s.a.', 'u.s.', 'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming', 'district of columbia'] },
      { flag: '🇨🇦', keys: ['canada', 'canadian', 'canadian_citizen', 'new brunswick', 'nova scotia', 'ontario', 'quebec', 'québec', 'prince edward island', 'newfoundland', 'labrador', 'manitoba', 'saskatchewan', 'alberta', 'british columbia', 'yukon', 'northwest territories', 'nunavut', 'charlotte', 'deer island', 'campobello', 'blackville', 'west isles', 'passamaquoddy'] },
      { flag: '🇲🇽', keys: ['mexico', 'mexican', 'méxico', 'mexicana', 'mexicano', 'nueva españa', 'new spain', 'jalisco', 'guadalajara', 'monterrey', 'puebla', 'veracruz', 'oaxaca', 'yucatan', 'michoacan'] },
      { flag: '🇪🇸', keys: ['spain', 'spanish', 'españa', 'español', 'española', 'castile', 'castilian', 'castilla', 'madrid', 'andalucia', 'andalucía', 'catalonia', 'catalunya', 'cataluña', 'barcelona', 'valencia', 'galicia', 'asturias', 'cantabria', 'santander', 'pais vasco', 'basque', 'navarra', 'navarre', 'aragon', 'aragón', 'extremadura', 'murcia', 'castilla y leon', 'castilla-la mancha', 'islas canarias', 'canary islands', 'tenerife', 'las palmas', 'baleares', 'balearic', 'mallorca', 'menorca', 'ibiza', 'jaen', 'jaén', 'sevilla', 'seville', 'granada', 'cordoba', 'córdoba', 'cadiz', 'cádiz', 'malaga', 'málaga', 'simancas', 'valladolid', 'toledo', 'burgos', 'leon', 'león', 'salamanca', 'zamora', 'palencia'] },
      { flag: '🇵🇹', keys: ['portugal', 'portuguese', 'português', 'portuguesa', 'lisbon', 'lisboa', 'porto', 'azores', 'açores', 'madeira', 'coimbra', 'braga', 'algarve'] },
      { flag: '🇬🇧', keys: ['united kingdom', 'great britain', 'britain', 'british', 'uk', 'england', 'english', 'london', 'suffolk', 'devon', 'yorkshire', 'lancashire', 'essex', 'norfolk', 'kent', 'somerset', 'hampshire', 'dorset', 'cornwall', 'surrey', 'sussex', 'berkshire', 'oxfordshire', 'wiltshire', 'gloucestershire', 'cheshire', 'derbyshire', 'nottinghamshire', 'lincolnshire', 'scotland', 'scottish', 'edinburgh', 'glasgow', 'aberdeen', 'wales', 'welsh'] },
      { flag: '🇮🇪', keys: ['ireland', 'irish', 'éire', 'dublin', 'cork', 'galway', 'belfast', 'ulster', 'antrim', 'kerry', 'limerick', 'tipperary', 'waterford', 'kilkenny', 'mayo', 'donegal'] },
      { flag: '🇫🇷', keys: ['france', 'french', 'français', 'française', 'paris', 'normandy', 'normandie', 'brittany', 'bretagne', 'aquitaine', 'bordeaux', 'lyon', 'marseille', 'alsace', 'lorraine', 'provence'] },
      { flag: '🇩🇪', keys: ['germany', 'german', 'deutschland', 'deutsch', 'prussia', 'prussian', 'preussen', 'preußen', 'bavaria', 'bayern', 'saxony', 'sachsen', 'baden', 'württemberg', 'wurttemberg', 'hanover', 'hannover', 'rhineland', 'rheinland', 'westphalia', 'westfalen', 'hesse', 'hessen', 'berlin', 'hamburg'] },
      { flag: '🇮🇹', keys: ['italy', 'italian', 'italia', 'italiano', 'italiana', 'rome', 'roma', 'naples', 'napoli', 'sicily', 'sicilia', 'venice', 'venezia', 'genoa', 'genova', 'florence', 'firenze', 'milan', 'milano', 'piedmont', 'piemonte', 'tuscany', 'toscana', 'lombardy', 'lombardia'] },
      { flag: '🇳🇱', keys: ['netherlands', 'dutch', 'nederland', 'holland', 'amsterdam', 'rotterdam', 'utrecht', 'zeeland'] },
      { flag: '🇧🇪', keys: ['belgium', 'belgian', 'belgique', 'belgië', 'flanders', 'vlaanderen', 'brussels', 'bruxelles', 'antwerp', 'wallonia'] },
      { flag: '🇨🇭', keys: ['switzerland', 'swiss', 'schweiz', 'suisse', 'svizzera', 'zurich', 'zürich', 'bern', 'geneva', 'genève', 'basel'] },
      { flag: '🇦🇹', keys: ['austria', 'austrian', 'österreich', 'vienna', 'wien', 'habsburg', 'tirol', 'salzburg'] },
      { flag: '🇵🇱', keys: ['poland', 'polish', 'polska', 'warsaw', 'warszawa', 'krakow', 'kraków', 'silesia', 'gdansk'] },
      { flag: '🇨🇿', keys: ['czech', 'czechia', 'bohemia', 'moravia', 'prague', 'praha'] },
      { flag: '🇭🇺', keys: ['hungary', 'hungarian', 'magyar', 'budapest'] },
      { flag: '🇸🇪', keys: ['sweden', 'swedish', 'sverige', 'stockholm', 'gothenburg'] },
      { flag: '🇳🇴', keys: ['norway', 'norwegian', 'norge', 'oslo', 'bergen'] },
      { flag: '🇩🇰', keys: ['denmark', 'danish', 'danmark', 'copenhagen', 'københavn'] },
      { flag: '🇫🇮', keys: ['finland', 'finnish', 'suomi', 'helsinki'] },
      { flag: '🇬🇷', keys: ['greece', 'greek', 'hellas', 'athens'] },
      { flag: '🇷🇺', keys: ['russia', 'russian', 'rossiya', 'moscow', 'saint petersburg'] },
      { flag: '🇺🇦', keys: ['ukraine', 'ukrainian', 'kyiv', 'kiev', 'lviv', 'odessa'] },
      { flag: '🇵🇪', keys: ['peru', 'peruvian', 'perú', 'peruano', 'peruana', 'arequipa', 'lima', 'cusco', 'cuzco', 'trujillo', 'callao', 'moquegua', 'puno', 'piura', 'ica', 'ayacucho', 'lambayeque', 'huancayo'] },
      { flag: '🇨🇺', keys: ['cuba', 'cuban', 'cubano', 'cubana', 'habana', 'havana', 'santiago de cuba', 'matanzas', 'camaguey', 'cienfuegos'] },
      { flag: '🇵🇷', keys: ['puerto rico', 'puerto rican', 'puertorriqueño', 'puertorriqueña', 'san juan', 'ponce', 'mayaguez', 'bayamon'] },
      { flag: '🇨🇴', keys: ['colombia', 'colombian', 'colombiano', 'colombiana', 'bogota', 'bogotá', 'medellin', 'medellín', 'cali', 'cartagena', 'barranquilla', 'nueva granada', 'new granada'] },
      { flag: '🇦🇷', keys: ['argentina', 'argentine', 'argentino', 'buenos aires', 'rosario', 'mendoza', 'rio de la plata'] },
      { flag: '🇨🇱', keys: ['chile', 'chilean', 'chileno', 'santiago de chile', 'valparaiso', 'valparaíso', 'concepcion'] },
      { flag: '🇻🇪', keys: ['venezuela', 'venezuelan', 'venezolano', 'caracas', 'maracaibo', 'valencia'] },
      { flag: '🇪🇨', keys: ['ecuador', 'ecuadorian', 'ecuatoriano', 'quito', 'guayaquil', 'cuenca'] },
      { flag: '🇧🇴', keys: ['bolivia', 'bolivian', 'boliviano', 'la paz', 'sucre', 'potosi', 'potosí', 'alto peru'] },
      { flag: '🇩🇴', keys: ['dominican republic', 'republica dominicana', 'dominicano', 'santo domingo'] },
      { flag: '🇬🇹', keys: ['guatemala', 'guatemalan', 'guatemalteco', 'guatemala city'] },
      { flag: '🇨🇷', keys: ['costa rica', 'costa rican', 'costarricense', 'san jose', 'san josé'] },
      { flag: '🇵🇦', keys: ['panama', 'panamá', 'panamanian', 'panameño', 'panama city'] },
      { flag: '🇧🇷', keys: ['brazil', 'brasil', 'brazilian', 'brasileiro', 'rio de janeiro', 'sao paulo', 'são paulo', 'salvador'] },
      { flag: '🇵🇭', keys: ['philippines', 'filipinas', 'filipino', 'filipina', 'manila', 'cebu', 'iloilo'] },
      { flag: '🇯🇵', keys: ['japan', 'japanese', 'nihon', 'nippon', 'tokyo', 'kyoto', 'osaka'] },
      { flag: '🇨🇳', keys: ['china', 'chinese', 'beijing', 'shanghai', 'guangdong', 'canton', 'hong kong'] },
      { flag: '🇮🇳', keys: ['india', 'indian', 'delhi', 'mumbai', 'bombay', 'calcutta', 'kolkata', 'madras', 'chennai', 'goa'] },
      { flag: '🇿🇦', keys: ['south africa', 'south african', 'cape town', 'johannesburg', 'durban'] },
      { flag: '🇦🇺', keys: ['australia', 'australian', 'sydney', 'melbourne', 'brisbane', 'perth'] },
      { flag: '🇳🇿', keys: ['new zealand', 'auckland', 'wellington', 'christchurch'] }
    ];

    const flags = [];

    // Priority 1: Explicit citizenship status or citizenship field
    const cStatus = String(node.citizenship_status || node.citizenship || '').toLowerCase();
    if (cStatus && !['n/a', 'null', 'none', 'imported'].includes(cStatus)) {
      for (const item of COUNTRY_REGISTRY) {
        if (item.keys.some(k => cStatus.includes(k))) {
          if (!flags.includes(item.flag)) flags.push(item.flag);
        }
      }
      if (flags.length > 0) return flags.join(' ');
    }

    // Priority 2: Birth place fallback (only if no explicit citizenship declared)
    const bPlace = String(node.birth_place || '').toLowerCase();
    if (bPlace) {
      for (const item of COUNTRY_REGISTRY) {
        if (item.keys.some(k => bPlace.includes(k))) {
          if (!flags.includes(item.flag)) {
            flags.push(item.flag);
            break; // Take primary matched birth place country
          }
        }
      }
    }

    return flags.join(' ');
  }

  static getDisplayName(node) {
    if (!node) return 'Unknown Individual';
    if (node.name && String(node.name).trim() !== '') return String(node.name).trim();
    if (node.file_path) {
      const base = node.file_path.split('/').pop().replace(/\.md$/, '');
      return base.split(' - URN-GEN')[0].trim();
    }
    return 'Unknown Individual';
  }

  static formatFanName(nameStr, isDescendant = false) {
    if (!nameStr) return '';
    const clean = String(nameStr).split(' - URN-GEN')[0].trim();
    let first = '';
    let last = '';

    const VALID_COMPOUND_SECONDS = new Set([
      'luis', 'andres', 'ignacio', 'antonio', 'manuel', 'maria', 'ramon',
      'luisa', 'isabel', 'esther', 'teresa', 'concepcion', 'carmen', 'pilar',
      'elena', 'dolores', 'jose', 'belen', 'jude', 'carlos', 'pablo', 'francisco'
    ]);

    if (clean.includes(',')) {
      const parts = clean.split(',');
      last = parts[0].trim();
      first = parts[1].replace(/\b\d{4}(-\d{2})*(-\d{2})*\b/g, '').trim();
    } else {
      const tokens = clean.split(/\s+/).filter(Boolean);
      if (tokens.length <= 1) {
        first = clean;
        last = '';
      } else {
        if (tokens.length >= 2 && VALID_COMPOUND_SECONDS.has(tokens[1].toLowerCase())) {
          first = `${tokens[0]} ${tokens[1]}`;
          last = tokens.slice(2).join(' ');
        } else {
          first = tokens[0];
          last = tokens.slice(1).join(' ');
        }
      }
    }

    if (isDescendant) {
      const firstTokens = first.split(/\s+/).filter(Boolean);
      if (firstTokens.length >= 2 && VALID_COMPOUND_SECONDS.has(firstTokens[1].toLowerCase())) {
        return `${firstTokens[0]} ${firstTokens[1]}`;
      }
      return firstTokens[0] || first || clean;
    }

    return last ? `${first} ${last}`.trim() : (first || clean);
  }

  /**
   * Builds the complete N-generation Ancestor & Descendant DAG tree model.
   */
  async buildPedigreeData(rootIdentifier, depthUp = 2, depthDown = 2) {
    const rootNode = await this.dataProvider.getNode(rootIdentifier);
    if (!rootNode) return null;

    const resolveAncestors = async (node, currentDepth) => {
      if (!node || currentDepth > depthUp) return null;
      const enriched = {
        ...node,
        displayName: GenealogyGraphEngine.getDisplayName(node),
        dates: GenealogyGraphEngine.formatVitalDates(node.birth_date, node.death_date),
        flags: GenealogyGraphEngine.getCitizenshipFlags(node),
        gender: GenealogyGraphEngine.normalizeGender(node.sex || node.gender),
        deceased: GenealogyGraphEngine.isDeceased(node)
      };

      if (currentDepth < depthUp) {
        const parents = await this.dataProvider.getParents(node);
        if (parents.length > 0) {
          const parentNodes = [];
          for (const pk of parents) {
            const pn = await this.dataProvider.getNode(pk);
            if (pn) parentNodes.push(pn);
          }
          const { father: fatherNode, mother: motherNode } = GenealogyGraphEngine.classifyParents(parentNodes, node);
          enriched.father = fatherNode ? await resolveAncestors(fatherNode, currentDepth + 1) : null;
          enriched.mother = motherNode ? await resolveAncestors(motherNode, currentDepth + 1) : null;
        }
      }
      return enriched;
    };

    const resolveDescendants = async (node, currentDepth) => {
      if (!node || currentDepth > depthDown) return [];
      const childrenKeys = await this.dataProvider.getChildren(node);
      const childObjects = [];

      for (const ck of childrenKeys) {
        const cNode = await this.dataProvider.getNode(ck);
        if (cNode) {
          const enrichedChild = {
            ...cNode,
            displayName: GenealogyGraphEngine.getDisplayName(cNode),
            dates: GenealogyGraphEngine.formatVitalDates(cNode.birth_date, cNode.death_date),
            flags: GenealogyGraphEngine.getCitizenshipFlags(cNode),
            gender: GenealogyGraphEngine.normalizeGender(cNode.sex || cNode.gender),
            deceased: GenealogyGraphEngine.isDeceased(cNode),
            children: await resolveDescendants(cNode, currentDepth + 1)
          };
          childObjects.push(enrichedChild);
        }
      }
      return childObjects;
    };

    const ancestorTree = await resolveAncestors(rootNode, 0);
    const descendants = await resolveDescendants(rootNode, 1);
    
    return {
      root: ancestorTree,
      descendants
    };
  }


  // ==========================================
  // --- PALETTE & ACCESSIBILITY REGISTRY ---
  // ==========================================
  static getPaletteColors(paletteName = "classic", isPaternal = true, depth = 1, sDeg = 90, index = 0) {
    const pal = String(paletteName || "classic").toLowerCase();
    
    if (pal === "viridis") {
      const vSeqPaternal = [
        ["#440154", "#7e2482"],
        ["#3b528b", "#486da3"],
        ["#21918c", "#35b779"],
        ["#5ec962", "#86d549"],
        ["#fde725", "#fef08a"]
      ];
      const vSeqMaternal = [
        ["#2c728e", "#35b779"],
        ["#287d8e", "#440154"],
        ["#1f968b", "#fde725"],
        ["#73d055", "#a6e35e"],
        ["#d8e219", "#fde725"]
      ];
      const seq = isPaternal ? vSeqPaternal : vSeqMaternal;
      const idx = Math.min(Math.max(0, depth - 1), seq.length - 1);
      return seq[idx];
    }
    
    if (pal === "contrast" || pal === "tol") {
      const cPaternal = [
        ["#332288", "#88ccee"],
        ["#117733", "#44aa99"],
        ["#88ccee", "#332288"],
        ["#44aa99", "#117733"],
        ["#117733", "#999933"]
      ];
      const cMaternal = [
        ["#882255", "#cc6677"],
        ["#d55e00", "#e69f00"],
        ["#aa4499", "#ddcc77"],
        ["#cc6677", "#882255"],
        ["#e69f00", "#d55e00"]
      ];
      const seq = isPaternal ? cPaternal : cMaternal;
      const idx = Math.min(Math.max(0, depth - 1), seq.length - 1);
      return seq[idx];
    }
    
    if (pal === "monochrome" || pal === "grayscale") {
      const monoSeq = [
        ["#1e293b", "#64748b"],
        ["#334155", "#94a3b8"],
        ["#475569", "#cbd5e1"],
        ["#64748b", "#e2e8f0"],
        ["#94a3b8", "#f8fafc"]
      ];
      const idx = Math.min(Math.max(0, depth - 1), monoSeq.length - 1);
      return monoSeq[idx];
    }

    // Default "classic"
    if (isPaternal) {
      const pPal = [
        ["#1e3a8a", "#3b82f6"],
        ["#1e40af", "#60a5fa"],
        ["#0369a1", "#38bdf8"],
        ["#0f766e", "#2dd4bf"],
        ["#047857", "#34d399"]
      ];
      const idx = Math.min(Math.max(0, depth - 1), pPal.length - 1);
      let [f, s] = pPal[idx];
      if (depth === 2 && sDeg < 135) { f = "#065f46"; s = "#34d399"; }
      return [f, s];
    } else {
      const mPal = [
        ["#854d0e", "#eab308"],
        ["#9a3412", "#fb923c"],
        ["#c2410c", "#fdba74"],
        ["#b91c1c", "#f87171"],
        ["#be123c", "#fb7185"]
      ];
      const idx = Math.min(Math.max(0, depth - 1), mPal.length - 1);
      let [f, s] = mPal[idx];
      if (depth === 2 && sDeg < 45) { f = "#991b1b"; s = "#f87171"; }
      return [f, s];
    }
  }

  // ==========================================
  // --- LINEAGE PATH FINDING & GENETIC TRACING ---
  // ==========================================
  async getPatrilinealPath(rootKey) {
    const path = new Set();
    let current = await this.dataProvider.getNode(rootKey);
    while (current) {
      const key = current.file_path || current.path || current.key || current.name;
      if (key) path.add(key);
      if (current.displayName) path.add(current.displayName);
      if (current.name) path.add(current.name);
      
      const parents = await this.dataProvider.getParents(current);
      let father = null;
      for (const pKey of parents) {
        const pNode = await this.dataProvider.getNode(pKey);
        if (pNode) {
          const g = GenealogyGraphEngine.normalizeGender(pNode.sex || pNode.gender);
          if (g === "M" || !father) {
            father = pNode;
            if (g === "M") break;
          }
        }
      }
      current = father;
    }
    return path;
  }

  async getMatrilinealPath(rootKey) {
    const path = new Set();
    let current = await this.dataProvider.getNode(rootKey);
    while (current) {
      const key = current.file_path || current.path || current.key || current.name;
      if (key) path.add(key);
      if (current.displayName) path.add(current.displayName);
      if (current.name) path.add(current.name);
      
      const parents = await this.dataProvider.getParents(current);
      let mother = null;
      for (const pKey of parents) {
        const pNode = await this.dataProvider.getNode(pKey);
        if (pNode) {
          const g = GenealogyGraphEngine.normalizeGender(pNode.sex || pNode.gender);
          if (g === "F" || !mother) {
            mother = pNode;
            if (g === "F") break;
          }
        }
      }
      current = mother;
    }
    return path;
  }

  async findAncestralPath(rootKey, targetKey) {
    const cleanTarget = String(targetKey || "").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim().toLowerCase();
    if (!cleanTarget) return new Set();
    const targetNode = await this.dataProvider.getNode(cleanTarget);
    const targetId = targetNode ? (targetNode.file_path || targetNode.path || targetNode.key || targetNode.name) : null;
    const pathSet = new Set();

    const queue = [[rootKey, [rootKey]]];
    const visited = new Set([rootKey]);

    while (queue.length > 0) {
      const [currKey, currPath] = queue.shift();
      const currNode = await this.dataProvider.getNode(currKey);
      if (!currNode) continue;

      const currId = currNode.file_path || currNode.path || currNode.key || currNode.name;
      const currName = currNode.name || currNode.displayName || "";

      if ((targetId && currId === targetId) || String(currId).toLowerCase().includes(cleanTarget) || currName.toLowerCase().includes(cleanTarget)) {
        for (const k of currPath) {
          pathSet.add(k);
          const n = await this.dataProvider.getNode(k);
          if (n) {
            if (n.file_path) pathSet.add(n.file_path);
            if (n.displayName) pathSet.add(n.displayName);
            if (n.name) pathSet.add(n.name);
          }
        }
        return pathSet;
      }

      const relatives = [
        ...(await this.dataProvider.getParents(currNode)),
        ...(await this.dataProvider.getChildren(currNode))
      ];

      for (const rKey of relatives) {
        if (!visited.has(rKey)) {
          visited.add(rKey);
          queue.push([rKey, [...currPath, rKey]]);
        }
      }
    }
    return pathSet;
  }

  async getPredicatePaths(rootKey, predicateFn) {
    const pathSet = new Set();
    const rootNode = await this.dataProvider.getNode(rootKey);
    if (!rootNode) return pathSet;

    const checkTree = async (node, currentPath, depth) => {
      if (!node || depth > 5) return;
      const nKey = node.file_path || node.path || node.key || node.name;
      const newPath = [...currentPath, nKey];

      if (predicateFn(node)) {
        for (const k of newPath) {
          pathSet.add(k);
          const n = await this.dataProvider.getNode(k);
          if (n) {
            if (n.file_path) pathSet.add(n.file_path);
            if (n.displayName) pathSet.add(n.displayName);
            if (n.name) pathSet.add(n.name);
          }
        }
      }

      const parents = await this.dataProvider.getParents(node);
      for (const pKey of parents) {
        const pNode = await this.dataProvider.getNode(pKey);
        if (pNode) await checkTree(pNode, newPath, depth + 1);
      }
    };

    await checkTree(rootNode, [], 0);
    return pathSet;
  }

  async resolveHighlightSet(rootKey, highlightOption) {
    if (!highlightOption) return null;
    const h = String(highlightOption).trim().toLowerCase();
    if (h === "none" || h === "false" || h === "null" || h === "") return null;

    if (h === "patrilineal" || h === "ydna" || h === "y-dna" || h === "paternal") {
      return await this.getPatrilinealPath(rootKey);
    }
    if (h === "matrilineal" || h === "mtdna" || h === "mt-dna" || h === "maternal") {
      return await this.getMatrilinealPath(rootKey);
    }
    if (h.includes(":")) {
      const [field, val] = h.split(":").map(s => s.trim());
      return await this.getPredicatePaths(rootKey, (node) => {
        if (field === "citizenship_anchor") return node.citizenship_anchor === true || String(node.citizenship_anchor) === val;
        if (field === "birth_place") return String(node.birth_place || "").toLowerCase().includes(val);
        if (field === "tag") return (node.tags || []).some(t => String(t).toLowerCase().includes(val));
        return String(node[field] || "").toLowerCase() === val;
      });
    }
  }

  async buildPedigreeTree(rootKey, userOptions = {}) {
    const opts = { ...this.options, ...userOptions };
    const depthUp = parseInt(opts.depthUp ?? opts.depth ?? 2, 10);
    const depthDown = parseInt(opts.depthDown ?? opts.depth ?? 2, 10);

    const rootNode = await this.dataProvider.getNode(rootKey);
    if (!rootNode) return { error: `Node not found: ${rootKey}` };

    const resolveAncestors = async (node, currentDepth) => {
      if (!node || currentDepth > depthUp) return null;
      
      const enriched = {
        ...node,
        displayName: GenealogyGraphEngine.getDisplayName(node),
        dates: GenealogyGraphEngine.formatVitalDates(node.birth_date, node.death_date),
        flags: GenealogyGraphEngine.getCitizenshipFlags(node),
        gender: GenealogyGraphEngine.normalizeGender(node.sex || node.gender),
        deceased: GenealogyGraphEngine.isDeceased(node)
      };

      if (currentDepth < depthUp) {
        const parents = await this.dataProvider.getParents(node);
        if (parents.length > 0) {
          let fatherKey = null;
          let motherKey = null;
          const parentNodes = [];

          for (const pk of parents) {
            const pNode = await this.dataProvider.getNode(pk);
            if (pNode) parentNodes.push({ key: pk, node: pNode });
          }

          // 1. Precise Sex/Gender Assignment
          for (const item of parentNodes) {
            const g = GenealogyGraphEngine.normalizeGender(item.node.sex || item.node.gender);
            if (g === 'M' && !fatherKey) {
              fatherKey = item.key;
            } else if (g === 'F' && !motherKey) {
              motherKey = item.key;
            }
          }

          // 2. Unassigned Fallback
          for (const item of parentNodes) {
            if (item.key === fatherKey || item.key === motherKey) continue;
            if (!fatherKey) {
              fatherKey = item.key;
            } else if (!motherKey) {
              motherKey = item.key;
            }
          }

          enriched.father = fatherKey ? await resolveAncestors(await this.dataProvider.getNode(fatherKey), currentDepth + 1) : null;
          enriched.mother = motherKey ? await resolveAncestors(await this.dataProvider.getNode(motherKey), currentDepth + 1) : null;
        }
      }
      return enriched;
    };

    const resolveDescendants = async (node, currentDepth) => {
      if (!node || currentDepth > depthDown) return [];
      const childrenKeys = await this.dataProvider.getChildren(node);
      const childObjects = [];

      for (const ck of childrenKeys) {
        const cNode = await this.dataProvider.getNode(ck);
        if (cNode) {
          const enrichedChild = {
            ...cNode,
            displayName: GenealogyGraphEngine.getDisplayName(cNode),
            dates: GenealogyGraphEngine.formatVitalDates(cNode.birth_date, cNode.death_date),
            flags: GenealogyGraphEngine.getCitizenshipFlags(cNode),
            gender: GenealogyGraphEngine.normalizeGender(cNode.sex || cNode.gender),
            deceased: GenealogyGraphEngine.isDeceased(cNode),
            children: await resolveDescendants(cNode, currentDepth + 1)
          };
          childObjects.push(enrichedChild);
        }
      }
      return childObjects;
    };

    const ancestorTree = await resolveAncestors(rootNode, 0);
    const descendants = await resolveDescendants(rootNode, 1);
    const spouseKeys = await this.dataProvider.getSpouses(rootNode);
    let spouses = [];
    for (const sk of spouseKeys) {
      const sNode = await this.dataProvider.getNode(sk);
      if (sNode) {
        spouses.push({
          ...sNode,
          displayName: GenealogyGraphEngine.getDisplayName(sNode),
          dates: GenealogyGraphEngine.formatVitalDates(sNode.birth_date, sNode.death_date),
          flags: GenealogyGraphEngine.getCitizenshipFlags(sNode),
          birthYear: GenealogyGraphEngine.extractYear(sNode.birth_date) || 9999
        });
      }
    }
    spouses.sort((a, b) => (parseInt(a.birthYear, 10) || 9999) - (parseInt(b.birthYear, 10) || 9999));

    return {
      rootKey,
      root: ancestorTree,
      descendants,
      spouses,
      depthUp,
      depthDown
    };
  }  /**
   * 2. Build Dual-Hemisphere Radial Fan Chart SVG (Curved textPath + Multi-Gen + Presets + Tracing)
   */
  async buildFanChartSvg(rootKey, userOptions = {}) {
    const pedigreeData = await this.buildPedigreeTree(rootKey, userOptions);
    if (!pedigreeData.root) return `<svg viewBox="0 0 400 200" style="width:100%;height:auto;"><text x="50%" y="50%" text-anchor="middle" fill="#888">No data found</text></svg>`;

    // Print & Aspect Preset Sizing
    const preset = String(userOptions.printPreset || userOptions.print || "letter").toLowerCase();
    let width = 840;
    let height = 720;
    let rMax = 330;

    if (preset === "tabloid" || preset === "a3") {
      width = 1200;
      height = 960;
      rMax = 450;
    } else if (preset === "poster" || preset === "a2" || preset === "a1") {
      width = 1600;
      height = 1280;
      rMax = 620;
    }

    const cx = width / 2;
    const cy = height / 2;
    const depthUp = pedigreeData.depthUp || 2;
    const depthDown = pedigreeData.depthDown || 2;
    const widgetUid = "ft_" + Math.random().toString(36).substring(2, 9);
    const palette = userOptions.palette || userOptions.theme || "classic";

    // Layer Visibility Flags
    const showNames = userOptions.showNames !== false && userOptions.names !== false;
    const showDates = userOptions.showDates !== false && userOptions.dates !== false;
    const showFlags = userOptions.showFlags !== false && userOptions.flags !== false;

    // Resolve Lineage Path Highlight Set
    const highlightSet = await this.resolveHighlightSet(rootKey, userOptions.highlight);

    let defs = `  <defs>
` +
               `    <filter id="fan-shadow-${widgetUid}" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.35"/></filter>
` +
               `    <filter id="fan-glow-${widgetUid}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#fbbf24" flood-opacity="0.85"/></filter>
` +
               `  </defs>
`;
    let elements = "";

    // Hemisphere Section Headings
    elements += `  <text x="${cx}" y="28" text-anchor="middle" fill="#60a5fa" font-size="11.5" font-weight="700" letter-spacing="1.2">⬆️ ANCESTORS (${depthUp} GENERATIONS UP)</text>
`;
    elements += `  <text x="${cx}" y="${height - 14}" text-anchor="middle" fill="#34d399" font-size="11.5" font-weight="700" letter-spacing="1.2">⬇️ DESCENDANTS (${depthDown} GENERATIONS DOWN)</text>
`;

    let pathIdx = 0;

    // Helper: Draw Arc Segment with Dual Concentric Curved Text Along the Arc
    function drawArcSlice(rInner, rOuter, startDeg, endDeg, fillColor, strokeColor, nameText, subText = "", role = "", link = "#", nodeRef = null) {
      pathIdx++;
      const pidName = `tp_n_${widgetUid}_${pathIdx}`;
      const pidSub = `tp_s_${widgetUid}_${pathIdx}`;

      const sRad = (startDeg * Math.PI) / 180;
      const eRad = (endDeg * Math.PI) / 180;

      // Arc Polygon Coordinates
      const x1 = cx + rOuter * Math.cos(sRad);
      const y1 = cy - rOuter * Math.sin(sRad);
      const x2 = cx + rOuter * Math.cos(eRad);
      const y2 = cy - rOuter * Math.sin(eRad);
      const x3 = cx + rInner * Math.cos(eRad);
      const y3 = cy - rInner * Math.sin(eRad);
      const x4 = cx + rInner * Math.cos(sRad);
      const y4 = cy - rInner * Math.sin(sRad);

      const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
      const polyData = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} A ${rInner} ${rInner} 0 ${largeArc} 1 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;

      const isUpper = (startDeg + endDeg) / 2 <= 180;
      const rSpan = rOuter - rInner;
      const spanDeg = endDeg - startDeg;

      // Determine Path Highlight or Dimmed State
      let isHighlighted = false;
      let isDimmed = false;
      if (highlightSet) {
        if (nodeRef) {
          const nKey = nodeRef.file_path || nodeRef.path || nodeRef.key || nodeRef.name || "";
          const dName = nodeRef.displayName || "";
          if (highlightSet.has(nKey) || highlightSet.has(dName) || highlightSet.has(link)) {
            isHighlighted = true;
          } else {
            isDimmed = true;
          }
        }
      }

      const activeStroke = isHighlighted ? "#fbbf24" : strokeColor;
      const strokeW = isHighlighted ? "3.5" : "1.5";
      const filterAttr = isHighlighted ? `filter="url(#fan-glow-${widgetUid})"` : "";
      const pathStyle = isDimmed 
        ? `cursor: pointer; opacity: 0.22; filter: grayscale(60%); transition: all 0.25s ease;` 
        : `cursor: pointer; transition: opacity 0.15s;`;

      let curveMarkup = "";
      if (showNames && subText && showDates && rSpan >= 45 && spanDeg >= 35) {
        // Dual concentric curved arcs: Outer for name, inner for dates
        const rName = rInner + rSpan * 0.66;
        const rSub = rInner + rSpan * 0.30;

        if (isUpper) {
          const tx1 = cx + rName * Math.cos(eRad); const ty1 = cy - rName * Math.sin(eRad);
          const tx2 = cx + rName * Math.cos(sRad); const ty2 = cy - rName * Math.sin(sRad);
          const sx1 = cx + rSub * Math.cos(eRad); const sy1 = cy - rSub * Math.sin(eRad);
          const sx2 = cx + rSub * Math.cos(sRad); const sy2 = cy - rSub * Math.sin(sRad);
          defs += `    <path id="${pidName}" d="M ${tx1.toFixed(1)} ${ty1.toFixed(1)} A ${rName.toFixed(1)} ${rName.toFixed(1)} 0 ${largeArc} 1 ${tx2.toFixed(1)} ${ty2.toFixed(1)}" fill="none"/>
`;
          defs += `    <path id="${pidSub}" d="M ${sx1.toFixed(1)} ${sy1.toFixed(1)} A ${rSub.toFixed(1)} ${rSub.toFixed(1)} 0 ${largeArc} 1 ${sx2.toFixed(1)} ${sy2.toFixed(1)}" fill="none"/>
`;
        } else {
          const tx1 = cx + rName * Math.cos(sRad); const ty1 = cy - rName * Math.sin(sRad);
          const tx2 = cx + rName * Math.cos(eRad); const ty2 = cy - rName * Math.sin(eRad);
          const sx1 = cx + rSub * Math.cos(sRad); const sy1 = cy - rSub * Math.sin(sRad);
          const sx2 = cx + rSub * Math.cos(eRad); const sy2 = cy - rSub * Math.sin(eRad);
          defs += `    <path id="${pidName}" d="M ${tx1.toFixed(1)} ${ty1.toFixed(1)} A ${rName.toFixed(1)} ${rName.toFixed(1)} 0 ${largeArc} 0 ${tx2.toFixed(1)} ${ty2.toFixed(1)}" fill="none"/>
`;
          defs += `    <path id="${pidSub}" d="M ${sx1.toFixed(1)} ${sy1.toFixed(1)} A ${rSub.toFixed(1)} ${rSub.toFixed(1)} 0 ${largeArc} 0 ${sx2.toFixed(1)} ${sy2.toFixed(1)}" fill="none"/>
`;
        }

        const nameFsize = spanDeg < 45 ? "9" : "10.5";
        const subFsize = spanDeg < 45 ? "7.5" : "8.5";
        curveMarkup = `    <text fill="#ffffff" font-size="${nameFsize}" font-weight="600" font-family="Inter, sans-serif"><textPath href="#${pidName}" startOffset="50%" text-anchor="middle">${GenealogyGraphEngine.escapeText(nameText)}</textPath></text>
` +
                      `    <text fill="#fed7aa" font-size="${subFsize}" font-family="Inter, sans-serif"><textPath href="#${pidSub}" startOffset="50%" text-anchor="middle">${GenealogyGraphEngine.escapeText(subText)}</textPath></text>
`;
      } else {
        // Single curved arc along midline
        const rMid = (rInner + rOuter) / 2;
        if (isUpper) {
          const tx1 = cx + rMid * Math.cos(eRad); const ty1 = cy - rMid * Math.sin(eRad);
          const tx2 = cx + rMid * Math.cos(sRad); const ty2 = cy - rMid * Math.sin(sRad);
          defs += `    <path id="${pidName}" d="M ${tx1.toFixed(1)} ${ty1.toFixed(1)} A ${rMid.toFixed(1)} ${rMid.toFixed(1)} 0 ${largeArc} 1 ${tx2.toFixed(1)} ${ty2.toFixed(1)}" fill="none"/>
`;
        } else {
          const tx1 = cx + rMid * Math.cos(sRad); const ty1 = cy - rMid * Math.sin(sRad);
          const tx2 = cx + rMid * Math.cos(eRad); const ty2 = cy - rMid * Math.sin(eRad);
          defs += `    <path id="${pidName}" d="M ${tx1.toFixed(1)} ${ty1.toFixed(1)} A ${rMid.toFixed(1)} ${rMid.toFixed(1)} 0 ${largeArc} 0 ${tx2.toFixed(1)} ${ty2.toFixed(1)}" fill="none"/>
`;
        }
        let fullLabel = "";
        if (showNames && showDates) {
          fullLabel = [nameText, subText].filter(Boolean).join(" ");
        } else if (showNames) {
          fullLabel = nameText;
        } else if (showDates) {
          fullLabel = subText;
        }
        let fSize = "9.5";
        if (spanDeg < 15) {
          fullLabel = showNames ? nameText.split(" ")[0] : "";
          fSize = "7.5";
        } else if (spanDeg < 25) {
          fSize = "8.5";
        } else if (rSpan >= 60) {
          fSize = "10.5";
        }
        if (fullLabel) {
          curveMarkup = `    <text fill="#ffffff" font-size="${fSize}" font-weight="600" font-family="Inter, sans-serif"><textPath href="#${pidName}" startOffset="50%" text-anchor="middle">${GenealogyGraphEngine.escapeText(fullLabel)}</textPath></text>
`;
        }
      }

      const href = link || "#";
      const clsName = isHighlighted ? "fan-slice path-active" : (isDimmed ? "fan-slice path-dimmed" : "fan-slice");
      return `  <a href="${href}" class="${clsName}" data-role="${GenealogyGraphEngine.escapeText(role)}" data-name="${GenealogyGraphEngine.escapeText(nameText)}" data-dates="${GenealogyGraphEngine.escapeText(subText)}" onmousemove="showFtTooltip(event, this)" onmouseleave="hideFtTooltip(this)">
` +
             `    <path d="${polyData}" fill="${fillColor}" stroke="${activeStroke}" stroke-width="${strokeW}" ${filterAttr} style="${pathStyle}" onmouseover="if(!this.closest('.path-dimmed'))this.style.opacity=0.85" onmouseout="if(!this.closest('.path-dimmed'))this.style.opacity=1"/>
` +
             curveMarkup +
             `  </a>
`;
    }

    // Center Subject Hub (Circle)
    const rootFanName = GenealogyGraphEngine.formatFanName(pedigreeData.root.displayName);
    const rootDates = showDates ? (pedigreeData.root.dates || "") : "";
    const rootFlags = showFlags ? (pedigreeData.root.flags || "") : "";
    const rootLink = pedigreeData.root.file_path || "#";

    elements += `  <!-- Center Hub: Subject & Spouses -->
`;
    elements += `  <circle cx="${cx}" cy="${cy}" r="75" fill="#f97316" stroke="#ea580c" stroke-width="2.5" filter="url(#fan-shadow-${widgetUid})"/>
`;

    if (!pedigreeData.spouses || pedigreeData.spouses.length === 0) {
      elements += `  <a href="${rootLink}" class="fan-center-link" data-role="Subject" data-name="${GenealogyGraphEngine.escapeText(rootFanName)}" data-dates="${GenealogyGraphEngine.escapeText(rootDates)}" data-flags="${GenealogyGraphEngine.escapeText(rootFlags)}" onmousemove="showFtTooltip(event, this)" onmouseleave="hideFtTooltip(this)">
`;
      elements += `    <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="700">⭐ ${GenealogyGraphEngine.escapeText(rootFanName)}</text>
`;
      elements += `    <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="#fed7aa" font-size="10.5">${GenealogyGraphEngine.escapeText(rootDates)} ${rootFlags}</text>
`;
      elements += `  </a>
`;
    } else if (pedigreeData.spouses.length === 1) {
      const sp = pedigreeData.spouses[0];
      const sLink = sp.file_path || sp.path || sp.name || "#";
      const sName = GenealogyGraphEngine.formatFanName(sp.displayName, false);
      const sDates = showDates ? (sp.dates || "") : "";
      const sFlags = showFlags ? (sp.flags || "") : "";

      elements += `  <a href="${rootLink}" class="fan-center-link" data-role="Subject" data-name="${GenealogyGraphEngine.escapeText(rootFanName)}" data-dates="${GenealogyGraphEngine.escapeText(rootDates)}" data-flags="${GenealogyGraphEngine.escapeText(rootFlags)}" onmousemove="showFtTooltip(event, this)" onmouseleave="hideFtTooltip(this)">
`;
      elements += `    <text x="${cx}" y="${cy - 20}" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="700">⭐ ${GenealogyGraphEngine.escapeText(rootFanName)}</text>
`;
      elements += `    <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#fed7aa" font-size="9.5">${GenealogyGraphEngine.escapeText(rootDates)} ${rootFlags}</text>
`;
      elements += `  </a>
`;

      elements += `  <a href="${sLink}" class="fan-center-link fan-spouse-badge" data-role="Spouse" data-name="${GenealogyGraphEngine.escapeText(sName)}" data-dates="${GenealogyGraphEngine.escapeText(sDates)}" data-flags="${GenealogyGraphEngine.escapeText(sFlags)}" onmousemove="showFtTooltip(event, this)" onmouseleave="hideFtTooltip(this)">
`;
      elements += `    <rect x="${cx - 64}" y="${cy + 10}" width="128" height="28" rx="14" fill="#7c2d12" stroke="#fdba74" stroke-width="1.2" opacity="0.95"/>
`;
      elements += `    <text x="${cx}" y="${cy + 28}" text-anchor="middle" fill="#ffedd5" font-size="9.5" font-weight="600">💑 ${GenealogyGraphEngine.escapeText(sName)} ${sFlags}</text>
`;
      elements += `  </a>
`;
    } else {
      elements += `  <a href="${rootLink}" class="fan-center-link" data-role="Subject" data-name="${GenealogyGraphEngine.escapeText(rootFanName)}" data-dates="${GenealogyGraphEngine.escapeText(rootDates)}" data-flags="${GenealogyGraphEngine.escapeText(rootFlags)}" onmousemove="showFtTooltip(event, this)" onmouseleave="hideFtTooltip(this)">
`;
      elements += `    <text x="${cx}" y="${cy - 28}" text-anchor="middle" fill="#ffffff" font-size="11.5" font-weight="700">⭐ ${GenealogyGraphEngine.escapeText(rootFanName)}</text>
`;
      elements += `    <text x="${cx}" y="${cy - 14}" text-anchor="middle" fill="#fed7aa" font-size="9">${GenealogyGraphEngine.escapeText(rootDates)} ${rootFlags}</text>
`;
      elements += `  </a>
`;

      const sp1 = pedigreeData.spouses[0];
      const s1Link = sp1.file_path || sp1.path || sp1.name || "#";
      const s1Name = GenealogyGraphEngine.formatFanName(sp1.displayName, false);
      const s1Dates = showDates ? (sp1.dates || "") : "";
      const s1Flags = showFlags ? (sp1.flags || "") : "";

      const sp2 = pedigreeData.spouses[1];
      const s2Link = sp2.file_path || sp2.path || sp2.name || "#";
      const s2Name = GenealogyGraphEngine.formatFanName(sp2.displayName, false);
      const s2Dates = showDates ? (sp2.dates || "") : "";
      const s2Flags = showFlags ? (sp2.flags || "") : "";

      elements += `  <a href="${s1Link}" class="fan-center-link fan-spouse-badge" data-role="Spouse 1" data-name="${GenealogyGraphEngine.escapeText(s1Name)}" data-dates="${GenealogyGraphEngine.escapeText(s1Dates)}" data-flags="${GenealogyGraphEngine.escapeText(s1Flags)}" onmousemove="showFtTooltip(event, this)" onmouseleave="hideFtTooltip(this)">
`;
      elements += `    <rect x="${cx - 64}" y="${cy + 2}" width="128" height="22" rx="11" fill="#7c2d12" stroke="#fdba74" stroke-width="1"/>
`;
      elements += `    <text x="${cx}" y="${cy + 17}" text-anchor="middle" fill="#ffedd5" font-size="8.5" font-weight="600">💑 1. ${GenealogyGraphEngine.escapeText(s1Name)}</text>
`;
      elements += `  </a>
`;

      elements += `  <a href="${s2Link}" class="fan-center-link fan-spouse-badge" data-role="Spouse 2" data-name="${GenealogyGraphEngine.escapeText(s2Name)}" data-dates="${GenealogyGraphEngine.escapeText(s2Dates)}" data-flags="${GenealogyGraphEngine.escapeText(s2Flags)}" onmousemove="showFtTooltip(event, this)" onmouseleave="hideFtTooltip(this)">
`;
      elements += `    <rect x="${cx - 64}" y="${cy + 28}" width="128" height="22" rx="11" fill="#7c2d12" stroke="#fdba74" stroke-width="1"/>
`;
      elements += `    <text x="${cx}" y="${cy + 43}" text-anchor="middle" fill="#ffedd5" font-size="8.5" font-weight="600">💑 2. ${GenealogyGraphEngine.escapeText(s2Name)}</text>
`;
      elements += `  </a>
`;
    }

    // ==========================================
    // --- UPPER HEMISPHERE: ANCESTORS (0° to 180°) ---
    // ==========================================
    const rStart = 80;
    const dRUp = (rMax - rStart) / Math.max(1, depthUp);
    const dRDown = (rMax - rStart) / Math.max(1, depthDown);

    const drawAncestorNode = (node, depth, sDeg, eDeg, isPaternal, rolePrefix = "") => {
      if (!node || depth > depthUp) return;

      const rInner = rStart + (depth - 1) * dRUp + 4;
      const rOuter = rStart + depth * dRUp;

      const [fill, stroke] = GenealogyGraphEngine.getPaletteColors(palette, isPaternal, depth, sDeg);
      const name = GenealogyGraphEngine.formatFanName(node.displayName, false);
      const sub = [
        showDates ? node.dates : "",
        showFlags ? node.flags : ""
      ].filter(Boolean).join(" ");

      elements += drawArcSlice(rInner, rOuter, sDeg, eDeg, fill, stroke, name, sub, rolePrefix, node.file_path, node);

      const midDeg = (sDeg + eDeg) / 2;
      if (node.father && depth < depthUp) {
        drawAncestorNode(node.father, depth + 1, midDeg, eDeg, isPaternal, `${rolePrefix ? rolePrefix + " " : ""}Father`);
      }
      if (node.mother && depth < depthUp) {
        drawAncestorNode(node.mother, depth + 1, sDeg, midDeg, isPaternal, `${rolePrefix ? rolePrefix + " " : ""}Mother`);
      }
    };

    if (pedigreeData.root.father) {
      drawAncestorNode(pedigreeData.root.father, 1, 90, 180, true, "Father");
    }
    if (pedigreeData.root.mother) {
      drawAncestorNode(pedigreeData.root.mother, 1, 0, 90, false, "Mother");
    }

    // ==========================================
    // --- LOWER HEMISPHERE: DESCENDANTS (180° to 360°) ---
    // ==========================================
    const descendants = pedigreeData.descendants || [];

    const drawDescendantsRecursive = (childrenList, depth, sDeg, eDeg) => {
      if (!childrenList || childrenList.length === 0 || depth > depthDown) return;

      const rInner = rStart + (depth - 1) * dRDown + 4;
      const rOuter = rStart + depth * dRDown;
      const totalSpan = eDeg - sDeg;
      const stepDeg = totalSpan / childrenList.length;

      const dPalette = [
        ["#047857", "#34d399"], ["#6d28d9", "#a78bfa"], ["#0369a1", "#38bdf8"],
        ["#b45309", "#fbbf24"], ["#be123c", "#fb7185"], ["#0f766e", "#2dd4bf"]
      ];

      for (let i = 0; i < childrenList.length; i++) {
        const child = childrenList[i];
        const childSDeg = sDeg + i * stepDeg;
        const childEDeg = childSDeg + stepDeg;
        const [fill, stroke] = dPalette[i % dPalette.length];
        const cName = GenealogyGraphEngine.formatFanName(child.displayName, true);
        const cSub = [
          showDates ? child.dates : "",
          showFlags ? child.flags : ""
        ].filter(Boolean).join(" ");
        const role = depth === 1 ? "Child" : (depth === 2 ? "Grandchild" : `Great-Grandchild (Gen ${depth})`);

        elements += drawArcSlice(rInner, rOuter, childSDeg, childEDeg, fill, stroke, cName, cSub, role, child.file_path, child);

        if (child.children && child.children.length > 0 && depth < depthDown) {
          drawDescendantsRecursive(child.children, depth + 1, childSDeg, childEDeg);
        }
      }
    };

    if (descendants.length > 0) {
      drawDescendantsRecursive(descendants, 1, 180.0, 360.0);
    } else {
      elements += `  <path d="M ${cx - rStart} ${cy} A ${rStart} ${rStart} 0 0 0 ${cx + rStart} ${cy} L ${cx + 180} ${cy} A 180 180 0 0 1 ${cx - 180} ${cy} Z" fill="#161b22" stroke="#30363d" stroke-width="1.5" stroke-dasharray="4 4"/>
`;
      elements += `  <text x="${cx}" y="${cy + 135}" text-anchor="middle" fill="#8b949e" font-size="11" font-style="italic">🌱 No direct descendants registered in current branch</text>
`;
    }

    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="width: 100%; max-width: 100%; height: auto; display: block; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif;">
${defs}${elements}</svg>`;
  }


  /**
   * 3. Construct Mermaid Source Code (Hourglass with Flags & Compact Auto-Scaling)
   */
  async buildHourglassGraph(rootKey, userOptions = {}) {
    const opts = { ...this.options, ...userOptions };
    const depthUp = parseInt(opts.depthUp ?? opts.depth ?? opts.defaultDepthUp, 10);
    const depthDown = parseInt(opts.depthDown ?? opts.depth ?? opts.defaultDepthDown, 10);
    const includeSpouses = opts.includeSpouses !== false;
    const includeDates = opts.includeDates !== false;
    const direction = opts.direction === 'LR' ? 'LR' : 'TD';

    const cacheKey = `${rootKey}__u${depthUp}_d${depthDown}_sp${includeSpouses}_dt${includeDates}_dir${direction}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const rootNode = await this.dataProvider.getNode(rootKey);
    if (!rootNode) {
      return {
        error: `Could not resolve root individual for: ${rootKey}`,
        mermaid: `flowchart ${direction}\n  root["Individual not found: ${GenealogyGraphEngine.escapeText(rootKey)}"]\n`
      };
    }

    const nodesMap = new Map();
    const edgesSet = new Set();
    const edgeObjects = [];

    const rootId = GenealogyGraphEngine.sanitizeId(rootNode.key || rootKey);
    rootNode.sanitizedId = rootId;
    rootNode.isRoot = true;
    nodesMap.set(rootId, rootNode);

    // Upward Ancestor Traversal
    const ancestorQueue = [{ key: rootNode.key || rootKey, depth: 0, childId: rootId }];
    const visitedAncestors = new Set([rootNode.key || rootKey]);

    while (ancestorQueue.length > 0 && nodesMap.size < opts.maxNodes) {
      const { key, depth, childId } = ancestorQueue.shift();
      if (depth >= depthUp) continue;

      const currentNode = await this.dataProvider.getNode(key);
      if (!currentNode) continue;

      const parentKeys = await this.dataProvider.getParents(currentNode);
      for (const parentKey of parentKeys) {
        if (!parentKey) continue;
        const parentNode = await this.dataProvider.getNode(parentKey);
        if (!parentNode) continue;

        const parentId = GenealogyGraphEngine.sanitizeId(parentNode.key || parentKey);
        parentNode.sanitizedId = parentId;
        parentNode.generation = (parentNode.generation || 0) + (depth + 1);

        if (!nodesMap.has(parentId)) {
          nodesMap.set(parentId, parentNode);
        }

        const edgeKey = `${parentId} --> ${childId}`;
        if (!edgesSet.has(edgeKey)) {
          edgesSet.add(edgeKey);
          edgeObjects.push({ from: parentId, to: childId, type: 'parent_child' });
        }

        if (!visitedAncestors.has(parentNode.key || parentKey)) {
          visitedAncestors.add(parentNode.key || parentKey);
          ancestorQueue.push({
            key: parentNode.key || parentKey,
            depth: depth + 1,
            childId: parentId
          });
        }
      }
    }

    // Downward Descendant Traversal
    const descendantQueue = [{ key: rootNode.key || rootKey, depth: 0, parentId: rootId }];
    const visitedDescendants = new Set([rootNode.key || rootKey]);

    while (descendantQueue.length > 0 && nodesMap.size < opts.maxNodes) {
      const { key, depth, parentId } = descendantQueue.shift();
      if (depth >= depthDown) continue;

      const currentNode = await this.dataProvider.getNode(key);
      if (!currentNode) continue;

      const childKeys = await this.dataProvider.getChildren(currentNode);
      for (const childKey of childKeys) {
        if (!childKey) continue;
        const childNode = await this.dataProvider.getNode(childKey);
        if (!childNode) continue;

        const childId = GenealogyGraphEngine.sanitizeId(childNode.key || childKey);
        childNode.sanitizedId = childId;
        childNode.generation = (childNode.generation || 0) - (depth + 1);

        if (!nodesMap.has(childId)) {
          nodesMap.set(childId, childNode);
        }

        const edgeKey = `${parentId} --> ${childId}`;
        if (!edgesSet.has(edgeKey)) {
          edgesSet.add(edgeKey);
          edgeObjects.push({ from: parentId, to: childId, type: 'parent_child' });
        }

        if (!visitedDescendants.has(childNode.key || childKey)) {
          visitedDescendants.add(childNode.key || childKey);
          descendantQueue.push({
            key: childNode.key || childKey,
            depth: depth + 1,
            parentId: childId
          });
        }
      }
    }

    // Lateral Spouse Traversal
    if (includeSpouses) {
      const spouseKeys = await this.dataProvider.getSpouses(rootNode);
      for (const spKey of spouseKeys) {
        if (!spKey) continue;
        const spNode = await this.dataProvider.getNode(spKey);
        if (!spNode) continue;

        const spId = GenealogyGraphEngine.sanitizeId(spNode.key || spKey);
        spNode.sanitizedId = spId;
        spNode.isSpouse = true;

        if (!nodesMap.has(spId)) {
          nodesMap.set(spId, spNode);
        }

        const spouseEdgeKey = `${rootId} -.-|m.| ${spId}`;
        const reverseSpouseKey = `${spId} -.-|m.| ${rootId}`;
        if (!edgesSet.has(spouseEdgeKey) && !edgesSet.has(reverseSpouseKey)) {
          edgesSet.add(spouseEdgeKey);
          edgeObjects.push({ from: rootId, to: spId, type: 'marriage', label: 'm.' });
        }
      }
    }

    // Construct Mermaid Source Code
    const mermaidLines = [];
    mermaidLines.push(`%%{init: {'theme': 'base', 'flowchart': {'useMaxWidth': true, 'nodeSpacing': 25, 'rankSpacing': 30}, 'themeVariables': { 'lineColor': '#64748b', 'edgeLabelBackground':'#181b26', 'fontFamily': 'Inter, system-ui, sans-serif' }}}%%`);
    mermaidLines.push(`flowchart ${direction}`);

    mermaidLines.push(`  classDef activeNode fill:#f97316,stroke:#ea580c,stroke-width:3px,color:#ffffff;`);
    mermaidLines.push(`  classDef living fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#064e3b;`);
    mermaidLines.push(`  classDef deceased fill:#f8fafc,stroke:#64748b,stroke-width:2px,stroke-dasharray: 4 4,color:#1e293b;`);
    mermaidLines.push(`  classDef verified fill:#1e40af,stroke:#60a5fa,stroke-width:2.5px,color:#ffffff;`);
    mermaidLines.push(`  classDef spouseNode fill:#fdf4ff,stroke:#c084fc,stroke-width:2px,color:#581c87;`);
    mermaidLines.push(`  classDef nonBinary fill:#f5f3ff,stroke:#8b5cf6,stroke-width:2px,color:#4c1d95;`);

    for (const [id, node] of nodesMap.entries()) {
      const name = GenealogyGraphEngine.escapeText(GenealogyGraphEngine.getDisplayName(node));
      const dates = includeDates ? GenealogyGraphEngine.escapeText(GenealogyGraphEngine.formatVitalDates(node.birth_date, node.death_date)) : '';
      const flags = GenealogyGraphEngine.getCitizenshipFlags(node);
      const subLine = [dates, flags].filter(Boolean).join(' ');
      const safeLabel = subLine ? `${name}<br/>${subLine}` : name;
      const gender = GenealogyGraphEngine.normalizeGender(node.sex || node.gender);

      if (gender === 'M') {
        mermaidLines.push(`  ${id}["${safeLabel}"]`);
      } else if (gender === 'F') {
        mermaidLines.push(`  ${id}(["${safeLabel}"])`);
      } else {
        mermaidLines.push(`  ${id}{{"${safeLabel}"}}`);
      }
    }

    mermaidLines.push('');
    for (const edge of edgesSet) {
      mermaidLines.push(`  ${edge}`);
    }

    mermaidLines.push('');
    for (const [id, node] of nodesMap.entries()) {
      const gender = GenealogyGraphEngine.normalizeGender(node.sex || node.gender);
      if (node.isRoot) {
        mermaidLines.push(`  class ${id} activeNode;`);
      } else if (node.verification_tier === 'direct_ancestor' || node.citizenship_anchor === true) {
        mermaidLines.push(`  class ${id} verified;`);
      } else if (node.isSpouse) {
        mermaidLines.push(`  class ${id} spouseNode;`);
      } else if (gender === 'X') {
        mermaidLines.push(`  class ${id} nonBinary;`);
      } else if (GenealogyGraphEngine.isDeceased(node)) {
        mermaidLines.push(`  class ${id} deceased;`);
      } else {
        mermaidLines.push(`  class ${id} living;`);
      }
    }

    const result = {
      rootKey,
      totalNodes: nodesMap.size,
      totalEdges: edgesSet.size,
      depthUp,
      depthDown,
      nodes: Array.from(nodesMap.values()),
      edges: edgeObjects,
      mermaid: mermaidLines.join('\n')
    };

    this.cache.set(cacheKey, result);
    return result;
  }
}

// Data Providers
class ObsidianBasesProvider {
  constructor(app) {
    this.app = app;
  }

  extractLinks(value) {
    if (!value) return [];
    const rawList = Array.isArray(value) ? value : [value];
    const results = [];
    for (const item of rawList) {
      if (typeof item !== 'string') continue;
      const matches = item.matchAll(/\[\[(.*?)\]\]/g);
      let found = false;
      for (const m of matches) {
        found = true;
        const target = m[1].split('|')[0].trim();
        if (target) results.push(target);
      }
      if (!found && item.trim().length > 0) {
        results.push(item.trim());
      }
    }
    return results;
  }

  resolveFile(key) {
    if (!key) return null;
    const cleanKey = key.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
    const file = this.app.metadataCache.getFirstLinkpathDest(cleanKey, '');
    if (file) return file;

    const files = this.app.vault.getMarkdownFiles();
    const cleanLower = cleanKey.toLowerCase();
    
    // 1. Exact basename match
    const exactFile = files.find(f => f.basename.toLowerCase() === cleanLower);
    if (exactFile) return exactFile;

    // 2. Exact URN match
    const urnMatch = cleanKey.match(/URN-GEN-[A-Za-z0-9-]+/);
    if (urnMatch) {
      const urn = urnMatch[0];
      const urnFile = files.find(f => f.basename.includes(urn));
      if (urnFile) return urnFile;
    }

    // 3. Exact stem without URN match
    const cleanBase = cleanLower.split(' - urn-gen')[0].trim();
    return files.find(f => f.basename.toLowerCase().split(' - urn-gen')[0].trim() === cleanBase) || null;
  }

  async getNode(key) {
    if (!key) return null;
    const file = this.resolveFile(key);
    if (!file) {
      return {
        key,
        name: key.replace(/ - URN-GEN-.*$/, '').trim(),
        sex: 'U',
        is_living: true,
        parents: [],
        children: [],
        spouse: []
      };
    }

    const cache = this.app.metadataCache.getFileCache(file) || {};
    const fm = cache.frontmatter || {};

    return {
      key: file.basename,
      file_path: file.path,
      file_name: file.basename,
      name: fm.name || fm.gedcom_raw_name || file.basename.replace(/ - URN-GEN-.*$/, '').replace(/ \(\d{4}[^\)]*\)/, ''),
      id: fm.id || file.basename,
      sex: fm.sex || fm.gender || 'U',
      birth_date: fm.birth_date || null,
      death_date: fm.death_date || null,
      birth_place: fm.birth_place || null,
      death_place: fm.death_place || null,
      locations_lived: fm.locations_lived || null,
      is_living: fm.is_living,
      verification_tier: fm.verification_tier || null,
      citizenship_status: fm.citizenship_status || null,
      parents: this.extractLinks(fm.parents || []).concat(this.extractLinks(fm.father || [])).concat(this.extractLinks(fm.mother || [])),
      spouse: this.extractLinks(fm.spouse || fm.spouses || []),
      children: this.extractLinks(fm.children || [])
    };
  }

  async getParents(node) {
    return node?.parents || [];
  }

  async getChildren(node) {
    if (!node) return [];
    const direct = node.children || [];
    if (direct.length > 0) return direct;

    const resolved = [];
    const nodeUrn = (node.id || node.key || '').match(/URN-GEN-[A-Za-z0-9-]+/i)?.[0]?.toLowerCase();
    const nodeStem = (node.key || '').toLowerCase().trim();

    const files = this.app.vault.getMarkdownFiles();
    for (const f of files) {
      if (!f.path.startsWith('People/')) continue;
      const cache = this.app.metadataCache.getFileCache(f);
      const fm = cache?.frontmatter;
      if (!fm) continue;
      const parents = this.extractLinks(fm.parents || []).concat(this.extractLinks(fm.father || [])).concat(this.extractLinks(fm.mother || []));
      for (const p of parents) {
        const pUrn = p.match(/URN-GEN-[A-Za-z0-9-]+/i)?.[0]?.toLowerCase();
        const pClean = p.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim().toLowerCase();
        if ((nodeUrn && pUrn && nodeUrn === pUrn) ||
            (nodeStem && pClean === nodeStem)) {
          resolved.push(f.basename);
          break;
        }
      }
    }
    return resolved;
  }

  async getSpouses(node) {
    return node?.spouse || [];
  }
}

class WebJsonDataProvider {
  constructor(dagData) {
    this.dagData = dagData || {};
    this.indexByName = new Map();
    this.buildIndex();
  }

  buildIndex() {
    for (const [key, node] of Object.entries(this.dagData)) {
      this.indexByName.set(key.toLowerCase(), { key, ...node });
      if (node.name) {
        this.indexByName.set(node.name.toLowerCase().trim(), { key, ...node });
      }
      if (node.path) {
        this.indexByName.set(node.path.toLowerCase().trim(), { key, ...node });
      }
      if (node.id) {
        this.indexByName.set(String(node.id).toLowerCase().trim(), { key, ...node });
      }
    }
  }

  async getNode(key) {
    if (!key) return null;
    const cleanKey = String(key).replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim().toLowerCase();
    const found = this.indexByName.get(cleanKey);
    if (found) return found;

    // Exact URN match
    const urnMatch = cleanKey.match(/urn-gen-[a-z0-9-]+/);
    if (urnMatch) {
      const urn = urnMatch[0];
      for (const [k, node] of this.indexByName.entries()) {
        if (k.includes(urn) || (node.id && String(node.id).toLowerCase() === urn)) {
          return node;
        }
      }
    }

    // Exact base match without URN
    const cleanBase = cleanKey.split(' - urn-gen')[0].trim();
    for (const [k, node] of this.indexByName.entries()) {
      const kBase = k.split(' - urn-gen')[0].trim();
      if (kBase === cleanBase) {
        return node;
      }
    }
    return null;
  }

  async getParents(node) {
    return node?.parents || [];
  }

  async getChildren(node) {
    return node?.children || [];
  }

  async getSpouses(node) {
    return node?.spouse || [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GenealogyGraphEngine,
    ObsidianBasesProvider,
    WebJsonDataProvider
  };
}

if (typeof window !== 'undefined') {
  window.GenealogyGraphEngine = GenealogyGraphEngine;
  window.ObsidianBasesProvider = ObsidianBasesProvider;
  window.WebJsonDataProvider = WebJsonDataProvider;
}


const DEFAULT_SETTINGS = {
  defaultDepth: 2,
  defaultView: 'fan',
  defaultPalette: 'classic',
  defaultHighlight: 'none',
  showSpouses: true,
  showDates: true
};

module.exports = class FamilyTreePlugin extends Plugin {
  async onload() {
    console.log("🌳 Loading Family Tree Graph Plugin (Bases & Gramps Native)");
    await this.loadSettings();
    this.addSettingTab(new FamilyTreeSettingTab(this.app, this));

    this.dataProvider = new ObsidianBasesProvider(this.app);
    this.engine = new GenealogyGraphEngine(this.dataProvider);

    this.registerMarkdownCodeBlockProcessor("family-tree", (source, el, ctx) => {
      this.renderFamilyTree(source, el, ctx);
    });

    this.registerMarkdownCodeBlockProcessor("genealogy-tree", (source, el, ctx) => {
      this.renderFamilyTree(source, el, ctx);
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  parseOptions(source, ctx) {
    let opts = {};
    try {
      opts = parseYaml(source) || {};
    } catch (e) {
      source.split("\n").forEach(line => {
        const idx = line.indexOf(":");
        if (idx !== -1) {
          const k = line.substring(0, idx).trim();
          const v = line.substring(idx + 1).trim();
          if (v === "true") opts[k] = true;
          else if (v === "false") opts[k] = false;
          else if (!isNaN(v)) opts[k] = Number(v);
          else opts[k] = v;
        }
      });
    }

    if (!opts.root) {
      const activeFile = this.app.workspace.getActiveFile();
      opts.root = activeFile ? activeFile.basename : (ctx.sourcePath ? ctx.sourcePath.split("/").pop().replace(/\.md$/, "") : null);
    }
    return opts;
  }

  async renderFamilyTree(source, containerEl, ctx) {
    containerEl.empty();
    const wrapper = containerEl.createDiv({ cls: "family-tree-container" });

    let initialOpts = this.parseOptions(source, ctx);
    const originalRoot = initialOpts.root;
    let historyStack = [];

    const defaultDepth = (this.settings && this.settings.defaultDepth) || 2;
    const defaultView = (this.settings && this.settings.defaultView) || "fan";
    const defaultPalette = (this.settings && this.settings.defaultPalette) || "classic";
    const defaultHighlight = (this.settings && this.settings.defaultHighlight) || "none";
    const defaultSpouses = this.settings ? this.settings.showSpouses : true;
    const defaultDates = this.settings ? this.settings.showDates : true;

    let currentOpts = {
      root: initialOpts.root,
      depth: initialOpts.depth ?? defaultDepth,
      viewMode: initialOpts.view ?? initialOpts.mode ?? defaultView,
      includeSpouses: initialOpts.spouses !== undefined ? (initialOpts.spouses !== false) : defaultSpouses,
      includeDates: initialOpts.dates !== undefined ? (initialOpts.dates !== false) : defaultDates,
      includeFlags: initialOpts.flags !== false,
      includeNames: initialOpts.names !== false,
      direction: initialOpts.direction ?? "TD",
      highlight: initialOpts.highlight || defaultHighlight,
      palette: initialOpts.palette || initialOpts.theme || defaultPalette,
      printPreset: initialOpts.print || initialOpts.printPreset || "letter",
      zoom: 1.0,
      isExpanded: false
    };

    if (!currentOpts.root) {
      wrapper.createEl("div", { text: "⚠️ No root individual found for genealogy graph.", cls: "family-tree-error" });
      return;
    }

    // 1. Render Toolbar
    const toolbar = wrapper.createDiv({ cls: "family-tree-toolbar" });
    const titleArea = toolbar.createDiv({ cls: "family-tree-title" });
    titleArea.innerHTML = `<span>🌳</span> <span>Family Tree</span>`;

    // Breadcrumb container for In-Place Re-Centering navigation
    const breadcrumbArea = toolbar.createDiv({ cls: "family-tree-breadcrumb-area" });

    const controls = toolbar.createDiv({ cls: "family-tree-controls" });

    // Group 1: Mode Selector Segmented Group
    const modeGroup = controls.createDiv({ cls: "family-tree-btn-group" });
    const fanBtn = modeGroup.createEl("button", {
      cls: `family-tree-pill-btn ${currentOpts.viewMode === "fan" ? "active" : ""}`,
      text: "🪭 Fan"
    });
    const pedigreeBtn = modeGroup.createEl("button", {
      cls: `family-tree-pill-btn ${currentOpts.viewMode === "pedigree" ? "active" : ""}`,
      text: "📊 Compact"
    });
    const flowBtn = modeGroup.createEl("button", {
      cls: `family-tree-pill-btn ${currentOpts.viewMode === "hourglass" ? "active" : ""}`,
      text: "🔀 Flow"
    });

    // Group 2: Generation Depth Stepper
    const depthGroup = controls.createDiv({ cls: "family-tree-btn-group" });
    const decBtn = depthGroup.createEl("button", { cls: "family-tree-stepper-btn", text: "−", title: "Fewer Generations" });
    const depthBadge = depthGroup.createEl("span", { cls: "family-tree-depth-badge", text: `${currentOpts.depth} Gen` });
    const incBtn = depthGroup.createEl("button", { cls: "family-tree-stepper-btn", text: "+", title: "More Generations" });

    // Group 3: Trace / Highlight Selector
    const traceSelect = controls.createEl("select", { cls: "family-tree-select", title: "Lineage Path & Genetic Tracing" });
    const traceOpts = [
      { val: "none", label: "✨ Trace: None" },
      { val: "patrilineal", label: "🧬 Patrilineal (Y-DNA)" },
      { val: "matrilineal", label: "🧬 Matrilineal (mtDNA)" },
      { val: "citizenship_anchor:true", label: "🏛️ Citizenship Anchor" }
    ];
    traceOpts.forEach(o => {
      const optEl = traceSelect.createEl("option", { value: o.val, text: o.label });
      if (currentOpts.highlight === o.val) optEl.selected = true;
    });

    // Group 4: Palette / Theme Selector
    const paletteSelect = controls.createEl("select", { cls: "family-tree-select", title: "Colorblind & Accessible Palettes" });
    const palOpts = [
      { val: "classic", label: "🎨 Classic Modern" },
      { val: "viridis", label: "🧬 Viridis (Colorblind-Safe)" },
      { val: "contrast", label: "👁️ High Contrast (Tol)" },
      { val: "monochrome", label: "📜 Archival Mono" }
    ];
    palOpts.forEach(p => {
      const optEl = paletteSelect.createEl("option", { value: p.val, text: p.label });
      if (currentOpts.palette === p.val) optEl.selected = true;
    });

    // Group 5: Print / Export Preset Selector
    const printSelect = controls.createEl("select", { cls: "family-tree-select", title: "Archival Print / Dimension Preset" });
    const printOpts = [
      { val: "letter", label: "📄 Letter / A4" },
      { val: "tabloid", label: "📜 Tabloid / A3" },
      { val: "poster", label: "🏛️ Poster / A2" }
    ];
    printOpts.forEach(p => {
      const optEl = printSelect.createEl("option", { value: p.val, text: p.label });
      if (currentOpts.printPreset === p.val) optEl.selected = true;
    });

    // Group 6: Zoom & Expand Group
    const zoomGroup = controls.createDiv({ cls: "family-tree-btn-group" });
    const zoomOutBtn = zoomGroup.createEl("button", { cls: "family-tree-zoom-btn", text: "🔍−", title: "Zoom Out" });
    const zoomBadge = zoomGroup.createEl("span", { cls: "family-tree-zoom-btn", text: "100%" });
    const zoomInBtn = zoomGroup.createEl("button", { cls: "family-tree-zoom-btn", text: "🔍+", title: "Zoom In" });
    const expandBtn = zoomGroup.createEl("button", { cls: "family-tree-zoom-btn", text: "↕", title: "Expand / Collapse Height" });

    // Group 7: Tools (SVG Export)
    const exportBtn = controls.createEl("button", {
      cls: "family-tree-tool-btn",
      text: "📥 SVG",
      title: "Export Clean SVG Vector Graphic"
    });

    // Graph Mount Element & Stats
    const graphWrapper = wrapper.createDiv({ cls: "family-tree-graph-wrapper" });
    const statsEl = wrapper.createDiv({ cls: "family-tree-stats" });

    // Helper: Update Breadcrumb UI
    const updateBreadcrumbs = () => {
      breadcrumbArea.empty();
      if (historyStack.length > 0) {
        const bcBtn = breadcrumbArea.createEl("button", {
          cls: "family-tree-breadcrumb",
          text: `↩ Back to ${originalRoot}`
        });
        bcBtn.onclick = () => {
          currentOpts.root = historyStack.pop() || originalRoot;
          renderContent();
        };
      }
    };

    // Navigation & Native Obsidian Hover Preview Attacher (Supports Alt+Click to Re-Center)
    const attachHoverAndClick = (el, nodeOrKey) => {
      if (!el || !nodeOrKey) return;
      const rawDest = typeof nodeOrKey === "string" 
        ? nodeOrKey 
        : (nodeOrKey.file_path || nodeOrKey.path || nodeOrKey.file_name || nodeOrKey.key || nodeOrKey.name);
      if (!rawDest) return;

      const cleanDest = rawDest.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();

      el.classList.add("internal-link");
      el.setAttribute("data-href", cleanDest);
      el.setAttribute("href", cleanDest);

      el.onclick = (evt) => {
        evt.preventDefault();
        evt.stopPropagation();

        if (evt.altKey) {
          // Alt + Click: Instant In-Place Re-Centering / Pivot
          if (currentOpts.root !== cleanDest) {
            historyStack.push(currentOpts.root);
            currentOpts.root = cleanDest;
            renderContent();
          }
          return;
        }

        // Standard Click: Navigate to Note
        this.app.workspace.openLinkText(cleanDest, ctx.sourcePath || "", evt.metaKey || evt.ctrlKey);
      };

      const triggerHover = (evt) => {
        this.app.workspace.trigger("hover-link", {
          event: evt,
          source: "preview",
          hoverParent: wrapper,
          targetEl: el,
          linktext: cleanDest,
          sourcePath: ctx.sourcePath || ""
        });
      };

      el.onmouseover = triggerHover;
      el.onmousemove = (evt) => {
        if (evt.ctrlKey || evt.metaKey) {
          triggerHover(evt);
        }
      };
    };

    // SVG Export Handler
    exportBtn.onclick = () => {
      const svgEl = graphWrapper.querySelector("svg");
      if (!svgEl) {
        alert("Please switch to Fan or Flow view to export SVG.");
        return;
      }
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cleanName = (currentOpts.root || "family_tree").replace(/[^a-zA-Z0-9_-]/g, "_");
      a.href = url;
      a.download = `${cleanName}_${currentOpts.viewMode}_${currentOpts.depth}gen_${currentOpts.printPreset}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    // Zoom Controls Handlers
    zoomInBtn.onclick = () => {
      if (currentOpts.zoom < 2.5) {
        currentOpts.zoom = parseFloat((currentOpts.zoom + 0.2).toFixed(1));
        applyZoom();
      }
    };
    zoomOutBtn.onclick = () => {
      if (currentOpts.zoom > 0.4) {
        currentOpts.zoom = parseFloat((currentOpts.zoom - 0.2).toFixed(1));
        applyZoom();
      }
    };
    zoomBadge.onclick = () => {
      currentOpts.zoom = 1.0;
      applyZoom();
    };
    expandBtn.onclick = () => {
      currentOpts.isExpanded = !currentOpts.isExpanded;
      graphWrapper.classList.toggle("expanded", currentOpts.isExpanded);
      expandBtn.style.color = currentOpts.isExpanded ? "var(--interactive-accent, #89b4fa)" : "";
    };

    const applyZoom = () => {
      zoomBadge.textContent = `${Math.round(currentOpts.zoom * 100)}%`;
      const svgEl = graphWrapper.querySelector("svg");
      if (svgEl) {
        svgEl.style.transform = `scale(${currentOpts.zoom})`;
      }
    };

    // Drag to Pan inside Pannable Viewport
    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;

    graphWrapper.addEventListener("mousedown", (e) => {
      if (currentOpts.viewMode !== "hourglass") return;
      if (e.target.closest(".node") || e.target.closest("a")) return;
      isDown = true;
      graphWrapper.classList.add("grabbing");
      startX = e.pageX - graphWrapper.offsetLeft;
      startY = e.pageY - graphWrapper.offsetTop;
      scrollLeft = graphWrapper.scrollLeft;
      scrollTop = graphWrapper.scrollTop;
    });

    graphWrapper.addEventListener("mouseleave", () => {
      isDown = false;
      graphWrapper.classList.remove("grabbing");
    });

    graphWrapper.addEventListener("mouseup", () => {
      isDown = false;
      graphWrapper.classList.remove("grabbing");
    });

    graphWrapper.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - graphWrapper.offsetLeft;
      const y = e.pageY - graphWrapper.offsetTop;
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      graphWrapper.scrollLeft = scrollLeft - walkX;
      graphWrapper.scrollTop = scrollTop - walkY;
    });

    // Render Execution
    const renderContent = async () => {
      graphWrapper.empty();
      updateBreadcrumbs();
      depthBadge.textContent = `${currentOpts.depth} Gen`;
      fanBtn.className = `family-tree-pill-btn ${currentOpts.viewMode === "fan" ? "active" : ""}`;
      pedigreeBtn.className = `family-tree-pill-btn ${currentOpts.viewMode === "pedigree" ? "active" : ""}`;
      flowBtn.className = `family-tree-pill-btn ${currentOpts.viewMode === "hourglass" ? "active" : ""}`;

      if (currentOpts.viewMode === "fan") {
        // Mode 1: Dual-Hemisphere Radial Fan Chart (Default)
        exportBtn.style.display = "inline-flex";
        zoomGroup.style.display = "inline-flex";
        paletteSelect.style.display = "inline-flex";
        printSelect.style.display = "inline-flex";
        traceSelect.style.display = "inline-flex";
        graphWrapper.className = "family-tree-graph-wrapper";
        if (currentOpts.isExpanded) graphWrapper.classList.add("expanded");

        const svgContent = await this.engine.buildFanChartSvg(currentOpts.root, {
          depthUp: currentOpts.depth,
          depthDown: currentOpts.depth,
          highlight: currentOpts.highlight,
          palette: currentOpts.palette,
          printPreset: currentOpts.printPreset,
          showNames: currentOpts.includeNames,
          showDates: currentOpts.includeDates,
          showFlags: currentOpts.includeFlags
        });
        graphWrapper.innerHTML = svgContent;
        statsEl.textContent = `Dual-Hemisphere Radial Fan Chart · ${currentOpts.depth} Gen (${currentOpts.printPreset.toUpperCase()}) · Alt+Click to Re-Center`;
        applyZoom();

        // Intercept clicks on SVG <a> tags to wire Obsidian hover previews, links, & Alt+Click re-centering
        graphWrapper.querySelectorAll("a").forEach(aEl => {
          const href = aEl.getAttribute("href");
          if (href && href !== "#") {
            attachHoverAndClick(aEl, href);
          }
        });

      } else if (currentOpts.viewMode === "pedigree") {
        // Mode 2: Gramps-Style Multi-Generation Pedigree Bracket Tree with Hierarchical Descendants
        exportBtn.style.display = "none";
        zoomGroup.style.display = "none";
        paletteSelect.style.display = "none";
        printSelect.style.display = "none";
        traceSelect.style.display = "inline-flex";
        graphWrapper.className = "family-tree-graph-wrapper";

        const highlightSet = await this.engine.resolveHighlightSet(currentOpts.root, currentOpts.highlight);

        const data = await this.engine.buildPedigreeTree(currentOpts.root, { depthUp: currentOpts.depth, depthDown: currentOpts.depth });
        if (!data.root) {
          graphWrapper.createEl("div", { text: `Individual not found: ${currentOpts.root}` });
          return;
        }

        const mainBracket = graphWrapper.createDiv({ cls: "pedigree-bracket-container" });

        // Helper to collect all ancestor nodes by generation level
        const getGenLevels = (root, maxDepth) => {
          const levels = [];
          for (let d = 0; d <= maxDepth; d++) levels.push([]);

          const traverse = (node, depth, isPaternal, branchLabel) => {
            if (!node || depth > maxDepth) return;
            levels[depth].push({ node, isPaternal, branchLabel });
            if (node.father && depth < maxDepth) traverse(node.father, depth + 1, isPaternal, `${branchLabel} Father`);
            if (node.mother && depth < maxDepth) traverse(node.mother, depth + 1, isPaternal, `${branchLabel} Mother`);
          };

          levels[0].push({ node: root, isPaternal: true, branchLabel: "Self" });
          if (root.father && maxDepth >= 1) traverse(root.father, 1, true, "Father");
          if (root.mother && maxDepth >= 1) traverse(root.mother, 1, false, "Mother");
          return levels;
        };

        const genLevels = getGenLevels(data.root, currentOpts.depth);

        // Render Column for each Generation
        for (let g = 0; g <= currentOpts.depth; g++) {
          const col = mainBracket.createDiv({ cls: "pedigree-col" });
          const items = genLevels[g] || [];

          if (g === 0) {
            // Self + Spouses
            const selfCard = col.createDiv({ cls: "pedigree-card self" });
            selfCard.createDiv({ cls: "pedigree-card-name", text: `⭐ ${data.root.displayName}` });
            selfCard.createDiv({ cls: "pedigree-card-sub", text: `${data.root.dates} ${data.root.flags}` });
            attachHoverAndClick(selfCard, data.root);

            if (data.spouses && data.spouses.length > 0) {
              for (const sp of data.spouses) {
                const spCard = col.createDiv({ cls: "pedigree-card" });
                spCard.createDiv({ cls: "pedigree-card-name", text: `💑 ${sp.displayName}` });
                spCard.createDiv({ cls: "pedigree-card-sub", text: `${sp.dates} ${sp.flags}` });
                attachHoverAndClick(spCard, sp);
              }
            }
          } else {
            // Ancestors in Generation g
            if (items.length > 0) {
              for (const item of items) {
                const gender = item.node.gender;
                const branchCls = item.isPaternal ? "father-branch" : (gender === "X" ? "non-binary-branch" : (gender === "U" ? "unknown-branch" : "mother-branch"));
                
                let isHit = false;
                let isDim = false;
                if (highlightSet) {
                  const nKey = item.node.file_path || item.node.path || item.node.key || item.node.name || "";
                  const dName = item.node.displayName || "";
                  if (highlightSet.has(nKey) || highlightSet.has(dName)) {
                    isHit = true;
                  } else {
                    isDim = true;
                  }
                }

                const cardCls = `pedigree-card ${branchCls} ${isHit ? "path-active" : (isDim ? "path-dimmed" : "")}`;
                const card = col.createDiv({ cls: cardCls.trim() });
                const icon = gender === "M" ? "👴" : (gender === "F" ? "👵" : (gender === "X" ? "🧑" : "👤"));
                card.createDiv({ cls: "pedigree-card-name", text: `${icon} ${item.node.displayName}` });
                card.createDiv({ cls: "pedigree-card-sub", text: `${item.node.dates} ${item.node.flags}` });
                attachHoverAndClick(card, item.node);
              }
            } else {
              const emptyCard = col.createDiv({ cls: "pedigree-card" });
              emptyCard.createDiv({ cls: "pedigree-card-name", text: `Gen ${g}: Unknown` });
            }
          }
        }

        // Hierarchical Descendants Section
        if (data.descendants && data.descendants.length > 0) {
          const descSection = graphWrapper.createDiv({ cls: "pedigree-descendants-section" });
          descSection.createDiv({
            cls: "pedigree-descendants-title",
            text: `👶 Descendants & Family Branches (${data.descendants.length} Children):`
          });

          const branchesContainer = descSection.createDiv({ cls: "pedigree-branches-container" });

          for (const child of data.descendants) {
            const branchCard = branchesContainer.createDiv({ cls: "pedigree-branch-card" });

            // Branch Header (Child)
            const header = branchCard.createDiv({ cls: "pedigree-branch-header" });
            const childGender = child.gender;
            const childIcon = childGender === "F" ? "👧" : (childGender === "M" ? "👦" : (childGender === "X" ? "🧑" : "👤"));
            header.createSpan({ text: `${childIcon} ${child.displayName} ${child.flags || ""}` });
            if (child.dates) {
              header.createSpan({ cls: "pedigree-card-sub", text: child.dates });
            }
            attachHoverAndClick(header, child);

            // Grandchildren (under this child)
            const gChildren = child.children || [];
            const childrenBox = branchCard.createDiv({ cls: "pedigree-branch-children" });

            if (gChildren.length > 0) {
              for (const gc of gChildren) {
                const gcChip = childrenBox.createDiv({ cls: "pedigree-descendant-chip" });
                const gcGender = gc.gender;
                const gcIcon = gcGender === "F" ? "👧" : (gcGender === "M" ? "👦" : (gcGender === "X" ? "🧑" : "👤"));
                gcChip.textContent = `${gcIcon} ${gc.displayName} ${gc.dates || ""} ${gc.flags || ""}`.trim();
                attachHoverAndClick(gcChip, gc);
              }
            } else {
              const noDesc = childrenBox.createDiv({ cls: "pedigree-descendant-chip", text: "🌱 No direct descendants registered" });
              noDesc.style.opacity = "0.6";
              noDesc.style.cursor = "default";
            }
          }
        }

        statsEl.textContent = `Gramps Compact Pedigree View · ${currentOpts.depth} Generations · Alt+Click to Re-Center`;

      } else {
        // Mode 3: Mermaid Flowchart with Pannable & Resizable Viewport
        exportBtn.style.display = "inline-flex";
        zoomGroup.style.display = "inline-flex";
        paletteSelect.style.display = "none";
        printSelect.style.display = "none";
        traceSelect.style.display = "none";
        graphWrapper.className = "family-tree-graph-wrapper flow-mode";
        if (currentOpts.isExpanded) graphWrapper.classList.add("expanded");

        const res = await this.engine.buildHourglassGraph(currentOpts.root, {
          depthUp: currentOpts.depth,
          depthDown: currentOpts.depth,
          includeSpouses: currentOpts.includeSpouses,
          includeDates: currentOpts.includeDates,
          direction: currentOpts.direction
        });

        statsEl.textContent = `${res.totalNodes} individuals · ${res.totalEdges} relationships (Drag to Pan · Scroll / Zoom · Alt+Click to Re-Center)`;
        const mermaidMarkdown = "```mermaid\n" + res.mermaid + "\n```";
        await MarkdownRenderer.render(this.app, mermaidMarkdown, graphWrapper, ctx.sourcePath || "", this);

        applyZoom();

        // Wire Obsidian hover previews, clicks, and Alt+Click re-centering on all Mermaid nodes
        graphWrapper.querySelectorAll(".node").forEach(nodeEl => {
          const rawId = nodeEl.id.replace(/^flowchart-/, "").replace(/-\d+$/, "");
          let matchedNode = res.nodes.find(n => n.sanitizedId === rawId || n.id === rawId || n.key === rawId);
          if (!matchedNode) {
            const textLabel = (nodeEl.textContent || "").trim();
            matchedNode = res.nodes.find(n => textLabel.includes(n.name) || (n.displayName && textLabel.includes(n.displayName)));
          }
          if (matchedNode) {
            attachHoverAndClick(nodeEl, matchedNode);
          }
        });
      }
    };

    // Mode Switcher Handlers
    fanBtn.onclick = () => { currentOpts.viewMode = "fan"; currentOpts.zoom = 1.0; renderContent(); };
    pedigreeBtn.onclick = () => { currentOpts.viewMode = "pedigree"; renderContent(); };
    flowBtn.onclick = () => { currentOpts.viewMode = "hourglass"; currentOpts.zoom = 1.0; renderContent(); };

    // Select Dropdown Handlers
    traceSelect.onchange = () => {
      currentOpts.highlight = traceSelect.value;
      renderContent();
    };
    paletteSelect.onchange = () => {
      currentOpts.palette = paletteSelect.value;
      renderContent();
    };
    printSelect.onchange = () => {
      currentOpts.printPreset = printSelect.value;
      renderContent();
    };

    // Generation Stepper Handlers (1 to 5 Gen)
    decBtn.onclick = () => {
      if (currentOpts.depth > 1) {
        currentOpts.depth--;
        renderContent();
      }
    };
    incBtn.onclick = () => {
      if (currentOpts.depth < 5) {
        currentOpts.depth++;
        renderContent();
      }
    };

    await renderContent();
  }

  onunload() {
    console.log("🌳 Unloading Family Tree Graph Plugin");
  }
};

class FamilyTreeSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Family Tree & Lineage Graph Settings" });

    new Setting(containerEl)
      .setName("Default Generation Depth")
      .setDesc("Number of ancestral and descendant generations to display by default (1 to 5).")
      .addSlider(slider => slider
        .setLimits(1, 5, 1)
        .setValue(this.plugin.settings.defaultDepth)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.defaultDepth = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Default Visualizer Mode")
      .setDesc("Choose the default visualizer layout for family-tree code blocks.")
      .addDropdown(drop => drop
        .addOption("fan", "360° Radial Fan Chart")
        .addOption("pedigree", "Compact Pedigree Bracket")
        .addOption("hourglass", "Mermaid Flowchart")
        .setValue(this.plugin.settings.defaultView)
        .onChange(async (value) => {
          this.plugin.settings.defaultView = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Default Color Palette")
      .setDesc("Select the default color scheme (includes colorblind-safe options).")
      .addDropdown(drop => drop
        .addOption("classic", "Classic Modern (Blue / Amber)")
        .addOption("viridis", "Viridis (Colorblind-Safe)")
        .addOption("contrast", "High Contrast (Tol)")
        .addOption("monochrome", "Archival Monochrome")
        .setValue(this.plugin.settings.defaultPalette)
        .onChange(async (value) => {
          this.plugin.settings.defaultPalette = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Show Spouses by Default")
      .setDesc("Display spouse badges and lateral partner chips.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showSpouses)
        .onChange(async (value) => {
          this.plugin.settings.showSpouses = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Show Vital Dates by Default")
      .setDesc("Display birth and death years on person cards and radial arcs.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showDates)
        .onChange(async (value) => {
          this.plugin.settings.showDates = value;
          await this.plugin.saveSettings();
        }));
  }
}

