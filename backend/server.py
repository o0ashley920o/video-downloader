from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional, Dict, Any
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
import uuid
from datetime import datetime, timezone
import yt_dlp

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

DOWNLOAD_DIR = ROOT_DIR / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Video Downloader API with Task Queue")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============
class URLRequest(BaseModel):
    url: str
    expand_playlist: bool = False

class BulkInfoRequest(BaseModel):
    urls: List[str]

class FormatOption(BaseModel):
    format_id: str
    label: str
    ext: str
    resolution: Optional[str] = None
    filesize: Optional[int] = None
    type: str

class PlaylistEntry(BaseModel):
    url: str
    title: str = ""
    thumbnail: Optional[str] = None
    duration: Optional[int] = None

class VideoInfo(BaseModel):
    url: str
    title: str
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    uploader: Optional[str] = None
    formats: List[FormatOption] = []
    is_playlist: bool = False
    entries: List[PlaylistEntry] = []
    playlist_count: int = 0
    error: Optional[str] = None

class DownloadRequest(BaseModel):
    url: str
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    format_choice: str = "best"
    filename_template: str = "%(title).80s"
    subtitles: str = "none"
    subtitle_langs: str = "en"

class BulkDownloadRequest(BaseModel):
    urls: List[str]
    format_choice: str = "best"
    filename_template: str = "%(title).80s"
    subtitles: str = "none"
    subtitle_langs: str = "en"

class DownloadJob(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    title: str = ""
    thumbnail: Optional[str] = None
    format_choice: str = "best"
    filename_template: str = "%(title).80s"
    subtitles: str = "none"
    subtitle_langs: str = "en"
    status: str = "queued"  # queued, downloading, paused, completed, failed, cancelled
    progress: float = 0.0
    speed: Optional[str] = None
    eta: Optional[str] = None
    filename: Optional[str] = None
    ext: Optional[str] = None
    filesize: Optional[int] = None
    subtitle_files: List[str] = []
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None

# ============== GLOBAL QUEUE & STATE MANAGEMENT ==============
DOWNLOAD_QUEUE: asyncio.Queue = asyncio.Queue()
RUNNING_JOBS: Dict[str, asyncio.Task] = {}
CANCEL_FLAGS: Dict[str, str] = {}
WEBSOCKET_ROOMS: Dict[str, List[WebSocket]] = {}

MAX_CONCURRENT_DOWNLOADS = 2  # Limits how many downloads run at the same time

class _CancelDownload(Exception):
    pass

class CustomYTDLWithCancelLogger:
    def __init__(self, job_id: str):
        self.job_id = job_id
    def debug(self, msg): self._check()
    def info(self, msg): self._check()
    def warning(self, msg): self._check()
    def error(self, msg): self._check()
    def _check(self):
        flag = CANCEL_FLAGS.get(self.job_id)
        if flag:
            raise _CancelDownload(flag)

# ============== MANAGER HELPERS ==============
def sanitize_template(template: str) -> str:
    template = (template or "%(title).80s").strip()
    template = template.replace("\\", "_").replace("/", "_").replace("..", "_").lstrip(".")
    return template[:120] if template else "%(title).80s"

def build_format_selector(format_choice: str) -> Dict[str, Any]:
    if format_choice == "audio":
        return {
            "format": "bestaudio/best",
            "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}],
            "merge_output_format": None,
        }
    quality_map = {
        "best": "bestvideo+bestaudio/best",
        "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
        "720p": "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "480p": "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
        "360p": "bestvideo[height<=360]+bestaudio/best[height<=360]/best",
    }
    return {"format": quality_map.get(format_choice, quality_map["best"]), "merge_output_format": "mp4"}

async def update_job(job_id: str, updates: Dict[str, Any]):
    await db.download_jobs.update_one({"id": job_id}, {"$set": updates})
    if job_id in WEBSOCKET_ROOMS:
        disconnected = []
        for ws in WEBSOCKET_ROOMS[job_id]:
            try:
                await ws.send_json({"job_id": job_id, **updates})
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            try:
                WEBSOCKET_ROOMS[job_id].remove(ws)
            except ValueError:
                pass

# ============== CORE QUEUE WORKER SYSTEM ==============
async def queue_worker_loop():
    """Continuous Celery-style worker loop reading tasks out of the queue."""
    logger.info("Background queue worker system initialized.")
    while True:
        job_data = await DOWNLOAD_QUEUE.get()
        job_id = job_data["id"]
        
        # Check if the task was cancelled or paused while waiting in line
        doc = await db.download_jobs.find_one({"id": job_id})
        if not doc or doc.get("status") in ("cancelled", "paused"):
            DOWNLOAD_QUEUE.task_done()
            continue

        loop = asyncio.get_running_loop()
        task = asyncio.ensure_future(
            loop.run_in_executor(
                None, run_download_sync,
                job_id, job_data["url"], job_data["format_choice"],
                job_data["filename_template"], job_data["subtitles"],
                job_data["subtitle_langs"], loop
            )
        )
        RUNNING_JOBS[job_id] = task
        
        try:
            await task
        except asyncio.CancelledError:
            pass
        finally:
            RUNNING_JOBS.pop(job_id, None)
            DOWNLOAD_QUEUE.task_done()

@app.on_event("startup")
async def start_queue_workers():
    # Spin up workers matching your desired concurrency ceiling limit
    for _ in range(MAX_CONCURRENT_DOWNLOADS):
        asyncio.create_task(queue_worker_loop())

# ============== SYNCHRONOUS YT-DLP EXECUTION RUNNER ==============
def run_download_sync(job_id: str, url: str, format_choice: str, filename_template: str, subtitles: str, subtitle_langs: str, loop: asyncio.AbstractEventLoop):
    final_filename = {"value": None}
    job_dir = DOWNLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    def progress_hook(d):
        flag = CANCEL_FLAGS.get(job_id)
        if flag: raise _CancelDownload(flag)
            
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            pct = (downloaded / total * 100) if total else 0
            speed = d.get("speed")
            eta = d.get("eta")
            speed_str = f"{speed/1024/1024:.2f} MB/s" if speed else None
            eta_str = f"{int(eta)}s" if eta else None
            
            asyncio.run_coroutine_threadsafe(
                update_job(job_id, {
                    "status": "downloading", "progress": round(pct, 2),
                    "speed": speed_str, "eta": eta_str,
                }), loop
            )
        elif status == "finished":
            final_filename["value"] = d.get("filename")

    template = sanitize_template(filename_template)
    out_template = str(job_dir / f"{template}.%(ext)s")
    fmt_opts = build_format_selector(format_choice)
    
    ydl_opts = {
        "outtmpl": out_template, "noplaylist": True, "progress_hooks": [progress_hook],
        "logger": CustomYTDLWithCancelLogger(job_id), "quiet": True, "no_warnings": True,
        "restrictfilenames": True, "continuedl": True,  # Chunk-level file append resume flag
        **fmt_opts,
    }

    try:
        asyncio.run_coroutine_threadsafe(update_job(job_id, {"status": "downloading"}), loop)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)

        resolved_path = final_filename["value"] or info.get("_filename")
        media_path = Path(resolved_path)
        if format_choice == "audio" and media_path.with_suffix(".mp3").exists():
            media_path = media_path.with_suffix(".mp3")

        sub_files = [p.name for p in job_dir.iterdir() if p.suffix.lower() in (".srt", ".vtt")]

        asyncio.run_coroutine_threadsafe(
            update_job(job_id, {
                "status": "completed", "progress": 100.0, "filename": media_path.name,
                "ext": media_path.suffix.lstrip("."), "filesize": media_path.stat().st_size,
                "subtitle_files": sub_files, "completed_at": datetime.now(timezone.utc).isoformat(),
            }), loop
        )
    except _CancelDownload as ce:
        new_status = "paused" if str(ce) == "paused" else "cancelled"
        asyncio.run_coroutine_threadsafe(update_job(job_id, {"status": new_status, "speed": None, "eta": None}), loop)
    except Exception as e:
        flag = CANCEL_FLAGS.get(job_id)
        new_status = "paused" if flag == "paused" else ("cancelled" if flag == "cancelled" else "failed")
        updates = {"status": new_status, "speed": None, "eta": None}
        if new_status == "failed": updates["error"] = str(e)[:500]
        asyncio.run_coroutine_threadsafe(update_job(job_id, updates), loop)

