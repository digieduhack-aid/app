// Basic prompt templates.
const templates = {
  summarize: (text) => `Summarize the following text:\n\n${text}`,
  story:     (text) => `Rewrite the following as a short story:\n\n${text}`,
  explain5:  (text) => `Explain the following simply, as if to a 5-year-old:\n\n${text}`
};

document.getElementById("runButton").addEventListener("click", async () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  const promptType = document.getElementById("promptType").value;
  const inputText = document.getElementById("inputText").value;
  const output = document.getElementById("output");

  if (!apiKey) {
    output.textContent = "Please enter your OpenAI API key.";
    return;
  }
  if (!inputText) {
    output.textContent = "Please enter some text.";
    return;
  }

  output.textContent = "Working…";

  const prompt = templates[promptType](inputText);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      output.textContent = "Error from API:\n" + err;
      return;
    }

    const data = await response.json();
    output.textContent = data.choices?.[0]?.message?.content ?? "(no output)";

  } catch (err) {
    output.textContent = "Network or fetch error:\n" + err;
  }
});
