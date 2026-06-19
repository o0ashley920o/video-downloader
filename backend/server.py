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
load_dotenv(ROOT_DIR / ".env")

DOWNLOAD_DIR = ROOT_DIR / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ===== Database setup with safe fallback =====
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME", "video_downloader")
mongo_client = AsyncIOMotorClient(mongo_url) if mongo_url else None
mongo_db = mongo_client[db_name] if mongo_client else None

_status_checks_mem: List[Dict[str, Any]] = []
_download_jobs_mem: Dict[str, Dict[str, Any]] = {}


async def db_insert_status(doc: Dict[str, Any]):
    if mongo_db:
        await mongo_db.status_checks.insert_one(doc)
    else:
        _status_checks_mem.append(dict(doc))


async def db_list_status() -> List[Dict[str, Any]]:
    if mongo_db:
        return await mongo_db.status_checks.find({}, {"_id": 0}).to_list(1000)
    return list(_status_checks_mem)


async def db_insert_job(doc: Dict[str, Any]):
    if mongo_db:
        await mongo_db.download_jobs.insert_one(doc)
    else:
        _download_jobs_mem[doc["id"]] = dict(doc)


async def db_get_job(job_id: str) -> Optional[Dict[str, Any]]:
    if mongo_db:
        return await mongo_db.download_jobs.find_one({"id": job_id}, {"_id": 0})
    item = _download_jobs_mem.get(job_id)
    return dict(item) if item else None


async def db_update_job(job_id: str, updates: Dict[str, Any]):
    if mongo_db:
        await mongo_db.download_jobs.update_one({"id": job_id}, {"$set": updates})
    else:
        if job_id in _download_jobs_mem:
            _download_jobs_mem[job_id].update(updates)


async def db_list_jobs(limit: int = 500) -> List[Dict[str, Any]]:
    if mongo_db:
        return await mongo_db.download_jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    docs = list(_download_jobs_mem.values())
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return [dict(x) for x in docs[:limit]]


async def db_delete_job(job_id: str):
    if mongo_db:
        await mongo_db.download_jobs.delete_one({"id": job_id})
    else:
        _download_jobs_mem.pop(job_id, None)


async def db_clear_jobs():
    if mongo_db:
        await mongo_db.download_jobs.delete_many({})
    else:
        _download_jobs_mem.clear()


# ===== Models =====
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


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
    status: str = "queued"
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


# ===== App =====
app = FastAPI(title="Video Downloader API")
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Queue runtime =====
DOWNLOAD_QUEUE: asyncio.Queue = asyncio.Queue()
RUNNING_JOBS: Dict[str, asyncio.Task] = {}
CANCEL_FLAGS: Dict[str, str] = {}
WEBSOCKET_ROOMS: Dict[str, List[WebSocket]] = {}
MAX_CONCURRENT_DOWNLOADS = 2


class _CancelDownload(Exception):
    pass


class CustomYTDLWithCancelLogger:
    def __init__(self, job_id: str):
        self.job_id = job_id

    def debug(self, msg):
        self._check()

    def info(self, msg):
        self._check()

    def warning(self, msg):
        self._check()

    def error(self, msg):
        self._check()

    def _check(self):
        flag = CANCEL_FLAGS.get(self.job_id)
        if flag:
            raise _CancelDownload(flag)


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
    # Prefer progressive (video+audio in one stream) first for faster completion,
    # then fall back to separate streams when needed.
    quality_map = {
        "best": "best[vcodec!=none][acodec!=none]/bestvideo+bestaudio/best",
        "1080p": "best[height<=1080][vcodec!=none][acodec!=none]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
        "720p": "best[height<=720][vcodec!=none][acodec!=none]/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "480p": "best[height<=480][vcodec!=none][acodec!=none]/bestvideo[height<=480]+bestaudio/best[height<=480]/best",
        "360p": "best[height<=360][vcodec!=none][acodec!=none]/bestvideo[height<=360]+bestaudio/best[height<=360]/best",
    }
    return {"format": quality_map.get(format_choice, quality_map["best"]), "merge_output_format": "mp4"}


async def update_job(job_id: str, updates: Dict[str, Any]):
    await db_update_job(job_id, updates)
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


