import { Seniority, JobLocation, WorkArrangement } from '../types';

// ─── Title Normalization ──────────────────────────────────────────────────────

const TITLE_MAPPINGS: Array<[RegExp, string]> = [
  [/\bSDE[-\s]?[1I]\b/gi, 'Software Engineer'],
  [/\bSDE[-\s]?2\b/gi, 'Senior Software Engineer'],
  [/\bSDE[-\s]?3\b/gi, 'Staff Software Engineer'],
  [/\bSDE\b/gi, 'Software Development Engineer'],
  [/\bSWE\b/gi, 'Software Engineer'],
  [/\bSE\b(?=\s|$)/g, 'Software Engineer'],
  [/\bSSE\b/gi, 'Senior Software Engineer'],
  [/\bFE\s*(Dev|Developer|Engineer)\b/gi, 'Frontend Developer'],
  [/\bBE\s*(Dev|Developer|Engineer)\b/gi, 'Backend Developer'],
  [/\bFS\s*(Dev|Developer|Engineer)\b/gi, 'Full Stack Developer'],
  [/\bFull[-\s]?Stack\b/gi, 'Full Stack'],
  [/\bFront[-\s]?End\b/gi, 'Frontend'],
  [/\bBack[-\s]?End\b/gi, 'Backend'],
  [/\bDevOps\b/gi, 'DevOps'],
  [/\bUI\/UX\b/gi, 'UI/UX'],
  [/\bML\s*Engineer\b/gi, 'Machine Learning Engineer'],
  [/\bAI\s*Engineer\b/gi, 'AI Engineer'],
  [/\bQA\s*Engineer\b/gi, 'QA Engineer'],
  [/\bSr\.?\s*/gi, 'Senior '],
  [/\bJr\.?\s*/gi, 'Junior '],
];

const SENIORITY_PATTERNS: Array<[RegExp, Seniority]> = [
  [/\b(intern|internship|trainee)\b/i, 'intern'],
  [/\b(junior|jr|entry[- ]level|associate|fresher|graduate)\b/i, 'junior'],
  [/\b(mid[- ]?level|intermediate)\b/i, 'mid'],
  [/\b(senior|sr|lead|principal)\b/i, 'senior'],
  [/\b(staff|distinguished)\b/i, 'staff'],
  [/\b(principal|architect)\b/i, 'principal'],
  [/\b(director|head of)\b/i, 'director'],
  [/\b(vp|vice president)\b/i, 'vp'],
  [/\bSDE[-\s]?1\b/i, 'junior'],
  [/\bSDE[-\s]?2\b/i, 'mid'],
  [/\bSDE[-\s]?3\b/i, 'senior'],
  [/\bL[34]\b/i, 'junior'],
  [/\bL[56]\b/i, 'senior'],
  [/\bL[78]\b/i, 'staff'],
];

function normalizeTitle(rawTitle: string): { title: string; seniority: Seniority } {
  let title = rawTitle.trim();

  // Apply mappings
  for (const [pattern, replacement] of TITLE_MAPPINGS) {
    title = title.replace(pattern, replacement);
  }

  // Remove extra whitespace
  title = title.replace(/\s+/g, ' ').trim();

  // Detect seniority
  let seniority: Seniority = 'unknown';
  for (const [pattern, level] of SENIORITY_PATTERNS) {
    if (pattern.test(rawTitle)) {
      seniority = level;
      break;
    }
  }

  return { title, seniority };
}

// ─── Skills Normalization ─────────────────────────────────────────────────────

