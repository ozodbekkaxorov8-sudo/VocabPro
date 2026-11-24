from io import BytesIO
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

OFFICE = "{urn:oasis:names:tc:opendocument:xmlns:office:1.0}"
TEXT = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"
TABLE = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
PARAGRAPHS = {f"{TEXT}p", f"{TEXT}h"}
MIME_TYPES = {b"application/vnd.oasis.opendocument.text", b"application/vnd.oasis.opendocument.spreadsheet"}


def read_odf(content: bytes) -> str:
    try:
        with ZipFile(BytesIO(content)) as archive:
            if archive.getinfo("mimetype").file_size > 128 or archive.read("mimetype").strip() not in MIME_TYPES:
                raise ValueError("OpenDocument uchun ODT yoki ODS formatidan foydalaning.")
            if archive.getinfo("content.xml").file_size > 2 * 1024 * 1024:
                raise ValueError("OpenDocument faylidagi matn juda katta.")
            root = ElementTree.fromstring(archive.read("content.xml"))
    except (BadZipFile, KeyError, RuntimeError, ElementTree.ParseError):
        raise ValueError("OpenDocument faylini o‘qib bo‘lmadi.") from None
    body = root.find(f"{OFFICE}body")
    if body is None:
        return ""
    for tab in body.iter(f"{TEXT}tab"):
        tab.text = "\t"
    for space in body.iter(f"{TEXT}s"):
        space.text = " "
    for line_break in body.iter(f"{TEXT}line-break"):
        line_break.text = "\n"
    lines = []
    nodes = [body]
    while nodes:
        node = nodes.pop()
        if node.tag == f"{TABLE}table-row":
            cells = []
            for cell in node.findall(f"{TABLE}table-cell"):
                cells.append(" ".join("".join(paragraph.itertext()).strip() for paragraph in cell if paragraph.tag in PARAGRAPHS))
            if line := "\t".join(cells).rstrip("\t"):
                lines.append(line)
        elif node.tag in PARAGRAPHS:
            lines.append("".join(node.itertext()))
        else:
            nodes.extend(reversed(node))
    return "\n".join(lines)