def run_download_sync(job_id: str, url: str, format_choice: str, filename_template: str, subtitles: str, subtitle_langs: str, loop: asyncio.AbstractEventLoop):
    final_filename = {"value": None}
    job_dir = DOWNLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    def progress_hook(d):
        flag = CANCEL_FLAGS.get(job_id)
        if flag:
            raise _CancelDownload(flag)

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
                update_job(job_id, {"status": "downloading", "progress": round(pct, 2), "speed": speed_str, "eta": eta_str}),
                loop,
            )
        elif status == "finished":
            final_filename["value"] = d.get("filename")

    template = sanitize_template(filename_template)
    out_template = str(job_dir / f"{template}.%(ext)s")
    fmt_opts = build_format_selector(format_choice)

    ydl_opts = {
        "outtmpl": out_template,
        "noplaylist": True,
        "progress_hooks": [progress_hook],
        "logger": CustomYTDLWithCancelLogger(job_id),
        "quiet": True,
        "no_warnings": True,
        "restrictfilenames": True,
        "continuedl": True,
        "concurrent_fragment_downloads": int(os.environ.get("YTDLP_CONCURRENT_FRAGMENTS", "8")),
        "http_chunk_size": int(os.environ.get("YTDLP_HTTP_CHUNK_SIZE", "10485760")),
        "socket_timeout": int(os.environ.get("YTDLP_SOCKET_TIMEOUT", "30")),
        "retries": int(os.environ.get("YTDLP_RETRIES", "10")),
        "fragment_retries": int(os.environ.get("YTDLP_FRAGMENT_RETRIES", "10")),
        "extractor_retries": int(os.environ.get("YTDLP_EXTRACTOR_RETRIES", "3")),
        "extractor_args": {
            "generic": {
                "impersonate": ["chrome"]
            }
        },
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
            update_job(
                job_id,
                {
                    "status": "completed",
                    "progress": 100.0,
                    "filename": media_path.name,
                    "ext": media_path.suffix.lstrip("."),
                    "filesize": media_path.stat().st_size,
                    "subtitle_files": sub_files,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            ),
            loop,
        )
    except _CancelDownload as ce:
        new_status = "paused" if str(ce) == "paused" else "cancelled"
        asyncio.run_coroutine_threadsafe(update_job(job_id, {"status": new_status, "speed": None, "eta": None}), loop)
    except Exception as e:
        flag = CANCEL_FLAGS.get(job_id)
        new_status = "paused" if flag == "paused" else ("cancelled" if flag == "cancelled" else "failed")
        updates = {"status": new_status, "speed": None, "eta": None}
        if new_status == "failed":
            updates["error"] = str(e)[:500]
        asyncio.run_coroutine_threadsafe(update_job(job_id, updates), loop)


async def queue_worker_loop():
    logger.info("Background queue worker initialized")
    while True:
        job_data = await DOWNLOAD_QUEUE.get()
        job_id = job_data["id"]
        doc = await db_get_job(job_id)
        if not doc or doc.get("status") in ("cancelled", "paused"):
            DOWNLOAD_QUEUE.task_done()
            continue

        loop = asyncio.get_running_loop()
        task = asyncio.ensure_future(
            loop.run_in_executor(
                None,
                run_download_sync,
                job_id,
                job_data["url"],
                job_data["format_choice"],
                job_data["filename_template"],
                job_data["subtitles"],
                job_data["subtitle_langs"],
                loop,
            )
        )
        RUNNING_JOBS[job_id] = task
        try:
            await task
        finally:
            RUNNING_JOBS.pop(job_id, None)
            DOWNLOAD_QUEUE.task_done()


@app.on_event("startup")
async def start_workers():
    for _ in range(MAX_CONCURRENT_DOWNLOADS):
        asyncio.create_task(queue_worker_loop())


# ===== Basic status routes (from your provided template) =====
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    await db_insert_status(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    rows = await db_list_status()
    for check in rows:
        if isinstance(check.get("timestamp"), str):
            check["timestamp"] = datetime.fromisoformat(check["timestamp"])
    return rows


# ===== Downloader routes =====
@api_router.websocket("/video/stream/{job_id}")
async def stream_job_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()
    WEBSOCKET_ROOMS.setdefault(job_id, []).append(websocket)

    doc = await db_get_job(job_id)
    if doc:
        await websocket.send_json(doc)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if job_id in WEBSOCKET_ROOMS:
            try:
                WEBSOCKET_ROOMS[job_id].remove(websocket)
                if not WEBSOCKET_ROOMS[job_id]:
                    WEBSOCKET_ROOMS.pop(job_id)
            except ValueError:
                pass


@api_router.post("/video/download", response_model=DownloadJob)
async def video_download(req: DownloadRequest):
    job = DownloadJob(
        url=req.url,
        title=req.title or "",
        thumbnail=req.thumbnail,
        format_choice=req.format_choice,
        filename_template=req.filename_template,
        subtitles=req.subtitles,
        subtitle_langs=req.subtitle_langs,
    )
    await db_insert_job(job.model_dump())
    await DOWNLOAD_QUEUE.put(job.model_dump())
    return job


@api_router.post("/video/download/bulk", response_model=List[DownloadJob])
async def video_download_bulk(req: BulkDownloadRequest):
    jobs = []
    for u in [url.strip() for url in req.urls if url.strip()]:
        job = DownloadJob(
            url=u,
            format_choice=req.format_choice,
            filename_template=req.filename_template,
            subtitles=req.subtitles,
            subtitle_langs=req.subtitle_langs,
        )
        await db_insert_job(job.model_dump())
        await DOWNLOAD_QUEUE.put(job.model_dump())
        jobs.append(job)
    return jobs


@api_router.get("/video/jobs", response_model=List[DownloadJob])
async def list_jobs():
    docs = await db_list_jobs()
    return [DownloadJob(**doc) for doc in docs]


@api_router.post("/video/jobs/{job_id}/pause", response_model=DownloadJob)
async def pause_job(job_id: str):
    job = await db_get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    CANCEL_FLAGS[job_id] = "paused"
    await update_job(job_id, {"status": "paused", "speed": None, "eta": None})
    updated = await db_get_job(job_id)
    return DownloadJob(**updated)


@api_router.post("/video/jobs/{job_id}/resume", response_model=DownloadJob)
async def resume_job(job_id: str):
    job = await db_get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    CANCEL_FLAGS.pop(job_id, None)
    await update_job(job_id, {"status": "queued", "speed": None, "eta": None})
    refreshed = await db_get_job(job_id)
    await DOWNLOAD_QUEUE.put(refreshed)
    return DownloadJob(**refreshed)


@api_router.post("/video/jobs/{job_id}/cancel", response_model=DownloadJob)
async def cancel_job(job_id: str):
    job = await db_get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    CANCEL_FLAGS[job_id] = "cancelled"
    await update_job(job_id, {"status": "cancelled", "speed": None, "eta": None})
    updated = await db_get_job(job_id)
    return DownloadJob(**updated)


@api_router.delete("/video/jobs/{job_id}")
async def delete_job(job_id: str):
    existing = await db_get_job(job_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Job not found")

    job_dir = DOWNLOAD_DIR / job_id
    if job_dir.exists():
        for file in job_dir.iterdir():
            try:
                file.unlink()
            except Exception:
                pass
        try:
            job_dir.rmdir()
        except Exception:
            pass

    await db_delete_job(job_id)
    return {"success": True}


@api_router.delete("/video/jobs")
async def clear_jobs():
    docs = await db_list_jobs(10000)
    for doc in docs:
        job_dir = DOWNLOAD_DIR / doc.get("id", "")
        if job_dir.exists():
            for file in job_dir.iterdir():
                try:
                    file.unlink()
                except Exception:
                    pass
            try:
                job_dir.rmdir()
            except Exception:
                pass
    await db_clear_jobs()
    return {"success": True}


@api_router.get("/video/file/{job_id}")
async def get_file(job_id: str):
    job = await db_get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    filename = job.get("filename")
    if not filename:
        raise HTTPException(status_code=404, detail="No downloaded file for this job")

    file_path = DOWNLOAD_DIR / job_id / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(path=file_path, filename=filename)


@api_router.get("/health")
async def health_check():
    return {"status": "ok"}


app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    if mongo_client:
        mongo_client.close()
