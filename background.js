// AI Prompt Optimizer Pro - Service Worker
// Manages Groq API completions and prompt optimization pipelines

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";


// Helper function to build custom prompt optimization prompts depending on style
function getSystemPrompt(style, customRules) {
  let instructions = "";
  
  switch(style) {
    case "supercharged":
      instructions = 
        "You are an elite, world-class Prompt Engineer. Your objective is to rewrite the user's draft prompt " +
        "to make it extremely clear, detailed, and highly effective. Keep the original core intent intact, but:\n" +
        "1. Structure it logically using sections like [Context], [Objective], [Constraints], and [Output Format].\n" +
        "2. Instruct the AI to think step-by-step or conduct analytical planning.\n" +
        "3. Specify clear formatting guides (e.g., Markdown headers, code blocks, bullet points).\n" +
        "4. Remove all vague, ambiguous, or wordy phrasing.";
      break;
      
    case "roleplayer":
      instructions = 
        "You are an elite, world-class Prompt Engineer. Your objective is to cast the AI into a powerful, specialized persona " +
        "to solve the user's task with expert-level authority. Keep the original core intent intact, but:\n" +
        "1. Explicitly define a top-tier professional role (e.g. Senior Software Architect, Elite Conversion Copywriter, Senior Research Scientist).\n" +
        "2. Outline the expert's background, analytical approach, and critical mindset.\n" +
        "3. Provide distinct instructions to identify common pitfalls or edge cases in their solution.\n" +
        "4. Structure the rest of the prompt beautifully for detailed, constructive outputs.";
      break;
      
    case "concise":
      instructions = 
        "You are an elite, world-class Prompt Engineer. Your objective is to optimize the user's prompt for speed, clarity, " +
        "and maximum density of intent. Keep the original core intent intact, but:\n" +
        "1. Strip out all redundant phrases, throat-clearing, and introductory greetings.\n" +
        "2. Formulate highly specific, direct command verbs.\n" +
        "3. Structure instructions into clean checklists or brief bullet points.\n" +
        "4. Enforce high accuracy and short, punchy responses.";
      break;
      
    case "creative":
      instructions = 
        "You are an elite, world-class Prompt Engineer. Your objective is to optimize the prompt to trigger highly imaginative, " +
        "innovative, and out-of-the-box responses from the AI. Keep the original core intent intact, but:\n" +
        "1. Prompt the AI to explore unconventional angles, multiple distinct viewpoints, or bold ideas.\n" +
        "2. Request illustrative analogies, rich descriptions, or creative scenarios.\n" +
        "3. Specifically ask the AI to avoid standard cliches and predictable structures.\n" +
        "4. Structure guidelines to balance high imagination with logical utility.";
      break;
      
    default:
      instructions = "You are a world-class prompt engineer. Refine the user's prompt for optimal clarity and effectiveness.";
  }

  const CORE_RULES = 
    "\n\n" +
    "You MUST strictly follow these CORE PROMPT OPTIMIZATION RULES during rewriting:\n" +
    "1. Remove garbage: Strip conversational greetings (e.g., 'hey', 'please', 'I hope...'), unnecessary politeness, and duplicate/repetitive phrasing.\n" +
    "2. Compress language: Convert long sentences into short, direct commands. Eliminate filler words.\n" +
    "3. Keep only relevant context: Retain only information necessary for the output. Delete extra background information.\n" +
    "4. Structure > Paragraph: Convert raw paragraphs into bullet points, numbered steps, or explicit constraints.\n" +
    "5. Use explicit constraints: Instead of long explanations, use brief tags (e.g., '[max 100 words]', '[bullet points]', '[beginner level]', '[code only]'). This saves tokens and sharpens output control.\n" +
    "6. Deduplicate aggressively: Remove duplicate ideas or statements, checking for synonym overlap.\n" +
    "7. Replace verbose phrases: Use concise equivalents (e.g., replace 'in order to' with 'to', 'due to the fact that' with 'because', 'a large number of' with 'many').\n" +
    "8. Convert intent to command: Change natural language descriptions to instruction style (e.g., instead of 'I want you to act as a teacher and explain...', write 'Explain as a teacher: ...').\n" +
    "9. Use placeholders: Avoid repeating target audiences/contexts (e.g., use 'For [Target Audience]:' and reference it as a placeholder).\n" +
    "10. Context pruning: If the prompt exceeds a reasonable length, prune or summarize the least important lines.\n" +
    "11. Instruction merging: Merge multiple separate instructions into a single cohesive line (e.g., merge 'Explain simply. Keep it short. Use bullets.' into 'Explain simply in short bullet points.').";

  instructions += CORE_RULES;

  if (customRules && customRules.trim()) {
    instructions += `\n\nCRITICAL CONSTRAINTS (You MUST integrate these custom directives into the final optimized prompt structure):\n- ${customRules.trim().split('\n').join('\n- ')}`;
  }

  // Enforce structural clean-up for the final output
  instructions += "\n\nOutput ONLY the final optimized prompt text. Do not include any chat filler, conversational introductions, or meta-comments explaining what changes you made. Simply write the ready-to-use prompt.";
  
  return instructions;
}

// Listen for messages from Content Script or Popup UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "optimize") {
    handleOptimization(message, sendResponse);
    return true; // Keep the message channel open for asynchronous response
  }
});

// Primary Optimization pipeline using Groq API
async function handleOptimization(message, sendResponse) {
  try {
    const { prompt, style, customRules, apiKeyFallback } = message;
    
    if (!prompt || !prompt.trim()) {
      sendResponse({ success: false, error: "Empty prompt provided." });
      return;
    }

    // Retrieve Groq API Key from chrome.storage.local
    let apiKey = "";
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const storageData = await new Promise((resolve) => {
        chrome.storage.local.get(["groqApiKey"], resolve);
      });
      apiKey = storageData.groqApiKey;
    }
    
    // Fallback to in-transit key
    if (!apiKey && apiKeyFallback) {
      apiKey = apiKeyFallback.trim();
    }

    // Fail gracefully if no key is configured
    if (!apiKey) {
      sendResponse({ success: false, error: "Groq API key not configured. Please enter a valid key in the extension settings." });
      return;
    }

    const systemPrompt = getSystemPrompt(style || "supercharged", customRules);
    
    // Groq OpenAI-compatible Chat Completions endpoint
    const url = "https://api.groq.com/openai/v1/chat/completions";

    const requestBody = {
      model: DEFAULT_GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Draft prompt to optimize:\n\n"""\n${prompt}\n"""`
        }
      ],
      temperature: 0.3,
      max_tokens: 2048
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errDetails = await response.json().catch(() => ({}));
      const errMessage = errDetails.error?.message || `HTTP status ${response.status}`;
      sendResponse({ success: false, error: `Groq API returned error: ${errMessage}` });
      return;
    }

    const data = await response.json();
    const choices = data.choices || [];
    
    if (choices.length === 0 || !choices[0].message?.content) {
      sendResponse({ success: false, error: "Failed to generate optimized content from Groq API." });
      return;
    }

    const optimizedText = choices[0].message.content.trim();
    sendResponse({ success: true, optimized: optimizedText });

  } catch (error) {
    console.error("Error optimizing prompt via Groq:", error);
    sendResponse({ success: false, error: error.message || "Unknown error during Groq optimization." });
  }
}
