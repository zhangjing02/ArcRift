import axios from "axios";
import { logger } from "../utils/logger";
import { getSettings, resetSettingsCache } from "../utils/settings";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface Triple {
  subject: string;
  subjectType: string;
  relation: string;
  object: string;
  objectType: string;
}

export interface ProjectSummary {
  projectName: string;
  stack: string[];
  decisions: string[];
  features: string[];
  status: string;
  triples: Triple[];
}

const CHUNK_SIZE = 2000;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";
  for (const para of paragraphs) {
    if ((current + para).length > CHUNK_SIZE) {
      if (current.trim()) chunks.push(current.trim());
      current = para;
    } else {
      current += "\n\n" + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ── Smart Backend Selection & Dispatch ─────────────────────────────
let resolvedBackend: "ollama" | "groq" | "openai-compatible" | "gemini" | null = null;

export function _resetBackendForTest() {
  resolvedBackend = null;
  resetSettingsCache();
}

async function detectBackend(): Promise<"ollama" | "groq" | "openai-compatible" | "gemini"> {
  const envBackend = process.env.GRAPH_BACKEND?.toLowerCase();
  if (envBackend === "groq") return "groq";
  if (envBackend === "ollama") return "ollama";
  if (envBackend === "gemini") return "gemini";
  if (envBackend === "openai-compatible" || envBackend === "siliconflow" || envBackend === "deepseek") {
    return "openai-compatible";
  }

  const settings = getSettings();
  if (settings.chatProvider === "gemini") return "gemini";
  if (settings.chatProvider === "groq") return "groq";
  if (settings.chatProvider === "ollama") return "ollama";
  if (settings.apiKey && settings.apiKey.trim().length > 0) return "openai-compatible";

  // Auto-detect: probe Ollama
  try {
    const ollamaUrl = settings.apiBaseUrl?.includes("11434")
      ? settings.apiBaseUrl
      : (process.env.OLLAMA_URL ?? "http://localhost:11434");
    await axios.get(`${ollamaUrl.replace(/\/+$/, "")}/api/tags`, { timeout: 2000 });
    logger.success("[ArcRift] Ollama detected — graph extraction running locally");
    return "ollama";
  } catch {
    if (process.env.GROQ_API_KEY) {
      logger.warn("[ArcRift] Local Ollama not available — falling back to Groq API.");
      return "groq";
    }
    return "openai-compatible";
  }
}

async function getBackend(): Promise<"ollama" | "groq" | "openai-compatible" | "gemini"> {
  if (!resolvedBackend) {
    resolvedBackend = await detectBackend();
  }
  return resolvedBackend;
}

function getProxyConfig(targetUrl: string) {
  if (targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1")) {
    return false;
  }
  const proxyStr = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || "http://127.0.0.1:7897";
  if (!proxyStr) return false;
  try {
    const u = new URL(proxyStr);
    return {
      host: u.hostname,
      port: parseInt(u.port, 10),
      protocol: u.protocol.replace(":", ""),
    };
  } catch {
    return false;
  }
}

// ── Generic OpenAI-Compatible Chat Call ─────────────────────────────
async function callOpenAICompatible(
  prompt: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  maxTokens = 1000
): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const endpoint = cleanBase.endsWith("/chat/completions")
    ? cleanBase
    : `${cleanBase}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const proxy = getProxyConfig(endpoint);

  const response = await axios.post(
    endpoint,
    {
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.1,
    },
    {
      headers,
      timeout: 90000,
      ...(proxy ? { proxy } : {}),
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (content === undefined || content === null) {
    throw new Error("Chat completions API returned empty message content");
  }
  return content;
}

// ── Google Gemini Chat Call ──────────────────────────────────────────
async function callGemini(prompt: string, apiKey: string, model: string, maxTokens = 1000): Promise<string> {
  const modelName = model.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const proxy = getProxyConfig(url);

  const response = await axios.post(
    url,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.1,
      },
    },
    { timeout: 60000, ...(proxy ? { proxy } : {}) }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini generateContent returned empty response");
  }
  return text;
}

// ── Ollama LLM Call ──────────────────────────────────────────────────
async function callOllama(prompt: string, maxTokens = 1000): Promise<string> {
  const settings = getSettings();
  const ollamaUrl = (settings.apiBaseUrl?.includes("11434") ? settings.apiBaseUrl : process.env.OLLAMA_URL) ?? "http://localhost:11434";
  const model = settings.chatModel || settings.ollamaExtractionModel || process.env.OLLAMA_MODEL || "llama3.1:8b";
  const cleanUrl = ollamaUrl.replace(/\/+$/, "");

  const response = await axios.post(
    `${cleanUrl}/api/generate`,
    {
      model,
      prompt,
      stream: false,
      options: { num_predict: maxTokens, temperature: 0.1 },
    },
    { timeout: 90000 }
  );
  return response.data?.response ?? response.data?.choices?.[0]?.message?.content;
}

// ── Groq LLM Call ────────────────────────────────────────────────────
async function callGroq(prompt: string, maxTokens = 1000): Promise<string> {
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const apiKey = process.env.GROQ_API_KEY ?? "";
  return await callOpenAICompatible(
    prompt,
    "https://api.groq.com/openai/v1",
    apiKey,
    model,
    maxTokens
  );
}

// ── Unified LLM call with Retry & Fallback ───────────────────────────
async function _llm(prompt: string, maxTokens = 1000): Promise<string> {
  const settings = getSettings();
  const backend = await getBackend();
  const MAX_RETRIES = 2;
  let lastErr: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const waitTime = attempt * 3000;
        logger.info(`[ArcRift] LLM call retry ${attempt}/${MAX_RETRIES} in ${waitTime / 1000}s...`);
        await sleep(waitTime);
      }

      let res: string;

      if (backend === "ollama") {
        try {
          res = await callOllama(prompt, maxTokens);
        } catch (err: any) {
          const isDown =
            err.code === "ECONNREFUSED" ||
            err.code === "ENOTFOUND" ||
            err.message?.includes("ECONNREFUSED") ||
            err.message?.includes("connection refused");

          // Fallback to Groq or Cloud API if Ollama is down
          if (isDown && (process.env.GROQ_API_KEY || settings.apiKey)) {
            logger.warn(`[ArcRift] Ollama unreachable — falling back to cloud API.`);
            if (process.env.GROQ_API_KEY) {
              res = await callGroq(prompt, maxTokens);
            } else {
              res = await callOpenAICompatible(
                prompt,
                settings.apiBaseUrl || "https://api.siliconflow.cn/v1",
                settings.apiKey || "",
                settings.chatModel || "deepseek-ai/DeepSeek-V3",
                maxTokens
              );
            }
          } else {
            throw err;
          }
        }
      } else if (backend === "gemini") {
        const apiKey = settings.apiKey || process.env.GEMINI_API_KEY || "";
        res = await callGemini(prompt, apiKey, settings.chatModel || "gemini-1.5-flash", maxTokens);
      } else if (backend === "groq") {
        res = await callGroq(prompt, maxTokens);
      } else {
        // Default: OpenAI-compatible (SiliconFlow, DeepSeek, OpenAI, etc.)
        const baseUrl = settings.apiBaseUrl || "https://api.siliconflow.cn/v1";
        const apiKey = settings.apiKey || process.env.API_KEY || process.env.SILICONFLOW_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";
        const model = settings.chatModel || "deepseek-ai/DeepSeek-V3";
        res = await callOpenAICompatible(prompt, baseUrl, apiKey, model, maxTokens);
      }

      if (res === undefined || res === null || res.trim() === "") {
        throw new Error("Model returned empty response");
      }

      // Strip reasoning <think>...</think> tags if present (e.g. DeepSeek-R1)
      res = res.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      return res;
    } catch (err: any) {
      lastErr = err;
      const isRateLimit = err?.response?.status === 429 || err?.message?.includes("429");
      const isTimeout = err.code === "ECONNABORTED" || err.message?.includes("timeout");
      const isBadFormat = err?.message?.includes("JSON") || err?.message?.includes("formatting");

      if ((isRateLimit || isTimeout || isBadFormat) && attempt < MAX_RETRIES) {
        if (isTimeout) logger.warn(`[ArcRift] LLM timeout (attempt ${attempt + 1}). Retrying...`);
        if (isBadFormat) logger.warn("[ArcRift] Model returned malformed data. Retrying...");
        continue;
      }

      logger.error(`[ArcRift] LLM call failed: ${err.message}`);
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Unified LLM call with debug logging
 */
export async function llm(prompt: string, maxTokens = 1000): Promise<string> {
  const result = await _llm(prompt, maxTokens);
  if (process.env.DEBUG === "true") {
    logger.info(`[DEBUG] LLM Response (${result.length} chars): ${result.slice(0, 100)}...`);
  }
  return result;
}

// ── Step 1: Compress raw chat into ALL meaningful facts ────────────
export async function summarizeChunk(text: string): Promise<string> {
  const prompt = `You are a precision fact extractor. Read this conversation and extract ALL meaningful facts.

CRITICAL RULES:
- Preserve the EXACT nature of every relationship. Examples:
  * "I am a student at X" → fact: "User is a STUDENT at X" (NOT an employee)
  * "I work at X" → fact: "User WORKS AT X" (employee)
  * "I study X" → fact: "User STUDIES X"
  * "I am in semester N" → fact: "User is in semester N"
  * "I am building X" → fact: "User IS BUILDING X"
- Extract ALL of the following:
  * Academic facts: institution name, degree, semester/year, field of study, courses
  * Professional facts: job title, employer, projects, tech stack, decisions made
  * Personal facts: name, location, pets (with EXPLICIT animal type), preferences, goals, hobbies
  * Technical facts: technologies used, bugs encountered, features built, architecture choices
  * Named entities: project names, company names, product names, tool names
- Do NOT skip any named entity or relationship, even if it seems minor.
- Remove ONLY pure filler ("ok", "thanks", "sure") with zero information content.
- Output as a bullet list. Each bullet = one precise fact. Be specific.

Conversation:
"""
${text}
"""

Facts:`;

  return await llm(prompt, 800);
}

/**
 * Step 1.5: Extract entities from a search query for Hybrid RAG.
 */
export async function extractEntitiesFromQuery(query: string): Promise<string[]> {
  const prompt = `Extract entities from this search query. Be broad and include any potential projects, technologies, or people mentioned.
Return ONLY a JSON array of strings, or "none" if no entities are found.

Example: ["React", "arcrift", "Eshaan"]

Query: "${query}"

Entities:`;

  try {
    const raw = await llm(prompt, 100);
    if (!raw || raw.toLowerCase().includes("none")) return [];

    // 1. Try to parse as JSON first
    try {
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        const clean = raw.slice(start, end + 1).trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) {
          return parsed.map(e => String(e).trim()).filter(Boolean);
        }
      }
    } catch {
      // Fallback to manual parsing
    }

    // 2. Fallback cleanup
    return raw
      .replace(/[\[\]"]/g, "")
      .replace(/Entities:/gi, "")
      .split(",")
      .map(e => e.trim())
      .filter(e => {
        return (
          e.length > 0 &&
          e.length < 50 &&
          e.toLowerCase() !== "none" &&
          !e.toLowerCase().includes("not json")
        );
      });
  } catch (err) {
    logger.warn(`[ArcRift] Entity extraction failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

// ── Step 2: Extract triples from text/summary ───────────────────────
export async function extractTriplesFromText(text: string): Promise<Triple[]> {
  const prompt = `You are a precision fact extractor. Extract subject-relation-object triplets from the conversation below.

RULES:
1. Return ONLY raw JSON array.
2. If no facts found, return [].
3. Preserve specific technical terms.

EXAMPLES:
"I use React with Vite" → [{"subject":"User","subjectType":"Person","relation":"USES","object":"React","objectType":"Technology"},{"subject":"React","subjectType":"Technology","relation":"PAIRED_WITH","object":"Vite","objectType":"Technology"}]

Conversation Text:
"""
${text}
"""
JSON:`;

  const raw = await llm(prompt, 1500);

  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start !== -1 && end !== -1) {
      let clean = raw.slice(start, end + 1).trim();
      clean = clean.replace(/```json/gi, "").replace(/```/g, "");
      clean = clean.replace(/,\s*\]/g, "]").replace(/,\s*\}/g, "}");
      clean = clean.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
      clean = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
      return JSON.parse(clean) as Triple[];
    }
    return [];
  } catch {
    logger.warn(`[Extractor] Direct parse failed, falling back to empty list.`);
    return [];
  }
}

