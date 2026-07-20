const XLSX = require("xlsx");
const fs = require("fs");
const Job = require("../models/Job");

/* -------------------------------------------------------------------------
 * FLEXIBLE HEADER MAPPING
 * Different people upload files with wildly different column names
 * ("Job Role", "Tech Stack", "CTC", "Yrs Exp", "JD", "Apply URL", etc).
 * We no longer rely on a single fixed whitelist. Instead:
 *   1) Try an exact match against a curated alias list (fast path).
 *   2) If that fails, fuzzy-match the header against a synonym keyword
 *      list per field using token-containment + Levenshtein similarity,
 *      and pick the best-scoring field above a confidence threshold.
 *   3) If nothing scores high enough, the column is left unmapped
 *      (reported back in stats.unmappedColumns) rather than silently
 *      guessed into the wrong field.
 * ---------------------------------------------------------------------- */

// Fast-path exact aliases (normalized: lowercase, no spaces/underscores/dashes)
const HEADER_MAP = {
  jobtitle: "jobTitle",
  title: "jobTitle",
  jobrole: "jobTitle",
  role: "jobTitle",
  position: "jobTitle",
  designation: "jobTitle",
  vacancy: "jobTitle",
  postname: "jobTitle",

  company: "company",
  companyname: "company",
  employer: "company",
  organization: "company",
  org: "company",
  hiringcompany: "company",
  firm: "company",

  location: "location",
  city: "location",
  joblocation: "location",
  place: "location",
  workinglocation: "location",

  salary: "salary",
  salaryrange: "salary",
  pay: "salary",
  ctc: "salary",
  package: "salary",
  compensation: "salary",
  stipend: "salary",

  experience: "experience",
  exp: "experience",
  experiencerequired: "experience",
  yearsexperience: "experience",
  yrsexp: "experience",
  yoe: "experience",

  skills: "skills",
  skillset: "skills",
  requiredskills: "skills",
  techstack: "skills",
  technologies: "skills",
  keyskills: "skills",

  description: "description",
  jobdescription: "description",
  desc: "description",
  jd: "description",
  summary: "description",
  details: "description",

  employmenttype: "employmentType",
  type: "employmentType",
  jobtype_raw: "employmentType",
  worktype: "employmentType",
  mode: "employmentType",

  industry: "industry",
  sector: "industry",
  domain: "industry",

  applylink: "applyLink",
  link: "applyLink",
  url: "applyLink",
  joburl: "applyLink",
  applyurl: "applyLink",
  apply: "applyLink",

  posteddate: "postedDate",
  datposted: "postedDate",
  date: "postedDate",
  postingdate: "postedDate",
  createdon: "postedDate",

  source: "source",
  portal: "source",
  platform: "source",

  education: "education",
  qualification: "education",
  eligibility: "education",
  eligibilitycriteria: "education",
  educationalqualification: "education",
  degree: "education",
};

// Synonym keyword sets used for fuzzy fallback matching.
const FIELD_SYNONYMS = {
  jobTitle: ["job", "title", "role", "position", "designation", "vacancy", "post"],
  company: ["company", "employer", "organization", "org", "firm", "hiring"],
  location: ["location", "city", "place", "area", "region"],
  salary: ["salary", "pay", "ctc", "package", "compensation", "stipend", "wage"],
  experience: ["experience", "exp", "years", "yrs", "yoe"],
  skills: ["skill", "tech", "stack", "technolog", "keyword"],
  description: ["description", "desc", "jd", "summary", "detail", "about"],
  employmentType: ["employment", "worktype", "mode", "type"],
  industry: ["industry", "sector", "domain", "field"],
  applyLink: ["apply", "link", "url", "href"],
  postedDate: ["date", "posted", "created", "published"],
  source: ["source", "portal", "platform", "site"],
  education: ["education", "qualification", "eligibility", "degree", "academic"],
};

const REQUIRED_FIELDS = ["jobTitle", "company"];

const normalizeHeader = (h) =>
  String(h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

// Simple Levenshtein distance for fuzzy similarity scoring
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Score how well a normalized header matches a field's synonym list
function scoreFieldMatch(normalizedHeader, synonyms) {
  let best = 0;
  for (const syn of synonyms) {
    if (!normalizedHeader) continue;
    if (normalizedHeader.includes(syn) || syn.includes(normalizedHeader)) {
      best = Math.max(best, 0.9);
    } else {
      best = Math.max(best, similarity(normalizedHeader, syn));
    }
  }
  return best;
}

const FUZZY_THRESHOLD = 0.62;

function fuzzyMatchField(normalizedHeader) {
  let bestField = null;
  let bestScore = 0;
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    const score = scoreFieldMatch(normalizedHeader, synonyms);
    if (score > bestScore) {
      bestScore = score;
      bestField = field;
    }
  }
  return bestScore >= FUZZY_THRESHOLD ? bestField : null;
}

