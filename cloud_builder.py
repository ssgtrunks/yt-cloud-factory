import os
import sys
import json
import time
import shutil
import asyncio
import subprocess
import requests
import edge_tts
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
DRIVE_REFRESH_TOKEN = os.environ.get("DRIVE_REFRESH_TOKEN", "").strip()
DRIVE_ROOT_ID = os.environ.get("DRIVE_ROOT_FOLDER_ID", "").strip()

CHANNEL_TOKEN_MAP = {
    "@CapLedger": os.environ.get("YT_TOKEN_CAPLEDGER", "").strip(),
    "@WorkflowStack-AI": os.environ.get("YT_TOKEN_WORKFLOWSTACK", "").strip(),
    "@MarketAnatomyTVA": os.environ.get("YT_TOKEN_MARKETANATOMY", "").strip(),
}

HEADERS = {
    "User-Agent": "YTCloudFactoryBot/4.0 (https://github.com/ssgtrunks/yt-cloud-factory; contact: dbs.ssgtrunks@gmail.com)"
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
    return words

def verify_video_file(path):
    if not os.path.exists(path) or os.path.getsize(path) < 25000:
        return False
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True
    )
    return probe.returncode == 0 and bool(probe.stdout.strip())

def get_duration(file_path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path]
    return float(subprocess.check_output(cmd).decode().strip())

def fetch_wikimedia_video(query, out_path, used_urls):
    words = [w for w in query.strip().split() if len(w) > 2]
    queries = [query] + ([words[0]] if words else [])
    for q in queries:
        try:
            time.sleep(1.5)
            params = {
                "action": "query",
                "format": "json",
                "generator": "search",
                "gsrsearch": f"{q} filetype:video",
                "gsrnamespace": 6,
                "gsrlimit": 8,
                "prop": "videoinfo",
                "viprop": "url|size",
            }
            res = requests.get("https://commons.wikimedia.org/w/api.php", params=params, headers=HEADERS, timeout=20).json()
            for page in res.get("query", {}).get("pages", {}).values():
                vinfo = page.get("videoinfo", [{}])[0]
                vid_url = vinfo.get("url", "")
                size = vinfo.get("size", 0)
                if not vid_url or vid_url in used_urls or size > 45_000_000:
                    continue
                if vid_url.lower().endswith(".mp4"):
                    r = requests.get(vid_url, headers=HEADERS, stream=True, timeout=45)
                    if r.status_code == 200:
                        with open(out_path, "wb") as f:
                            for chunk in r.iter_content(chunk_size=16384):
                                f.write(chunk)
                        if verify_video_file(out_path):
                            used_urls.add(vid_url)
                            print(f"  -> Matched Wikimedia MP4 Video ({q})")
                            return True
        except Exception as e:
            print(f"  -> Wikimedia video note ({q}): {e}")
    return False

def fetch_archive_video(query, out_path, used_urls):
    try:
        params = {
            "q": f"({query}) AND mediatype:(movies)",
            "fl[]": ["identifier"],
            "rows": 8,
            "page": 1,
            "output": "json",
        }
        res = requests.get("https://archive.org/advancedsearch.php", params=params, headers=HEADERS, timeout=20).json()
        for doc in res.get("response", {}).get("docs", []):
            ident = doc.get("identifier")
            if not ident or ident in used_urls:
                continue
            meta = requests.get(f"https://archive.org/metadata/{ident}", headers=HEADERS, timeout=15).json()
            for f in meta.get("files", []):
                name = f.get("name", "")
                size = int(f.get("size", 0) or 0)
                if name.endswith(".mp4") and 200_000 < size < 45_000_000:
                    mp4_url = f"https://archive.org/download/{ident}/{requests.utils.quote(name)}"
                    r = requests.get(mp4_url, headers=HEADERS, stream=True, timeout=45)
                    if r.status_code == 200:
                        with open(out_path, "wb") as out_f:
                            for chunk in r.iter_content(chunk_size=16384):
                                out_f.write(chunk)
                        if verify_video_file(out_path):
                            used_urls.add(ident)
                            print(f"  -> Matched Internet Archive MP4 ({query}): {ident}")
                            return True
    except Exception as e:
        print(f"  -> Internet Archive note ({query}): {e}")
    return False

