const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// -----------------------------------------------------------------------
// Whole-word matching helper.
// The old code used resumeLower.includes(word), which is a plain substring
// check. That meant a job titled "Java Developer" matched any resume that
// mentioned "JavaScript" (because the string "java" sits inside
// "javascript"), so Java/MERN jobs kept out-scoring the correct Python
// roles. This version matches on word boundaries instead.
// -----------------------------------------------------------------------
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordMatch(haystackLower, term) {
  if (!term) return false;
  const t = String(term).trim().toLowerCase();
  if (!t) return false;
  if (t.includes(" ")) return haystackLower.includes(t); // multi-word phrase: substring is fine
  const re = new RegExp(`(?:^|[^a-z0-9+#.])${escapeRegex(t)}(?:[^a-z0-9+#.]|$)`, "i");
  return re.test(haystackLower);
}

// -----------------------------------------------------------------------
// Detect the resume's dominant tech stack so we can heavily favor jobs
// in that same stack, instead of treating every keyword overlap equally.
// -----------------------------------------------------------------------
const STACK_SIGNATURES = {
  "Python Full Stack": ["python", "django", "flask", "fastapi"],
  "Python Developer": ["python", "django", "flask", "fastapi", "pandas", "numpy"],
  "Java Full Stack": ["java", "spring boot", "spring", "hibernate", "j2ee"],
  "MERN Stack Developer": ["react", "node.js", "nodejs", "express", "mongodb", "javascript", "typescript"],
  "AI Engineer": ["tensorflow", "pytorch", "machine learning", "llm", "genai", "langchain"],
  "Data Scientist": ["data science", "pandas", "numpy", "scikit-learn", "statistics"],
  "Data Analyst": ["data analyst", "power bi", "tableau", "sql", "excel"],
  "DevOps Engineer": ["docker", "kubernetes", "devops", "ci/cd", "terraform", "aws"],
};

function detectPrimaryStacks(resumeText) {
  const lower = resumeText.toLowerCase();
  const scores = {};
  for (const [stack, terms] of Object.entries(STACK_SIGNATURES)) {
    let score = 0;
    terms.forEach((term) => {
      if (wordMatch(lower, term)) score += 1;
    });
    scores[stack] = score;
  }
  const maxScore = Math.max(0, ...Object.values(scores));
  if (maxScore === 0) return [];
  // Return every stack within 1 point of the top score (handles genuinely
  // multi-stack resumes) rather than forcing a single winner.
  return Object.entries(scores)
    .filter(([, s]) => s >= maxScore - 1 && s > 0)
    .map(([stack]) => stack);
}

/**
 * Cheap local pre-filter: scores jobs by skill/keyword overlap with the
 * resume, PLUS a strong bonus for jobs whose jobType matches the resume's
 * detected primary stack, so we only send genuinely relevant candidates
 * to the AI (keeps prompt small & fast, and stops off-stack jobs from
 * drowning out the right ones).
 */