const SKILLS_DICTIONARY: Record<string, string> = {
  // JavaScript ecosystem
  'javascript': 'JavaScript', 'js': 'JavaScript', 'ecmascript': 'JavaScript',
  'typescript': 'TypeScript', 'ts': 'TypeScript',
  'node': 'Node.js', 'nodejs': 'Node.js', 'node.js': 'Node.js',
  'react': 'React', 'reactjs': 'React', 'react.js': 'React',
  'vue': 'Vue.js', 'vuejs': 'Vue.js', 'vue.js': 'Vue.js',
  'angular': 'Angular', 'angularjs': 'Angular',
  'next': 'Next.js', 'nextjs': 'Next.js', 'next.js': 'Next.js',
  'express': 'Express.js', 'expressjs': 'Express.js',
  'nest': 'NestJS', 'nestjs': 'NestJS',

  // Python
  'python': 'Python', 'python3': 'Python',
  'django': 'Django', 'flask': 'Flask', 'fastapi': 'FastAPI',
  'pandas': 'Pandas', 'numpy': 'NumPy', 'scipy': 'SciPy',
  'pytorch': 'PyTorch', 'tensorflow': 'TensorFlow',

  // Java/JVM
  'java': 'Java', 'kotlin': 'Kotlin', 'scala': 'Scala',
  'spring': 'Spring', 'springboot': 'Spring Boot', 'spring boot': 'Spring Boot',

  // Databases
  'mongo': 'MongoDB', 'mongodb': 'MongoDB', 'mongoose': 'MongoDB',
  'postgres': 'PostgreSQL', 'postgresql': 'PostgreSQL', 'pg': 'PostgreSQL',
  'mysql': 'MySQL', 'mariadb': 'MariaDB',
  'redis': 'Redis', 'elasticsearch': 'Elasticsearch', 'elastic': 'Elasticsearch',
  'dynamodb': 'DynamoDB', 'cassandra': 'Cassandra',
  'sql': 'SQL', 'nosql': 'NoSQL',

  // Cloud & DevOps
  'aws': 'AWS', 'amazon web services': 'AWS',
  'gcp': 'GCP', 'google cloud': 'GCP', 'google cloud platform': 'GCP',
  'azure': 'Azure', 'microsoft azure': 'Azure',
  'docker': 'Docker', 'kubernetes': 'Kubernetes', 'k8s': 'Kubernetes',
  'terraform': 'Terraform', 'ansible': 'Ansible',
  'jenkins': 'Jenkins', 'ci/cd': 'CI/CD', 'cicd': 'CI/CD',
  'github actions': 'GitHub Actions', 'gitlab ci': 'GitLab CI',

  // General
  'git': 'Git', 'github': 'GitHub', 'gitlab': 'GitLab',
  'linux': 'Linux', 'unix': 'Unix',
  'rest': 'REST API', 'rest api': 'REST API', 'restful': 'REST API',
  'graphql': 'GraphQL', 'grpc': 'gRPC',
  'microservices': 'Microservices', 'micro services': 'Microservices',
  'html': 'HTML', 'html5': 'HTML',
  'css': 'CSS', 'css3': 'CSS', 'sass': 'Sass', 'scss': 'Sass',
  'tailwind': 'Tailwind CSS', 'tailwindcss': 'Tailwind CSS',
  'bootstrap': 'Bootstrap', 'material ui': 'Material UI',
  'webpack': 'Webpack', 'vite': 'Vite', 'babel': 'Babel',
  'figma': 'Figma', 'sketch': 'Sketch',
  'agile': 'Agile', 'scrum': 'Scrum', 'kanban': 'Kanban',
  'jira': 'Jira', 'confluence': 'Confluence',

  // Languages
  'c++': 'C++', 'cpp': 'C++',
  'c#': 'C#', 'csharp': 'C#', '.net': '.NET', 'dotnet': '.NET',
  'go': 'Go', 'golang': 'Go',
  'rust': 'Rust', 'ruby': 'Ruby', 'php': 'PHP',
  'swift': 'Swift', 'objective-c': 'Objective-C',
  'r': 'R', 'matlab': 'MATLAB',

  // AI/ML
  'machine learning': 'Machine Learning', 'ml': 'Machine Learning',
  'deep learning': 'Deep Learning', 'dl': 'Deep Learning',
  'nlp': 'NLP', 'natural language processing': 'NLP',
  'computer vision': 'Computer Vision', 'cv': 'Computer Vision',
  'ai': 'AI', 'artificial intelligence': 'AI',
  'llm': 'LLM', 'generative ai': 'Generative AI',

  // Data
  'data structures': 'Data Structures', 'algorithms': 'Algorithms',
  'dsa': 'Data Structures & Algorithms',
  'data engineering': 'Data Engineering', 'etl': 'ETL',
  'apache spark': 'Apache Spark', 'spark': 'Apache Spark',
  'kafka': 'Apache Kafka', 'apache kafka': 'Apache Kafka',
  'hadoop': 'Hadoop', 'airflow': 'Apache Airflow',
};

function normalizeSkill(skill: string): string {
  const key = skill.toLowerCase().trim();
  return SKILLS_DICTIONARY[key] ?? skill.trim();
}

function normalizeSkills(skills: string[]): string[] {
  const normalized = skills.map(normalizeSkill);
  // Deduplicate
  return [...new Set(normalized)];
}

// ─── Location Normalization ───────────────────────────────────────────────────

