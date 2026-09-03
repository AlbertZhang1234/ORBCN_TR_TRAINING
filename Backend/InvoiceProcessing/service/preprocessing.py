from __future__ import annotations
import base64
import io
import time
from pathlib import Path

import fitz
from PIL import Image, ImageOps

from .models import ExtractionError


def _pdf(file_bytes: bytes, options: dict) -> dict:
    with fitz.open(stream=file_bytes, filetype='pdf') as document:
        pages = len(document)
        if pages > options['max_pdf_pages']:
            raise ExtractionError(f"PDF 共 {pages} 页，超过 {options['max_pdf_pages']} 页限制，请拆分文件后上传")
        if not pages:
            raise ExtractionError('PDF 没有可识别的页面')
        images, texts = [], []
        text_ms = render_ms = 0.0
        for page in document:
            started = time.monotonic()
            texts.append(page.get_text(sort=True))
            text_ms += (time.monotonic() - started) * 1000
            started = time.monotonic()
            scale = min(2.0, options['image_max_edge'] / max(page.rect.width, page.rect.height))
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csRGB, alpha=False)
            images.append(pix.tobytes('jpeg', jpg_quality=options['jpeg_quality']))
            render_ms += (time.monotonic() - started) * 1000
        return {'images': images, 'text': '\n'.join(texts), 'pages': pages,
                'text_ms': round(text_ms), 'render_ms': round(render_ms)}


def _image(file_bytes: bytes, options: dict) -> dict:
    with Image.open(io.BytesIO(file_bytes)) as original:
        if getattr(original, 'n_frames', 1) > 1:
            raise ExtractionError('多帧图片请拆分后上传 / Split multi-frame images before uploading')
        oriented = ImageOps.exif_transpose(original)
        oriented.thumbnail((options['image_max_edge'], options['image_max_edge']))
        rgba = oriented.convert('RGBA')
        rgb = Image.new('RGB', rgba.size, 'white')
        rgb.paste(rgba, mask=rgba.getchannel('A'))
        output = io.BytesIO()
        rgb.save(output, format='JPEG', quality=options['jpeg_quality'])
    return {'images': [output.getvalue()], 'text': '', 'pages': 1, 'text_ms': 0}


def prepare_content(file_bytes: bytes, filename: str, options: dict) -> dict:
    """Executed only in isolated processes; PyMuPDF never runs in an HTTP thread."""
    started = time.monotonic()
    try:
        content = _pdf(file_bytes, options) if Path(filename).suffix.lower() == '.pdf' else _image(file_bytes, options)
        content['image_bytes'] = sum(len(image) for image in content['images'])
        if content['image_bytes'] > 18 * 1024 * 1024:
            raise ExtractionError('处理后的图片过大，请拆分文件或降低图片尺寸')
        content['images'] = [base64.b64encode(image).decode('ascii') for image in content['images']]
        content['preprocess_ms'] = round((time.monotonic() - started) * 1000)
        return content
    except ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError('无法读取文件，请检查文件是否损坏或加密 / Unable to read invoice file') from exc