def fetch_nasa_video(query, out_path, used_urls):
    for q in [query, "earth orbit"]:
        try:
            res = requests.get(
                "https://images-api.nasa.gov/search",
                params={"q": q, "media_type": "video"},
                headers=HEADERS,
                timeout=20,
            ).json()
            for item in res.get("collection", {}).get("items", [])[:6]:
                href = item.get("href")
                if not href or href in used_urls:
                    continue
                assets = requests.get(href, headers=HEADERS, timeout=15).json()
                mp4s = [a for a in assets if a.endswith("~medium.mp4") or a.endswith("~mobile.mp4")]
                if mp4s:
                    r = requests.get(mp4s[0], headers=HEADERS, stream=True, timeout=45)
                    if r.status_code == 200:
                        with open(out_path, "wb") as f:
                            for chunk in r.iter_content(chunk_size=16384):
                                f.write(chunk)
                        if verify_video_file(out_path):
                            used_urls.add(href)
                            print(f"  -> Matched NASA HD MP4 ({q})")
                            return True
        except Exception as e:
            print(f"  -> NASA note ({q}): {e}")
    return False

def fetch_wikimedia_image(query, out_path, used_urls):
    for q in [query, "skyline", "technology"]:
        try:
            params = {
                "action": "query",
                "format": "json",
                "generator": "search",
                "gsrsearch": q,
                "gsrnamespace": 6,
                "gsrlimit": 10,
                "prop": "imageinfo",
                "iiprop": "url|size|mime",
                "iiurlwidth": 1920,
            }
            res = requests.get("https://commons.wikimedia.org/w/api.php", params=params, headers=HEADERS, timeout=20).json()
            for page in res.get("query", {}).get("pages", {}).values():
                iinfo = page.get("imageinfo", [{}])[0]
                if iinfo.get("mime") in ("image/jpeg", "image/png") and iinfo.get("width", 0) >= 900:
                    u = iinfo.get("thumburl") or iinfo.get("url", "")
                    if u and u not in used_urls:
                        r = requests.get(u, headers=HEADERS, timeout=30)
                        if r.status_code == 200 and r.headers.get("Content-Type", "").startswith("image/"):
                            with open(out_path, "wb") as f:
                                f.write(r.content)
                            used_urls.add(u)
                            print(f"  -> Matched High-Res Photo ({q})")
                            return True
        except Exception as e:
            print(f"  -> Photo search note ({q}): {e}")
    return False

def get_or_create_drive_subfolder(drive, parent_id, folder_name):
    q = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
    res = drive.files().list(
        q=q, fields="files(id)", supportsAllDrives=True, includeItemsFromAllDrives=True
    ).execute().get("files", [])
    if res:
        return res[0]["id"]
    meta = {"name": folder_name, "mimeType": "application/vnd.google-apps.folder", "parents": [parent_id]}
    return drive.files().create(body=meta, fields="id", supportsAllDrives=True).execute()["id"]

def upload_to_drive(drive, folder_id, file_path, mime_type):
    meta = {"name": os.path.basename(file_path), "parents": [folder_id]}
    media = MediaFileUpload(file_path, mimetype=mime_type, resumable=True)
    uploaded = drive.files().create(body=meta, media_body=media, fields="id", supportsAllDrives=True).execute()
    print(f"Backed up to 5TB Google Drive (ID: {uploaded['id']})")

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

