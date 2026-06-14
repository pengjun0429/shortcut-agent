export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/api/leaderboard' && request.method === 'GET') {
        return handleGetLeaderboard(env, corsHeaders);
      }
      if (path === '/api/leaderboard' && request.method === 'POST') {
        return handlePostScore(request, env, corsHeaders);
      }
      if (path === '/api/user' && request.method === 'GET') {
        return handleGetUser(request, env, corsHeaders);
      }
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// ============ GET: Top 10 leaderboard ============
async function handleGetLeaderboard(env, corsHeaders) {
  const { results } = await env.DB.prepare(
    `SELECT id, google_id, name, score, time, cleared, max_combo, created_at
     FROM leaderboard ORDER BY score DESC LIMIT 10`
  ).all();

  return new Response(JSON.stringify({ leaderboard: results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============ POST: Submit a score ============
async function handlePostScore(request, env, corsHeaders) {
  const body = await request.json();
  const { name, score, time, cleared, max_combo, google_id, email, avatar_url } = body;

  if (!name || typeof score !== 'number') {
    return new Response(JSON.stringify({ error: 'Invalid input' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Upsert user if google_id provided
  if (google_id) {
    await env.DB.prepare(
      `INSERT INTO users (google_id, name, email, avatar_url)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(google_id) DO UPDATE SET name=excluded.name, email=excluded.email, avatar_url=excluded.avatar_url`
    ).bind(google_id, name, email || '', avatar_url || '').run();
  }

  // Insert score
  await env.DB.prepare(
    `INSERT INTO leaderboard (google_id, name, score, time, cleared, max_combo)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(google_id || null, name, score, time || 0, cleared || 0, max_combo || 0).run();

  // Get rank
  const { results } = await env.DB.prepare(
    'SELECT COUNT(*) as rank FROM leaderboard WHERE score > ?'
  ).bind(score).all();

  const rank = (results[0]?.rank || 0) + 1;

  // Discord webhook for top 3
  if (rank <= 3) {
    await sendDiscordWebhook(env, name, score, time, cleared, max_combo, rank);
  }

  return new Response(JSON.stringify({ success: true, rank }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============ GET: User profile ============
async function handleGetUser(request, env, corsHeaders) {
  const url = new URL(request.url);
  const googleId = url.searchParams.get('google_id');
  if (!googleId) {
    return new Response(JSON.stringify({ error: 'Missing google_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { results } = await env.DB.prepare(
    'SELECT google_id, name, avatar_url FROM users WHERE google_id = ?'
  ).bind(googleId).all();

  if (results.length === 0) {
    return new Response(JSON.stringify({ user: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get personal best
  const { results: pb } = await env.DB.prepare(
    'SELECT MAX(score) as best_score, COUNT(*) as games FROM leaderboard WHERE google_id = ?'
  ).bind(googleId).all();

  return new Response(JSON.stringify({
    user: results[0],
    best_score: pb[0]?.best_score || 0,
    games: pb[0]?.games || 0,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============ Discord Webhook ============
async function sendDiscordWebhook(env, name, score, time, cleared, max_combo, rank) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const medals = { 1: '1st', 2: '2nd', 3: '3rd' };
  const medal = medals[rank] || `#${rank}`;
  const timeStr = formatTime(time || 0);

  const embed = {
    title: `${medal} NEW HIGH RANK — #${rank}`,
    description: `**${name}** just broke into the top 3!`,
    color: rank === 1 ? 0xffd700 : rank === 2 ? 0xc0c0c0 : 0xcd7f32,
    fields: [
      { name: 'Score', value: String(score), inline: true },
      { name: 'Uptime', value: timeStr, inline: true },
      { name: 'Threats Cleared', value: String(cleared || 0), inline: true },
      { name: 'Max Combo', value: `x${max_combo || 0}`, inline: true },
    ],
    footer: { text: '快捷鍵特工 — OS 密碼戰' },
    timestamp: new Date().toISOString(),
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'OS Core Alert',
      embeds: [embed],
    }),
  });
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}
