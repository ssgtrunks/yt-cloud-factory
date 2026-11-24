import os
import io
import sys
import glob
import json
import shutil
import hashlib
import asyncio
import subprocess
import edge_tts
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload

CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
DRIVE_REFRESH_TOKEN = os.environ.get("DRIVE_REFRESH_TOKEN", "").strip()
DRIVE_ROOT_ID = os.environ.get("DRIVE_ROOT_FOLDER_ID", "").strip()

CHANNEL_TOKEN_MAP = {
    "@CapLedger": os.environ.get("YT_TOKEN_CAPLEDGER", "").strip(),
    "@WorkflowStack-AI": os.environ.get("YT_TOKEN_WORKFLOWSTACK", "").strip(),
    "@MarketAnatomyTVA": os.environ.get("YT_TOKEN_MARKETANATOMY", "").strip(),
}

DEFAULT_THEMES = {
    "@CapLedger": ("glass_neon", "#38BDF8", "hosts/capledger.png", "Alex Mercer", "en-US-AndrewMultilingualNeural"),
    "@WorkflowStack-AI": ("cyber_dark", "#10B981", "hosts/workflowstack.png", "Devon Vance", "en-US-BrianNeural"),
    "@MarketAnatomyTVA": ("modern_bento", "#059669", "hosts/marketanatomy.png", "Ryan Carter", "en-US-ChristopherNeural"),
}

def build_service(service_name, version, refresh_token):
    if not refresh_token:
        raise ValueError(f"Empty refresh token provided for {service_name}")
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
    )
    return build(service_name, version, credentials=creds)

def get_duration(file_path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path]
    return float(subprocess.check_output(cmd).decode().strip())

