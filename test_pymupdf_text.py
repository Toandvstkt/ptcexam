import fitz

doc = fitz.open("T1-2.pdf")
print("Total pages:", len(doc))
for i in range(min(5, len(doc))):
    page = doc.load_page(i)
    text = page.get_text()
    print(f"--- Page {i+1} ---")
    print(f"Length of text: {len(text)}")
    if text.strip():
        print(text[:300])
    else:
        print("[Empty]")
