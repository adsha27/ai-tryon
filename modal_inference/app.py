"""
CatVTON inference server for ai-tryon.
Self-hosted virtual try-on using CatVTON (CC BY-NC-SA) on Modal GPU cloud.

Setup (one-time):
    pip install modal
    modal token new
    modal secret create vercel-blob BLOB_READ_WRITE_TOKEN=<your-token>

Deploy:
    modal deploy modal_inference/app.py

After deploy, modal prints endpoint URLs. Copy them to .env.local:
    MODAL_TRYON_START_URL=https://<workspace>--ai-tryon-start-tryon.modal.run
    MODAL_TRYON_STATUS_URL=https://<workspace>--ai-tryon-get-status.modal.run
    MODAL_BGREMOVE_URL=https://<workspace>--ai-tryon-remove-bg.modal.run
"""

import io
import os
import uuid

import modal
from fastapi import HTTPException
from pydantic import BaseModel

# -----------------------------------------------------------------------
# Container image — CatVTON + detectron2 (DensePose) + all deps
# Built once, cached by Modal until a .run_commands() line changes.
# -----------------------------------------------------------------------
tryon_image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(
        "git",
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsm6",
        "libxrender1",
        "libxext6",
    )
    .pip_install(
        "torch==2.1.2",
        "torchvision==0.16.2",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .run_commands(
        # detectron2 (needed by CatVTON's DensePose masker)
        "pip install detectron2 -f "
        "https://dl.fbaipublicfiles.com/detectron2/wheels/cu121/torch2.1/index.html",
        # CatVTON source
        "git clone https://github.com/Zheng-Chong/CatVTON /root/CatVTON",
        # CatVTON python deps (skip torch/torchvision already installed)
        "pip install "
        "accelerate==0.31.0 "
        "diffusers==0.29.2 "
        "huggingface_hub==0.23.4 "
        "numpy==1.26.4 "
        "opencv-python==4.10.0.84 "
        "Pillow==10.3.0 "
        "PyYAML==6.0.1 "
        "scipy==1.13.1 "
        "scikit-image==0.24.0 "
        "transformers==4.27.3 "
        "tqdm==4.66.4 "
        "requests "
        "xformers==0.0.23.post1",
    )
    .env({"PYTHONPATH": "/root/CatVTON"})
)

# rembg for background removal — CPU only, much cheaper
bgremove_image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install("rembg", "onnxruntime", "Pillow", "requests")
    # Pre-download u2net model into the image so cold starts are fast
    .run_commands(
        "python -c \"from rembg import new_session; new_session('u2net')\""
    )
)

# -----------------------------------------------------------------------
# Shared state
# -----------------------------------------------------------------------
# Persistent volume for CatVTON / SD weights (~9GB, downloaded once)
weights_vol = modal.Volume.from_name("catvton-weights", create_if_missing=True)

# Job state dict — maps job_id → { status, output?, error? }
jobs = modal.Dict.from_name("tryon-jobs", create_if_missing=True)

app = modal.App("ai-tryon")