export async function extractTriplesFromSummary(summary: string): Promise<Triple[]> {
  const prompt = `Extract semantic triples from these facts.
Return ONLY a valid JSON array, no explanation, no markdown, no code fences.

Each triple MUST have these exact fields:
- subject: the main entity name (e.g. "Eshaan", "arcrift", "React", "User")
- subjectType: MUST be exactly one of:
  "Person" | "Pet" | "Organization" | "Location" | "Education"
  "Project" | "Technology" | "Feature" | "Bug" | "Decision"
  "Library" | "API" | "Database" | "Framework" | "Auth" | "Architecture"
  "Goal" | "Problem" | "Preference" | "Habit" | "Tool" | "Pattern" | "Concept"
- relation: UPPER_SNAKE_CASE. Choose the MOST ACCURATE from this list:
  Academic:    STUDIES_AT | ENROLLED_IN | IN_SEMESTER | STUDIES | GRADUATED_FROM | MAJORS_IN
  Personal:    IS_NAMED | OWNS | HAS_PET | LIVES_IN | LIVES_WITH | PREFERS | INTERESTED_IN | WANTS | KNOWS
  Professional: WORKS_AT | WORKS_ON | CREATED_BY | COLLABORATED_WITH | REPORTS_TO
  Technical:   USES | DEPENDS_ON | HAS_FEATURE | INTEGRATES_WITH | STORES_IN | RUNS_ON | AUTHENTICATES_WITH
  General:     IS_A | HAS | IS_BUILDING | IS_IN | PART_OF | DECIDED_TO | STRUGGLING_WITH | SOLVED_WITH
- object: the target entity name
- objectType: same valid values as subjectType

STRICT CLASSIFICATION RULES — read carefully:
1. STUDENT vs EMPLOYEE distinction (most important):
   - "student at X", "studying at X", "enrolled at X", "attend X" → relation MUST be STUDIES_AT
   - "work at X", "employed at X", "job at X" → relation MUST be WORKS_AT
   - NEVER use WORKS_AT for a student. NEVER use STUDIES_AT for an employee.
2. Semester / academic year → use IN_SEMESTER, objectType "Education"
3. Educational institutions (universities, colleges, schools) → objectType MUST be "Organization"
4. Field of study, degree, course → objectType MUST be "Education"
5. AI model names (Claude, Gemini, GPT, ChatGPT, Copilot, Llama, Mistral, Grok, Sonnet) → subjectType MUST be "Technology". NEVER "Person" or "Pet".
6. Only use "Pet" if the text EXPLICITLY says "my [animal]" or "I have a [animal named X]". Never infer pets from names alone.
7. Only use "Person" for real human beings explicitly identified as people.
8. Programming languages, frameworks, libraries, tools, APIs → ALWAYS "Technology".
9. Extract ALL relationships. If in doubt, include it.

EXAMPLES:
"User is a student at KIIT" → [{"subject":"User","subjectType":"Person","relation":"STUDIES_AT","object":"KIIT","objectType":"Organization"}]

Return ONLY raw JSON. No conversational filler. If no facts found, return [].

Facts:
"""
${summary}
"""
JSON:`;

  const raw = await llm(prompt, 1500);

  try {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");

    if (start !== -1 && end !== -1) {
      let clean = raw.slice(start, end + 1).trim();
      clean = clean.replace(/```json/gi, "").replace(/```/g, "");
      clean = clean.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
      clean = clean.replace(/,\s*\]/g, "]").replace(/,\s*\}/g, "}");
      clean = clean.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");

      return JSON.parse(clean) as Triple[];
    }

    const rawLower = raw.toLowerCase();
    if (rawLower.includes("none") || rawLower.includes("no facts") || raw.trim().length < 5) {
      return [];
    }

    return JSON.parse(raw.trim()) as Triple[];
  } catch {
    logger.warn(`[Extractor] JSON Parse failed. Model output: ${raw.slice(0, 100)}...`);
    throw new Error(`Bad formatting: No valid JSON array found in model output`);
  }
}

