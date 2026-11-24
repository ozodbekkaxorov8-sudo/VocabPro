from functools import lru_cache
from io import BytesIO

import anyio
import pypdfium2 as pdfium
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from .auth import TeacherSession
from .odf import read_odf

router = APIRouter(prefix="/teacher/import", tags=["import"], dependencies=[TeacherSession])
MAX_SIZE = 8 * 1024 * 1024
MAX_PAGES = 8


@lru_cache(maxsize=1)
def ocr_engine():
    from rapidocr import RapidOCR

    return RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": 2})


def read_image(image: Image.Image) -> str:
    image.thumbnail((2200, 2200))
    result = ocr_engine()(image.convert("RGB"), use_cls=False)
    if result.boxes is None or result.txts is None:
        return ""
    boxes = []
    for box, text in zip(result.boxes, result.txts, strict=True):
        left = min(point[0] for point in box)
        top = min(point[1] for point in box)
        bottom = max(point[1] for point in box)
        boxes.append(((top + bottom) / 2, left, bottom - top, text))
    lines = []
    current = []
    baseline = None
    for center, left, height, text in sorted(boxes):
        if baseline is not None and abs(center - baseline) > max(5, height * 0.55):
            lines.append("\t".join(text for _, text in sorted(current)))
            current = []
        if not current:
            baseline = center
        current.append((left, text))
    if current:
        lines.append("\t".join(text for _, text in sorted(current)))
    return "\n".join(lines)


def read_pdf(content: bytes) -> str:
    with pdfium.PdfDocument(content) as document:
        if len(document) > MAX_PAGES:
            raise ValueError(f"PDF ko‘pi bilan {MAX_PAGES} sahifa bo‘lishi kerak.")
        texts = []
        for index in range(len(document)):
            page = document[index]
            try:
                text_page = page.get_textpage()
                try:
                    text = text_page.get_text_bounded().strip()
                finally:
                    text_page.close()
                if not text:
                    scale = min(2.4, 2200 / max(page.get_size()))
                    bitmap = page.render(scale=scale)
                    try:
                        text = read_image(bitmap.to_pil())
                    finally:
                        bitmap.close()
                texts.append(text)
            finally:
                page.close()
    return "\n".join(texts)


def extract(content: bytes) -> str:
    if content.startswith(b"%PDF-"):
        return read_pdf(content)
    if content.startswith(b"PK\x03\x04"):
        return read_odf(content)
    with Image.open(BytesIO(content), formats=["PNG", "JPEG", "WEBP"]) as image:
        if image.width * image.height > 20_000_000:
            raise ValueError("Rasm 20 megapikseldan katta bo‘lmasligi kerak.")
        return read_image(ImageOps.exif_transpose(image))


@router.post("")
async def import_words(request: Request, file: UploadFile = File(...)):
    data = await file.read(MAX_SIZE + 1)
    await file.close()
    if not data or len(data) > MAX_SIZE:
        raise HTTPException(413, "Fayl hajmi 8 MB dan oshmasligi kerak.")
    try:
        text = await anyio.to_thread.run_sync(extract, data, limiter=request.app.state.ocr_limiter)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, pdfium.PdfiumError):
        raise HTTPException(422, "Faylni o‘qib bo‘lmadi. PDF, ODT, ODS, JPG, PNG yoki WebP fayl yuklang.") from None
    except ValueError as error:
        raise HTTPException(422, str(error)) from None
    if not text.strip():
        raise HTTPException(422, "Faylda o‘qiladigan matn topilmadi.")
    return {"text": text[:20000]}