def main(script_json_path):
    with open(script_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    handle = data["channel_handle"]
    yt_token = CHANNEL_TOKEN_MAP.get(handle)
    if not yt_token:
        raise ValueError(f"Missing YouTube Refresh Token secret for channel: {handle}")

    voice = data.get("voice_id", "en-US-AvaMultilingualNeural")
    aspect = data.get("aspect_ratio", "16:9")
    width, height = (1080, 1920) if aspect == "9:16" else (1920, 1080)

    # Remotion reads staticFile() assets from ./public/
    public_assets_dir = os.path.join("public", "assets")
    if os.path.exists(public_assets_dir):
        shutil.rmtree(public_assets_dir)
    os.makedirs(public_assets_dir, exist_ok=True)

    remotion_scenes = []
    used_urls = set()
    cursor_sec = 0.0

    for idx, scene in enumerate(data["scenes"]):
        print(f"[{handle}] Preparing Scene {idx+1}/{len(data['scenes'])}: {scene.get('visual_query', 'chart')}")
        audio_name = f"audio_{idx}.mp3"
        audio_disk_path = os.path.join(public_assets_dir, audio_name)
        words = asyncio.run(generate_tts_with_words(scene["narration"], audio_disk_path, voice))
        dur = get_duration(audio_disk_path) + 0.45

        media_type = "grid"
        media_rel = None

        if scene.get("chart"):
            media_type = "chart"
        else:
            q = scene.get("visual_query", "technology")
            vid_name = f"clip_{idx}.mp4"
            vid_disk_path = os.path.join(public_assets_dir, vid_name)
            img_name = f"img_{idx}.jpg"
            img_disk_path = os.path.join(public_assets_dir, img_name)

            if (
                fetch_wikimedia_video(q, vid_disk_path, used_urls)
                or fetch_archive_video(q, vid_disk_path, used_urls)
                or fetch_nasa_video(q, vid_disk_path, used_urls)
            ):
                media_type = "video"
                media_rel = f"assets/{vid_name}"
            elif fetch_wikimedia_image(q, img_disk_path, used_urls):
                media_type = "image"
                media_rel = f"assets/{img_name}"

        remotion_scenes.append({
            "sceneNumber": idx + 1,
            "startSec": round(cursor_sec, 3),
            "durationSec": round(dur, 3),
            "calloutText": scene.get("callout_text", ""),
            "mediaType": media_type,
            "mediaFile": media_rel,
            "audioFile": f"assets/{audio_name}",
            "chart": scene.get("chart"),
            "words": words,
        })
        cursor_sec += dur

    props_payload = {
        "channelHandle": handle,
        "episodeTitle": data["title_options"][0],
        "width": width,
        "height": height,
        "totalDurationSec": round(cursor_sec, 3),
        "scenes": remotion_scenes,
    }

    props_file = "/tmp/remotion_props.json"
    with open(props_file, "w", encoding="utf-8") as f:
        json.dump(props_payload, f)

    raw_remotion_mp4 = "/tmp/remotion_raw.mp4"
    print(f"[{handle}] Rendering Remotion 1080p Studio Composition...")
    subprocess.run([
        "npx", "remotion", "render", "remotion/index.ts", "DocumentaryVideo",
        raw_remotion_mp4, f"--props={props_file}", "--concurrency=2"
    ], check=True)

    # Mix warm ambient synth pad (-26 dB) under voiceover
    total_dur = get_duration(raw_remotion_mp4)
    final_mp4 = f"/tmp/{data['drive_folder']}_{data['episode_id']}.mp4"
    ambient_expr = (
        f"aevalsrc=0.012*sin(2*PI*110*t)+0.008*sin(2*PI*164.81*t)"
        f"+0.006*sin(2*PI*220*t):s=44100:d={total_dur}"
    )
    subprocess.run([
        "ffmpeg", "-y", "-i", raw_remotion_mp4, "-f", "lavfi", "-i", ambient_expr,
        "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[aout]",
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", final_mp4
    ], check=True)

    drive = build_service("drive", "v3", DRIVE_REFRESH_TOKEN)
    youtube = build_service("youtube", "v3", yt_token)

    sub_id = get_or_create_drive_subfolder(drive, DRIVE_ROOT_ID, data["drive_folder"])
    upload_to_drive(drive, sub_id, final_mp4, "video/mp4")
    upload_to_drive(drive, sub_id, script_json_path, "application/json")
    upload_to_youtube(youtube, final_mp4, data)

if __name__ == "__main__":
    main(sys.argv[1])
