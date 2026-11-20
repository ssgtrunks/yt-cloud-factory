import os
import sys
import json
import time
import asyncio
import subprocess
import requests
import edge_tts
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
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
    "User-Agent": "YTCloudFactoryBot/3.0 (https://github.com/ssgtrunks/yt-cloud-factory; contact: dbs.ssgtrunks@gmail.com)"
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

async def generate_tts(text, audio_path, srt_path, voice):
    communicate = edge_tts.Communicate(text, voice, rate="+5%")
    submaker = edge_tts.SubMaker()
    with open(audio_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                submaker.feed(chunk)
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(submaker.get_srt())

def verify_video_file(path):
    if not os.path.exists(path) or os.path.getsize(path) < 25000:
        return False
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True
    )
    return probe.returncode == 0 and bool(probe.stdout.strip())

def render_animated_chart(chart_data, out_path, width, height, duration):
    """Renders a sleek, dark-mode editorial bar/line chart with smooth zoom motion."""
    img_path = out_path + ".png"
    plt.style.use("dark_background")
    fig, ax = plt.subplots(figsize=(width / 100, height / 100), dpi=100)
    fig.patch.set_facecolor("#0B1120")
    ax.set_facecolor("#0F172A")

    labels = chart_data.get("labels", ["Before", "After"])
    values = chart_data.get("values", [100, 25])
    chart_type = chart_data.get("type", "bar")
    title = chart_data.get("title", "Key Data Breakdown")
    unit = chart_data.get("unit", "")
    accent = chart_data.get("color", "#38BDF8")

    if chart_type == "line":
        ax.plot(labels, values, color=accent, linewidth=5, marker="o", markersize=12)
        ax.fill_between(labels, values, color=accent, alpha=0.18)
    else:
        bars = ax.bar(
            labels,
            values,
            color=[accent if i == len(values) - 1 else "#475569" for i in range(len(values))],
            width=0.52,
        )
        for bar, val in zip(bars, values):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + (max(values) * 0.03),
                f"{val}{unit}",
                ha="center",
                va="bottom",
                fontsize=22,
                fontweight="bold",
                color="#F8FAFC",
            )

    ax.set_title(title, fontsize=30, fontweight="bold", color="#F8FAFC", pad=35)
    ax.tick_params(axis="x", labelsize=20, colors="#CBD5E1")
    ax.tick_params(axis="y", labelsize=18, colors="#94A3B8")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#334155")
    ax.spines["bottom"].set_color("#334155")
    ax.grid(axis="y", linestyle="--", alpha=0.2, color="#94A3B8")
    ax.set_ylim(0, max(values) * 1.22)

    plt.tight_layout(pad=4.0)
    plt.savefig(img_path, facecolor=fig.get_facecolor())
    plt.close(fig)

    frames = int(duration * 30) + 15
    kb_filter = (
        f"scale=2100:-1,zoompan=z='min(zoom+0.0006,1.08)'"
        f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d={frames}:s={width}x{height}:fps=30,format=yuv420p"
    )
    subprocess.run([
        "ffmpeg", "-y", "-i", img_path, "-vf", kb_filter,
        "-t", str(duration), "-c:v", "libx264", "-pix_fmt", "yuv420p", out_path
    ], check=True)
    print(f"  -> Rendered Animated Editorial Chart: {title}")

def fetch_wikimedia_video(query, out_path, used_urls):
    """Keyless real moving video search on Wikimedia Commons."""
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
                if vid_url.lower().endswith((".mp4", ".webm")):
                    r = requests.get(vid_url, headers=HEADERS, stream=True, timeout=45)
                    if r.status_code == 200:
                        with open(out_path, "wb") as f:
                            for chunk in r.iter_content(chunk_size=16384):
                                f.write(chunk)
                        if verify_video_file(out_path):
                            used_urls.add(vid_url)
                            print(f"  -> Matched Wikimedia Moving Video ({q}): {vid_url.split('/')[-1][:45]}")
                            return True
        except Exception as e:
            print(f"  -> Wikimedia video note ({q}): {e}")
    return False

def fetch_archive_video(query, out_path, used_urls):
    """Keyless public-domain moving MP4 search on Internet Archive."""
    try:
        search_url = "https://archive.org/advancedsearch.php"
        params = {
            "q": f"({query}) AND mediatype:(movies)",
            "fl[]": ["identifier"],
            "rows": 8,
            "page": 1,
            "output": "json",
        }
        res = requests.get(search_url, params=params, headers=HEADERS, timeout=20).json()
        docs = res.get("response", {}).get("docs", [])
        for doc in docs:
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
                            print(f"  -> Matched Internet Archive Moving Video ({query}): {ident}")
                            return True
    except Exception as e:
        print(f"  -> Internet Archive note ({query}): {e}")
    return False

def fetch_nasa_video(query, out_path, used_urls):
    """Keyless 1080p HD moving video from NASA Image & Video Library."""
    for q in [query, "earth orbit", "satellite network"]:
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
                            print(f"  -> Matched NASA HD Moving Video ({q})")
                            return True
        except Exception as e:
            print(f"  -> NASA note ({q}): {e}")
    return False

