(function() {
  'use strict';

  // Check context: Popup has 'extension-toggle', content script runs elsewhere
  if (document.getElementById('extension-toggle')) {
    // Popup logic
    document.addEventListener('DOMContentLoaded', () => {
      const toggle = document.getElementById('extension-toggle');
      const statusIndicator = document.getElementById('statusIndicator');
      const statusMessage = document.getElementById('statusMessage');

      // Load current state
      chrome.storage.sync.get({ extensionEnabled: false }, (result) => {
        console.log('Popup: Loaded extensionEnabled:', result.extensionEnabled);
        toggle.checked = result.extensionEnabled;
        updateUI(result.extensionEnabled);
      });

      // Save state on toggle change and notify content script
      toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        console.log('Popup: Toggle changed to:', enabled);
        chrome.storage.sync.set({ extensionEnabled: enabled }, () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { action: "toggleChanged", enabled: enabled });
            }
          });
        });
        updateUI(enabled);
      });

      function updateUI(isEnabled) {
        if (isEnabled) {
          statusIndicator.className = 'status-indicator status-on';
          statusMessage.textContent = 'Extension is active! Navigate to Google search to use the features.';
        } else {
          statusIndicator.className = 'status-indicator status-off';
          statusMessage.textContent = 'Extension is disabled. Toggle ON to enable.';
        }
      }
    });
  } else {
    // Content script logic
    let extensionEnabled = false;

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "toggleChanged") {
        extensionEnabled = message.enabled;
        console.log('Content: Toggle changed to:', extensionEnabled);
        checkAndInitialize();
      }
    });

    function checkAndInitialize() {
      console.log('Content: Checking extension state');
      chrome.storage.sync.get({ extensionEnabled: false }, (result) => {
        extensionEnabled = result.extensionEnabled;
        console.log('Content: extensionEnabled=', extensionEnabled);
        if (extensionEnabled && isGoogleSearchPage()) {
          console.log('Content: Adding buttons');
          addButtons();
        } else {
          console.log('Content: Extension disabled or not a Google search page, removing container if exists');
          const existing = document.getElementById('g100-container');
          if (existing) existing.remove();
        }
      });
    }

    function isGoogleSearchPage() {
      return window.location.href.includes('google.com/search') && window.location.search.includes('q=');
    }

    function addButtons() {
      console.log('Content: Running addButtons');
      const existing = document.getElementById('g100-container');
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.id = 'g100-container';
      container.style.cssText = `
        position: fixed;
        top: 80px; /* Moved down to avoid Google profile image */
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        width: 220px;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      `;

      // Hover effect for container
      container.addEventListener('mouseover', () => {
        container.style.transform = 'translateY(-2px)';
        container.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.15)';
      });
      container.addEventListener('mouseout', () => {
        container.style.transform = 'translateY(0)';
        container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      });

      const loadBtn = document.createElement('button');
      loadBtn.innerHTML = 'Load 100 Results';
      loadBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); /* Popup blue gradient */
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 12px;
        transition: background 0.3s ease, transform 0.2s ease;
      `;
      loadBtn.addEventListener('mouseover', () => {
        loadBtn.style.background = 'linear-gradient(135deg, #7b9df2 0%, #8a5bb5 100%)'; /* Lighter shade on hover */
        loadBtn.style.transform = 'scale(1.02)';
      });
      loadBtn.addEventListener('mouseout', () => {
        loadBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        loadBtn.style.transform = 'scale(1)';
      });

      const status = document.createElement('div');
      status.style.cssText = `
        font-size: 12px;
        color: #666;
        margin-bottom: 12px;
        padding: 8px;
        background: #f5f5f5;
        border-radius: 6px;
        text-align: center;
        min-height: 20px;
      `;
      status.textContent = 'Ready';

      const restoreBtn = document.createElement('button');
      restoreBtn.innerHTML = 'Restore Original';
      restoreBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #5d4f8d 0%, #3d2a6d 100%); /* Darker purple shade from theme */
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        transition: background 0.3s ease, transform 0.2s ease;
      `;
      restoreBtn.addEventListener('mouseover', () => {
        restoreBtn.style.background = 'linear-gradient(135deg, #6f5ea0 0%, #4d387f 100%)'; /* Lighter shade on hover */
        restoreBtn.style.transform = 'scale(1.02)';
      });
      restoreBtn.addEventListener('mouseout', () => {
        restoreBtn.style.background = 'linear-gradient(135deg, #5d4f8d 0%, #3d2a6d 100%)';
        restoreBtn.style.transform = 'scale(1)';
      });

      container.appendChild(loadBtn);
      container.appendChild(status);
      container.appendChild(restoreBtn);
      document.body.appendChild(container);

      loadBtn.addEventListener('click', () => loadResults(loadBtn, status));
      restoreBtn.addEventListener('click', () => location.reload());
    }

    async function loadResults(loadBtn, status) {
      const query = new URLSearchParams(window.location.search).get('q');
      if (!query) {
        status.textContent = 'No search query found';
        return;
      }

      loadBtn.disabled = true;
      loadBtn.style.background = '#b0b0b0';
      loadBtn.innerHTML = 'Loading...';

      document.querySelectorAll('.result-number').forEach(num => num.remove());

      const allResults = [];
      const processedResults = new Set();

      const existingLinks = findCurrentResults();
      console.log('Found existing results:', existingLinks.length);
      
      existingLinks.forEach(h3 => {
        const container = h3.closest('div.g, div.tF2Cxc, div.MjjYud');
        const a = container ? container.querySelector('a[href^="http"], a[href^="/url?"]') : null;
        const resultText = h3.textContent.trim();
        const uniqueKey = a ? a.href + '|' + resultText : resultText;
        if (!processedResults.has(uniqueKey) && resultText.length > 3) {
          allResults.push({ element: h3, text: uniqueKey, source: 'current' });
          processedResults.add(uniqueKey);
        }
      });

      status.textContent = `Found ${allResults.length} existing results, loading more...`;

      const pagePromises = [];
      const maxPages = 9;
      
      status.textContent = `Loading all pages simultaneously...`;
      
      for (let page = 1; page <= maxPages; page++) {
        pagePromises.push(fetchPageResults(query, page * 10));
      }
      
      try {
        const allPageResults = await Promise.all(pagePromises);
        
        console.log('All pages loaded simultaneously!');
        
        allPageResults.forEach((pageResults, pageIndex) => {
          const pageNum = pageIndex + 1;
          
          pageResults.forEach(resultHtml => {
            if (allResults.length >= 100) return;
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = resultHtml;
            const resultElement = tempDiv.firstElementChild;
            
            if (resultElement) {
              const h3 = resultElement.querySelector('h3');
              if (h3) {
                const resultText = h3.textContent.trim();
                const a = resultElement.querySelector('a[href^="http"], a[href^="/url?"]');
                const uniqueKey = a ? a.href + '|' + resultText : resultText;
                if (!processedResults.has(uniqueKey) && resultText.length > 3) {
                  allResults.push({ 
                    element: resultElement, 
                    h3: h3, 
                    text: uniqueKey, 
                    source: `page${pageNum}` 
                  });
                  processedResults.add(uniqueKey);
                }
              }
            }
          });
          
          console.log(`Collected results from page ${pageNum + 1}`);
        });
        
        console.log(`Total collected results: ${allResults.length}`);
        
        let resultNumber = 1;
        allResults.forEach((result) => {
          if (resultNumber > 100) return;
          
          if (result.source === 'current') {
            addNumberToResult(result.element, resultNumber++);
          } else {
            addNumberToResult(result.h3, resultNumber++);
            appendToSearchResults(result.element);
          }
        });
        
      } catch (error) {
        console.error('Error in parallel loading:', error);
        status.textContent = 'Error loading results';
      }

      const finalCount = Math.min(allResults.length, 100);
      status.textContent = `Complete! ${finalCount} results numbered`;
      loadBtn.disabled = false;
      loadBtn.innerHTML = 'Reload More';
      loadBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    function findCurrentResults() {
      const results = [];
      
      const searchResultContainers = document.querySelectorAll('div.g, div.tF2Cxc, div.MjjYud');
      
      searchResultContainers.forEach(container => {
        if (container.getAttribute('data-g100-processed')) return;
        
        if (isNonSerpElement(container)) return;
        
        const h3 = container.querySelector('h3:not([data-g100-numbered])');
        if (h3) {
          const text = h3.textContent?.trim();
          const hasValidLink = container.querySelector('a[href^="http"], a[href^="/url?"]');
          
          if (text && text.length > 3 && hasValidLink) {
            if (!text.toLowerCase().includes('people also ask') && 
                !text.toLowerCase().includes('related searches') &&
                !container.querySelector('[role="button"][aria-expanded]')) {
              results.push(h3);
              container.setAttribute('data-g100-found', 'true');
            }
          }
        }
      });

      console.log(`findCurrentResults found ${results.length} clean SERP results`);
      return results;
    }

    function isNonSerpElement(container) {
      if (container.querySelector('[role="button"][aria-expanded]')) return true;
      if (container.querySelector('.related-question-pair')) return true;
      if (container.textContent.toLowerCase().includes('people also ask')) return true;
      
      if (container.querySelector('[data-text-ad]')) return true;
      if (container.textContent.toLowerCase().includes('adÂ·')) return true;
      if (container.querySelector('.ads-ad')) return true;
      
      if (container.querySelector('.shopping-result')) return true;
      
      if (container.querySelector('[role="listitem"]') && container.closest('[role="list"]')) return true;
      
      if (container.querySelector('.knowledge-panel')) return true;
      if (container.closest('.knowledge-panel')) return true;
      
      if (container.querySelector('img') && container.closest('.images')) return true;
      
      if (container.querySelector('.local-result')) return true;
      
      const specialParents = [
        '.related-question-pair',
        '.knowledge-panel', 
        '.ads-ad',
        '.shopping-results',
        '.images'
      ];
      
      for (const selector of specialParents) {
        if (container.closest(selector)) return true;
      }
      
      return false;
    }

    async function fetchPageResults(query, start) {
      const url = `/search?q=${encodeURIComponent(query)}&start=${start}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'Accept': 'text/html',
            'Cache-Control': 'no-cache'
          }
        });
        
        const html = await response.text();
        
        if (html.includes('detected unusual traffic') || html.includes('captcha')) {
          console.warn('Rate limited detected');
          return [];
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const results = [];
        const resultElements = doc.querySelectorAll('div.g, div.tF2Cxc, div.MjjYud');
        
        for (const element of resultElements) {
          if (element.textContent.includes('People also ask')) continue;
          if (element.querySelector('[role="button"][aria-expanded]')) continue;
          
          const h3 = element.querySelector('h3');
          const link = element.querySelector('a[href^="http"], a[href^="/url?"]');
          
          if (h3 && link && h3.textContent.trim().length > 3) {
            results.push(element.outerHTML);
          }
        }

        return results;
        
      } catch (error) {
        console.error('Fetch error:', error);
        return [];
      }
    }

    function addNumberToResult(element, number) {
      const existingNumbers = element.querySelectorAll('.result-number');
      existingNumbers.forEach(num => num.remove());
      
      const parent = element.closest('div');
      if (parent) {
        const strayNumbers = parent.querySelectorAll('.result-number');
        strayNumbers.forEach(num => num.remove());
      }

      const numberSpan = document.createElement('span');
      numberSpan.className = 'result-number';
      numberSpan.textContent = number + '. ';
      numberSpan.style.cssText = `
        font-weight: 800;
        color: #1e40af;
        font-size: 15px;
        margin-right: 8px;
        display: inline-block;
        background: rgba(30, 64, 175, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
      `;
      
      if (element.firstChild) {
        element.insertBefore(numberSpan, element.firstChild);
      } else {
        element.appendChild(numberSpan);
      }
      
      element.setAttribute('data-g100-numbered', number.toString());
      element.setAttribute('data-g100-processed', 'true');
      
      console.log(`✅ Numbered result ${number}: ${element.textContent.substring(3, 50)}...`);
    }

    function appendToSearchResults(resultElement) {
      const possibleContainers = [
        '#rso',
        '#search',
        '#center_col', 
        '#main',
        'div[role="main"]'
      ];

      for (const selector of possibleContainers) {
        const container = document.querySelector(selector);
        if (container) {
          container.appendChild(resultElement);
          resultElement.style.marginTop = '20px';
          console.log('Appended to:', selector);
          return;
        }
      }
      console.warn('No suitable container found for appending');
    }

    function init() {
      console.log('Content: Initializing on', window.location.href);
      if (!isGoogleSearchPage()) {
        console.log('Content: Not a Google search page, exiting');
        return;
      }

      checkAndInitialize();

      const observer = new MutationObserver((mutations, obs) => {
        const searchResults = document.querySelector('#search, #center_col');
        if (searchResults) {
          console.log('Content: Search results found, checking state');
          obs.disconnect();
          setTimeout(() => {
            checkAndInitialize();
          }, 500);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        console.log('Content: Fallback timeout triggered');
        observer.disconnect();
        checkAndInitialize();
      }, 3000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();