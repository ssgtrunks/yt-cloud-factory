import os
import sys
import json
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

HEADERS = {"User-Agent": "YTCloudFactory/1.0 (https://github.com; contact: dbs.ssgtrunks@gmail.com)"}

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

async def generate_tts(text, audio_path, srt_path, voice):
    communicate = edge_tts.Communicate(text, voice, rate="+4%")
    submaker = edge_tts.SubMaker()
    with open(audio_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                submaker.feed(chunk)
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(submaker.get_srt())

def fetch_visual_clip(query, out_path, used_urls, width, height, duration):
    # 1. Try Wikimedia Commons HD Video
    try:
        api_url = (
            "https://commons.wikimedia.org/w/api.php?action=query&format=json"
            f"&generator=search&gsrsearch={requests.utils.quote(query + ' filetype:video')}&gsrnamespace=6&gsrlimit=8"
            "&prop=videoinfo&viprop=url|size"
        )
        res = requests.get(api_url, headers=HEADERS, timeout=20).json()
        for page in res.get("query", {}).get("pages", {}).values():
            vinfo = page.get("videoinfo", [{}])[0]
            vid_url = vinfo.get("url", "")
            size = vinfo.get("size", 0)
            if vid_url in used_urls or size > 60_000_000:
                continue
            if vid_url.lower().endswith((".webm", ".mp4")):
                vid = requests.get(vid_url, headers=HEADERS, stream=True, timeout=45)
                if vid.status_code == 200:
                    with open(out_path, "wb") as f:
                        for chunk in vid.iter_content(chunk_size=8192):
                            f.write(chunk)
                    probe = subprocess.run(
                        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", out_path],
                        capture_output=True, text=True
                    )
                    if probe.returncode == 0 and probe.stdout.strip():
                        used_urls.add(vid_url)
                        print(f"  -> Matched Wikimedia Video: {vid_url.split('/')[-1]}")
                        return
    except Exception as e:
        print(f"  -> Wikimedia video note: {e}")

    # 2. Try NASA Public Domain HD Video
    try:
        nasa_url = f"https://images-api.nasa.gov/search?q={requests.utils.quote(query)}&media_type=video"
        nasa_res = requests.get(nasa_url, headers=HEADERS, timeout=20).json()
        for item in nasa_res.get("collection", {}).get("items", [])[:5]:
            href = item.get("href")
            if href:
                assets = requests.get(href, headers=HEADERS, timeout=15).json()
                mp4s = [a for a in assets if a.endswith("~medium.mp4") or a.endswith("~mobile.mp4")]
                if mp4s and mp4s[0] not in used_urls:
                    vid = requests.get(mp4s[0], headers=HEADERS, stream=True, timeout=45)
                    if vid.status_code == 200:
                        with open(out_path, "wb") as f:
                            for chunk in vid.iter_content(chunk_size=8192):
                                f.write(chunk)
                        used_urls.add(mp4s[0])
                        print(f"  -> Matched NASA HD Video: {mp4s[0].split('/')[-1]}")
                        return
    except Exception as e:
        print(f"  -> NASA video note: {e}")

    # 3. High-Res Wikimedia Photography + Smooth Ken Burns Zoom Motion (Eliminates blank screens)
    for img_q in [query, "world map finance technology"]:
        try:
            img_api = (
                "https://commons.wikimedia.org/w/api.php?action=query&format=json"
                f"&generator=search&gsrsearch={requests.utils.quote(img_q + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=10"
                "&prop=imageinfo&iiprop=url|size&iiurlwidth=1920"
            )
            ires = requests.get(img_api, headers=HEADERS, timeout=20).json()
            for page in ires.get("query", {}).get("pages", {}).values():
                iinfo = page.get("imageinfo", [{}])[0]
                thumb_url = iinfo.get("thumburl") or iinfo.get("url", "")
                w_orig = iinfo.get("width", 0)
                if not thumb_url or thumb_url in used_urls or w_orig < 1000:
                    continue
                if thumb_url.lower().endswith((".jpg", ".jpeg", ".png")):
                    raw_img = out_path + ".jpg"
                    r = requests.get(thumb_url, headers=HEADERS, timeout=30)
                    if r.status_code == 200:
                        with open(raw_img, "wb") as f:
                            f.write(r.content)
                        frames = int(duration * 30) + 15
                        kb_filter = (
                            f"scale=2400:-1,zoompan=z='min(zoom+0.0008,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                            f":d={frames}:s={width}x{height}:fps=30,format=yuv420p"
                        )
                        res_ff = subprocess.run([
                            "ffmpeg", "-y", "-i", raw_img, "-vf", kb_filter,
                            "-t", str(duration), "-c:v", "libx264", "-pix_fmt", "yuv420p", out_path
                        ], capture_output=True)
                        if res_ff.returncode == 0:
                            used_urls.add(thumb_url)
                            print(f"  -> Rendered Ken Burns HD Photo: {thumb_url.split('/')[-1]}")
                            return
        except Exception as e:
            print(f"  -> Photo fallback note: {e}")

    raise RuntimeError(f"No visual asset found for query: {query}")

def get_duration(file_path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path]
    return float(subprocess.check_output(cmd).decode().strip())

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

    work_dir = f"/tmp/yt_build_{data['drive_folder']}_{data['episode_id']}"
    os.makedirs(work_dir, exist_ok=True)
    segment_files = []
    used_urls = set()

    for idx, scene in enumerate(data["scenes"]):
        print(f"[{handle}] Scene {idx+1}/{len(data['scenes'])}: {scene['visual_query']}")
        audio_file = f"{work_dir}/a_{idx}.mp3"
        srt_file = f"{work_dir}/s_{idx}.srt"
        raw_clip = f"{work_dir}/r_{idx}.mp4"
        seg_clip = f"{work_dir}/seg_{idx}.mp4"

        asyncio.run(generate_tts(scene["narration"], audio_file, srt_file, voice))
        duration = get_duration(audio_file) + 0.35
        fetch_visual_clip(scene["visual_query"], raw_clip, used_urls, width, height, duration)

        has_srt = os.path.exists(srt_file) and os.path.getsize(srt_file) > 10
        vf = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},fps=30,format=yuv420p"
        if has_srt:
            vf += f",subtitles={srt_file}:force_style='FontName=DejaVu Sans,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=4,Outline=1,MarginV=45'"

        subprocess.run([
            "ffmpeg", "-y", "-stream_loop", "-1", "-i", raw_clip, "-i", audio_file,
            "-t", str(duration), "-vf", vf,
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-c:a", "aac", "-b:a", "192k", "-shortest", seg_clip
        ], check=True)
        segment_files.append(seg_clip)

    concat_txt = f"{work_dir}/concat.txt"
    with open(concat_txt, "w", encoding="utf-8") as f:
        for seg in segment_files:
            f.write(f"file '{seg}'\n")

    final_mp4 = f"{work_dir}/{data['drive_folder']}_{data['episode_id']}.mp4"
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_txt, "-c", "copy", final_mp4], check=True)

    drive = build_service("drive", "v3", DRIVE_REFRESH_TOKEN)
    youtube = build_service("youtube", "v3", yt_token)

    sub_id = get_or_create_drive_subfolder(drive, DRIVE_ROOT_ID, data["drive_folder"])
    upload_to_drive(drive, sub_id, final_mp4, "video/mp4")
    upload_to_drive(drive, sub_id, script_json_path, "application/json")
    upload_to_youtube(youtube, final_mp4, data)

if __name__ == "__main__":
    main(sys.argv[1])
