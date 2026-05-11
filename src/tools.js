const { evaluate } = require('mathjs');
const config = require('./config');

/**
 * Tool schema mengikuti format OpenAI/Groq tool calling.
 */
const TOOL_SCHEMAS = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description:
        'Evaluate a mathematical expression. Supports arithmetic, parentheses, trigonometric, logarithm, exponents, units, etc. Use this whenever exact numeric answers are needed.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              'The mathematical expression to evaluate, e.g. "2 + 2 * sin(pi/4)" or "125 * 1.11".',
          },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_datetime',
      description:
        'Get the current date and time. Use when user asks about the current time, today\'s date, day of the week, etc.',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description:
              'IANA timezone name, e.g. "Asia/Jakarta", "UTC", "America/Los_Angeles". Defaults to server default.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        'Search the web for up-to-date information. Use this when the user asks about recent events, news, live data, or anything beyond your training cutoff.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Concise search query in the language the user asked.',
          },
          max_results: {
            type: 'integer',
            description: 'Number of results to return (1-10). Default 5.',
          },
        },
        required: ['query'],
      },
    },
  },
];

/**
 * Calculator — pakai mathjs, sudah cukup aman untuk ekspresi publik
 * (tidak mengeksekusi JS arbitrer).
 */
function calculator({ expression }) {
  if (!expression || typeof expression !== 'string') {
    return { error: 'Argument "expression" (string) is required.' };
  }
  try {
    const result = evaluate(expression);
    // mathjs dapat mengembalikan BigNumber, Complex, Matrix, dll.
    const formatted =
      typeof result === 'object' && result !== null && typeof result.toString === 'function'
        ? result.toString()
        : String(result);
    return { expression, result: formatted };
  } catch (err) {
    return { error: `Gagal evaluate: ${err.message}` };
  }
}

/**
 * Get current datetime in the requested timezone.
 */
function getCurrentDatetime({ timezone } = {}) {
  const tz = timezone || config.DEFAULT_TIMEZONE;
  const now = new Date();
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      dateStyle: 'full',
      timeStyle: 'long',
    });
    return {
      timezone: tz,
      iso_utc: now.toISOString(),
      local: fmt.format(now),
      unix_ms: now.getTime(),
    };
  } catch (err) {
    return { error: `Invalid timezone "${tz}": ${err.message}` };
  }
}

/**
 * Web search — Tavily jika TAVILY_API_KEY tersedia, selain itu pakai
 * DuckDuckGo Instant Answer API (terbatas, tapi tidak perlu key).
 */
async function webSearch({ query, max_results }) {
  if (!query) return { error: 'Argument "query" is required.' };
  const max = Math.min(Math.max(parseInt(max_results) || 5, 1), 10);

  if (config.TAVILY_API_KEY) {
    return tavilySearch(query, max);
  }
  return duckduckgoSearch(query, max);
}

async function tavilySearch(query, max) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: max,
        include_answer: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { error: `Tavily error ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    return {
      provider: 'tavily',
      answer: data.answer || null,
      results: (data.results || []).slice(0, max).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      })),
    };
  } catch (err) {
    return { error: `Tavily request failed: ${err.message}` };
  }
}

async function duckduckgoSearch(query, max) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'telegram-ai-agent/1.0' },
    });
    if (!res.ok) {
      return { error: `DuckDuckGo error ${res.status}` };
    }
    const data = await res.json();

    const results = [];
    if (data.AbstractText) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL || '',
        snippet: data.AbstractText,
      });
    }
    for (const rt of data.RelatedTopics || []) {
      if (results.length >= max) break;
      if (rt.Text && rt.FirstURL) {
        results.push({ title: rt.Text.slice(0, 80), url: rt.FirstURL, snippet: rt.Text });
      } else if (rt.Topics && Array.isArray(rt.Topics)) {
        for (const t of rt.Topics) {
          if (results.length >= max) break;
          if (t.Text && t.FirstURL) {
            results.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text });
          }
        }
      }
    }

    return {
      provider: 'duckduckgo',
      note:
        results.length === 0
          ? 'DuckDuckGo Instant Answer tidak mengembalikan hasil. Pertimbangkan set TAVILY_API_KEY untuk hasil lebih baik.'
          : undefined,
      results,
    };
  } catch (err) {
    return { error: `DuckDuckGo request failed: ${err.message}` };
  }
}

/**
 * Executor: panggil tool berdasarkan nama.
 */
async function executeTool(name, args) {
  switch (name) {
    case 'calculator':
      return calculator(args || {});
    case 'get_current_datetime':
      return getCurrentDatetime(args || {});
    case 'web_search':
      return await webSearch(args || {});
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { TOOL_SCHEMAS, executeTool };