const CITY_ALIASES: Record<string, string> = {
  'bangalore': 'Bengaluru', 'bengaluru': 'Bengaluru',
  'bombay': 'Mumbai', 'mumbai': 'Mumbai',
  'madras': 'Chennai', 'chennai': 'Chennai',
  'calcutta': 'Kolkata', 'kolkata': 'Kolkata',
  'new delhi': 'Delhi', 'delhi': 'Delhi',
  'hyderabad': 'Hyderabad', 'hyd': 'Hyderabad',
  'pune': 'Pune', 'gurgaon': 'Gurugram', 'gurugram': 'Gurugram',
  'noida': 'Noida', 'ghaziabad': 'Ghaziabad',
  'ahmedabad': 'Ahmedabad', 'indore': 'Indore',
  // International
  'sf': 'San Francisco', 'san francisco': 'San Francisco',
  'nyc': 'New York', 'new york': 'New York', 'new york city': 'New York',
  'la': 'Los Angeles', 'los angeles': 'Los Angeles',
  'london': 'London', 'berlin': 'Berlin', 'paris': 'Paris',
  'singapore': 'Singapore', 'tokyo': 'Tokyo', 'sydney': 'Sydney',
  'toronto': 'Toronto', 'vancouver': 'Vancouver',
  'seattle': 'Seattle', 'austin': 'Austin', 'denver': 'Denver',
};

const WORK_ARRANGEMENT_PATTERNS: Array<[RegExp, WorkArrangement]> = [
  [/\bremote\b/i, 'remote'],
  [/\bhybrid\b/i, 'hybrid'],
  [/\bwork from home\b/i, 'remote'],
  [/\bwfh\b/i, 'remote'],
  [/\bon[- ]?site\b/i, 'onsite'],
  [/\bin[- ]?office\b/i, 'onsite'],
];

function normalizeLocation(raw: string): JobLocation {
  const lower = raw.toLowerCase().trim();

  // Detect work arrangement
  let workArrangement: WorkArrangement = 'onsite';
  for (const [pattern, arrangement] of WORK_ARRANGEMENT_PATTERNS) {
    if (pattern.test(lower)) {
      workArrangement = arrangement;
      break;
    }
  }

  // Try to extract city
  let city: string | undefined;
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) {
      city = canonical;
      break;
    }
  }

  // Extract country
  let country: string | undefined;
  if (/\bindia\b/i.test(raw)) country = 'India';
  else if (/\busa?\b|\bunited states\b/i.test(raw)) country = 'United States';
  else if (/\buk\b|\bunited kingdom\b/i.test(raw)) country = 'United Kingdom';
  else if (/\bgermany\b/i.test(raw)) country = 'Germany';
  else if (/\bcanada\b/i.test(raw)) country = 'Canada';
  else if (/\baustralia\b/i.test(raw)) country = 'Australia';
  else if (/\bsingapore\b/i.test(raw)) country = 'Singapore';

  return {
    raw,
    city,
    country,
    workArrangement,
  };
}

function normalizeLocations(rawLocations: string[]): JobLocation[] {
  if (rawLocations.length === 0) return [{ raw: 'Not specified', workArrangement: 'onsite' }];
  return rawLocations.map(normalizeLocation);
}

// ─── Main Normalizer Service ──────────────────────────────────────────────────

export class NormalizerService {
  normalizeTitle(rawTitle: string): { title: string; seniority: Seniority } {
    return normalizeTitle(rawTitle);
  }

  normalizeSkills(skills: string[]): string[] {
    return normalizeSkills(skills);
  }

  normalizeLocation(raw: string): JobLocation {
    return normalizeLocation(raw);
  }

  normalizeLocations(rawLocations: string[]): JobLocation[] {
    return normalizeLocations(rawLocations);
  }

  normalizeCompany(company: string): string {
    return company
      .replace(/\b(inc|llc|ltd|pvt|private|limited|corp|corporation|co)\b\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Normalize all fields of a job record.
   */
  normalizeJob(data: {
    rawTitle: string;
    rawCompany: string;
    rawLocation?: string;
    skills?: string[];
  }): {
    title: string;
    seniority: Seniority;
    companyNormalized: string;
    locations: JobLocation[];
    skillsNormalized: string[];
  } {
    const { title, seniority } = this.normalizeTitle(data.rawTitle);
    const companyNormalized = this.normalizeCompany(data.rawCompany);
    const locations = data.rawLocation
      ? this.normalizeLocations(data.rawLocation.split(/[;,]/).map((s) => s.trim()).filter(Boolean))
      : [{ raw: 'Not specified', workArrangement: 'onsite' as WorkArrangement }];
    const skillsNormalized = data.skills ? this.normalizeSkills(data.skills) : [];

    return { title, seniority, companyNormalized, locations, skillsNormalized };
  }
}

export const normalizerService = new NormalizerService();
