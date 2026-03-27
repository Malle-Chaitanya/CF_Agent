import pdfplumber
import sys
import io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

pdf_path = r"C:\Users\ChaitanyaMalle\Downloads\CloudFuze_Manage_AI_Agent_PRD_Phase1 (1).pdf"

print(f"Extracting text from: {pdf_path}")
print("=" * 80)

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    print("=" * 80)
    for i, page in enumerate(pdf.pages, 1):
        print(f"\n{'=' * 80}")
        print(f"PAGE {i}")
        print(f"{'=' * 80}")
        text = page.extract_text()
        if text:
            print(text)
        else:
            print("[No text extracted from this page]")

        # Also try to extract tables
        tables = page.extract_tables()
        if tables:
            print(f"\n--- Tables on page {i} ---")
            for j, table in enumerate(tables, 1):
                print(f"\nTable {j}:")
                for row in table:
                    print(" | ".join([str(cell) if cell else "" for cell in row]))

print("\n" + "=" * 80)
print("EXTRACTION COMPLETE")
