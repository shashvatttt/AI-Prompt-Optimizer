// AI Prompt Optimizer Pro - Content Script
// Handles input monitoring, floating button injection, text swaps, and undo tracking

(function() {
  let activeInput = null;
  let floatingBtn = null;
  let undoToast = null;
  let toastTimeout = null;
  
  // Undo registry
  let lastOriginalText = "";
  let lastActiveInput = null;
  let isContentEditable = false;

  // Premium SVG Icons for Toast Notifications
  const ICON_SUCCESS_SVG = `
    <svg class="toast-icon-svg" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;

  const ICON_REVERT_SVG = `
    <svg class="toast-icon-svg" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 2v6h6"></path>
      <path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path>
    </svg>
  `;

  const ICON_ERROR_SVG = `
    <svg class="toast-icon-svg" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;

  // Selectors matching input fields on popular AI platforms
  const AI_PLATFORM_SELECTORS = [
    'textarea',
    '[contenteditable="true"]',
    '#prompt-textarea',       // ChatGPT
    '.ProseMirror',           // Claude
    '#rich-textarea',         // Gemini
    '#chat-input',            // DeepSeek
    '.ql-editor'              // Gemini / others
  ];

  // Initialize the script
  function init() {
    setupFocusListeners();
    setupKeyboardShortcut();
    setupWindowListeners();
  }

  // Setup bubble focus listeners to capture dynamic text inputs
  function setupFocusListeners() {
    document.addEventListener("focusin", (e) => {
      const target = e.target;
      if (isValidInput(target)) {
        activeInput = target;
        isContentEditable = target.getAttribute("contenteditable") === "true";
        createOrPositionButton(target);
      }
    });

    document.addEventListener("focusout", (e) => {
      // If we focus out, hide the button shortly UNLESS the new focus target is the button itself!
      setTimeout(() => {
        const activeEl = document.activeElement;
        if (floatingBtn && activeEl !== floatingBtn && !floatingBtn.contains(activeEl)) {
          if (activeInput === e.target) {
            hideButton();
          }
        }
      }, 200);
    });
  }

  // Setup dynamic realignment during scroll, resize, or keyboard input
  function setupWindowListeners() {
    window.addEventListener("resize", () => {
      if (activeInput && floatingBtn && !floatingBtn.classList.contains("hidden")) {
        repositionButton(activeInput);
      }
    });

    window.addEventListener("scroll", () => {
      if (activeInput && floatingBtn && !floatingBtn.classList.contains("hidden")) {
        repositionButton(activeInput);
      }
    }, true); // Capture scroll events in nested scroll boxes

    // Reposition button when text length changes (which might cause auto-growing textareas to shift)
    document.addEventListener("input", (e) => {
      if (activeInput && e.target === activeInput) {
        repositionButton(activeInput);
      }
    });
  }

  // Bind Ctrl/Cmd + Shift + O hotkey shortcut
  function setupKeyboardShortcut() {
    window.addEventListener("keydown", (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifier = isMac ? e.metaKey : e.ctrlKey;
      
      if (isModifier && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        const focusedEl = document.activeElement;
        if (isValidInput(focusedEl)) {
          e.preventDefault();
          activeInput = focusedEl;
          isContentEditable = focusedEl.getAttribute("contenteditable") === "true";
          triggerOptimization(focusedEl);
        }
      }
    });
  }

  // Evaluate if element is a valid target input field
  function isValidInput(el) {
    if (!el) return false;
    
    // Ignore input elements that are hidden, read-only, or search boxes
    if (el.tagName === 'INPUT' && ['text', 'search'].includes(el.getAttribute('type'))) {
      // Allow single line text boxes if they are large enough or look like AI text boxes,
      // but primarily target textareas and contenteditable
      return false; 
    }
    
    const isTextarea = el.tagName === 'TEXTAREA';
    const isEditable = el.getAttribute("contenteditable") === "true";

    // Skip utility text elements
    if (el.getAttribute("type") === "password" || el.id === "api-key-input" || el.id === "custom-rules-input") {
      return false;
    }

    return isTextarea || isEditable;
  }

  // Create the floating button element or reposition it if already exists
  function createOrPositionButton(inputEl) {
    if (!floatingBtn) {
      floatingBtn = document.createElement("button");
      floatingBtn.className = "prompt-optimizer-btn hidden";
      floatingBtn.title = "Optimize Prompt (Cmd+Shift+O)";
      floatingBtn.tabIndex = -1; // Keep it out of standard tab flows
      
      // Gorgeous inner lightning SVG
      floatingBtn.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      `;

      floatingBtn.addEventListener("mousedown", (e) => {
        // Prevent default input focus loss
        e.preventDefault();
      });

      floatingBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (activeInput) {
          triggerOptimization(activeInput);
        }
      });

      document.body.appendChild(floatingBtn);
    }

    floatingBtn.classList.remove("hidden");
    repositionButton(inputEl);
  }

  // Reposition floating button relative to active input boundaries
  function repositionButton(inputEl) {
    if (!floatingBtn || !inputEl) return;
    
    const rect = inputEl.getBoundingClientRect();
    
    // Check if input is currently visible in viewport
    if (rect.width === 0 || rect.height === 0 || rect.top === 0) {
      hideButton();
      return;
    }

    // Determine the scroll offset of document
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Position in bottom-right corner of target textarea, leaving standard padding
    const btnSize = 28;
    const margin = 8;
    
    const targetTop = rect.top + scrollTop + rect.height - btnSize - margin;
    const targetLeft = rect.left + scrollLeft + rect.width - btnSize - margin;

    floatingBtn.style.top = `${targetTop}px`;
    floatingBtn.style.left = `${targetLeft}px`;
  }

  function hideButton() {
    if (floatingBtn && !floatingBtn.classList.contains("optimizing")) {
      floatingBtn.classList.add("hidden");
    }
  }

  // Start Optimization flow
  function triggerOptimization(inputEl) {
    if (!inputEl) return;
    
    // Read input text
    const originalText = isContentEditable ? inputEl.innerText.trim() : inputEl.value.trim();
    if (!originalText) return;

    // Enable shimmer loader state
    floatingBtn.classList.add("optimizing");
    
    // Load style configuration from chrome storage
    chrome.storage.local.get(["optimizationStyle", "customRules"], (result) => {
      const style = result.optimizationStyle || "supercharged";
      const customRules = result.customRules || "";

      // Send to background service worker
      chrome.runtime.sendMessage(
        {
          action: "optimize",
          prompt: originalText,
          style: style,
          customRules: customRules
        },
        (response) => {
          // Remove loading shimmer
          if (floatingBtn) {
            floatingBtn.classList.remove("optimizing");
          }

          if (response && response.success) {
            // Apply text replacement
            lastOriginalText = originalText;
            lastActiveInput = inputEl;
            
            replaceText(inputEl, response.optimized);
            repositionButton(inputEl);
            
            // Show gorgeous Undo Toast!
            showUndoToast();
          } else {
            const err = response ? response.error : "Failed background connection.";
            showErrorToast(err);
          }
        }
      );
    });
  }

  // Replace input content using professional selection and insertion buffers
  function replaceText(el, newText) {
    el.focus();

    if (isContentEditable) {
      // ContentEditable Selection Injection
      try {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        
        // Use execCommand to preserve undo/redo history and trigger internal reactive states
        const executed = document.execCommand("insertText", false, newText);
        
        if (!executed) {
          // Fallback if execCommand fails
          el.innerText = newText;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } catch (err) {
        el.innerText = newText;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } else {
      // Textarea Selection Injection
      try {
        el.select();
        const executed = document.execCommand("insertText", false, newText);
        
        if (!executed) {
          // Fallback direct value injection
          el.value = newText;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } catch (err) {
        el.value = newText;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  // Create and display the custom glassmorphic Undo toast
  function showUndoToast() {
    clearTimeout(toastTimeout);

    if (!undoToast) {
      undoToast = document.createElement("div");
      undoToast.className = "prompt-optimizer-toast";
      
      undoToast.innerHTML = `
        <div class="toast-message-block">
          <span class="toast-icon-container">${ICON_SUCCESS_SVG}</span>
          <span class="toast-text">Prompt optimized successfully!</span>
        </div>
        <button class="toast-action-btn" id="toast-undo-btn">Undo</button>
      `;

      undoToast.querySelector("#toast-undo-btn").addEventListener("click", () => {
        if (lastActiveInput && lastOriginalText) {
          replaceText(lastActiveInput, lastOriginalText);
          repositionButton(lastActiveInput);
          dismissToast();
          
          // Brief reverted notification
          showTemporaryToast("Prompt reverted to original draft.", "revert");
        }
      });

      document.body.appendChild(undoToast);
    } else {
      // Reset toast UI if it was repurposed
      undoToast.querySelector(".toast-text").textContent = "Prompt optimized successfully!";
      undoToast.querySelector(".toast-icon-container").innerHTML = ICON_SUCCESS_SVG;
      const undoBtn = undoToast.querySelector("#toast-undo-btn");
      undoBtn.style.display = "block";
    }

    // Dynamic reflow draw and show toast
    setTimeout(() => {
      undoToast.classList.add("visible");
    }, 50);

    // Auto dismiss after 6 seconds
    toastTimeout = setTimeout(() => {
      dismissToast();
    }, 6000);
  }

  // Show a standard temporary feedback message
  function showTemporaryToast(message, type = "success") {
    if (!undoToast) return;
    
    clearTimeout(toastTimeout);
    undoToast.querySelector(".toast-text").textContent = message;
    
    const undoBtn = undoToast.querySelector("#toast-undo-btn");
    if (undoBtn) undoBtn.style.display = "none";
    
    const iconContainer = undoToast.querySelector(".toast-icon-container");
    if (iconContainer) {
      iconContainer.innerHTML = type === "revert" ? ICON_REVERT_SVG : ICON_SUCCESS_SVG;
    }
    
    undoToast.classList.add("visible");

    toastTimeout = setTimeout(() => {
      dismissToast();
    }, 3000);
  }

  // Show failure / error message toast
  function showErrorToast(errorMsg) {
    let cleanMsg = "Optimization failed.";
    if (errorMsg.includes("Missing API key")) {
      cleanMsg = "API Key Required! Click extension popup icon to configure.";
    } else {
      cleanMsg = `Error: ${errorMsg.length > 55 ? errorMsg.substring(0, 52) + "..." : errorMsg}`;
    }
    
    if (!undoToast) {
      undoToast = document.createElement("div");
      undoToast.className = "prompt-optimizer-toast";
      undoToast.innerHTML = `
        <div class="toast-message-block">
          <span class="toast-icon-container">${ICON_ERROR_SVG}</span>
          <span class="toast-text">${cleanMsg}</span>
        </div>
        <button class="toast-action-btn" id="toast-undo-btn" style="display:none">Undo</button>
      `;
      document.body.appendChild(undoToast);
    } else {
      undoToast.querySelector(".toast-text").textContent = cleanMsg;
      undoToast.querySelector(".toast-icon-container").innerHTML = ICON_ERROR_SVG;
      undoToast.querySelector("#toast-undo-btn").style.display = "none";
    }

    setTimeout(() => {
      undoToast.classList.add("visible");
    }, 50);

    toastTimeout = setTimeout(() => {
      dismissToast();
    }, 5000);
  }

  function dismissToast() {
    if (undoToast) {
      undoToast.classList.remove("visible");
    }
  }

  // Initialize
  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
