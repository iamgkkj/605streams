/**
 * subtitles.js - Object-Oriented Subtitle Engine and Synchronization Module
 */

/**
 * Strips HTML-like tags from subtitle text for clean rendering
 * @param {string} text 
 * @returns {string}
 */
function stripHtmlTags(text) {
  return text.replace(/<[^>]*>/g, '').trim();
}

/**
 * Parses a timestamp string into float seconds
 * Supports: HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm
 * @param {string} timeStr 
 * @returns {number}
 */
function timeInSeconds(timeStr) {
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
 * Formats a time in float seconds back to SRT format (HH:MM:SS,mmm)
 * @param {number} totalSeconds 
 * @returns {string}
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
 * Object-Oriented Subtitle Sync & Rendering Engine
 */
export class SubtitleEngine {
  constructor() {
    this.video = null;
    this.overlayDiv = null;
    this.textSpan = null;
    
    this.cues = [];
    this.pos = 0;
    this.offset = 0.0;
    this.enabled = true;
    this.originalFilename = 'subtitle.srt';
    
    this._timeUpdateHandler = null;
  }

  /**
   * Binds the engine to a `<video>` element and UI containers
   * @param {HTMLVideoElement} videoElement 
   * @param {HTMLElement} overlayDiv 
   * @param {HTMLElement} textSpan 
   */
  init(videoElement, overlayDiv, textSpan) {
    this.destroy(); // Tear down active bindings if already initialized

    this.video = videoElement;
    this.overlayDiv = overlayDiv;
    this.textSpan = textSpan;

    if (this.video) {
      this._timeUpdateHandler = () => {
        this.render(this.video.currentTime);
      };
      this.video.addEventListener('timeupdate', this._timeUpdateHandler);
      this.video.addEventListener('seeking', this._timeUpdateHandler);
      this.video.addEventListener('seeked', this._timeUpdateHandler);
    }
  }

  /**
   * Cleans up all data and hides UI
   */
  reset() {
    this.cues = [];
    this.pos = 0;
    this.offset = 0.0;
    this.enabled = true;
    if (this.overlayDiv) this.overlayDiv.classList.add('hidden');
    if (this.textSpan) this.textSpan.textContent = '';
  }

  /**
   * Parses Raw Subtitle SRT/SUB contents with automatic Silence Detection
   * @param {string} content 
   * @param {string} fileName 
   * @returns {Array<Object>}
   */
  load(content, fileName = 'subtitle.srt') {
    this.originalFilename = fileName;
    this.cues = [];
    this.pos = 0;

    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let curlyBraces = 0;
    
    // Check first lines to detect MicroDVD SUB format
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      if (lines[i] && /{.*}{.*}/.test(lines[i].trim())) curlyBraces++;
    }

    if (curlyBraces >= 5) {
      // MicroDVD SUB format parsed at standard 23.976 fps
      const fps = 23.976;
      let id = 1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const match = line.match(/{(\d+)}{(\d+)}(.*)/);
        if (match) {
          const startFrame = parseInt(match[1]);
          const endFrame = parseInt(match[2]);
          const text = match[3].replace(/\|/g, '\n').trim();
          this.cues.push({
            id: id++,
            start: startFrame / fps,
            end: endFrame / fps,
            text: stripHtmlTags(text),
            originalText: text
          });
        }
      }
    } else {
      // Robust SubRip SRT / VTT parser engine
      let count = 0;
      let type = null;
      let id = 1;
      const parsedSubs = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line && type !== 'text') continue;

        if (type === 'time') {
          const split = line.split(/ --> /);
          if (split.length === 2) {
            type = 'text';
            parsedSubs[count].start = timeInSeconds(split[0]);
            parsedSubs[count].end = timeInSeconds(split[1]);
          }
        } else if (type === 'text') {
          if (line === '') {
            type = null;
            count++;
          } else {
            parsedSubs[count].text += (parsedSubs[count].text ? '\n' : '') + line;
          }
        } else if (!isNaN(line) && line !== '') {
          type = 'time';
          parsedSubs.push({ id: id++, text: '' });
        }
      }

      parsedSubs.forEach(sub => {
        if (sub.start !== undefined && sub.end !== undefined) {
          this.cues.push({
            id: sub.id,
            start: sub.start,
            end: sub.end,
            text: stripHtmlTags(sub.text),
            originalText: sub.text
          });
        }
      });
    }

    // Silence detection: Skip Start & Intervals > 5s
    if (this.cues.length > 0 && this.cues[0].start > 5) {
      this.cues.unshift({
        id: 0,
        text: 'Silence (' + Math.round(this.cues[0].start) + ' seconds)',
        start: 0,
        end: this.cues[0].start,
        originalText: 'Silence'
      });
    }

    this.cues.sort((a, b) => a.start - b.start);
    return this.cues;
  }

  /**
   * Calibrates subtitles by permanently modifying timing ranges
   * @param {number} shiftSeconds 
   */
  synchronize(shiftSeconds) {
    const shift = parseFloat(shiftSeconds) || 0.0;
    if (shift !== 0 && this.cues.length > 0) {
      this.cues = this.cues.map(cue => ({
        ...cue,
        start: cue.start + shift,
        end: cue.end + shift
      }));
    }
  }

  /**
   * Sets real-time playback offset delay shift in seconds
   * @param {number} seconds 
   */
  setOffset(seconds) {
    this.offset = parseFloat(seconds) || 0.0;
  }

  /**
   * Toggles subtitle rendering status
   * @param {boolean} enabled 
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled && this.overlayDiv) {
      this.overlayDiv.classList.add('hidden');
    }
  }

  /**
   * Fast look-ahead cursor stepping algorithm in O(1) time
   * @param {number} time - current media playback time 
   */
  _updatePosition(time) {
    const subs = this.cues;
    let pos = this.pos;

    if (subs && subs.length > 1) {
      if (subs[pos] && subs[pos + 1] && time >= subs[pos].start && time < subs[pos + 1].start) {
        // Sequential frame check matches, keep current index
      } else if (subs[pos + 1] && subs[pos + 2] && time >= subs[pos + 1].start && time < subs[pos + 2].start) {
        this.pos = pos + 1;
      } else if (subs[pos - 1] && time >= subs[pos - 1].start && time < subs[pos].start) {
        this.pos = pos - 1;
      } else {
        // Playback skipped or scrubbed - fall back to search index resolution
        const newPos = subs.findIndex(el => el.start > time);
        if (newPos > 0) {
          this.pos = newPos - 1;
        } else {
          this.pos = time < 200 ? 0 : subs.length - 1;
        }
      }
    }
  }

  /**
   * Renders the subtitle text cue onto the screen overlay
   * @param {number} currentTime 
   */
  render(currentTime) {
    if (!this.enabled || this.cues.length === 0) {
      if (this.overlayDiv) this.overlayDiv.classList.add('hidden');
      if (this.textSpan) this.textSpan.textContent = '';
      return;
    }

    const adjustedTime = currentTime + this.offset;
    this._updatePosition(adjustedTime);

    const activeCue = this.cues[this.pos];
    if (activeCue && adjustedTime >= activeCue.start && adjustedTime <= activeCue.end) {
      if (this.textSpan && this.textSpan.textContent !== activeCue.text) {
        this.textSpan.textContent = activeCue.text;
      }
      if (this.overlayDiv) this.overlayDiv.classList.remove('hidden');
    } else {
      if (this.textSpan) this.textSpan.textContent = '';
      if (this.overlayDiv) this.overlayDiv.classList.add('hidden');
    }
  }

  /**
   * Re-exports and downloads the synchronized subtitles as an SRT file blob
   */
  downloadSubtitle() {
    if (this.cues.length === 0) return;

    let srtContent = '';
    this.cues.forEach((cue, index) => {
      const adjustedStart = Math.max(0, cue.start + this.offset);
      const adjustedEnd = Math.max(0, cue.end + this.offset);

      srtContent += `${index + 1}\n`;
      srtContent += `${formatSecondsToSrtTime(adjustedStart)} --> ${formatSecondsToSrtTime(adjustedEnd)}\n`;
      srtContent += `${cue.originalText}\n\n`;
    });

    const blob = new Blob([srtContent.trim()], { type: 'text/srt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const nameParts = this.originalFilename.split('.');
    const baseName = nameParts.slice(0, -1).join('.') || 'subtitle';
    const newFilename = `${baseName}_synced.srt`;

    const link = document.createElement('a');
    link.href = url;
    link.download = newFilename;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Detaches handles from video elements to prevent memory leaks
   */
  destroy() {
    if (this.video && this._timeUpdateHandler) {
      this.video.removeEventListener('timeupdate', this._timeUpdateHandler);
      this.video.removeEventListener('seeking', this._timeUpdateHandler);
      this.video.removeEventListener('seeked', this._timeUpdateHandler);
    }
    this.reset();
    this.video = null;
    this._timeUpdateHandler = null;
  }
}

// Global Singleton instance for procedural backwards-compatibility
const engineInstance = new SubtitleEngine();

// Procedural Backward-Compatible Wrapper Exports
export function initSubtitles(overlay, span) {
  const mainVideo = document.getElementById('main-video');
  engineInstance.init(mainVideo, overlay, span);
}

export function resetSubtitles() {
  engineInstance.reset();
}

export function parseSubtitleFile(content, fileName = 'subtitle.srt') {
  return engineInstance.load(content, fileName);
}

export function renderCues(currentTime) {
  engineInstance.render(currentTime);
}

export function setOffset(seconds) {
  engineInstance.setOffset(seconds);
}

export function setEnabled(enabled) {
  engineInstance.setEnabled(enabled);
}

export function downloadSubtitle() {
  engineInstance.downloadSubtitle();
}

export function getSubtitleState() {
  return {
    cuesCount: engineInstance.cues.length,
    offset: engineInstance.offset,
    enabled: engineInstance.enabled,
    filename: engineInstance.originalFilename
  };
}

export function getCurrentOffset() {
  return engineInstance.offset;
}

export function resetOffset() {
  engineInstance.offset = 0.0;
}

// Bind to window for console execution
window.subtitles = {
  getCurrentOffset,
  resetOffset,
  getSubtitleState,
  initSubtitles,
  resetSubtitles,
  parseSubtitleFile,
  renderCues,
  setOffset,
  setEnabled,
  downloadSubtitle,
  SubtitleEngine
};
