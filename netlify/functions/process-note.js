exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "No API key configured on the server" }) };
  }

  let text;
  try {
    text = JSON.parse(event.body).text;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing note text" }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = `You are helping a UK tradesman turn a messy spoken voice note into structured job outputs.
Today's date is ${today}. Only use what is actually mentioned in the note - never invent details, names, amounts, addresses or phone numbers.
Respond ONLY with valid JSON, no other text, in exactly this shape:
{
  "job": "short job description or null",
  "work": "what was found or done, one short sentence or null",
  "address": "job address if mentioned, or null",
  "materials": "parts/materials description or null",
  "materials_cost": "numeric materials cost in pounds if mentioned, or null",
  "followup_text": "any date/time to go back, in the tradesman's own words, or null",
  "followup_date": "that date worked out as YYYY-MM-DD using today's date, or null",
  "followup_time": "a time if one was mentioned, or null",
  "customer_name": "customer's name if mentioned, or null",
  "customer_phone": "phone number if mentioned, or null",
  "customer_update": "a short friendly message to the customer confirming the plan, phrased to invite confirmation (e.g. ending with something like 'if that still works for you'), only if there is a customer-facing update to give, or null",
  "worth_checking": ["short items worth confirming before the job, like confirming access or equipment - your own sensible suggestions based on the situation, not things stated in the note - empty array if nothing sensible to suggest"],
  "other_actions": "any other admin action mentioned, as a short sentence, or null"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: text }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data }) };
    }

    const raw = data.content.map(b => b.text || "").join("").trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: cleaned
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
