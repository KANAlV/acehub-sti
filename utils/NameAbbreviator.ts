// 1. Standalone Abbreviation Library Dictionary
const ACADEMIC_ABBREVIATIONS: Record<string, string> = {
  // Computing & Technology
  it: "IT",
  computer: "Comp",
  computers: "Comp",
  programming: "Prog",
  information: "Info",
  technology: "Tech",
  network: "Net",
  security: "Sec",
  database: "DB",
  architecture: "Arch",
  software: "SW",
  hardware: "HW",
  system: "Sys",
  systems: "Sys",
  application: "App",
  development: "Dev",
  administration: "Admin",
  multimedia: "MM",
  artificial: "Art",
  intelligence: "Intel",
  digital: "Digi",
  graphics: "Graph",
  web: "Web",
  cybersecurity: "Cyber",
  cyber: "Cyber",
  engineering: "Engr",
  electronics: "Elec",
  electrical: "Elec",
  mechanical: "Mech",
  civil: "Civ",
  structure: "Struct",
  structural: "Struct",
  communication: "Comm",
  communications: "Comms",
  telecommunication: "Telecom",

  // Business, Management & Economics
  management: "Mgmt",
  business: "Bus",
  accounting: "Acct",
  finance: "Fin",
  financial: "Fin",
  economics: "Econ",
  marketing: "Mktg",
  entrepreneurship: "Entrep",
  strategic: "Strat",
  operations: "Ops",
  logistics: "Log",
  human: "Hum",
  resources: "Res",
  international: "Intl",
  global: "Glob",
  commercial: "Comm",
  enterprise: "Enter",
  taxation: "Tax",
  auditing: "Audit",
  banking: "Bank",
  insurance: "Ins",
  investment: "Inv",
  consumer: "Cons",
  supply: "Supp",
  chain: "Ch",

  // Mathematics & Natural Sciences
  mathematics: "Math",
  calculus: "Calc",
  statistics: "Stats",
  algebra: "Alg",
  geometry: "Geom",
  trigonometry: "Trig",
  probability: "Prob",
  science: "Sci",
  physics: "Phys",
  chemistry: "Chem",
  biology: "Bio",
  environmental: "Env",
  laboratory: "Lab",
  organic: "Org",
  inorganic: "Inorg",
  biochemistry: "Biochem",
  microbiology: "Micro",
  anatomy: "Anat",
  physiology: "Physio",
  zoology: "Zool",
  botany: "Bot",
  geology: "Geol",
  astronomy: "Astro",

  // Social Sciences & Humanities
  psychology: "Psych",
  sociology: "Soc",
  philosophy: "Phil",
  history: "Hist",
  literature: "Lit",
  language: "Lang",
  ethics: "Eth",
  politics: "Pol",
  political: "Pol",
  government: "Gov",
  geography: "Geog",
  culture: "Cult",
  arts: "Art",
  behavior: "Behav",
  behavioral: "Behav",
  criminology: "Crim",
  criminal: "Crim",
  justice: "Just",
  law: "Law",
  religion: "Rel",
  religious: "Rel",
  teology: "Theo",
  theological: "Theo",
  music: "Mus",
  theater: "Theat",
  physical: "PE",
  fitness: "Fit",

  // Hospitality, Tourism & Specialized Fields
  hospitality: "Hosp",
  tourism: "Tour",
  hotel: "Htl",
  restaurant: "Rest",
  culinary: "Cul",
  cookery: "Cul",
  foods: "Fd",
  beverage: "Bev",
  nutrition: "Nutr",
  dietetics: "Diet",
  lodging: "Lodg",
  travel: "Trv",
  event: "Evt",
  convention: "Conv",
  catering: "Cat",
  production: "Prod",
  service: "Svc",
  safety: "Safe",
  sanitation: "Sanit",
  design: "Des",

  // General Academic & Core Terms
  advanced: "Adv",
  elementary: "Elem",
  introduction: "Intro",
  fundamentals: "Fund",
  fundamental: "Fund",
  principles: "Princ",
  general: "Gen",
  applied: "App",
  practical: "Prac",
  theoretical: "Theor",
  professional: "Prof",
  practicum: "Pract",
  internship: "Int",
  seminar: "Sem",
  research: "Res",
  thesis: "Thes",
  project: "Proj",
  special: "Spec",
  topics: "Top",
  methods: "Meth",
  analysis: "Anal",
  survey: "Surv",
  contemporary: "Contemp",
  modern: "Mod",
  traditional: "Trad",
};

// 2. Core Function calling the external dictionary
export function generateSubjectAbv(subjectName: string): string {
  if (!subjectName) return "";

  // 1. Prioritize text inside parentheses if present (e.g. shorthand alias)
  const parenMatch = subjectName.match(/\(([^)]+)\)/);
  let cleaned = parenMatch ? parenMatch[1] : subjectName;

  // 2. Special handling for PATHFIT / P.E. codes
  if (
    cleaned.toUpperCase().includes("PATHFIT") ||
    cleaned.toUpperCase().includes("P.E.")
  ) {
    const pathfitMatch = cleaned.match(
      /PATHFIT\s*\d+|P\.E\.\/\s*PATHFIT\s*\d+/i,
    );
    if (pathfitMatch) {
      return pathfitMatch[0].replace(/P\.E\.\/\s*/i, "").trim();
    }
  }

  // 3. Extract trailing numbers or roman numerals (e.g., "2", "I", "II") from the end of the string
  const trailingNumMatch = cleaned.match(/\s+(\d+|[IVXLCDM]+)$/i);
  let trailingNum = "";
  if (trailingNumMatch) {
    trailingNum = trailingNumMatch[1];
    // Remove the number from the main cleaning process so it doesn't count as a word
    cleaned = cleaned.replace(/\s+(\d+|[IVXLCDM]+)$/i, "").trim();
  }

  const stopWords = new Set(["and", "the", "of", "in", "to", "for", "a", "an"]);

  const words = cleaned
    .replace(/[:,\-\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  const significantWords = words.filter((w) => !stopWords.has(w.toLowerCase()));

  let baseCode = "";

  // 2-word subjects get combined library values or fallback to partial substrings
  if (significantWords.length === 2) {
    const w1 = significantWords[0].toLowerCase();
    const w2 = significantWords[1].toLowerCase();

    const part1 =
      ACADEMIC_ABBREVIATIONS[w1] || significantWords[0].substring(0, 3);
    const part2 =
      ACADEMIC_ABBREVIATIONS[w2] || significantWords[1].substring(0, 4);

    baseCode = `${part1}${part2}`;
  }
  // Single word subjects (not counting numbers) remain fully unabbreviated
  else if (significantWords.length === 1) {
    baseCode = significantWords[0];
  }
  // 3+ words automatically generate a standard acronym (e.g., "Management Information System" -> "MIS")
  else {
    baseCode = significantWords.map((w) => w.charAt(0).toUpperCase()).join("");

    if (baseCode.length < 2) {
      baseCode = cleaned.substring(0, 5);
    }
  }

  // Append back the trailing number if it existed (e.g. Accounting + 1 = Accounting 1)
  return trailingNum ? `${baseCode} ${trailingNum}` : baseCode;
}