# ============== WEBSOCKET PROGRESS STREAM ROOM ==============
@api_router.websocket("/video/stream/{job_id}")
async def stream_job_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()
    if job_id not in WEBSOCKET_ROOMS:
        WEBSOCKET_ROOMS[job_id] = []
    WEBSOCKET_ROOMS[job_id].append(websocket)
    
    doc = await db.download_jobs.find_one({"id": job_id}, {"_id": 0})
    if doc: await websocket.send_json(doc)
        
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if job_id in WEBSOCKET_ROOMS:
            try:
                WEBSOCKET_ROOMS[job_id].remove(websocket)
                if not WEBSOCKET_ROOMS[job_id]: WEBSOCKET_ROOMS.pop(job_id)
            except ValueError: pass

# ============== API QUEUE ENDPOINTS ==============
@api_router.post("/video/download", response_model=DownloadJob)
async def video_download(req: DownloadRequest):
    job = DownloadJob(url=req.url, title=req.title or "", thumbnail=req.thumbnail, format_choice=req.format_choice)
    await db.download_jobs.insert_one(job.model_dump())
    
    # Push job into the queue instead of running immediately
    await DOWNLOAD_QUEUE.put(job.model_dump())
    return job

@api_router.post("/video/download/bulk", response_model=List[DownloadJob])
async def video_download_bulk(req: BulkDownloadRequest):
    jobs = []
    for u in [url.strip() for url in req.urls if url.strip()]:
        job = DownloadJob(url=u, format_choice=req.format_choice)
        await db.download_jobs.insert_one(job.model_dump())
        await DOWNLOAD_QUEUE.put(job.model_dump())
        jobs.append(job)
    return jobs

@api_router.post("/video/jobs/{job