/**
 * Maps an arbitrary raw row (any column names, any order) onto our
 * normalized job fields. Returns the mapped row; any raw header that
 * couldn't be confidently placed is added to `unmappedSet`.
 *
 * This is a proper two-pass matcher:
 *   Pass 1 (exact): every column that exactly matches HEADER_MAP is
 *     mapped immediately and that field is "locked" — nothing in pass 2
 *     is allowed to overwrite it. This is what stops an "Education" /
 *     "Qualification" column from clobbering a real "Location" column
 *     just because both happen to fuzzy-score against "location".
 *   Pass 2 (fuzzy): only for columns that had no exact match. Fuzzy
 *     matches are only allowed to fill a field that is still empty —
 *     first confident match wins, later ones are ignored (and reported
 *     as unmapped rather than silently overwriting).
 *
 * The old version had a single pass with a condition that was almost
 * always true (`row[field] === undefined || value !== ""`), so any
 * later column — including a fuzzy one — would overwrite an earlier,
 * correctly-mapped column. That's the root cause of Location showing
 * Education/Qualification text on the dashboard.
 */
function normalizeRow(rawRow, unmappedSet) {
  const row = {};
  const lockedFields = new Set();
  const unresolvedKeys = [];

  // Pass 1: exact header matches only. These are trusted completely and
  // lock the field so no fuzzy guess in pass 2 can override them.
  for (const key of Object.keys(rawRow)) {
    const normalizedKey = normalizeHeader(key);
    const field = HEADER_MAP[normalizedKey];
    if (field) {
      row[field] = rawRow[key];
      lockedFields.add(field);
    } else {
      unresolvedKeys.push(key);
    }
  }

  // Pass 2: fuzzy matches, only for columns that didn't exactly match
  // anything. Never touch a locked field, and never overwrite a field
  // a previous fuzzy match already filled in this same row.
  for (const key of unresolvedKeys) {
    const normalizedKey = normalizeHeader(key);
    const field = fuzzyMatchField(normalizedKey);
    const hasValue = String(rawRow[key]).trim() !== "";

    if (field && !lockedFields.has(field) && row[field] === undefined) {
      if (hasValue) row[field] = rawRow[key];
    } else if (hasValue) {
      unmappedSet.add(key);
    }
  }

  return row;
}

// -----------------------------------------------------------------------
// Job type classification — order matters: more specific rules first.
// Uses whole-word matching so e.g. "java" never matches inside "javascript".
// -----------------------------------------------------------------------
function hasWord(haystack, phrase) {
  // phrase may be multi-word ("spring boot"); escape regex special chars
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
  return re.test(haystack);
}

const CATEGORY_RULES = [
  {
    type: "Python Full Stack",
    keywords: ["python full stack", "python fullstack", "django react", "python react", "fastapi react", "flask react"],
  },
  {
    type: "Python Developer",
    keywords: ["python developer", "python engineer", "django developer", "flask developer", "fastapi", "django", "flask", "python backend"],
  },
  {
    type: "Java Full Stack",
    keywords: ["java full stack", "java fullstack", "spring boot", "java developer full stack", "springboot"],
  },
  {
    type: "MERN Stack Developer",
    keywords: ["mern", "mongodb express react node", "react node mongo", "full stack javascript", "mean stack"],
  },
  {
    type: "DevOps Engineer",
    keywords: ["devops", "site reliability", "sre", "kubernetes engineer", "platform engineer", "cloud infrastructure"],
  },
  {
    type: "AI Engineer",
    keywords: ["ai engineer", "machine learning engineer", "ml engineer", "artificial intelligence", "llm engineer", "genai"],
  },
  {
    type: "Data Scientist",
    keywords: ["data scientist", "data science"],
  },
  {
    type: "Data Analyst",
    keywords: ["data analyst", "business analyst", "bi analyst"],
  },
];

