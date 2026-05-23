document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const apiKeyInput = document.getElementById("api-key-input");
  const togglePasswordBtn = document.getElementById("toggle-password");
  const saveSettingsBtn = document.getElementById("save-settings-btn");
  const saveStatusMsg = document.getElementById("save-status-msg");
  
  const styleRadios = document.querySelectorAll('input[name="opt-style"]');
  const toggleCustomRulesBtn = document.getElementById("toggle-custom-rules");
  const customRulesBody = document.getElementById("custom-rules-body");
  const customRulesInput = document.getElementById("custom-rules-input");
  
  const playgroundInput = document.getElementById("playground-input");
  const charCountInput = document.getElementById("char-count-input");
  const optimizeSandboxBtn = document.getElementById("optimize-sandbox-btn");
  const playgroundOutput = document.getElementById("playground-output");
  const copyOutputBtn = document.getElementById("copy-output-btn");
  const copyIcon = document.getElementById("copy-icon");
  const checkIcon = document.getElementById("check-icon");

  // Load Saved Settings from chrome.storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["groqApiKey", "optimizationStyle", "customRules"], (result) => {
      if (result.groqApiKey) {
        apiKeyInput.value = result.groqApiKey;
        updateStatusIndicator(true);
      } else {
        apiKeyInput.value = "";
        updateStatusIndicator(false);
      }
      
      if (result.optimizationStyle) {
        const targetRadio = document.querySelector(`input[name="opt-style"][value="${result.optimizationStyle}"]`);
        if (targetRadio) targetRadio.checked = true;
      }
      
      if (result.customRules) {
        customRulesInput.value = result.customRules;
        toggleAccordion(true);
      }
    });
  } else {
    // Local storage fallback for local browser testing outside of Chrome Extension context
    const cachedKey = localStorage.getItem("mock_groqApiKey");
    const cachedStyle = localStorage.getItem("mock_optimizationStyle");
    const cachedRules = localStorage.getItem("mock_customRules");
    
    if (cachedKey) {
      apiKeyInput.value = cachedKey;
      updateStatusIndicator(true);
    } else {
      apiKeyInput.value = "";
      updateStatusIndicator(false);
    }
    
    if (cachedStyle) {
      const targetRadio = document.querySelector(`input[name="opt-style"][value="${cachedStyle}"]`);
      if (targetRadio) targetRadio.checked = true;
    }
    if (cachedRules) {
      customRulesInput.value = cachedRules;
      toggleAccordion(true);
    }
  }

  // Toggle Password / API Key Visibility
  togglePasswordBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.getAttribute("type") === "password";
    apiKeyInput.setAttribute("type", isPassword ? "text" : "password");
  });

  // Save Settings & Credentials
  saveSettingsBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const activeStyle = document.querySelector('input[name="opt-style"]:checked').value;
    const rules = customRulesInput.value.trim();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        groqApiKey: apiKey,
        optimizationStyle: activeStyle,
        customRules: rules
      }, () => {
        showStatus("Credentials & settings saved!", "success");
        updateStatusIndicator(!!apiKey);
      });
    } else {
      // Local testing fallback
      localStorage.setItem("mock_groqApiKey", apiKey);
      localStorage.setItem("mock_optimizationStyle", activeStyle);
      localStorage.setItem("mock_customRules", rules);
      showStatus("Demo: Settings saved locally!", "success");
      updateStatusIndicator(!!apiKey);
    }
  });

  // Automatically save style selector changes immediately for rapid UX feedback
  styleRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const activeStyle = e.target.value;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ optimizationStyle: activeStyle });
      } else {
        localStorage.setItem("mock_optimizationStyle", activeStyle);
      }
    });
  });

  // Save custom instructions as they type (debounced)
  let rulesTimeout;
  customRulesInput.addEventListener("input", (e) => {
    clearTimeout(rulesTimeout);
    rulesTimeout = setTimeout(() => {
      const rules = e.target.value.trim();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ customRules: rules });
      } else {
        localStorage.setItem("mock_customRules", rules);
      }
    }, 500);
  });

  // Character Counter logic
  playgroundInput.addEventListener("input", () => {
    const count = playgroundInput.value.length;
    charCountInput.textContent = `${count} char${count !== 1 ? 's' : ''}`;
  });

  // Accordion Expand/Collapse logic
  toggleCustomRulesBtn.addEventListener("click", () => {
    const isHidden = customRulesBody.classList.contains("hidden");
    toggleAccordion(isHidden);
  });

  function toggleAccordion(expand) {
    if (expand) {
      customRulesBody.classList.remove("hidden");
      toggleCustomRulesBtn.classList.add("active");
    } else {
      customRulesBody.classList.add("hidden");
      toggleCustomRulesBtn.classList.remove("active");
    }
  }

  // Helper to show save status messages beautifully
  function showStatus(msg, type) {
    saveStatusMsg.textContent = msg;
    saveStatusMsg.className = `status-message ${type}`;
    setTimeout(() => {
      saveStatusMsg.textContent = "";
      saveStatusMsg.className = "status-message";
    }, 3000);
  }

  // Update Green Active indicator dot
  function updateStatusIndicator(hasKey) {
    const statusDot = document.querySelector(".status-dot");
    const statusText = document.querySelector(".status-text");
    if (hasKey) {
      statusDot.className = "status-dot green";
      statusText.textContent = "Ready";
    } else {
      statusDot.className = "status-dot";
      statusDot.style.backgroundColor = "#fbbf24";
      statusDot.style.boxShadow = "0 0 8px #fbbf24";
      statusText.textContent = "Setup Required";
    }
  }

  // Optimization Execution in Playground
  optimizeSandboxBtn.addEventListener("click", () => {
    const originalText = playgroundInput.value.trim();
    if (!originalText) {
      playgroundOutput.value = "⚠️ Please write or paste a prompt draft first!";
      return;
    }

    const activeStyle = document.querySelector('input[name="opt-style"]:checked').value;
    const rules = customRulesInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    // Enable shimmer loader state
    optimizeSandboxBtn.classList.add("loading");
    optimizeSandboxBtn.disabled = true;
    playgroundOutput.value = "Analyzing draft and crafting prompt structure...";

    // Check if running in full chrome extension or local dev server
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        {
          action: "optimize",
          prompt: originalText,
          style: activeStyle,
          customRules: rules,
          apiKeyFallback: apiKey // fallback if background storage didn't sync yet
        },
        (response) => {
          optimizeSandboxBtn.classList.remove("loading");
          optimizeSandboxBtn.disabled = false;

          if (response && response.success) {
            playgroundOutput.value = response.optimized;
          } else {
            const errMsg = response ? response.error : "Unknown background communication failure.";
            handleFailedOptimization(originalText, activeStyle, rules, errMsg);
          }
        }
      );
    } else {
      // Offline fallback mode for fast preview validation
      setTimeout(() => {
        optimizeSandboxBtn.classList.remove("loading");
        optimizeSandboxBtn.disabled = false;
        const mockResult = generateMockOptimization(originalText, activeStyle, rules);
        playgroundOutput.value = mockResult;
      }, 1500);
    }
  });

  // Handle errors gracefully with elegant descriptions and direct fallbacks
  function handleFailedOptimization(originalText, style, rules, originalError) {
    let explanatoryNote = "";
    if (originalError.includes("API key") || originalError.includes("invalid") || !apiKeyInput.value.trim()) {
      explanatoryNote = "⚠️ Setup Needed: To run high-fidelity Groq neural optimization, please enter a valid Groq API key above.\n\n" +
                        "[DEMO FALLBACK - Preview of optimized structure below]\n" +
                        "--------------------------------------------------\n";
    } else {
      explanatoryNote = `⚠️ Service Error (${originalError}). Displaying local optimization fallback below:\n` +
                        "--------------------------------------------------\n";
    }
    
    const mockOutput = generateMockOptimization(originalText, style, rules);
    playgroundOutput.value = explanatoryNote + mockOutput;
  }

  // Instant local rule-based prompt optimizer
  function generateMockOptimization(prompt, style, rules) {
    let intro = "";
    let structure = "";
    let promptIntent = prompt;
    
    if (promptIntent.toLowerCase().startsWith("write a ") || promptIntent.toLowerCase().startsWith("create a ")) {
      promptIntent = promptIntent.substring(8);
    }

    const rulesSection = rules ? `\n\n[Additional Constraints]\n- ${rules.split('\n').join('\n- ')}` : "";

    switch(style) {
      case "supercharged":
        intro = "⚡ [OPTIMIZED VIA SUPERCHARGED MODE]";
        structure = `[Context & Objective]\nAct as an elite expert. Your task is to comprehensively execute the following request with pristine analytical clarity: "${promptIntent}".\n\n` +
                    `[Instructions for Execution]\n` +
                    `1. Conduct research and approach the problem systematically using step-by-step reasoning.\n` +
                    `2. Organize findings with clear headers, logical bullet points, and crisp explanations.\n` +
                    `3. Provide relevant examples or implementation snippets if applicable.\n` +
                    `4. Conclude with a concise evaluation of key trade-offs.${rulesSection}\n\n` +
                    `[Desired Response Format]\n` +
                    `- **Executive Summary** (1-2 sentences overview)\n` +
                    `- **Detailed Framework / Analysis** (Main body block)\n` +
                    `- **Practical Recommendations** (Bulleted action items)`;
        break;
      case "roleplayer":
        intro = "🎯 [OPTIMIZED VIA EXPERT ROLE PLAYER]";
        structure = `[System Prompt / Expert Persona]\n` +
                    `You are a world-renowned, elite specialist with decades of domain knowledge and a highly detailed analytical mindset. You are recognized for providing authoritative, highly accurate, and deeply technical solutions.\n\n` +
                    `[Core Objective]\n` +
                    `Given your absolute mastery, analyze and execute the following objective: "${promptIntent}".\n\n` +
                    `[Guidelines]\n` +
                    `- Adopt a professional, direct, and constructive tone.\n` +
                    `- Rely only on verifiable facts, avoid generic platitudes, and define advanced terms.\n` +
                    `- Highlight edge cases or typical pitfalls that a novice might miss.${rulesSection}`;
        break;
      case "concise":
        intro = "📝 [OPTIMIZED VIA CLEAR & CONCISE MODE]";
        structure = `[Objective]\n` +
                    `Execute the following task with absolute brevity, high signal-to-noise ratio, and clear directives: "${promptIntent}".\n\n` +
                    `[Output Constraints]\n` +
                    `- Remove conversational filler or introductory greetings.\n` +
                    `- Output immediately as a structured checklist or direct table.\n` +
                    `- Keep sentence structures short, clean, and highly focused.${rulesSection}`;
        break;
      case "creative":
        intro = "🎨 [OPTIMIZED VIA CREATIVE EXPLORER]";
        structure = `[Creative Brief]\n` +
                    `We are exploring novel, innovative, and highly imaginative boundaries. Your goal is to approach the following idea from completely fresh, multi-dimensional perspectives: "${promptIntent}".\n\n` +
                    `[Creative Directives]\n` +
                    `- Focus on original and non-obvious combinations of concepts.\n` +
                    `- Include rich metaphors, illustrative scenarios, and emotional resonance.\n` +
                    `- Draft 3 distinct alternative solutions ranging from 'practical baseline' to 'radical experimental'.${rulesSection}`;
        break;
    }

    return `${intro}\n\n${structure}`;
  }

  // Copy to Clipboard interaction
  copyOutputBtn.addEventListener("click", () => {
    const textToCopy = playgroundOutput.value.trim();
    if (!textToCopy || textToCopy.startsWith("Your polished prompt")) return;

    navigator.clipboard.writeText(textToCopy).then(() => {
      copyIcon.classList.add("hidden");
      checkIcon.classList.remove("hidden");
      
      copyOutputBtn.closest('.output-wrapper').style.borderColor = '#4ade80';
      copyOutputBtn.closest('.output-wrapper').style.boxShadow = '0 0 15px rgba(74, 222, 128, 0.2)';

      setTimeout(() => {
        copyIcon.classList.remove("hidden");
        checkIcon.classList.add("hidden");
        copyOutputBtn.closest('.output-wrapper').style.borderColor = '';
        copyOutputBtn.closest('.output-wrapper').style.boxShadow = '';
      }, 2000);
    });
  });
});