function localShortlist(resumeText, jobs, topN = 40) {
  const resumeLower = resumeText.toLowerCase();
  const primaryStacks = detectPrimaryStacks(resumeText);

  const scored = jobs.map((job) => {
    const skills = job.skills || [];
    let overlap = 0;
    skills.forEach((s) => {
      if (s && wordMatch(resumeLower, s)) overlap += 1;
    });

    const titleWords = (job.jobTitle || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    titleWords.forEach((w) => {
      if (wordMatch(resumeLower, w)) overlap += 0.5;
    });

    // Strong boost when the job's category matches the resume's detected stack
    if (primaryStacks.length && primaryStacks.includes(job.jobType)) {
      overlap += 5;
    }

    return { job, overlap };
  });

  scored.sort((a, b) => b.overlap - a.overlap);
  return scored.slice(0, topN).map((s) => s.job);
}

function buildPrompt(resumeText, jobs, primaryStacks) {
  const jobsSummary = jobs.map((j, idx) => ({
    idx,
    id: String(j._id),
    jobTitle: j.jobTitle,
    company: j.company,
    jobType: j.jobType,
    skills: j.skills,
    experience: j.experience,
    description: (j.description || "").slice(0, 400),
  }));

  const stackHint = primaryStacks.length
    ? `Based on keyword analysis, the resume's primary tech stack appears to be: ${primaryStacks.join(", ")}. Treat jobs outside this stack as a WEAKER match even if a few individual skills overlap (e.g. a resume built mainly around Python/Django should NOT be scored highly against a Java or MERN role just because it also mentions JavaScript or SQL). Prioritize correct stack alignment over shallow keyword overlap.`
    : `No single dominant stack was detected from keywords alone — judge stack fit directly from the resume content.`;

  return `You are an expert ATS (Applicant Tracking System) and technical recruiter AI.

RESUME TEXT:
"""
${resumeText.slice(0, 6000)}
"""

${stackHint}

JOB LISTINGS (JSON array):
${JSON.stringify(jobsSummary)}

TASK:
For EACH job listing above, evaluate how well the resume matches it, giving primary weight to whether the job's core technology stack/role matches the resume's actual background, and secondary weight to specific skill overlap.

Populate the "results" array with exactly one entry per job listing (same order as the input, using the same "id"), giving:
- atsScore: integer 0-100, how well the resume is optimized/formatted for ATS in context of this role
- matchPercent: integer 0-100, overall fit between resume and job requirements, factoring in stack alignment
- matchedSkills: skills from the job that appear in the resume
- missingSkills: important skills from the job NOT found in the resume

Also populate "overallAtsScore" (integer 0-100, overall resume ATS quality score) and "suggestedImprovements".

Rules for "suggestedImprovements" (be thorough — this is the resume's main feedback, do not skimp):
- Write 8-10 distinct bullet points, not 3-5. Each one must be concrete and actionable, not generic advice.
- Reference actual details from THIS resume (specific project names, job titles, dates, skills, or phrasing) rather than vague filler like "add more skills" or "improve formatting".
- Cover a spread of these areas across the list (skip an area only if genuinely not applicable): (1) quantifying impact/achievements with metrics, (2) missing or weak keywords/skills compared to the roles above, (3) resume structure/section organization, (4) ATS formatting issues (tables, columns, graphics, unusual fonts, headers/footers that ATS parsers drop), (5) clarity/conciseness of bullet wording (weak verbs, passive voice, run-on lines), (6) inconsistencies (dates, tense, capitalization, terminology), (7) gaps worth addressing (certifications, notable projects, links to GitHub/portfolio), (8) tailoring advice for the specific job stack detected above.
- Each bullet should be a single sentence, specific enough that the candidate knows exactly what to change and why.
- PLAIN TEXT ONLY inside each string — no markdown at all (no "*", "**", "_", "-", bullet dashes, or numbering). If you want to reference a project/skill name, just write it in plain words, e.g. Customer Churn Prediction, not *Customer Churn Prediction*.
- Each array entry must be one COMPLETE, self-contained bullet from start to finish. Never split one sentence across two or more array entries (e.g. never put the sentence's opening words in one entry and the rest of that same sentence in the next entry) — that produces broken half-sentences in the UI.`;
}

// -----------------------------------------------------------------------
// Structured-output schema. Constraining Gemini's output to this schema
// (via generationConfig.responseSchema + responseMimeType: "application/json")
// is what actually fixes the intermittent "Expected ',' or '}' ..." parse
// errors — instead of hoping the model's free-form text happens to be
// valid JSON and patching it up afterwards, the API guarantees the shape.
// -----------------------------------------------------------------------
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          atsScore: { type: SchemaType.INTEGER },
          matchPercent: { type: SchemaType.INTEGER },
          matchedSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          missingSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["id", "atsScore", "matchPercent", "matchedSkills", "missingSkills"],
      },
    },
    overallAtsScore: { type: SchemaType.INTEGER },
    suggestedImprovements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["results", "overallAtsScore", "suggestedImprovements"],
};

// -----------------------------------------------------------------------
// Safety net: even with responseSchema, keep a repair-tolerant parser
// rather than a bare JSON.parse, in case of a transport hiccup (e.g. a
// response cut off by a network error rather than the model itself).
// -----------------------------------------------------------------------
let jsonrepair = null;
try {
  // Optional dependency — much more robust than hand-rolled regex fixes
  // (handles missing commas, truncated arrays/objects, unescaped quotes,
  // stray text, etc). Run `npm install jsonrepair` in backend/ to enable.
  // Falls back to the regex-only repair below if it isn't installed yet.
  ({ jsonrepair } = require("jsonrepair"));
} catch (e) {
  jsonrepair = null;
}

function extractPositionFromSyntaxError(message) {
  const m = /position (\d+)/i.exec(message || "");
  return m ? Number(m[1]) : null;
}

