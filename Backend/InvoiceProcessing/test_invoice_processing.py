import asyncio
import logging
import sys
import os

# Add the parent directory to sys.path to allow importing modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path
from service.classifier import process_invoice, load_prompt
from service.config import settings

logging.basicConfig(level=logging.INFO)

async def test_file(file_path: Path):
    print(f"Testing {file_path.name}...")
    if not file_path.exists():
        print(f"File not found: {file_path}")
        return

    data = file_path.read_bytes()
    
    try:
        # Step 1: Process Invoice (Unified Flow)
        prompt_content = load_prompt(settings.prompt_path)
        
        result = process_invoice(
            file_bytes=data,
            filename=file_path.name,
            prompt_content=prompt_content,
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
        )
        
        print("Result:")
        print(f"Category: {result.category_code}")
        print(f"Amount: {result.amount_incl_tax}")
        print(f"Invoice No: {result.invoice_number}")
        print(f"Issue Date: {result.issue_date}")
        print(f"Remark: {result.remark}")
        print(f"Reason: {result.reason}")
        print("-" * 30)
    except Exception as e:
        print(f"Error processing {file_path.name}: {e}")
        import traceback
        traceback.print_exc()

async def main():
    files = [
        "/Users/shenruiyang/Working/TravelReimbursement/Backend/InvoiceProcessing/Tests/【飞猪】上海-白山市 (往返) 订单8265750667268-机票款凭证 报销凭证.pdf",
        "/Users/shenruiyang/Working/TravelReimbursement/Backend/InvoiceProcessing/Tests/【飞猪】上海-北京 (往返) 订单8937574138268-机票款凭证 报销凭证.pdf",
        "/Users/shenruiyang/Working/TravelReimbursement/Backend/InvoiceProcessing/Tests/【一嗨-320.00元】订单1236402395电子发票(1).pdf"
    ]
    
    for f in files:
        await test_file(Path(f))

if __name__ == "__main__":
    asyncio.run(main())