def search_wikimedia_images(search_term, limit=10):
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": search_term,
        "gsrnamespace": 6,
        "gsrlimit": limit,
        "prop": "imageinfo",
        "iiprop": "url|size|mime",
        "iiurlwidth": 1920,
    }
    res = requests.get("https://commons.wikimedia.org/w/api.php", params=params, headers=HEADERS, timeout=20).json()
    results = []
    for page in res.get("query", {}).get("pages", {}).values():
        iinfo = page.get("imageinfo", [{}])[0]
        if iinfo.get("mime") in ("image/jpeg", "image/png") and iinfo.get("width", 0) >= 900:
            u = iinfo.get("thumburl") or iinfo.get("url", "")
            if u:
                results.append(u)
    return results

def fetch_scene_visual(scene, out_path, used_urls, width, height, duration):
    # Priority 1: Custom Animated Data Chart if provided in JSON scene
    if scene.get("chart"):
        render_animated_chart(scene["chart"], out_path, width, height, duration)
        return

    query = scene.get("visual_query", "technology")

    # Priority 2: Keyless Real Moving Videos (Wikimedia -> Internet Archive -> NASA)
    if fetch_wikimedia_video(query, out_path, used_urls):
        return
    if fetch_archive_video(query, out_path, used_urls):
        return
    if fetch_nasa_video(query, out_path, used_urls):
        return

    # Priority 3: High-Res Wikimedia Photography with Smooth Ken Burns Motion
    for q in [query, "skyline", "technology"]:
        try:
            for img_url in search_wikimedia_images(q):
                if img_url in used_urls:
                    continue
                r = requests.get(img_url, headers=HEADERS, timeout=30)
                if r.status_code == 200 and r.headers.get("Content-Type", "").startswith("image/"):
                    raw_img = out_path + ".img"
                    with open(raw_img, "wb") as f:
                        f.write(r.content)
                    frames = int(duration * 30) + 15
                    kb_filter = (
                        f"scale=2400:-1,zoompan=z='min(zoom+0.0008,1.16)'"
                        f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                        f":d={frames}:s={width}x{height}:fps=30,format=yuv420p"
                    )
                    subprocess.run([
                        "ffmpeg", "-y", "-i", raw_img, "-vf", kb_filter,
                        "-t", str(duration), "-c:v", "libx264", "-pix_fmt", "yuv420p", out_path
                    ], capture_output=True)
                    if verify_video_file(out_path):
                        used_urls.add(img_url)
                        print(f"  -> Rendered Ken Burns Photo ({q})")
                        return
        except Exception as e:
            print(f"  -> Photo fallback note: {e}")

    # Priority 4: Guaranteed Animated Editorial Motion Canvas (Zero-crash safety net)
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", f"gradients=s={width}x{height}:c0=0x0B1120:c1=0x1E3A8A:duration={duration}:speed=0.06",
        "-vf", "drawgrid=width=120:height=120:thickness=1:color=white@0.06,format=yuv420p",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", out_path
    ], check=True)
    print(f"  -> Rendered Animated Motion Grid Fallback ({query})")

def get_duration(file_path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path]
    return float(subprocess.check_output(cmd).decode().strip())

def escape_drawtext(text):
    return text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "").replace("%", "\\%")

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
        print(f"[{handle}] Scene {idx+1}/{len(data['scenes'])}: {scene.get('visual_query', 'chart')}")
        audio_file = f"{work_dir}/a_{idx}.mp3"
        srt_file = f"{work_dir}/s_{idx}.srt"
        raw_clip = f"{work_dir}/r_{idx}.mp4"
        seg_clip = f"{work_dir}/seg_{idx}.mp4"

        asyncio.run(generate_tts(scene["narration"], audio_file, srt_file, voice))
        duration = get_duration(audio_file) + 0.40
        fetch_scene_visual(scene, raw_clip, used_urls, width, height, duration)

        vf_parts = [
            f"scale={width}:{height}:force_original_aspect_ratio=increase",
            f"crop={width}:{height}",
            "fps=30",
            "format=yuv420p",
        ]

        callout = scene.get("callout_text", "").strip()
        if callout:
            safe_callout = escape_drawtext(callout.upper())
            vf_parts.append(
                f"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
                f"text='{safe_callout}':fontcolor=white:fontsize=34:"
                f"box=1:boxcolor=0x0F172A@0.82:boxborderw=18:"
                f"x=70:y=70:enable='between(t,0.3,{min(duration-0.3, 5.5)})'"
            )

        if os.path.exists(srt_file) and os.path.getsize(srt_file) > 10:
            vf_parts.append(
                f"subtitles={srt_file}:force_style='FontName=DejaVu Sans,FontSize=21,Bold=1,"
                f"PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BackColour=&H99000000,"
                f"BorderStyle=4,Outline=2,Shadow=1,MarginV=55'"
            )

        vf = ",".join(vf_parts)

        subprocess.run([
            "ffmpeg", "-y", "-stream_loop", "-1", "-i", raw_clip, "-i", audio_file,
            "-t", str(duration), "-vf", vf,
            "-c:v", "libx264", "-preset", "fast", "-crf", "21",
            "-c:a", "aac", "-b:a", "192k", "-shortest", seg_clip
        ], check=True)
        segment_files.append(seg_clip)

    concat_txt = f"{work_dir}/concat.txt"
    with open(concat_txt, "w", encoding="utf-8") as f:
        for seg in segment_files:
            f.write(f"file '{seg}'\n")

    raw_concat = f"{work_dir}/raw_concat.mp4"
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_txt, "-c", "copy", raw_concat], check=True)

    total_dur = get_duration(raw_concat)
    final_mp4 = f"{work_dir}/{data['drive_folder']}_{data['episode_id']}.mp4"
    ambient_expr = f"aevalsrc=0.012*sin(2*PI*110*t)+0.008*
