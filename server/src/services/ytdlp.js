import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || path.join(__dirname, '../../downloads');

/**
 * Get video information from URL
 */
export async function getVideoInfo(url) {
  try {
    const command = `${YTDLP_PATH} --dump-json "${url}"`;
    const { stdout } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
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

  // Add audio-only option
  const audioFormat = formats.find((f) => f.vcodec === 'none' && f.acodec !== 'none');
  if (audioFormat) {
    uniqueFormats['audio'] = {
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
export async function downloadVideo(url, outputPath, format = 'best', filenamePattern = '%(title)s', onProgress = null) {
  try {
    return new Promise((resolve, reject) => {
      let formatString = 'bestvideo+bestaudio/best';

      if (format === 'mp3' || format === 'audio') {
        formatString = 'bestaudio';
      } else if (format.includes('p')) {
        const quality = parseInt(format);
        formatString = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`;
      }

      // Use custom filename pattern with proper escaping
      const outputTemplate = path.join(outputPath, `${filenamePattern}.%(ext)s`);
      
      let postprocessorArgs = [];
      if (format === 'mp3' || format === 'audio') {
        postprocessorArgs = ['-x', '--audio-format', 'mp3'];
      }

      const args = [
        YTDLP_PATH,
        '-f', formatString,
        '-o', outputTemplate,
        ...postprocessorArgs,
        url,
      ];

      const command = args.join(' ');
      const childProcess = exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error) => {
        if (error) {
          reject(new Error(`Download failed: ${error.message}`));
        } else {
          resolve({ success: true });
        }
      });

      // Track progress if callback provided
      if (onProgress && childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          const progressMatch = data.toString().match(/(\d+\.?\d*)%/);
          if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            onProgress(progress);
          }
        });
      }
    });
  } catch (error) {
    throw new Error(`Download error: ${error.message}`);
  }
}

/**
 * Check if yt-dlp is installed
 */
export async function checkYtdlpInstalled() {
  try {
    await execPromise(`${YTDLP_PATH} --version`);
    return true;
  } catch {
    return false;
  }
}