# -----------------------------------------------------------------------
# GPU inference class
# Loads model once per container lifetime; container stays warm 5 min.
# -----------------------------------------------------------------------
@app.cls(
    gpu="A10G",
    image=tryon_image,
    volumes={"/weights": weights_vol},
    timeout=180,
    container_idle_timeout=300,
    secrets=[modal.Secret.from_name("vercel-blob")],
)
class TryOnModel:
    @modal.enter()
    def load(self):
        import sys
        sys.path.insert(0, "/root/CatVTON")

        import torch
        from diffusers.image_processor import VaeImageProcessor
        from huggingface_hub import snapshot_download
        from model.cloth_masker import AutoMasker
        from model.pipeline import CatVTONPipeline

        # Download weights into the mounted volume (persists across cold starts)
        repo_path = snapshot_download(
            repo_id="zhengchong/CatVTON",
            local_dir="/weights/catvton",
            local_dir_use_symlinks=False,
        )

        self.pipeline = CatVTONPipeline(
            base_ckpt="runwayml/stable-diffusion-inpainting",
            attn_ckpt=repo_path,
            attn_ckpt_version="mix",
            weight_dtype=torch.bfloat16,
            use_tf32=True,
            device="cuda",
        )
        self.mask_processor = VaeImageProcessor(
            vae_scale_factor=8,
            do_normalize=False,
            do_binarize=True,
            do_convert_grayscale=True,
        )
        # AutoMasker runs DensePose + SCHP to remove existing clothes —
        # this is the step that fixes the garment bleed-through problem.
        self.automasker = AutoMasker(
            densepose_ckpt=os.path.join(repo_path, "DensePose"),
            schp_ckpt=os.path.join(repo_path, "SCHP"),
            device="cuda",
        )

    @modal.method()
    def infer(self, job_id: str, person_url: str, garment_url: str, category: str):
        import sys
        sys.path.insert(0, "/root/CatVTON")

        import requests
        import torch
        from PIL import Image
        from utils import resize_and_crop, resize_and_padding

        jobs[job_id] = {"status": "processing"}
        try:
            person_img = Image.open(
                io.BytesIO(requests.get(person_url, timeout=30).content)
            ).convert("RGB")
            garment_img = Image.open(
                io.BytesIO(requests.get(garment_url, timeout=30).content)
            ).convert("RGB")

            person_img = resize_and_crop(person_img, (768, 1024))
            garment_img = resize_and_padding(garment_img, (768, 1024))

            mask = self.automasker(person_img, category)["mask"]
            mask = self.mask_processor.blur(mask, blur_factor=9)

            result = self.pipeline(
                image=person_img,
                condition_image=garment_img,
                mask=mask,
                num_inference_steps=50,
                guidance_scale=2.5,
                generator=torch.Generator(device="cuda").manual_seed(42),
            )[0]

            buf = io.BytesIO()
            result.save(buf, format="JPEG", quality=92)
            buf.seek(0)

            result_url = _upload_blob(buf.getvalue(), f"tryon-{job_id}.jpg", "image/jpeg")
            jobs[job_id] = {"status": "completed", "output": [result_url]}

        except Exception as exc:
            jobs[job_id] = {"status": "failed", "error": str(exc)}
            raise


def _upload_blob(data: bytes, filename: str, content_type: str) -> str:
    """Upload bytes to Vercel Blob, return public URL."""
    import requests

    token = os.environ["BLOB_READ_WRITE_TOKEN"]
    resp = requests.put(
        f"https://blob.vercel-storage.com/{filename}",
        params={"addRandomSuffix": "1"},
        headers={
            "authorization": f"Bearer {token}",
            "x-content-type": content_type,
        },
        data=data,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["url"]


# -----------------------------------------------------------------------
# HTTP endpoints (CPU — just dispatch / read state)
# -----------------------------------------------------------------------
CATEGORY_MAP = {
    "tops": "upper",
    "bottoms": "lower",
    "full-body": "overall",
    "auto": "upper",
}


class TryOnInput(BaseModel):
    person_url: str
    garment_url: str
    category: str = "auto"


class BgRemoveInput(BaseModel):
    image_url: str


@app.function(image=tryon_image)
@modal.web_endpoint(method="POST")
def start_tryon(data: TryOnInput):
    if not data.person_url or not data.garment_url:
        raise HTTPException(status_code=400, detail="person_url and garment_url required")

    category = CATEGORY_MAP.get(data.category, "upper")
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "in_queue"}
    TryOnModel().infer.spawn(job_id, data.person_url, data.garment_url, category)
    return {"job_id": job_id}


@app.function(image=tryon_image)
@modal.web_endpoint(method="GET")
def get_status(job_id: str):
    state = jobs.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail="job not found")
    return state


@app.function(
    image=bgremove_image,
    volumes={"/weights": weights_vol},
    secrets=[modal.Secret.from_name("vercel-blob")],
    timeout=60,
)
@modal.web_endpoint(method="POST")
def remove_bg(data: BgRemoveInput):
    import requests
    from PIL import Image
    from rembg import remove

    img_bytes = requests.get(data.image_url, timeout=30).content
    result = remove(Image.open(io.BytesIO(img_bytes)).convert("RGBA"))

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    buf.seek(0)

    url = _upload_blob(buf.getvalue(), f"bgremove-{uuid.uuid4()}.png", "image/png")
    return {"url": url}
