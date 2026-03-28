/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  FileText, 
  RefreshCw, 
  Copy, 
  Download, 
  ShieldAlert,
  Zap,
  Target,
  UserCheck,
  ClipboardList,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---

type RequirementType = 'User Story' | 'BRD / Functional Requirement' | 'Acceptance Criteria' | 'Release Note';
type Domain = 'General Software' | 'Fintech / Banking' | 'E-commerce' | 'ERP / Enterprise';

interface AnalysisResult {
  score: number;
  ambiguities: string[];
  missingCriteria: string[];
  risks: string[];
  questions: string[];
  improvedCriteria: string[];
  summary: string;
}

// --- Constants & Samples ---

const WEAK_REQUIREMENT = `The system should load quickly and be very secure. Only authorized users should be able to edit records. The user interface must be user-friendly and optimized for performance. We need a seamless integration with the existing database. Appropriate error messages should be shown if something goes wrong.`;

const STRONG_REQUIREMENT = `As a Senior Account Manager, I want to be able to edit customer credit limits so that I can adjust them based on recent payment history. 

Acceptance Criteria:
1. Only users with the 'Admin' or 'Senior Manager' role can access the 'Edit Credit Limit' button.
2. The credit limit field must only accept positive numeric values up to $1,000,000.
3. If a value exceeds $500,000, a secondary approval from a 'Director' role is required before the change is persisted.
4. The system must log the previous limit, new limit, timestamp, and the UID of the editor in the 'Audit_Logs' table.
5. The UI must respond within 200ms for all validation checks.
6. If the database connection fails during save, a 'Service Unavailable (Error 503)' message must be displayed to the user.`;

// --- Components ---

