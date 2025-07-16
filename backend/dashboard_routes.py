import os
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, Field
from typing import List, Dict, Any

# --- Custom Utility Import ---
from utils import get_rich_context

# --- LangChain Imports ---
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

# --- Router Initialization ---
router = APIRouter()

# --- AI Model Configuration ---
try:
    groq_model = ChatGroq(model='gemma2-9b-it', temperature=0.7)
except Exception as e:
    print(f"Error during Groq configuration in dashboard routes: {e}")
    groq_model = None

# --- Pydantic Models for Structured Output ---
class AISummary(BaseModel):
    focus: str = Field(description="A concise, actionable focus for the week. Should be 1-2 sentences.")
    opportunity: str = Field(description="A key product or category opportunity to capitalize on. 1-2 sentences.")
    caution: str = Field(description="A key product or category to be cautious about. 1-2 sentences.")
    action: str = Field(description="A single, clear, actionable next step for the seller. 1 sentence.")

# --- API Endpoint for AI Summary ---
@router.post("/summary", response_model=AISummary)
async def get_ai_dashboard_summary(
    products: List[Dict[str, Any]] = Body(...),
    pincode: str = Body(...)
):
    if not groq_model:
        raise HTTPException(status_code=500, detail="AI model is not configured.")

    # 1. Get the rich context
    rich_context = get_rich_context(products=products, pincode=pincode)

    # 2. Set up the Pydantic parser
    parser = PydanticOutputParser(pydantic_object=AISummary)

    # 3. Create the prompt template
    prompt_template = """
    You are an expert e-commerce analyst for sellers in India. Your task is to provide a brief, actionable weekly summary based on the provided context.

    **Analyze the following context:**
    {context}

    **Your Instructions:**
    -  Keep the tone encouraging and direct.
    -  Base your analysis strictly on the provided product inventory, local weather, and upcoming festivals.
    -  Do not make up information. If the context is sparse, provide general advice.
    -  Generate a summary in the following JSON format:

    {format_instructions}

    **RESPONSE:**
    """
    prompt = ChatPromptTemplate.from_template(
        template=prompt_template,
        partial_variables={"format_instructions": parser.get_format_instructions()}
    )

    # 4. Create the chain and invoke
    chain = prompt | groq_model | parser

    try:
        summary_response = await chain.ainvoke({"context": rich_context})
        return summary_response
    except Exception as e:
        print(f"Error invoking AI chain for summary: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate AI summary. Error: {str(e)}") 