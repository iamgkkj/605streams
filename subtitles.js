/**
 * subtitles.js - Subtitle Parser, Synchronization, and Rendering Module
 */

let subtitleCues = [];
let subtitleOffset = 0.0; // Delay in seconds (e.g. +1.5 means display 1.5 seconds later)
let subtitlesEnabled = true;
let originalFilename = 'subtitle.srt';

// DOM elements
let overlayDiv = null;
let textSpan = null;

/**
 * Strips HTML-like tags from subtitle text for clean rendering
 * @param {string} text 
 * @returns {string}
 */
function stripHtmlTags(text) {
  return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * Parses a timestamp string (SRT/VTT format) into seconds
 * Supports: HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm
 * 
 * @param {string} timeStr - The timestamp string
 * @returns {number} - The equivalent time in seconds
 */
function parseTimeToSeconds(timeStr) {
  const cleaned = timeStr.trim().replace(',', '.');
  const parts = cleaned.split(':');
  
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 3) {
    hours = parseFloat(parts[0]) || 0;
    minutes = parseFloat(parts[1]) || 0;
    seconds = parseFloat(parts[2]) || 0;
  } else if (parts.length === 2) {
    minutes = parseFloat(parts[0]) || 0;
    seconds = parseFloat(parts[1]) || 0;
  } else {
    seconds = parseFloat(parts[0]) || 0;
  }

  return (hours * 3600) + (minutes * 60) + seconds;
}

/**
 * Formats a time in seconds back to SRT timestamp format (HH:MM:SS,mmm)
 * 
 * @param {number} totalSeconds - Time in seconds
 * @returns {string} - SRT formatted timestamp
 */
function formatSecondsToSrtTime(totalSeconds) {
  const secs = Math.max(0, totalSeconds);
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = Math.floor(secs % 60);
  const milliseconds = Math.floor((secs % 1) * 1000);

  const pad = (num, size) => num.toString().padStart(size, '0');
  
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(milliseconds, 3)}`;
}

/**
 * Initializes the subtitle module with required overlay elements
 * 
 * @param {HTMLElement} subtitleOverlayDiv - The outer overlay container
 * @param {HTMLElement} subtitleTextSpan - The inner text span container
 */
export function initSubtitles(subtitleOverlayDiv, subtitleTextSpan) {
  overlayDiv = subtitleOverlayDiv;
  textSpan = subtitleTextSpan;
  resetSubtitles();
}

/**
 * Resets the subtitle data and settings
 */
export function resetSubtitles() {
  subtitleCues = [];
  subtitleOffset = 0.0;
  subtitlesEnabled = true;
  if (overlayDiv) overlayDiv.classList.add('hidden');
  if (textSpan) textSpan.textContent = '';
}

/**
 * Parses VTT or SRT file content into cue objects
 * 
 * @param {string} fileContent - The raw text content of the file
 * @param {string} fileName - Original filename for export reference
 * @returns {Array<Object>} - The parsed cue list
 */
export function parseSubtitleFile(fileContent, fileName = 'subtitle.srt') {
  originalFilename = fileName;
  subtitleCues = [];
  
  // Normalize newline endings
  const normalized = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split content by empty lines separating blocks
  const blocks = normalized.split(/\n\s*\n/);
  
  let blockIndex = 1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Find the timestamp line (must contain the arrow selector "-->")
    let timestampIndex = -1;
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].includes('-->')) {
        timestampIndex = j;
        break;
      }
    }

    if (timestampIndex === -1) {
      // Not a valid subtitle block
      continue;
    }

    // Split timestamps
    const timeParts = lines[timestampIndex].split('-->');
    if (timeParts.length < 2) continue;

    const start = parseTimeToSeconds(timeParts[0]);
    const end = parseTimeToSeconds(timeParts[1]);

    // Extract text (all lines after timestamp line)
    const textLines = lines.slice(timestampIndex + 1);
    const text = textLines.join('\n');

    subtitleCues.push({
      id: blockIndex++,
      start,
      end,
      text: stripHtmlTags(text),
      originalText: text // Keep formatting for export if needed
    });
  }

  // Sort cues by start time to support quick lookups
  subtitleCues.sort((a, b) => a.start - b.start);
  
  return subtitleCues;
}

/**
 * Renders the subtitle active at the given video time (plus shift delay offset)
 * 
 * @param {number} currentTime - Elapsed video progress time in seconds
 */
export function renderCues(currentTime) {
  if (!overlayDiv || !textSpan) return;

  // Subtitles disabled or no subtitles loaded -> hide
  if (!subtitlesEnabled || subtitleCues.length === 0) {
    overlayDiv.classList.add('hidden');
    textSpan.textContent = '';
    return;
  }

  // Apply synchronization delay offset (in seconds)
  const adjustedTime = currentTime + subtitleOffset;

  // Search for active cue
  // Note: Linear find is highly efficient for client-side cue arrays
  const activeCue = subtitleCues.find(cue => adjustedTime >= cue.start && adjustedTime <= cue.end);

  if (activeCue) {
    // Only update DOM if text actually changed to avoid extra paint triggers
    if (textSpan.innerText !== activeCue.text) {
      textSpan.innerText = activeCue.text;
    }
    overlayDiv.classList.remove('hidden');
  } else {
    textSpan.textContent = '';
    overlayDiv.classList.add('hidden');
  }
}

/**
 * Sets the subtitle offset delay in seconds
 * @param {number} seconds 
 */
export function setOffset(seconds) {
  subtitleOffset = parseFloat(seconds) || 0.0;
}

/**
 * Toggles subtitle display visibility
 * @param {boolean} enabled 
 */
export function setEnabled(enabled) {
  subtitlesEnabled = !!enabled;
  if (!subtitlesEnabled && overlayDiv) {
    overlayDiv.classList.add('hidden');
  }
}

/**
 * Re-exports the loaded subtitle file as an SRT file with adjusted timestamps.
 * Triggers a download in the browser.
 */
export function downloadSubtitle() {
  if (subtitleCues.length === 0) return;

  let srtContent = '';

  subtitleCues.forEach((cue, index) => {
    // Apply delay offset to start and end times
    const adjustedStart = Math.max(0, cue.start + subtitleOffset);
    const adjustedEnd = Math.max(0, cue.end + subtitleOffset);

    // Reconstruct block
    srtContent += `${index + 1}\n`;
    srtContent += `${formatSecondsToSrtTime(adjustedStart)} --> ${formatSecondsToSrtTime(adjustedEnd)}\n`;
    srtContent += `${cue.originalText}\n\n`;
  });

  // Create standard file blob
  const blob = new Blob([srtContent.trim()], { type: 'text/srt;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  // Format target name
  const nameParts = originalFilename.split('.');
  const baseName = nameParts.slice(0, -1).join('.') || 'subtitle';
  const extension = 'srt';
  const newFilename = `${baseName}_synced.${extension}`;

  // Download trigger
  const link = document.createElement('a');
  link.href = url;
  link.download = newFilename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Returns subtitle data state
 */
export function getSubtitleState() {
  return {
    cuesCount: subtitleCues.length,
    offset: subtitleOffset,
    enabled: subtitlesEnabled,
    filename: originalFilename
  };
}
