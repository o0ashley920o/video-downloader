import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DOWNLOADS_DIR = path.join(__dirname, '../../downloads');

function resolveYtdlpCommand() {
  const configured = (process.env.YTDLP_PATH || 'yt-dlp').trim();

  if (fs.existsSync(configured)) {
    const stat = fs.statSync(configured);
    if (stat.isDirectory()) {
      const exeName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
      const exePath = path.join(configured, exeName);
      if (fs.existsSync(exePath)) return exePath;
    }
    return configured;
  }

  return configured;
}

function buildCommandParts(args) {
  const base = resolveYtdlpCommand();
  if (base.includes(' ')) {
    return [...base.split(' '), ...args];
  }
  return [base, ...args];
}

function runYtdlp(args, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const parts = buildCommandParts(args);
    const [command, ...spawnArgs] = parts;
    const child = spawn(command, spawnArgs, {
      windowsHide: true,
    });

    let stderr = '';

    child.stdout?.on('data', (data) => {
      parseProgress(data.toString(), onProgress);
    });

    child.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      parseProgress(chunk, onProgress);
    });

    child.on('error', (error) => {
      reject(new Error(error.message));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }
    });
  });
}

function parseProgress(text, onProgress) {
  if (!onProgress) return;
  const match = text.match(/(\d+\.?\d*)%/);
  if (match) {
    onProgress(parseFloat(match[1]));
  }
}

function normalizeOutputPath(outputPath) {
  return path.resolve(outputPath).replace(/\\/g, '/');
}

/**
 * Get video information from URL
 */
export async function getVideoInfo(url) {
  try {
    const { stdout } = await runYtdlpCapture(['--dump-json', url]);
    const info = JSON.parse(stdout);

    return {
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      formats: extractFormats(info.formats || []),
      uploader: info.uploader,
      upload_date: info.upload_date,
      id: info.id,
    };
  } catch (error) {
    throw new Error(`Failed to fetch video info: ${error.message}`);
  }
}

function runYtdlpCapture(args) {
  return new Promise((resolve, reject) => {
    const parts = buildCommandParts(args);
    const [command, ...spawnArgs] = parts;
    const child = spawn(command, spawnArgs, {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      reject(new Error(error.message));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }
    });
  });
}

/**
 * Extract available formats
 */
function extractFormats(formats) {
  const uniqueFormats = {};

  formats.forEach((format) => {
    if (format.vcodec !== 'none' && format.acodec !== 'none') {
      const quality = format.height ? `${format.height}p` : 'unknown';
      const ext = format.ext || 'mp4';

      if (!uniqueFormats[quality]) {
        uniqueFormats[quality] = {
          quality,
          format: ext,
          filesize: format.filesize || 0,
        };
      }
    }
  });

  const audioFormat = formats.find((f) => f.vcodec === 'none' && f.acodec !== 'none');
  if (audioFormat) {
    uniqueFormats.audio = {
      quality: 'audio',
      format: 'mp3',
      filesize: audioFormat.filesize || 0,
    };
  }

  return Object.values(uniqueFormats).sort((a, b) => {
    const aQuality = parseInt(a.quality) || 0;
    const bQuality = parseInt(b.quality) || 0;
    return bQuality - aQuality;
  });
}

/**
 * Download video with custom filename pattern
 */
export async function downloadVideo(
  url,
  outputPath,
  format = 'best',
  filenamePattern = '%(title)s',
  onProgress = null
) {
  let formatString = 'bestvideo+bestaudio/best';

  if (format === 'mp3' || format === 'audio') {
    formatString = 'bestaudio';
  } else if (format.includes('p')) {
    const quality = parseInt(format);
    formatString = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`;
  }

  const resolvedOutput = normalizeOutputPath(
    process.env.DOWNLOADS_DIR || outputPath || DEFAULT_DOWNLOADS_DIR
  );
  const outputTemplate = `${resolvedOutput}/${filenamePattern}.%(ext)s`;

  const args = ['-f', formatString, '-o', outputTemplate, '--newline', '--progress'];

  if (format === 'mp3' || format === 'audio') {
    args.push('-x', '--audio-format', 'mp3');
  }

  args.push(url);

  return runYtdlp(args, { onProgress });
}

/**
 * Check if yt-dlp is installed
 */
export async function checkYtdlpInstalled() {
  try {
    await runYtdlpCapture(['--version']);
    return true;
  } catch {
    return false;
  }
}

export function getResolvedYtdlpCommand() {
  return resolveYtdlpCommand();
}
