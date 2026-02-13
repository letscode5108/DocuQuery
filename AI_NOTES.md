# AI Usage Notes

## LLM Provider & Model Choice

**Primary LLM:** Google Gemini (via google-genai package)

**Models Used:**
1. **gemini-embedding-001** - For document embeddings
   - Why: 3072 dimensions, good quality, generous free tier
   

2. **gemini-2.5-flash** - For answer generation
   - Why: Fast, cost-effective, good quality responses
   

**Why Google Gemini:**
- Free tier is generous for development
- Good embedding quality
- Fast response times
- Easy integration with google-genai package

## What I Used AI For

### Code Generation 
- FastAPI route structure
- React component scaffolding
- TypeScript interfaces
- 

### Problem Solving 
- Pinecone integration issues
- Google GenAI API migration (old package deprecated)
- Database schema design
- Vector dimension mismatch debugging

### Documentation ( AI-assisted)
- README structure
- Code comments
- Type definitions

## What I Checked/Validated Myself

### Critical Logic (manual)
- Vector search implementation
- Source deduplication algorithm
- Multi-document query aggregation
- Embedding dimension configuration
- Database foreign key relationships
- Google GenAI API migration (old package deprecated)

### Security ( manual)
- Environment variable handling
- CORS origins configuration
- Input validation


### Testing ( manual)
- End-to-end upload → query flow
- Multi-document search accuracy
- Source attribution correctness
- Edge cases (empty docs, no results)
- Production deployment verification


## AI Tools Used

1. **Claude (Anthropic)** - Primary assistant
   - Architecture decisions
   - Code generation
   - Debugging

2. **GitHub Copilot** - Code completion
   - Boilerplate code
   - Type definitions

## Learning Outcomes

- Understood vector database concepts deeply
- Learned Pinecone namespace organization
- Mastered FastAPI + React integration
- Gained experience with LLM embedding models