function safeJsonParse(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const pos = extractPositionFromSyntaxError(err.message);
    if (pos !== null) {
      // Log what Gemini actually sent around the failure point, so if
      // this keeps happening we can see the real cause instead of
      // guessing (e.g. a stray unescaped quote, a cut-off array, etc).
      const snippet = cleaned.slice(Math.max(0, pos - 80), pos + 80);
      console.error(`JSON parse failed at position ${pos}. Context: ...${snippet}...`);
    }

    if (jsonrepair) {
      try {
        return JSON.parse(jsonrepair(cleaned));
      } catch (repairErr) {
        console.error("jsonrepair also failed:", repairErr.message);
      }
    }

    // Last-resort regex repair: strip trailing commas before ] or }, the
    // single most common way "almost valid" JSON fails to parse.
    const repaired = cleaned.replace(/,(\s*[\]}])/g, "$1");
    return JSON.parse(repaired);
  }
}

// -----------------------------------------------------------------------
// Safety net for the "Suggested Improvements" formatting bug: even with
// the prompt instructions above and a strict JSON schema, Gemini can
// still slip back into markdown-list habits INSIDE the JSON array — e.g.
// turning one sentence like:
//   "Quantify the impact of the *Customer Churn Prediction* project by
//    stating the business value achieved."
// into THREE separate array entries: the text before the emphasized
// term, the term itself, and the text after — because that's how it'd
// visually lay out the same emphasis in a normal markdown response. Each
// entry then renders as its own bullet in the UI, which is why one
// suggestion appeared to explode into several broken half-sentence
// lines.
//
// This repairs it regardless of what the model actually sent back:
// strip any stray markdown characters, glue every fragment back into
// one block of text (fragments don't carry their own sentence-ending
// punctuation), then re-split ONLY on real sentence boundaries.
// -----------------------------------------------------------------------
function cleanSuggestedImprovements(list) {
  if (!Array.isArray(list) || list.length === 0) return [];

  const joined = list
    .map((s) => String(s ?? "").replace(/[*_`#]/g, "").replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!joined) return [];

  // Split on ". " / "! " / "? " only when followed by a capital letter —
  // keeps abbreviations/decimals ("e.g.", "3.5 years") from being split.
  const sentences = joined
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);

  return sentences.length ? sentences : [joined];
}

/**
 * Local fallback scorer used if no Gemini API key is set or the AI call fails.
 * Also stack-aware now, and uses whole-word matching (same fix as the shortlist).
 */
function localFallbackScore(resumeText, jobs, primaryStacks) {
  const resumeLower = resumeText.toLowerCase();
  return jobs.map((job) => {
    const skills = job.skills || [];
    const matched = skills.filter((s) => s && wordMatch(resumeLower, s));
    const missing = skills.filter((s) => !matched.includes(s));
    let matchPercent = skills.length ? Math.round((matched.length / skills.length) * 100) : 40;

    if (primaryStacks.length) {
      if (primaryStacks.includes(job.jobType)) {
        matchPercent = Math.min(100, matchPercent + 15);
      } else {
        matchPercent = Math.max(0, matchPercent - 20);
      }
    }

    const atsScore = Math.min(100, Math.round(matchPercent * 0.9 + 10));
    return {
      id: String(job._id),
      atsScore,
      matchPercent,
      matchedSkills: matched,
      missingSkills: missing,
    };
  });
}

async function analyzeResumeAgainstJobs(resumeText, jobs, shortlistSize = 40) {
  const primaryStacks = detectPrimaryStacks(resumeText);
  const shortlisted = localShortlist(resumeText, jobs, shortlistSize);

  if (!genAI) {
    const results = localFallbackScore(resumeText, shortlisted, primaryStacks);
    return {
      overallAtsScore: 65,
      suggestedImprovements: [
        "Add a GEMINI_API_KEY in backend/.env to enable full AI-powered analysis.",
        "Quantify achievements with numbers and metrics.",
        "Ensure key skills from target job descriptions appear in your resume.",
      ],
      results,
    };
  }

  // Try a short list of current model names in order, in case one has been
  // retired/renamed on Google's side — avoids a full outage from a single
  // deprecated model id (this bit us once already with gemini-2.0-flash).
  // Also serves as a fallback when one model's free-tier request quota for
  // the day is exhausted (Google enforces this per-model, so a 429 on
  // gemini-2.5-flash doesn't mean gemini-flash-latest is also blocked).
  // gemini-2.5-flash-lite is deliberately NOT in this list — Google retired
  // it for new API keys (404 "no longer available to new users"), so it
  // was a guaranteed-dead hop that just wasted a full retry cycle (and its
  // own delay) on every single call before ever reaching a model that works.
  const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-flash-latest"];
  let lastErr = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      // Shortlists can run up to 300 jobs (Pro users unlocking 60/80/100
      // matches send a proportionally bigger shortlist — see
      // resumeController.js's `shortlistSize = total * 2`). Measured real
      // usage: ~187 tokens per scored job object. Budget generously above
      // that (300/job + fixed overhead for the overall score + 8-10
      // suggestion bullets) so larger unlock requests don't hit
      // MAX_TOKENS mid-response — a truncated response is worse than a
      // slower one, since everything after the cutoff (overallAtsScore,
      // suggestedImprovements) is silently lost, not just delayed.
      // gemini-2.5-flash supports up to 65,535 output tokens; stay under
      // that with a safety margin.
      const estimatedTokens = 4000 + shortlisted.length * 300;
      const maxOutputTokens = Math.min(65000, Math.max(8000, estimatedTokens));

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens,
          // Structured output: this is what stops the model from ever
          // emitting invalid JSON (stray commas, unescaped characters,
          // markdown fences, mismatched object shapes) in the first place.
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          // IMPORTANT: thinkingConfig must live INSIDE generationConfig.
          // It was previously passed as a sibling field on the model
          // params object, which isn't part of the API's schema there —
          // the SDK silently dropped it, so "thinking" was never actually
          // disabled. Gemini 2.5 Flash models spend part of the output
          // token budget on invisible reasoning tokens by default, which
          // was quietly eating into the budget meant for the JSON
          // response and truncating it mid-generation (the actual cause
          // of the intermittent malformed-JSON / missing-fields errors).
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      const prompt = buildPrompt(resumeText, shortlisted, primaryStacks);

      let parsed = null;
      let parseErr = null;
      // Try twice on the SAME model before moving to the next candidate —
      // a malformed JSON response is often a one-off decoding hiccup, and
      // retrying is cheaper/faster than falling all the way back to the
      // local keyword scorer.
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        try {
          const response = await model.generateContent(prompt);
          const usage = response.response.usageMetadata;
          if (usage) {
            console.log(
              `Gemini usage [${modelName}]: output=${usage.candidatesTokenCount ?? "?"}, ` +
              `thinking=${usage.thoughtsTokenCount ?? 0}, total=${usage.totalTokenCount ?? "?"}, ` +
              `finishReason=${response.response.candidates?.[0]?.finishReason ?? "?"}`
            );
          }
          const text = response.response.text();
          parsed = safeJsonParse(text);
        } catch (err) {
          parseErr = err;
          console.error(`Parse attempt ${attempt + 1} failed for model "${modelName}":`, err.message);
        }
      }
      if (!parsed) throw parseErr;

      return {
        overallAtsScore: parsed.overallAtsScore ?? 70,
        suggestedImprovements: cleanSuggestedImprovements(parsed.suggestedImprovements ?? []),
        results: parsed.results ?? [],
      };
    } catch (err) {
      lastErr = err;
      console.error(`Gemini call failed for model "${modelName}":`, err.status || "", err.message);
      // Try the next candidate on: model not found/retired, OR a 429 quota/
      // rate-limit hit (per-model daily quota — another model may still
      // have headroom). Anything else (bad request, auth, etc.) isn't
      // going to succeed on a different model either, so stop retrying.
      const notFound = err.status === 404 || /not found|not supported/i.test(err.message || "");
      const rateLimited = err.status === 429 || /quota|rate limit|too many requests/i.test(err.message || "");
      if (!notFound && !rateLimited) break;
    }
  }

  console.error("All Gemini model attempts failed, using local fallback. Last error:", lastErr?.message);
  const quotaExhausted = lastErr?.status === 429 || /quota|rate limit|too many requests/i.test(lastErr?.message || "");
  const results = localFallbackScore(resumeText, shortlisted, primaryStacks);
  return {
    overallAtsScore: 65,
    suggestedImprovements: [
      quotaExhausted
        ? "AI provider's daily free-tier request limit was reached — showing keyword-based match instead. Try again later, or ask the site owner to enable billing on the Gemini API key."
        : "AI analysis temporarily unavailable — showing keyword-based match instead.",
    ],
    results,
  };
}

module.exports = { analyzeResumeAgainstJobs };