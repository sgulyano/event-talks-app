// BigQuery Release Navigator JS App Logic

document.addEventListener('DOMContentLoaded', () => {
    // App State
    let releases = [];
    let selectedUpdates = new Set(); // Stores update IDs
    let activeFilter = 'all';
    let searchQuery = '';

    // DOM Elements
    const timelineContainer = document.getElementById('timeline-container');
    const feedLoader = document.getElementById('feed-loader');
    const feedError = document.getElementById('feed-error');
    const feedEmpty = document.getElementById('feed-empty');
    const errorMessage = document.getElementById('error-message');
    
    const headerStatus = document.getElementById('header-status');
    const searchInput = document.getElementById('search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    const statTotalCount = document.getElementById('stat-total-count');
    const statLastUpdated = document.getElementById('stat-last-updated');
    const btnRefresh = document.getElementById('btn-refresh');
    const refreshIcon = document.getElementById('refresh-icon');
    const refreshBtnText = document.getElementById('refresh-btn-text');
    const btnErrorRetry = document.getElementById('btn-error-retry');
    const btnClearFilters = document.getElementById('btn-clear-filters');
    
    const selectionCard = document.getElementById('selection-card');
    const selectedCountBadge = document.getElementById('selected-count-badge');
    const btnTweetSelected = document.getElementById('btn-tweet-selected');
    const btnExportCSV = document.getElementById('btn-export-csv');
    
    // Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelTweet = document.getElementById('btn-cancel-tweet');
    const btnPostTweet = document.getElementById('btn-post-tweet');
    const charCountText = document.getElementById('char-count-text');
    const charProgressCircle = document.getElementById('char-progress-circle');
    const composerWarning = document.getElementById('composer-warning');
    const themeToggleBtn = document.getElementById('theme-toggle');

    // SVG Circumference for Char Counter progress circle: 2 * PI * r (r = 14 => ~88)
    const CIRCUMFERENCE = 2 * Math.PI * 14;
    charProgressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
    charProgressCircle.style.strokeDashoffset = CIRCUMFERENCE;

    // Check theme preference
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
        themeToggleBtn.querySelector('.sun-icon').classList.remove('hidden');
        themeToggleBtn.querySelector('.moon-icon').classList.add('hidden');
    }

    // Helper: Format cache age/timestamp
    function formatTime(timestamp) {
        if (!timestamp) return 'Never';
        const diffMs = Date.now() - (timestamp * 1000);
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins === 1) return '1 min ago';
        if (diffMins < 60) return `${diffMins} mins ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours === 1) return '1 hour ago';
        return `${diffHours} hours ago`;
    }

    // Helper: Strip HTML tags to get pure text excerpt
    function stripHtml(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    }

    // Load feed data
    async function loadFeed(forceRefresh = false) {
        setLoadingState(true);
        try {
            const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Server returned HTTP status ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            releases = data.releases || [];
            
            // Update stats
            updateStats(data.timestamp);
            
            // Reset selection when feed refreshes
            selectedUpdates.clear();
            updateSelectionUI();
            
            // Render the timeline
            renderTimeline();
            
            // Update Header Connection Status
            setHeaderStatus('Live', 'success');
            
        } catch (error) {
            console.error('Feed loading error:', error);
            showErrorState(error.message);
            setHeaderStatus('Error fetching', 'error');
        } finally {
            setLoadingState(false);
        }
    }

    function setHeaderStatus(text, type) {
        const statusText = headerStatus.querySelector('.status-text');
        const statusDot = headerStatus.querySelector('.status-dot');
        
        statusText.textContent = text;
        statusDot.className = 'status-dot';
        if (type === 'success') {
            statusDot.classList.add('success');
        } else if (type === 'error') {
            statusDot.classList.add('error');
        } else {
            statusDot.classList.add('pulsing');
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            feedLoader.classList.remove('hidden');
            feedError.classList.add('hidden');
            feedEmpty.classList.add('hidden');
            refreshIcon.classList.add('spinning');
            btnRefresh.disabled = true;
            refreshBtnText.textContent = 'Updating...';
        } else {
            feedLoader.classList.add('hidden');
            refreshIcon.classList.remove('spinning');
            btnRefresh.disabled = false;
            refreshBtnText.textContent = 'Refresh Feed';
        }
    }

    function showErrorState(message) {
        errorMessage.textContent = message;
        feedError.classList.remove('hidden');
        timelineContainer.innerHTML = '';
    }

    function updateStats(timestamp) {
        // Count total individual updates
        let totalCount = 0;
        releases.forEach(rel => {
            if (rel.updates) {
                totalCount += rel.updates.length;
            }
        });
        
        statTotalCount.textContent = totalCount;
        statLastUpdated.textContent = formatTime(timestamp);
        
        // Auto refresh age text every minute
        if (window.ageInterval) clearInterval(window.ageInterval);
        window.ageInterval = setInterval(() => {
            statLastUpdated.textContent = formatTime(timestamp);
        }, 60000);
    }

    // Filter Logic
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.type;
            renderTimeline();
        });
    });

    // Search Logic
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderTimeline();
        }, 200); // Debounce searches
    });

    btnClearFilters.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        filterButtons.forEach(b => b.classList.remove('active'));
        document.getElementById('btn-filter-all').classList.add('active');
        activeFilter = 'all';
        renderTimeline();
    });

    btnErrorRetry.addEventListener('click', () => {
        loadFeed(true);
    });

    btnRefresh.addEventListener('click', () => {
        loadFeed(true);
    });

    // Get all updates flattened that match search & filters
    function getFilteredUpdates() {
        let matches = [];
        
        releases.forEach(rel => {
            const dateStr = rel.date;
            
            if (!rel.updates) return;
            
            rel.updates.forEach(update => {
                const typeMatches = activeFilter === 'all' || update.type.toLowerCase() === activeFilter;
                
                const text = (update.text || '').toLowerCase();
                const type = (update.type || '').toLowerCase();
                const date = dateStr.toLowerCase();
                const searchMatches = !searchQuery || 
                                      text.includes(searchQuery) || 
                                      type.includes(searchQuery) || 
                                      date.includes(searchQuery);
                                      
                if (typeMatches && searchMatches) {
                    matches.push({
                        ...update,
                        date: dateStr
                    });
                }
            });
        });
        
        return matches;
    }

    // Render timeline
    function renderTimeline() {
        const filteredUpdates = getFilteredUpdates();
        
        if (filteredUpdates.length === 0) {
            feedEmpty.classList.remove('hidden');
            timelineContainer.classList.add('hidden');
            return;
        }
        
        feedEmpty.classList.add('hidden');
        timelineContainer.classList.remove('hidden');
        timelineContainer.innerHTML = '';
        
        // Group the matching updates by date
        const groups = {};
        filteredUpdates.forEach(update => {
            if (!groups[update.date]) {
                groups[update.date] = [];
            }
            groups[update.date].push(update);
        });
        
        // Build timeline HTML
        Object.keys(groups).forEach(date => {
            const updatesInDate = groups[date];
            
            const groupDiv = document.createElement('div');
            groupDiv.className = 'timeline-group';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'timeline-header';
            
            const dotDiv = document.createElement('div');
            dotDiv.className = 'timeline-dot';
            dotDiv.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
            `;
            
            const dateTitle = document.createElement('h3');
            dateTitle.className = 'timeline-date';
            dateTitle.textContent = date;
            
            headerDiv.appendChild(dotDiv);
            headerDiv.appendChild(dateTitle);
            groupDiv.appendChild(headerDiv);
            
            const updatesDiv = document.createElement('div');
            updatesDiv.className = 'timeline-updates';
            
            updatesInDate.forEach(update => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'update-card';
                cardDiv.setAttribute('id', update.id);
                cardDiv.setAttribute('data-type-border', update.type.toLowerCase());
                
                if (selectedUpdates.has(update.id)) {
                    cardDiv.classList.add('selected');
                }
                
                // Add click listener to card to toggle selection
                cardDiv.addEventListener('click', (e) => {
                    // Prevent toggling if user clicks a button, a link, or selects text
                    if (e.target.closest('a') || e.target.closest('button')) {
                        return;
                    }
                    toggleUpdateSelection(update.id);
                });
                
                // Card Header Row
                const headerRow = document.createElement('div');
                headerRow.className = 'card-header-row';
                
                const typeSection = document.createElement('div');
                typeSection.className = 'card-type-section';
                
                const checkbox = document.createElement('div');
                checkbox.className = 'checkbox-container';
                checkbox.innerHTML = `
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                
                const badge = document.createElement('span');
                badge.className = `badge badge-${update.type.toLowerCase()}`;
                badge.textContent = update.type;
                
                typeSection.appendChild(checkbox);
                typeSection.appendChild(badge);
                headerRow.appendChild(typeSection);
                
                // Card Body
                const cardBody = document.createElement('div');
                cardBody.className = 'card-body';
                cardBody.innerHTML = update.html || `<p>${update.text}</p>`;
                
                // Card Actions Footer
                const cardActions = document.createElement('div');
                cardActions.className = 'card-actions';
                
                const btnCopy = document.createElement('button');
                btnCopy.className = 'card-btn';
                btnCopy.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>Copy</span>
                `;
                btnCopy.addEventListener('click', (e) => {
                    e.stopPropagation();
                    copyToClipboard(update.text, btnCopy);
                });
                
                const btnTweet = document.createElement('button');
                btnTweet.className = 'card-btn card-btn-tweet';
                btnTweet.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Tweet</span>
                `;
                btnTweet.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openComposer([update]);
                });
                
                const btnLink = document.createElement('a');
                btnLink.className = 'card-btn';
                btnLink.href = update.base_link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
                btnLink.target = '_blank';
                btnLink.rel = 'noopener noreferrer';
                btnLink.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    <span>View Doc</span>
                `;
                
                cardActions.appendChild(btnCopy);
                cardActions.appendChild(btnTweet);
                cardActions.appendChild(btnLink);
                
                cardDiv.appendChild(headerRow);
                cardDiv.appendChild(cardBody);
                cardDiv.appendChild(cardActions);
                updatesDiv.appendChild(cardDiv);
            });
            
            groupDiv.appendChild(updatesDiv);
            timelineContainer.appendChild(groupDiv);
        });
    }

    // Toggle Selection
    function toggleUpdateSelection(updateId) {
        if (selectedUpdates.has(updateId)) {
            selectedUpdates.delete(updateId);
            document.getElementById(updateId)?.classList.remove('selected');
        } else {
            selectedUpdates.add(updateId);
            document.getElementById(updateId)?.classList.add('selected');
        }
        updateSelectionUI();
    }

    function updateSelectionUI() {
        const count = selectedUpdates.size;
        selectedCountBadge.textContent = `${count} update${count !== 1 ? 's' : ''} selected`;
        
        if (count > 0) {
            btnTweetSelected.disabled = false;
            btnTweetSelected.style.transform = 'scale(1.02)';
        } else {
            btnTweetSelected.disabled = true;
            btnTweetSelected.style.transform = 'none';
        }
    }

    // Copy details to clipboard
    async function copyToClipboard(text, buttonElement) {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = `
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span style="color: #10b981">Copied!</span>
            `;
            setTimeout(() => {
                buttonElement.innerHTML = originalHTML;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    }

    // Modal Composition Logic
    function getSelectedUpdatesData() {
        const selectedData = [];
        releases.forEach(rel => {
            if (!rel.updates) return;
            rel.updates.forEach(up => {
                if (selectedUpdates.has(up.id)) {
                    selectedData.push({
                        ...up,
                        date: rel.date
                    });
                }
            });
        });
        return selectedData;
    }

    btnTweetSelected.addEventListener('click', () => {
        const selectedData = getSelectedUpdatesData();
        if (selectedData.length > 0) {
            openComposer(selectedData);
        }
    });

    function openComposer(updateItems) {
        let draftText = '';
        
        if (updateItems.length === 1) {
            const item = updateItems[0];
            // Format single tweet
            const dateStr = item.date;
            const cleanText = stripHtml(item.text).trim();
            const tweetExcerpt = cleanText.length > 180 ? cleanText.substring(0, 177) + '...' : cleanText;
            
            draftText = `📢 BigQuery Release (${dateStr}) • ${item.type}\n\n"${tweetExcerpt}"\n\nRead more:\n${item.base_link || 'https://docs.cloud.google.com/bigquery/docs/release-notes'}\n#BigQuery #GoogleCloud #GCP`;
        } else {
            // Format multi-select tweet
            draftText = `📢 Latest BigQuery Updates:\n\n`;
            updateItems.forEach(item => {
                const cleanText = stripHtml(item.text).trim();
                const excerpt = cleanText.length > 55 ? cleanText.substring(0, 52) + '...' : cleanText;
                draftText += `• [${item.type}] ${excerpt}\n`;
            });
            
            // Extract base link of the first item
            const baseLink = updateItems[0].base_link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
            draftText += `\nRead full release notes here:\n${baseLink}\n#BigQuery #GoogleCloud`;
        }
        
        tweetTextarea.value = draftText;
        updateCharCount();
        
        // Show Modal
        tweetModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Disable background scroll
    }

    function closeModal() {
        tweetModal.classList.add('hidden');
        document.body.style.overflow = 'auto'; // Re-enable background scroll
    }

    btnCloseModal.addEventListener('click', closeModal);
    btnCancelTweet.addEventListener('click', closeModal);
    
    // Close modal if user clicks backdrop
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeModal();
        }
    });

    // Character Counter
    function updateCharCount() {
        const text = tweetTextarea.value;
        const count = text.length;
        
        charCountText.textContent = `${count} / 280`;
        
        // Update SVG Progress Circle
        const percentage = Math.min(count / 280, 1);
        const offset = CIRCUMFERENCE - (percentage * CIRCUMFERENCE);
        charProgressCircle.style.strokeDashoffset = offset;
        
        // Color indicators
        if (count > 280) {
            charProgressCircle.style.stroke = '#ef4444'; // Red
            charCountText.style.color = '#ef4444';
            btnPostTweet.disabled = true;
            composerWarning.classList.remove('hidden');
        } else if (count >= 240) {
            charProgressCircle.style.stroke = '#f59e0b'; // Orange warning
            charCountText.style.color = '#f59e0b';
            btnPostTweet.disabled = false;
            composerWarning.classList.add('hidden');
        } else {
            charProgressCircle.style.stroke = '#06b6d4'; // Cool Teal
            charCountText.style.color = '#94a3b8';
            btnPostTweet.disabled = false;
            composerWarning.classList.add('hidden');
        }
    }

    tweetTextarea.addEventListener('input', updateCharCount);

    btnPostTweet.addEventListener('click', () => {
        const text = tweetTextarea.value;
        if (text.length > 280) return;
        
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
        closeModal();
    });

    // CSV Exporter Utility
    function escapeCSV(val) {
        if (val === null || val === undefined) return '';
        let stringVal = String(val);
        stringVal = stringVal.replace(/"/g, '""');
        if (stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('"')) {
            return `"${stringVal}"`;
        }
        return stringVal;
    }

    function exportToCSV() {
        const filtered = getFilteredUpdates();
        if (filtered.length === 0) {
            alert("No data available to export.");
            return;
        }

        let csvContent = "Date,Type,Description,Link\n";
        filtered.forEach(item => {
            const cleanText = stripHtml(item.text).trim();
            const link = item.base_link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
            csvContent += `${escapeCSV(item.date)},${escapeCSV(item.type)},${escapeCSV(cleanText)},${escapeCSV(link)}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    btnExportCSV.addEventListener('click', exportToCSV);

    // Theme Toggle Handler
    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        const sunIcon = themeToggleBtn.querySelector('.sun-icon');
        const moonIcon = themeToggleBtn.querySelector('.moon-icon');
        
        if (isLight) {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
            localStorage.setItem('theme', 'light');
        } else {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
            localStorage.setItem('theme', 'dark');
        }
    });

    // Initialize App Load
    loadFeed();
});