function classifyJobType(title = "", skills = [], description = "") {
  const haystack = `${title} ${skills.join(" ")} ${description}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => (kw.includes(" ") ? haystack.includes(kw) : hasWord(haystack, kw)))) {
      return rule.type;
    }
  }
  // Fallback: bare "python" mention with no other stack keyword
  if (hasWord(haystack, "python")) return "Python Developer";
  return "Other";
}

// -----------------------------------------------------------------------
// Salary parsing. This is the source of the "average salary looks wrong"
// bug: the old version just pulled raw numbers out of the string, so
// "2.8-8.7 LPA" was stored as salaryMin=2.8 / salaryMax=8.7 (as if those
// were full rupee amounts), while a sheet with "300000-600000" stored
// 300000/600000. Averaging those together, or bucketing them against
// boundaries like 300000/600000/900000 in the dashboard, is meaningless
// when one dataset is off by a factor of 100000.
//
// This version normalizes everything to one unit — full rupees per annum:
//   - "LPA" / "lakh" / "lac"   -> value is in lakhs, multiply by 100000
//   - "50k" / "80K"            -> value is in thousands, multiply by 1000
//   - "/month" / "per month"   -> annualize by multiplying by 12
//   - plain number, no unit, value < 100 -> assume LPA (e.g. "2.8-8.7"),
//     multiply by 100000
//   - plain number >= 100      -> assume it's already a full rupee figure
// ---------------------------------------------------------------------- */
function parseSalaryRange(salaryStr = "") {
  if (!salaryStr) return { salaryMin: null, salaryMax: null };
  const str = String(salaryStr).trim();
  if (!str) return { salaryMin: null, salaryMax: null };

  const lower = str.toLowerCase();
  const isLPA = /\blpa\b|lakh|\blac\b/.test(lower);
  const isMonthly = /per\s*month|\/\s*month|\bpm\b|\bmonthly\b/.test(lower);

  // Numbers with a "k" suffix attached (e.g. "50k-80k", "50K") are handled
  // separately so we don't double-apply the LPA fallback to them.
  const kMatches = [...lower.matchAll(/(\d+(?:\.\d+)?)\s*k\b/g)];

  let values;
  if (kMatches.length > 0) {
    values = kMatches.map((m) => parseFloat(m[1]) * 1000);
  } else {
    const nums = lower.replace(/,/g, "").match(/\d+(\.\d+)?/g);
    if (!nums) return { salaryMin: null, salaryMax: null };
    values = nums.map(Number);
    if (isLPA || Math.max(...values) < 100) {
      values = values.map((v) => v * 100000);
    }
  }

  if (isMonthly) {
    values = values.map((v) => v * 12);
  }

  values = values.map((v) => Math.round(v));

  if (values.length === 1) return { salaryMin: values[0], salaryMax: values[0] };
  return { salaryMin: Math.min(...values), salaryMax: Math.max(...values) };
}

// Pure parsing step: reads a workbook file on disk and returns the mapped
// job documents + stats, WITHOUT touching the database or deleting the
// file. Shared by the per-user upload flow (parseAndStoreExcel) and the
// one-time sample-data seed (seedSampleJobs), and reusable for
// "Upload From History" re-activation of a previously stored file.
function parseWorkbookFile(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rawRows.length === 0) {
    const err = new Error(
      "This file has no data rows. Please upload a sheet with at least a header row and one job listed below it."
    );
    err.code = "EMPTY_FILE";
    throw err;
  }

  const stats = {
    total: rawRows.length,
    inserted: 0,
    replaced: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: [],
    unmappedColumns: [],
  };
  const seen = new Set();
  const docsToInsert = [];
  const unmappedSet = new Set();

  for (let i = 0; i < rawRows.length; i++) {
    try {
      const row = normalizeRow(rawRows[i], unmappedSet);

      const missing = REQUIRED_FIELDS.filter((f) => !row[f] || !String(row[f]).trim());
      if (missing.length > 0) {
        stats.errors++;
        stats.errorDetails.push(`Row ${i + 2}: Missing ${missing.join(", ")}`);
        continue;
      }

      const skillsArr = row.skills
        ? String(row.skills)
            .split(/[,|;/]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const dedupeKey = `${row.jobTitle}|${row.company}|${row.location || ""}`.toLowerCase();
      if (seen.has(dedupeKey)) {
        stats.duplicates++;
        continue;
      }
      seen.add(dedupeKey);

      const { salaryMin, salaryMax } = parseSalaryRange(row.salary);
      const jobType = classifyJobType(row.jobTitle, skillsArr, row.description);

      let postedDate = new Date();
      if (row.postedDate) {
        const d = new Date(row.postedDate);
        if (!isNaN(d.getTime())) postedDate = d;
      }

      docsToInsert.push({
        jobTitle: String(row.jobTitle).trim(),
        company: String(row.company).trim(),
        location: row.location ? String(row.location).trim() : "Not specified",
        salary: row.salary ? String(row.salary).trim() : "Not disclosed",
        salaryMin,
        salaryMax,
        experience: row.experience ? String(row.experience).trim() : "Not specified",
        skills: skillsArr,
        description: row.description ? String(row.description).trim() : "",
        employmentType: row.employmentType ? String(row.employmentType).trim() : "Full-time",
        industry: row.industry ? String(row.industry).trim() : "Technology",
        education: row.education ? String(row.education).trim() : "Not specified",
        jobType,
        applyLink: row.applyLink ? String(row.applyLink).trim() : "",
        postedDate,
        source: row.source ? String(row.source).trim() : "Excel Upload",
        remote: /remote/i.test(row.location || "") || /remote/i.test(row.employmentType || ""),
      });
    } catch (err) {
      stats.errors++;
      stats.errorDetails.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  stats.unmappedColumns = Array.from(unmappedSet);

  // If literally nothing could be mapped to our required fields, this
  // almost certainly isn't a jobs sheet in the format we expect (wrong
  // template, wrong sheet, garbled headers, etc). Fail loudly with a
  // clear message instead of quietly wiping the DB or reporting a wall
  // of per-row errors that don't explain the real problem.
  if (docsToInsert.length === 0) {
    const err = new Error(
      "This file's columns don't match the expected format. We need at least a Job Title and Company column " +
        "(any reasonable header name works — e.g. \"Job Role\", \"Position\", \"Employer\", \"Organization\"). " +
        "Please check the format guide above the upload box and try again."
    );
    err.code = "FORMAT_MISMATCH";
    throw err;
  }

  return { docsToInsert, stats };
}

// Owner-scoped upload: replaces ONLY this user's own Job rows (never any
// other user's data, and never the public sample dataset). `datasetId`
// tags every inserted row with the JobDataset batch it came from so
// History can re-activate it later.
async function parseAndStoreExcel(filePath, ownerId, datasetId) {
  let docsToInsert, stats;
  try {
    ({ docsToInsert, stats } = parseWorkbookFile(filePath));
  } catch (err) {
    fs.unlink(filePath, () => {});
    throw err;
  }

  const deleteResult = await Job.deleteMany({ owner: ownerId });
  stats.replaced = deleteResult.deletedCount || 0;

  const inserted = await Job.insertMany(
    docsToInsert.map((d) => ({ ...d, owner: ownerId, isSample: false, dataset: datasetId })),
    { ordered: false }
  );
  stats.inserted = inserted.length;

  return stats;
}

// Re-activates a previously uploaded dataset (owner + JobDataset id) by
// re-parsing its still-on-disk file and replacing the owner's current Job
// rows with it — used by "Upload From History" so the user never has to
// re-upload the same file.
async function reactivateJobDataset(filePath, ownerId, datasetId) {
  const { docsToInsert, stats } = parseWorkbookFile(filePath);
  const deleteResult = await Job.deleteMany({ owner: ownerId });
  stats.replaced = deleteResult.deletedCount || 0;
  const inserted = await Job.insertMany(
    docsToInsert.map((d) => ({ ...d, owner: ownerId, isSample: false, dataset: datasetId })),
    { ordered: false }
  );
  stats.inserted = inserted.length;
  return stats;
}

// One-time seed of the public guest/demo dataset from sample-data/sample-jobs.csv.
// Only runs if no sample rows exist yet, so it never clobbers/duplicates on
// every server restart.
async function seedSampleJobs(filePath) {
  const existing = await Job.countDocuments({ isSample: true });
  if (existing > 0) return { seeded: false, count: existing };

  const { docsToInsert } = parseWorkbookFile(filePath);
  const inserted = await Job.insertMany(
    docsToInsert.map((d) => ({ ...d, owner: null, isSample: true, dataset: null })),
    { ordered: false }
  );
  return { seeded: true, count: inserted.length };
}

module.exports = { parseAndStoreExcel, reactivateJobDataset, seedSampleJobs, parseWorkbookFile, classifyJobType };
