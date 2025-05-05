# llama_index_utils.py
import os
from pathlib import Path
from llama_index.core import ServiceContext, VectorStoreIndex, Document, StorageContext,load_index_from_storage
from llama_index.llms.huggingface import HuggingFaceLLM
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core.settings import Settings


# Configure local model for embeddings
embed_model = HuggingFaceEmbedding(model_name="sentence-transformers/paraphrase-MiniLM-L3-v2")

# Configure LLM (lightweight local model)
llm = HuggingFaceLLM(
    model_name="TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    tokenizer_name="TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    device_map="cpu",
    context_window=2048,
    model_kwargs={
        "temperature": 0.1,
        "max_length": 512,
        "do_sample": True,
        "low_cpu_mem_usage": True
    }
)

# Create service context with our models

Settings.llm = llm
Settings.embed_model = embed_model
    


# Directory to store indices
INDICES_DIR = Path("indices")
INDICES_DIR.mkdir(exist_ok=True)

def create_index(text_content: str, doc_id: str):
    """Create an index from the text content"""
    # documents = [Document(text=text_content)]
    # 
    #Create index with our service context
    # index = VectorStoreIndex.from_documents(
        # documents, 
       # service_context=service_context
    # )
    from llama_index.core.node_parser import SentenceSplitter
    parser = SentenceSplitter(chunk_size=512, chunk_overlap=50)
    nodes = parser.get_nodes_from_documents([Document(text=text_content)])
    index=VectorStoreIndex(nodes)
    # Save index to disk
    index.storage_context.persist(str(INDICES_DIR / doc_id))

    
    return index


from llama_index.core.indices.query.query_transform.base import StepDecomposeQueryTransform
from llama_index.core.query_engine import TransformQueryEngine
def query_index(query_text: str, doc_id: str):
    """Query an existing index"""
    # Load index from disk
    try:
      #  from llama_index import StorageContext, load_index_from_storage
        print(f"Loading index for document {doc_id}...")
        storage_context = StorageContext.from_defaults(
            persist_dir=str(INDICES_DIR / doc_id)
        )
        print("Creating index from storage...")
        index = load_index_from_storage(
            storage_context=storage_context
            #service_context=service_context
        )
        print("Creating query engine...")
        # Create query engine
        query_engine = index.as_query_engine(
            similarity_top_k=1,  # Use fewer documents for response generation
            response_mode="compact",
        )
        query_engine = TransformQueryEngine(
            query_engine,
            query_transform=StepDecomposeQueryTransform(),
            transform_metadata={"max_iterations": 2}  # Limit decomposition
        )
        print(f"Executing query: {query_text}")
        # Execute query
        response = query_engine.query(query_text)
        print("Query completed successfully")
        return str(response)
    
    except Exception as e:
        print(f"Error querying index: {str(e)}")
        return f"Error querying index: {str(e)}"


# Add to llama_index_utils.py
def query_index_with_history(query_text: str, doc_id: str, history: str = ""):
    """Query with conversation history for context"""
    try:
      #from llama_index import StorageContext, load_index_from_storage
        
        storage_context = StorageContext.from_defaults(
            persist_dir=str(INDICES_DIR / doc_id)
        )
        
        index = load_index_from_storage(
            storage_context=storage_context
            #service_context=service_context
        )
        
        # Create chat engine instead of query engine
        chat_engine = index.as_chat_engine(
            chat_mode="condense_question",
            similarity_top_k=2,  # Add this
            memory=history if history else None
        )
        
        # Execute query with history
        response = chat_engine.chat(query_text)
        
        return str(response)
    
    except Exception as e:
        return f"Error querying index: {str(e)}"

def query_index_fallback(query_text: str, doc_id: str):
    """A simpler, faster fallback for when the main query times out"""
    try:
        storage_context = StorageContext.from_defaults(
            persist_dir=str(INDICES_DIR / doc_id)
        )
        
        # Create a simpler query engine with minimal processing
        index = load_index_from_storage(storage_context=storage_context)
        query_engine = index.as_query_engine(
            similarity_top_k=1,
            response_mode="tree_summarize",  # Can be faster than default
            # Reduce token count for faster processing
            node_postprocessors=[],  # Remove any postprocessors
        )
        
        response = query_engine.query(query_text)
        return str(response)
    except Exception as e:
        return f"Fallback query also failed: {str(e)}"