// ── Step 3: Generate structured project summary ─────────────────────
export async function generateProjectSummary(
  triples: Triple[],
  projectName: string
): Promise<string> {
  if (triples.length === 0) return "";

  const cappedTriples = triples.slice(0, 100);
  const tripleText = cappedTriples
    .map(t => `${t.subject} (${t.subjectType}) ${t.relation} ${t.object} (${t.objectType})`)
    .join("\n");

  const prompt = `Convert these knowledge graph triples into a concise, structured project context summary.
Format it as clean markdown that an AI assistant can quickly understand.
Be specific and technical. No fluff.

Project name: ${projectName}
Triples:
${tripleText}

Generate a structured summary with sections: Stack, Key Decisions, Features, and any other relevant sections.
Keep it under 200 words total.`;

  try {
    return await llm(prompt, 400);
  } catch {
    return triples
      .map(t => `- ${t.subject} ${t.relation.toLowerCase().replace(/_/g, " ")} ${t.object}`)
      .join("\n");
  }
}

export async function extractTriples(
  text: string,
  startIndex = 0
): Promise<{ triples: Triple[]; nextIndex: number }> {
  const chunks = chunkText(text);
  logger.info(`Processing ${chunks.length} chunk(s) for triple extraction...`);

  const allTriples: Triple[] = [];

  for (let i = startIndex; i < chunks.length; i++) {
    try {
      logger.info(`  chunk ${i + 1}/${chunks.length} — summarizing...`);
      const summary = await summarizeChunk(chunks[i]);
      await sleep(1000);

      const triples = await extractTriplesFromSummary(summary);
      allTriples.push(...triples);

      logger.info(`  chunk ${i + 1} → ${triples.length} triples`);
      if (i < chunks.length - 1) await sleep(1000);
    } catch (err: any) {
      logger.error(`chunk ${i + 1} failed:`, JSON.stringify(err?.response?.data || err?.message, null, 2));
    }
  }

  const seen = new Set<string>();
  const unique = allTriples.filter(t => {
    const key = `${t.subject}|${t.relation}|${t.object}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  logger.success(`Extracted ${unique.length} unique triples from ${chunks.length} chunks`);
  return { triples: unique, nextIndex: chunks.length };
}

export async function extractRelevantSnippets(prompt: string, chunks: string[]): Promise<string> {
  if (!chunks.length) return "";

  const context = chunks.map((c, i) => `[CHUNK ${i + 1}]\n${c}`).join("\n\n");

  const fullPrompt = `USER PROMPT: ${prompt}

TEXT CHUNKS:
${context}

Copy any sentences from the TEXT CHUNKS above that help answer the USER PROMPT.
If nothing matches, say "None".

Relevant parts:`;

  try {
    const responseText = await llm(fullPrompt, 1500);
    if (
      responseText.includes("None") ||
      responseText.includes("NO_RELEVANCE") ||
      responseText.trim().length < 5
    ) {
      return "";
    }
    return responseText.trim();
  } catch (err: any) {
    logger.warn(`[Extractor] Snippet extraction failed: ${err?.message || "Unknown error"}`);
    return chunks.join("\n...\n").slice(0, 2500);
  }
}

export async function summarizeContext(
  query: string,
  chunks: string[],
  facts: string[]
): Promise<string> {
  if (chunks.length === 0 && facts.length === 0) return "";

  const prompt = `You are a highly capable summarization assistant for a memory-augmented AI.
The user is asking a query. You have retrieved several raw memory chunks and knowledge graph facts that might contain the answer.
Your job is to read these raw fragments and synthesize a single, cohesive, highly-condensed prose summary that directly answers or relates to the user's query.
Do NOT just list the facts. Weave them into a tight narrative paragraph.
Exclude any fragments that are completely irrelevant to the query.
If none of the fragments are relevant to the query, simply reply "No relevant context found."

USER QUERY:
"${query}"

RAW GRAPH FACTS:
${facts.length > 0 ? facts.join("\n") : "None"}

RAW MEMORY CHUNKS:
${chunks.length > 0 ? chunks.map((c, i) => `[Chunk ${i + 1}]: ${c}`).join("\n\n") : "None"}

SUMMARY:`;

  try {
    const summary = await llm(prompt, 1000);
    return summary.trim();
  } catch (err: any) {
    logger.warn(`[Extractor] Context summarisation failed: ${err?.message || "Unknown error"}`);
    let fallback = chunks.join("\n\n");
    if (facts.length > 0) {
      fallback = `Facts:\n${facts.join("\n")}\n\n${fallback}`;
    }
    return fallback;
  }
}