const ScoreGauge = ({ score }: { score: number }) => {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-emerald-500';
    if (s >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getBgColor = (s: number) => {
    if (s >= 80) return 'bg-emerald-50';
    if (s >= 60) return 'bg-amber-50';
    return 'bg-rose-50';
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 rounded-2xl ${getBgColor(score)} border border-current/10`}>
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="58"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="opacity-10"
          />
          <circle
            cx="64"
            cy="64"
            r="58"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={364.4}
            strokeDashoffset={364.4 - (364.4 * score) / 100}
            strokeLinecap="round"
            className={`${getColor(score)} transition-all duration-1000 ease-out`}
          />
        </svg>
        <span className={`absolute text-4xl font-bold ${getColor(score)}`}>
          {score}
        </span>
      </div>
      <div className="mt-4 text-center">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Testability Score</h3>
        <p className="text-xs text-gray-400 mt-1">Based on clarity & completeness</p>
      </div>
    </div>
  );
};

const ResultCard = ({ title, items, icon: Icon, colorClass }: { title: string, items: string[], icon: any, colorClass: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-lg ${colorClass}`}>
        <Icon size={20} />
      </div>
      <h3 className="font-bold text-gray-800">{title}</h3>
    </div>
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
          <ChevronRight size={16} className="mt-0.5 flex-shrink-0 text-gray-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </motion.div>
);

export default function App() {
  const [inputText, setInputText] = useState('');
  const [reqType, setReqType] = useState<RequirementType>('User Story');
  const [domain, setDomain] = useState<Domain>('General Software');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeRequirement = async () => {
    if (!inputText.trim()) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following software requirement for ambiguity, risks, and testability.
        
        Requirement Type: ${reqType}
        Domain: ${domain}
        Text: ${inputText}
        
        Act as a Senior QA Lead and Business Analyst. Critically inspect the text for:
        - Vague words (fast, secure, user-friendly, etc.)
        - Missing roles/actors
        - Incomplete business rules
        - Missing negative/error scenarios
        - Missing performance/SLA/audit/access control details
        
        Provide a structured review in JSON format.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER, description: "Testability score from 0 to 100" },
              ambiguities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of vague terms or phrases found" },
              missingCriteria: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of missing acceptance criteria" },
              risks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of hidden risks or assumptions" },
              questions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Clarifying questions for stakeholders" },
              improvedCriteria: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Suggested better-defined criteria" },
              summary: { type: Type.STRING, description: "A brief professional summary of the review" }
            },
            required: ["score", "ambiguities", "missingCriteria", "risks", "questions", "improvedCriteria", "summary"]
          }
        }
      });

      const response = await model;
      const data = JSON.parse(response.text);
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to analyze requirement. Please check your connection and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setInputText('');
    setResult(null);
    setError(null);
  };

  const loadSample = (text: string) => {
    setInputText(text);
    setResult(null);
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `
SpecSentry Analysis Summary
--------------------------
Score: ${result.score}/100
Summary: ${result.summary}

Ambiguities:
${result.ambiguities.map(a => `- ${a}`).join('\n')}

Missing Criteria:
${result.missingCriteria.map(m => `- ${m}`).join('\n')}

Risks:
${result.risks.map(r => `- ${r}`).join('\n')}
    `;
    navigator.clipboard.writeText(text);
  };

  const downloadSummary = () => {
    if (!result) return;
    const content = JSON.stringify(result, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `specsentry-analysis-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <ShieldAlert className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">
              SpecSentry <span className="font-normal text-slate-400">| Ambiguity Scanner</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest hidden sm:block">Enterprise QA Tool v1.0</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Input */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-800">
                <FileText size={18} className="text-indigo-600" />
                <h2 className="font-semibold">Requirement Input</h2>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                    <select 
                      value={reqType}
                      onChange={(e) => setReqType(e.target.value as RequirementType)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option>User Story</option>
                      <option>BRD / Functional Requirement</option>
                      <option>Acceptance Criteria</option>
                      <option>Release Note</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Domain</label>
                    <select 
                      value={domain}
                      onChange={(e) => setDomain(e.target.value as Domain)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      <option>General Software</option>
                      <option>Fintech / Banking</option>
                      <option>E-commerce</option>
                      <option>ERP / Enterprise</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Requirement Text</label>
                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your user story or requirement here..."
                    className="w-full h-64 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none leading-relaxed"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button 
                    onClick={analyzeRequirement}
                    disabled={isAnalyzing || !inputText.trim()}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                  >
                    {isAnalyzing ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Now'}
                  </button>
                  <button 
                    onClick={handleReset}
                    className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                    title="Reset"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button 
                    onClick={() => loadSample(STRONG_REQUIREMENT)}
                    className="text-xs font-semibold py-2.5 px-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={14} /> Load Strong
                  </button>
                  <button 
                    onClick={() => loadSample(WEAK_REQUIREMENT)}
                    className="text-xs font-semibold py-2.5 px-4 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                  >
                    <AlertTriangle size={14} /> Load Weak
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-indigo-900 p-6 rounded-2xl text-white overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Info size={18} className="text-indigo-300" />
                  Why SpecSentry?
                </h3>
                <p className="text-sm text-indigo-100 leading-relaxed">
                  Ambiguous requirements are the #1 cause of project delays. SpecSentry uses advanced LLMs to act as a senior reviewer, catching untestable statements before they reach development.
                </p>
              </div>
              <Target className="absolute -bottom-4 -right-4 text-white/5 w-32 h-32" />
            </div>
          </div>

          {/* Right Panel: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {!result && !isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-dashed border-slate-300"
                >
                  <div className="bg-slate-50 p-6 rounded-full mb-6">
                    <Search size={48} className="text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-400">Ready for Analysis</h3>
                  <p className="text-slate-400 mt-2 max-w-xs">Paste a requirement on the left to begin the ambiguity scan.</p>
                </motion.div>
              )}

              {isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-slate-200"
                >
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mt-8">Scanning Requirement...</h3>
                  <p className="text-slate-500 mt-2">Our AI reviewer is critically inspecting for ambiguities.</p>
                  
                  <div className="mt-8 space-y-3 w-full max-w-sm">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="h-full bg-indigo-600"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Parsing Syntax</span>
                      <span>Detecting Vague Terms</span>
                      <span>Risk Assessment</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {result && !isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  {/* Summary Header */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8 items-center">
                    <ScoreGauge score={result.score} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-bold text-slate-800">Reviewer Summary</h2>
                        <div className="flex gap-2">
                          <button 
                            onClick={copyToClipboard}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"
                            title="Copy Summary"
                          >
                            <Copy size={18} />
                          </button>
                          <button 
                            onClick={downloadSummary}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all"
                            title="Download JSON"
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed italic">
                        "{result.summary}"
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded-md border border-indigo-100">
                          {reqType}
                        </span>
                        <span className="px-2.5 py-1 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md border border-slate-100">
                          {domain}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Grid of Results */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ResultCard 
                      title="Ambiguities Found" 
                      items={result.ambiguities} 
                      icon={AlertTriangle} 
                      colorClass="bg-amber-50 text-amber-600"
                    />
                    <ResultCard 
                      title="Hidden Risks" 
                      items={result.risks} 
                      icon={ShieldAlert} 
                      colorClass="bg-rose-50 text-rose-600"
                    />
                    <ResultCard 
                      title="Missing Criteria" 
                      items={result.missingCriteria} 
                      icon={ClipboardList} 
                      colorClass="bg-indigo-50 text-indigo-600"
                    />
                    <ResultCard 
                      title="Clarifying Questions" 
                      items={result.questions} 
                      icon={HelpCircle} 
                      colorClass="bg-sky-50 text-sky-600"
                    />
                  </div>

                  {/* Full Width Improved Criteria */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-emerald-500 text-white">
                        <UserCheck size={20} />
                      </div>
                      <h3 className="font-bold text-emerald-900">Suggested Improved Criteria</h3>
                    </div>
                    <div className="space-y-4">
                      {result.improvedCriteria.map((item, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl border border-emerald-100 text-sm text-slate-700 leading-relaxed shadow-sm">
                          {item}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="mt-6 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-sm flex items-center gap-3">
                <AlertTriangle size={18} />
                {error}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <ShieldAlert size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">SpecSentry</span>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-xs font-medium text-slate-400 hover:text-indigo-600 transition-colors">Documentation</a>
            <a href="#" className="text-xs font-medium text-slate-400 hover:text-indigo-600 transition-colors">QA Best Practices</a>
            <a href="#" className="text-xs font-medium text-slate-400 hover:text-indigo-600 transition-colors">Enterprise Support</a>
          </div>
          <div className="text-xs text-slate-400">
            © 2026 SpecSentry AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
