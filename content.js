(function() {
  'use strict';

  // Check context: Popup has 'extension-toggle', content script runs elsewhere
  if (document.getElementById('extension-toggle')) {
    // Popup logic
    document.addEventListener('DOMContentLoaded', () => {
      const toggle = document.getElementById('extension-toggle');
      const statusMessage = document.getElementById('status-message');

      // Load current state (default false/OFF)
      chrome.storage.sync.get({ extensionEnabled: false }, (result) => {
        console.log('Popup: Loaded extensionEnabled:', result.extensionEnabled);
        toggle.checked = result.extensionEnabled;
        updateStatusMessage(result.extensionEnabled);
      });

      // Save state on toggle change
      toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        console.log('Popup: Toggle changed to:', enabled);
        chrome.storage.sync.set({ extensionEnabled: enabled });
        updateStatusMessage(enabled);
      });

      // Helper to update status text
      function updateStatusMessage(enabled) {
        statusMessage.textContent = enabled 
          ? 'Extension is active! Navigate to Google search to use the features.'
          : 'Extension is disabled. Toggle ON to enable.';
      }

      // Button: Open Google Search
      document.getElementById('open-google').addEventListener('click', () => {
        console.log('Popup: Opening Google');
        chrome.tabs.create({ url: 'https://www.google.com' });
      });

      // Button: Refresh Current Tab
      document.getElementById('refresh-tab').addEventListener('click', () => {
        console.log('Popup: Refreshing tab');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });

      // Button: View Settings (placeholder)
      document.getElementById('view-settings').addEventListener('click', () => {
        console.log('Popup: View Settings clicked');
        alert('Settings coming soon! For now, use the toggle to enable/disable.');
      });
    });
  } else {
    // Content script logic
    let extensionEnabled = false;

    function checkAndInitialize() {
      console.log('Content: Checking extension state');
      chrome.storage.sync.get({ extensionEnabled: false }, function(result) {
        extensionEnabled = result.extensionEnabled;
        console.log('Content: extensionEnabled=', extensionEnabled);
        if (extensionEnabled) {
          console.log('Content: Adding buttons');
          addButtons();
        } else {
          console.log('Content: Extension disabled, removing container if exists');
          const existing = document.getElementById('g100-container');
          if (existing) existing.remove();
        }
      });
    }

    function addButtons() {
      console.log('Content: Running addButtons');
      const existing = document.getElementById('g100-container');
      if (existing) existing.remove();

      const container = document.createElement('div');
      container.id = 'g100-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        width: 180px;
      `;

      const loadBtn = document.createElement('button');
      loadBtn.innerHTML = 'Load 100 Results';
      loadBtn.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        font-size: 13px;
        margin-bottom: 8px;
      `;

      const status = document.createElement('div');
      status.style.cssText = `
        font-size: 11px;
        color: #6b7280;
        margin-bottom: 8px;
        padding: 4px 8px;
        background: #f9fafb;
        border-radius: 4px;
        text-align: center;
        min-height: 16px;
      `;
      status.textContent = 'Ready';

      const restoreBtn = document.createElement('button');
      restoreBtn.innerHTML = 'Restore Original';
      restoreBtn.style.cssText = `
        width: 100%;
        padding: 8px 12px;
        background: #dc2626;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        font-size: 13px;
      `;

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
      loadBtn.innerHTML = 'Loading...';
      loadBtn.style.background = '#9ca3af';

      document.querySelectorAll('.result-number').forEach(num => num.remove());

      const allResults = [];
      const processedResults = new Set();

      const existingLinks = findCurrentResults();
      console.log('Found existing results:', existingLinks.length);
      
      existingLinks.forEach(link => {
        const resultText = link.textContent.trim();
        if (!processedResults.has(resultText) && resultText.length > 3) {
          allResults.push({ element: link, text: resultText, source: 'current' });
          processedResults.add(resultText);
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
                
                if (!processedResults.has(resultText) && resultText.length > 3) {
                  allResults.push({ 
                    element: resultElement, 
                    h3: h3, 
                    text: resultText, 
                    source: `page${pageNum}` 
                  });
                  processedResults.add(resultText);
                }
              }
            }
          });
          
          console.log(`Collected results from page ${pageNum + 1}`);
        });
        
        console.log(`Total collected results: ${allResults.length}`);
        
        let resultNumber = 1;
        allResults.forEach((result, index) => {
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
      status.textContent = `Complete! ${finalCount} results perfectly numbered`;
      loadBtn.disabled = false;
      loadBtn.innerHTML = 'Reload More';
      loadBtn.style.background = '#059669';
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
        font-weight: 800 !important;
        color: #1d4ed8 !important;
        font-size: 15px !important;
        margin-right: 8px !important;
        display: inline-block !important;
        background: rgba(29, 78, 216, 0.1) !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        font-family: monospace !important;
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
        '#search',
        '#center_col', 
        '#main',
        'div[role="main"]'
      ];

      for (const selector of possibleContainers) {
        const container = document.querySelector(selector);
        if (container) {
          container.appendChild(resultElement);
          return;
        }
      }
    }

    function init() {
      console.log('Content: Initializing on', window.location.href);
      if (!window.location.href.includes('google.com/search') || !window.location.search.includes('q=')) {
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