async def generate_tts_with_words(text, audio_path, voice):
    communicate = edge_tts.Communicate(text, voice, rate="+5%")
    words = []
    with open(audio_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start_sec = chunk["offset"] / 10_000_000.0
                dur_sec = chunk["duration"] / 10_000_000.0
                words.append({
                    "word": chunk["text"],
                    "startSec": round(start_sec, 3),
                    "endSec": round(start_sec + dur_sec, 3),
                })

    if not words:
        total_audio_dur = max(1.0, get_duration(audio_path) - 0.15)
        tokens = [w for w in text.strip().split() if w]
        total_chars = sum(len(t) for t in tokens) or 1
        cursor = 0.05
        for tok in tokens:
            w_dur = (len(tok) / total_chars) * total_audio_dur
            words.append({
                "word": tok,
                "startSec": round(cursor, 3),
                "endSec": round(cursor + w_dur, 3),
            })
            cursor += w_dur
    return words

def get_or_create_drive_subfolder(drive, parent_id, folder_name):
    q = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    res = drive.files().list(
        q=q, fields="files(id)", supportsAllDrives=True, includeItemsFromAllDrives=True
    ).execute().get("files", [])
    if res:
        return res[0]["id"]
    meta = {"name": folder_name, "mimeType": "application/vnd.google-apps.folder", "parents": [parent_id]}
    return drive.files().create(body=meta, fields="id", supportsAllDrives=True).execute()["id"]

def download_host_from_drive(drive, host_filename, dest_path):
    """Fetches host PNG from YT_Cloud_Factory/hosts/ in Google Drive."""
    try:
        hosts_folder_id = get_or_create_drive_subfolder(drive, DRIVE_ROOT_ID, "hosts")
        q = f"name='{host_filename}' and '{hosts_folder_id}' in parents and trashed=false"
        files = drive.files().list(
            q=q, fields="files(id, name)", supportsAllDrives=True, includeItemsFromAllDrives=True
        ).execute().get("files", [])
        if not files:
            print(f"Host image {host_filename} not found in Google Drive YT_Cloud_Factory/hosts/")
            return False
        request = drive.files().get_media(fileId=files[0]["id"], supportsAllDrives=True)
        with io.FileIO(dest_path, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        print(f"Downloaded host portrait {host_filename} from Google Drive!")
        return True
    except Exception as e:
        print(f"Drive host download note for {host_filename}: {e}")
        return False

def file_exists_in_drive(drive, folder_id, filename):
    q = f"name='{filename}' and '{folder_id}' in parents and trashed=false"
    res = drive.files().list(
        q=q, fields="files(id)", supportsAllDrives=True, includeItemsFromAllDrives=True
    ).execute().get("files", [])
    return len(res) > 0

def upload_to_drive(drive, folder_id, file_path, mime_type):
    meta = {"name": os.path.basename(file_path), "parents": [folder_id]}
    media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
    uploaded = drive.files().create(body=meta, media_body=media, fields="id", supportsAllDrives=True).execute()
    print(f"Backed up to 5TB Google Drive (ID: {uploaded['id']})")

def download_music_from_drive(drive, seed, dest_path):
    """Picks one royalty-free track from YT_Cloud_Factory/music/ (stable per episode)."""
    try:
        music_folder_id = get_or_create_drive_subfolder(drive, DRIVE_ROOT_ID, "music")
        q = f"'{music_folder_id}' in parents and trashed=false and (mimeType contains 'audio/' or name contains '.mp3' or name contains '.wav' or name contains '.m4a')"
        files = drive.files().list(
            q=q, fields="files(id, name)", supportsAllDrives=True, includeItemsFromAllDrives=True, orderBy="name"
        ).execute().get("files", [])
        if not files:
            print("No music tracks found in Google Drive YT_Cloud_Factory/music/ - rendering voice only")
            return None
        pick = files[int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(files)]
        request = drive.files().get_media(fileId=pick["id"], supportsAllDrives=True)
        with io.FileIO(dest_path, "wb") as fh:
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
        print(f"Music bed: {pick['name']}")
        return dest_path
    except Exception as e:
        print(f"Music download note: {e}")
        return None

def render_thumbnail(data, theme, accent_color, out_path):
    """Renders a 1280x720 PNG thumbnail with the Remotion 'Thumbnail' still."""
    props = {
        "thumbnailText": data.get("thumbnail_text") or data["title_options"][0],
        "subText": data.get("thumbnail_subtext", ""),
        "highlightWord": data.get("thumbnail_highlight", ""),
        "ringText": data.get("thumbnail_ring_text", ""),
        "channelHandle": data["channel_handle"],
        "theme": theme,
        "accentColor": accent_color,
    }
    props_path = "/tmp/thumb_props.json"
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f)
    try:
        subprocess.run(["npx", "remotion", "still", "remotion/index.ts", "Thumbnail", out_path,
                        f"--props={props_path}"], check=True)
        return out_path
    except Exception as e:
        print(f"Thumbnail render note: {e}")
        return None

def set_youtube_thumbnail(youtube, video_id, thumb_path):
    try:
        youtube.thumbnails().set(videoId=video_id, media_body=MediaFileUpload(thumb_path, mimetype="image/png")).execute()
        print("Custom thumbnail set on YouTube")
    except Exception as e:
        print(f"Thumbnail upload note (channel may need phone verification for custom thumbnails): {e}")

def upload_to_youtube(youtube, video_path, data):
    body = {
        "snippet": {
            "title": data["title_options"][0][:100],
            "description": data["seo_description"],
            "tags": data.get("tags", []),
            "categoryId": "27",
            "defaultLanguage": "en",
        },
        "status": {
            "privacyStatus": "private",
            "selfDeclaredMadeForKids": data.get("made_for_kids", False),
            "containsSyntheticMedia": data.get("contains_synthetic_media", True),
        },
    }
    media = MediaFileUpload(video_path, chunksize=-1, resumable=True, mimetype="video/mp4")
    response = youtube.videos().insert(part="snippet,status", body=body, media_body=media).execute()
    print(f"Uploaded to {data['channel_handle']}! Video ID: {response['id']}")
    return response["id"]

def render_episode(script_json_path):
    with open(script_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    handle = data["channel_handle"]
    yt_token = CHANNEL_TOKEN_MAP.get(handle)
    if not yt_token:
        raise ValueError(f"Missing YouTube Refresh Token secret for channel: {handle}")

    drive = build_service("drive", "v3", DRIVE_REFRESH_TOKEN)
    youtube = build_service("youtube", "v3", yt_token)

    default_theme, default_accent, default_host_img, default_host_name, default_voice = DEFAULT_THEMES.get(
        handle, ("glass_neon", "#38BDF8", "hosts/capledger.png", handle, "en-US-AndrewMultilingualNeural")
    )
    theme = data.get("theme", default_theme)
    accent_color = data.get("accent_color", default_accent)
    host_src = data.get("host_image", default_host_img)
    host_name = data.get("host_name", default_host_name)
    voice = data.get("voice_id", default_voice)
    aspect = data.get("aspect_ratio", "16:9")
    width, height = (1080, 1920) if aspect == "9:16" else (1920, 1080)

    public_assets_dir = os.path.join("public", "assets")
    if os.path.exists(public_assets_dir):
        shutil.rmtree(public_assets_dir)
    os.makedirs(public_assets_dir, exist_ok=True)

    host_rel_path = None
    if host_src:
        host_filename = os.path.basename(host_src)
        dest_host_path = os.path.join(public_assets_dir, host_filename)
        if os.path.exists(host_src):
            shutil.copy2(host_src, dest_host_path)
            host_rel_path = f"assets/{host_filename}"
        elif download_host_from_drive(drive, host_filename, dest_host_path):
            host_rel_path = f"assets/{host_filename}"

    remotion_scenes = []
    cursor_sec = 0.0

    for idx, scene in enumerate(data["scenes"]):
        print(f"[{handle}] Building Motion Scene {idx+1}/{len(data['scenes'])}")
        audio_name = f"audio_{idx}.mp3"
        audio_disk_path = os.path.join(public_assets_dir, audio_name)
        words = asyncio.run(generate_tts_with_words(scene["narration"], audio_disk_path, voice))
        dur = get_duration(audio_disk_path) + 0.40

        chart_obj = scene.get("chart") or {
            "type": "kpi",
            "title": scene.get("callout_text", data["title_options"][0]),
            "labels": ["Key Insight"],
            "values": [100],
            "unit": "%",
        }

        remotion_scenes.append({
            "sceneNumber": idx + 1,
            "startSec": round(cursor_sec, 3),
            "durationSec": round(dur, 3),
            "calloutText": scene.get("callout_text", ""),
            "audioFile": f"assets/{audio_name}",
            "chart": chart_obj,
            "words": words,
        })
        cursor_sec += dur

    props_payload = {
        "channelHandle": handle,
        "episodeTitle": data["title_options"][0],
        "hostImage": host_rel_path,
        "hostName": host_name,
        "theme": theme,
        "accentColor": accent_color,
        "width": width,
        "height": height,
        "totalDurationSec": round(cursor_sec, 3),
        "scenes": remotion_scenes,
    }

    props_file = "/tmp/remotion_props.json"
    with open(props_file, "w", encoding="utf-8") as f:
        json.dump(props_payload, f)

    raw_remotion_mp4 = "/tmp/remotion_raw.mp4"
    print(f"[{handle}] Rendering High-Bitrate 1080p Remotion Studio Video...")
    subprocess.run([
        "npx", "remotion", "render", "remotion/index.ts", "DocumentaryVideo",
        raw_remotion_mp4, f"--props={props_file}", "--crf=18", "--concurrency=2"
    ], check=True)

    final_mp4 = f"/tmp/{data['drive_folder']}_{data['episode_id']}.mp4"
    music_path = download_music_from_drive(drive, f"{handle}-{data['episode_id']}", "/tmp/music_bed")
    if music_path:
        # Music loops under the voice, sits ~20 dB down and ducks further while the narrator speaks.
        subprocess.run([
            "ffmpeg", "-y", "-i", raw_remotion_mp4, "-stream_loop", "-1", "-i", music_path,
            "-filter_complex",
            "[1:a]volume=0.22,afade=t=in:d=2[m];"
            "[0:a]asplit=2[v][sc];"
            "[m][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck];"
            "[v][duck]amix=inputs=2:duration=first:normalize=0,afade=t=out:st={fo}:d=2[aout]".format(
                fo=max(0.0, get_duration(raw_remotion_mp4) - 2)),
            "-map", "0:v", "-map", "[aout]",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final_mp4
        ], check=True)
    else:
        subprocess.run([
            "ffmpeg", "-y", "-i", raw_remotion_mp4, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final_mp4
        ], check=True)

    thumb_png = render_thumbnail(data, theme, accent_color, f"/tmp/{data['drive_folder']}_{data['episode_id']}_thumb.png")

    sub_id = get_or_create_drive_subfolder(drive, DRIVE_ROOT_ID, data["drive_folder"])
    upload_to_drive(drive, sub_id, final_mp4, "video/mp4")
    upload_to_drive(drive, sub_id, script_json_path, "application/json")
    if thumb_png:
        upload_to_drive(drive, sub_id, thumb_png, "image/png")
    video_id = upload_to_youtube(youtube, final_mp4, data)
    if thumb_png:
        set_youtube_thumbnail(youtube, video_id, thumb_png)

def run_auto_next_queue():
    drive = build_service("drive", "v3", DRIVE_REFRESH_TOKEN)
    for channel_dir in sorted(glob.glob("scripts/*/")):
        scripts = sorted(glob.glob(os.path.join(channel_dir, "ep*.json")))
        for s_path in scripts:
            with open(s_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            sub_id = get_or_create_drive_subfolder(drive, DRIVE_ROOT_ID, meta["drive_folder"])
            expected_mp4 = f"{meta['drive_folder']}_{meta['episode_id']}.mp4"
            if not file_exists_in_drive(drive, sub_id, expected_mp4):
                print(f"Queue Auto-Pick: Rendering {s_path} (not yet in Google Drive)")
                render_episode(s_path)
                break
        else:
            print(f"All queued scripts in {channel_dir} are already rendered!")

if __name__ == "__main__":
    arg = sys.argv[1]
    if arg == "AUTO_NEXT":
        run_auto_next_queue()
    else:
        render_episode(arg)
