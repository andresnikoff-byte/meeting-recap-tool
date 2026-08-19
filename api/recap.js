const MAX_TRANSCRIPT_CHARS = 20000;

const SYSTEM_PROMPT = `You turn messy meeting/call transcripts into a clean, useful recap.
Read the transcript and respond with ONLY a JSON object (no markdown fences, no commentary) shaped exactly like this:

{
  "summary": "2-4 sentence plain-English summary of what the meeting was about and what was decided.",
    "actionItems": [
        { "owner": "Name or role if mentioned, otherwise 'Unassigned'", "task": "Clear, specific action item phrased as a to-do." }
          ],
            "topics": ["short topic tag", "short topic tag"]
            }

            Rules:
            - Extract action items only when the transcript actually implies a task, decision, or follow-up. Do not invent tasks that weren't discussed.
            - If there are no clear action items, return an empty array for actionItems.
            - Keep "topics" to at most 5 short tags (1-3 words each).
            - Never include text outside the JSON object.`;

async function readJsonBody(req) {
    if (req.body && typeof req.body === "object") return req.body;
    return await new Promise((resolve, reject) => {
          let data = "";
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => {
                  try {
                            resolve(data ? JSON.parse(data) : {});
                  } catch (err) {
                            reject(err);
                  }
          });
          req.on("error", reject);
    });
}

async function incrCounter(key) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return;
    try {
          await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
                  headers: { Authorization: `Bearer ${token}` },
          });
    } catch {
          // Usage tracking is best-effort; never fail the request over it.
    }
}

function extractJson(text) {
    const trimmed = text.trim();
    try {
          return JSON.parse(trimmed);
    } catch {
          const match = trimmed.match(/\{[\s\S]*\}/);
          if (match) return JSON.parse(match[0]);
          throw new Error("Model did not return valid JSON");
    }
}

// --- Provider: Google Gemini (default — free tier, no card required) ---
// Free tier as of 2026: ~1,500 requests/day, no billing needed to start.
// Get a key at https://aistudio.google.com (API keys section).
async function callGemini(transcript) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
          return { error: { status: 500, message: "The tool isn't fully configured yet (missing Gemini API key)." } };
    }
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                      contents: [{ parts: [{ text: transcript }] }],
                      generationConfig: { responseMimeType: "application/json" },
            }),
    }
      );

  if (res.status === 429) {
        return {
                error: {
                          status: 429,
                          message: "This free tool hit its usage limit for the moment — try again in a few minutes.",
                },
        };
  }
    if (!res.ok) {
          const errText = await res.text();
          console.error("Gemini API error:", res.status, errText);
          return { error: { status: 502, message: "The AI provider returned an error. Try again in a moment." } };
    }

  const data = await res.json();
    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
          data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
          data.candidates[0].content.parts[0].text;

  if (!text) {
        return { error: { status: 502, message: "No response from the model." } };
  }
    return { text };
}

// --- Provider: Anthropic Claude (optional — paid, higher quality/quota) ---
// Roughly $0.003-0.005 per recap on Haiku at typical transcript lengths.
async function callAnthropic(transcript) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
          return { error: { status: 500, message: "The tool isn't fully configured yet (missing Anthropic API key)." } };
    }
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
                "content-type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
                model,
                max_tokens: 1024,
                system: SYSTEM_PROMPT,
                messages: [{ role: "user", content: transcript }],
        }),
  });

  if (res.status === 429) {
        return {
                error: {
                          status: 429,
                          message: "This free tool hit its usage limit for the moment — try again in a few minutes.",
                },
        };
  }
    if (!res.ok) {
          const errText = await res.text();
          console.error("Anthropic API error:", res.status, errText);
          return { error: { status: 502, message: "The AI provider returned an error. Try again in a moment." } };
    }

  const data = await res.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock || !textBlock.text) {
          return { error: { status: 502, message: "No response from the model." } };
    }
    return { text: textBlock.text };
}

module.exports = async (req, res) => {
    if (req.method !== "POST") {
          res.status(405).json({ error: "Method not allowed" });
          return;
    }

    let body;
    try {
          body = await readJsonBody(req);
    } catch {
          res.status(400).json({ error: "Invalid request body." });
          return;
    }

    const transcript = ((body && body.transcript) || "").trim();

    if (!transcript) {
          res.status(400).json({ error: "Paste a transcript first." });
          return;
    }
    if (transcript.length < 40) {
          res.status(400).json({
                  error: "That looks too short to be a transcript — paste more of the conversation.",
          });
          return;
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
          res.status(400).json({
                  error: `Transcripts are capped at ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters on the free tool right now. Trim it down and try again.`,
          });
          return;
    }

    // AI_PROVIDER defaults to "gemini" so a fresh deploy costs $0 to run.
    // Set AI_PROVIDER=anthropic (and ANTHROPIC_API_KEY) to switch later.
    const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

    try {
          const call = provider === "anthropic" ? callAnthropic : callGemini;
          const { text, error } = await call(transcript);

      if (error) {
              res.status(error.status).json({ error: error.message });
              return;
      }

      const parsed = extractJson(text);
          const result = {
                  summary: parsed.summary || "",
                  actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
                  topics: Array.isArray(parsed.topics) ? parsed.topics : [],
          };

      const today = new Date().toISOString().slice(0, 10);
          await Promise.all([incrCounter("total_recaps"), incrCounter(`recaps:${today}`)]);

      res.status(200).json(result);
    } catch (err) {
          console.error("Recap generation failed:", err);
          res.status(500).json({ error: "Something went wrong generating the recap. Try again." });
    }
};
