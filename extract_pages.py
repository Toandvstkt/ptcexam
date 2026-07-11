import fitz  # PyMuPDF

def pdf_to_images(pdf_path, max_pages=10):
    doc = fitz.open(pdf_path)
    for i in range(min(max_pages, len(doc))):
        page = doc.load_page(i)
        pix = page.get_pixmap(dpi=150)
        output_path = f"page_{i+1}.png"
        pix.save(output_path)
        print(f"Saved {output_path}")

if __name__ == "__main__":
    pdf_to_images("T1-2.pdf", 10)
