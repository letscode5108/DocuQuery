import { useState } from 'react';
import { Search, FileUp, FileText, BookOpen, Briefcase, School, MessageSquare, ArrowRight,  Check } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';


export default function LandingPage() {
  const [chatMessages, setChatMessages] = useState([
    { role: 'system', content: 'Upload complete! Ask me anything about your document.' },
    { role: 'user', content: 'What are the key findings in the research paper?' },
    { role: 'system', content: 'The key findings in the research paper include:\n\n1. A 37% increase in efficiency using the new algorithm\n2. Reduced error rates from 8.4% to 2.1%\n3. Successful application across 5 different domains\n4. Confirmation of the hypothesis with statistical significance (p<0.001)' },
    { role: 'user', content: 'Summarize the methodology section.' },
    { role: 'system', content: 'The methodology section outlines a mixed-methods approach combining quantitative analysis of performance metrics with qualitative user interviews. The researchers used a randomized control trial with 240 participants split into test and control groups. Data was collected over a 6-month period and analyzed using both traditional statistical methods and machine learning algorithms to identify patterns.' }
  ]);

  const [inputMessage, setInputMessage] = useState('');

  const handleSendMessage = () => {
    if (inputMessage.trim() === '') return;
    
    setChatMessages([...chatMessages, { role: 'user', content: inputMessage }]);
    setInputMessage('');
    
    // Simulate a response after a short delay
    setTimeout(() => {
      setChatMessages(prevMessages => [
        ...prevMessages, 
        { 
          role: 'system', 
          content: 'Based on the document, the answer to your question involves analyzing the data presented in section 3.2. The document suggests that the implementation strategy should focus on gradual adoption rather than complete overhaul, with initial testing in smaller departments before company-wide deployment.'
        }
      ]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="py-6 px-6 md:px-12 lg:px-16 bg-slate-800 border-b border-slate-700">
        <div className="w-full mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-indigo-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">DocuQuery</h1>
          </div>
          <div className="hidden md:flex gap-6">
            <a href="#features" className="text-slate-300 hover:text-white transition">Features</a>
            <a href="#demo" className="text-slate-300 hover:text-white transition">Demo</a>
            <a href="#use-cases" className="text-slate-300 hover:text-white transition">Use Cases</a>
            <a href="#pricing" className="text-slate-300 hover:text-white transition">Pricing</a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 px-6 md:px-12 lg:px-16 bg-gradient-to-b from-slate-800 to-slate-900">
        <div className="w-full mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Transform Your Document Experience with AI-Powered Q&A
            </h2>
            <p className="text-xl text-slate-300 mb-8">
            Unlock the knowledge hidden in your PDFs — get instant, AI-powered answers.
            Upload your documents and let our AI deliver fast, accurate insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/document" className='inline-block'>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-lg py-6 px-8">
                Try It Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              </Link>
            
            
            
            </div>
          </div>
          
            <div className="relative">
           
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-6 md:px-12 lg:px-16 bg-slate-900">
        <div className="w-full mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-white">Advanced Features</h2>
          <p className="text-xl text-slate-300 text-center mb-12 max-w-4xl mx-auto">
            Our platform combines cutting-edge AI with simple usability to give you the most effective document Q&A experience.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="bg-indigo-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Semantic Search</h3>
              <p className="text-slate-300">
                Our AI understands the meaning behind your questions, not just keywords, to find the most relevant information.
              </p>
            </div>
            
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="bg-purple-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Multi-Document Analysis</h3>
              <p className="text-slate-300">
                Upload multiple PDFs and our system will analyze connections between documents to provide comprehensive answers.
              </p>
            </div>
            
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="bg-pink-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Conversational AI</h3>
              <p className="text-slate-300">
                Have natural conversations about your documents with follow-up questions and contextual understanding.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-16 px-6 md:px-12 lg:px-16 bg-slate-800">
        <div className="w-full mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-white">See It In Action</h2>
          <p className="text-xl text-slate-300 text-center mb-12 max-w-4xl mx-auto">
            Experience how DocuQuery transforms the way you interact with your documents.
          </p>
          
          <Tabs defaultValue="upload" className="w-full max-w-5xl mx-auto">
            <TabsList className="grid w-full grid-cols-3 bg-slate-700">
              <TabsTrigger value="upload" className="data-[state=active]:bg-indigo-600">Upload</TabsTrigger>
              <TabsTrigger value="ask" className="data-[state=active]:bg-indigo-600">Ask Questions</TabsTrigger>
              <TabsTrigger value="insights" className="data-[state=active]:bg-indigo-600">Get Insights</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="mt-6 bg-slate-900 p-6 rounded-xl border border-slate-700">
              <div className="flex flex-col items-center">
                <div className="w-full max-w-md p-8 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-750 transition cursor-pointer">
                  <FileUp className="h-12 w-12 text-indigo-400 mb-4" />
                  <p className="text-lg text-slate-300 mb-2">Drag and drop your PDF here</p>
                  <p className="text-sm text-slate-400">or</p>
                  <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700">Browse files</Button>
                </div>
                
                <div className="mt-8 w-full">
                  <Alert className="bg-green-900 border-green-600">
                    <Check className="h-5 w-5 text-green-400" />
                    <AlertTitle>Upload Complete!</AlertTitle>
                    <AlertDescription>
                      Your document "Strategic Business Plan 2025.pdf" has been processed and is ready for Q&A.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="ask" className="mt-6 bg-slate-900 p-6 rounded-xl border border-slate-700">
              <div className="flex flex-col h-96">
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {chatMessages.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-3/4 p-3 rounded-lg ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-slate-700 text-slate-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <Input 
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask a question about your document..." 
                    className="flex-1 bg-slate-800 border-slate-600 text-slate-100"
                  />
                  <Button onClick={handleSendMessage} className="bg-indigo-600 hover:bg-indigo-700">
                    Send
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="insights" className="mt-6 bg-slate-900 p-6 rounded-xl border border-slate-700">
              <div className="space-y-6">
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                  <h3 className="text-lg font-medium mb-2 text-white">Key Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {["Market Analysis", "Financial Projections", "Risk Assessment", "Strategic Goals", "Implementation Plan"].map((topic) => (
                      <div key={topic} className="bg-indigo-900 px-3 py-1 rounded-full text-sm">
                        {topic}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                  <h3 className="text-lg font-medium mb-2 text-white">Document Summary</h3>
                  <p className="text-slate-300">
                    This 25-page strategic business plan outlines the company's growth strategy for 2025, including expansion into new markets, product development roadmap, and financial projections. Key initiatives focus on digital transformation and sustainability efforts.
                  </p>
                </div>
                
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                  <h3 className="text-lg font-medium mb-2 text-white">Suggested Questions</h3>
                  <ul className="space-y-2">
                    <li className="cursor-pointer hover:text-indigo-400 transition">• What are the projected growth rates for each market segment?</li>
                    <li className="cursor-pointer hover:text-indigo-400 transition">• Summarize the risk mitigation strategies.</li>
                    <li className="cursor-pointer hover:text-indigo-400 transition">• What is the timeline for the digital transformation initiative?</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-16 px-6 md:px-12 lg:px-16 bg-slate-900">
        <div className="w-full mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-white">Use Cases</h2>
          <p className="text-xl text-slate-300 text-center mb-12 max-w-4xl mx-auto">
            See how professionals across different industries use DocuQuery to save time and extract valuable insights.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-indigo-500 transition">
              <div className="bg-blue-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Business Professionals</h3>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Quickly extract insights from market research reports</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Analyze competitor whitepapers and industry documents</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Navigate complex legal agreements and contracts</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-indigo-500 transition">
              <div className="bg-purple-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <School className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Researchers & Students</h3>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Get answers from academic papers and research documents</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Summarize key findings from lengthy publications</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Connect concepts across multiple sources for literature reviews</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-indigo-500 transition">
              <div className="bg-pink-600 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-white">Legal Professionals</h3>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Search through case law and find relevant precedents</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Extract specific clauses from lengthy contracts</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                  <span>Compare different versions of legal documents</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 px-6 md:px-12 lg:px-16 bg-slate-800">
        <div className="w-full mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-white">Simple, Transparent Pricing</h2>
          <p className="text-xl text-slate-300 text-center mb-12 max-w-4xl mx-auto">
            Choose the plan that works best for your document analysis needs.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 flex flex-col">
              <h3 className="text-xl font-bold mb-2 text-white">Free</h3>
              <div className="text-3xl font-bold mb-4 text-white">$0<span className="text-lg font-normal text-slate-400">/month</span></div>
              <p className="text-slate-300 mb-6">Perfect for occasional document queries.</p>
              
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-slate-300">5 document uploads per month</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-slate-300">50 questions per month</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-slate-300">Max 10MB per document</span>
                </li>
              </ul>
              
              <Button className="mt-auto w-full bg-slate-700 hover:bg-slate-600">
                Get Started
              </Button>
            </div>
            
            <div className="bg-indigo-900 p-6 rounded-xl border border-indigo-700 flex flex-col relative">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-indigo-600 px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Pro</h3>
              <div className="text-3xl font-bold mb-4 text-white">$29<span className="text-lg font-normal text-indigo-300">/month</span></div>
              <p className="text-indigo-200 mb-6">For professionals who work with documents regularly.</p>
              
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-indigo-100">Unlimited document uploads</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-indigo-100">500 questions per month</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-indigo-100">Max 50MB per document</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-indigo-100">Multi-document analysis</span>
                </li>
              </ul>
              
              <Button className="mt-auto w-full bg-indigo-600 hover:bg-indigo-700">
                Subscribe Now
              </Button>
            </div>
            
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 flex flex-col">
              <h3 className="text-xl font-bold mb-2 text-white">Enterprise</h3>
              <div className="text-3xl font-bold mb-4 text-white">Custom</div>
              <p className="text-slate-300 mb-6">For organizations with advanced document needs.</p>
              
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-slate-300">Custom document limits</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-slate-300">Unlimited questions</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-slate-300">Max 100MB per document</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-slate-300">API access & integrations</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
                  <span className="text-slate-300">Private deployment options</span>
                </li>
              </ul>
              
              <Button className="mt-auto w-full bg-slate-700 hover:bg-slate-600">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 md:px-12 lg:px-16 bg-gradient-to-b from-indigo-900 to-slate-900">
        <div className="w-full mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-white">Ready to unlock the knowledge in your documents?</h2>
          <p className="text-xl text-indigo-100 mb-8">
            Start asking questions and getting answers today. No credit card required for free plan.
          </p>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-lg py-6 px-8">
            Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 lg:px-16 bg-slate-900 border-t border-slate-800">
        <div className="w-full mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="font-bold text-lg mb-4 text-white">Product</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-white transition">Features</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">API</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Integrations</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-4 text-white">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-white transition">Documentation</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Tutorials</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Blog</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Case Studies</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-4 text-white">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-white transition">About Us</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Careers</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Contact</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Press</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-4 text-white">Legal</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-400 hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Terms of Service</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">Cookie Policy</a></li>
                <li><a href="#" className="text-slate-400 hover:text-white transition">GDPR</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <FileText className="h-6 w-6 text-indigo-400" />
              <span className="font-bold text-lg text-white">DocuQuery</span>
            </div>
            
            <p className="text-slate-400">© 2025 DocuQuery. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}