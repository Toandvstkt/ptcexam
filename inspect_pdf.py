import pypdf

def inspect_pdf(pdf_path):
    print(f"Opening PDF: {pdf_path}")
    reader = pypdf.PdfReader(pdf_path)
    num_pages = len(reader.pages)
    print(f"Total Pages: {num_pages}")
    
    for i in range(min(5, num_pages)):
        page = reader.pages[i]
        text = page.extract_text()
        print(f"\n--- Page {i+1} ---")
        if text:
            print(f"Extracted Text (first 500 chars):\n{text[:500]}")
        else:
            print("[No text extracted. This might be a scanned PDF.]")

if __name__ == "__main__":
    inspect_pdf("T1-2.pdf")
